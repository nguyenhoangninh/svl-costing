# SVL Costing Web

> **v1.14.1 (06/10/2026):** 5B · tab "ERP vs FIFO" so giá ERP Stock Out (chỉ NVL) với phần NVL của lô FIFO và với giá thành đầy đủ; dòng ERP cao hơn cả giá thành đầy đủ được đánh dấu BẤT THƯỜNG (lỗi giá xuất kho trên ERP).

> **v1.14.0 (06/10/2026) – 5B · Xử lý Rework (luồng riêng):** FG xuất rework rời kho 155 theo giá FIFO của lô vào WIP rework 154; khi còn treo (OPEN / HOLD) không vào giá thành hay giá vốn, chỉ chuyển kỳ. Mỗi dòng có hướng xử lý riêng: **Hoàn thành** → vào lô mới (STEP 4.3; hàng hỏng chọn tính vào lô mới hoặc ra chi phí), **Trả về kho** nguyên trạng → tạo lại lô FG theo giá gốc (Nợ 155 / Có 154), **Ra chi phí** (hủy / không sửa được) → TK 632 hoặc 811 (Nợ 632/811 / Có 154). Bắt buộc ghi lý do; đổi xử lý làm STEP 5 cần chạy lại. Màn hình có tuổi treo + cảnh báo quá N tháng, luân chuyển 154 + bút toán đề xuất, và so sánh ERP vs FIFO (giá trị ERP trên phiếu Stock Out chỉ là memo). Cầu nối 154 / 155 / 632 và Batch 8 tính cả các hướng xử lý mới.

> **v1.13.0 (06/10/2026) – FIFO tách theo hoá đơn & phân bổ giá vốn theo lô:**
> - **Bước 1:** lô thành phẩm sau cost allocation vào bảng 4.4; mỗi lô ghi rõ đã xuất cho hoá đơn nào, tháng nào (SL, giá vốn), xuất rework bao nhiêu và còn lại bao nhiêu – cộng dồn qua các tháng và roll sang kỳ sau. Tab mới "Phân bổ giá vốn theo hoá đơn"; bấm vào một lô để xem chi tiết. File đầu kỳ có thêm cột tuỳ chọn SL / giá vốn đã xuất trước kỳ.
> - **Bước 2:** FIFO MONTHLY nay tách theo hoá đơn: từng dòng hoá đơn trong tháng (theo ngày) lấy lô cũ nhất còn tồn, tự tách dòng khi lấy nhiều lô và gắn tháng / hoá đơn / khách / lô. Tổng giá vốn tháng và FG cuối kỳ giữ đúng như workbook (đã kiểm trên số liệu tháng 8); chỉ giá vốn từng hoá đơn thay đổi (theo lô thực tế thay vì bình quân). STRICT_DATE vẫn như trước. Tab FIFO detail hiện ngày HĐ, số HĐ, khách, kỳ nhập lô.

> **v1.12.0 (06/10/2026) – STEP 4.4 Thành phẩm sản xuất lũy kế:** bảng tổng hợp thành phẩm nhập kho từ đầu năm đến kỳ hiện tại (theo sản phẩm, theo tháng, chi tiết lô). Kỳ này tự lấy từ STEP 4.3 sau phân bổ giá thành (sau RUN STEP 4 / RUN FIFO / CLOSE MONTH, hoặc bấm "Cập nhật từ STEP 4.3"). Các tháng trước: **Roll forward** từ kỳ trước (tự động khi tạo kỳ mới sau khi kỳ trước đã đóng; tháng 1 bắt đầu năm mới) hoặc **Upload file đầu kỳ** theo template (Kỳ, Product Code, Complete Qty, Tổng giá thành hoặc RM / 622 / 627). "Tải file đầu kỳ cho kỳ sau" xuất toàn bộ lũy kế đến kỳ này đúng định dạng upload.

> **v1.11.0 (06/10/2026) – tách Doanh thu và Hàng bán bị trả lại:**
> - **File & dữ liệu riêng:** 4.1 chỉ nhận doanh thu bán hàng (TK 511); hàng bán bị trả lại (SALES RETURN → TK 5212) và giảm giá / credit note (CREDIT NOTE → TK 5213) import, Validate & Save ở **màn hình 5R** vào Returns Database riêng. Dùng chung được một file ERP: mỗi màn hình bỏ qua (SKIPPED) dòng không thuộc sổ của mình. Dữ liệu cũ (trả lại nằm trong Sales DB) vẫn được đọc và tự chuyển sang 5R ở lần lưu tiếp theo.
> - **Chạy riêng:** STEP 5.2 RUN FIFO chỉ tính giá vốn bán hàng; **RUN STEP 5R** chạy riêng sau đó (nhập lại kho theo giá vốn hoá đơn gốc, giảm 632). Đổi dữ liệu trả lại / cách xử lý chỉ làm STEP 5R cần chạy lại, không đụng Price Master / STEP 4 / 5.2. BUILD FG HISTORY và CLOSE MONTH chờ STEP 5R xong.
> - **Báo cáo & FAST:** đối chiếu riêng 511 (doanh thu gộp), 5212, 5213; 632 hiển thị giá vốn bán ra, giảm giá vốn hàng trả lại và giá vốn thuần. Price Master tính giá bán chỉ từ doanh thu bán hàng.

> **v1.10.2 (06/10/2026) – sửa sau rà soát toàn bộ:**
> - **Doanh thu:** dòng không có số lượng (điều chỉnh / phí / ghi nhớ ERP–FAST) không còn chặn lưu Sales DB: NO COGS + REVIEW. Bill Date sang kỳ sau chỉ cảnh báo, giá vốn tính ở kỳ của Bill Date.
> - **Duyệt (quyết định #8):** người có quyền chỉnh sửa duyệt được giá thủ công, Direct 622/627, fallback STEP 2, chênh lệch FAST, quyết định NRV – kể cả mục do chính mình lập (vẫn bắt ghi lý do + nhật ký). CLOSE / REOPEN vẫn chỉ Quản trị.
> - **STEP 5R hàng trả lại:** chạy cả MONTHLY lẫn STRICT_DATE; không có số hoá đơn gốc → tự khớp hoá đơn gần nhất cùng khách – sản phẩm (REVIEW); bảng **Xử lý dòng trả lại** cho chọn hoá đơn gốc hoặc nhập đơn giá vốn tay (hàng bán trước thời kỳ web); giảm trừ chỉ có tiền không tạo hàng nhập lại.
> - **Số liệu:** 511 loại dòng trùng đã EXCLUDE; NRV tính lại sau rework; dự phòng NRV đã ghi được chuyển vào FG đầu kỳ sau (không đề xuất lặp); FG đầu kỳ "VALIDATED WITH REVIEW" không chặn đóng kỳ; STRICT_DATE với lô thiếu ngày → REVIEW thay vì dừng.
> - **Cloud:** đẩy dữ liệu tuần tự; MỞ LẠI KỲ chỉ gửi phần rules cho phép; kỳ đã đóng không đẩy thay đổi; mất mạng khi đọc quyền không đăng xuất (chỉ xem).
> - **Bảo mật:** `firestore.rules` trong repo trở lại placeholder `YOUR_EMAIL@gmail.com` (repo công khai) – điền email khi dán vào Firebase console.

> **v1.10.1 Cloud + STEP 5R UI hotfix (02/10/2026):** sửa Firestore contract cho **CLOSE / REOPEN**: OPEN→CLOSED và CLOSED→OPEN là transition rõ ràng; REOPEN được phép cập nhật live `summary.step5` cùng `closed/everClosed` nhưng vẫn chỉ thay đổi blob `closed` trong accounting manifest. Thêm preflight/diagnostic khi cloud và local lệch trạng thái hoặc Rules/role Admin chưa đúng. **STEP 5R Sales Return** nay là một bước riêng trên sidebar và Control Center với màn hình Return Register độc lập; engine vẫn chạy chung chronological FIFO với STEP 5.2 để giữ đúng COGS/layer. Màn hình đăng nhập được thiết kế lại riêng cho iPhone/iPad/tablet, bỏ rail/kỳ báo cáo trước khi login và dùng card đăng nhập responsive.

> **v1.10.0 STEP 5R & Close Integrity (02/10/2026):** tách Sales Return thành module/function độc lập **STEP 5R** với Return Register, strict original-invoice matching, cumulative return cap, original COGS reversal và Returned FG Layer; Return History và Close reconciliation dùng cùng một contract. Mọi FG Rework Active bắt buộc STRICT_DATE; Production layer thiếu completion date bị chặn trong STRICT_DATE; Sales MONTHLY/YTD bị hard-block nếu sai phạm vi recognition period; STEP 4/5 dùng chung canonical Bill/B.L. Recognition Date. NRV RECORDED được bridge vào FAST 2294 + 632. Cloud dùng immutable content-addressed chunks, exact revision snapshot, ever-closed retention và Close exception package; CSP được bổ sung; CI có accounting + retention contract tests.

> **v1.9.1 Closed-period integrity patch (02/10/2026):** REOPEN được cloud-confirm trước khi ghi audit cục bộ; Firestore chỉ cho admin stage blob `closed@…` khi kỳ đang CLOSED, parent revision chỉ được đổi trạng thái closed tương ứng, và immutable revision phải bind đúng `rev + manifestHash` của parent sau transaction. Đây là hardening cho tính bất biến kỳ đã đóng; các costing-policy controls của v1.9.0 giữ nguyên.

> **v1.9.0 Accounting Integrity (02/10/2026):** hard-block ngày ERP/Sales lỗi hoặc ngoài kỳ; Bill/B.L. Date là recognition date bắt buộc khi được cung cấp; Sales Return chạy STRICT_DATE, match hoá đơn gốc chặt, cộng gộp nhiều line cùng invoice-product và ghi COGS reversal vào FG History; Credit Note không tạo chuyển động FG; hỗ trợ kỳ không sản xuất nhưng bán FG đầu kỳ; Manual Price / Direct 622-627 có maker-checker; fallback STEP 2 trọng yếu cần Admin duyệt; NRV phải có quyết định kế toán trước Close; cloud lưu immutable revision manifest và CLOSED period chỉ sửa sau REOPEN; CI kiểm unit + synthetic + control rules trước deploy.

> **v1.8.1 core-controls remediation:** Recognition Date, STRICT_DATE Rework/Return, ERP-period gate, 3B AMOUNT strict basis, DIRECT_632 FAST bridge, inter-period reopen guard và CI→Pages deployment.

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
| STEP 5R | Hàng bán bị trả lại: match invoice gốc, reverse COGS gốc, Returned FG Layer, Return Register & close control | Có trên web |
| STEP 5 | FG đầu kỳ theo lô, FIFO giá vốn, FIFO rework (5B), nhập–xuất–tồn, FG History, đóng kỳ, roll forward | Có trên web |

Engine ban đầu được port từ VBA v30.9 và vẫn giữ **legacy regression baseline** của kỳ 2026-08: **69.871/69.871** giá trị cho STEP 1–3A, **223.899/223.899** cho STEP 3B–4 và **99.522/99.522** cho STEP 5 tại baseline Excel tương ứng. Từ v1.8–v1.9, web có một số **approved accounting-policy controls chủ ý khác Excel cũ** (3B amount basis, Bill/B.L. recognition date, chronological Sales Return/Rework, hard validation, maker-checker). Vì vậy không được hiểu mọi khác biệt với workbook v30.9 là regression; cần phân biệt **Legacy Excel Parity** và **Approved Web Accounting Policy**.

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
13. **5R Sales Return**: mở bước riêng để kiểm Return Register, Original Invoice, số lượng trả còn lại và COGS reversal. Nếu STEP 5R BLOCK thì chưa được đóng kỳ.
14. **5.3 FG History & đóng kỳ**: *BUILD FG HISTORY* → *CLOSE MONTH*. Sau đó tạo kỳ mới: FG đầu kỳ, Opening WIP, Rework WIP B/F, FG History, Sales DB, giá… được mang sang tự động.
15. Xuất Excel từng bảng hoặc cả kỳ khi cần lưu trữ.

**Chuyển từ Excel sang web:** *Kỳ, cloud & chuyển đổi → Nạp một kỳ từ file Costing Master (.xlsm)* đọc 21 sheet ERP, WIP_OPENING, sổ rework, các sheet STEP 3B / 4 / 5 (ERP map, quyết định duyệt, doanh thu, giá, GL, FG đầu kỳ, override, FG History), chạy lại STEP 2–5 và hiện bảng đối chiếu Web ↔ Excel.

## Thiết lập Firebase (một lần)

Ứng dụng dùng project Firebase riêng **SVL-Costing** (`svl-costing`). Dữ liệu giá thành nằm trong **Firestore** và bắt buộc đăng nhập Google.

1. Firebase Console → **Build → Firestore Database → Create database** (chọn vùng `asia-southeast1`, chế độ production).
2. Firestore → **Rules**: dán nội dung `firestore.rules` → **Publish**. Đây là bước release bắt buộc mỗi khi file rules thay đổi; deploy GitHub Pages không tự publish Firestore Rules. v1.10.1 sửa contract CLOSE/REOPEN; phải publish đúng `firestore.rules` của v1.10.1 trước khi deploy web v1.10.1.
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
| Ngày Sales / ERP (F-05, F-10, F-23) | Sales thiếu/sai Recognition Date hoặc Bill Date được cung cấp nhưng invalid bị BLOCK ngay tại Validate & Save. ERP transaction có ngày ngoài kỳ, trống, invalid hoặc thiếu cột Date bị BLOCK trước STEP 2. |
| Đóng kỳ (F-16, F-25) | Chỉ Quản trị được CLOSE MONTH. Cloud phải xác nhận revision đóng kỳ. Kỳ CLOSED không được update/delete/chỉnh chunks; Admin phải REOPEN thành một revision riêng trước. Không được reopen kỳ trước khi kỳ kế tiếp còn CLOSED. **Phải Publish `firestore.rules` cùng release.** |
| Nhật ký cloud (F-26) | Tải đủ mọi sự kiện của kỳ theo trang, sắp theo giờ server. |
| Cầu nối 154 (F-17) | STEP 5 checkpoint 15a = công thức F200 của Excel (WIP đầu kỳ + B/F + MI + Stock Out + 622 + 627 + FG đi rework − MR − nhập kho − WIP cuối − rework WIP cuối). |
| Exception controls (F-10…F-24) | File NO DATA có số liệu bị từ chối; Stock Out fallback rộng >5% phải Admin duyệt; vật tư đổi ERP cần xác nhận; future SO price / Manual Price overlap / Manual Price chưa duyệt làm BLOCK Price Master; STRICT_DATE cảnh báo lớp sản xuất không có ngày; hệ S vẫn được hiển thị memo để kiểm tra scope. |

### Quyết định của chủ quy trình 02/10/2026 (v1.8)

| Nội dung | Cách hoạt động |
|---|---|
| Chặn theo 3B (F-07) | STEP 4 và CLOSE MONTH bị chặn khi: còn WIP âm chưa đưa vào 3B, chưa BUILD / BUILD cũ, còn dòng chưa quyết định, đã APPROVE chưa APPLY. Riêng đóng kỳ: mọi bút toán DIRECT_632 phải RECORDED. |
| Đối chiếu FAST (F-17) | STEP 5.3 → *Đối chiếu FAST*: nhập 154, 155, 632, 511. Lệch >1 VND phải được **Admin khác người nhập FAST** xác nhận kèm giải trình; approval được bind vào figures và tự hết hiệu lực khi số đổi. |
| 3B theo giá trị (F-01) | ACTUAL_USAGE chia theo giá trị tiêu hao PC-M (Total Cost). Chọn lại "theo số lượng" ở màn hình 3B nếu cần; kỳ chuyển từ Excel giữ cách cũ để khớp file. |
| FIFO theo ngày (F-04) | STRICT_DATE: dòng bán và phiếu xuất rework chạy chung theo ngày; mỗi sự kiện chỉ dùng lớp có ngày ≤ ngày của nó. MONTHLY giữ như Excel, có cảnh báo khi rework lấy lớp hoàn thành sau ngày xuất. |
| Ngày Bill (F-08) | Nếu file có giá trị *Bill/B.L. Date* thì đây là Recognition Date bắt buộc; Bill Date invalid hoặc sau kỳ bị BLOCK. Chỉ fallback Invoice Date khi Bill Date thực sự trống. YTD Sales DB không được replace quá ngày cuối kỳ giá thành. |
| Hàng bán trả lại (F-09) | Chỉ `Transaction Type = SALES RETURN` mới tạo physical return. Bắt buộc STRICT_DATE. Nếu nhập Original Invoice No. mà không tìm thấy thì **không fallback**; nếu để trống chỉ auto-match khi có đúng một candidate cùng khách–sản phẩm. Nhiều line cùng invoice-product được cộng gộp; cumulative return không vượt sold qty. Return reversal được ghi âm vào FG History để net COGS/632 reconcile. Credit Note không tạo FG movement. |
| NRV (F-14) | NRV = giá bán × tỷ giá × (1 − 1,5% chi phí bán hàng; chỉnh được). Nếu có provision proposed >1 VND, CLOSE MONTH bị chặn cho tới khi Admin chọn `RECORDED` (kèm Accounting Ref) hoặc `NO ADJUSTMENT APPROVED` (kèm giải trình). Decision key đổi khi layer/price/NRV thay đổi. |
| Truy xuất qua các kỳ | Tab *Qua các kỳ*: giá thành, giá vốn, giá bán / sp 6 kỳ gần nhất, có biểu đồ. |
| Kiểm thử | CI chạy syntax + `test/unit.mjs` + `test/synth.mjs`: STEP 2→5, MONTHLY/STRICT_DATE, Sales Return→FG History, Credit Note, return cap, zero-production, ERP/Sales date integrity, 3B, Rework, NRV, FAST bridge và snapshot synthetic. Golden Excel tests vẫn cần fixtures thật ngoài repo. |

**Phát hành:** GitHub Pages dùng workflow CI; job deploy phụ thuộc job checks và chỉ chạy trên `main`. Khi thay `firestore.rules`, web deploy PASS chưa đủ — phải Publish rules lên Firebase và xác minh cloud access/close/reopen bằng tài khoản thử trước khi coi release hoàn tất.

## Governance v1.9

- **STEP 2 fallback trọng yếu:** fallback rộng >5% tổng Stock Out phân bổ sẽ BLOCK cho tới khi Admin xác nhận lý do.
- **Manual Price:** chỉnh sửa reset approval; `Approved By` do hệ thống ghi từ identity đăng nhập, không nhập tay; maker không tự approve.
- **Direct 622/627:** dòng Active bắt buộc Reason / Evidence và maker-checker approval; thay đổi allocation reset approval.
- **FAST difference:** Admin approver phải khác người nhập FAST.
- **Cloud revision:** mỗi cloud commit tạo manifest hash + immutable revision document; superseded content-addressed chunks được giữ để phục vụ trace/retention.
- **CLOSED period:** không xoá trực tiếp; phải REOPEN trước và để lại revision/audit trail.
- **NRV:** period có provision proposed phải có accounting decision trước Close.

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
