export class DtsApiError extends Error {
  constructor(message: string, readonly status?: number, readonly code?: string) {
    super(message);
    this.name = 'DtsApiError';
  }
}

export function gatewayUrl(): string {
  const configured = process.env.EXPO_PUBLIC_DTS_API_URL?.trim();
  if (!configured || !/^https?:\/\/[^/\s]+\/?$/.test(configured)) {
    throw new DtsApiError('Chưa cấu hình địa chỉ kết nối DTS hợp lệ.');
  }
  const url = new URL(configured);
  if (url.username || url.password || url.search || url.hash) {
    throw new DtsApiError('Địa chỉ DTS không được chứa tài khoản hoặc tham số.');
  }
  return configured.replace(/\/$/, '');
}

export async function envelopeRequest<T>(path: string, options: RequestInit = {}, format: 'envelope' | 'plain' = 'envelope'): Promise<T> {
  if (!path.startsWith('/api/')) throw new DtsApiError('Đường dẫn DTS không hợp lệ.');
  const base = gatewayUrl();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(base + path, {
      ...options,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...options.headers },
    });
    const trace = response.headers.get('X-Trace-Id') || response.headers.get('X-Request-ID');
    const raw = await response.text();
    let body: { success?: boolean; data?: T; message?: string; errorCode?: string; traceId?: string };
    try { body = JSON.parse(raw); }
    catch { throw new DtsApiError(`Không đọc được phản hồi DTS (HTTP ${response.status}${trace ? ` · ${trace}` : ''}).`, response.status); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new DtsApiError('Phản hồi DTS không đúng định dạng.', response.status);
    }
    if (!response.ok || body.success === false) {
      const id = body.traceId || trace;
      throw new DtsApiError(`${body.message || 'Không thực hiện được yêu cầu.'} (HTTP ${response.status}${id ? ` · ${id}` : ''})`, response.status, body.errorCode);
    }
    if (format === 'plain') return body as T;
    if (!Object.prototype.hasOwnProperty.call(body, 'data')) throw new DtsApiError('Phản hồi DTS thiếu dữ liệu.', response.status);
    return body.data as T;
  } catch (error) {
    if (error instanceof DtsApiError) throw error;
    throw new DtsApiError('Không kết nối được DTS. Kiểm tra Wi-Fi và địa chỉ máy chủ.');
  } finally {
    clearTimeout(timeout);
  }
}
