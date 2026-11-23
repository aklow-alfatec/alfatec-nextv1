import { LoadingView } from '@/components/loading-view';

/** Shown inside the app shell (the sidebar stays) while any page under it loads its data. */
export default function Loading() {
  return <LoadingView label="Loading page" />;
}
