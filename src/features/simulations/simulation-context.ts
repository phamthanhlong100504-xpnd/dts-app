import { useMemo } from 'react';
import { z } from 'zod';
import { useLearnerSession } from '../session/session-store';
import { assertSession, learnerRequest, reloadLearnerProfile } from '../session/session-service';
import { createSimulationApi } from './simulation-api';
import { createSimulationHttpSource } from './domain/simulation-http-source';
import { createSimulationExamHttpSource } from './domain/simulation-exam-http-source';
import type { SimulationScope } from './domain/simulation-learning-types';

export type SimulationContext = ReturnType<typeof createSimulationContext>;
export function createSimulationContext(version: number, userId: string, licenseClass: string) {
  const scope: SimulationScope = { userId, licenseClass };
  function assertCurrent(other: SimulationScope = scope) {
    const current = assertSession(version);
    if (current.profile.id !== userId || current.profile.selectedLicenseClass !== licenseClass || other.userId !== userId || other.licenseClass !== licenseClass) {
      throw new Error('Tài khoản hoặc hạng bằng đã thay đổi. Vui lòng mở lại nội dung.');
    }
  }
  const api = createSimulationApi(() => assertCurrent());
  return { version, scope, api, assertCurrent,
    learning: createSimulationHttpSource(api, assertCurrent, assertCurrent, true),
    exams: createSimulationExamHttpSource(api, assertCurrent, true) };
}
export function useSimulationContext(): SimulationContext | null {
  const version = useLearnerSession(state => state.version);
  const userId = useLearnerSession(state => state.session?.profile.id);
  const license = useLearnerSession(state => state.session?.profile.selectedLicenseClass);
  return useMemo(() => userId && license ? createSimulationContext(version, userId, license) : null, [version, userId, license]);
}
const capabilitySchema = z.object({ code: z.string().min(1), simulationEnabled: z.boolean(), simulationReady: z.boolean(), simulationBankVersion: z.string().min(1).nullable() });
export type SimulationCapability = z.infer<typeof capabilitySchema>;
export async function loadSimulationCapability(context: SimulationContext): Promise<SimulationCapability> {
  context.assertCurrent();
  const profile = await reloadLearnerProfile();
  context.assertCurrent();
  if (profile.id !== context.scope.userId || profile.selectedLicenseClass !== context.scope.licenseClass) throw new Error('Hạng bằng đã thay đổi.');
  const raw = await learnerRequest<unknown>('/api/practice/v1/exams/license-catalog');
  context.assertCurrent();
  if (!Array.isArray(raw)) throw new Error('Chưa đọc được danh mục hạng bằng.');
  const values = raw.filter(value => value && typeof value === 'object' && value.code === context.scope.licenseClass);
  if (values.length !== 1) throw new Error('Chưa xác nhận được hạng bằng đã chọn.');
  const value = capabilitySchema.parse(values[0]);
  if (value.simulationReady && (!value.simulationEnabled || !value.simulationBankVersion)) throw new Error('Thông tin mô phỏng chưa nhất quán.');
  return value;
}
