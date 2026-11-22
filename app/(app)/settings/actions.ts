'use server';

import bcrypt from 'bcrypt';
import { revalidatePath } from 'next/cache';
import { removeUser, setUserRole } from '@/lib/assets';
import { ROLES as ROLE_LIST, isSuperadmin } from '@/lib/access';
import { appUrl, setPasswordLink } from '@/lib/app-url';
import sql from '@/lib/db';
import { emailGuestLink, inviteGuest, removeGuest } from '@/lib/guests';
import { mailConfigured, passwordChangedEmail } from '@/lib/mailer';
import { passwordProblem } from '@/lib/passwords';
import { isAdminRole, requireAdmin, sessionUser } from '@/lib/session-user';
import { parsePercent } from '@/lib/limit-alert-rules';
import { saveLimitAlertSettings, savePipelineAlertRange } from '@/lib/limit-alerts';
import { currentViewer } from '@/lib/viewer';
import { dispatchWorkflow } from '@/lib/worker-dispatch';

const ROLES: string[] = [...ROLE_LIST];

export async function setRoleAction(email: string, role: string) {
  try {
    const me = await requireAdmin();
    if (!ROLES.includes(role)) throw new Error(`Role must be one of ${ROLES.join(', ')}`);
    if (email === me.email && !isAdminRole(role)) throw new Error('You cannot remove your own admin role');
    await setUserRole(email, role);
    revalidatePath('/settings');
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message };
  }
}

export async function removeUserAction(email: string) {
  try {
    const me = await requireAdmin();
    if (email === me.email) throw new Error('You cannot delete your own account');
    await removeUser(email);
    revalidatePath('/settings');
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message };
  }
}

// ---------------------------------------------------------------- guest accounts (superadmin only)

async function requireSuperadmin() {
  const u = await sessionUser();          // the account's current role from the database
  if (!u) throw new Error('Not signed in');
  if (!isSuperadmin(u.role)) throw new Error('Superadmins only');
  return u;
}

type Result = { ok: true; message?: string } | { ok: false; error: string };

async function guestRun(fn: () => Promise<string | void>): Promise<Result> {
  try {
    await requireSuperadmin();
    const message = await fn();
    revalidatePath('/settings');
    return { ok: true, ...(message ? { message } : {}) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Creates an unverified guest and emails the invite (link valid 48 h). */
export async function inviteGuestAction(name: string, email: string) {
  return guestRun(async () => {
    await inviteGuest(name, email, setPasswordLink(await appUrl()));
    return `Invite sent to ${email.trim().toLowerCase()}.`;
  });
}

/** Pending guest: a new invite email. Verified guest: a password reset email (link valid 1 h). */
export async function emailGuestAction(email: string) {
  return guestRun(async () => {
    const kind = await emailGuestLink(email, setPasswordLink(await appUrl()));
    return kind === 'invite' ? `New invite sent to ${email}.` : `Password reset link sent to ${email}.`;
  });
}

export async function removeGuestAction(email: string) {
  return guestRun(() => removeGuest(email));
}

// ---------------------------------------------------------------- change password (every signed-in account)

const attempts = new Map<string, number[]>();   // user id -> recent wrong attempts (per server instance)
const LIMIT = 5;
const WINDOW_MS = 15 * 60 * 1000;

export async function changePasswordAction(current: string, next: string, confirm: string): Promise<Result> {
  try {
    const me = await sessionUser();
    if (!me) throw new Error('Not signed in');
    const now = Date.now();
    const recent = (attempts.get(me.id) ?? []).filter((t) => now - t < WINDOW_MS);
    if (recent.length >= LIMIT) throw new Error('Too many wrong attempts. Wait 15 minutes and try again.');
    if (next !== confirm) throw new Error('The new passwords do not match.');
    const problem = passwordProblem(next, me.email ?? '');
    if (problem) throw new Error(problem);
    const [row] = await sql<{ password: string }[]>`SELECT password FROM users WHERE id::text = ${me.id}`;
    if (!row || !(await bcrypt.compare(current, row.password))) {
      attempts.set(me.id, [...recent, now]);
      throw new Error('Your current password is not right.');
    }
    if (await bcrypt.compare(next, row.password)) throw new Error('Choose a password different from the current one.');
    attempts.delete(me.id);
    const hash = await bcrypt.hash(next, 10);
    // password_changed_at ends every session signed in before now, this one included (lib/session-user.ts)
    // the app's clock, not the database's: sessions are stamped by this server, so both must use the same clock
    await sql`UPDATE users SET password = ${hash}, password_changed_at = ${new Date()} WHERE id::text = ${me.id}`;
    if (mailConfigured() && me.email) await passwordChangedEmail(me.email).catch(() => undefined);
    return { ok: true, message: 'Password changed. Sign in with your new password.' };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ---------------------------------------------------------------- limit-breach alerts (any full account)

async function requireFullAccount() {
  const v = await currentViewer();
  if (!v) throw new Error('Not signed in');
  if (v.guest) throw new Error('Not available on this account');
  return v;
}

/** After a range change: re-evaluate every stored Friday (backend workflow limit-alerts.yml, about a minute). */
async function reEvaluate(): Promise<string> {
  const r = await dispatchWorkflow('limit-alerts.yml');
  return r.started
    ? 'Saved. The alerts are being re-evaluated with the new range (about a minute).'
    : `Saved, but the re-evaluation did not start (${r.detail}). The next Friday job uses the new range for its weeks; older weeks change after scripts.backfill_limit_alerts --apply.`;
}

export async function saveLimitAlertAction(rangePct: string, checkPct: string): Promise<Result> {
  try {
    const v = await requireFullAccount();
    const range = parsePercent(rangePct);
    const check = parsePercent(checkPct);
    if (typeof range !== 'number') throw new Error('Alert range: a percentage above 0, e.g. 20');
    if (typeof check !== 'number') throw new Error('Check-data level: a percentage above 0, e.g. 50');
    if (check <= range) throw new Error('The check-data level must be above the alert range');
    await saveLimitAlertSettings(range, check, v.email ?? v.name ?? 'unknown');
    const message = await reEvaluate();
    revalidatePath('/settings');
    revalidatePath('/');
    return { ok: true, message };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Per-pipeline override; an empty value goes back to the global range. */
export async function savePipelineAlertRangeAction(pipeline: string, rangePct: string): Promise<Result> {
  try {
    await requireFullAccount();
    const range = parsePercent(rangePct);
    if (range === null) throw new Error('A percentage above 0, e.g. 30, or empty for the global range');
    await savePipelineAlertRange(pipeline, range === '' ? null : range);
    const message = await reEvaluate();
    revalidatePath('/settings');
    revalidatePath('/');
    return { ok: true, message };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
