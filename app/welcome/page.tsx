import type { Metadata } from 'next';
import Link from 'next/link';
import { LogoMark } from '@/components/brand/Logo';
import { LandingThemeToggle } from './theme-toggle';
import './landing.css';

// Public landing page (dark or light, following the app's saved theme; toggle in the nav). Logged-out visitors see it at "/" (auth.config.ts rewrites "/" here); logged-in users
// are sent to the Overview. Static content only: no grades, asset names or other data are shown.
export const metadata: Metadata = { title: 'Alfatec', description: 'Weekly valuation grades for commodities, indices, ETFs and stocks. Private platform, by invitation only.' };

const LOGO = { color: 'var(--lp-logo)' };

const ROWS = [
  { label: 'Metals', zone: 'Extremely Undervalue', color: '#66ffff', cls: 'r1' },
  { label: 'Software stock', zone: 'Undervalue', color: '#66ccff', cls: 'r2' },
  { label: 'US index', zone: 'Normal', color: 'var(--lp-normal)', cls: 'r3' },
  { label: 'Energy', zone: 'Very Overvalue', color: '#ff00ff', cls: 'r4' },
];

const STEPS = [
  { n: '01', title: 'Proprietary algorithm', text: 'Every asset is measured by our proprietary valuation algorithm across several independent dimensions, refined over decades of market history.' },
  { n: '02', title: 'One grade, every Friday', text: 'The measurements combine into a single grade after the US close — placing every asset on one scale, from Extremely Overvalue to Extremely Undervalue.' },
  { n: '03', title: 'Act on the extremes', text: 'Grade changes arrive by email, so you see an asset move into the extremes the week it happens.' },
];

const icon = (d: React.ReactNode) => (
  <svg viewBox="0 0 24 24" width="30" height="30" fill="none" style={{ stroke: 'var(--lp-accent-text)' }} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
);

const FEATURES = [
  { title: 'Weekly grades', text: 'Every asset graded every Friday, grouped into Commodity, Index, ETF and Stocks.',
    icon: icon(<><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>) },
  { title: 'Symbol insight', text: 'Price and grade on one zoomable chart, with the components behind each grade.',
    icon: icon(<><path d="M3 3v18h18" /><path d="M7 15l4-4 3 3 5-6" /></>) },
  { title: 'Alerts', text: 'An email whenever a grade changes, so nothing important slips past you.',
    icon: icon(<><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></>) },
];

const ZONES = [
  { label: 'Extremely Undervalue', bg: '#66ffff', fg: '#0B1320' },
  { label: 'Very Undervalue', bg: '#caedfb', fg: '#0B1320' },
  { label: 'Undervalue', bg: '#66ccff', fg: '#0B1320' },
  { label: 'Normal', bg: 'var(--lp-normal)', fg: 'var(--lp-text)' },
  { label: 'Overvalue', bg: '#ffccff', fg: '#0B1320' },
  { label: 'Very Overvalue', bg: '#ff00ff', fg: '#FFFFFF' },
  { label: 'Extremely Overvalue', bg: '#ff0066', fg: '#FFFFFF' },
];

const BANDS: [number, number, string][] = [[190, 10, '#66ffff'], [175, 15, '#caedfb'], [150, 25, '#66ccff'], [40, 10, '#ffccff'], [25, 15, '#ff00ff'], [0, 25, '#ff0066']];

export default function Welcome() {
  return (
    <div className="lp">
      {/* nav */}
      <header style={{ position: 'relative', zIndex: 2, borderBottom: '1px solid var(--lp-line)' }}>
        <div className="wrap" style={{ display: 'flex', alignItems: 'center', gap: 24, height: 72 }}>
          <a href="#top" aria-label="Alfatec home" style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--lp-head)' }}>
            <LogoMark className="mk w-auto" style={{ ...LOGO, height: 30 }} />
            <span className="display" style={{ fontSize: 26, lineHeight: 1 }}>alfatec</span>
          </a>
          <nav className="navlinks" aria-label="Sections" style={{ marginLeft: 24, fontSize: 14 }}>
            <a href="#how">How it works</a>
            <a href="#inside">What&apos;s inside</a>
            <a href="#scale">Grade scale</a>
          </nav>
          <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            <LandingThemeToggle />
            <Link className="btn btn-ghost" href="/login" style={{ height: 44, padding: '0 20px', fontSize: 15, borderRadius: 10 }}>Sign in</Link>
          </span>
        </div>
      </header>

      {/* hero */}
      <section id="top" style={{ position: 'relative', padding: '96px 0 112px' }}>
        <div className="gridbg" aria-hidden="true" />
        <div className="wrap hero" style={{ position: 'relative' }}>
          <div>
            <div className="in d1" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px', border: '1px solid var(--lp-line2)', borderRadius: 999, fontSize: 13, color: 'var(--lp-text2)' }}>
              <span className="live" style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--lp-live)' }} />
              Private platform · by invitation only
            </div>
            <h1 className="display in d2" style={{ margin: '22px 0 0', fontSize: 'clamp(40px, 5.4vw, 66px)', lineHeight: 1.04, color: 'var(--lp-head)' }}>
              Know when an asset is cheap — <span style={{ color: 'var(--lp-accent-text)' }}>before the crowd does.</span>
            </h1>
            <p className="in d3" style={{ margin: '24px 0 0', maxWidth: 560, fontSize: 19, lineHeight: 1.6, color: 'var(--lp-text2)' }}>
              Alfatec grades commodities, indices, ETFs and stocks every week with a proprietary valuation algorithm — one clear score, from extremely undervalued to extremely overvalued.
            </p>
            <div className="in d4" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 36 }}>
              <Link className="btn btn-primary" href="/login" style={{ height: 52, padding: '0 28px', fontSize: 16 }}>Sign in</Link>
              <a className="btn btn-ghost" href="#how" style={{ height: 52, padding: '0 24px', fontSize: 16 }}>
                See how it works
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6" /></svg>
              </a>
            </div>
          </div>

          <div className="in d5">
            <div className="float" style={{ border: '1px solid var(--lp-line2)', borderRadius: 20, background: 'var(--lp-surface)', padding: 22, boxShadow: 'var(--lp-shadow)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontWeight: 600, fontSize: 15 }}>This week&apos;s grades</div>
                <div style={{ fontSize: 12, color: 'var(--lp-text3)' }}>Illustrative</div>
              </div>
              <div style={{ position: 'relative', marginTop: 16, borderRadius: 12, background: 'var(--lp-bg)', border: '1px solid var(--lp-line)', overflow: 'hidden' }}>
                <svg viewBox="0 0 520 200" style={{ display: 'block', width: '100%', height: 'auto' }} role="img" aria-label="Illustrative grade line rising from overvalued into the undervalued zones">
                  {BANDS.map(([y, h, c]) => <rect key={y} x="0" y={y} width="520" height={h} fill={c} opacity=".16" />)}
                  <line x1="0" x2="520" y1="50" y2="50" style={{ stroke: 'var(--lp-line2)' }} strokeDasharray="4 4" />
                  <line x1="0" x2="520" y1="150" y2="150" style={{ stroke: 'var(--lp-line2)' }} strokeDasharray="4 4" />
                  <path className="gline" d="M10 80 L30 70 L50 60 L70 50 L90 42.5 L110 37.5 L130 32.5 L150 40 L170 52.5 L190 67.5 L210 87.5 L230 102.5 L250 115 L270 125 L290 135 L310 147.5 L330 157.5 L350 165 L370 170 L390 177.5 L410 182.5 L430 187.5 L450 192.5 L470 190 L490 185 L510 180" fill="none" style={{ stroke: 'var(--lp-line-grade)' }} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
                  <g className="cross"><line x1="12" x2="12" y1="0" y2="200" style={{ stroke: 'var(--lp-text2)' }} strokeDasharray="3 4" opacity=".7" /></g>
                </svg>
                <div style={{ position: 'absolute', left: 10, top: 8, fontSize: 11, color: 'var(--lp-text3)' }}>Grade · undervalued at the bottom</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
                {ROWS.map((r) => (
                  <div key={r.label} className={`row ${r.cls}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 10, background: 'var(--lp-raised)' }}>
                    <span style={{ width: 108, fontWeight: 600, fontSize: 14 }}>{r.label}</span>
                    <span style={{ width: 44, height: 12, borderRadius: 6, background: r.color }} />
                    <span style={{ fontSize: 13, color: 'var(--lp-text2)' }}>{r.zone}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* how it works */}
      <section id="how" style={{ padding: '112px 0', borderTop: '1px solid var(--lp-line)', background: 'var(--lp-bg2)' }}>
        <div className="wrap">
          <div className="reveal" style={{ maxWidth: 640 }}>
            <div className="eyebrow">How it works</div>
            <h2 className="display h2">One grade, every week, no noise.</h2>
          </div>
          <div className="steps" style={{ marginTop: 56 }}>
            {STEPS.map((s) => (
              <div key={s.n} className="reveal card" style={{ padding: 28 }}>
                <div className="display" style={{ fontSize: 44, lineHeight: 1, color: 'var(--lp-accent-text)' }}>{s.n}</div>
                <h3 style={{ marginTop: 20, fontSize: 20 }}>{s.title}</h3>
                <p style={{ marginTop: 10, fontSize: 15.5, lineHeight: 1.65 }}>{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* what's inside */}
      <section id="inside" style={{ padding: '112px 0', borderTop: '1px solid var(--lp-line)' }}>
        <div className="wrap">
          <div className="reveal" style={{ maxWidth: 640 }}>
            <div className="eyebrow">What&apos;s inside</div>
            <h2 className="display h2">Everything you need to read the market.</h2>
          </div>
          <div className="feat" style={{ marginTop: 56 }}>
            {FEATURES.map((f) => (
              <div key={f.title} className="reveal card">
                {f.icon}
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* grade scale */}
      <section id="scale" style={{ padding: '112px 0', borderTop: '1px solid var(--lp-line)', background: 'var(--lp-bg2)' }}>
        <div className="wrap">
          <div className="reveal" style={{ maxWidth: 680 }}>
            <div className="eyebrow">The grade scale</div>
            <h2 className="display h2">Higher grade, more undervalued.</h2>
            <p style={{ margin: '16px 0 0', fontSize: 17, lineHeight: 1.6, color: 'var(--lp-text2)' }}>Seven zones, one glance. The colours are the same everywhere in the platform.</p>
          </div>
          <div style={{ position: 'relative', marginTop: 56 }}>
            <div className="marker" aria-hidden="true"><svg viewBox="0 0 20 12" width="20" height="12"><path d="M0 0h20L10 12z" style={{ fill: 'var(--lp-head)' }} /></svg></div>
            <div className="scale">
              {ZONES.map((z, i) => (
                <div key={z.label} className={`seg s${i + 1}`} style={{ background: z.bg, color: z.fg }}>
                  <span className="sheen" aria-hidden="true" />
                  <span className="segname">{z.label}</span>
                </div>
              ))}
            </div>
            <div className="scaleends" style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16, fontSize: 13, color: 'var(--lp-text3)' }}>
              <span>← Cheapest against its value</span>
              <span>Most expensive →</span>
            </div>
          </div>
        </div>
      </section>

      {/* call to action */}
      <section style={{ padding: '120px 0', borderTop: '1px solid var(--lp-line)', position: 'relative' }}>
        <div className="gridbg" aria-hidden="true" />
        <div className="wrap reveal" style={{ position: 'relative', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <LogoMark className="mk w-auto" style={{ ...LOGO, height: 64 }} />
          <h2 className="display" style={{ margin: '28px 0 0', fontSize: 'clamp(32px, 4vw, 52px)', lineHeight: 1.08, color: 'var(--lp-head)' }}>Ready to see this week&apos;s grades?</h2>
          <Link className="btn btn-primary" href="/login" style={{ marginTop: 32, height: 54, padding: '0 34px', fontSize: 17 }}>Sign in</Link>
          <p style={{ margin: '18px 0 0', fontSize: 14, color: 'var(--lp-text3)' }}>Access is by invitation.</p>
        </div>
      </section>

      {/* footer */}
      <footer style={{ borderTop: '1px solid var(--lp-line)', padding: '36px 0' }}>
        <div className="wrap" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '16px 32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--lp-head)' }}>
            <LogoMark className="w-auto" style={{ ...LOGO, height: 20 }} />
            <span className="display" style={{ fontSize: 18 }}>alfatec</span>
            <span style={{ marginLeft: 8, fontSize: 13, color: 'var(--lp-text3)' }}>© 2026 Alfatec</span>
          </div>
          <p style={{ margin: '0 0 0 auto', maxWidth: 560, fontSize: 13, lineHeight: 1.6, color: 'var(--lp-text3)' }}>
            For research and education. Not investment advice. Past performance does not guarantee future results.
          </p>
        </div>
      </footer>
    </div>
  );
}
