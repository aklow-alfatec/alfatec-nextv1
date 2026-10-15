import { NewExperiment } from './new-experiment';

export default async function Page({ searchParams }: { searchParams: Promise<{ graph?: string }> }) {
  const { graph } = await searchParams;
  return <NewExperiment initialGraphId={graph ?? ''} />;
}
