import { DtsApiError } from '../../lib/api/http';
import { learnerRequest } from '../session/session-service';

export class ApiError extends Error {
  constructor(message: string, readonly status?: number, readonly errorCode?: string, readonly traceId?: string) {
    super(message); this.name = 'SimulationApiError';
  }
}
type Options = { params?: Record<string, string | number | boolean | undefined | null>; headers?: Record<string, string> };
export interface ApiClient {
  get<T>(path: string, options?: Options): Promise<T>;
  post<T>(path: string, body: object, options?: Options): Promise<T>;
  put<T>(path: string, body: object, options?: Options): Promise<T>;
}

/** Reuses the app's authenticated, single-flight refresh transport without changing theory HTTP. */
export function createSimulationApi(assertCurrent: () => void): ApiClient {
  async function send<T>(method: string, path: string, body: object | undefined, options: Options = {}): Promise<T> {
    assertCurrent();
    if (!/^\/v1\/(?:simulations|simulation-exams)(?:\/|$)/.test(path)) throw new ApiError('Đường dẫn mô phỏng chưa hợp lệ.');
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(options.params ?? {})) if (value !== undefined && value !== null) query.set(key, String(value));
    const target = '/api/practice' + path + (query.toString() ? '?' + query : '');
    try {
      const value = await learnerRequest<T>(target, {
        method, headers: options.headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      assertCurrent(); return value;
    } catch (error) {
      assertCurrent();
      if (error instanceof DtsApiError) throw new ApiError(error.message, error.status, error.code);
      throw error;
    }
  }
  return {
    get: <T,>(path: string, options?: Options) => send<T>('GET', path, undefined, options),
    post: <T,>(path: string, body: object, options?: Options) => send<T>('POST', path, body, options),
    put: <T,>(path: string, body: object, options?: Options) => send<T>('PUT', path, body, options),
  };
}

export function simulationMessage(error: unknown): string {
  const status = error && typeof error === 'object' && 'status' in error ? error.status : undefined;
  if (status === 401) return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
  if (status === 403) return 'Tài khoản hoặc hạng bằng hiện tại chưa được phép sử dụng nội dung này.';
  if (status === 404) return 'Nội dung hoặc lượt thực hiện này không còn truy cập được. Hãy quay lại danh sách.';
  if (status === 409) return 'Lượt thực hiện đã thay đổi. Hãy tải lại để tiếp tục với kết quả đã lưu.';
  if (status === 503) return 'Nội dung hoặc video đang chưa sẵn sàng. Vui lòng thử lại sau.';
  if (error instanceof SimulationMediaAddressError) return error.message;
  if (typeof error === 'string' && /^(Video cần|Không thể tải phiên thi|Chưa xác nhận được|Không thể tải video xem lại|Bạn đang có bài thi|Bộ đề không còn)/.test(error)) return error;
  return 'Chưa tải hoặc xác nhận được dữ liệu. Kiểm tra kết nối rồi thử lại; kết quả đã lưu vẫn được giữ nguyên.';
}
export class SimulationMediaAddressError extends Error {}
export function requireMobileVideoUrl(value: string, expiresAt?: string): string {
  let url: URL;
  try { url = new URL(value); } catch { throw new SimulationMediaAddressError('Địa chỉ video chưa hợp lệ. Vui lòng tải lại video.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hash) throw new SimulationMediaAddressError('Địa chỉ video chưa hợp lệ. Vui lòng tải lại video.');
  const host = url.hostname.toLowerCase();
  if (['localhost', '127.0.0.1', '0.0.0.0', '[::1]', '::1', '10.0.2.2', 'minio', 'dts-media'].includes(host) || host.endsWith('.localhost')) {
    throw new SimulationMediaAddressError('Máy chủ đang cấp video bằng địa chỉ chỉ dùng trên máy tính. Cần cấu hình địa chỉ phát video mà điện thoại truy cập được.');
  }
  if (expiresAt && (!Number.isFinite(Date.parse(expiresAt)) || Date.parse(expiresAt) <= Date.now() + 1000)) throw new SimulationMediaAddressError('Liên kết video đã hết hạn. Vui lòng tải lại video.');
  // The signature binds the original host/path/query. Never rebase it or attach an Identity token.
  return value;
}
