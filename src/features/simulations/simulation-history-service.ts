import { z } from 'zod';
import { learnerRequest } from '../session/session-service';
import { loadSimulationCapability, type SimulationContext } from './simulation-context';

const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const instant = z.string().datetime({ offset: true });
const label = z.string().trim().min(1);
const activitySchema = z.enum(['SIM_RANDOM_EXAM', 'SIM_PRESET_EXAM']);
const outcomeSchema = z.enum(['PASSED', 'FAILED']);
const rowSchema = z.object({
  resultId: z.string().uuid(), sessionId: z.string().uuid(), sourceId: z.string().uuid(),
  sourceType: z.literal('SIMULATION_SESSION'), module: z.literal('SIMULATION'),
  activityType: activitySchema, displayTitle: label, licenseClass: label,
  score: count.max(50), maxScore: z.literal(50), sourceScore: count.max(50), sourceMaxScore: z.literal(50),
  result: outcomeSchema, startedAt: instant, completedAt: instant, durationSeconds: count.nullable(),
  bankVersion: label.max(96), scoringVersion: label,
  presetSetId: z.string().uuid().nullable(), presetVersionId: z.string().uuid().nullable(),
  resultAvailable: z.boolean(), reviewAvailable: z.boolean(),
  sourceResult: z.object({
    sourceType: z.literal('SIMULATION_SESSION'), sourceId: z.string().uuid(), licenseClass: label,
    resultPath: z.string().nullable(), reviewPath: z.string().nullable().optional(),
    resultApiPath: z.string().nullable().optional(), reviewApiPath: z.string().nullable().optional(),
  }),
});
const pageSchema = z.object({
  module: z.literal('SIMULATION'), performanceMode: z.literal('COMBINED'), licenseClass: label,
  asOf: instant, sourceWatermark: count, dataStatus: z.enum(['READY', 'BACKFILLING', 'SYNCING', 'STALE', 'CATALOG_PENDING']),
  simulationReady: z.boolean(),
  syncStatus: z.object({ sequence: count, asOf: instant.nullable(), receivedAt: instant.nullable(), complete: z.boolean(),
    bankReady: z.boolean(), bankVersion: label.nullable(), status: z.enum(['READY', 'BACKFILLING', 'SYNCING', 'STALE']),
    contiguousSequence: count, pendingThrough: count }),
  page: count, size: count.min(1).max(100), sort: z.literal('completedAt,desc'),
  totalElements: count.nullable(), totalPages: count.nullable(), content: z.array(rowSchema),
});
export type SimulationHistoryItem = z.infer<typeof rowSchema>;
export type SimulationHistoryActivity = z.infer<typeof activitySchema>;
export type SimulationHistoryPin = { watermark: number; asOf: string };
export type SimulationHistoryOverview = {
  enabled: boolean; items: SimulationHistoryItem[]; page: number; totalPages: number | null;
  summary: { total: number | null; passed: number | null; failed: number | null };
  pin: SimulationHistoryPin | null; updating: boolean;
};
function invalid(): never { throw new Error('Chưa tải được lịch sử đầy đủ. Vui lòng tải lại trước khi tiếp tục.'); }
function validatePin(pin: SimulationHistoryPin) {
  if (!Number.isSafeInteger(pin.watermark) || pin.watermark < 1 || !Number.isFinite(Date.parse(pin.asOf))) invalid();
}
/** Result lists immutable facts; Practice remains the source of the owned result/review/video. */
async function readPage(context: SimulationContext, activity: SimulationHistoryActivity, page: number, size: number,
  pin?: SimulationHistoryPin, outcome?: 'PASSED' | 'FAILED') {
  context.assertCurrent();
  if (pin) validatePin(pin);
  const query = new URLSearchParams({ licenseClass: context.scope.licenseClass, activityType: activity,
    page: String(page), size: String(size), sort: 'completedAt,desc' });
  if (pin) { query.set('watermark', String(pin.watermark)); query.set('asOf', pin.asOf); }
  if (outcome) query.set('result', outcome);
  const raw = await learnerRequest<unknown>('/api/result/v1/results/me/history/simulations?' + query, { headers: { 'Cache-Control': 'no-store' } }, 'plain');
  context.assertCurrent();
  const parsed = pageSchema.safeParse(raw);
  if (!parsed.success) invalid();
  const value = parsed.data;
  if (value.licenseClass !== context.scope.licenseClass || value.page !== page || value.size !== size || value.content.length > size
    || value.syncStatus.sequence !== value.sourceWatermark || value.syncStatus.contiguousSequence < value.sourceWatermark
    || value.simulationReady !== value.syncStatus.bankReady
    || value.dataStatus === 'READY' && (!value.syncStatus.complete || value.syncStatus.status !== 'READY')
    || pin && (value.sourceWatermark !== pin.watermark || Date.parse(value.asOf) !== Date.parse(pin.asOf))) invalid();
  if (value.syncStatus.asOf && Date.parse(value.asOf) > Date.parse(value.syncStatus.asOf)) invalid();
  const total = value.totalElements, pages = value.totalPages;
  if (value.syncStatus.complete) {
    if (value.sourceWatermark < 1 || total === null || pages === null || pages !== Math.ceil(total / size)
      || value.content.length !== Math.min(size, Math.max(0, total - page * size))) invalid();
  } else if (total !== null || pages !== null) invalid();
  const seen = new Set<string>();
  // Source Instants can carry nanoseconds; equal JS milliseconds may still precede the source cutoff.
  value.content.forEach((item, index) => {
    const ref = item.sourceResult, id = item.sessionId, base = `/practice/simulations/exams/${id}`;
    const apiBase = `/api/practice/v1/simulation-exams/sessions/${id}`;
    if (item.resultId !== id || item.sourceId !== id || ref.sourceId !== id || ref.licenseClass !== context.scope.licenseClass
      || item.licenseClass !== context.scope.licenseClass || item.activityType !== activity
      || item.score !== item.sourceScore || item.maxScore !== item.sourceMaxScore || item.score > item.maxScore
      || outcome && item.result !== outcome || Date.parse(item.startedAt) > Date.parse(item.completedAt)
      || Date.parse(item.completedAt) > Date.parse(value.asOf) || seen.has(id)
      || ref.resultPath !== null && ref.resultPath !== base + '/result'
      || ref.reviewPath != null && ref.reviewPath !== base + '/review'
      || ref.resultApiPath != null && ref.resultApiPath !== `${apiBase}/result?licenseClass=${encodeURIComponent(context.scope.licenseClass)}`
      || ref.reviewApiPath != null && ref.reviewApiPath !== `${apiBase}/review?licenseClass=${encodeURIComponent(context.scope.licenseClass)}`
      || activity === 'SIM_PRESET_EXAM' && (!item.presetSetId || !item.presetVersionId)
      || activity === 'SIM_RANDOM_EXAM' && (item.presetSetId !== null || item.presetVersionId !== null)) invalid();
    if (index && Date.parse(value.content[index - 1].completedAt) < Date.parse(item.completedAt)) invalid();
    seen.add(id);
  });
  return value;
}
export async function getSimulationHistoryOverview(context: SimulationContext, activity: SimulationHistoryActivity, page: number,
  pin?: SimulationHistoryPin): Promise<SimulationHistoryOverview> {
  if (!activitySchema.safeParse(activity).success || !Number.isSafeInteger(page) || page < 0) invalid();
  if (pin) validatePin(pin);
  const capability = await loadSimulationCapability(context);
  context.assertCurrent();
  if (!capability.simulationEnabled) return { enabled: false, items: [], page: 0, totalPages: null,
    summary: { total: null, passed: null, failed: null }, pin: null, updating: false };
  const main = await readPage(context, activity, page, 15, pin);
  if (!main.syncStatus.complete) return { enabled: true, items: main.content, page: main.page, totalPages: null,
    summary: { total: null, passed: null, failed: null }, pin: null, updating: true };
  const confirmed = { watermark: main.sourceWatermark, asOf: main.asOf };
  const [passed, failed] = await Promise.all([
    readPage(context, activity, 0, 1, confirmed, 'PASSED'), readPage(context, activity, 0, 1, confirmed, 'FAILED'),
  ]);
  context.assertCurrent();
  if (passed.totalElements === null || failed.totalElements === null || passed.totalElements + failed.totalElements !== main.totalElements) invalid();
  return { enabled: true, items: main.content, page: main.page, totalPages: main.totalPages,
    summary: { total: main.totalElements, passed: passed.totalElements, failed: failed.totalElements }, pin: confirmed,
    updating: main.dataStatus !== 'READY' || passed.dataStatus !== 'READY' || failed.dataStatus !== 'READY' };
}
export function simulationHistorySessionId(item: SimulationHistoryItem): string | null {
  return item.resultAvailable && item.sourceType === 'SIMULATION_SESSION' && item.sourceResult.sourceType === item.sourceType
    && item.sourceResult.sourceId === item.sessionId && item.sourceId === item.sessionId && item.resultId === item.sessionId
    && item.sourceResult.licenseClass === item.licenseClass
    && item.sourceResult.resultPath === `/practice/simulations/exams/${item.sessionId}/result` ? item.sessionId : null;
}
