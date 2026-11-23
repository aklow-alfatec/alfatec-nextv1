import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';

// self-hosted (app/fonts, see its README): next/font/google failed under Turbopack once Google's font URLs changed,
// and local files need no download at build time
const sans = localFont({
  src: [
    { path: './fonts/ibm-plex-sans-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: './fonts/ibm-plex-sans-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: './fonts/ibm-plex-sans-latin-600-normal.woff2', weight: '600', style: 'normal' },
  ],
  variable: '--font-sans',
  display: 'swap',
  fallback: ['system-ui', 'Segoe UI', 'Arial', 'sans-serif'],
});
const mono = localFont({
  src: [
    { path: './fonts/ibm-plex-mono-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: './fonts/ibm-plex-mono-latin-500-normal.woff2', weight: '500', style: 'normal' },
  ],
  variable: '--font-mono',
  display: 'swap',
  fallback: ['ui-monospace', 'Consolas', 'monospace'],
});
// wordmark only (doc/logo): closest free match to the logo's lettering
const brand = localFont({
  src: [{ path: './fonts/plus-jakarta-sans-latin-800-normal.woff2', weight: '800', style: 'normal' }],
  variable: '--font-brand',
  display: 'swap',
  fallback: ['system-ui', 'Arial', 'sans-serif'],
});

export const metadata: Metadata = { title: 'Alfatec', description: 'Alfatec platform' };

const themeInit = `try{var t=localStorage.getItem('theme');document.documentElement.dataset.theme=(t==='light'||t==='dark')?t:'dark'}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" className={`${sans.variable} ${mono.variable} ${brand.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
