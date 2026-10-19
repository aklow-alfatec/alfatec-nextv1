import nodemailer from 'nodemailer';

/** Server-side only. Account emails (P25) through the same SMTP account as the Friday job and nextv0
 *  (SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_FROM). Email is required for invites and
 *  resets: callers check mailConfigured() and refuse when it is false. */

export const mailConfigured = () => !!(process.env.SMTP_HOST && process.env.SMTP_FROM);

function transport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

/** One plain branded email: a heading, a paragraph, one button and the link as text. Never contains a password. */
function layout(heading: string, body: string, button?: { label: string; url: string }, footer?: string) {
  const btn = button
    ? `<p style="margin:28px 0"><a href="${esc(button.url)}" style="background:#F2A93B;color:#140E02;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:10px;display:inline-block">${esc(button.label)}</a></p>
       <p style="font-size:12px;color:#5A6372">Or open this link: <br><a href="${esc(button.url)}" style="color:#0F3963;word-break:break-all">${esc(button.url)}</a></p>`
    : '';
  const html = `<!doctype html><html><body style="margin:0;background:#F5F6F8;font-family:Arial,Helvetica,sans-serif;color:#12151B">
  <div style="max-width:520px;margin:0 auto;padding:32px 24px">
    <div style="font-size:24px;font-weight:800;color:#0F3963;letter-spacing:-0.5px">alfatec</div>
    <div style="background:#FFFFFF;border:1px solid #E2E5EA;border-radius:14px;padding:28px;margin-top:16px">
      <h1 style="font-size:20px;margin:0 0 12px;color:#0F3963">${esc(heading)}</h1>
      <p style="font-size:15px;line-height:1.6;margin:0">${body}</p>
      ${btn}
    </div>
    <p style="font-size:12px;color:#5A6372;margin-top:16px">${footer ? esc(footer) : 'If you did not expect this email, you can ignore it.'}</p>
  </div></body></html>`;
  const text = `${heading}\n\n${body.replace(/<[^>]+>/g, '')}${button ? `\n\n${button.label}: ${button.url}` : ''}\n\n${footer ?? 'If you did not expect this email, you can ignore it.'}`;
  return { html, text };
}

async function send(to: string, subject: string, content: { html: string; text: string }) {
  if (!mailConfigured()) throw new Error('Email is not set up (SMTP settings missing)');
  await transport().sendMail({ from: process.env.SMTP_FROM, to, subject, ...content });
}

export function inviteEmail(to: string, name: string, url: string) {
  return send(to, 'You are invited to Alfatec', layout(
    `Welcome, ${name}`,
    'You have been invited to Alfatec, a private platform that grades commodities, indices, ETFs and stocks every week. Set your password to sign in. The link works once and expires in 48 hours.',
    { label: 'Set your password', url },
  ));
}

export function resetEmail(to: string, url: string) {
  return send(to, 'Reset your Alfatec password', layout(
    'Reset your password',
    'Someone asked to reset the password for this Alfatec account. Choose a new password with the button below. The link works once and expires in 1 hour.',
    { label: 'Choose a new password', url },
    'If you did not ask for this, ignore this email: your password stays the same.',
  ));
}

export function passwordChangedEmail(to: string) {
  return send(to, 'Your Alfatec password was changed', layout(
    'Your password was changed',
    'The password for this Alfatec account was just changed, and every device was signed out. If this was not you, reset your password straight away from the sign-in page.',
    undefined,
    'This is an automatic security notice.',
  ));
}
