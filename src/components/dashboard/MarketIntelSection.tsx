function CategoryTag({ label }: { label: string }) {
  return (
    <span className="border border-line px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-wide text-ink/50">
      {label}
    </span>
  );
}

function MarketPanel({
  region,
  scope,
  categories,
}: {
  region: string;
  scope: string;
  categories: string[];
}) {
  return (
    <div className="border border-line bg-surface p-4">
      <div className="mb-1 flex items-center justify-between">
        <h4 className="text-[15px]">{region}</h4>
        <span className="font-mono text-[10px] uppercase tracking-wide text-ink/40">{scope}</span>
      </div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {categories.map((c) => (
          <CategoryTag key={c} label={c} />
        ))}
      </div>
      <p className="text-sm text-ink/50">
        Not connected yet — bid opportunities and new-development leads for this region will show up here once a
        data source is wired in.
      </p>
    </div>
  );
}

/** Placeholder shell for the GA/FL bid-opportunity radar — scaffolded ahead of the data pipeline, per owner request. */
export function MarketIntelSection() {
  return (
    <section>
      <div className="mb-4 flex items-baseline justify-between border-b-[1.5px] border-ink pb-2">
        <h2 className="text-lg font-normal">Market Intelligence</h2>
        <span className="font-mono text-[10.5px] uppercase tracking-wide text-ink/50">New Opportunities to Bid</span>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <MarketPanel region="Georgia" scope="Statewide" categories={["Commercial", "Government"]} />
        <MarketPanel region="Florida" scope="Jacksonville Area" categories={["Government", "Commercial", "Residential"]} />
      </div>
    </section>
  );
}
