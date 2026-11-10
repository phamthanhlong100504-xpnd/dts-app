/** Observed media positions only; this guard never estimates a future video timestamp. */
export function actualMediaMs(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds < 0) throw new Error('Chưa đọc được vị trí video thực tế.');
  return Math.floor(seconds * 1000);
}
export class SimulationMediaClock {
  private previous: { ms: number; at: number } | null = null;
  start(ms: number, at: number) { this.previous = { ms, at }; }
  observe(ms: number, at: number): boolean {
    const before = this.previous;
    if (!Number.isSafeInteger(ms) || ms < 0 || !Number.isFinite(at)) return false;
    if (before && (ms < before.ms - 250 || ms - before.ms > Math.max(0, at - before.at) + 1500)) return false;
    this.previous = { ms, at }; return true;
  }
  clear() { this.previous = null; }
}
