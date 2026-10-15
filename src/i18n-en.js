// v1.14.59: English UI strings. Keys are the Vietnamese text as rendered (trimmed, single spaces), numbers replaced by {#}.
// Generated from a crawl of every screen and tab; values keep {#} in the same order.
export const EN = {
"% tiêu hao": "% consumption",
"% tổng phân bổ": "% of total allocated",
"(ERP {#} so với FIFO {#} VND) – đơn giá ERP của các dòng này bất thường, cần kiểm tra giá xuất kho trên ERP (tab \"ERP vs FIFO\", lọc \"BẤT THƯỜNG\"). Không tính các dòng đó, ERP {#} ≤ FIFO {#} VND đúng như nguyên tắc.": "(ERP {#} vs FIFO {#} VND) – the ERP unit price of these lines is abnormal; check the issue price in ERP (tab \"ERP vs FIFO\", filter \"ABNORMAL\"). Excluding them, ERP {#} ≤ FIFO {#} VND as expected.",
"(SL âm, hoặc chỉ có tiền) và": "(negative qty, or amount only) and",
"(chuyển các dòng sang CONSUMPTION). Sau đó chạy": "(moves the lines to CONSUMPTION). Then run",
"(chỉ lưu danh sách) hoặc": "(only saves the list) or",
"(chủ sở hữu). Mọi thay đổi được tự động lưu lên Firestore (đã nén).": "(owner). Every change is saved to Firestore automatically (compressed).",
"(có số lượng: nhập lại kho theo giá vốn hoá đơn gốc, giảm {#}).": "(with quantity: returned to stock at the original invoice cost, reduces {#}).",
"(có thể dùng cùng file).": "(the same file can be used).",
"(cột {#})": "(column {#})",
"(giảm giá, không nhập kho).": "(price reduction, no stock movement).",
"(hoặc": "(or",
"(không tính FIFO). Đối chiếu với hoá đơn gốc / doanh thu TK {#} trên FAST trước khi chọn.": "(not costed by FIFO). Check against the original invoice / account {#} revenue in FAST before choosing.",
"(vẫn tính giá vốn FIFO – mặc định giống Excel) hoặc": "(still costed by FIFO – default, same as Excel) or",
"(Đầu kỳ, Trong kỳ, Trong kỳ, Cuối kỳ; {#} lô) – chỉ cảnh báo, không chặn. Xem tab": "(Opening, In period, In period, Closing; {#} lots) – warning only, not blocking. See tab",
"(đang mở)": "(open)",
"(– dòng chưa có Cost month).": "(– lines without a Cost month).",
"). Máy tính: biểu tượng cài đặt trên thanh địa chỉ Chrome / Edge.": "). Computer: the install icon in the Chrome / Edge address bar.",
"); dòng": "); lines",
"+ FG xuất rework kỳ này": "+ FG issued to rework this period",
"+ Kỳ": "+ Period",
"+{#} % so với kỳ trước": "+{#} % vs previous period",
"-- chọn --": "-- select --",
". Bảng này cho biết lô nào đã có giá, giá lấy từ nguồn nào, và lô nào còn thiếu.": ". This table shows which lots have a price, which source it came from, and which are still missing.",
". Chênh checkpoint = hàng trả lại − tổng chênh dòng = {#}.": ". Checkpoint difference = returns − total line difference = {#}.",
". Chưa xác nhận thì không đóng kỳ được.": ". Month close is blocked until confirmed.",
". Import file doanh thu (MONTHLY hoặc YTD) → Validate & Save → Update Price Master (giá tháng hiện tại → giá thực tế gần nhất → YTD → Sales Order; giá thủ công luôn được ưu tiên).": ". Import the revenue file (MONTHLY or YTD) → Validate & Save → Update Price Master (current month price → latest actual price → YTD → Sales Order; manual prices always take priority).",
". Import lại cùng báo cáo sẽ thay thế dữ liệu cũ.": ". Importing the same report again replaces the old data.",
". Khi còn treo (OPEN / HOLD) thì": ". While pending (OPEN / HOLD) it is",
". Thực tế = Σ SL FIFO đã xuất ({#}) = SL FIFO − tiêu dùng nội bộ ({#}). Tổng chênh các dòng bán bên dưới:": ". Actual = Σ FIFO qty issued ({#}) = FIFO qty − internal consumption ({#}). Total difference of the sales lines below:",
". Tick là lưu ngay, chỉ có hiệu lực trong kỳ này. Sau khi đổi lựa chọn,": ". Ticks are saved immediately and apply to this period only. After changing the selection,",
". Web dùng giá FIFO của chính lô thành phẩm (gồm NVL + {#} + {#}) cho {#} / {#}. Kỳ này có": ". The web uses the FIFO cost of the finished lot itself (RM + {#} + {#}) for {#} / {#}. This period has",
": Xoá kỳ (xoá hẳn trên máy này và cloud). Kỳ": ": Delete period (removed from this device and the cloud). Periods",
": import, chạy các bước, sửa sổ rework ·": ": import, run the steps, edit the rework register ·",
": toàn quyền và quản lý người dùng ·": ": full access and user management ·",
": xem và xuất Excel. Chủ sở hữu khai báo trong Firestore Rules luôn có quyền Quản trị.": ": view and export Excel. The owner declared in Firestore Rules is always Admin.",
"; dòng bán hàng thường bị bỏ qua, nên dùng được cả file ERP xuất chung. Validate & Save thay toàn bộ dòng trả lại cũ trong khoảng ngày của file (YTD: từ {#} đến hết kỳ).": "are accepted; ordinary sales lines are skipped, so a combined ERP export can be used. Validate & Save replaces all earlier return lines in the file's date range (YTD: from {#} to the end of the period).",
"= Cuối kỳ (chuyển kỳ sau)": "= Closing (carried forward)",
"= ERP cao hơn cả giá thành đầy đủ (NVL + {#} + {#}) – không thể đúng nếu ERP chỉ có NVL, cần kiểm tra giá xuất kho trên ERP;": "= ERP above even the full cost (RM + {#} + {#}) – impossible if ERP covers RM only; check the issue price in ERP;",
"= ERP dùng giá NVL cũ / bình quân thấp hơn lô thực tế.": "= ERP uses an old / average RM price below the actual lot.",
"= ERP trong ±{#}% phần NVL của lô;": "= ERP within ±{#}% of the lot's RM part;",
"= FIFO theo ngày: dòng bán (ngày Bill / hoá đơn) và phiếu xuất rework (ngày xuất) chạy chung theo thứ tự thời gian; mỗi sự kiện chỉ dùng lớp có ngày ≤ ngày của nó.": "= FIFO by date: sales lines (Bill / invoice date) and rework issues (issue date) run together in time order; each event only uses layers dated on or before it.",
"= giảm giá hàng bán (để trống = {#} khi web cũng bằng {#}). Lệch > {#} VND phải được xác nhận kèm giải trình trước khi đóng kỳ; xác nhận tự hết hiệu lực nếu số liệu hai bên thay đổi.": "= sales discounts (blank = {#} when the web is also {#}). Differences > {#} VND must be confirmed with an explanation before month close; a confirmation lapses automatically if either side's figures change.",
"= hàng bán bị trả lại,": "= sales returns,",
"= phát sinh Có trước bút toán kết chuyển giảm trừ,": "= credit movement before the deduction closing entry,",
"A · Chênh lệch PC-P và PC-M": "A · PC-P vs PC-M difference",
"ACTUAL_USAGE / không tiêu hao": "ACTUAL_USAGE / no usage",
"APPROVE = post | HOLD / REVIEW = không điều chỉnh": "APPROVE = post | HOLD / REVIEW = no adjustment",
"Android: mở bằng Chrome → menu ⋮ →": "Android: open in Chrome → menu ⋮ →",
"B · CHƯA XÁC NHẬN": "B · NOT CONFIRMED",
"B · Vật tư SL ≠ {#} nhưng Total Cost = {#}": "B · Materials with qty ≠ {#} but Total Cost = {#}",
"BLOCK - XÁC NHẬN DỮ LIỆU BẤT THƯỜNG": "BLOCK - CONFIRM DATA ANOMALIES",
"Batch {#} – giá thành → FIFO": "Batch {#} – cost → FIFO",
"Batch {#} – Điều chỉnh WIP trực tiếp": "Batch {#} – Direct WIP adjustment",
"Batch {#}B – Rework chuyển vào": "Batch {#}B – Rework transferred in",
"Build {#} {#} · Apply {#} {#} · Đóng không điều chỉnh: Re-checking": "Build {#} {#} · Apply {#} {#} · Closed without adjustment: Re-checking",
"Báo cáo": "Report",
"Bút toán đề xuất": "Proposed journal entries",
"Bút toán đề xuất trên FAST": "Proposed entries in FAST",
"Bút toán đề xuất để hạch toán trên FAST; doanh thu ({#}) đã ghi nhận trên FAST nên không lặp lại ở đây.": "Proposed entries to post in FAST; revenue ({#}) is already recorded in FAST, so it is not repeated here.",
"Bước": "Step",
"Bảng chi tiết theo dòng (mẫu \"FG month detail\"): mỗi lô PC được tách thành các dòng theo tháng ghi nhận giá vốn (": "Line-level detail (\"FG month detail\" layout): each PC lot is split into lines by the month its COGS is recognised (",
"Bảng dưới là nhật ký lưu cùng dữ liệu kỳ ({#} dòng gần nhất).": "The table below is the log stored with the period data ({#} latest rows).",
"Bảng sở hữu ERP của vật tư là dữ liệu gốc, chuyển sang kỳ sau. Chỉ sửa cột User ERP Override khi cần (T / S / O). ERP UNKNOWN sẽ chặn STEP {#}B.": "The material ERP ownership table is master data and carries forward. Only edit the User ERP Override column when needed (T / S / O). ERP UNKNOWN blocks STEP {#}B.",
"BẤT THƯỜNG": "ABNORMAL",
"BẤT THƯỜNG: ERP > giá thành đầy đủ": "ABNORMAL: ERP > full cost",
"Bấm một dòng để xử lý. Dòng treo từ {#} tháng trở lên được đánh dấu.": "Click a line to handle it. Lines pending {#} months or more are flagged.",
"Bấm để đóng": "Click to close",
"Bắt buộc khi xác nhận (≥ {#} ký tự), ví dụ: Dùng làm mẫu thử nội bộ": "Required when confirming (≥ {#} characters), e.g. Used as internal test samples",
"Bỏ chọn đang hiện": "Deselect all shown",
"C · CHƯA XÁC NHẬN": "C · NOT CONFIRMED",
"C · Vật tư số âm, sai kiểu dữ liệu hoặc đơn giá xuất NVL bất thường": "C · Negative, wrong-type or abnormally priced material issues",
"CHỈ CÓ Ở {#}": "ONLY IN {#}",
"COGS kỳ này (lớp)": "COGS this period (layers)",
"CONTROL PASS = số vật tư INPUT": "CONTROL PASS = INPUT materials",
"CONTROL cột Control Status": "CONTROL column Control Status",
"CONTROL cột Post Check": "CONTROL column Post Check",
"CONTROL – duyệt": "CONTROL – review",
"CONTROL: vế WIP + vế PC = {#}": "CONTROL: WIP side + PC side = {#}",
"Chi phí NVL PC-M vs PC-P": "PC-M vs PC-P material cost",
"Chi phí bán hàng ước tính (NRV)": "Estimated selling cost (NRV)",
"Chi tiết": "Detail",
"Chi tiết FIFO rework": "FIFO rework detail",
"Chi tiết giá tham chiếu": "Reference price detail",
"Chi tiết lô ({#})": "Lot detail ({#})",
"Chi tiết phân bổ": "Allocation detail",
"Chi tiết theo dòng (–)": "Line-level detail (–)",
"Chi tiết theo lô PC": "Detail by PC lot",
"Chi tiết {#} · {#} dòng bán có SL FIFO ≠ SL cần": "Detail {#} · {#} sales lines with FIFO qty ≠ required qty",
"Chi tiết {#} · {#} lô FG cuối kỳ có giá vốn > NRV": "Detail {#} · {#} closing FG lots with cost > NRV",
"Chi tiết {#} · {#} sản phẩm thiếu FG ({#} dòng)": "Detail {#} · {#} products short of FG ({#} lines)",
"Chi tiết {#}b · {#} dòng bán có cảnh báo kiểm tra dữ liệu": "Detail {#}b · {#} sales lines with data warnings",
"Chiều số dư": "Balance direction",
"Chuyển rework ({#}B)": "Transfer to rework ({#}B)",
"Chênh": "Diff.",
"Chênh (ERP − FIFO)": "Diff. (ERP − FIFO)",
"Chênh PC-M − PC-P": "Diff. PC-M − PC-P",
"Chênh SL": "Qty diff.",
"Chênh giá trị": "Value diff.",
"Chênh lệch": "Difference",
"Chênh lệch kiểm tra": "Check difference",
"Chênh lệch phân bổ NVL": "RM allocation difference",
"Chênh lệch theo lô ({#})": "Differences by lot ({#})",
"Chênh lệch tuyệt đối lớn nhất": "Largest absolute difference",
"Chưa chạy được:": "Cannot run yet:",
"Chưa có ai ngoài chủ sở hữu.": "No one besides the owner yet.",
"Chưa có dòng nào được xử lý.": "No lines handled yet.",
"Chưa có dòng nào.": "No rows yet.",
"Chưa có dữ liệu – upload / roll forward số đầu kỳ và chuyển STEP {#}.": "No data yet – upload / roll forward the opening figures and move STEP {#} in.",
"Chưa có dữ liệu.": "No data yet.",
"Chưa có phân bổ – chạy FIFO (STEP {#}) rồi Cập nhật từ STEP {#} / FIFO.": "No allocation yet – run FIFO (STEP {#}), then Update from STEP {#} / FIFO.",
"Chưa có số kỳ này": "No figures for this period",
"Chưa có số đầu kỳ.": "No opening figures yet.",
"Chưa import.": "Not imported.",
"Chưa nhập số dư FAST": "FAST balances not entered",
"Chưa phân bổ": "Unallocated",
"Chưa xác nhận phần này.": "This part is not confirmed.",
"Chưa đóng được:": "Cannot close yet:",
"Chạy STEP {#}": "Run STEP {#}",
"Chạy STEP {#} – kết quả tự chuyển vào bảng": "Run STEP {#} – results move into the table automatically",
"Chạy STEP {#}B – Điều chỉnh WIP trực tiếp": "Run STEP {#}B – Direct WIP adjustment",
"Chạy UPDATE PRICE sau khi lưu doanh thu": "Run UPDATE PRICE after saving revenue",
"Chạy lại STEP {#} khi dữ liệu trước đó thay đổi": "Re-run STEP {#} when earlier data changes",
"Chạy lại kiểm tra": "Re-run check",
"Chạy lần lượt từng bước; mỗi bước chỉ đi tiếp khi các checkpoint không còn BLOCK.": "Run the steps in order; each step only continues when its checkpoints have no BLOCK left.",
"Chạy sau STEP {#} và sau mọi thay đổi Opening WIP": "Run after STEP {#} and after any Opening WIP change",
"Chạy {#} APPLY & SYNC": "Run {#} APPLY & SYNC",
"Chạy {#} BUILD / REFRESH": "Run {#} BUILD / REFRESH",
"Chạy {#} {#} · {#}s ·": "Run {#} {#} · {#}s ·",
"Chặn lệch kỳ": "Blocks period mismatch",
"Chế độ": "Mode",
"Chế độ FIFO": "FIFO mode",
"Chỉ có ở PC-M": "Only in PC-M",
"Chỉ có ở PC-P": "Only in PC-P",
"Chỉ doanh thu bán hàng (TK {#}). Hàng bán bị trả lại (TK {#}) và giảm giá / credit note (TK {#}) import, lưu và xử lý riêng ở": "Sales revenue only (account {#}). Sales returns (account {#}) and discounts / credit notes (account {#}) are imported, saved and processed separately on",
"Chỉ dùng cho khoản xác định được cho một lô cụ thể. Active = Y.": "Only for amounts that can be traced to one specific lot. Active = Y.",
"Chỉ giảm tiền": "Amount only",
"Chỉ lưu trên máy này": "Stored on this device only",
"Chỉ review. Nhập {#} lũy kế năm ở màn hình {#}.": "Review only. Enter YTD {#} on screen {#}.",
"Chỉ tiêu": "Measure",
"Chỉ xem": "View only",
"Chỉ để kiểm tra –": "For checking only –",
"Chỉ để đối chiếu, không dùng tính giá": "For reference only, not used for costing",
"Chỉnh sửa": "Edit",
"Chọn": "Select",
"Chọn các file báo cáo ERP của kỳ {#} (PC-P, PC-M, MI-P, MI-M, STOCK OUT, MR-P, MR-M cho hệ T, S, O). Tên file phải chứa loại báo cáo, hệ và kỳ, ví dụ": "Choose the ERP report files for period {#} (PC-P, PC-M, MI-P, MI-M, STOCK OUT, MR-P, MR-M for systems T, S, O). The file name must contain the report type, system and period, for example",
"Chọn cả thư mục…": "Choose a whole folder…",
"Chọn dòng tiêu hao · {#} dòng Stock Out NVL kỳ này · đã chọn – dòng": "Select consumption lines · {#} RM Stock Out lines this period · selected – lines",
"Chọn file .xlsm…": "Choose .xlsm file…",
"Chọn file doanh thu…": "Choose revenue file…",
"Chọn file hàng trả lại / giảm giá…": "Choose returns / discounts file…",
"Chọn file…": "Choose files…",
"Chọn một mã thành phẩm để xem giá thành sản xuất kỳ {#} đến từng lô PC và từng vật tư, giá vốn hàng bán đến từng lớp FIFO, kèm các điểm bất thường cần kiểm tra.": "Choose a finished-goods code to see its production cost for {#} down to each PC lot and material, and its COGS down to each FIFO layer, with the anomalies to check.",
"Chọn tất cả đang hiện": "Select all shown",
"Chờ đồng bộ…": "Waiting to sync…",
"Chứng từ": "Document",
"Chứng từ (PC / MI / MR No.)": "Document (PC / MI / MR No.)",
"Chứng từ, mã vật tư, tên…": "Document, material code, name…",
"Closing WIP ERP = Opening + Vào − Ra": "ERP closing WIP = Opening + In − Out",
"Closing WIP cuối": "Final closing WIP",
"Closing WIP cuối (sau {#}B)": "Final closing WIP (after {#}B)",
"Cuối kỳ": "Closing",
"CÓ": "YES",
"Cài SVL Costing như ứng dụng": "Install SVL Costing as an app",
"Cài đặt ứng dụng": "Install app",
"Các dòng này vẫn được tính FIFO (không chặn). Cảnh báo lấy từ kiểm tra dữ liệu bán (thiếu khách hàng, SL × đơn giá lệch, loại OTHER…). Nên rà soát ở nguồn doanh thu.": "These lines are still costed by FIFO (not blocking). Warnings come from the sales-data check (missing customer, qty × price mismatch, type OTHER…). Review them at the revenue source.",
"Các dòng xuất lệch bất thường được liệt kê ở thẻ C phía trên (ngưỡng mặc định, cần xác nhận).": "Abnormal issue lines are listed in card C above (default threshold, confirmation required).",
"Còn": "There are",
"Còn lại": "Other",
"Có": "Cr",
"Công cụ": "Tools",
"Cùng cấu trúc cột với file doanh thu (Invoice Date, Customer, Product Number, Quantity, Amount USD / VND, SI Invoice No., Transaction Type; nên có": "Same column layout as the revenue file (Invoice Date, Customer, Product Number, Quantity, Amount USD / VND, SI Invoice No., Transaction Type; preferably",
"Cảnh báo": "Warning",
"Cảnh báo treo quá": "Warn when pending over",
"Cấu thành giá: RM+{#}+{#}+{#}B+Rework": "Cost build-up: RM+{#}+{#}+{#}B+Rework",
"Cần cột Product Code và Unit Price USD (tuỳ chọn: Active, SO Date, SO No., Customer, Qty, Note). Import sẽ thay toàn bộ danh sách.": "Requires Product Code and Unit Price USD columns (optional: Active, SO Date, SO No., Customer, Qty, Note). Import replaces the whole list.",
"Cần quyết định kế toán trước khi CLOSE MONTH. Quyết định cũ (nếu có) không còn hiệu lực khi số liệu STEP {#} thay đổi.": "An accounting decision is needed before CLOSE MONTH. An earlier decision (if any) no longer applies when STEP {#} figures change.",
"Cần xem": "To review",
"Cầu nối TK {#} (gồm rework)": "Account {#} bridge (incl. rework)",
"Cầu nối TK {#} (gồm {#}B & rework)": "Account {#} bridge (incl. {#}B & rework)",
"Cập nhật": "Updated",
"Cập nhật từ STEP {#} / FIFO": "Update from STEP {#} / FIFO",
"Cập nhật {#} {#} · nguồn đến {#}": "Updated {#} {#} · source through {#}",
"Cổng STEP {#}": "STEP {#} gate",
"Cổng đóng kỳ": "Month-close gate",
"Cổng đóng kỳ: BLOCK": "Month-close gate: BLOCK",
"Cột Override Treatment là ô nhập duy nhất (FIFO COGS / NO COGS / REVIEW), giữ theo Line Key khi chạy lại. Thay đổi có hiệu lực ở lần RUN FIFO COGS tiếp theo.": "The Override Treatment column is the only input (FIFO COGS / NO COGS / REVIEW), kept by Line Key on re-run. Changes take effect at the next RUN FIFO COGS.",
"DIRECT_{#} chỉ là đề xuất hạch toán – không vào PC-P hay WIP Allocation. Điền Accounting Ref, ngày ghi sổ, người ghi sau khi đã hạch toán trên FAST.": "DIRECT_{#} is only a posting proposal – it does not go into PC-P or WIP Allocation. Fill in Accounting Ref, posting date and poster after posting in FAST.",
"DIRECT_{#} chờ ghi sổ": "DIRECT_{#} awaiting posting",
"Danh mục {#} báo cáo bắt buộc": "Required reports ({#})",
"Diễn giải": "Description",
"Doanh thu & giá": "Revenue & prices",
"Doanh thu bán hàng – phát sinh Có, trước kết chuyển giảm trừ (file doanh thu)": "Sales revenue – credit movement before deduction closing (revenue file)",
"Doanh thu {#} kỳ này": "Revenue {#} this period",
"Doanh thu đã Validate & Save": "Revenue Validated & Saved",
"Dòng": "Line",
"Dòng DETAIL": "DETAIL rows",
"Dòng DETAIL bị BLOCK": "BLOCKed DETAIL rows",
"Dòng Excel": "Excel row",
"Dòng FG chuyển sang tiêu dùng nội bộ": "FG lines moved to internal consumption",
"Dòng FIFO có cảnh báo kiểm tra dữ liệu bán": "FIFO lines with sales-data warnings",
"Dòng INPUT bị BLOCK": "BLOCKed INPUT lines",
"Dòng MR SL = {#} có giá trị": "MR lines with qty = {#} carrying value",
"Dòng Stock Out NVL": "RM Stock Out lines",
"Dòng Stock Out được đánh dấu": "Stock Out lines marked as",
"Dòng bán FIFO COGS": "FIFO COGS sales lines",
"Dòng bán cần review": "Sales lines to review",
"Dòng bán thiếu / sai ngày hoá đơn": "Sales lines with missing / invalid invoice date",
"Dòng báo \"access right\" từ ERP: {#}": "Rows flagged \"access right\" by ERP: {#}",
"Dòng cost = {#}": "Lines with cost = {#}",
"Dòng doanh thu đã lưu trong kỳ": "Revenue lines saved in the period",
"Dòng gốc": "Source line",
"Dòng history": "History lines",
"Dòng lệch": "Deviating lines",
"Dòng phân bổ trực tiếp": "Direct allocation lines",
"Dòng staging": "Staging rows",
"Dòng thật": "Genuine line",
"Dòng tiêu hao": "Consumption lines",
"Dòng trả lại có SL": "Return lines with qty",
"Dọn WIP âm / tồn dư: vật tư âm được phân bổ vào lô PC theo tỷ lệ tiêu hao thực tế (ACTUAL_USAGE), theo giá trị RM trong cùng ERP (ERP_AMOUNT) hoặc chuyển thẳng {#} (DIRECT_{#}). Quy tắc hạch toán: WIP = −Basis, PC = +Basis.": "Clear negative / residual WIP: negative materials are allocated to PC lots by actual usage (ACTUAL_USAGE), by RM value within the same ERP (ERP_AMOUNT), or moved directly to {#} (DIRECT_{#}). Posting rule: WIP = −Basis, PC = +Basis.",
"Dữ liệu ERP mới hơn STEP {#}. Chạy lại STEP {#}.": "ERP data is newer than STEP {#}. Re-run STEP {#}.",
"Dữ liệu ERP đã import": "Imported ERP data",
"Dữ liệu gốc của từng báo cáo sau khi chuẩn hoá (từ dòng tiêu đề trở xuống).": "Raw data of each report after normalisation (from the header row down).",
"Dữ liệu trả lại / giảm giá ({#})": "Returns / discounts data ({#})",
"Dự phòng": "Fallback",
"Dự phòng cần trích": "Provision needed",
"Dự phòng giảm giá đề xuất (TK {#}): {#} VND – xem STEP {#} → Tồn cuối": "Proposed inventory write-down (account {#}): {#} VND – see STEP {#} → Closing stock",
"Dự phòng đề xuất (VND)": "Proposed provision (VND)",
"ENGINE → PC = vế PC CONTROL ★": "ENGINE → PC = CONTROL PC side ★",
"ERP Stock Out so với giá FIFO.": "ERP Stock Out vs FIFO cost.",
"ERP map: vật tư đổi hệ ERP cần xác nhận": "ERP map: materials that changed ERP system need confirmation",
"ERP so với giá thành": "ERP vs cost",
"ERP thấp hơn NVL": "ERP below RM",
"ERP ≈ phần NVL của lô FIFO ≤ giá thành FIFO đầy đủ": "ERP ≈ the RM part of the FIFO lot ≤ the full FIFO cost",
"Expected = STEP {#} | Actual = lần Apply": "Expected = STEP {#} | Actual = the Apply run",
"Expected = import ERP gần nhất | Actual = lần chạy STEP {#}": "Expected = latest ERP import | Actual = STEP {#} run",
"Expected = lần chạy STEP {#} | Actual = cập nhật register": "Expected = STEP {#} run | Actual = register update",
"FG Consumption (tiêu dùng nội bộ) cost": "FG Consumption (internal use) cost",
"FG History & đóng kỳ": "FG History & month close",
"FG History lưu toàn bộ lịch sử lô đã bán (cộng dồn qua các kỳ) và ảnh chụp FG cuối kỳ. Đóng kỳ chỉ được khi STEP {#} CURRENT, Batch {#} PASS, FG History khớp và Final Production Status = READY.": "FG History keeps the full history of sold lots (accumulated across periods) and a snapshot of closing FG. Month close is only allowed when STEP {#} is CURRENT, Batch {#} PASS, FG History matches and Final Production Status = READY.",
"FG Rework – giá ERP (memo)": "FG Rework – ERP value (memo)",
"FG consumption FIFO cost (Nợ {#} / Có {#})": "FG consumption FIFO cost (Dr {#} / Cr {#})",
"FG cuối kỳ": "Closing FG",
"FG cuối kỳ (lớp)": "Closing FG (layers)",
"FG phân bổ vào PC": "FG allocated to PCs",
"FG xuất kho không phải NVL – chuyển sang Rework FIFO": "FG issues are not RM – moved to Rework FIFO",
"FG xuất ra dùng nội bộ: không bán và không đi qua rework WIP ({#}). Tick dòng → nhập lý do →": "FG taken for internal use: not sold and not passing through rework WIP ({#}). Tick lines → enter a reason →",
"FG xuất rework kỳ này (FIFO)": "FG issued to rework this period (FIFO)",
"FG xuất đi rework": "FG issued to rework",
"FG xuất đi rework (giá trị FIFO)": "FG issued to rework (FIFO value)",
"FG xuất đi rework (theo FIFO)": "FG issued to rework (by FIFO)",
"FG xuất đi rework rời kho thành phẩm ({#}) theo": "FG issued to rework leaves finished-goods stock ({#}) at the",
"FG đầu kỳ": "Opening FG",
"FG đầu kỳ + nhập kho từ STEP {#} → xuất bán theo FIFO từng sản phẩm (lớp cũ nhất trước: ngày lô, đầu kỳ trước sản xuất). Sau đó FG xuất đi rework lấy tiếp theo FIFO từ lớp còn lại ({#}B).": "Opening FG + receipts from STEP {#} → sales issued by FIFO per product (oldest layer first: lot date, opening before production). FG issued to rework then continues FIFO from the remaining layers ({#}B).",
"FG đầu kỳ đã validate": "Opening FG validated",
"FIFO Mode = STRICT_DATE (tự chuyển: kỳ có FG rework)": "FIFO Mode = STRICT_DATE (automatic: period has FG rework)",
"FIFO giá vốn": "FIFO COGS",
"FIFO giá vốn & rework": "FIFO COGS & rework",
"FIFO – giá thành đầy đủ / đv": "FIFO – full cost / unit",
"FIFO – phần NVL / đv": "FIFO – RM part / unit",
"File cần có Invoice Date, Product Number, Quantity, Amount (USD). Nếu có Bill/B.L. Date thì đây là Recognition Date bắt buộc và phải hợp lệ. YTD chỉ thay dữ liệu đến hết kỳ giá thành, không đụng các kỳ tương lai. Dòng SALES RETURN / CREDIT NOTE trong file được bỏ qua (SKIPPED) – import chúng ở": "The file needs Invoice Date, Product Number, Quantity, Amount (USD). If it has a Bill/B.L. Date, that is the mandatory Recognition Date and must be valid. YTD only replaces data up to the end of the costing period and leaves future periods untouched. SALES RETURN / CREDIT NOTE lines in the file are skipped (SKIPPED) – import them on",
"File nguồn": "Source file",
"File vừa import, chờ Validate & Save": "File just imported, awaiting Validate & Save",
"File được đọc ngay trong trình duyệt; chỉ dữ liệu đã chuẩn hoá được lưu.": "Files are read in the browser; only normalised data is stored.",
"Freshness (snapshot vs dữ liệu vào)": "Freshness (snapshot vs inputs)",
"Freshness: chạy sau import ERP": "Freshness: run after ERP import",
"GL kỳ này": "GL this period",
"GL {#} · Chi phí sản xuất chung (VND)": "GL {#} · Production overhead (VND)",
"GL {#} · Nhân công trực tiếp (VND)": "GL {#} · Direct labour (VND)",
"Ghi Nợ/Có {#} trên FAST": "Post Dr/Cr {#} in FAST",
"Ghi chú": "Note",
"Ghi chú (nguồn lớp STEP {#})": "Note (STEP {#} layer source)",
"Giá ERP trên phiếu Stock Out chỉ gồm nguyên vật liệu (không có {#} / {#}), nên bình thường": "The ERP value on a Stock Out slip covers raw materials only (no {#} / {#}), so normally",
"Giá FIFO (VND)": "FIFO cost (VND)",
"Giá FIFO đã tính ({#} / {#})": "FIFO cost calculated ({#} / {#})",
"Giá Sales Order dùng khi thiếu giá bán": "Sales Order price used when no selling price",
"Giá bán cần xử lý (SO sau kỳ / manual overlap / chưa duyệt)": "Selling prices to resolve (SO after period / manual overlap / not approved)",
"Giá thành SX": "Production cost",
"Giá thành SX (STEP {#})": "Production cost (STEP {#})",
"Giá thành SX lũy kế năm": "Year-to-date production cost",
"Giá thành lô = RM (PC RM + Stock Out) + {#} + {#} + điều chỉnh WIP {#}B + rework chuyển vào. {#} chung phân bổ theo đóng góp dương (doanh thu − RM); lô cuối cùng nhận phần làm tròn còn lại.": "Lot cost = RM (PC RM + Stock Out) + {#} + {#} + WIP adjustment {#}B + rework transferred in. Common {#} is allocated by positive contribution (revenue − RM); the last lot takes the rounding remainder.",
"Giá thành nhập kho": "Production cost received",
"Giá thành nhập kho kỳ này": "Production cost received this period",
"Giá thành sản xuất tháng · Starry Vietnam": "Monthly production costing · Starry Vietnam",
"Giá thành theo lô": "Cost by lot",
"Giá thành/đv": "Cost/unit",
"Giá thủ công": "Manual price",
"Giá thủ công (USD) có ưu tiên cao nhất.": "Manual prices (USD) have the highest priority.",
"Giá trị": "Value",
"Giá trị (FIFO)": "Value (FIFO)",
"Giá trị ERP (memo)": "ERP value (memo)",
"Giá trị FG đầu kỳ": "Opening FG value",
"Giá trị FIFO (dùng tính giá)": "FIFO value (used for costing)",
"Giá trị STEP {#}": "Value STEP {#}",
"Giá trị Stock Out NVL": "RM Stock Out value",
"Giá trị VND": "Value VND",
"Giá trị bán (USD)": "Sales value (USD)",
"Giá trị lô rework vào STEP {#}": "Rework lot value into STEP {#}",
"Giá trị tiêu hao (đang chọn)": "Consumption value (selected)",
"Giá trị xuất": "Issued value",
"Giá trị {#}": "Value {#}",
"Giá trị {#} tách theo tỷ lệ SL của dòng; FIFO lấy giá trị của lớp tồn STEP {#}": "Value {#} split by the line's qty share; FIFO takes the value of the STEP {#} stock layer",
"Giá trị đang treo không đi vào giá thành sản phẩm hay giá vốn của kỳ. Khi đóng kỳ, các dòng còn treo được chuyển sang kỳ sau (B/F) với đúng giá trị này.": "Pending amounts do not go into product cost or COGS of the period. At month close, lines still pending carry forward (B/F) at exactly this value.",
"Giá vốn": "COGS",
"Giá vốn / đv (sau DP)": "Cost / unit (after prov.)",
"Giá vốn Cost month {#}": "COGS Cost month {#}",
"Giá vốn FIFO (STEP {#})": "FIFO COGS (STEP {#})",
"Giá vốn bán hàng kỳ này: dòng Cost month = kỳ (bán hàng) ↔ FIFO STEP {#}": "COGS this period: lines with Cost month = period (sales) ↔ FIFO STEP {#}",
"Giá vốn bán ra (FIFO)": "COGS issued (FIFO)",
"Giá vốn hàng bán theo FIFO": "Cost of goods sold by FIFO",
"Giá vốn theo dòng bán": "COGS by sales line",
"Giá vốn thuần trong kỳ (FIFO bán ra − giá vốn hàng trả lại + DIRECT_{#} + NRV đã ghi)": "Net COGS for the period (FIFO sales − returned goods cost + DIRECT_{#} + NRV booked)",
"Giá vốn đã xuất bán YTD": "YTD COGS issued",
"Giải trình": "Explanation",
"Giảm giá hàng bán – phát sinh Nợ (file trả lại: CREDIT NOTE)": "Sales discounts – debit movement (returns file: CREDIT NOTE)",
"Giảm giá vốn ({#})": "COGS reduction ({#})",
"Giảm trừ chỉ có tiền trong kỳ (không nhập kho)": "Amount-only deductions in the period (no stock movement)",
"HOLD – không điều chỉnh WIP. Chạy STEP {#}": "HOLD – no WIP adjustment. Run STEP {#}",
"History Through phải bằng kỳ báo cáo": "History Through must equal the reporting period",
"History đến {#} · tạo {#} {#}": "History through {#} · built {#} {#}",
"Hoàn thành → lô mới": "Completed → new lot",
"Hoá đơn": "Invoice",
"Hàng bán bị trả lại – phát sinh Nợ (file trả lại: SALES RETURN)": "Sales returns – debit movement (returns file: SALES RETURN)",
"Hàng trả lại & giảm giá": "Sales returns & discounts",
"Hàng trả lại có số lượng (giá vốn)": "Returns with quantity (COGS)",
"Hành động": "Action",
"Hóa đơn": "Invoice",
"Hóa đơn / phiếu": "Invoice / document",
"Hệ": "System",
"Hệ O": "System O",
"Hệ S": "System S",
"Hệ S không có lô PC-P nên Stock Out hệ S được phân bổ sang lô hệ T (location DS/DN → mã SP*) hoặc hệ O (VE*, MK*); location khác chia đều cho T + O.": "System S has no PC-P lots, so system-S Stock Out goes to system-T lots (location DS/DN → code SP*) or system-O lots (VE*, MK*); other locations are split between T + O.",
"Hệ S: tiêu hao PC-M-S (ngoài giá thành {#})": "System S: PC-M-S consumption (outside cost {#})",
"Hệ S: xuất NVL MI-M-S (ngoài giá thành {#})": "System S: MI-M-S material issues (outside cost {#})",
"Hệ T": "System T",
"Hệ nguồn": "Source system",
"INPUT cột Input Check": "INPUT column Input Check",
"Import danh sách SO…": "Import SO list…",
"Import dữ liệu ERP": "ERP data import",
"Import file FG đầu kỳ…": "Import opening FG file…",
"Import nhận file Costing Master tháng trước (sheet {#}_WIP_ALLOCATION hoặc WIP_OPENING), file WIP cũ (sheet \"WIP- ONLY RM\") hoặc bất kỳ bảng nào có cột Item/Material Code, Closing/Opening Qty và Amount.": "Import accepts last month's Costing Master file (sheet {#}_WIP_ALLOCATION or WIP_OPENING), the old WIP file (sheet \"WIP- ONLY RM\"), or any table with Item/Material Code, Closing/Opening Qty and Amount columns.",
"Import từ file…": "Import from file…",
"JOB CODE MK* (kèm SVL-MK)": "JOB CODE MK* (incl. SVL-MK)",
"JOB CODE VE* (kèm SVL-VE)": "JOB CODE VE* (incl. SVL-VE)",
"KHÔNG PHÁT SINH": "NONE THIS PERIOD",
"KHỚP": "MATCH",
"Khoản mục": "Item",
"Khách hàng": "Customer",
"Không có": "None",
"Không có dòng cảnh báo.": "No warning lines.",
"Không có dòng lệch.": "No mismatched lines.",
"Không có giá thủ công đang chờ duyệt.": "No manual prices awaiting approval.",
"Không có hàng trả lại vật lý trong kỳ": "No physical sales returns in the period",
"Không có phân bổ trực tiếp đang Active.": "No active direct allocations.",
"Không có sản phẩm thiếu FG.": "No products short of FG.",
"Không có.": "None.",
"Không mất giá trị rework": "No rework value lost",
"Không phải cơ sở định giá – FIFO ở STEP {#}B": "Not a valuation basis – FIFO in STEP {#}B",
"Không xác định được kỳ → chưa tính giá vốn. Sửa ngày ở nguồn rồi import & lưu lại ({#})": "Period cannot be determined → no COGS yet. Fix the date at source, then import & save again ({#})",
"Không điều chỉnh {#}B": "No {#}B adjustment",
"Khớp NVL": "Matches RM",
"Khớp đúng": "Exact match",
"Kiểm soát": "Control",
"Kiểm soát archive FG History": "FG History archive control",
"Kiểm soát rework": "Rework control",
"Kiểm tra": "Check",
"Kiểm tra dữ liệu ERP: {#} dòng SL ≠ {#} nhưng Total Cost = {#} · {#} dòng xuất NVL đơn giá bất thường": "ERP data check: {#} lines with qty ≠ {#} but Total Cost = {#} · {#} material issue lines with abnormal unit cost",
"Kiểm tra dữ liệu nhập": "Input data check",
"Kiểm tra giá PC": "PC price check",
"Kiểm tra phân loại": "Classification check",
"Kiểm tra đơn giá lô": "Lot unit-cost check",
"Kéo thả file ERP vào đây": "Drop ERP files here",
"Kết chuyển chi phí SX chung": "Production overhead transferred",
"Kết chuyển nhân công trực tiếp": "Direct labour transferred",
"Kết chuyển và nhập lại": "Transferred out and returned",
"Kết quả": "Result",
"Kết quả STEP {#}": "STEP {#} result",
"Kết quả STEP {#} kỳ {#} chưa được chuyển vào bảng. Bấm": "STEP {#} results for {#} have not been moved into the table. Click",
"Kết quả STEP {#}R": "STEP {#}R result",
"Kết quả engine STEP {#}": "STEP {#} engine result",
"Kết quả theo lô PC-P (T và O)": "Results by PC-P lot (T and O)",
"Kết quả validate WIP_OPENING": "WIP_OPENING validation result",
"Kỳ": "Period",
"Kỳ & freshness": "Period & freshness",
"Kỳ FX / GL {#}": "FX / GL period {#}",
"Kỳ GL": "GL period",
"Kỳ INPUT = kỳ báo cáo": "INPUT period = reporting period",
"Kỳ Opening WIP = kỳ báo cáo": "Opening WIP period = reporting period",
"Kỳ STEP {#} = kỳ báo cáo": "STEP {#} period = reporting period",
"Kỳ cơ sở ENGINE": "ENGINE base period",
"Kỳ giá thành": "Costing period",
"Kỳ hiện có": "Existing periods",
"Kỳ nhập lô": "Lot period",
"Kỳ này không có hàng bán bị trả lại có số lượng – không có giá vốn cần xử lý.": "No sales returns with quantity this period – no COGS to process.",
"Kỳ trước": "Previous period",
"Kỳ trước: {#}": "Previous period: {#}",
"Kỳ vọng / Nguồn": "Expected / Source",
"Kỳ vọng = ngưỡng {#}% × tổng đã phân bổ; Chênh lệch = số tiền vượt ngưỡng (VND). Tỷ lệ thực tế {#}%. Vượt ngưỡng phải được Quản trị xác nhận kèm lý do": "Expected = threshold {#}% × total allocated; Difference = amount above the threshold (VND). Actual share {#}%. Above the threshold must be confirmed by an Admin with a reason",
"Kỳ vọng = Σ SL bán đủ điều kiện ({#}) − hàng trả lại ({#}) =": "Expected = Σ eligible sales qty ({#}) − returns ({#}) =",
"Kỳ xuất": "Issue period",
"Kỳ {#} có": "Period {#} has",
"Kỳ, cloud & chuyển đổi": "Periods, cloud & migration",
"Loại": "Type",
"Loại bất thường": "Anomaly type",
"Loại chênh lệch": "Difference type",
"Luân chuyển WIP rework (TK {#})": "Rework WIP movement (account {#})",
"Luân chuyển {#} & bút toán": "{#} movement & journal",
"Luôn được ưu tiên khi đã duyệt": "Always takes priority once approved",
"Lãi gộp %": "Gross margin %",
"Lô": "Lot",
"Lô PC có giá": "PC lots with price",
"Lô cuối kỳ giá vốn > NRV (giá bán − {#}% CPBH)": "Closing layers with cost > NRV (price − {#}% selling cost)",
"Lô không có trong file {#} hoặc {#} còn tồn ít hơn số FIFO đã xuất": "Lot not in file {#} or {#} has less stock than the FIFO quantity issued",
"Lý do": "Reason",
"Lý do / bằng chứng review": "Reason / review evidence",
"Lũy kế {#} theo FG History vs GL lũy kế (FAST)": "YTD {#} per FG History vs YTD GL (FAST)",
"Lưu GL cho kỳ {#}": "Save GL for period {#}",
"Lưu kỳ này lên cloud ngay": "Save this period to cloud now",
"Lưu lúc {#} {#}": "Saved at {#} {#}",
"Lưu lần cuối {#} {#} · {#} dòng doanh thu bán hàng. Sales Database được mang sang kỳ sau. Hàng trả lại / giảm giá:": "Last saved {#} {#} · {#} sales revenue lines. The Sales Database carries forward. Returns / discounts:",
"Lưu nháp": "Save draft",
"Lưu quyết định NRV": "Save NRV decision",
"Lưu số FAST": "Save FAST figures",
"Lưu thay đổi": "Save changes",
"Lần": "Occurrence",
"Lần chạy gần nhất {#} {#}": "Last run {#} {#}",
"LỆCH": "MISMATCH",
"Lệch lớn nhất": "Largest deviation",
"Lệch so với chuẩn": "Deviation from reference",
"Lọc theo rule:": "Filter by rule:",
"Lọc trạng thái": "Filter status",
"Lỗi chặn": "Blocking errors",
"Lớp FIFO đầu kỳ": "Opening FIFO layers",
"Lớp FIFO đầu kỳ ({#})": "Opening FIFO layers ({#})",
"Lớp sản xuất = giá thành STEP {#}": "Production layers = STEP {#} cost",
"MI − PC = biến động WIP hệ S, đối chiếu trên FAST": "MI − PC = system-S WIP movement, reconcile in FAST",
"MR-M: {#} dòng có Quantity = {#} nhưng Total Cost = {#} VND. Kiểm tra file MR-M xuất từ ERP. (Nguồn SL: T, O = Quantity; S = Bad Quantity; không dùng Req. Qty.)": "MR-M: {#} lines with Quantity = {#} but Total Cost = {#} VND. Check the MR-M file exported from ERP. (Qty source: T, O = Quantity; S = Bad Quantity; Req. Qty is not used.)",
"Mã SP": "Product code",
"Mã VT": "Material code",
"Mã sản phẩm": "Product code",
"Mã vật tư": "Material code",
"Mã vật tư (ví dụ)": "Material codes (examples)",
"Mô tả": "Description",
"Mẫu tối thiểu": "Minimum sample",
"Mặc định": "Default",
"Mọi lô PC sản xuất trong kỳ đều có giá bán.": "Every PC lot produced in the period has a selling price.",
"Mọi lần import, chạy bước và chỉnh sửa sổ rework.": "Every import, step run and rework register edit.",
"Mỗi dòng là một lớp FIFO còn tồn (lô sản xuất) đầu kỳ {#}. Tháng đầu tiên: import template; các tháng sau: roll forward từ FG cuối kỳ {#} (kỳ trước phải đã đóng).": "Each line is one FIFO layer (production lot) in stock at the start of {#}. First month: import the template; later months: roll forward from the closing FG of {#} (the previous period must be closed).",
"Mỗi lô PC sản xuất trong kỳ (PC-P hệ T và O, theo STEP {#}) phải có giá bán trong Price Master, vì STEP {#} phân bổ {#} / {#} theo": "Every PC lot produced in the period (PC-P systems T and O, per STEP {#}) must have a selling price in the Price Master, because STEP {#} allocates {#} / {#} by",
"Mỗi nhóm là các dòng giống hệt nhau trong Sales Database. Dòng #{#} luôn được tính. Với mỗi dòng lặp (#{#}, #{#}…), chọn": "Each group is a set of identical lines in the Sales Database. Line #{#} is always counted. For each repeated line (#{#}, #{#}…), choose",
"Mở danh sách bước": "Open step list",
"Mở sổ {#}B": "Open register {#}B",
"NOT READY · STEP {#} OUTDATED: STEP {#} OUTDATED - RERUN REQUIRED – STEP {#} = RERUN REQUIRED. Chạy lại theo thứ tự STEP {#} → RUN FIFO → BUILD FG HISTORY.": "NOT READY · STEP {#} OUTDATED: STEP {#} OUTDATED - RERUN REQUIRED – STEP {#} = RERUN REQUIRED. Re-run in order STEP {#} → RUN FIFO → BUILD FG HISTORY.",
"NRV / đv": "NRV / unit",
"NRV / đv (VND)": "NRV / unit (VND)",
"NRV = giá bán (Price Master × tỷ giá) × ({#} − {#}% chi phí bán hàng ước tính). Dự phòng đề xuất = (giá thành sau dự phòng cũ − NRV) × SL tồn, chỉ khi dương. Tổng:": "NRV = selling price (Price Master × FX) × ({#} − {#}% estimated selling cost). Proposed provision = (cost after earlier provision − NRV) × qty in stock, only when positive. Total:",
"NRV provision đề xuất: {#} VND.": "Proposed NRV provision: {#} VND.",
"NRV đơn vị = giá bán × tỷ giá − {#}% chi phí bán hàng. Giá vốn sau dự phòng = (Thành tiền + dự phòng đã ghi) ÷ SL. Dự phòng cần trích = (giá vốn sau dự phòng − NRV đơn vị) × SL. Tổng dự phòng đề xuất:": "Unit NRV = price × FX − {#}% selling cost. Cost after provision = (amount + provision booked) ÷ qty. Provision needed = (cost after provision − unit NRV) × qty. Total proposed provision:",
"NVL / non-FG đủ điều kiện": "Eligible RM / non-FG",
"NVL tiêu hao (Nợ {#} / Có {#})": "RM consumption (Dr {#} / Cr {#})",
"NVL đã phân bổ vào PC": "RM allocated to PCs",
"Nghi trùng ({#})": "Suspected duplicates ({#})",
"Nghiệp vụ": "Transaction",
"Ngoại lệ": "Exceptions",
"Ngoại lệ cần review": "Exceptions to review",
"Nguồn": "Source",
"Nguồn giá": "Price source",
"Ngày": "Date",
"Ngày HĐ": "Invoice date",
"Ngày xuất": "Issue date",
"Người dùng": "User",
"Người dùng & phân quyền": "Users & permissions",
"Người lập": "Prepared by",
"Người trong danh sách đăng nhập Google bằng đúng email này là dùng được dữ liệu trên cloud.": "People on this list who sign in with Google using exactly this email can use the cloud data.",
"Ngưỡng lệch (%)": "Deviation threshold (%)",
"Nhóm lô đích": "Target lot group",
"Nhóm nguồn": "Source groups",
"Nhóm {#} VND – không phân bổ": "Group {#} VND – not allocated",
"Nhập kho (STEP {#})": "Receipts (STEP {#})",
"Nhập kho thành phẩm ({#})": "Finished goods received ({#})",
"Nhập kho thành phẩm theo giá thành STEP {#}": "Finished goods received at STEP {#} cost",
"Nhập lại NVL từ WIP – MR": "Materials returned from WIP – MR",
"Nhập mã hoặc tên sản phẩm…": "Enter a product code or name…",
"Nhập số dư / phát sinh trên FAST (sổ cái) để đối chiếu với kết quả giá thành. Doanh thu và giảm trừ đối chiếu riêng:": "Enter FAST (general ledger) balances / movements to reconcile with the costing results. Revenue and deductions are reconciled separately:",
"Nhập tỷ giá giá thành và số dư {#} (nhân công trực tiếp), {#} (chi phí sản xuất chung) của kỳ {#} từ FAST. Phần phân bổ trực tiếp (nếu có) được trừ khỏi pool chung.": "Enter the costing FX rate and the {#} (direct labour) and {#} (production overhead) balances for period {#} from FAST. Direct allocations (if any) are deducted from the common pool.",
"Nhập – xuất – tồn": "Receipts – issues – stock",
"Nhật ký": "Audit log",
"Nhật ký kỳ {#}": "Audit log for {#}",
"Nạp một kỳ từ file Costing Master (.xlsm)": "Load a period from a Costing Master file (.xlsm)",
"Nội dung": "Item",
"Nợ": "Dr",
"Nợ {#} / Có {#}": "Dr {#} / Cr {#}",
"Nợ {#} / Có {#} sau STEP {#}": "Dr {#} / Cr {#} after STEP {#}",
"Nợ {#} / Có {#} – costed before sales COGS": "Dr {#} / Cr {#} – costed before sales COGS",
"O · JOB CODE = Location PC-P-O (khớp đúng)": "O · JOB CODE = PC-P-O location (exact match)",
"O · JOB CODE DN*/DS* → PC hệ T mã SP*": "O · JOB CODE DN*/DS* → system-T PCs with code SP*",
"O · JOB CODE MK* (kèm SVL-MK) → PC hệ O location MK*": "O · JOB CODE MK* (incl. SVL-MK) → system-O PCs at location MK*",
"O · JOB CODE VE* (kèm SVL-VE) → PC hệ O location VE*": "O · JOB CODE VE* (incl. SVL-VE) → system-O PCs at location VE*",
"O · JOB CODE còn lại → chia theo PC RM Cost mọi PC hệ O": "O · other JOB CODE → split by PC RM Cost across all system-O PCs",
"Opening WIP + MI + Stock Out − PC − MR = Closing WIP ERP theo từng vật tư. FG Stock Out không đi vào WIP.": "Opening WIP + MI + Stock Out − PC − MR = ERP closing WIP per material. FG Stock Out does not go into WIP.",
"Opening WIP dùng trong STEP {#}": "Opening WIP used in STEP {#}",
"PC / nguồn": "PC / source",
"PC có giá {#}": "PCs with price {#}",
"PC lệch": "PCs with difference",
"PC-M và PC-P khớp theo từng PC và sản phẩm.": "PC-M and PC-P match by PC and product.",
"PC-P thiếu / sai Date → không chứng minh được thứ tự thời gian. Sửa Date trên ERP, import lại rồi chạy lại": "PC-P date missing / invalid → time order cannot be proven. Fix the date in ERP, re-import and re-run",
"Phiếu Stock Out": "Stock Out slip",
"Phát sinh dự phòng giảm giá HTK đã ghi trong kỳ": "Inventory write-down provision booked in the period",
"Phát sinh kỳ này": "This period",
"Phân bổ ACTUAL_USAGE": "ACTUAL_USAGE allocation",
"Phân bổ Stock Out": "Stock Out allocation",
"Phân bổ giá thành": "Cost allocation",
"Phân bổ giá vốn theo hoá đơn ({#})": "COGS allocation by invoice ({#})",
"Phân bổ trực tiếp {#} / {#}": "Direct allocation {#} / {#}",
"Phân hệ": "System",
"Phân loại Stock Out (NVL / FG)": "Stock Out classification (RM / FG)",
"Phải bằng {#}": "Must equal {#}",
"Pool chung = GL kỳ này − phân bổ trực tiếp. STEP {#} chia pool chung cho các lô hoàn thành.": "Common pool = GL this period − direct allocation. STEP {#} splits the common pool across completed lots.",
"Pool chung phân bổ cho lô": "Common pool allocated to lots",
"Posted PASS / sổ {#}": "Posted PASS / register {#}",
"Price Master cập nhật": "Price Master updated",
"Price Master cột Review": "Price Master column Review",
"Price Master cột Status": "Price Master column Status",
"Quy trình": "Process",
"Quy trình tháng": "Monthly process",
"Quy tắc": "Rule",
"Quy tắc phân bổ": "Allocation rules",
"Quyết định người duyệt (APPROVE / HOLD)": "Reviewer decision (APPROVE / HOLD)",
"Quản trị": "Admin",
"REVIEW - BẤT THƯỜNG": "REVIEW - ABNORMAL",
"REVIEW - THIẾU COST": "REVIEW - MISSING COST",
"RM gồm Stock Out": "RM incl. Stock Out",
"RUN STEP {#}R · Hàng bán bị trả lại": "RUN STEP {#}R · Sales returns",
"RX · T · Customer lạ – chưa phân bổ (không phát sinh)": "RX · T · Unknown customer – not allocated (none this period)",
"Ra chi phí": "Expensed",
"Refresh ERP MAP → cột Review = ERP CHANGED → đặt User ERP Override": "Refresh ERP MAP → Review column = ERP CHANGED → set User ERP Override",
"Register cột Input Check": "Register column Input Check",
"Register cột Issue Qty": "Register column Issue Qty",
"Rework ID, mã FG, tên…": "Rework ID, FG code, name…",
"Rework WIP chuyển sang (B/F)": "Rework WIP brought forward (B/F)",
"Rework hoàn thành chuyển vào (carry-in)": "Completed rework transferred in (carry-in)",
"Roll forward từ {#}": "Roll forward from {#}",
"Roll forward từ {#} (WIP + Rework B/F)": "Roll forward from {#} (WIP + Rework B/F)",
"Roll forward từ {#} (kỳ trước đã có bảng {#}), hoặc upload file chi tiết theo dòng (file \"FG month detail\" của kế toán, hoặc \"Tải template trống\").": "Roll forward from {#} (previous period already has table {#}), or upload the line-level detail file (the accountant's \"FG month detail\" file, or \"Download blank template\").",
"Roll-forward giá trị": "Value roll-forward",
"Roll-forward số lượng": "Quantity roll-forward",
"Roll-forward trước STEP {#}B": "Roll-forward before STEP {#}B",
"Run snapshot: chế độ STRICT_DATE · {#} lớp đầu kỳ · override dùng {#} · kết quả PASS WITH REVIEW": "Run snapshot: STRICT_DATE mode · {#} opening layers · overrides used {#} · result PASS WITH REVIEW",
"R{#} · Nhóm {#} VND – không phân bổ": "R{#} · Group {#} VND – not allocated",
"R{#} · O · JOB CODE = Location PC-P-O (khớp đúng)": "R{#} · O · JOB CODE = PC-P-O location (exact match)",
"R{#} · O · JOB CODE DN*/DS* → PC hệ T mã SP* (không phát sinh)": "R{#} · O · JOB CODE DN*/DS* → system-T PCs with code SP* (none this period)",
"R{#} · S · location khác → chia theo tỷ lệ đã phân bổ vào lô từ R{#}a/R{#}b/R{#}c (T + O)": "R{#} · S · other locations → split by the shares already allocated to lots by R{#}a/R{#}b/R{#}c (T + O)",
"R{#} · S · location khác → chia theo tỷ lệ đã phân bổ vào lô từ R{#}a/R{#}b/R{#}c (T + O) (không phát sinh)": "R{#} · S · other locations → split by the shares already allocated to lots by R{#}a/R{#}b/R{#}c (T + O) (none this period)",
"R{#} · T · Customer COMMON → mọi PC hệ T": "R{#} · T · Customer COMMON → all system-T PCs",
"R{#} · T · Customer DOONA → PC hệ T mã SP*": "R{#} · T · Customer DOONA → system-T PCs with code SP*",
"R{#}a · O · JOB CODE MK* (kèm SVL-MK) → PC hệ O location MK*": "R{#}a · O · JOB CODE MK* (incl. SVL-MK) → system-O PCs at location MK*",
"R{#}a · S · location DS*/DN* → PC hệ T mã SP*": "R{#}a · S · location DS*/DN* → system-T PCs with code SP*",
"R{#}b · O · JOB CODE VE* (kèm SVL-VE) → PC hệ O location VE*": "R{#}b · O · JOB CODE VE* (incl. SVL-VE) → system-O PCs at location VE*",
"R{#}b · S · location VE* → PC hệ O VE* (không phát sinh)": "R{#}b · S · location VE* → system-O PCs VE* (none this period)",
"R{#}c · O · JOB CODE còn lại → chia theo PC RM Cost mọi PC hệ O": "R{#}c · O · other JOB CODE → split by PC RM Cost across all system-O PCs",
"R{#}c · O · JOB CODE còn lại → chia theo PC RM Cost mọi PC hệ O (không phát sinh)": "R{#}c · O · other JOB CODE → split by PC RM Cost across all system-O PCs (none this period)",
"R{#}c · S · location MK* → PC hệ O MK* (không phát sinh)": "R{#}c · S · location MK* → system-O PCs MK* (none this period)",
"Rà soát và xác nhận {#} dòng dữ liệu ERP bất thường (STEP {#}) trước khi chạy STEP {#}": "Review and confirm {#} abnormal ERP data lines (STEP {#}) before running STEP {#}",
"S · location DS*/DN* → PC hệ T mã SP*": "S · location DS*/DN* → system-T PCs with code SP*",
"S · location MK* → PC hệ O MK*": "S · location MK* → system-O PCs MK*",
"S · location VE* → PC hệ O VE*": "S · location VE* → system-O PCs VE*",
"S · location khác → chia theo tỷ lệ đã phân bổ vào lô từ R{#}a/R{#}b/R{#}c (T + O)": "S · other locations → split by the shares already allocated to lots by R{#}a/R{#}b/R{#}c (T + O)",
"SL FIFO = SL bán đủ điều kiện": "FIFO qty = eligible sales qty",
"SL FIFO đã xuất": "FIFO qty issued",
"SL FIFO được": "FIFO qty obtained",
"SL bán": "Qty sold",
"SL bán (đủ điều kiện)": "Sales qty (eligible)",
"SL còn": "Qty left",
"SL cần": "Required qty",
"SL hoàn thành": "Completed qty",
"SL hoàn thành có giá": "Completed qty with price",
"SL nhập lại kho": "Qty returned to stock",
"SL sản xuất": "Qty produced",
"SL xuất": "Issued qty",
"SL ≠ {#} nhưng Total Cost = {#}": "Qty ≠ {#} but Total Cost = {#}",
"STEP {#} (sau chuyển đổi)": "STEP {#} (after migration)",
"STEP {#} + STEP {#} (sau chuyển đổi)": "STEP {#} + STEP {#} (after migration)",
"STEP {#} OUTDATED - RERUN REQUIRED – STEP {#} = RERUN REQUIRED. Chạy lại theo thứ tự (STEP {#} nếu cần) → RUN FIFO COGS → BUILD FG HISTORY.": "STEP {#} OUTDATED - RERUN REQUIRED – STEP {#} = RERUN REQUIRED. Re-run in order (STEP {#} if needed) → RUN FIFO COGS → BUILD FG HISTORY.",
"STEP {#} OUTDATED: STEP {#} OUTDATED - RERUN REQUIRED – STEP {#} = RERUN REQUIRED. Chạy lại theo thứ tự STEP {#} → RUN FIFO → BUILD FG HISTORY.": "STEP {#} OUTDATED: STEP {#} OUTDATED - RERUN REQUIRED – STEP {#} = RERUN REQUIRED. Re-run in order STEP {#} → RUN FIFO → BUILD FG HISTORY.",
"STEP {#} chỉ chạy được khi mọi phần có bất thường đã được xác nhận.": "STEP {#} can only run once every part with anomalies has been confirmed.",
"STEP {#} chỉ tính hệ T và O": "STEP {#} only costs systems T and O",
"STEP {#} cuối kỳ gồm cả lớp hàng trả lại / rework nhập lại (nếu có)": "STEP {#} closing includes returned / rework-returned layers (if any)",
"STEP {#} nhận = ENGINE posted": "STEP {#} receives = ENGINE posted",
"STEP {#} · Chuyển rework ({#}B)": "STEP {#} · Transfer to rework ({#}B)",
"STEP {#} · Doanh thu bán hàng & Price Master": "STEP {#} · Sales revenue & Price Master",
"STEP {#} · Dòng FG History": "STEP {#} · FG History lines",
"STEP {#} · FG History & đóng kỳ": "STEP {#} · FG History & month close",
"STEP {#} · FG cuối kỳ": "STEP {#} · Closing FG",
"STEP {#} · FG đầu kỳ": "STEP {#} · Opening FG",
"STEP {#} · FG đầu kỳ theo lô": "STEP {#} · Opening FG by lot",
"STEP {#} · FIFO giá vốn & FIFO rework": "STEP {#} · FIFO COGS & FIFO rework",
"STEP {#} · FX, GL {#} / {#} & phân bổ trực tiếp": "STEP {#} · FX, GL {#} / {#} & direct allocation",
"STEP {#} · Giá vốn FIFO": "STEP {#} · FIFO COGS",
"STEP {#} · Import dữ liệu ERP": "STEP {#} · ERP data import",
"STEP {#} · Lô bất thường đơn giá": "STEP {#} · Lots with abnormal unit cost",
"STEP {#} · Phân bổ Stock Out vào lô PC": "STEP {#} · Stock Out allocation to PC lots",
"STEP {#} · Phân bổ giá thành": "STEP {#} · Cost allocation",
"STEP {#} · Stock Out nguồn (TOTAL)": "STEP {#} · Source Stock Out (TOTAL)",
"STEP {#} · Số dòng chi tiết": "STEP {#} · Detail rows",
"STEP {#} · Số lô": "STEP {#} · Lots",
"STEP {#} · Số lớp FG cuối kỳ": "STEP {#} · Closing FG layers",
"STEP {#} · Số vật tư": "STEP {#} · Materials",
"STEP {#} · Thành phẩm sản xuất & tồn kho chi tiết {#}": "STEP {#} · FG production & stock detail {#}",
"STEP {#} · Tổng RM": "STEP {#} · Total RM",
"STEP {#} · Tổng giá thành SX": "STEP {#} · Total production cost",
"STEP {#} · WIP vào": "STEP {#} · WIP in",
"STEP {#} · {#} đã phân bổ": "STEP {#} · {#} allocated",
"STEP {#} · Đã phân bổ": "STEP {#} · Allocated",
"STEP {#}B + STEP {#} (sau chuyển đổi)": "STEP {#}B + STEP {#} (after migration)",
"STEP {#}B không định giá được vật tư có SL nhưng Total Cost = {#} (ví dụ hàng khách cấp, hàng chưa có giá). Rà soát với ERP / kho: sửa và import lại, hoặc xác nhận là đúng thực tế.": "STEP {#}B cannot value materials with a quantity but Total Cost = {#} (e.g. customer-supplied goods, goods not yet priced). Check with ERP / warehouse: fix and re-import, or confirm it is correct.",
"STEP {#}B · Closing WIP cuối (sau điều chỉnh)": "STEP {#}B · Final closing WIP (after adjustment)",
"STEP {#}B · Sổ FG Stock Out / Rework": "STEP {#}B · FG Stock Out / Rework register",
"STEP {#}B · Điều chỉnh WIP trực tiếp": "STEP {#}B · Direct WIP adjustment",
"STEP {#}B · Điều chỉnh vào PC": "STEP {#}B · Adjustment into PC",
"STEP {#}R · Hàng bán bị trả lại & giảm giá": "STEP {#}R · Sales returns & discounts",
"STEP {#}R · Hàng bán bị trả lại (chạy riêng) đã match & reverse COGS": "STEP {#}R · Sales returns (run separately) matched & COGS reversed",
"STOCK OUT ALLOCATION – dòng TOTAL (Consumption = tiêu hao NVL → {#})": "STOCK OUT ALLOCATION – TOTAL row (Consumption = RM consumed → {#})",
"STRICT_DATE: bán hàng và rework chạy chung theo ngày ({#} trường hợp đã xử lý)": "STRICT_DATE: sales and rework run together by date ({#} cases handled)",
"STRICT_DATE: lớp sản xuất không có ngày hoàn thành (không được dùng)": "STRICT_DATE: production layers without a completion date (not used)",
"Sales Database (dữ liệu cũ) còn": "Sales Database (legacy data) still has",
"Share phải bằng {#}%": "Share must be {#}%",
"Snapshot lần chạy STEP {#}": "Snapshot of the STEP {#} run",
"Stock Out NVL được phân bổ vào các lô PC-P theo quy tắc khách hàng / job code / location. Stock Out thành phẩm (FG) không phải NVL — được tách sang sổ Rework ({#}B).": "RM Stock Out is allocated to PC-P lots by customer / job code / location rules. Finished-goods (FG) Stock Out is not RM — it is moved to the Rework register ({#}B).",
"Stock Out chưa phân bổ": "Unallocated Stock Out",
"Stock Out khớp STEP {#}": "Stock Out matches STEP {#}",
"Stock Out nguồn": "Source Stock Out",
"Stock Out phân bổ theo quy tắc dự phòng rộng": "Stock Out allocated by broad fallback rules",
"Stock Out từ O": "Stock Out from O",
"Stock Out từ S": "Stock Out from S",
"Stock Out từ T": "Stock Out from T",
"Sản phẩm": "Product",
"Sản phẩm có giá": "Products with price",
"Sản phẩm thiếu FG": "Products short of FG",
"Sản phẩm thiếu giá": "Products missing price",
"Sắp xếp": "Sort",
"Số FAST": "FAST amount",
"Số FAST TK {#}": "FAST balance account {#}",
"Số FIFO lấy từ lô không có / không đủ trong {#}": "FIFO quantities taken from lots missing / insufficient in {#}",
"Số PC (P / M)": "PCs (P / M)",
"Số dòng": "Rows",
"Số dòng DETAIL": "DETAIL rows",
"Số dòng FG": "FG lines",
"Số dòng PC": "PC lines",
"Số dư WIP vật tư đầu kỳ {#}. Quy tắc: Opening ERP = Opening giá thành (chỉ một số dư đầu kỳ). Lấy từ Closing WIP kỳ {#} hoặc import từ file.": "Opening material WIP balance {#}. Rule: Opening ERP = Opening cost (a single opening balance). Taken from the closing WIP of {#} or imported from a file.",
"Số dư rework kỳ trước": "Rework balance from the previous period",
"Số dư đầu kỳ": "Opening balance",
"Số liệu từ FAST · kỳ {#}": "FAST figures · period {#}",
"Số lô": "Lots",
"Số lô PC": "PC lots",
"Số lượng": "Quantity",
"Số lượng FG xuất": "FG qty issued",
"Số lượng hoặc Total Cost âm, hoặc ô là chữ thay vì số: phải sửa trên ERP rồi import lại. Đơn giá xuất NVL bất thường (MI-M): dòng có thành tiền ≥ {#} VND và đơn giá lệch > {#} % so với đơn giá chuẩn (trung vị đơn giá các dòng cùng vật tư, ĐVT trong kỳ); ngưỡng mặc định, không đổi theo ô ngưỡng trên màn hình. Đúng thì xác nhận; sai thì sửa ERP và import lại. Danh sách cần được xác nhận trước khi chạy STEP {#}.": "Negative quantity or Total Cost, or a text cell instead of a number: fix in ERP and re-import. Abnormal material issue price (MI-M): lines with amount ≥ {#} VND and unit cost more than {#} % away from the reference cost (median unit cost of lines with the same material and unit in the period); default threshold, not the on-screen threshold. If correct, confirm; if wrong, fix ERP and re-import. The list must be confirmed before running STEP {#}.",
"Số lượng âm / thiếu master data": "Negative quantities / missing master data",
"Số lượng: tồn đầu kỳ": "Quantity: opening stock",
"Số lớp": "Layers",
"Số sản phẩm": "Products",
"Số thực sự vào PC-P": "Amount actually posted to PC-P",
"Số tiền": "Amount",
"Số tiền (VND)": "Amount (VND)",
"Số tiền nhập liền ({#}) hoặc đủ nhóm nghìn ({#}). Tỷ giá nhập liền ({#}); “{#}” sẽ bị hỏi lại vì không rõ là {#} hay {#}.": "Enter amounts without separators ({#}) or with full thousand groups ({#}). Enter the FX rate without separators ({#}); “{#}” will be queried because it could be {#} or {#}.",
"Số tiền theo rule": "Amounts by rule",
"Số vật tư": "Materials",
"Số vật tư trong INPUT": "Materials in INPUT",
"Số đã ghi FAST (VND)": "Amount booked in FAST (VND)",
"Số đầu kỳ": "Opening figures",
"Sổ FG Rework": "FG Rework register",
"Sổ gồm FG xuất đi rework (bảng bên dưới) và FG tiêu dùng nội bộ (khối trên, có xác nhận riêng). Cập nhật loại, trạng thái và lô PC rework ở bảng; dữ liệu nhập tay được giữ khi chạy lại STEP {#}. Giá trị FIFO được tính khi chạy STEP {#} (FIFO rework). Xử lý dòng treo (hoàn thành / trả về kho / ra chi phí) ở": "The register holds FG issued to rework (table below) and FG internal consumption (block above, confirmed separately). Update type, status and rework PC lot in the table; manual entries are kept when STEP {#} is re-run. FIFO values are calculated when STEP {#} runs (FIFO rework). Pending lines (completed / returned to stock / expensed) are handled on",
"Sổ rework ↔ FIFO rework": "Rework register ↔ FIFO rework",
"Sổ rework ↔ cột AP": "Rework register ↔ column AP",
"T · Customer COMMON → mọi PC hệ T": "T · Customer COMMON → all system-T PCs",
"T · Customer DOONA → PC hệ T mã SP*": "T · Customer DOONA → system-T PCs with code SP*",
"T · Customer lạ – chưa phân bổ": "T · Unknown customer – not allocated",
"TK chi phí mặc định": "Default expense account",
"TK {#} rework cuối kỳ": "Account {#} rework at period end",
"TK {#} · {#} dòng bán đã lưu": "Account {#} · {#} sales lines saved",
"Thao tác dừng do lỗi: Cannot set properties of null (setting 'innerHTML')": "Action stopped by an error: Cannot set properties of null (setting 'innerHTML')",
"Thay đổi": "Change",
"Theo giá thành (web)": "Per costing (web)",
"Theo khoá": "By key",
"Theo nguồn giá": "By price source",
"Theo sản phẩm": "By product",
"Theo tháng SX": "By production month",
"Thiếu": "Short",
"Thiếu = SL cần − SL FIFO được. Mỗi dòng là một lần FIFO không đủ lớp FG dated trước hoặc bằng ngày của dòng bán / phiếu xuất.": "Short = required qty − FIFO qty obtained. Each line is one FIFO event without enough FG layers dated on or before the sale / issue date.",
"Thiếu khách hàng, SL×đơn giá lệch, loại OTHER… (không chặn)": "Missing customer, qty × price mismatch, type OTHER… (not blocking)",
"Thiếu tên": "Missing name",
"Thiếu ĐVT": "Missing unit",
"Thành phẩm SX lũy kế": "FG produced (cumulative)",
"Thành phẩm cuối kỳ": "Closing finished goods",
"Thành phẩm · giá vốn": "Finished goods · COGS",
"Thành tiền": "Amount",
"Thành tiền tối thiểu (VND)": "Minimum amount (VND)",
"Thêm dòng phân bổ trực tiếp": "Add direct allocation line",
"Thêm giá thủ công": "Add manual price",
"Thêm vào danh sách": "Add to list",
"Thêm vào màn hình chính": "Add to Home screen",
"Thông báo": "Notifications",
"Thấp (x median)": "Low (x median)",
"Thời điểm": "Timestamp",
"Thời điểm import": "Imported at",
"Thứ tự: STEP {#} RUN FIFO (bán hàng) →": "Order: STEP {#} RUN FIFO (sales) →",
"Thực tế": "Actual",
"Tiêu dùng nội bộ ({#} / {#})": "Internal consumption ({#} / {#})",
"Tiêu dùng nội bộ kỳ này: dòng Cost month = kỳ (CONSUME) ↔ FIFO tiêu dùng STEP {#} (Nợ {#} / Có {#})": "Internal consumption this period: lines with Cost month = period (CONSUME) ↔ consumption FIFO STEP {#} (Dr {#} / Cr {#})",
"Tiêu dùng nội bộ được tính FIFO trước giá vốn bán hàng": "Internal consumption is costed by FIFO before sales COGS",
"Tiêu hao": "Consumption",
"Tiêu hao NVL (consumption)": "RM consumption",
"Tiêu thức": "Basis",
"Total Cost (tỷ lệ R{#}a–c; dự phòng PC RM Cost)": "Total Cost (R{#}a–c shares; fallback PC RM Cost)",
"Total Cost của lô trên PC-P phải bằng tổng Total Cost vật tư của lô trên PC-M (theo PC No. và Product Code). Lệch nghĩa là hai báo cáo không được xuất cùng thời điểm hoặc có chứng từ chưa đủ.": "The Total Cost of a lot on PC-P must equal the total material cost of the lot on PC-M (by PC No. and Product Code). A difference means the two reports were not exported at the same time or documents are incomplete.",
"Toàn bộ quy tắc phân bổ, kể cả quy tắc không phát sinh trong kỳ (= {#}). Cột Ưu tiên đối chiếu với bảng \"Quy tắc phân bổ\" ({#}–{#}); R{#} = nhóm {#} VND, RX = Customer hệ T không nhận diện được (chưa phân bổ). Dự phòng = R{#}c và R{#}, được tính vào ngưỡng {#}%.": "All allocation rules, including those with nothing this period (= {#}). The Priority column matches the \"Allocation rules\" table ({#}–{#}); R{#} = {#} VND group, RX = unrecognised system-T customer (not allocated). Fallback = R{#}c and R{#}, counted against the {#}% threshold.",
"Trong khoảng NVL – giá thành": "Between RM and full cost",
"Trong kỳ": "In period",
"Trung tâm thông báo": "Notification centre",
"Truy xuất": "Trace",
"Truy xuất giá thành sản phẩm": "Product cost trace",
"Trùng – loại": "Duplicate – exclude",
"Trạng thái": "Status",
"Trạng thái FIFO": "FIFO status",
"Trạng thái Opening WIP": "Opening WIP status",
"Trạng thái engine phân bổ": "Allocation engine status",
"Trạng thái import doanh thu": "Revenue import status",
"Trả về kho": "Returned to stock",
"Trực tiếp": "Direct",
"Tuổi (tháng)": "Age (months)",
"Tách riêng khỏi doanh thu bán hàng: file riêng, dữ liệu riêng, bước chạy riêng và đối chiếu FAST riêng.": "Kept apart from sales revenue: separate file, separate data, separate run and separate FAST reconciliation.",
"Tên FG": "FG name",
"Tên sản phẩm": "Product name",
"Tên vật tư": "Material name",
"Tìm kiếm": "Search",
"Tìm trong {#} dòng…": "Search {#} rows…",
"Tính khi chạy STEP {#}": "Calculated when STEP {#} runs",
"Tính lại độc lập": "Independent recalculation",
"Tạo kỳ mới": "Create new period",
"Tạo kỳ mới…": "Create new period…",
"Tải file mẫu": "Download sample file",
"Tải file đầu kỳ cho kỳ sau": "Download opening file for next period",
"Tải lại kỳ này từ cloud": "Reload this period from cloud",
"Tải template": "Download template",
"Tải template (có hướng dẫn)": "Download template (with guide)",
"Tải template trống": "Download blank template",
"Tất cả (T, S, O)": "All (T, S, O)",
"Tất cả cầu nối STEP {#}": "All STEP {#} bridges",
"Tất cả dòng lặp là dòng thật": "All repeated lines are genuine",
"Tất cả dòng lặp là trùng – loại": "All repeated lines are duplicates – exclude",
"Tất cả rule": "All rules",
"Tất cả trạng thái": "All statuses",
"Tồn FG cuối kỳ ({#})": "Closing FG stock ({#})",
"Tồn FG cuối kỳ: {#} (dòng chưa có Cost month) ↔ STEP {#} FG cuối kỳ": "Closing FG stock: {#} (lines without a Cost month) ↔ STEP {#} closing FG",
"Tồn FG đầu kỳ ({#})": "Opening FG stock ({#})",
"Tồn FG đầu kỳ: {#} (dòng chưa có Cost month) ↔ STEP {#} FG đầu kỳ": "Opening FG stock: {#} (lines without a Cost month) ↔ STEP {#} opening FG",
"Tồn cuối SL": "Closing qty",
"Tồn cuối giá trị": "Closing value",
"Tồn kho thành phẩm ({#})": "Finished goods stock ({#})",
"Tồn kho thành phẩm theo mã (đầu kỳ / nhập / xuất bán / tồn). Cột “check vs lots” = phần chênh với tồn theo lô – khác {#} khi có FG xuất rework.": "Finished-goods stock by code (opening / receipts / sales issues / closing). The “check vs lots” column = difference with stock by lot – non-zero ({#}) when FG was issued to rework.",
"Tổng": "Total",
"Tổng PC-M": "Total PC-M",
"Tổng RM": "Total RM",
"Tổng RM (PC RM + Stock Out)": "Total RM (PC RM + Stock Out)",
"Tổng Stock Out": "Total Stock Out",
"Tổng Stock Out thô": "Total raw Stock Out",
"Tổng giá thành SX": "Total production cost",
"Tổng giá thành sản xuất": "Total production cost",
"Tổng hợp theo SP": "Summary by product",
"Tổng quan kỳ": "Period overview",
"Tổng quan kỳ {#}": "Period overview {#}",
"Tổng quan kỳ – Control Center": "Period overview – Control Center",
"Tổng thể STEP {#}": "STEP {#} overall",
"Tổng {#} + {#}": "Total {#} + {#}",
"Tổng đã phân bổ": "Total allocated",
"Tự dựng lại từ PC-M / PC-P khi BUILD": "Rebuilt from PC-M / PC-P on BUILD",
"Tỷ giá phân bổ": "Allocation FX rate",
"Tỷ giá phân bổ (VND/USD)": "Allocation FX rate (VND/USD)",
"Tỷ lệ phân bổ <> {#}% (dòng)": "Allocation share <> {#}% (rows)",
"Tỷ trọng {#} / ({#} + {#})": "Share {#} / ({#} + {#})",
"Upload file đầu kỳ (chi tiết)…": "Upload opening file (detail)…",
"VND (checkpoint {#} đếm số lô).": "VND (checkpoint {#} counts lots).",
"Vai trò": "Role",
"Validate & lưu": "Validate & save",
"Validate FG đầu kỳ": "Validate opening FG",
"Việc tiếp theo": "Next step",
"Việc tiếp theo:": "Next step:",
"Vào lô hệ O": "To system-O lots",
"Vào lô hệ S": "To system-S lots",
"Vào lô hệ T": "To system-T lots",
"Vật tư": "Material",
"Vật tư INPUT": "INPUT materials",
"Vật tư WIP âm còn lại": "Remaining negative-WIP materials",
"Vật tư WIP âm đưa vào INPUT": "Negative-WIP materials in INPUT",
"Vật tư giá trị {#} (PC-M & WIP = {#} VND) chia theo SL": "Zero-value materials {#} (PC-M & WIP = {#} VND) split by qty",
"Vật tư mới": "New materials",
"WIP Out - MR Return = RM lô PC + Stock Out phân bổ + tiêu hao {#}": "WIP Out - MR Return = PC lot RM + allocated Stock Out + consumption {#}",
"WIP cuối = Closing ERP + điều chỉnh": "Closing WIP = ERP closing + adjustment",
"WIP cuối kỳ": "Closing WIP",
"WIP cuối kỳ (vật tư sau {#}B + rework WIP)": "Closing WIP (materials after {#}B + rework WIP)",
"WIP rework cuối kỳ ({#})": "Closing rework WIP ({#})",
"WIP rework đầu kỳ (B/F)": "Opening rework WIP (B/F)",
"WIP theo vật tư": "WIP by material",
"WIP vào (MI + Stock Out)": "WIP in (MI + Stock Out)",
"WIP · sản phẩm dở dang": "WIP · work in progress",
"WIP âm": "Negative WIP",
"WIP điều chỉnh đã post": "WIP adjustment posted",
"WIP đầu kỳ + B/F + MI + Stock Out + {#} + {#} + FG đi rework − MR − nhập kho − WIP cuối (sau {#}B) − rework WIP cuối": "Opening WIP + B/F + MI + Stock Out + {#} + {#} + FG to rework − MR − receipts − closing WIP (after {#}B) − closing rework WIP",
"WIP_ALLOCATION = vế WIP CONTROL": "WIP_ALLOCATION = CONTROL WIP side",
"WIP_OPENING = opening của Material WIP": "WIP_OPENING = Material WIP opening",
"Xem nhật ký cloud (không sửa / xoá được)": "View cloud audit log (cannot be edited / deleted)",
"Xoá Opening WIP": "Clear Opening WIP",
"Xoá dữ liệu ERP…": "Clear ERP data…",
"Xoá dữ liệu trên máy này…": "Clear data on this device…",
"Xoá kỳ…": "Delete period…",
"Xuất Excel": "Export Excel",
"Xuất Excel báo cáo": "Export Excel report",
"Xuất Excel tổng hợp phân bổ": "Export allocation summary to Excel",
"Xuất NVL vào WIP – MI": "Materials issued to WIP – MI",
"Xuất NVL vào WIP – Stock Out (không gồm tiêu hao)": "Materials issued to WIP – Stock Out (excl. consumption)",
"Xuất NVL vào sản xuất": "Materials issued to production",
"Xuất kết quả kỳ ra Excel": "Export period results to Excel",
"Xuất rework kỳ này: dòng Cost month = kỳ (rework) ↔ Rework FIFO STEP {#}": "Rework issues this period: lines with Cost month = period (rework) ↔ Rework FIFO STEP {#}",
"Xác nhận": "Confirm",
"Xác nhận phần B": "Confirm part B",
"Xác nhận phần C": "Confirm part C",
"Xác nhận tiêu dùng nội bộ": "Confirm internal consumption",
"Xác nhận từng phần trong thẻ bên dưới; có thể xóa xác nhận của từng phần để làm lại.": "Confirm each part in the cards below; a part's confirmation can be cleared to redo it.",
"Xác nhận ở {#} → Nghi trùng": "Confirm in {#} → Suspected duplicates",
"Xử lý": "Handling",
"Xử lý Rework": "Rework handling",
"Xử lý SL": "Qty handling",
"Xử lý các checkpoint STEP {#} rồi chạy lại STEP {#}": "Clear the STEP {#} checkpoints, then re-run STEP {#}",
"Xử lý cổng đóng kỳ ({#}_RECONCILIATION dòng {#})": "Clear the month-close gate ({#}_RECONCILIATION row {#})",
"Xử lý giá vốn (RUN {#}R)": "COGS processing (RUN {#}R)",
"chưa từng đóng": "never closed",
"chạy lại STEP {#}": "re-run STEP {#}",
"các bước khác. Quy tắc: tổng dòng chưa có Cost month của {#} = FG đầu kỳ (STEP {#}) và = FG cuối kỳ sau FIFO (STEP {#}). Kết quả:": "other steps. Rule: total of lines without a Cost month in {#} = opening FG (STEP {#}) and = closing FG after FIFO (STEP {#}). Result:",
"dòng SALES RETURN / CREDIT NOTE. Chúng đang được đọc như file trả lại riêng và sẽ tự chuyển sang màn hình {#}R ở lần Validate & Save tiếp theo.": "SALES RETURN / CREDIT NOTE lines. They are read as a separate returns file and will move to screen {#}R at the next Validate & Save.",
"dòng doanh thu nghi trùng trong kỳ chưa xác nhận – đang được tính FIFO như dòng thật (giống Excel).": "suspected duplicate revenue lines in the period not yet confirmed – they are costed by FIFO as genuine lines (same as Excel).",
"dòng lặp chưa xác nhận →": "repeated lines not yet confirmed →",
"dòng trả lại / giảm giá từ Sales Database cũ (trước v{#}). Lần Validate & Save tiếp theo (ở đây hoặc {#}) sẽ chuyển hẳn chúng sang dữ liệu trả lại riêng.": "return / discount lines from the old Sales Database (before v{#}). The next Validate & Save (here or {#}) moves them to the separate returns data.",
"giá FIFO của lô": "FIFO cost of the lot",
"giá trị bán = SL hoàn thành × giá": "sales value = completed qty × price",
"hoặc": "or",
"không chặn": "does not block",
"không có": "none",
"không có Cost month là còn tồn": "without a Cost month are still in stock",
"không phân bổ vào lô PC-P; số tiền ghi thẳng": "are not allocated to PC-P lots; the amount is posted directly",
"không tính vào giá thành sản phẩm nào và không vào giá vốn": "not included in any product cost or in COGS",
"khỏi danh sách (dữ liệu và lịch sử vẫn giữ trên cloud, hiện lại được).": "from the list (data and history stay in the cloud and can be shown again).",
"là hồ sơ kế toán – không xoá được, chỉ": "are accounting records – they cannot be deleted, only",
"màn hình {#}B · Xử lý Rework": "screen {#}B · Rework handling",
"màn hình {#}R": "screen {#}R",
"nhóm dòng doanh thu giống hệt nhau (cùng ngày, hoá đơn, sản phẩm, số lượng, tiền – file không có Invoice Line No.). Còn": "groups of identical revenue lines (same date, invoice, product, quantity, amount – the file has no Invoice Line No.). There are",
"theo giá trị tiêu hao (PC-M Total Cost)": "by consumption value (PC-M Total Cost)",
"theo số lượng (như Excel cũ)": "by quantity (as in the old Excel)",
"tháng": "months",
"tiêu hao": "consumption",
"và Bill Date). Chỉ nhận dòng": "and Bill Date). Only lines of",
"và nằm ở": "and sits in",
"xác nhận ở tab Nghi trùng": "confirm in the Suspected duplicates tab",
"{#} % FG khả dụng": "{#} % of FG available",
"{#} / {#} báo cáo": "{#} / {#} reports",
"{#} / {#} báo cáo · Rà soát và xác nhận {#} dòng dữ liệu ERP bất thường (STEP {#}) trước khi chạy STEP {#}": "{#} / {#} reports · Review and confirm {#} abnormal ERP data lines (STEP {#}) before running STEP {#}",
"{#} / {#} báo cáo · {#} / {#} hệ": "{#} / {#} reports · {#} / {#} systems",
"{#} dòng": "{#} rows",
"{#} dòng ERP cao hơn cả giá thành đầy đủ": "{#} ERP lines above even the full cost",
"{#} dòng PC · {#}% tổng đã phân bổ": "{#} PC lines · {#}% of total allocated",
"{#} dòng kỳ này · {#} dòng B/F": "{#} lines this period · {#} B/F lines",
"{#} dòng treo": "{#} pending lines",
"{#} dòng trong sổ": "{#} lines in the register",
"{#} dòng trả lại có số lượng trong kỳ": "{#} return lines with quantity in the period",
"{#} dòng · SL {#}": "{#} lines · qty {#}",
"{#} file · {#} dòng": "{#} files · {#} rows",
"{#} lũy kế năm": "{#} year to date",
"{#} lũy kế năm (cho STEP {#})": "{#} year to date (for STEP {#})",
"{#} lớp còn tồn": "{#} layers in stock",
"{#} phân bổ": "{#} allocated",
"{#} sp xuất bán": "{#} units sold",
"{#} sản phẩm": "{#} products",
"{#} sản phẩm có sản xuất hoặc xuất bán trong kỳ. Bấm vào một dòng để xem chi tiết. Cột “Cần xem” đếm các điểm bất thường mức REVIEW (giá thành và giá vốn).": "{#} products produced or sold in the period. Click a row for detail. The “To review” column counts REVIEW-level anomalies (cost and COGS).",
"{#} sản phẩm · thiếu giá {#}": "{#} products · {#} missing price",
"{#} vật tư": "{#} materials",
"{#} vật tư · {#} vật tư bất thường · {#} vật tư thiếu cost · {#} dòng lệch · {#} dòng cost = {#}": "{#} materials · {#} abnormal materials · {#} materials missing cost · {#} deviating lines · {#} lines with cost = {#}",
"{#} · Chạy STEP {#}": "{#} · Run STEP {#}",
"{#} · Chạy STEP {#}B – Điều chỉnh WIP trực tiếp": "{#} · Run STEP {#}B – Direct WIP adjustment",
"{#} · Giảm giá hàng bán": "{#} · Sales discounts",
"{#} · HOLD – không điều chỉnh WIP. Chạy STEP {#}": "{#} · HOLD – no WIP adjustment. Run STEP {#}",
"{#} · Hàng bán bị trả lại": "{#} · Sales returns",
"{#} · Nhân công": "{#} · Labour",
"{#} · Xử lý các checkpoint STEP {#} rồi chạy lại STEP {#}": "{#} · Clear the STEP {#} checkpoints, then re-run STEP {#}",
"{#} · Xử lý cổng đóng kỳ ({#}_RECONCILIATION dòng {#})": "{#} · Clear the month-close gate ({#}_RECONCILIATION row {#})",
"{#}B · Dòng Rework bị BLOCK": "{#}B · BLOCKed rework lines",
"{#}B · FIFO + B/F = WIP rework cuối + chuyển vào": "{#}B · FIFO + B/F = closing rework WIP + transferred in",
"{#}B · Giá trị FG theo ERP (memo)": "{#}B · FG value per ERP (memo)",
"{#}B · Register cập nhật sau STEP {#}": "{#}B · Register updated after STEP {#}",
"{#}B · Rework hoàn thành = chuyển vào STEP {#}": "{#}B · Completed rework = transferred into STEP {#}",
"{#}B · Rework treo từ {#} tháng trở lên": "{#}B · Rework pending {#} months or more",
"{#}B · SL rework = SL chuyển FIFO": "{#}B · Rework qty = FIFO transfer qty",
"{#}B · Số dòng FG Stock Out (Rework)": "{#}B · FG Stock Out lines (Rework)",
"{#}B · Số lượng FG xuất (nguồn Rework)": "{#}B · FG qty issued (Rework source)",
"{#}B · Xung đột thứ tự thời gian": "{#}B · Time-order conflicts",
"{#}B · Xử lý Rework": "{#}B · Rework handling",
"{#}_FG_CLOSING phải là kỳ hiện tại": "{#}_FG_CLOSING must be the current period",
"{#}_FG_OPENING nạp & validate": "{#}_FG_OPENING loaded & validated",
"{#}_RECONCILIATION dòng {#}": "{#}_RECONCILIATION row {#}",
"{#}_WIP_ALLOCATION cột Direct Adj Amount": "{#}_WIP_ALLOCATION column Direct Adj Amount",
"|Ảnh hưởng| tối thiểu (VND)": "Minimum |impact| (VND)",
"· Chạy STEP {#} – kết quả tự chuyển vào bảng": "· Run STEP {#} – results move into the table automatically",
"· nhập kho kỳ này": "· received this period",
"· tồn cuối kỳ": "· closing stock",
"· vai trò": "· role",
"· xuất trong kỳ": "· issued this period",
"· Ảnh hưởng tuyệt đối {#} VND · còn trong FG cuối kỳ {#} VND · {#} {#}": "· Absolute impact {#} VND · still in closing FG {#} VND · {#} {#}",
"ĐVT": "Unit",
"Đang hiện {#} dòng": "Showing {#} lines",
"Đang treo": "Pending",
"Đang treo ({#})": "Pending ({#})",
"Đang xử lý…": "Processing…",
"Đang đọc": "Reading",
"Đang ở {#}": "Currently in {#}",
"Điều chỉnh PC-P theo PC-M": "Adjust PC-P to PC-M",
"Điều chỉnh STEP {#}B vào giá thành": "STEP {#}B adjustment into cost",
"Điều chỉnh WIP": "WIP adjustment",
"Điều chỉnh WIP trực tiếp": "Direct WIP adjustment",
"Điều chỉnh phải làm giảm |WIP ERP|": "Adjustment must reduce |ERP WIP|",
"Điều kiện nguồn": "Source condition",
"Điều kiện trước FIFO": "Pre-condition for FIFO",
"Đánh giá": "Assessment",
"Đã APPROVE nhưng chưa APPLY": "APPROVED but not yet APPLIED",
"Đã bán các kỳ trước": "Sold in earlier periods",
"Đã ghi {#} / {#} (STEP {#} gần nhất)": "Booked {#} / {#} (latest STEP {#})",
"Đã phân bổ GL {#}": "GL {#} allocated",
"Đã phân bổ vào lô PC của hệ": "Allocated to PC lots of system",
"Đã tick – dòng · SL –": "Ticked – lines · qty –",
"Đã xác nhận (dòng)": "Confirmed (lines)",
"Đã xử lý ({#})": "Handled ({#})",
"Đã đồng bộ cloud": "Synced to cloud",
"Đích": "Target",
"Đăng nhập:": "Signed in:",
"Đăng xuất": "Sign out",
"Đơn giá = Total Cost ÷ SL xuất (dòng SL > {#}). Đơn giá BQ = tổng cost ÷ tổng SL của các dòng có cost. Đơn giá chuẩn = trung vị các đơn giá dòng. Bất thường: dòng có thành tiền ≥ {#} VND lệch > {#}% so với đơn giá chuẩn. Thiếu cost: dòng SL > {#} nhưng Total Cost = {#} (không tính vào BQ). Ngưỡng chỉ ảnh hưởng bảng này, không ảnh hưởng tính giá thành.": "Unit cost = Total Cost ÷ issued qty (lines with qty > {#}). Average cost = total cost ÷ total qty of lines with cost. Reference cost = median of line unit costs. Abnormal: lines with amount ≥ {#} VND deviating > {#}% from the reference cost. Missing cost: lines with qty > {#} but Total Cost = {#} (excluded from the average). The thresholds only affect this table, not the costing.",
"Đơn giá BQ": "Average unit cost",
"Đơn giá ERP": "ERP unit price",
"Đơn giá ERP = ERP Amount / SL trên phiếu Stock Out (chỉ NVL). So với lô FIFO thực tế lấy ra:": "ERP unit price = ERP Amount / qty on the Stock Out slip (RM only). Compared with the actual FIFO lot taken:",
"Đơn giá RM cuối của từng lô so với trung vị cùng sản phẩm (lô kỳ này; thêm lớp FG đầu kỳ nếu ít hơn số mẫu tối thiểu). Chỉ để review, không chặn STEP {#}.": "Final RM unit cost of each lot vs the median of the same product (lots this period; opening FG layers added when fewer than the minimum sample). Review only, does not block STEP {#}.",
"Đơn giá cao nhất": "Highest unit cost",
"Đơn giá chuẩn": "Reference unit cost",
"Đơn giá dòng": "Line unit cost",
"Đơn giá thấp nhất": "Lowest unit cost",
"Đơn giá xuất NVL bất thường (MI-M) · {#} dòng": "Abnormal material issue price (MI-M) · {#} lines",
"Đơn giá xuất NVL trong kỳ (MI-M)": "Material issue unit cost this period (MI-M)",
"Đầu kỳ": "Opening",
"Đầu kỳ (B/F)": "Opening (B/F)",
"Đầu kỳ + SX − COGS − Rework − Cuối kỳ": "Opening + Production − COGS − Rework − Closing",
"Đầu kỳ + nhập kho − COGS − xuất rework + rework trả về kho − cuối kỳ": "Opening + receipts − COGS − rework issues + rework returned to stock − closing",
"Đặt tất cả = HOLD": "Set all = HOLD",
"Đặt tất cả dòng PASS = APPROVE": "Set all PASS lines = APPROVE",
"Đọc từ Sales Database cũ · {#} dòng (mọi kỳ). Dữ liệu được mang sang kỳ sau. Dòng SALES RETURN chỉ có tiền (không SL) vẫn vào TK {#}; nếu FAST hạch toán là giảm giá thì sửa Transaction Type thành CREDIT NOTE ở file nguồn.": "Read from the old Sales Database · {#} lines (all periods). The data carries forward. Amount-only SALES RETURN lines (no qty) still go to account {#}; if FAST books them as discounts, change the Transaction Type to CREDIT NOTE in the source file.",
"Đọc {#} sheet ERP, WIP_OPENING và sổ {#}_FG_REWORK_INPUT (giữ dữ liệu nhập tay) từ file Excel, rồi chạy lại STEP {#}–{#}A trên web và đối chiếu với kết quả trong file.": "Reads {#} ERP sheets, WIP_OPENING and the {#}_FG_REWORK_INPUT register (keeps manual entries) from the Excel file, then re-runs STEP {#}–{#}A on the web and compares with the results in the file.",
"Đối chiếu": "Reconciliation",
"Đối chiếu FAST {#} / {#} / {#} / {#} / {#} / {#} / {#}": "FAST reconciliation {#} / {#} / {#} / {#} / {#} / {#} / {#}",
"Đối chiếu FAST · chưa nhập": "FAST reconciliation · not entered",
"Đối chiếu Web ↔ Excel": "Web ↔ Excel reconciliation",
"Đối chiếu YTD {#} / {#} (chỉ review)": "YTD reconciliation {#} / {#} (review only)",
"Đối chiếu dòng {#}": "Reconciliation row {#}",
"Đối chiếu engine": "Engine reconciliation",
"Đối chiếu theo hệ nguồn": "Reconciliation by source system",
"Đối chiếu {#} ↔ STEP {#} có chênh lệch": "Reconciliation {#} ↔ STEP {#} shows differences",
"Đối chiếu {#} ↔ {#} / {#}": "Reconciliation {#} ↔ {#} / {#}",
"Đối chiếu {#} ↔ {#} / {#} ⚠": "Reconciliation {#} ↔ {#} / {#} ⚠",
"Đối chiếu độc lập PC-M ↔ PC-P": "Independent reconciliation PC-M ↔ PC-P",
"Đối chiếu độc lập với STEP {#}": "Independent reconciliation with STEP {#}",
"Đồng bộ INPUT với WIP âm": "Sync INPUT with negative WIP",
"Đồng bộ cloud": "Cloud sync",
"Đổi giao diện sáng/tối": "Toggle light/dark theme",
"đã từng đóng": "that were ever closed",
"được hệ thống ghi từ tài khoản đăng nhập; người sửa dòng giá không được tự phê duyệt dòng đó. Mọi chỉnh sửa làm mất hiệu lực phê duyệt cũ.": "are recorded by the system from the signed-in account; whoever edits a price line cannot approve it. Any edit invalidates the earlier approval.",
"để tính giá theo ngày xuất.": "to cost them by issue date.",
"để áp dụng.": "to apply it.",
"Ưu tiên": "Priority",
"Ẩn kỳ": "Hide period",
"Ứng dụng cần bật JavaScript.": "This app needs JavaScript enabled.",
"– chỉ chuyển sang kỳ sau. Mỗi dòng kết thúc bằng một hướng xử lý: hoàn thành → vào lô mới (STEP {#}), trả về kho nguyên trạng, hoặc ra chi phí.": "– it only carries forward. Each line ends with one outcome: completed → new lot (STEP {#}), returned to stock unchanged, or expensed.",
"– tổng của chúng = FG đầu kỳ / cuối kỳ. Số đầu kỳ: upload file chi tiết hoặc roll forward từ kỳ trước. Kỳ này: lô từ STEP {#} thêm vào, số đã bán / xuất rework theo FIFO (STEP {#}) tự tách dòng với Cost month {#}.": "– their total = opening / closing FG. Opening figures: upload the detail file or roll forward from the previous period. This period: lots from STEP {#} are added, quantities sold / issued to rework by FIFO (STEP {#}) are split into lines with Cost month {#}.",
"— Rà soát và xác nhận {#} dòng dữ liệu ERP bất thường (STEP {#}) trước khi chạy STEP {#}": "— Review and confirm {#} abnormal ERP data lines (STEP {#}) before running STEP {#}",
"— chưa xác nhận —": "— not confirmed —",
"− Hoàn thành → lô mới": "− Completed → new lot",
"− Ra chi phí": "− Expensed",
"− Trả về kho": "− Returned to stock",
"✓ khớp đầu kỳ + vào − ra": "✓ matches opening + in − out"
};

// v1.14.59: toast / dialog messages. MSG_EXACT: whole message; MSG_PREFIX: 'prefix: <detail>'; MSG_WILD: text pieces around ${…} values, joined by {*}.
export const MSG_EXACT = {
"Bảng tổng hợp đã khớp STEP 4.3 và FIFO.": "The summary table matches STEP 4.3 and FIFO.",
"CONTROL cũ hơn STEP 3. Chạy 1 BUILD / REFRESH trước.": "CONTROL is older than STEP 3. Run 1 BUILD / REFRESH first.",
"Chưa BUILD.": "Not BUILT yet.",
"Chưa chạy FIFO COGS.": "FIFO COGS has not been run.",
"Chưa chạy STEP 2.": "STEP 2 has not been run.",
"Chưa có kết quả STEP 4.": "No STEP 4 result yet.",
"Chưa có kết quả STEP 4.3 (Phân bổ giá thành).": "No STEP 4.3 result yet (Cost allocation).",
"Chưa có kết quả để xuất.": "No results to export yet.",
"Chưa có yêu cầu duyệt khớp với đơn giá hiện tại. Bấm Lưu để gửi lại.": "No approval request matches the current unit cost. Click Save to send it again.",
"Chưa tick dòng nào để xác nhận.": "No lines ticked to confirm.",
"Chưa đồng bộ được sau nhiều lần thử. Bấm Đồng bộ khi có mạng.": "Could not sync after several attempts. Click Sync when online.",
"Chạy STEP 5.2 · RUN FIFO COGS (bán hàng) trước, rồi mới chạy STEP 5R.": "Run STEP 5.2 · RUN FIFO COGS (sales) first, then STEP 5R.",
"Chỉ quản trị viên được CLOSE MONTH. Người lập chuẩn bị số liệu; quản trị viên kiểm tra và đóng kỳ.": "Only administrators can CLOSE MONTH. The preparer prepares the figures; an administrator reviews and closes the period.",
"Chỉ quản trị viên được mở lại kỳ đã đóng.": "Only administrators can reopen a closed period.",
"Chỉ quản trị viên được xoá kỳ.": "Only administrators can delete periods.",
"Chỉ quản trị viên được ẩn / hiện kỳ.": "Only administrators can hide / show periods.",
"Chọn quyết định NRV.": "Choose an NRV decision.",
"Cloud đang ở trạng thái OPEN nhưng dữ liệu trên máy vẫn CLOSED. Hãy Pull cloud để đồng bộ thay vì tạo thêm revision REOPEN.": "The cloud is OPEN but the data on this device is still CLOSED. Pull from the cloud to sync instead of creating another REOPEN revision.",
"Cloud đã có bản mới. Hãy bấm “Kiểm tra & tải bản Cloud” trước khi chỉnh sửa / chạy Step.": "The cloud has a newer version. Click “Check & load Cloud version” before editing / running a step.",
"Cloud đã ghi kỳ này là CLOSED nhưng dữ liệu trên máy đang OPEN. Hãy Pull cloud / mở lại kỳ từ trạng thái cloud thay vì CLOSE thêm lần nữa.": "The cloud has this period as CLOSED but the data on this device is OPEN. Pull from the cloud / reopen from the cloud state instead of closing again.",
"Cần giải trình ít nhất 5 ký tự.": "An explanation of at least 5 characters is required.",
"Cần lý do review ít nhất 5 ký tự.": "A review reason of at least 5 characters is required.",
"Cần lý do điều chỉnh ít nhất 5 ký tự.": "An adjustment reason of at least 5 characters is required.",
"Dòng này không có thêm số liệu chi tiết.": "This line has no further detail.",
"Dữ liệu đã lên Cloud, nhưng chức năng chuông đang chờ cập nhật Firestore Rules. Đề nghị Admin kiểm tra việc publish rules.": "Data is in the Cloud, but the bell is waiting for a Firestore Rules update. Please ask an Admin to check the rules publish.",
"Email không hợp lệ.": "Invalid email.",
"FG đầu kỳ đã có dữ liệu. Thay bằng file mới?": "Opening FG already has data. Replace with the new file?",
"FIFO rework đã tính, nhưng giá trị rework hoàn thành chuyển vào STEP 4 vừa thay đổi → giá thành STEP 4 đổi. Chạy RUN FIFO COGS thêm một lần nữa.": "FIFO rework calculated, but the completed rework value moved into STEP 4 has just changed → STEP 4 cost changed. Run RUN FIFO COGS once more.",
"Ghi chú cần ít nhất 5 ký tự.": "The note needs at least 5 characters.",
"Hoàn tác điều chỉnh PC-P về số liệu ERP gốc?": "Undo the PC-P adjustment back to the original ERP figures?",
"Không chuyển số dư.": "No balance carried forward.",
"Không có dòng APPROVE. STEP 3B sẽ đóng kỳ với KHÔNG điều chỉnh WIP (WIP âm giữ lại để review, không post gì vào PC-P / STEP 4 / 632). Lý do (bắt buộc):": "No APPROVE lines. STEP 3B will close the period with NO WIP adjustment (negative WIP kept for review, nothing posted to PC-P / STEP 4 / 632).\nReason (required):",
"Không có dòng nào cần đổi trong danh sách đang hiện.": "No lines to change in the current list.",
"Kỳ có FG rework → tự chuyển FIFO sang STRICT_DATE (bán hàng và rework chạy chung theo ngày).": "The period has FG rework → FIFO switched to STRICT_DATE automatically (sales and rework run together by date).",
"Kỳ mới (YYYY-MM):": "New period (YYYY-MM):",
"Kỳ này không có hàng bán bị trả lại có số lượng – không có giá vốn cần xử lý. Giảm trừ chỉ có tiền (5212 / 5213) được đối chiếu FAST ở STEP 5.3.": "No sales returns with quantity this period – no COGS to process. Amount-only deductions (5212 / 5213) are reconciled with FAST in STEP 5.3.",
"Kỳ phải có dạng YYYY-MM.": "The period must be in the form YYYY-MM.",
"Lý do quá ngắn (ít nhất 3 ký tự).": "Reason too short (at least 3 characters).",
"Mất kết nối mạng – xem được dữ liệu trên máy, thay đổi sẽ đồng bộ khi có mạng.": "Offline – data on this device can be viewed; changes sync when back online.",
"NRV RECORDED cần Accounting Reference / Journal No.": "NRV RECORDED needs an Accounting Reference / Journal No.",
"Ngưỡng lệch phải > 0 và thành tiền tối thiểu ≥ 0.": "The deviation threshold must be > 0 and the minimum amount ≥ 0.",
"Nhập PC rework (lô thành phẩm sau rework).": "Enter the rework PC (finished lot after rework).",
"Nhập SL hoàn thành.": "Enter the completed quantity.",
"Nhập ghi chú / căn cứ.": "Enter a note / basis.",
"Nhập giải trình NRV ít nhất 5 ký tự.": "Enter an NRV explanation of at least 5 characters.",
"Nhập giải trình chênh lệch (ít nhất 5 ký tự).": "Enter an explanation for the difference (at least 5 characters).",
"Nhập hoá đơn gốc hoặc đơn giá vốn.": "Enter the original invoice or the unit cost.",
"Nhập lý do (ít nhất 5 ký tự) trước khi xác nhận.": "Enter a reason (at least 5 characters) before confirming.",
"Nhập lý do / bằng chứng phê duyệt Direct 622/627:": "Enter the reason / evidence for approving Direct 622/627:",
"Nhập lý do / bằng chứng phê duyệt Manual Price (bắt buộc):": "Enter the reason / evidence for approving the Manual Price (required):",
"Nhập lý do / căn cứ (ít nhất 5 ký tự).": "Enter a reason / basis (at least 5 characters).",
"STEP 3A không có vật tư WIP âm (CHECK NEGATIVE) – kỳ này không cần BUILD / APPLY STEP 3B. Chuyển sang STEP 4.": "STEP 3A has no negative-WIP materials (CHECK NEGATIVE) – no STEP 3B BUILD / APPLY needed this period. Go to STEP 4.",
"STOPPED: INPUT hoặc ERP map đã thay đổi sau lần BUILD mà người duyệt đã xem. Chạy 1 · BUILD / REFRESH rồi duyệt lại.": "STOPPED: INPUT or the ERP map changed after the BUILD the reviewer saw. Run 1 · BUILD / REFRESH and review again.",
"Tháng 1: dùng file chi tiết theo dòng (mẫu cũ theo lô không dùng cho tháng 1).": "January: use the line-level detail file (the old lot-level template is not used for January).",
"Tài khoản chỉ có quyền xem.": "This account has view-only access.",
"Xoá chính bạn khỏi danh sách? Bạn sẽ mất quyền truy cập sau khi lưu.": "Remove yourself from the list? You will lose access after saving.",
"Đang có cả hoá đơn gốc và đơn giá: hệ thống dùng hoá đơn gốc, đơn giá bị bỏ qua. Xoá hoá đơn gốc nếu muốn dùng đơn giá nhập tay.": "Both an original invoice and a unit cost are entered: the original invoice is used and the unit cost is ignored. Clear the original invoice to use the manual unit cost.",
"Đang ghi revision MỞ LẠI KỲ lên cloud…": "Writing the REOPEN revision to the cloud…",
"Đang ghi trạng thái ĐÓNG KỲ lên cloud…": "Writing the CLOSED state to the cloud…",
"Đã cài SVL Costing lên thiết bị.": "SVL Costing installed on this device.",
"Đã có mạng trở lại.": "Back online.",
"Đã duyệt. Bấm RUN STEP 5R để áp dụng.": "Approved. Click RUN STEP 5R to apply.",
"Đã hoàn tác. Chạy lại STEP 2 và STEP 3.": "Undone. Re-run STEP 2 and STEP 3.",
"Đã huỷ cài đặt.": "Installation cancelled.",
"Đã huỷ – không thay đổi gì.": "Cancelled – nothing changed.",
"Đã lưu FX / GL.": "FX / GL saved.",
"Đã lưu danh sách người dùng.": "User list saved.",
"Đã lưu. Bấm RUN STEP 5R để áp dụng.": "Saved. Click RUN STEP 5R to apply.",
"Đã tải lại kỳ từ Cloud.": "Period reloaded from the Cloud.",
"Đã xoá dữ liệu trên máy này.": "Data on this device cleared."
};
export const MSG_PREFIX = [
[
"Lỗi lưu trên máy:",
"Error saving on this device:"
],
[
"Xung đột cloud:",
"Cloud conflict:"
],
[
"Chưa lưu được lên cloud:",
"Not yet saved to the cloud:"
],
[
"Không đọc được cloud:",
"Cannot read the cloud:"
],
[
"STEP 2 dừng:",
"STEP 2 stopped:"
],
[
"Import Opening WIP lỗi:",
"Opening WIP import error:"
],
[
"STEP 3 dừng:",
"STEP 3 stopped:"
],
[
"Không đọc được nhật ký cloud:",
"Cannot read the cloud audit log:"
],
[
"Không lưu được:",
"Could not save:"
],
[
"Chuyển đổi lỗi:",
"Migration error:"
],
[
"Không tải được Cloud:",
"Could not load from the Cloud:"
],
[
"Đăng nhập lỗi:",
"Sign-in error:"
],
[
"Không điều chỉnh được:",
"Could not adjust:"
],
[
"Không hoàn tác được:",
"Could not undo:"
],
[
"STEP 3B BUILD dừng:",
"STEP 3B BUILD stopped:"
],
[
"STEP 3B APPLY dừng:",
"STEP 3B APPLY stopped:"
],
[
"Không xoá được trên cloud (dữ liệu trên máy giữ nguyên):",
"Could not delete in the cloud (data on this device kept):"
],
[
"Thao tác dừng do lỗi:",
"Action stopped by an error:"
],
[
"Chưa đồng bộ trạng thái đã đọc:",
"Read state not synced:"
],
[
"Chưa đánh dấu được thông báo:",
"Could not mark the notification:"
],
[
"Upload file đầu kỳ lỗi:",
"Opening file upload error:"
],
[
"Import FG đầu kỳ lỗi:",
"Opening FG import error:"
],
[
"Import hàng trả lại lỗi:",
"Returns import error:"
],
[
"Validate & Save hàng trả lại lỗi:",
"Returns Validate & Save error:"
],
[
"Không duyệt được:",
"Could not approve:"
],
[
"Không xoá được:",
"Could not delete:"
],
[
"FG Rework FIFO không chạy:",
"FG Rework FIFO did not run:"
],
[
"STEP 5 dừng:",
"STEP 5 stopped:"
],
[
"BUILD FG HISTORY lỗi:",
"BUILD FG HISTORY error:"
],
[
"CLOSE MONTH bị chặn:",
"CLOSE MONTH blocked:"
],
[
"Import doanh thu lỗi:",
"Revenue import error:"
],
[
"Import SO lỗi:",
"SO import error:"
],
[
"Validate & Save lỗi:",
"Validate & Save error:"
],
[
"Update Price Master lỗi:",
"Update Price Master error:"
],
[
"STEP 4 bị chặn:",
"STEP 4 blocked:"
],
[
"STEP 4 dừng:",
"STEP 4 stopped:"
]
];
export const MSG_WILD = [
{
"vi": [
"Kỳ ",
" có thay đổi trên Cloud (rev #",
")",
". Hãy tải phiên bản mới trước khi thao tác."
],
"en": "Period {*} changed in the Cloud (rev #{*}){*}. Load the new version before continuing.",
"prefix": false
},
{
"vi": [
"Kỳ ",
" đã đóng – thay đổi KHÔNG được lưu. Quản trị viên mở lại kỳ ở màn hình 5.3 nếu cần sửa."
],
"en": "Period {*} is closed – changes are NOT saved. An administrator can reopen the period on screen 5.3 if a fix is needed.",
"prefix": false
},
{
"vi": [
"Kỳ ",
" CHƯA lên được cloud: ",
" OK = chuyển sang kỳ ",
"; thay đổi của kỳ ",
" vẫn được giữ trên máy và đẩy lên khi mở lại kỳ này. Huỷ = ở lại kỳ ",
"."
],
"en": "Period {*} is NOT in the cloud yet: {*}\n\nOK = switch to period {*}; changes to period {*} stay on this device and are pushed when you reopen it.\nCancel = stay in period {*}.",
"prefix": false
},
{
"vi": [
"Kỳ ",
" đã đóng (",
" · ",
") – chỉ xem. Quản trị viên mở lại kỳ ở màn hình 5.3 nếu cần sửa."
],
"en": "Period {*} is closed ({*} · {*}) – view only. An administrator can reopen the period on screen 5.3 if a fix is needed.",
"prefix": false
},
{
"vi": [
"",
" file không có kỳ (YYMM) trong tên: ",
"",
". Hệ thống sẽ kiểm tra ngày từng dòng sau khi import."
],
"en": "{*} files have no period (YYMM) in the name: {*}{*}. Each row's date is checked after import.",
"prefix": false
},
{
"vi": [
"",
" ",
" dòng tiêu hao. Chạy lại STEP 2 để áp dụng."
],
"en": "{*} {*} consumption lines. Re-run STEP 2 to apply.",
"prefix": false
},
{
"vi": [
"STEP 2 bị chặn: STEP 1 có kết quả kiểm tra dữ liệu ERP chưa được xác nhận (",
" PC lệch PC-P / PC-M, ",
" dòng vật tư bất thường). Mở STEP 1 → \"Kiểm tra dữ liệu ERP\", rà soát rồi bấm Xác nhận."
],
"en": "STEP 2 blocked: STEP 1 has unconfirmed ERP data-check results ({*} PCs PC-P / PC-M mismatch, {*} abnormal material lines). Open STEP 1 → \"ERP data check\", review and click Confirm.",
"prefix": false
},
{
"vi": [
"STEP 2 bị chặn bởi kiểm soát ngày ERP kỳ ",
". ",
"",
". Sửa / xuất lại báo cáo rồi import lại."
],
"en": "STEP 2 blocked by the ERP date control for period {*}. {*}{*}. Fix / re-export the reports and import again.",
"prefix": false
},
{
"vi": [
"STEP 2 xong: ",
". Đã phân bổ ",
" VND."
],
"en": "STEP 2 done: {*}. Allocated {*} VND.",
"prefix": false
},
{
"vi": [
"Đã import Opening WIP: ",
" dòng, ",
"."
],
"en": "Opening WIP imported: {*} rows, {*}.",
"prefix": false
},
{
"vi": [
"Kỳ ",
" CHƯA ĐÓNG. Số dư chuyển sang có thể còn thay đổi. Nhập lý do để vẫn chuyển tạm Closing WIP / Rework WIP (bỏ trống = không chuyển; roll lại sau khi đóng kỳ ",
"):"
],
"en": "Period {*} is NOT CLOSED. The balances carried forward may still change.\nEnter a reason to carry Closing WIP / Rework WIP forward provisionally (blank = do not carry; roll again after period {*} is closed):",
"prefix": false
},
{
"vi": [
"Chưa có Material WIP (STEP 3) của kỳ ",
". Hãy import Opening WIP từ file."
],
"en": "No Material WIP (STEP 3) for period {*}. Import the Opening WIP from a file.",
"prefix": false
},
{
"vi": [
"Closing WIP hiện có là kỳ ",
", không phải kỳ liền trước."
],
"en": "The existing Closing WIP is for period {*}, not the previous period.",
"prefix": false
},
{
"vi": [
"Đã roll forward từ kỳ ",
"",
": ",
"",
"."
],
"en": "Rolled forward from period {*}{*}: {*}{*}.",
"prefix": false
},
{
"vi": [
"File thuộc kỳ ",
". Mở/ghi đè kỳ ",
" trên web?"
],
"en": "The file belongs to period {*}. Open / overwrite period {*} on the web?",
"prefix": false
},
{
"vi": [
"Kỳ ",
" đã có dữ liệu trên web. Ghi đè bằng dữ liệu từ file?"
],
"en": "Period {*} already has data on the web. Overwrite with the data from the file?",
"prefix": false
},
{
"vi": [
"Đã nạp kỳ ",
" từ Excel."
],
"en": "Period {*} loaded from Excel.",
"prefix": false
},
{
"vi": [
"Chưa chuyển Opening WIP / Rework B/F từ kỳ ",
" (chưa đóng). Dùng “Roll forward” ở STEP 3 sau khi đóng kỳ ",
"."
],
"en": "Opening WIP / Rework B/F not carried from period {*} (not closed). Use “Roll forward” in STEP 3 after period {*} is closed.",
"prefix": false
},
{
"vi": [
"Kỳ ",
" đã đóng – không chạy lại được. Quản trị viên có thể mở lại kỳ ở màn hình 5.3."
],
"en": "Period {*} is closed – it cannot be re-run. An administrator can reopen the period on screen 5.3.",
"prefix": false
},
{
"vi": [
"Kỳ ",
" trên Cloud đã thay đổi. Tải bản Cloud sẽ thay thế dữ liệu trên màn hình và bỏ các thay đổi CHƯA đồng bộ trên máy này. Bạn đã kiểm tra và muốn tiếp tục?"
],
"en": "Period {*} has changed in the Cloud. Loading the Cloud version replaces the data on screen and discards changes NOT yet synced from this device.\n\nHave you checked and want to continue?",
"prefix": false
},
{
"vi": [
"Fallback rộng = ",
" VND (",
"% Stock Out đã phân bổ). Nhập lý do / bằng chứng review (bắt buộc):"
],
"en": "Broad fallback = {*} VND ({*}% of allocated Stock Out). Enter the review reason / evidence (required):",
"prefix": false
},
{
"vi": [
"Đã điều chỉnh ",
" dòng PC-P về PC-M. Chạy lại STEP 2 và STEP 3."
],
"en": "Adjusted {*} PC-P lines to PC-M. Re-run STEP 2 and STEP 3.",
"prefix": false
},
{
"vi": [
"Xoá Opening WIP kỳ ",
"? (Không xoá dữ liệu ERP)"
],
"en": "Clear Opening WIP for period {*}? (ERP data is not deleted)",
"prefix": false
},
{
"vi": [
"Xác nhận phần ",
" – ",
"? ",
" Ghi chú / kết luận (bắt buộc, ≥ 5 ký tự), ví dụ: \"Hàng khách cấp – ERP giá trị 0 là đúng\":"
],
"en": "Confirm part {*} – {*}?\n{*}\n\nNote / conclusion (required, ≥ 5 characters), e.g. \"Customer-supplied goods – ERP value 0 is correct\":",
"prefix": false
},
{
"vi": [
"Đã xác nhận phần ",
"."
],
"en": "Part {*} confirmed.",
"prefix": false
},
{
"vi": [
"Xóa xác nhận phần ",
" (",
")? STEP 2 sẽ bị chặn cho đến khi phần này được xác nhận lại."
],
"en": "Clear the confirmation of part {*} ({*})? STEP 2 is blocked until this part is confirmed again.",
"prefix": false
},
{
"vi": [
"Đã xóa xác nhận phần ",
". STEP 2 bị chặn cho đến khi xác nhận lại."
],
"en": "Confirmation of part {*} cleared. STEP 2 is blocked until it is confirmed again.",
"prefix": false
},
{
"vi": [
"Đã lưu nháp ",
" dòng. Chưa đổi trạng thái hay số liệu – bấm Xác nhận để áp dụng."
],
"en": "Draft saved for {*} lines. Status and figures unchanged – click Confirm to apply.",
"prefix": false
},
{
"vi": [
"Xác nhận ",
" dòng FG làm tiêu dùng nội bộ (SL ",
")? Số tiền ghi Nợ 632 / Có 155 sẽ được tính khi chạy RUN FIFO (STEP 5.2)."
],
"en": "Confirm {*} FG lines as internal consumption (qty {*})?\nThe Dr 632 / Cr 155 amount is calculated when RUN FIFO (STEP 5.2) runs.",
"prefix": false
},
{
"vi": [
"Đã xác nhận ",
" dòng tiêu dùng nội bộ. Chạy RUN FIFO (STEP 5.2) để tính giá."
],
"en": "{*} internal consumption lines confirmed. Run RUN FIFO (STEP 5.2) to cost them.",
"prefix": false
},
{
"vi": [
"Hoàn tác tiêu dùng nội bộ dòng ",
"? Dòng trở về OPEN và phải chạy lại RUN FIFO (STEP 5.2)."
],
"en": "Undo internal consumption for line {*}? The line returns to OPEN and RUN FIFO (STEP 5.2) must be re-run.",
"prefix": false
},
{
"vi": [
"Đã hoàn tác ",
"."
],
"en": "{*} undone.",
"prefix": false
},
{
"vi": [
"Xoá dữ liệu ERP đã import của kỳ ",
". Bước 1/2 – nhập PHẠM VI cần xoá: ALL = cả 3 hệ (",
" báo cáo) T = hệ T (",
") S = hệ S (",
") O = hệ O (",
")"
],
"en": "Clear imported ERP data for period {*}.\n\nStep 1/2 – enter the SCOPE to clear:\n  ALL = all 3 systems ({*} reports)\n  T = system T ({*})   S = system S ({*})   O = system O ({*})",
"prefix": false
},
{
"vi": [
"Phạm vi “",
"” không hợp lệ – chỉ nhập ALL, T, S hoặc O (lý do nhập ở bước 2)."
],
"en": "Scope “{*}” is not valid – enter only ALL, T, S or O (the reason is entered in step 2).",
"prefix": false
},
{
"vi": [
"Không có báo cáo ERP nào của phạm vi ",
" để xoá."
],
"en": "No ERP reports in scope {*} to clear.",
"prefix": false
},
{
"vi": [
"Bước 2/2 – nhập LÝ DO xoá ",
" báo cáo (",
") của kỳ ",
":"
],
"en": "Step 2/2 – enter the REASON for clearing {*} reports ({*}) of period {*}:",
"prefix": false
},
{
"vi": [
"Đã xoá ",
" báo cáo ERP (",
") của kỳ ",
". Import lại file ERP rồi chạy lại STEP 2 → 3 → 3B → 4."
],
"en": "Cleared {*} ERP reports ({*}) of period {*}. Re-import the ERP files, then re-run STEP 2 → 3 → 3B → 4.",
"prefix": false
},
{
"vi": [
"Không xuất được Excel: ",
""
],
"en": "Could not export Excel: {*}",
"prefix": false
},
{
"vi": [
"Ẩn kỳ ",
" khỏi danh sách kỳ? Kỳ đã từng đóng là hồ sơ kế toán nên không xoá được; ẩn chỉ làm kỳ không còn hiện trong danh sách chọn kỳ. Dữ liệu và lịch sử trên cloud vẫn giữ nguyên, hiện lại được ở màn hình này."
],
"en": "Hide period {*} from the period list?\n\nA period that was ever closed is an accounting record and cannot be deleted; hiding only removes it from the period selector. Data and history in the cloud are kept and it can be shown again on this screen.",
"prefix": false
},
{
"vi": [
"Kỳ ",
" đã từng CLOSED nên là hồ sơ kế toán lưu trữ; không được hard-delete kể cả sau REOPEN. Dùng “Ẩn kỳ” để bỏ khỏi danh sách."
],
"en": "Period {*} was CLOSED before, so it is an archived accounting record; it cannot be hard-deleted, even after REOPEN. Use “Hide period” to remove it from the list.",
"prefix": false
},
{
"vi": [
"Kỳ ",
" đang CLOSED và không được xoá."
],
"en": "Period {*} is CLOSED and cannot be deleted.",
"prefix": false
},
{
"vi": [
"Gõ ",
" để xoá toàn bộ dữ liệu kỳ OPEN này trên máy này",
":"
],
"en": "Type {*} to delete all data of this OPEN period on this device{*}:",
"prefix": false
},
{
"vi": [
"Đã xoá kỳ ",
"."
],
"en": "Period {*} deleted.",
"prefix": false
},
{
"vi": [
"Kỳ ",
": ",
""
],
"en": "Period {*}: {*}",
"prefix": false
},
{
"vi": [
"Không tìm thấy sản phẩm \"",
"\" trong kỳ ",
"."
],
"en": "Product \"{*}\" not found in period {*}.",
"prefix": false
},
{
"vi": [
"Đã chuyển ",
" lô thành phẩm kỳ ",
" (",
" VND) vào bảng lũy kế."
],
"en": "Moved {*} finished lots of period {*} ({*} VND) into the cumulative table.",
"prefix": false
},
{
"vi": [
"Kỳ ",
" đã đóng."
],
"en": "Period {*} is closed.",
"prefix": false
},
{
"vi": [
"Đã có số đầu kỳ (",
", ",
" dòng). Thay bằng file ",
"?"
],
"en": "Opening figures already exist ({*}, {*} lines). Replace with file {*}?",
"prefix": false
},
{
"vi": [
"Không có dữ liệu kỳ ",
" trên web. Dùng Upload file đầu kỳ."
],
"en": "No data for period {*} on the web. Use Upload opening file.",
"prefix": false
},
{
"vi": [
"Kỳ ",
" chưa đóng – số liệu kỳ đó còn có thể thay đổi. Vẫn roll forward?"
],
"en": "Period {*} is not closed – its figures may still change. Roll forward anyway?",
"prefix": false
},
{
"vi": [
"Đã có số đầu kỳ (",
", ",
" dòng). Thay bằng ",
"?"
],
"en": "Opening figures already exist ({*}, {*} lines). Replace with {*}?",
"prefix": false
},
{
"vi": [
"Đã nạp ",
" lớp FG đầu kỳ. Bước tiếp: Validate."
],
"en": "Loaded {*} opening FG layers. Next: Validate.",
"prefix": false
},
{
"vi": [
"Kỳ ",
" đã đóng. Mở lại kỳ (quản trị viên) nếu cần sửa."
],
"en": "Period {*} is closed. Reopen the period (administrator) if a fix is needed.",
"prefix": false
},
{
"vi": [
"Kỳ ",
" chưa có kết quả STEP 5 trên web. Dùng Import file FG đầu kỳ."
],
"en": "Period {*} has no STEP 5 result on the web. Use Import opening FG file.",
"prefix": false
},
{
"vi": [
"Kỳ ",
" CHƯA ĐÓNG. Quy trình chuẩn: BUILD FG HISTORY → CLOSE MONTH → ROLL FORWARD. Nhập lý do để vẫn roll forward (chỉ dùng khi thiết lập ban đầu / khôi phục), để trống để huỷ:"
],
"en": "Period {*} is NOT CLOSED.\nStandard process: BUILD FG HISTORY → CLOSE MONTH → ROLL FORWARD.\nEnter a reason to roll forward anyway (only for initial setup / recovery), leave blank to cancel:",
"prefix": false
},
{
"vi": [
"FG đầu kỳ đã có dữ liệu. Thay bằng FG cuối kỳ ",
"?"
],
"en": "Opening FG already has data. Replace with the closing FG of {*}?",
"prefix": false
},
{
"vi": [
"Đã roll forward ",
" lớp từ ",
". Bước tiếp: Validate."
],
"en": "Rolled forward {*} layers from {*}. Next: Validate.",
"prefix": false
},
{
"vi": [
"FG đầu kỳ: ",
" · BLOCK ",
" · REVIEW ",
""
],
"en": "Opening FG: {*} · BLOCK {*} · REVIEW {*}",
"prefix": false
},
{
"vi": [
"Điền sẵn template bằng FG cuối kỳ ",
" (",
" lớp)?"
],
"en": "Prefill the template with the closing FG of {*} ({*} layers)?",
"prefix": false
},
{
"vi": [
"Validate & Save hàng trả lại / giảm giá (",
") Thay thế dòng trả lại cũ từ ",
" đến ",
": ",
" dòng Thêm mới từ file: ",
" dòng"
],
"en": "Validate & Save returns / discounts ({*})\n\nReplace old return lines from {*} to {*}: {*} lines\nAdd from file: {*} lines",
"prefix": true
},
{
"vi": [
"Đã lưu ",
" dòng trả lại / giảm giá (REVIEW ",
", thay thế ",
")."
],
"en": "Saved {*} return / discount lines (REVIEW {*}, replaced {*}).",
"prefix": true
},
{
"vi": [
"Duyệt đơn giá vốn ",
" VND/sp cho dòng trả lại này? Căn cứ: ",
" Người gửi duyệt: ",
""
],
"en": "Approve the unit cost {*} VND/unit for this return line?\nBasis: {*}\nRequested by: {*}",
"prefix": false
},
{
"vi": [
"STEP 5R xong: ",
"/",
" dòng trả lại · giảm giá vốn ",
" VND"
],
"en": "STEP 5R done: {*}/{*} return lines · COGS reduced by {*} VND",
"prefix": true
},
{
"vi": [
"FIFO bán hàng xong: ",
". COGS ",
" · FG cuối kỳ ",
" VND."
],
"en": "Sales FIFO done: {*}. COGS {*} · closing FG {*} VND.",
"prefix": true
},
{
"vi": [
"STEP 5.2 OUTDATED: ",
". Chạy lại RUN FIFO COGS trước."
],
"en": "STEP 5.2 OUTDATED: {*}. Re-run RUN FIFO COGS first.",
"prefix": false
},
{
"vi": [
"FG History KHÔNG được tạo: STEP 5 chưa CURRENT (",
" / ",
"). Chạy lại RUN FIFO COGS."
],
"en": "FG History NOT built: STEP 5 is not CURRENT ({*} / {*}). Re-run RUN FIFO COGS.",
"prefix": false
},
{
"vi": [
"FG History KHÔNG được tạo: Batch 7 = ",
"."
],
"en": "FG History NOT built: Batch 7 = {*}.",
"prefix": false
},
{
"vi": [
"BUILD FG HISTORY bị chặn – STEP 5R: ",
". Mở màn hình 5R → RUN STEP 5R."
],
"en": "BUILD FG HISTORY blocked – STEP 5R: {*}. Open screen 5R → RUN STEP 5R.",
"prefix": false
},
{
"vi": [
"BUILD FG HISTORY bị chặn – STEP 5R còn ",
" dòng trả lại BLOCK (chưa có hoá đơn gốc / đơn giá chưa duyệt / trả vượt hoá đơn)."
],
"en": "BUILD FG HISTORY blocked – STEP 5R still has {*} BLOCKed return lines (no original invoice / unit cost not approved / return exceeds the invoice).",
"prefix": false
},
{
"vi": [
"BUILD FG HISTORY bị chặn – STEP 5R còn ",
" dòng AUTO-MATCHED: kiểm tra hoá đơn gốc hệ thống tự chọn, bấm Lưu để xác nhận rồi RUN STEP 5R."
],
"en": "BUILD FG HISTORY blocked – STEP 5R still has {*} AUTO-MATCHED lines: check the original invoice chosen by the system, click Save to confirm, then RUN STEP 5R.",
"prefix": false
},
{
"vi": [
"BUILD FG HISTORY bị chặn: FG Rework Batch 8 = ",
"."
],
"en": "BUILD FG HISTORY blocked: FG Rework Batch 8 = {*}.",
"prefix": false
},
{
"vi": [
"FG History: ",
" dòng (COGS kỳ này ",
", FG cuối kỳ ",
", đã bán trước ",
"). Archive gate PASS."
],
"en": "FG History: {*} lines (COGS this period {*}, closing FG {*}, sold earlier {*}). Archive gate PASS.",
"prefix": false
},
{
"vi": [
"Không thể mở lại ",
": kỳ kế tiếp ",
" đã ĐÓNG và đang phụ thuộc số dư cuối kỳ này. Mở lại ",
" trước, sau đó mới mở lại ",
"."
],
"en": "Cannot reopen {*}: the next period {*} is CLOSED and depends on this period's closing balances. Reopen {*} first, then reopen {*}.",
"prefix": false
},
{
"vi": [
"Mở lại kỳ ",
" đã đóng (để sửa số liệu). Nhập lý do:"
],
"en": "Reopen closed period {*} (to correct figures). Enter a reason:",
"prefix": false
},
{
"vi": [
"Đã mở lại kỳ ",
"",
". Sau khi sửa: RUN FIFO → BUILD FG HISTORY → CLOSE MONTH."
],
"en": "Period {*} reopened{*}. After fixing: RUN FIFO → BUILD FG HISTORY → CLOSE MONTH.",
"prefix": false
},
{
"vi": [
"SL hoàn thành + SL hỏng phải bằng SL xuất rework (",
")."
],
"en": "Completed qty + scrap qty must equal the qty issued to rework ({*}).",
"prefix": false
},
{
"vi": [
"Đã lưu: ",
". ",
""
],
"en": "Saved: {*}. {*}",
"prefix": false
},
{
"vi": [
"Đã chọn phân bổ theo ",
". Chạy lại BUILD → duyệt → APPLY, rồi STEP 4."
],
"en": "Allocation set to {*}. Re-run BUILD → review → APPLY, then STEP 4.",
"prefix": false
},
{
"vi": [
"INPUT đã đồng bộ: ",
" vật tư WIP âm."
],
"en": "INPUT synced: {*} negative-WIP materials.",
"prefix": false
},
{
"vi": [
"INPUT trống – đã tự điền ",
" vật tư WIP âm."
],
"en": "INPUT was empty – filled with {*} negative-WIP materials.",
"prefix": false
},
{
"vi": [
"Đã import ",
" dòng doanh thu. Bước tiếp: Validate & Save."
],
"en": "Imported {*} revenue lines. Next: Validate & Save.",
"prefix": false
},
{
"vi": [
"Đã nạp ",
" dòng Sales Order. Chạy lại Update Price Master."
],
"en": "Loaded {*} Sales Order lines. Re-run Update Price Master.",
"prefix": false
},
{
"vi": [
"Validate & Save doanh thu bán hàng (",
") Thay thế toàn bộ dòng cũ từ ",
" đến ",
": ",
" dòng Thêm mới từ file: ",
" dòng"
],
"en": "Validate & Save sales revenue ({*})\n\nReplace all old lines from {*} to {*}: {*} lines\nAdd from file: {*} lines",
"prefix": true
},
{
"vi": [
"Đã lưu ",
" dòng doanh thu (REVIEW ",
", thay thế ",
" dòng cũ)"
],
"en": "Saved {*} revenue lines (REVIEW {*}, replaced {*} old lines)",
"prefix": true
}
];
