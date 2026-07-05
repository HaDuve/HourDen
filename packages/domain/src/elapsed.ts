export function formatElapsedHMMSS(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function elapsedSecondsSince(startedAtIso: string, now: Date = new Date()): number {
  const elapsedMs = now.getTime() - new Date(startedAtIso).getTime();
  return Math.max(0, Math.floor(elapsedMs / 1000));
}
