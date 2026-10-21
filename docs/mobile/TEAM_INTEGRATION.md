# Bàn giao phối hợp DTS App — task chương, luyện câu, câu sai và lịch sử

## 1. Trạng thái và phạm vi xác nhận

Task đã được người dùng kiểm tra hoạt động trên Expo Go với backend DTS mới. Source được tách thành route mỏng, feature UI/model, API adapter và session/HTTP dùng chung. Đợt dọn cuối giữ nguyên byte của các API service/model nghiệp vụ đã kiểm tra; bỏ phần cũ không còn import và giữ cổng tích hợp session/điều hướng cho app chung. Công cụ thao tác máy cá nhân và giao diện chạy thử không nằm trong source bàn giao.

Đây là xác nhận cho **task này**, không phải xác nhận cả app của ba thành viên đã ghép và chạy xong. Chưa có source task thi thử của thành viên còn lại trên GitHub tại thời điểm rà. Các API đọc của task đã được kiểm tra với backend local. Khi thay môi trường hoặc ghép nhánh, nhóm cần kiểm tra lại với backend đích.

## 2. Source backend chuẩn

| Repo | Nhánh sử dụng | Commit đã bàn giao |
| --- | --- | --- |
| Identity | feature/content-builder-chapter-permissions | e49bba0a66b693d5ee1698457fed27f03019f04a |
| Practice | feature/2026-license-practice-exams | 6373cc8627649ff6bfe0cd2fc5d736f26aaea802 |
| Result | fix/result-persistence-and-kafka-retry | c8286287308fa4e0bb0f0536753be1a2778f62b7 |
| Gateway | chore/backend-service-integration | 0e96e9fba28f305c15f642243cc9607200aa6a32 |
| Media | feature/traffic-sign-media | 496505d8882ef6b1e5426ca91650b00e3e48ddbe |

Các nhánh này là nguồn contract đã sửa cho web; app gọi cùng backend qua Gateway. Việc các repo backend chưa merge main không buộc mobile phải dùng API main cũ. Triển khai backend/migration/dữ liệu cần theo tài liệu bàn giao VPS của hệ thống; task app này không chạy migration hoặc tự seed dữ liệu.

Tiến độ chương đọc trực tiếp **Practice**, theo quyết định của nhóm; không lấy projection Progress hoặc lịch sử local để thay thế. Profile và selectedLicenseClass lấy **Identity**. Lịch sử lấy **Result** và kết quả nguồn lấy **Practice**.

## 3. Đối chiếu repository app trên GitHub

Đọc lại ngày **21/10/2026**:

- main: `5b124619876cee34915c7ec661cae05d333d5c3c`.
- longpt: `5dbe92dd06c2b85ee863a06b44d529456d49ff55`.
- Chưa có nhánh task thi thử hoặc nhánh task này trên remote ở thời điểm kiểm tra.
- Local task đang bắt đầu từ HEAD `52687ccf43eec4a5ce0e715305499ef74dbbd984`, có main ở trên làm tổ tiên trực tiếp; các thay đổi chức năng sau đó đang được chuẩn bị commit theo nhóm.

Nguồn đã đọc: [main](https://github.com/phamthanhlong100504-xpnd/dts-app/tree/5b124619876cee34915c7ec661cae05d333d5c3c), [longpt](https://github.com/phamthanhlong100504-xpnd/dts-app/tree/5dbe92dd06c2b85ee863a06b44d529456d49ff55), [so sánh hai SHA](https://github.com/phamthanhlong100504-xpnd/dts-app/compare/5b124619876cee34915c7ec661cae05d333d5c3c...5dbe92dd06c2b85ee863a06b44d529456d49ff55).

| Điểm trong longpt | Hiện trạng đã đọc | Việc chủ task cần làm |
| --- | --- | --- |
| `(auth)/login.tsx` | Nút đăng nhập chỉ chuyển route sang profile | Gọi đăng nhập thật và xác nhận GET Identity profile trước khi mở màn bảo vệ |
| `(main)/profile.tsx` | Tên/email mẫu | Lấy profile từ session đã được Identity xác nhận |
| `(main)/select-class.tsx` | Catalog hardcode, API bị comment, chỉ setCurrentClass local | Dùng catalog Practice và PUT users/me/license; chỉ đổi state sau ACK Identity |
| `useAppStore.ts` | currentClass mặc định Hạng A1, persist vào AsyncStorage | Không dùng làm nguồn hạng chuẩn; tách preference giao diện khỏi session và business state |
| `_layout.tsx` | `headerShown:false` toàn Stack | Giữ đúng header của các feature học tập, tránh mất tên chương/icon cài đặt hoặc tạo hai header |
| package.json | AsyncStorage `^3.1.1` | Đối chiếu với phiên bản SDK57/Expo Go đang chạy; task hiện dùng 2.2.0. Không lấy lockfile của nhánh kia bằng thao tác chọn toàn bộ |

**Chưa thể ghép mù các nhánh rồi kết luận chạy được.** Những file mới cũng có thể xung đột về URL route, provider/session hoặc dependency dù Git không báo conflict văn bản.

## 4. Ranh giới ba thành viên

| Thành viên/phần việc | Chịu trách nhiệm | Hợp đồng với task học tập |
| --- | --- | --- |
| Auth / home / profile / settings | Giao diện đăng nhập, đăng ký, trang chủ, hồ sơ, điều hướng chung, đăng xuất | Dùng session thật; gọi các entry ở mục 5; cung cấp nút/menu vào các route mục 6 |
| Task của Nga | Danh sách chương, học/ôn theo chương và cả bộ, điểm liệt, tìm câu, câu đã sai, lịch sử và xem bài làm | Không tạo hồ sơ giả, không sở hữu màn home/auth cuối, không ghi tiến độ/lịch sử vào AsyncStorage |
| Thi thử / bộ đề / kết quả | Tạo phiên thi, lưu đáp án, nộp bài, đọc kết quả theo Practice mới | Backend tự phát outbox/Kafka sang Result; không append lịch sử mobile hoặc gọi API internal Result từ app |

## 5. Session và hạng dùng chung

Giữ **một** nguồn session: `src/features/session/session-store.ts`. Zustand ở đây chỉ giữ token/profile server trong bộ nhớ; không persist tiến độ, lịch sử hoặc hạng giả. `version` giúp bỏ phản hồi cũ khi tài khoản/hạng đã đổi. Nếu nhóm chọn một session provider khác sau này, phải thay tập trung và giữ các bất biến này, không duy trì hai store token/license song song.

Các entry hiện có:

| Entry | Hợp đồng |
| --- | --- |
| `signInLearner(username,password)` | POST login, GET users/me bằng token trả về, kiểm tra đúng user rồi mới accept session |
| `reloadLearnerProfile()` | Đọc lại profile, nhận thay đổi hạng từ web; không giữ hạng local cũ |
| `chooseLearnerLicense(code)` | PUT Identity, chỉ adopt khi response xác nhận đúng code |
| `getLicenseCatalog()` | Danh mục hạng từ Practice, không tự tạo mảng mặc định |
| `learnerRequest(path,options,format)` | Bearer, timeout, refresh single-flight, retry có kiểm soát, bỏ phản hồi account cũ |
| `useLearnerSession.getState().clear()` | Bỏ session app và tăng version; không tự thay cho API thu hồi token của task auth |

### Nối màn đăng nhập của thành viên auth

Giữ thiết kế của thành viên auth; thay handler chuyển route giả bằng:

```tsx
import { signInLearner } from '@/features/session/session-service';

async function submitLogin() {
  await signInLearner(username, password);
  // Chỉ điều hướng sau khi Identity profile đã được xác nhận.
  router.replace('/chapters'); // Đổi về home chung khi nhóm đã hoàn thiện home.
}
```

Không tự gọi acceptSignIn bằng một user/hạng dựng local. Nếu tích hợp OAuth/token từ một flow khác, cần một entry xác minh token/profile riêng; chưa được giả định đoạn store hiện tại tự kiểm tra mọi token do caller tự set.

### Nối điều hướng chung khi chưa đăng nhập

`StudyAccess` không còn tự dựng màn đăng nhập tạm trong chế độ bàn giao. Root/shell chung bọc Stack bằng provider:

```tsx
import { router, Stack } from 'expo-router';
import { StudyHostProvider } from '@/features/session/study-host';

return (
  <StudyHostProvider actions={{ openSignIn: () => router.push('/(auth)/login') }}>
    <Stack>{/* routes của nhóm */}</Stack>
  </StudyHostProvider>
);
```

Đường `/(auth)/login` phải tồn tại sau khi ghép nhánh auth. Task chưa tự thêm route đó hoặc tự giả định người dùng đã đăng nhập. Không có provider/session thì màn học chỉ yêu cầu đăng nhập và không gọi API học tập. Trường hợp tài khoản chưa chọn hạng vẫn dùng component LicenseChoices/API Identity thật; không mặc định A1.

## 6. Hợp đồng điều hướng và ID

| Route | Params / ý nghĩa | Chủ sở hữu |
| --- | --- | --- |
| `/chapters` | Danh sách chương, tổng bộ câu hỏi, điểm liệt, tìm kiếm | Task học tập |
| `/practice/[chapterId]` | chapterId 1–6 / all / critical; mode learn/review; licenseClass; questionId tùy chọn | Task học tập |
| `/wrong-questions` | filter all/theory/signs/situations/critical | Task học tập |
| `/wrong-questions/[questionId]` | Integer Practice questionId, filter, licenseClass | Task học tập |
| `/history` | Hai tab RANDOM_EXAM/PRESET_EXAM, phân trang server | Task học tập |
| `/history/[resultId]` | UUID Result resultId; đọc owned detail rồi nguồn Practice | Task học tập |

Nhóm route `(auth)` / `(main)` có thể dùng để thống nhất cây thư mục vì không đổi public URL; khi di chuyển entry file phải sửa đường import tương đối và giữ params như trên. Không chuyển business logic về file route.

Task thi thử **không tạo thêm** `/practice/[examId]` cạnh `/practice/[chapterId]`: hai tên param khác nhau vẫn là một mẫu URL và gây tranh route. Có thể thống nhất `/practice/exam/[examId]` và `/practice/result/[examId]` cho task thi thử; đây là đề xuất cần chủ task đó dùng khi triển khai, chưa phải route đã được code trong nhánh này.

ID không thay thế cho nhau:

- Practice integer questionId dùng để ghi đáp án; số thứ tự/sourceQuestionId chỉ hiển thị.
- reviewSessionId, criticalSessionId, wrongSessionId phải dùng đúng loại API và cùng user/license/bank.
- Result resultId khác Practice sourceId/examId. Không dùng resultId để gọi thẳng source result.
- licenseClass trong URL là ràng buộc scope của màn đang mở, không phải cơ chế thay đổi hạng tài khoản.

## 7. Nguồn dữ liệu và vòng đời màn

- Chương/catalog/answers phải cùng license và bankVersion. Đáp án đúng/sai lấy verdict POST hoặc canonical GET, không so key local để tự chấm.
- Mở lại màn/foreground đọc lại dữ liệu. Đổi account/hạng tăng version và ẩn dữ liệu trước ngay; response cũ không được gán vào UI mới.
- Tìm câu chỉ lập chỉ mục tạm của GET Practice; không tạo bank khác hoặc lưu tiến độ.
- Học/ôn chương dùng hai phạm vi đáp án riêng; ôn không xóa tích lũy. Cả bộ nối các chương với đúng session từng chương.
- Điểm liệt dùng native critical API. Backend có thể có learnedBeforeSession mà không còn verdict; UI không tự tạo số đúng/sai từ flag này.
- Các câu sai đọc native needsReview list, không suy từ lịch sử/đáp án trên điện thoại. Vuốt chỉ đổi câu UI trong tab; không gửi cursor hay grade.
- Bấm đáp án ở câu sai mới gửi native review answer; danh sách chỉ bỏ câu sau khi GET xác nhận. Adapter hiện có có thể hoàn tất vòng ôn cũ và mở lại khi snapshot cũ không chứa câu đang cần trả lời; hành vi này đã có trước dọn code và có thể ảnh hưởng trạng thái vòng ôn của cùng user/hạng đang mở trên web. Không âm thầm đưa một cơ chế session thứ hai vào mobile.
- Lịch sử chỉ có RANDOM_EXAM và PRESET_EXAM, không gồm OFFICIAL_EXAM, học chương hay ôn câu sai. Truy vấn activity/license trước phân trang.
- Xem bài làm dùng dữ liệu gốc Practice. Điểm là correct/total, không lấy phần trăm; màu, ảnh và giải thích cũng theo bài nguồn, không dựng lại từ bank hiện tại.
- Ảnh public Practice đi qua Gateway. URL signed từ Media phải giữ nguyên chữ ký; không thay hostname chuỗi trên app. Backend/MinIO phải trả origin điện thoại truy cập được.

## 8. Quan hệ với task thi thử và Result

Task thi thử ghi đúng Practice session và submit; Practice/outbox/Kafka/Result thực hiện projection phía server. App không cần và không được tự gọi endpoint internal để ép lịch sử xuất hiện. Có thể có độ trễ trước khi kết quả đã công bố hiện trong Result.

Khi nối hai task cần kiểm tra: cùng Identity subject/hạng, activityType đúng RANDOM_EXAM/PRESET_EXAM, ownership, sourceId, result/review policy, tổng câu đúng/sai/chưa làm, title và timestamp. Nếu thiếu history mẫu thì kiểm tra API không được tự tạo bài mới chỉ để vượt điều kiện bàn giao.

## 9. Header, shell và cấu trúc

Các feature tự khai báo headerShown=true cho màn cần tên chương/trang và icon chọn hạng. Khi dùng root headerShown=false của longpt, các màn này vẫn cần header riêng. Nếu chuyển vào nested Stack, để parent group header ẩn và child feature header hiện, tránh hai header cùng lúc.

`src/app/index.tsx` được trả về đúng source main, bỏ liên kết bản thử. Root layout, useAppStore theme và các component template của nhóm được giữ; không xóa đại trà code thuộc phần việc khác.

| Thư mục | Trách nhiệm |
| --- | --- |
| src/app | Entry route mỏng |
| src/features/chapter-learning | Dữ liệu/catalog/model/hook/UI học tập, ảnh câu hỏi |
| src/features/wrong-questions | Native wrong list/review và điều phối màn câu sai |
| src/features/history | Result history + source result Practice |
| src/features/session | Session/API Identity/host integration dùng chung |
| src/lib/api | HTTP Gateway/envelope/plain/error |
| tests | Contract, ownership/scope, request lifecycle và tích hợp host |
| docs/mobile | Bộ hướng dẫn bàn giao cuối |

## 10. Ranh giới source bàn giao

Repo chứa các route, feature UI/model, adapters API, cấu hình chạy app, tests contract có thể chạy ở mọi máy và tài liệu phối hợp nhóm. Không chứa menu/đăng nhập thử độc lập, công cụ thu thập source, backup, báo cáo máy cá nhân, kế hoạch commit/push hoặc đường dẫn audit riêng.

Đăng nhập, home và menu chung thuộc task thành viên phụ trách. Task học tập dùng StudyHostProvider và session đã được Identity xác nhận; không tự gắn trang đăng nhập tạm vào sản phẩm. Khi pull riêng nhánh này trước khi ghép auth/home, route học yêu cầu đăng nhập; đây là ranh giới tích hợp, không phải thiếu dữ liệu được bù bằng mock.

## 11. Các điểm phải review khi merge

1. main/nhánh teammate có thể thay đổi sau ngày kiểm tra; đọc lại trước khi merge.
2. babel/metro/nativewind/tsconfig đã được hai nhánh sửa hoặc thêm riêng. Có thể conflict văn bản do BOM/quotes dù ý nghĩa gần nhau. Giữ cấu hình SDK/NativeWind đã kiểm tra và xác minh sau khi giải quyết; không chọn toàn bộ ours/theirs.
3. package.json/lockfile: reconcile AsyncStorage 2.2.0 so với ^3.1.1 và bộ ESLint hiện có; không nâng SDK hoặc native module chỉ để hết conflict. Chạy npm ci từ lockfile đã thống nhất và kiểm tra Expo compatibility trong nhánh tích hợp.
4. src/app/index.tsx, root layout và useAppStore là phần chung; source task không thay thiết kế auth/home của longpt. Store của longpt phải bỏ vai trò nguồn hạng local; root cần StudyHostProvider và header đúng.
5. Chưa có task thi thử để mô phỏng hợp nhất đầy đủ. Khi có code, kiểm tra route namespace và cùng session trước khi chốt app.
6. Dùng backend các nhánh đã bàn giao; không đổi client về contract main cũ để chữa lỗi merge.

## 12. Kiểm tra khi tích hợp

Chạy TypeScript, ESLint và `npm run test:study`. Tests contract chạy bằng fixture cô lập, không cần tài khoản/DB máy cá nhân, không ghi dữ liệu thật. Kiểm tra thêm API thật và thao tác app trên tài khoản test của môi trường triển khai để xác nhận auth → chọn hạng → học → câu sai → lịch sử/ảnh.

Việc hoàn thiện auth/home/profile của longpt, task thi thử chưa có, thiết kế shell chung và kiểm tra sau merge là công việc tích hợp của nhóm. Không đánh dấu cả app hoàn thành chỉ dựa vào push riêng task này. Không đưa công cụ commit/push của máy cá nhân vào repo để giải quyết tích hợp.
