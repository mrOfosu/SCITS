export function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export function estimatedResolutionLabel(hours: number | null): string {
  if (!hours) return "—";
  if (hours <= 24) return "~1 day";
  if (hours <= 72) return "~3 days";
  if (hours <= 168) return "~1 week";
  return `~${Math.round(hours / 24)} days`;
}
