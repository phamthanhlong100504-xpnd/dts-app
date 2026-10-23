import { DtsApiError, envelopeRequest } from '../../lib/api/http';
import { learnerRequest, reloadLearnerProfile, registerLearner } from '../session/session-service';
import { useLearnerSession } from '../session/session-store';
export type Registration = { username: string; email: string; password: string; fullName: string; birthOfDate: string; phoneNumber: string };
export function parseBirthDate(value: string): string {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/u.exec(value.trim());
  if (!match) throw new DtsApiError('Nhập ngày sinh theo dạng dd/mm/yyyy.');
  const [, day, month, year] = match, date = new Date(Number(year), Number(month) - 1, Number(day));
  if (date.getFullYear() !== Number(year) || date.getMonth() !== Number(month) - 1 || date.getDate() !== Number(day) || date >= new Date(new Date().setHours(0, 0, 0, 0))) throw new DtsApiError('Ngày sinh không hợp lệ hoặc chưa ở trong quá khứ.');
  return `${year}-${month}-${day}`;
}
export function assertPassword(value: string) { if (value.length < 8 || value.length > 100 || !value.trim()) throw new DtsApiError('Mật khẩu phải có từ 8 đến 100 ký tự.'); }
export async function registerAccount(value: Registration) {
  const body = { ...value, username: value.username.trim(), email: value.email.trim(), fullName: value.fullName.trim(), phoneNumber: value.phoneNumber.trim() };
  if (body.username.length < 3 || body.username.length > 20 || !body.fullName || body.fullName.length > 100 || !body.phoneNumber || body.phoneNumber.length > 20 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(body.email)) throw new DtsApiError('Kiểm tra tên đăng nhập, email, họ tên và số điện thoại.');
  assertPassword(body.password); await registerLearner(body);
}
export async function requestPasswordReset(identifier: string) {
  if (!identifier.trim()) throw new DtsApiError('Nhập tên đăng nhập hoặc email.');
  await envelopeRequest('/api/v1/auth/forgot-password', { method: 'POST', body: JSON.stringify({ identifier: identifier.trim() }) }, 'ack');
}
export async function resetAccountPassword(identifier: string, code: string, newPassword: string) {
  if (!identifier.trim() || !code.trim()) throw new DtsApiError('Nhập tài khoản và mã xác nhận được gửi qua email.');
  assertPassword(newPassword);
  // reset-password validates and consumes its OTP itself. Never pre-consume it with /verify.
  await envelopeRequest('/api/v1/auth/reset-password', { method: 'POST', body: JSON.stringify({ identifier: identifier.trim(), code: code.trim(), newPassword }) }, 'ack');
}
export async function changeAccountPassword(oldPassword: string, newPassword: string) {
  if (!oldPassword.trim()) throw new DtsApiError('Nhập mật khẩu hiện tại.'); assertPassword(newPassword);
  const version = useLearnerSession.getState().version;
  await learnerRequest('/api/v1/auth/change-password', { method: 'POST', body: JSON.stringify({ oldPassword, newPassword }) }, 'ack');
  // Identity revokes refresh tokens. Do not retain a session that can no longer refresh.
  if (useLearnerSession.getState().version === version) useLearnerSession.getState().clear();
}
export async function logoutAccount(): Promise<boolean> {
  const { session, version } = useLearnerSession.getState(); if (!session) return true;
  let revoked = false;
  try { await envelopeRequest('/api/v1/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${session.accessToken}` } }, 'ack'); revoked = true; }
  catch { /* Local logout still completes; never claim server revocation on network failure. */ }
  finally { if (useLearnerSession.getState().version === version) useLearnerSession.getState().clear(); }
  return revoked;
}
export async function sendRegistrationCode(identifier: string) {
  if (!identifier.trim()) throw new DtsApiError('Hồ sơ chưa có email.');
  await learnerRequest('/api/v1/auth/resend-verification', { method: 'POST', body: JSON.stringify({ identifier: identifier.trim(), type: 'REGISTER' }) }, 'ack');
}
export async function verifyRegistrationCode(identifier: string, code: string) {
  if (!code.trim()) throw new DtsApiError('Nhập mã xác nhận.');
  await learnerRequest('/api/v1/auth/verify', { method: 'POST', body: JSON.stringify({ identifier: identifier.trim(), code: code.trim(), type: 'REGISTER' }) }, 'ack');
  return reloadLearnerProfile();
}
export function signedInDestination() { const session = useLearnerSession.getState().session; return session ? session.profile.selectedLicenseClass ? '/home' : '/settings' : '/login'; }
