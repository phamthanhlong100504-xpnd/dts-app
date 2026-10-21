# API contract đang dùng

Mọi path dưới đây đi qua Gateway `EXPO_PUBLIC_DTS_API_URL`, kèm Bearer của Identity trừ login/refresh. Không hardcode VPS, không chọn userId qua query. Session/hạng phải cùng hồ sơ server, question ID và bank phải cùng snapshot.

## Auth và hạng

| Method | Path | Body / response |
| --- | --- | --- |
| POST | /api/v1/auth/login | username,password,deviceInfo; envelope data accessToken,refreshToken,user |
| POST | /api/v1/auth/refresh | refreshToken; cùng dạng auth |
| GET | /api/v1/users/me | Envelope profile gồm id và selectedLicenseClass (có thể null) |
| PUT | /api/v1/users/me/license | `{licenseClass}`; chỉ adopt khi data.licenseClass khớp |
| GET | /api/practice/v1/exams/license-catalog | Envelope danh mục code/title/description |

Dùng `signInLearner` để login + xác minh profile, `learnerRequest` cho request có scope/refresh; không đọc token từ store cũ. Token/profile chỉ giữ trong phiên bộ nhớ hiện tại.

## Danh mục, tìm kiếm và học chương

Các GET theo hạng có query `?licenseClass=...`.

| Method | Path | Hợp đồng |
| --- | --- | --- |
| GET | /api/practice/v1/questions/learning-catalog | Hạng, bankVersion, tổng và chương có câu áp dụng |
| GET | /api/practice/v1/learning/chapters | Progress/cursor của các chương, gồm cả chương rỗng |
| GET | /api/practice/v1/questions/chapter/{chapterId} | Câu/choices/key/ảnh/giải thích; Practice integer id |
| GET | /api/practice/v1/learning/chapters/{chapterId}/answers | Đáp án tích lũy và verdict đã lưu |
| POST | /api/practice/v1/learning/chapters/{chapterId}/answers | `{licenseClass,questionId,selectedAnswer}`; verdict authoritative |
| PUT | /api/practice/v1/learning/chapters/{chapterId}/cursor | `{licenseClass,questionId}`; xác minh resumeQuestionId/lastQuestionId |
| POST | /api/practice/v1/learning/chapters/{chapterId}/review-sessions | `{licenseClass}`; mở/nhận phiên ôn |
| GET | /api/practice/v1/learning/chapters/{chapterId}/review-sessions/{reviewSessionId} | Snapshot và đáp án đúng phiên |
| POST | /api/practice/v1/learning/chapters/{chapterId}/review-sessions/{reviewSessionId}/answers | `{questionId,selectedAnswer}`; snapshot phiên mới |
| PUT | /api/practice/v1/learning/chapters/{chapterId}/review-sessions/{reviewSessionId}/cursor | `{currentQuestionId}` — khác body cursor học chương |
| POST | /api/practice/v1/learning/chapters/{chapterId}/review-sessions/{reviewSessionId}/finish | Hoàn thành phiên; không tạo bài thi Result |

Tất cả response trong nhóm này là envelope. `chapterId` 1–6; all là tổ hợp app dùng cùng API từng chương, không phải endpoint mới.

## Câu điểm liệt

| Method | Path | Hợp đồng |
| --- | --- | --- |
| GET | /api/practice/v1/questions/critical?licenseClass=... | Danh sách native critical |
| GET | /api/practice/v1/questions/critical/overview?licenseClass=... | Đã học/tổng/còn; không suy đúng/sai từ learned flag |
| POST | /api/practice/v1/questions/critical/sessions | `{licenseClass,mode:'CONTINUE' hoặc 'REVIEW',restart:false}` |
| GET | /api/practice/v1/questions/critical/sessions/{sessionId} | Session snapshot, learnedBeforeSession, answers |
| POST | /api/practice/v1/questions/critical/answers | `{licenseClass,sessionId,questionId,selectedAnswer}` |
| PUT | /api/practice/v1/questions/critical/sessions/{sessionId}/cursor | `{questionId}` |

Đều envelope. Không thay critical answer bằng learning/chapter answer.

## Câu sai

| Method | Path | Hợp đồng |
| --- | --- | --- |
| GET | /api/practice/v1/questions/wrong/overview?licenseClass=... | totalWrongQuestions / hasWrongQuestions |
| GET | /api/practice/v1/questions/wrong?licenseClass=... | Danh sách hiện cần ôn; sourceQuestionId chỉ hiển thị |
| POST | /api/practice/v1/wrong-questions/sessions | `{licenseClass}`; prepare sau thao tác trả lời rõ ràng |
| GET | /api/practice/v1/wrong-questions/sessions/{sessionId} | Canonical answers và snapshot vòng ôn |
| POST | /api/practice/v1/wrong-questions/sessions/{sessionId}/answers | `{questionId,selectedAnswer}` |
| POST | /api/practice/v1/wrong-questions/sessions/{sessionId}/finish | Adapter có thể hoàn tất vòng cũ thiếu câu trước khi chuẩn bị vòng mới |

Đều envelope. API cursor native còn có trong adapter cũ nhưng màn đọc câu sai hiện tại không gọi khi vuốt/Bỏ qua. Việc loại câu khỏi needsReview chỉ xác nhận sau GET, không tự chấm trên app.

## Lịch sử và bài làm nguồn

| Method | Path | Response |
| --- | --- | --- |
| GET | /api/result/v1/results/me/history | **Plain Spring Page**, không bọc data |
| GET | /api/result/v1/results/me/history/{resultId} | **Plain JSON owned detail** |
| GET | /api/practice/v1/exams/{sourceId}/result | Envelope kết quả gốc |

List query dùng `targetType=EXAM`, `activityType=RANDOM_EXAM` hoặc `PRESET_EXAM`, licenseClass, page, size=15, sort=completedAt,desc. Màn hiện đặt outcome/time ALL; service vẫn có khả năng lọc nhưng không còn sáu tab phụ. Các truy vấn size1 phục vụ thống kê dùng cùng scope.

Cấm OFFICIAL_EXAM trong list/detail/review mobile. Chỉ ánh xạ nguồn PRACTICE_SESSION, UUID khớp và pathname `/practice/result/{sourceId}` hợp lệ. `reviewAvailable=false` không gọi source; null có thể để Practice quyết định quyền. Không fetch một URL arbitrary từ response. Không gọi internal Result từ client.

Kết quả nguồn kiểm tra tổng câu và `correctCount + answeredWrongCount + unansweredCount`, đồng thời `wrongCount=answeredWrongCount+unansweredCount`. Không dùng score để suy ra số đúng. Các số legacy thiếu để dấu gạch, không biến thành 0.

## Ảnh

`/question-images/...` được đọc public qua Gateway, không gắn JWT vào query. Nếu chỉ có mediaFileId, GET `/api/v1/media/{id}` bằng auth/refresh chung, response **plain metadata** (mediaId/status READY/mediaType IMAGE/url). Sau đó tải signed URL không kèm header credentials. Giữ nguyên chữ ký URL; backend phải trả origin truy cập được từ điện thoại, không dùng localhost của máy tính trên iPhone.

## Kiểm tra và retry

Các adapter hiện có kiểm tra shape, ID duy nhất, ownership/scope, bank, số lượng, session và phản hồi đã lưu. Không biến malformed/HTTP error thành dữ liệu giả. Refresh đồng thời dùng một promise; response account cũ bị loại. Mất ACK sau business POST không tự replay, phải đọc lại canonical trước lần ghi kế tiếp.
