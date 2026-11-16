# ExamQR

Web thử nghiệm kiểm tra cho khoa Lý luận chính trị.

Giảng viên soạn đề trắc nghiệm, mở phòng và chiếu mã QR lên lớp. Học viên quét mã, nhập số báo danh; màn chiếu hiện ai đã vào, theo dõi tiến độ làm bài trực tiếp (bảng theo dõi 2D, hoặc cảnh 3D "Thắp sáng thành phố bình yên" nếu giảng viên chọn), rồi tổng kết.

Giao diện được thiết kế cho học viên lớp Cao cấp lý luận chính trị: văn phong trang trọng (xưng "đồng chí"), chữ lớn, có nút đổi cỡ chữ trên điện thoại, được chuyển qua lại giữa các câu và sửa đáp án trước khi nộp; màn tổng kết chỉ nêu thống kê chung và danh sách biểu dương, không xếp hạng. Học viên biết điểm ngay trên điện thoại; giảng viên xem báo cáo và xuất Excel.

Hệ thống **chỉ lưu số báo danh và điểm**, không lưu họ tên học viên. Giảng viên tự đối chiếu với danh sách của mình qua file Excel (cột đầu là SBD).

## Công nghệ

Next.js 15 (App Router) · TypeScript · Tailwind CSS 4 · Prisma 6 · Supabase (Postgres, Auth, Realtime Broadcast) · React Three Fiber · Framer Motion · triển khai trên Vercel.

## Cài đặt

### 1. Tạo project Supabase

1. Tạo project mới tại supabase.com, chọn vùng **Southeast Asia (Singapore)**.
2. **Authentication → Sign In / Providers → Email**: tắt *Allow new users to sign up* (tài khoản giảng viên do quản trị tạo).
3. **Project Settings → Database → Connection string**: lấy chuỗi *Transaction pooler* (port 6543) và *Session pooler* hoặc *Direct* (port 5432).
4. **Project Settings → API**: lấy `Project URL`, `anon` key và `service_role` key.

### 2. Cấu hình máy local

```bash
npm install
```

```bash
cp .env.example .env
```

Điền các giá trị vào `.env` (xem chú thích trong file). Ba biến `NEXT_PUBLIC_ORG_NAME`, `NEXT_PUBLIC_ORG_UNIT`, `NEXT_PUBLIC_ORG_LOGO` (không bắt buộc) đặt tên đơn vị, tên khoa và logo hiển thị ở trang chủ, màn chiếu, điện thoại học viên và bản in báo cáo; logo đặt trong thư mục `public/`. Hai chuỗi bí mật tự sinh:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Tạo bảng trong CSDL:

```bash
npm run db:push
```

Tạo tài khoản giảng viên:

```bash
npm run create-teacher -- giaovien@donvi.vn "MatKhauManh123" "Nguyễn Văn A"
```

Chạy thử:

```bash
npm run dev
```

Mở http://localhost:3000/login. Để học viên dùng điện thoại thật trong cùng mạng Wi-Fi, mở bằng địa chỉ IP của máy (ví dụ `http://192.168.1.10:3000`) để mã QR trỏ đúng.

### 3. Triển khai lên Vercel

1. Đẩy mã lên GitHub, vào vercel.com → *Add New Project* → chọn repo.
2. Thêm toàn bộ biến trong `.env.example` vào *Settings → Environment Variables*.
3. Deploy. File `vercel.json` đã khai báo cron gọi `/api/cron/keepalive` mỗi ngày để project Supabase gói miễn phí không bị tạm dừng; Vercel tự gửi `CRON_SECRET` kèm lời gọi.

## Sử dụng

1. **Lớp**: Bảng điều khiển → tab *Lớp* → nhập mã lớp và số báo danh (`001-040`, `A01-A40`, hoặc dán danh sách).
2. **Đề**: *Tạo đề mới* → soạn câu hỏi, đánh dấu đáp án đúng; đề tự lưu. Đề đã dùng cho một buổi sẽ bị khóa, muốn sửa thì *Nhân bản*.
3. **Buổi học**: chọn đề + lớp → *Mở phòng* → bật toàn màn hình trên máy chiếu.
4. Học viên quét QR, nhập SBD. Ô SBD sáng lên trên màn chiếu. Bấm vào ô để *Mời ra* nếu nhập nhầm.
5. Đủ người, nút *Bắt đầu làm bài* chuyển sang nền đỏ. Sau 3 giây đếm ngược, học viên làm bài.
6. Hết giờ hoặc tất cả đã nộp, phòng tự kết thúc; màn chiếu hiện điểm trung bình, tỉ lệ đạt, phổ điểm, danh sách biểu dương (từ 9 điểm, xếp theo SBD) và 3 câu có tỉ lệ đúng thấp nhất để chữa tại lớp.
7. *Xem báo cáo* → *Xuất Excel* hoặc *In báo cáo*.

**Thử máy chiếu trước buổi học:** mở `/demo` (không cần đăng nhập) để xem màn chiếu với lớp ảo, ví dụ `/demo?n=60&q=20`; có nút chuyển *Phòng chờ* / *Bảng theo dõi* / *Cảnh 3D* / *Tổng kết* (hoặc `?view=lobby|2d|3d|summary`). Giao diện điện thoại học viên xem thử tại `/demo/play?view=join|lobby|exam|review|result`. Màn chiếu thật mặc định bảng 2D, nhớ lựa chọn 3D nếu giảng viên bật.

## Quy tắc nghiệp vụ

- Chấm điểm trên server; đáp án đúng không gửi xuống điện thoại khi đang làm bài.
- Màn chiếu chỉ hiện tiến độ, không hiện đúng/sai. Học viên thấy điểm ngay khi nộp, nhưng đáp án chi tiết chỉ hiện sau khi giảng viên kết thúc buổi.
- Học viên được chuyển qua lại giữa các câu, đánh dấu câu cần xem lại và sửa đáp án; đáp án lưu ngay khi chọn. Bấm *Nộp bài* (có bước xác nhận, báo số câu chưa làm) thì chốt điểm. Hết giờ, hệ thống tự chốt theo các đáp án đã lưu.
- Tiến độ trên màn chiếu tính theo số câu đã trả lời; đổi đáp án không làm tăng tiến độ.
- Thứ tự câu và đáp án được đảo riêng cho từng học viên (cố định khi tải lại trang).
- Mỗi SBD chỉ dùng trên một thiết bị. Học viên đổi máy: giảng viên bấm vào thẻ trên bảng 2D → *Cho vào lại*.
- Mất mạng hoặc đóng tab: mở lại đường dẫn trên cùng máy là làm tiếp.
- Vào muộn: mặc định không cho; giảng viên bật *Cho vào muộn* trên màn chiếu (thời gian vẫn tính chung).
- Điểm quy về thang 10, làm tròn 2 chữ số. Ngưỡng đạt: 5 điểm.

## Cấu trúc

```
prisma/schema.prisma          Mô hình dữ liệu
src/app/(teacher)/            Trang giảng viên: dashboard, soạn đề, lớp, báo cáo
src/app/(present)/            Màn chiếu (toàn màn hình)
src/app/j/[code]/             Trang học viên
src/app/demo/                 Thử màn chiếu với lớp ảo
src/app/api/                  Xuất Excel, cron giữ Supabase hoạt động
src/server/                   Server actions: giảng viên, phiên, học viên, chấm điểm
src/components/board/         Phòng chờ, bảng 2D, cảnh 3D, tổng kết
src/components/play/          Giao diện điện thoại
src/lib/                      Prisma, Supabase, realtime, token, đảo câu, chấm điểm
```

## Lệnh

| Lệnh | Việc |
|---|---|
| `npm run dev` | Chạy local |
| `npm run build` | Build production |
| `npm test` | Kiểm thử đơn vị (chấm điểm, đảo câu, nhập SBD) |
| `npm run typecheck` | Kiểm tra kiểu |
| `npm run db:push` | Đồng bộ schema vào CSDL |
| `npm run create-teacher` | Tạo tài khoản giảng viên |

## Giới hạn hiện tại

- Giới hạn tần suất (chống dò SBD) nằm trong bộ nhớ từng instance serverless, không phải giới hạn toàn cục.
- Kênh realtime là kênh công khai: ai biết mã phiên có thể nghe sự kiện tiến độ (chỉ chứa SBD và số câu đã làm). Mọi dữ liệu quan trọng đều đọc lại từ CSDL nên sự kiện giả không làm sai kết quả.
- Chưa có: câu hỏi nhiều đáp án / đúng-sai, nhập đề từ Word/Excel, trang quản trị tài khoản.
