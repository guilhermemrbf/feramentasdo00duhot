export function metricChange(current?: number, previous?: number) {
  if (current === undefined || previous === undefined) return null;
  if (previous === 0) return current === 0 ? 0 : null;
  return (current - previous) / Math.abs(previous);
}

export function scaleHotComparisonSeries<Key extends string>(
  keys: Key[],
  current: Partial<Record<Key, number>>,
  previous: Partial<Record<Key, number>>,
) {
  return (
    [
      ["Anterior", previous],
      ["Selecionado", current],
    ] as const
  ).map(([period, values]) => ({
    ...Object.fromEntries(keys.map((key) => [key, values[key] ?? null])),
    period,
  }));
}
