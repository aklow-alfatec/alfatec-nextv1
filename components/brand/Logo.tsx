import { cn } from '@/lib/cn';

// Alfatec mark rebuilt as polygons from doc/logo/logo2.jpeg (doc/logo/svg). Colour follows --brand:
// navy #0F3963 in the light theme, white in the dark theme.
export function LogoMark({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 1025 968" className={cn('text-brand', className)} style={style} fill="currentColor" aria-hidden>
      <polygon points="0.0,329.0 1014.0,0.0 372.0,563.0" />
      <polygon points="387.0,577.0 481.6,493.9 661.3,826.9 598.0,968.0" />
      <polygon points="494.0,483.1 610.5,380.8 747.6,634.8 669.6,808.5" />
      <polygon points="622.8,370.0 763.6,246.4 850.1,406.6 755.8,616.4" />
      <polygon points="776.0,235.6 1025.0,17.0 858.3,388.2" />
    </svg>
  );
}

/** Mark + "alfatec" wordmark (Plus Jakarta Sans ExtraBold, the closest free match to the logo lettering).
 *  size = mark height in px; text and gap keep the logo's proportions (ascender about 0.68x, gap 0.34x the mark). */
export function Logo({ size = 28, mark = true, className }: { size?: number; mark?: boolean; className?: string }) {
  return (
    <span className={cn('inline-flex items-center text-brand', className)} style={{ gap: size * 0.34 }} aria-label="Alfatec">
      {mark && <LogoMark className="w-auto shrink-0" style={{ height: size }} />}
      <span className="font-extrabold leading-none" style={{ fontFamily: 'var(--font-brand)', fontSize: size * 0.94, letterSpacing: '-0.02em' }}>
        alfatec
      </span>
    </span>
  );
}
