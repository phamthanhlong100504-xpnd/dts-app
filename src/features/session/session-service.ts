import { DtsApiError, envelopeRequest } from '../../lib/api/http';
import { useLearnerSession } from './session-store';
import type { LearnerProfile, LicenseItem } from './types';

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new DtsApiError('Dữ liệu tài khoản DTS không hợp lệ.');
  return value as Record<string, unknown>;
}

function requiredString(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new DtsApiError('Dữ liệu tài khoản DTS chưa đầy đủ.');
  return value;
}

function profileOf(value: unknown): LearnerProfile {
  const data = record(value);
  if (data.selectedLicenseClass !== null && typeof data.selectedLicenseClass !== 'string') {
    throw new DtsApiError('Hồ sơ chưa có thông tin hạng bằng hợp lệ.');
  }
  return {
    id: requiredString(data.id), username: requiredString(data.username),
    fullName: typeof data.fullName === 'string' ? data.fullName : '',
    email: typeof data.email === 'string' ? data.email : '',
    selectedLicenseClass: data.selectedLicenseClass === null ? null : requiredString(data.selectedLicenseClass),
  };
}

function tokensOf(value: unknown) {
  const data = record(value);
  return { accessToken: requiredString(data.accessToken), refreshToken: requiredString(data.refreshToken), user: record(data.user) };
}

export function assertSession(version: number) {
  const current = useLearnerSession.getState();
  if (current.version !== version || !current.session) throw new DtsApiError('Tài khoản hoặc hạng bằng đã thay đổi. Vui lòng tải lại.');
  return current.session;
}

export async function signInLearner(username: string, password: string): Promise<void> {
  const version = useLearnerSession.getState().beginSignIn();
  const auth = tokensOf(await envelopeRequest('/api/v1/auth/login', {
    method: 'POST', body: JSON.stringify({ username: username.trim(), password, deviceInfo: 'DTS Mobile' }),
  }));
  if (useLearnerSession.getState().version !== version) throw new DtsApiError('Yêu cầu đăng nhập đã hết hiệu lực.');
  const profile = profileOf(await envelopeRequest('/api/v1/users/me', {
    headers: { Authorization: `Bearer ${auth.accessToken}` },
  }));
  if (requiredString(auth.user.id) !== profile.id) throw new DtsApiError('Hồ sơ không khớp tài khoản đăng nhập.');
  if (useLearnerSession.getState().version !== version) throw new DtsApiError('Yêu cầu đăng nhập đã hết hiệu lực.');
  useLearnerSession.getState().acceptSignIn(version, { accessToken: auth.accessToken, refreshToken: auth.refreshToken, profile });
}

let refresh: { version: number; promise: Promise<void> } | null = null;
async function refreshSession(version: number): Promise<void> {
  if (refresh?.version === version) return refresh.promise;
  const current = assertSession(version);
  const promise = (async () => {
    try {
      const result = tokensOf(await envelopeRequest('/api/v1/auth/refresh', {
        method: 'POST', body: JSON.stringify({ refreshToken: current.refreshToken }),
      }));
      assertSession(version);
      if (requiredString(result.user.id) !== current.profile.id) throw new DtsApiError('Phiên đăng nhập không khớp tài khoản.', 401);
      useLearnerSession.getState().updateTokens(version, result.accessToken, result.refreshToken);
    } catch (error) {
      if (error instanceof DtsApiError && (error.status === 401 || error.status === 403) && useLearnerSession.getState().version === version) {
        useLearnerSession.getState().clear();
      }
      throw error;
    }
  })();
  refresh = { version, promise };
  try { await promise; }
  finally { if (refresh?.promise === promise) refresh = null; }
}

export async function learnerRequest<T>(path: string, options: RequestInit = {}, format: 'envelope' | 'plain' = 'envelope'): Promise<T> {
  const version = useLearnerSession.getState().version;
  const send = () => envelopeRequest<T>(path, {
    ...options, headers: { ...options.headers, Authorization: `Bearer ${assertSession(version).accessToken}` },
  }, format);
  try {
    let data: T;
    try { data = await send(); }
    catch (error) {
      assertSession(version);
      if (!(error instanceof DtsApiError) || error.status !== 401) throw error;
      await refreshSession(version);
      try { data = await send(); }
      catch (retryError) {
        if (retryError instanceof DtsApiError && retryError.status === 401 && useLearnerSession.getState().version === version) useLearnerSession.getState().clear();
        throw retryError;
      }
    }
    assertSession(version);
    return data;
  } catch (error) {
    if (useLearnerSession.getState().version !== version) throw new DtsApiError('Tài khoản hoặc hạng bằng đã thay đổi. Vui lòng tải lại.');
    throw error;
  }
}

export async function reloadLearnerProfile(): Promise<LearnerProfile> {
  const version = useLearnerSession.getState().version;
  const profile = profileOf(await learnerRequest('/api/v1/users/me'));
  const current = assertSession(version);
  if (profile.id !== current.profile.id) throw new DtsApiError('Hồ sơ không khớp tài khoản.');
  useLearnerSession.getState().acceptProfile(version, profile);
  return profile;
}

export async function getLicenseCatalog(): Promise<LicenseItem[]> {
  const values = await learnerRequest<unknown>('/api/practice/v1/exams/license-catalog');
  if (!Array.isArray(values)) throw new DtsApiError('Không đọc được danh mục hạng bằng.');
  const result = values.map((value) => {
    const item = record(value);
    return { code: requiredString(item.code), title: requiredString(item.title), description: typeof item.description === 'string' ? item.description : '' };
  });
  if (!result.length || new Set(result.map((item) => item.code)).size !== result.length) throw new DtsApiError('Danh mục hạng bằng không hợp lệ.');
  return result;
}

export async function chooseLearnerLicense(code: string): Promise<void> {
  const version = useLearnerSession.getState().version;
  const result = record(await learnerRequest('/api/v1/users/me/license', {
    method: 'PUT', body: JSON.stringify({ licenseClass: code }),
  }));
  const saved = requiredString(result.licenseClass);
  if (saved !== code) throw new DtsApiError('Máy chủ chưa xác nhận hạng bằng đã chọn.');
  const current = assertSession(version);
  useLearnerSession.getState().acceptProfile(version, { ...current.profile, selectedLicenseClass: saved });
}
