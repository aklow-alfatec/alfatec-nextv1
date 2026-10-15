'use server';
import { AuthError } from 'next-auth';
import { signIn, signOut } from '@/auth';

export async function signOutAction() {
  await signOut({ redirectTo: '/login' });
}

/** Returns an error message, or never returns (redirects) on success. */
export async function loginAction(_prev: string | undefined, formData: FormData): Promise<string | undefined> {
  try {
    await signIn('credentials', {
      email: formData.get('email'),
      password: formData.get('password'),
      redirectTo: '/',
    });
  } catch (e) {
    if (e instanceof AuthError) return 'Invalid email or password.';
    throw e;
  }
}
