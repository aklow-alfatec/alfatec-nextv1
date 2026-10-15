export function Sparkline({ data, width = 96, height = 28, tone = 'accent' }:
  { data: number[]; width?: number; height?: number; tone?: 'accent' | 'positive' | 'negative' | 'info' }) {
  if (data.length < 2) return <svg width={width} height={height} aria-hidden />;
  const min = Math.min(...data), max = Math.max(...data), span = max - min || 1;
  const pts = data.map((v, i) => `${((i / (data.length - 1)) * (width - 2) + 1).toFixed(1)},${(height - 2 - ((v - min) / span) * (height - 4) + 1).toFixed(1)}`);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="trend">
      <polyline points={pts.join(' ')} fill="none" stroke={`rgb(var(--${tone}))`} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
