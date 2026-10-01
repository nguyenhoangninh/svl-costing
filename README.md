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
| STEP 3B | Điều chỉnh WIP trực tiếp | Giai đoạn 2 |
| STEP 4 | Doanh thu, Price Master, 622/627, phân bổ giá thành | Giai đoạn 2 |
| STEP 5 | FG theo lô, FIFO COGS, Rework FIFO, FG History, đóng kỳ | Giai đoạn 3 |

Engine JavaScript được port 1:1 từ VBA (`modSTEP1_3_Core`, `modSTEP2B_5B_FGRework`) và công thức Control Center. Kiểm thử hồi quy trên dữ liệu kỳ 2026-08: **69.871/69.871 giá trị khớp** với file Excel (từng dòng phân bổ, từng lô PC-P, từng vật tư WIP, sổ rework, checkpoint).

## Cách dùng hằng tháng

1. **Tạo kỳ** (nút `+ Kỳ`). Nếu kỳ trước đã chạy STEP 3 trên web, Opening WIP và Rework WIP (B/F) được roll forward tự động.
2. **STEP 1**: kéo thả các file ERP (hoặc chọn cả thư mục). Tên file phải chứa loại báo cáo + hệ + kỳ, ví dụ `PC-M-T-202609.xlsx`, `STOCK OUT-O-2609.xlsx`. File khác kỳ bị chặn.
3. **STEP 2**: bấm *Chạy STEP 2*. Stock Out FG tự tách sang sổ 2B.
4. **2B**: cập nhật Rework Type / Status / Rework PC / Completed Qty… ngay trong bảng.
5. **Opening WIP**: roll forward từ kỳ trước hoặc import file Costing Master tháng trước → *Validate & lưu*.
6. **STEP 3**: bấm *Chạy STEP 3*, xem checkpoint và bảng WIP theo vật tư.
7. Xuất Excel từng bảng hoặc cả kỳ (*Kỳ, cloud & chuyển đổi → Xuất kết quả kỳ ra Excel*) để chạy tiếp STEP 3B–5 trong file Excel ở giai đoạn này.

**Chuyển từ Excel sang web:** *Kỳ, cloud & chuyển đổi → Nạp một kỳ từ file Costing Master (.xlsm)* đọc 21 sheet ERP, WIP_OPENING và sổ rework, chạy lại STEP 2–3A và hiện bảng đối chiếu Web ↔ Excel.

## Thiết lập Firebase (một lần)

Ứng dụng dùng project Firebase riêng **SVL-Costing** (`svl-costing`). Dữ liệu giá thành nằm trong **Firestore** và bắt buộc đăng nhập Google.

1. Firebase Console → **Build → Firestore Database → Create database** (chọn vùng `asia-southeast1`, chế độ production).
2. Firestore → **Rules**: dán nội dung `firestore.rules` → Publish.
3. **Authentication → Sign-in method → Google → Enable**.
4. **Authentication → Settings → Authorized domains → Add domain**: `nguyenhoangninh.github.io`.
5. Trong rules, thay `YOUR_EMAIL@gmail.com` bằng email Google của chủ sở hữu (luôn có quyền Quản trị). Người dùng khác được thêm/xoá ngay trên web: **Kỳ, cloud & chuyển đổi → Người dùng & phân quyền** (Quản trị / Chỉnh sửa / Chỉ xem).

Không đăng nhập (hoặc chưa bật Firestore) thì ứng dụng vẫn chạy đầy đủ, dữ liệu chỉ lưu trong trình duyệt (IndexedDB) của máy đó.

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
test/verify.mjs       kiểm thử hồi quy engine với file Excel
```

Chạy kiểm thử (cần file Costing Master và thư mục file ERP của kỳ):

```
npm install
node test/verify.mjs path/to/SVL_Costing_Master.xlsm path/to/erp-folder
```
