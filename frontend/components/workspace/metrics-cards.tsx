type MetricsCardsProps = {
  metrics: Record<string, unknown>;
};

const metrics = [
  ["total_latency_ms", "Total latency", "ms"],
  ["retrieval_latency_ms", "Retrieval", "ms"],
  ["generation_latency_ms", "Generation", "ms"],
  ["cost_usd", "Cost", "USD"],
  ["num_chunks", "Chunks", ""],
] as const;

export function MetricsCards({ metrics: values }: MetricsCardsProps) {
  const entries = metrics.filter(
    (metric) => typeof values[metric[0]] === "number"
  );

  if (!entries.length) {
    return null;
  }

  return (
    <dl className="mt-3 flex flex-wrap gap-3 text-muted-foreground text-xs">
      {entries.map(([key, label, unit]) => {
        const value = values[key] as number;
        const display =
          unit === "ms" ? `${Math.round(value)} ms` : `${value} ${unit}`.trim();

        return (
          <div key={key}>
            <dt className="sr-only">{label}</dt>
            <dd>{display}</dd>
          </div>
        );
      })}
    </dl>
  );
}
