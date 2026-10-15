import { ExperimentClient } from './experiment-client';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ExperimentClient id={id} />;
}
