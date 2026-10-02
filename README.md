# SVL Costing Web

Bản web của **SVL Costing Master (Excel/VBA v30.9)**: tính giá thành sản xuất tháng ngay trong trình duyệt và lưu theo kỳ lên Firebase.

Ứng dụng mở tại: `https://nguyenhoangninh.github.io/svl-costing/`

## Phạm vi giai đoạn 1

| Bước | Nội dung | Trạng thái |
|---|---|---|
| STEP 1 | Import 21 báo cáo ERP (PC-P, PC-M, MI-P, MI-M, STOCK OUT, MR-P, MR-M × T/S/O) | Có trên web |
| STEP 2 | Phân bổ Stock Out NVL vào lô PC-P (quy tắc T/O/S) | Có trên web |
| STEP 2B | Sổ FG Stock Out / Rework (giữ dữ liệu nhập tay, B/F kỳ trước) | Có trên web |
| STEP 3A | Opening WIP (import / roll forward / validate) + Material WIP | Có trên web |
| STEP 3B | Điều chỉnh WIP trực tiếp (ERP map, INPUT, BUILD, duyệt, APPLY, sổ 632) | Có trên web |
| STEP 4 | Doanh thu, Price Master, FX/GL 622-627, phân bổ giá thành, đối chiếu, kiểm tra đơn giá lô | Có trên web |
| STEP 5 | FG đầu kỳ theo lô, FIFO giá vốn, FIFO rework (5B), nhập–xuất–tồn, FG History, đóng kỳ, roll forward | Có trên web |

Engine JavaScript được port 1:1 từ VBA (`modSTEP1_3_Core`, `modSTEP2B_5B_FGRework`) và công thức Control Center. Kiểm thử hồi quy trên dữ liệu kỳ 2026-08: **69.871/69.871 giá trị khớp** cho STEP 1–3A, **223.899/223.899** cho STEP 3B–4 và **99.522/99.522** cho STEP 5 (từng dòng phân bổ, từng lô PC-P, từng vật tư WIP, sổ rework, Price Master, giá thành 380 lô, checkpoint).

## Cách dùng hằng tháng

1. **Tạo kỳ** (nút `+ Kỳ`). Nếu kỳ trước đã chạy STEP 3 trên web, Opening WIP và Rework WIP (B/F) được roll forward tự động.
2. **STEP 1**: kéo thả các file ERP (hoặc chọn cả thư mục). Tên file phải chứa loại báo cáo + hệ + kỳ, ví dụ `PC-M-T-202609.xlsx`, `STOCK OUT-O-2609.xlsx`. File khác kỳ bị chặn.
3. **STEP 2**: bấm *Chạy STEP 2*. Stock Out FG tự tách sang sổ 2B.
4. **2B**: cập nhật Rework Type / Status / Rework PC / Completed Qty… ngay trong bảng.
5. **Opening WIP**: roll forward từ kỳ trước hoặc import file Costing Master tháng trước → *Validate & lưu*.
6. **STEP 3**: bấm *Chạy STEP 3*, xem checkpoint và bảng WIP theo vật tư.
7. **STEP 3B**: *Đồng bộ INPUT* → *1 · BUILD / REFRESH* → tab CONTROL chọn APPROVE / HOLD cho từng vật tư → *2 · APPLY & SYNC* (không APPROVE dòng nào thì nhập lý do để đóng không điều chỉnh).
8. **4.1 Doanh thu & giá**: import file doanh thu (YTD / MONTHLY) → *Validate & Save* → tab Price Master → *Update Price Master*. Giá thủ công và danh sách SO dự phòng được giữ qua các kỳ.
9. **4.2 FX / GL**: nhập tỷ giá, GL 622, GL 627 của kỳ và các khoản phân bổ trực tiếp (nếu có).
10. **4.3 Phân bổ giá thành**: *Chạy STEP 4* → xem giá thành theo lô, đối chiếu, kiểm tra đơn giá lô.
11. **5.1 FG đầu kỳ**: roll forward từ FG cuối kỳ trước (kỳ trước phải đã đóng) hoặc import template → *Validate*.
12. **5.2 FIFO giá vốn**: *RUN FIFO COGS* (tự chạy luôn FIFO rework nếu sổ 2B có dòng). Nếu báo rework hoàn thành làm đổi giá thành STEP 4, chạy lại một lần nữa.
13. **5.3 FG History & đóng kỳ**: *BUILD FG HISTORY* → *CLOSE MONTH*. Sau đó tạo kỳ mới: FG đầu kỳ, Opening WIP, Rework WIP B/F, FG History, Sales DB, giá… được mang sang tự động.
14. Xuất Excel từng bảng hoặc cả kỳ khi cần lưu trữ.

**Chuyển từ Excel sang web:** *Kỳ, cloud & chuyển đổi → Nạp một kỳ từ file Costing Master (.xlsm)* đọc 21 sheet ERP, WIP_OPENING, sổ rework, các sheet STEP 3B / 4 / 5 (ERP map, quyết định duyệt, doanh thu, giá, GL, FG đầu kỳ, override, FG History), chạy lại STEP 2–5 và hiện bảng đối chiếu Web ↔ Excel.

## Thiết lập Firebase (một lần)

Ứng dụng dùng project Firebase riêng **SVL-Costing** (`svl-costing`). Dữ liệu giá thành nằm trong **Firestore** và bắt buộc đăng nhập Google.

1. Firebase Console → **Build → Firestore Database → Create database** (chọn vùng `asia-southeast1`, chế độ production).
2. Firestore → **Rules**: dán nội dung `firestore.rules` → Publish (dán lại mỗi khi file này thay đổi).
3. **Authentication → Sign-in method → Google → Enable**.
4. **Authentication → Settings → Authorized domains → Add domain**: `nguyenhoangninh.github.io`.
5. Trong rules, thay `YOUR_EMAIL@gmail.com` bằng email Google của chủ sở hữu (luôn có quyền Quản trị). Người dùng khác được thêm/xoá ngay trên web: **Kỳ, cloud & chuyển đổi → Người dùng & phân quyền** (Quản trị / Chỉnh sửa / Chỉ xem).

Khi đã cấu hình Firebase, **phải đăng nhập** mới xem / sửa được dữ liệu. Muốn thử nghiệm không ảnh hưởng dữ liệu thật, mở `…/svl-costing/?sandbox=1`: dùng một cơ sở dữ liệu riêng trên máy, không đồng bộ cloud.

## Cài như ứng dụng trên iPhone / Android

SVL Costing là ứng dụng web cài được (PWA): có biểu tượng trên màn hình chính, mở toàn màn hình, xem được dữ liệu đã lưu khi mất mạng và tự cập nhật.

- **iPhone / iPad:** mở https://nguyenhoangninh.github.io/svl-costing/ bằng **Safari** → nút **Chia sẻ** → **Thêm vào MH chính** → **Thêm**.
- **Android:** mở bằng **Chrome** → menu **⋮** → **Cài đặt ứng dụng** (hoặc *Thêm vào màn hình chính*). Màn hình *Kỳ, cloud & chuyển đổi* có nút **Cài ứng dụng** khi trình duyệt hỗ trợ.
- **Máy tính:** biểu tượng cài đặt trên thanh địa chỉ Chrome / Edge.

Khi có phiên bản mới, ứng dụng hiện thanh **Cập nhật**. Khi mất mạng: xem được dữ liệu trên máy (chỉ xem); đăng nhập và đồng bộ cloud cần có mạng.

## Kiểm soát (theo audit 01/10/2026)

| Kiểm soát | Cách hoạt động |
|---|---|
| Chuỗi freshness (F-01) | STEP 4 OUTDATED khi STEP 2/3A cần chạy lại, input 3B đổi sau BUILD, Price Master chưa CURRENT hoặc FX/GL/phân bổ trực tiếp đổi. STEP 5 OUTDATED khi STEP 4 không CURRENT/PASS → không build history, không đóng kỳ. |
| Khoá kỳ (F-02) | Kỳ đã đóng: mọi ô nhập, nút chạy, import đều bị khoá, kể cả ở tầng lưu dữ liệu. Chỉ Quản trị mở lại kỳ (bắt buộc ghi lý do). |
| Dòng doanh thu lặp (F-03) | Dòng giống hệt nhau trong kỳ phải được xác nhận *Dòng thật* / *Trùng – loại* ở 4.1 → Nghi trùng trước khi đóng kỳ. |
| Duyệt 3B (F-04) | BUILD lưu dấu vân tay INPUT + ERP map; đổi basis / phương án / override sau BUILD thì APPLY và STEP 4 bị chặn đến khi BUILD lại. |
| Thay Sales DB (F-05) | MONTHLY thay cả tháng; YTD thay từ 01/01 đến hết kỳ giá thành. Có hộp xác nhận số dòng thay / thêm. |
| Quyền (F-07, F-08) | Chưa đăng nhập: không thấy dữ liệu. Chỉ Quản trị xoá kỳ (rules + giao diện). |
| Đồng bộ cloud (F-09, F-10, F-13) | Lưu cloud có số bản (rev) và chỉ ghi khi cloud chưa bị người khác cập nhật; ghi khối mới trước rồi mới chuyển danh mục → mất mạng giữa chừng không làm hỏng bản cloud. Chỉ báo "đã lưu" khi cloud xác nhận. |
| Nhật ký bất biến (F-14) | Mỗi thao tác ghi thêm vào `svl_costing_audit` (không ai sửa / xoá được); xem ở *Nhật ký → Xem nhật ký cloud*. |
| Máy dùng chung (F-15) | Khi đăng xuất được hỏi có xoá dữ liệu trên máy không; có nút *Xoá dữ liệu trên máy này*. |
| Nhập số (F-16) | Ô số chấp nhận 26300, 1,5, 15.506.701.812, 1,234.56…; số mơ hồ như 26.300 bị hỏi lại. |
| CI (F-12) | GitHub Actions kiểm tra cú pháp + bộ test kiểm soát tổng hợp (`test/unit.mjs`) mỗi lần đẩy code. Test đối chiếu Excel (`npm run test:golden`) chạy với dữ liệu thật ngoài repo. |

### Bổ sung theo audit 02/10/2026 (nhóm A – không đổi số giá thành)

| Kiểm soát | Cách hoạt động |
|---|---|
| Freshness theo phân bổ (F-02, F-03) | STEP 4 OUTDATED khi một dòng 622/627 trực tiếp đổi PC/sản phẩm dù tổng không đổi. STEP 5 OUTDATED khi giá thành từng lô ở STEP 4 đổi (3B / rework chuyển giữa các lô) hoặc khi sửa lựa chọn xử lý FIFO (override). |
| Chuyển kỳ (F-06) | Opening WIP / Rework B/F chỉ tự chuyển từ kỳ đã ĐÓNG (Rework lấy từ số lưu trữ lúc đóng kỳ). Kỳ trước chưa đóng: phải nhập lý do. Số đã chuyển lưu dấu nguồn; kỳ trước đổi sau đó → Control Center báo và chặn đóng kỳ đến khi roll forward lại. |
| Dòng bán thiếu ngày (F-05, F-23) | Dòng thiếu / sai ngày hoá đơn chặn đóng kỳ (không còn bị bỏ qua lặng lẽ) và không tích luỹ qua các lần lưu. Dòng FIFO có cảnh báo kiểm tra dữ liệu bán được đếm (REVIEW). |
| Đóng kỳ (F-16, F-25) | Chỉ Quản trị được CLOSE MONTH. Khi dùng cloud, kỳ chỉ ĐÓNG sau khi cloud xác nhận; lỗi mạng → không đóng. Firestore rules: kỳ đã đóng chỉ Quản trị ghi được, chỉ Quản trị đóng / mở kỳ. **Cần dán lại `firestore.rules`.** |
| Nhật ký cloud (F-26) | Tải đủ mọi sự kiện của kỳ theo trang, sắp theo giờ server. |
| Cầu nối 154 (F-17) | STEP 5 checkpoint 15a = công thức F200 của Excel (WIP đầu kỳ + B/F + MI + Stock Out + 622 + 627 + FG đi rework − MR − nhập kho − WIP cuối − rework WIP cuối). |
| Cảnh báo REVIEW (F-10…F-24) | Dòng ERP ngày ngoài kỳ, file không có kỳ trong tên, file NO DATA có số liệu (bị từ chối), Stock Out phân bổ dự phòng rộng > 5%, vật tư đổi hệ ERP, giá từ SO sau kỳ, giá thủ công trùng thời gian, lớp không ngày ở STRICT_DATE, ghi chú hệ S (MI-M-S / PC-M-S). |

## Bảo mật dữ liệu

- Repo này chỉ chứa **code**. Không commit file ERP, file Costing Master hay dữ liệu xuất ra (`.gitignore` đã chặn `*.xlsx`, `*.xlsm`, `*.xls`).
- File ERP được đọc ngay trong trình duyệt; dữ liệu lên cloud được nén gzip, chia khối ≤700 KB trong `svl_costing_periods/{kỳ}/chunks`.
- API key Firebase trong `src/config.js` là định danh công khai, không phải mật khẩu; quyền truy cập do Firestore rules quyết định.

## Cấu trúc

```
index.html            giao diện + CSS
src/app.js            trạng thái, các màn hình, thao tác
src/engine/           engine tính toán (thuần JS, chạy được cả Node)
  util.js             HeaderCol/LastDataRow/SafeCellText… (bản port VBA)
  step1.js            nhận diện file, dò dòng tiêu đề, checklist 21 báo cáo
  step2.js            phân bổ Stock Out, tách FG, sổ Rework 2B
  step3.js            Opening WIP, Material WIP
  controls.js         checkpoint Control Center
src/store.js          IndexedDB + Firestore (nén, chia khối)
src/worker.js         đọc Excel trong Web Worker
lib/                  SheetJS 0.18.5 (Apache-2.0)
test/verify.mjs       kiểm thử hồi quy engine với file Excel (verify2: STEP 3B–4, verify5: STEP 5)
```

Chạy kiểm thử (cần file Costing Master và thư mục file ERP của kỳ):

```
npm install
node test/verify.mjs path/to/SVL_Costing_Master.xlsm path/to/erp-folder
```
