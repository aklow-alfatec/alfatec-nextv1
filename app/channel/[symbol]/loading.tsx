import { LoadingView } from '@/components/loading-view';

/** The channel chart window while its prices and lines load. */
export default function Loading() {
  return <LoadingView label="Loading channel chart" variant="chart" />;
}
