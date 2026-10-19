import type { Metadata } from 'next';
import Link from 'next/link';
import { LogoMark } from '@/components/brand/Logo';
import './landing.css';

// Public landing page. Logged-out visitors see it at "/" (auth.config.ts rewrites "/" here); logged-in users
// are sent to the Overview. Static content only: no grades, asset names or other data are shown.
export const metadata: Metadata = { title: 'Alfatec', description: 'Weekly valuation grades for commodities, indices, ETFs and stocks. Private platform, by invitation only.' };

const WHITE = { color: '#FFFFFF' };

const ROWS = [
  { label: 'Metals', zone: 'Extremely Undervalue', color: '#66ffff', cls: 'r1' },
  { label: 'Software stock', zone: 'Undervalue', color: '#66ccff', cls: 'r2' },
  { label: 'US index', zone: 'Normal', color: '#3A4253', cls: 'r3' },
  { label: 'Energy', zone: 'Very Overvalue', color: '#ff00ff', cls: 'r4' },
];

const STEPS = [
  { n: '01', title: 'Proprietary algorithm', text: 'Every asset is measured by our proprietary valuation algorithm across several independent dimensions, refined over decades of market history.' },
  { n: '02', title: 'One grade, every Friday', text: 'The measurements combine into a single grade after the US close — placing every asset on one scale, from Extremely Overvalue to Extremely Undervalue.' },
  { n: '03', title: 'Act on the extremes', text: 'Grade changes arrive by email, and every grade can be backtested as a strategy before you act on it.' },
];

const icon = (d: React.ReactNode) => (
  <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="#F2A93B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
);

const FEATURES = [
  { title: 'Weekly grades', text: 'Every asset graded every Friday, grouped into Commodity, Index, ETF and Stocks.',
    icon: icon(<><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>) },
  { title: 'Symbol insight', text: 'Price and grade on one zoomable chart, with the components behind each grade.',
    icon: icon(<><path d="M3 3v18h18" /><path d="M7 15l4-4 3 3 5-6" /></>) },
  { title: 'Strategy Studio', text: 'Build strategies as visual graphs from 100+ building blocks, then backtest them.',
    icon: icon(<><circle cx="5" cy="6" r="2.5" /><circle cx="19" cy="6" r="2.5" /><circle cx="12" cy="18" r="2.5" /><path d="M7.5 6h9M6.5 8l4.3 7.8M17.5 8l-4.3 7.8" /></>) },
  { title: 'Experiments', text: 'Walk-forward testing with honest overfitting checks — not just the best-looking backtest.',
    icon: icon(<path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />) },
  { title: 'Edge Lab & Kelly', text: 'Find and size edges, always measured against the base rate.',
    icon: icon(<><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" /></>) },
  { title: 'Alerts', text: 'Grade-change emails today; live trading alerts on Telegram coming.',
    icon: icon(<><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></>) },
];

const ZONES = [
  { label: 'Extremely Undervalue', bg: '#66ffff', fg: '#0B1320' },
  { label: 'Very Undervalue', bg: '#caedfb', fg: '#0B1320' },
  { label: 'Undervalue', bg: '#66ccff', fg: '#0B1320' },
  { label: 'Normal', bg: '#2A303C', fg: '#E6E8EE' },
  { label: 'Overvalue', bg: '#ffccff', fg: '#0B1320' },
  { label: 'Very Overvalue', bg: '#ff00ff', fg: '#FFFFFF' },
  { label: 'Extremely Overvalue', bg: '#ff0066', fg: '#FFFFFF' },
];

const BANDS: [number, number, string][] = [[190, 10, '#66ffff'], [175, 15, '#caedfb'], [150, 25, '#66ccff'], [40, 10, '#ffccff'], [25, 15, '#ff00ff'], [0, 25, '#ff0066']];

export default function Welcome() {
  return (
    <div className="lp">
      {/* nav */}
      <header style={{ position: 'relative', zIndex: 2, borderBottom: '1px solid #20242E' }}>
        <div className="wrap" style={{ display: 'flex', alignItems: 'center', gap: 24, height: 72 }}>
          <a href="#top" aria-label="Alfatec home" style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#fff' }}>
            <LogoMark className="mk w-auto" style={{ ...WHITE, height: 30 }} />
            <span className="display" style={{ fontSize: 26, lineHeight: 1 }}>alfatec</span>
          </a>
          <nav className="navlinks" aria-label="Sections" style={{ marginLeft: 24, fontSize: 14 }}>
            <a href="#how">How it works</a>
            <a href="#inside">What&apos;s inside</a>
            <a href="#scale">Grade scale</a>
          </nav>
          <Link className="btn btn-ghost" href="/login" style={{ marginLeft: 'auto', height: 44, padding: '0 20px', fontSize: 15, borderRadius: 10 }}>Sign in</Link>
        </div>
      </header>

      {/* hero */}
      <section id="top" style={{ position: 'relative', padding: '96px 0 112px' }}>
        <div className="gridbg" aria-hidden="true" />
        <div className="wrap hero" style={{ position: 'relative' }}>
          <div>
            <div className="in d1" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px', border: '1px solid #2A303C', borderRadius: 999, fontSize: 13, color: '#AEB6C4' }}>
              <span className="live" style={{ width: 7, height: 7, borderRadius: '50%', background: '#4CC38A' }} />
              Private platform · by invitation only
            </div>
            <h1 className="display in d2" style={{ margin: '22px 0 0', fontSize: 'clamp(40px, 5.4vw, 66px)', lineHeight: 1.04, color: '#fff' }}>
              Know when an asset is cheap — <span style={{ color: '#F2A93B' }}>before the crowd does.</span>
            </h1>
            <p className="in d3" style={{ margin: '24px 0 0', maxWidth: 560, fontSize: 19, lineHeight: 1.6, color: '#AEB6C4' }}>
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
            <div className="float" style={{ border: '1px solid #2A303C', borderRadius: 20, background: '#12151B', padding: 22, boxShadow: '0 30px 80px rgba(0,0,0,.45)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontWeight: 600, fontSize: 15 }}>This week&apos;s grades</div>
                <div style={{ fontSize: 12, color: '#8A93A4' }}>Illustrative</div>
              </div>
              <div style={{ position: 'relative', marginTop: 16, borderRadius: 12, background: '#0E1014', border: '1px solid #20242E', overflow: 'hidden' }}>
                <svg viewBox="0 0 520 200" style={{ display: 'block', width: '100%', height: 'auto' }} role="img" aria-label="Illustrative grade line rising from overvalued into the undervalued zones">
                  {BANDS.map(([y, h, c]) => <rect key={y} x="0" y={y} width="520" height={h} fill={c} opacity=".16" />)}
                  <line x1="0" x2="520" y1="50" y2="50" stroke="#2A303C" strokeDasharray="4 4" />
                  <line x1="0" x2="520" y1="150" y2="150" stroke="#2A303C" strokeDasharray="4 4" />
                  <path className="gline" d="M10 80 L30 70 L50 60 L70 50 L90 42.5 L110 37.5 L130 32.5 L150 40 L170 52.5 L190 67.5 L210 87.5 L230 102.5 L250 115 L270 125 L290 135 L310 147.5 L330 157.5 L350 165 L370 170 L390 177.5 L410 182.5 L430 187.5 L450 192.5 L470 190 L490 185 L510 180" fill="none" stroke="#66ccff" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
                  <g className="cross"><line x1="12" x2="12" y1="0" y2="200" stroke="#AEB6C4" strokeDasharray="3 4" opacity=".7" /></g>
                </svg>
                <div style={{ position: 'absolute', left: 10, top: 8, fontSize: 11, color: '#8A93A4' }}>Grade · undervalued at the bottom</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
                {ROWS.map((r) => (
                  <div key={r.label} className={`row ${r.cls}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 10, background: '#161922' }}>
                    <span style={{ width: 108, fontWeight: 600, fontSize: 14 }}>{r.label}</span>
                    <span style={{ width: 44, height: 12, borderRadius: 6, background: r.color }} />
                    <span style={{ fontSize: 13, color: '#AEB6C4' }}>{r.zone}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* how it works */}
      <section id="how" style={{ padding: '112px 0', borderTop: '1px solid #20242E', background: '#0B0D11' }}>
        <div className="wrap">
          <div className="reveal" style={{ maxWidth: 640 }}>
            <div className="eyebrow">How it works</div>
            <h2 className="display h2">One grade. Every Friday. No noise.</h2>
          </div>
          <div className="steps" style={{ marginTop: 56 }}>
            {STEPS.map((s) => (
              <div key={s.n} className="reveal card" style={{ padding: 28 }}>
                <div className="display" style={{ fontSize: 44, lineHeight: 1, color: '#F2A93B' }}>{s.n}</div>
                <h3 style={{ marginTop: 20, fontSize: 20 }}>{s.title}</h3>
                <p style={{ marginTop: 10, fontSize: 15.5, lineHeight: 1.65 }}>{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* what's inside */}
      <section id="inside" style={{ padding: '112px 0', borderTop: '1px solid #20242E' }}>
        <div className="wrap">
          <div className="reveal" style={{ maxWidth: 640 }}>
            <div className="eyebrow">What&apos;s inside</div>
            <h2 className="display h2">From a weekly grade to a tested strategy.</h2>
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
      <section id="scale" style={{ padding: '112px 0', borderTop: '1px solid #20242E', background: '#0B0D11' }}>
        <div className="wrap">
          <div className="reveal" style={{ maxWidth: 680 }}>
            <div className="eyebrow">The grade scale</div>
            <h2 className="display h2">Higher grade, more undervalued.</h2>
            <p style={{ margin: '16px 0 0', fontSize: 17, lineHeight: 1.6, color: '#AEB6C4' }}>Seven zones, one glance. The colours are the same everywhere in the platform.</p>
          </div>
          <div style={{ position: 'relative', marginTop: 56 }}>
            <div className="marker" aria-hidden="true"><svg viewBox="0 0 20 12" width="20" height="12"><path d="M0 0h20L10 12z" fill="#FFFFFF" /></svg></div>
            <div className="scale">
              {ZONES.map((z, i) => (
                <div key={z.label} className={`seg s${i + 1}`} style={{ background: z.bg, color: z.fg }}>
                  <span className="sheen" aria-hidden="true" />
                  <span className="segname">{z.label}</span>
                </div>
              ))}
            </div>
            <div className="scaleends" style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16, fontSize: 13, color: '#8A93A4' }}>
              <span>← Cheapest against its value</span>
              <span>Most expensive →</span>
            </div>
          </div>
        </div>
      </section>

      {/* call to action */}
      <section style={{ padding: '120px 0', borderTop: '1px solid #20242E', position: 'relative' }}>
        <div className="gridbg" aria-hidden="true" />
        <div className="wrap reveal" style={{ position: 'relative', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <LogoMark className="mk w-auto" style={{ ...WHITE, height: 64 }} />
          <h2 className="display" style={{ margin: '28px 0 0', fontSize: 'clamp(32px, 4vw, 52px)', lineHeight: 1.08, color: '#fff' }}>Ready to see this week&apos;s grades?</h2>
          <Link className="btn btn-primary" href="/login" style={{ marginTop: 32, height: 54, padding: '0 34px', fontSize: 17 }}>Sign in</Link>
          <p style={{ margin: '18px 0 0', fontSize: 14, color: '#8A93A4' }}>Access is by invitation.</p>
        </div>
      </section>

      {/* footer */}
      <footer style={{ borderTop: '1px solid #20242E', padding: '36px 0' }}>
        <div className="wrap" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '16px 32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#fff' }}>
            <LogoMark className="w-auto" style={{ ...WHITE, height: 20 }} />
            <span className="display" style={{ fontSize: 18 }}>alfatec</span>
            <span style={{ marginLeft: 8, fontSize: 13, color: '#8A93A4' }}>© 2026 Alfatec</span>
          </div>
          <p style={{ margin: '0 0 0 auto', maxWidth: 560, fontSize: 13, lineHeight: 1.6, color: '#8A93A4' }}>
            For research and education. Not investment advice. Past performance does not guarantee future results.
          </p>
        </div>
      </footer>
    </div>
  );
}
