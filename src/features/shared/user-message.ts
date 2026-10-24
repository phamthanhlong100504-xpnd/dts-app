export type MessageContext = 'general' | 'login' | 'register' | 'password';

const fallback = 'Chưa thực hiện được yêu cầu. Vui lòng thử lại sau.';

// Presentation only: keep the original error/status/code in the request layer.
export function userMessage(value: unknown, context: MessageContext = 'general'): string {
  const raw = value instanceof Error ? value.message : typeof value === 'string' ? value : '';
  const status = value && typeof value === 'object' && 'status' in value && typeof value.status === 'number'
    ? value.status : Number(raw.match(/\bHTTP\s+(\d{3})\b/iu)?.[1]);
  const message = raw.replace(/\s*\(HTTP\s+\d{3}[^)]*\)/giu, '').trim();

  if (/account (?:is |has been )?(?:locked|disabled|deleted)|tài khoản.*(?:bị khóa|tạm khóa)/iu.test(message)) {
    return 'Tài khoản đang bị khóa hoặc không thể sử dụng. Vui lòng thử lại sau hoặc liên hệ hỗ trợ.';
  }
  if (status === 429 || /too many requests|rate.?limit/iu.test(message)) {
    return 'Bạn thao tác quá nhanh. Vui lòng chờ một lúc rồi thử lại.';
  }
  if (status >= 500) return 'DTS đang tạm gián đoạn. Vui lòng thử lại sau.';
  if (/invalid (?:username or password|credentials)|bad credentials/iu.test(message) || (context === 'login' && status === 401)) {
    return 'Tên đăng nhập hoặc mật khẩu chưa đúng. Vui lòng kiểm tra lại.';
  }
  if (/old password is incorrect|current password.*incorrect/iu.test(message)) return 'Mật khẩu hiện tại chưa đúng. Vui lòng nhập lại.';
  if (/username already (?:taken|exists)/iu.test(message)) return 'Tên đăng nhập này đã được sử dụng. Vui lòng chọn tên khác.';
  if (/email already (?:registered|exists)/iu.test(message)) return 'Email này đã được đăng ký. Bạn có thể đăng nhập hoặc dùng email khác.';
  if (/phone number already (?:registered|exists)/iu.test(message)) return 'Số điện thoại này đã được đăng ký. Vui lòng kiểm tra lại.';
  if (/too many failed attempts.*code/iu.test(message)) return 'Bạn đã nhập sai mã nhiều lần. Vui lòng yêu cầu mã xác nhận mới.';
  if (/(?:verification|reset).*code.*(?:expired|already used)|no (?:verification|reset) code found/iu.test(message)) {
    return 'Mã xác nhận đã hết hạn hoặc không còn hiệu lực. Vui lòng yêu cầu mã mới.';
  }
  if (/invalid (?:verification|reset) code/iu.test(message)) return 'Mã xác nhận chưa đúng. Vui lòng kiểm tra lại mã trong email.';
  if (/invalid.*(?:refresh |access )?token|token.*(?:expired|revoked|not recognized)|authentication required|full authentication|unauthorized/iu.test(message) || status === 401) {
    return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
  }
  if (/access denied|forbidden/iu.test(message) || status === 403) return 'Bạn chưa được phép thực hiện thao tác này.';
  if (/không kết nối|network request failed|failed to fetch|timed? ?out|timeout/iu.test(message)) {
    return 'Chưa kết nối được DTS. Vui lòng kiểm tra mạng rồi thử lại.';
  }
  if (/ảnh.*(?:nội bộ|không hợp lệ|chưa sẵn sàng)|(?:media|minio).*image/iu.test(message)) return 'Chưa tải được ảnh. Vui lòng thử lại.';
  if (/cấu hình|địa chỉ DTS|đường dẫn DTS/iu.test(message)) return 'Ứng dụng chưa kết nối được DTS. Vui lòng liên hệ hỗ trợ.';
  if (/phản hồi.*DTS|dữ liệu.*(?:không hợp lệ|chưa đồng nhất|không đúng định dạng|chưa đầy đủ)/iu.test(message)) {
    return 'Chưa tải được nội dung đầy đủ. Vui lòng tải lại trước khi tiếp tục.';
  }
  if (status === 404) return 'Nội dung này hiện không còn khả dụng. Vui lòng quay lại và tải lại danh sách.';
  if (status === 409) return context === 'register'
    ? 'Thông tin đăng ký đã được sử dụng. Vui lòng kiểm tra lại.'
    : 'Nội dung đã thay đổi. Vui lòng tải lại trước khi tiếp tục.';
  if (/\b(?:username|password|newPassword|oldPassword|fullName|phoneNumber|birthOfDate|email|code)\s*:/u.test(message)) {
    return context === 'password' ? 'Vui lòng kiểm tra mật khẩu và mã xác nhận đã nhập.' : 'Vui lòng kiểm tra lại các thông tin đã nhập.';
  }
  // Do not expose service names, stack traces, identifiers or unknown English errors.
  if (!/[À-ỹĐđ]/u.test(message) || /\b(?:backend|frontend|Identity|Practice|Result|Progress|Gateway|MinIO|Kafka|HTTP|API|JWT|SQL|JSON|UUID|traceId|Exception|undefined|null|NaN|ID)\b|https?:\/\//iu.test(message)) {
    return fallback;
  }
  return message;
}
