/** The loading view shown while a page's data loads (Next.js loading.tsx): a spinner with a label and grey
 *  placeholders in the page's rough shape, so a click shows something at once. */
export function LoadingView({ label = 'Loading', variant = 'page' }: { label?: string; variant?: 'page' | 'chart' }) {
  return (
    <div className={variant === 'chart' ? 'flex h-screen flex-col gap-3 bg-bg p-3' : 'space-y-4 p-4 md:p-6'} role="status" aria-live="polite">
      <div className="flex items-center gap-3">
        <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-line-2 border-t-accent" aria-hidden />
        <span className="text-sm text-fg-2">{label}…</span>
      </div>
      {variant === 'chart' ? (
        <div className="min-h-0 flex-1 animate-pulse rounded-card bg-raised" />
      ) : (
        <div className="animate-pulse space-y-4">
          <div className="h-7 w-64 rounded bg-raised" />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[0, 1, 2, 3].map((i) => <div key={i} className="h-16 rounded-card bg-raised" />)}
          </div>
          <div className="h-72 rounded-card bg-raised" />
          <div className="h-40 rounded-card bg-raised" />
        </div>
      )}
    </div>
  );
}
