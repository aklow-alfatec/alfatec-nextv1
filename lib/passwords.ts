/** Password rules (P25). Pure: shared by the set-password page, change password and their tests. */

export const MIN_LENGTH = 10;

// A short list of the most common passwords of 10+ characters; anything on it is refused.
const COMMON = new Set([
  '1234567890', '0123456789', 'qwertyuiop', 'password12', 'password123', 'password1234', 'iloveyou12', '1q2w3e4r5t',
  'qwerty1234', 'qwerty12345', 'abcdefghij', 'abc1234567', 'letmein123', 'welcome123', 'admin12345', 'football12',
  'baseball12', 'princess12', 'sunshine12', 'dragon1234', 'monkey1234', '1111111111', '0000000000', 'aaaaaaaaaa',
  'passw0rd12', 'p@ssw0rd12', 'changeme12', 'alfatec123', 'alfatec1234', 'trading123',
]);

/** null when the password is acceptable, else the reason in plain words. */
export function passwordProblem(password: string, email: string): string | null {
  if (password.length < MIN_LENGTH) return `Use at least ${MIN_LENGTH} characters.`;
  if (password.length > 200) return 'That password is too long.';
  const p = password.toLowerCase();
  if (p === email.trim().toLowerCase() || p === email.trim().toLowerCase().split('@')[0]) return 'Do not use your email as the password.';
  if (COMMON.has(p)) return 'That password is too common; choose another.';
  if (new Set(p).size < 4) return 'Use a password with more different characters.';
  return null;
}
