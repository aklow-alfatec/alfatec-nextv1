import { notFound } from 'next/navigation';
import { allAssets } from '@/lib/all-assets';
import { lastFinalFriday } from '@/lib/grades';
import { isAdminRole } from '@/lib/session-user';
import { currentViewer } from '@/lib/viewer';
import { AllAssetsTable } from './all-assets-table';

export const dynamic = 'force-dynamic';

/** Studio -> All assets (admin and superadmin): every asset with all its pipelines, active and inactive. */
export default async function AllAssetsPage() {
  const v = await currentViewer();
  if (!v || !isAdminRole(v.role)) notFound();
  const groups = await allAssets(lastFinalFriday());
  const inactive = groups.reduce((n, g) => n + g.others.length, 0);
  return (
    <div className="space-y-4 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-semibold">All assets</h1>
        <p className="text-sm text-fg-2">
          {groups.length} assets · {groups.filter((g) => g.active).length} active pipelines · {inactive} inactive (older versions and
          sandboxes). Expand an asset to see its inactive pipelines; click a pipeline to open it on the asset page.
        </p>
      </div>
      <AllAssetsTable groups={groups} />
    </div>
  );
}
