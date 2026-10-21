import { DtsApiError, gatewayUrl } from '../../lib/api/http';
import { learnerRequest } from '../session/session-service';
import { objectOf, textOf } from './study-contract';
import { assertStudyScope } from './study-service';
import type { StudyQuestion, StudyScope } from './study-types';

export function resolveQuestionImage(value: string): string {
  const raw = value.trim();
  if (!raw || raw.startsWith('//')) throw new DtsApiError('Địa chỉ ảnh không hợp lệ.');
  const url = new URL(raw, gatewayUrl() + '/');
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new DtsApiError('Địa chỉ ảnh không hợp lệ.');
  }
  // Current bank images are served publicly by Practice through Gateway.
  // Rebase this known path only; signed Media/CDN URLs must remain intact.
  if (url.pathname.startsWith('/question-images/')) return gatewayUrl() + url.pathname + url.search;
  if (['localhost', '127.0.0.1', '[::1]', 'minio', 'dts-media'].includes(url.hostname)) {
    throw new DtsApiError('Máy chủ trả địa chỉ ảnh nội bộ mà điện thoại không truy cập được.');
  }
  return url.toString();
}

export async function getQuestionImage(question: StudyQuestion, scope: StudyScope): Promise<string | null> {
  assertStudyScope(scope);
  if (question.imageUrl) return resolveQuestionImage(question.imageUrl);
  if (!question.mediaFileId) return null;
  // Media returns a plain metadata object, unlike the Practice envelope.
  const metadata = objectOf(await learnerRequest<unknown>(
    '/api/v1/media/' + encodeURIComponent(question.mediaFileId), {}, 'plain',
  ));
  assertStudyScope(scope);
  if (metadata.mediaId !== question.mediaFileId || metadata.status !== 'READY' || metadata.mediaType !== 'IMAGE') {
    throw new DtsApiError('Ảnh câu hỏi chưa sẵn sàng.');
  }
  return resolveQuestionImage(textOf(metadata.url));
}
