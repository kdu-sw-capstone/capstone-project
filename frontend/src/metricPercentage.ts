// Metrics API uses a fraction, while the UI labels the value as percent.
export function metricPercentage(value: unknown): string | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
    ? (value * 100).toFixed(1) : null;
}
