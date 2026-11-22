// Opening the channel chart of a grading component (docs/featureAsk-002.md). Browser-safe, no imports.

/** `pipeline`: an inactive pipeline's name (Studio -> All assets); omitted for the asset's active pipeline. */
export const channelHref = (symbol: string, node: string, pipeline?: string | null) =>
  `/channel/${encodeURIComponent(symbol)}?node=${encodeURIComponent(node)}${pipeline ? `&pipeline=${encodeURIComponent(pipeline)}` : ''}`;

/** A pop-up window on a computer (one per component, so a second click brings it back), a new tab on a phone. */
export function openChannel(symbol: string, node: string, pipeline?: string | null) {
  const href = channelHref(symbol, node, pipeline);
  const phone = window.matchMedia('(max-width: 767px)').matches;
  if (phone) {
    window.open(href, '_blank', 'noopener');
    return;
  }
  const w = Math.min(1500, Math.round(window.screen.availWidth * 0.9));
  const h = Math.min(950, Math.round(window.screen.availHeight * 0.9));
  const win = window.open(href, `channel-${pipeline ?? symbol}-${node}`.replace(/[^\w-]/g, '_'), `popup,width=${w},height=${h}`);
  win?.focus();
}
