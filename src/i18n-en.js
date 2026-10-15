// v1.14.59: English UI strings. Keys are the Vietnamese text as rendered (trimmed, single spaces), numbers replaced by {#}.
// Generated from a crawl of every screen and tab; values keep {#} in the same order.
export const EN = {
"Số âm, hoặc ô là chữ thay vì số: sửa trên ERP rồi import lại. Đơn giá xuất NVL (MI-M): dòng có thành tiền ≥ {#} VND và đơn giá lệch > {#} % so với đơn giá chuẩn (trung vị đơn giá các dòng cùng hệ, mã VT và ĐVT trong kỳ). Đúng thì xác nhận; sai thì sửa ERP và import lại. Danh sách cần được xác nhận trước khi chạy STEP {#}.": "Negative quantity or Total Cost, or a text cell instead of a number: fix in ERP and re-import. Material issue price (MI-M): lines with amount ≥ {#} VND and unit cost more than {#} % away from the reference (median unit cost of the lines with the same system, material code and unit in the period). If correct, confirm; if wrong, fix ERP and re-import. The list must be confirmed before running STEP {#}.",
"Đơn giá lô = Total Cost ÷ SL hoàn thành, so với trung vị đơn giá các lô cùng hệ và cùng mã sản phẩm trong kỳ. Bất thường: lệch > {#} % và Total Cost ≥ {#} VND; hoặc SL ≤ {#} nhưng có cost; hoặc SL > {#} nhưng Total Cost = {#}. Đúng thì xác nhận; sai thì sửa ERP và import lại. Danh sách cần được xác nhận trước khi chạy STEP {#}.": "Lot unit cost = Total Cost ÷ completed qty, compared with the median lot unit cost of the same system and product code in the period. Abnormal: deviation > {#} % and Total Cost ≥ {#} VND; or qty ≤ {#} with cost; or qty > {#} with Total Cost = {#}. If correct, confirm; if wrong, fix ERP and re-import. The list must be confirmed before running STEP {#}.",
"Đơn giá lô = Total Cost ÷ SL hoàn thành. Đơn giá chuẩn = trung vị đơn giá các lô cùng hệ và cùng mã sản phẩm trong kỳ. Bất thường: lệch > {#} % và Total Cost ≥ {#} VND; hoặc SL ≤ {#} nhưng có cost; hoặc SL > {#} nhưng Total Cost = {#}. Chỉ để rà soát, không chặn STEP {#}.": "Lot unit cost = Total Cost ÷ completed qty. Reference cost = median lot unit cost of the same system and product code in the period. Abnormal: deviation > {#} % and Total Cost ≥ {#} VND; or qty ≤ {#} with cost; or qty > {#} with Total Cost = {#}. For review only, not blocking STEP {#}.",
"Đơn giá dòng = Thành tiền ÷ SL xuất. Đơn giá chuẩn = trung vị đơn giá các dòng cùng hệ, mã VT và ĐVT trong kỳ (chưa đủ tin cậy để chặn). Bất thường: thành tiền ≥ {#} VND và lệch > {#} % so với chuẩn.": "Line unit cost = Amount ÷ issued qty. Reference cost = median line unit cost of the same system, material code and unit in the period (not reliable enough to block). Abnormal: amount ≥ {#} VND and deviation > {#} % from the reference.",
"SL ≤ {#} nhưng có Total Cost": "Qty ≤ {#} but has Total Cost",
"SL > {#} nhưng Total Cost = {#}": "Qty > {#} but Total Cost = {#}",
"lệch lớn nhất {#} %": "largest deviation {#} %",
"Chạy lại theo thứ tự (STEP {#} nếu cần) → RUN FIFO COGS → BUILD FG HISTORY.": "Re-run in order (STEP {#} if needed) → RUN FIFO COGS → BUILD FG HISTORY.",
"Chạy lại theo thứ tự STEP {#} → RUN FIFO → BUILD FG HISTORY.": "Re-run in order STEP {#} → RUN FIFO → BUILD FG HISTORY.",
"Đóng thông báo": "Close notifications",
" (cloud đã xác nhận)": " (cloud confirmed)",
"Lọc thông báo": "Filter notifications",
"thông báo": "notifications",
"Thông báo": "Notifications",
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
"Tất cả báo cáo": "All reports",
"Lọc theo báo cáo": "Filter by report",
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

// v1.14.60: every other Vietnamese text segment of the source code (states not seen in the crawl: confirmed cards, errors, trace screens…).
// SRC_WILD: '{*}' marks a value inserted by the code.
export const SRC_EXACT = {
"Đơn giá dòng = Thành tiền ÷ SL xuất. Đơn giá chuẩn = trung vị đơn giá các dòng cùng hệ, mã VT và ĐVT trong kỳ.": "Line unit cost = Amount ÷ issued qty. Reference cost = median line unit cost of the same system, material code and unit in the period.",
"Vật tư số âm, sai kiểu dữ liệu hoặc đơn giá xuất NVL bất thường": "Negative or wrong-type materials, or abnormal material issue prices",
"D · Đơn giá thành phẩm theo lô PC bất thường (PC-P)": "D · Abnormal finished-goods unit cost by PC lot (PC-P)",
"Đơn giá thành phẩm theo lô PC bất thường (PC-P)": "Abnormal finished-goods unit cost by PC lot (PC-P)",
"Số mã SP": "Product codes",
"Mã SP (ví dụ)": "Product codes (examples)",
"Đơn giá lệch so với chuẩn": "Unit cost deviates from reference",
"Đơn giá thành phẩm theo lô PC (PC-P)": "Finished-goods unit cost by PC lot (PC-P)",
"PC No.": "PC No.",
"Lọc theo hệ": "Filter by system",
"Lọc theo trạng thái": "Filter by status",
"Tất cả hệ": "All systems",
"Review - Abnormal": "Review - Abnormal",
"OK - Normal": "OK - Normal",
"Số lượng hoặc Total Cost âm, hoặc ô là chữ thay vì số: phải sửa trên ERP rồi import lại. Đúng thì xác nhận; sai thì sửa ERP và import lại. Danh sách cần được xác nhận trước khi chạy STEP 2.": "Negative quantity or Total Cost, or a text cell instead of a number: fix in ERP and re-import. If correct, confirm; if wrong, fix ERP and re-import. The list must be confirmed before running STEP 2.",
"C · Vật tư số âm, sai kiểu dữ liệu": "C · Negative or wrong-type materials",
"không có dòng cần xác nhận": "no line needs confirmation",
"Đang lưu lên cloud…": "Saving to the cloud…",
"Kỳ đã đóng – mở lại kỳ (5.3) nếu cần xoá": "Period closed – reopen it (5.3) if you need to delete",
"Tiếp tục?": "Continue?",
"Huỷ = giữ bản trên máy, không ghi đè cloud.": "Cancel = keep this computer's copy, do not overwrite the cloud.",
"OK = tải bản cloud về (BỎ các thay đổi chưa đồng bộ trên máy này).": "OK = load the cloud copy (DISCARDS unsynced changes on this computer).",
"Quy trình chuẩn: BUILD FG HISTORY → CLOSE MONTH → ROLL FORWARD.": "Standard flow: BUILD FG HISTORY → CLOSE MONTH → ROLL FORWARD.",
"Nhập lý do để vẫn roll forward (chỉ dùng khi thiết lập ban đầu / khôi phục), để trống để huỷ:": "Enter a reason to roll forward anyway (initial setup / recovery only); leave blank to cancel:",
"Price Master → OUTDATED, hãy Update Price Master.": "Price Master → OUTDATED, please run Update Price Master.",
"(CHÚ Ý: chưa có / chưa cập nhật FIFO kỳ này)": "(NOTE: FIFO for this period missing / not updated)",
"(CHÚ Ý: chưa cập nhật đủ từ STEP 4.3)": "(NOTE: not fully updated from STEP 4.3)",
"(CHƯA ĐÓNG – lý do:": "(NOT CLOSED – reason:",
"(bình quân tháng)": "(monthly average)",
"(bạn)": "(you)",
"(bỏ)": "(excluded)",
"(chưa có lý do)": "(no reason yet)",
"(chủ sở hữu)": "(owner)",
"(cloud đã xác nhận)": "(confirmed by the cloud)",
"(dừng ở giới hạn 20.000 – xuất Excel theo từng đợt)": "(stopped at the 20,000 limit – export Excel in batches)",
"(không PC)": "(no PC)",
"(không phát sinh)": "(none this period)",
"(không rõ)": "(unknown)",
"(kỳ trước chưa đóng)": "(previous period not closed)",
"(máy này + cloud)": "(this device + cloud)",
"(máy này)": "(this device)",
"(quản trị viên)": "(administrator)",
"(tiêu dùng nội bộ)": "(internal consumption)",
"(trống)": "(empty)",
"(tự khớp hoá đơn gần nhất hoặc đơn giá nhập tay) – xem bảng \"Xử lý dòng trả lại\".": "(auto-matched to the nearest invoice or a manual unit cost) – see the \"Return line handling\" table.",
"(xoá)": "(delete)",
"(ô vuông có mũi tên lên) →": "button (square with an up arrow) →",
"(đã ẩn)": "(hidden)",
"(đầy đủ)": "(complete)",
"(ưu tiên) hoặc": "(preferred) or",
"+ Nhập kho từ sản xuất": "+ Received from production",
", khối \"Tiêu dùng nội bộ\".": ", block \"Internal consumption\".",
". Cần kiểm tra trước khi tiếp tục.": ". Check it before continuing.",
". Hoàn tác hoặc xác nhận ở màn": ". Undo or confirm on screen",
"03_WIP_DIRECT_ADJ_INPUT chưa có vật tư nào.": "03_WIP_DIRECT_ADJ_INPUT has no materials.",
"100% (dòng)": "100% (rows)",
"21 báo cáo T · S · O": "21 reports T · S · O",
"2B · Sổ FG Stock Out / Rework": "2B · FG Stock Out / Rework register",
"5B · Rework lấy lớp hoàn thành sau ngày xuất": "5B · Rework took layers completed after the issue date",
"622 / 627 theo lô": "622 / 627 by lot",
"622 / đv": "622 / unit",
"622 lũy kế": "YTD 622",
"622/đv": "622/unit",
"627 / đv": "627 / unit",
"627 lũy kế": "YTD 627",
"627/đv": "627/unit",
": chưa tìm được hoá đơn gốc.": ": original invoice not found yet.",
": dùng đơn giá vốn nhập tay – chỉ được áp dụng sau khi": ": uses a manual unit cost – applied only after",
": hệ thống tự chọn hoá đơn gần nhất của cùng khách – sản phẩm (cần xác nhận).": ": the system chose the nearest invoice of the same customer – product (needs confirmation).",
"= FIFO theo tháng, tách theo hoá đơn: lần lượt từng dòng hoá đơn trong tháng (theo ngày) lấy lô cũ nhất còn tồn; một hoá đơn lấy nhiều lô thì tự tách thành nhiều dòng ở tab FIFO detail (gắn tháng, hoá đơn, khách, lô). Tổng giá vốn tháng giống workbook Excel; lô sản xuất trong tháng dùng được cho mọi hoá đơn của tháng. Phân bổ theo lô xem thêm ở 4.4 → Phân bổ giá vốn theo hoá đơn.": "= FIFO by month, split by invoice: each invoice line in the month (by date) takes the oldest lot in stock; an invoice taking several lots is split into several lines in the FIFO detail tab (with month, invoice, customer, lot). The monthly COGS total is the same as the Excel workbook; lots produced in the month can serve any invoice of the month. For the allocation by lot see 4.4 → COGS allocation by invoice.",
"= Tồn cuối kỳ": "= Closing stock",
"Biên lợi nhuận": "Margin",
"Bán hàng (COGS)": "Sales (COGS)",
"Báo cáo PC": "PC report",
"Báo cáo này chưa được import.": "This report has not been imported.",
"Bước tiếp: STEP 5R.": "Next step: STEP 5R.",
"Bạn chỉ xem được dữ liệu, không lưu thay đổi lên cloud.": "You can only view data; changes are not saved to the cloud.",
"BẤT": "ABN.",
"Bấm Update Price Master (tab Price Master) để danh sách giá phủ đúng các lô hiện tại.": "Click Update Price Master (Price Master tab) so the price list covers the current lots.",
"Bấm một dòng để sửa hoặc mở lại (OPEN).": "Click a line to edit or reopen it (OPEN).",
"Bấm một dòng để xử lý.": "Click a line to handle it.",
"Bấm một lô để xem vật tư của lô đó.": "Click a lot to see its materials.",
"Bất thường": "Abnormal",
"BẬT": "ON",
"BẬT tiêu hao (Nợ 632 / Có 152)": "Turn consumption ON (Dr 632 / Cr 152)",
"Bắt đầu một kỳ giá thành": "Start a costing period",
"Bắt đầu năm mới (mang tồn kho)": "Start a new year (carry stock)",
"Bỏ qua:": "Skipped:",
"CHI TIẾT": "DETAIL",
"CHƯA CÓ SỐ": "NO FIGURES",
"CHƯA XÁC NHẬN": "NOT CONFIRMED",
"CHƯA mở lại kỳ": "Period NOT reopened",
"CHƯA đóng kỳ": "Period NOT closed",
"CHỈ CÓ Ở PC-M": "ONLY IN PC-M",
"CHỈ CÓ Ở PC-P": "ONLY IN PC-P",
"Cao nhất": "Highest",
"Chi phí": "Expense",
"Chia sẻ": "Share",
"Chênh /đv": "Diff. /unit",
"Chênh PC-M − PC-P (VND)": "Diff. PC-M − PC-P (VND)",
"Chênh PC-P − PC-M": "Diff. PC-P − PC-M",
"Chênh SL (4.4 − 5)": "Qty diff. (4.4 − 5)",
"Chênh SL = thực tế − định mức trung vị × SL lô. Ảnh hưởng định mức = chênh SL × đơn giá BQ; ảnh hưởng đơn giá = (đơn giá lô − BQ) × SL.": "Qty diff. = actual − median norm × lot qty. Norm impact = qty diff. × average unit cost; price impact = (lot unit cost − average) × qty.",
"Chênh giá trị (4.4 − 5)": "Value diff. (4.4 − 5)",
"Chênh giá trị (VND)": "Value diff. (VND)",
"Chênh lệch PC-P và PC-M": "PC-P vs PC-M difference",
"Chênh lệch đã được xác nhận": "Differences confirmed",
"Chưa BUILD FG HISTORY.": "BUILD FG HISTORY not run.",
"Chưa BUILD. Bấm “1 · BUILD / REFRESH”.": "Not BUILT. Click “1 · BUILD / REFRESH”.",
"Chưa chạy": "Not run",
"Chưa chạy FIFO kỳ này": "FIFO not run this period",
"Chưa chạy STEP 2 – chưa có danh sách lô PC của kỳ.": "STEP 2 not run – no list of PC lots for the period yet.",
"Chưa chạy STEP 3.": "STEP 3 has not run.",
"Chưa chạy STEP 3. Cần STEP 2 = PASS và Opening WIP đã validate.": "STEP 3 not run. STEP 2 = PASS and a validated Opening WIP are required.",
"Chưa chạy STEP 3A": "STEP 3A not run",
"Chưa chạy STEP 3B": "STEP 3B not run",
"Chưa chạy STEP 4": "STEP 4 not run",
"Chưa chạy STEP 4.": "STEP 4 has not run.",
"Chưa chạy STEP 5": "STEP 5 not run",
"Chưa chạy STEP 5 (FIFO giá vốn) cho kỳ này.": "STEP 5 (FIFO COGS) has not run for this period.",
"Chưa chạy STEP 5.": "STEP 5 has not run.",
"Chưa chạy STEP 5.2 (RUN FIFO bán hàng)": "STEP 5.2 not run (RUN FIFO sales)",
"Chưa chạy STEP 5.2.": "STEP 5.2 has not run.",
"Chưa chạy STEP 5R": "STEP 5R not run",
"Chưa chạy STEP 5R sau lần RUN FIFO gần nhất": "STEP 5R not run after the latest RUN FIFO",
"Chưa chạy STEP 5R.": "STEP 5R has not run.",
"Chưa chạy Update Price Master": "Update Price Master not run",
"Chưa chọn kỳ.": "No period selected.",
"Chưa có FG History.": "No FG History yet.",
"Chưa có FG đầu kỳ.": "No opening FG yet.",
"Chưa có Opening WIP cho kỳ này.": "No Opening WIP for this period yet.",
"Chưa có duyệt hợp lệ – bấm Lưu để gửi duyệt": "No valid approval yet – click Save to request approval",
"Chưa có dòng FG nào đang hoạt động trong kỳ này để chọn tiêu dùng nội bộ.": "No active FG lines in this period to choose for internal consumption.",
"Chưa có dòng Stock Out vật tư (non-FG) trong kỳ.": "No material (non-FG) Stock Out lines in the period.",
"Chưa có dữ liệu doanh thu trong vùng staging.": "No revenue data in staging yet.",
"Chưa có dữ liệu hàng trả lại / giảm giá.": "No returns / discounts data yet.",
"Chưa có kết quả STEP 2. Hãy chạy phân bổ Stock Out trước.": "No STEP 2 result yet. Run the Stock Out allocation first.",
"Chưa có kết quả STEP 4.3 – chạy Phân bổ giá thành; kết quả tự chuyển vào bảng này.": "No STEP 4.3 result yet – run Cost allocation; the results move into this table automatically.",
"Chưa có kết quả. Cần đủ PC-P-T, PC-P-O và STOCK OUT T/S/O rồi bấm Chạy STEP 2.": "No results yet. PC-P-T, PC-P-O and STOCK OUT T/S/O are needed, then click Run STEP 2.",
"Chưa có số STEP 5.1 / 5.2 để đối chiếu.": "No STEP 5.1 / 5.2 figures to reconcile yet.",
"Chưa có thời điểm import ERP.": "No ERP import time yet.",
"Chưa cấu hình Firebase — dữ liệu chỉ nằm trong trình duyệt này.": "Firebase not configured — data stays in this browser only.",
"Chưa cập nhật Price Master.": "Price Master not updated yet.",
"Chưa nhập (3A)": "Not entered (3A)",
"Chưa nhập số dư / phát sinh FAST 154 / 155 / 2294 / 632 / 511 / 5212 / 5213 (STEP 5.3 → tab Đối chiếu FAST).": "FAST balances / movements 154 / 155 / 2294 / 632 / 511 / 5212 / 5213 not entered (STEP 5.3 → FAST reconciliation tab).",
"Chưa nạp FG đầu kỳ ở STEP 5.1": "Opening FG not loaded in STEP 5.1",
"Chưa nạp Opening FG.": "Opening FG not loaded.",
"Chưa đăng nhập để xem thông báo.": "Not signed in to view notifications.",
"Chưa đăng nhập.": "Not signed in.",
"Chưa đọc": "Unread",
"Chưa đủ số liệu": "Not enough data",
"Chạy 1 BUILD (tự dựng lại ENGINE)": "Run 1 BUILD (rebuild ENGINE)",
"Chạy FIFO COGS": "Run FIFO COGS",
"Chạy RUN FIFO COGS (bán hàng) trước – STEP 5R cần giá vốn của hoá đơn gốc.": "Run RUN FIFO COGS (sales) first – STEP 5R needs the COGS of the original invoices.",
"Chạy RUN FIFO COGS trước để có số dư cuối kỳ.": "Run RUN FIFO COGS first to get the closing balances.",
"Chạy STEP 2 – Phân bổ Stock Out": "Run STEP 2 – Stock Out allocation",
"Chạy STEP 3 – Material WIP": "Run STEP 3 – Material WIP",
"Chạy STEP 3A trước": "Run STEP 3A first",
"Chạy STEP 5 – FIFO COGS": "Run STEP 5 – FIFO COGS",
"Chạy STEP 5R (hàng bán bị trả lại) ở màn hình 5R": "Run STEP 5R (sales returns) on screen 5R",
"Chạy UPDATE PRICE / xử lý giá thiếu": "Run UPDATE PRICE / resolve missing prices",
"Chạy lại RUN FIFO (STEP 5.2) để cập nhật tồn kho / 154.": "Re-run RUN FIFO (STEP 5.2) to update stock / 154.",
"Chạy lại STEP 4.3 rồi RUN FIFO.": "Re-run STEP 4.3, then RUN FIFO.",
"Chế độ import phải là MONTHLY hoặc YTD.": "The import mode must be MONTHLY or YTD.",
"Chế độ offline": "Offline mode",
"Chế độ tương thích:": "Compatibility mode:",
"Chỉ người gửi yêu cầu hoặc quản trị viên mới xoá được.": "Only the requester or an administrator can delete it.",
"Chỉ quản trị viên được xoá kỳ trên cloud.": "Only administrators can delete a period in the cloud.",
"Chỉ quản trị viên được đóng kỳ": "Only administrators can close the period",
"Chỉ tài khoản đã được cấp quyền mới có thể xem dữ liệu giá thành trên cloud.": "Only authorised accounts can see costing data in the cloud.",
"Chỉ xem – không lưu thay đổi": "View only – changes are not saved",
"Chọn hoá đơn gốc hoặc nhập đơn giá vốn ở bảng \"Xử lý dòng trả lại\" bên dưới, rồi RUN STEP 5R lại.": "Choose the original invoice or enter a unit cost in the \"Return line handling\" table below, then RUN STEP 5R again.",
"Chọn kỳ báo cáo (YYYY-MM). Dữ liệu ERP, kết quả từng bước và sổ rework được lưu theo kỳ.": "Choose the reporting period (YYYY-MM). ERP data, step results and the rework register are stored per period.",
"Chọn tiêu dùng nội bộ ở khối \"Tiêu dùng nội bộ (632 / 155)\" phía trên.": "Choose internal consumption in the \"Internal consumption (632 / 155)\" block above.",
"Chờ duyệt": "Awaiting approval",
"Chờ người khác duyệt": "Waiting for someone else to approve",
"Chứng từ xuất": "Issue document",
"Cloud có bản mới hơn bản trên máy – chưa tải về, thay đổi trên máy sẽ không được đẩy lên.": "The cloud has a newer version than this device – not loaded; changes on this device will not be pushed.",
"Cloud đã có revision mới. Tải lại bản Cloud trước khi ghi.": "The cloud has a new revision. Reload the Cloud version before saving.",
"Complete Qty âm": "Negative Complete Qty",
"CÒN TỒN": "IN STOCK",
"Cài SVL Costing lên máy": "Install SVL Costing on this device",
"Cài lên iPhone / iPad": "Install on iPhone / iPad",
"Cài ứng dụng": "Install app",
"Các file được chọn thuộc nhiều kỳ khác nhau. Hãy import từng tháng một.": "The selected files belong to different periods. Import one month at a time.",
"Các lô": "Lots",
"Các lô kỳ này": "Lots this period",
"Các lần xuất bán từ lớp này trong kỳ": "Sales issued from this layer in the period",
"Các lớp FIFO đã lấy cho dòng bán này": "FIFO layers taken for this sales line",
"Các vật tư chung của lô nằm trong định mức; chênh lệch giá thành đến từ đơn giá vật tư, Stock Out, 3B hoặc phân bổ 622/627 – xem các dòng số liệu ở trên.": "The lot's common materials are within the norm; the cost difference comes from material unit costs, Stock Out, 3B or the 622/627 allocation – see the figures above.",
"Cách xử lý: xuất lại PC-P và PC-M cùng lúc từ ERP rồi import lại. Nếu chênh lệch nhỏ đã được giải trình, STEP 3 có chức năng \"Điều chỉnh PC-P theo PC-M\" (có lưu số gốc để hoàn tác).": "How to fix: export PC-P and PC-M from ERP at the same time and re-import. If a small difference has been explained, STEP 3 has \"Adjust PC-P to PC-M\" (the original figures are kept for undo).",
"Còn WIP SL": "WIP qty left",
"Còn lại WIP (SL)": "Remaining in WIP (qty)",
"Có FG Rework Active trong kỳ. STEP 5 bắt buộc STRICT_DATE để không lấy layer hoàn thành sau ngày xuất rework.": "Active FG Rework in the period. STEP 5 requires STRICT_DATE so that layers completed after the rework issue date are not used.",
"Có biểu tượng trên màn hình chính, mở toàn màn hình, xem được khi mất mạng.": "Home-screen icon, full-screen window, viewable offline.",
"Có bản Cloud mới hơn #": "A newer Cloud version exists #",
"Có dòng không còn trong sổ kỳ này – tải lại màn hình.": "Some lines are no longer in this period's register – reload the screen.",
"Có dòng xuất rework kỳ này chưa có giá FIFO – chạy STEP 5.2 RUN FIFO COGS.": "Rework issues this period have no FIFO cost yet – run STEP 5.2 RUN FIFO COGS.",
"Có dòng đã xử lý hoặc đã là tiêu dùng nội bộ – tải lại màn hình.": "Some lines are already handled or already internal consumption – reload the screen.",
"Có giá trị nhưng SL = 0": "Has a value but qty = 0",
"Có rework chuyển vào": "Has rework transferred in",
"Có thay đổi chưa lưu.": "There are unsaved changes.",
"Có điều chỉnh WIP 3B": "Has 3B WIP adjustment",
"Cơ cấu giá thành": "Cost structure",
"Cả sản phẩm": "Whole product",
"Cảnh báo (đã import):": "Warnings (imported):",
"Cần chạy STEP 2 trước (danh sách sản phẩm lấy từ PC-P).": "STEP 2 must run first (the product list comes from PC-P).",
"Cần chạy STEP 3A (Material WIP) trước.": "Run STEP 3A (Material WIP) first.",
"Cần chạy STEP 4 (và STEP 5 cho giá vốn) của kỳ này trước.": "Run STEP 4 (and STEP 5 for COGS) for this period first.",
"Cần ít nhất 2 kỳ có số liệu để vẽ xu hướng.": "At least 2 periods with figures are needed to draw a trend.",
"Cần đăng nhập Google để gửi / duyệt": "Google sign-in is required to send / approve",
"Cần đăng nhập Google để gửi hoặc duyệt đơn giá nhập tay.": "Google sign-in is required to send or approve a manual unit cost.",
"Danh sách sản phẩm": "Product list",
"Danh sách tiêu hao đã thay đổi sau lần chạy STEP 2 gần nhất – bấm": "The consumption list changed after the latest STEP 2 run – click",
"Danh sách đã thay đổi": "The list has changed",
"Date không đọc được": "Date cannot be read",
"Direct 622/627 đã được duyệt": "Direct 622/627 approved",
"Duyệt": "Approve",
"Duyệt Direct 622/627": "Approve Direct 622/627",
"Duyệt giá đang chờ": "Approve pending prices",
"Dòng PC-M (chứng từ gốc)": "PC-M lines (source documents)",
"Dòng PC-M của lô (chứng từ gốc)": "PC-M lines of the lot (source documents)",
"Dòng bán": "Sales line",
"Dòng bán #": "Sales line #",
"Dòng doanh thu bán hàng – không thuộc file trả lại / giảm giá, import ở màn hình 4.1": "Sales revenue line – not part of the returns / discounts file, import it on screen 4.1",
"Dòng file": "File row",
"Dòng hàng bán bị trả lại / giảm giá (SALES RETURN / CREDIT NOTE) – không thuộc file doanh thu, import ở màn hình 5R": "Sales return / discount line (SALES RETURN / CREDIT NOTE) – not part of the revenue file, import it on screen 5R",
"Dòng này không ở trạng thái tiêu dùng nội bộ.": "This line is not in internal consumption status.",
"Dòng này là": "This line is",
"Dòng rework": "Rework line",
"Dòng tiêu đề 4 của template bị thay đổi:": "Header row 4 of the template has been changed:",
"Dòng âm trên PC-M: thường là điều chỉnh / trả lại vật tư – kiểm tra chứng từ gốc của dòng đó.": "Negative PC-M lines: usually adjustments / material returns – check that line's source document.",
"Dòng đang là tiêu dùng nội bộ: dùng nút Hoàn tác ở khối phía trên.": "This line is internal consumption: use the Undo button in the block above.",
"Dùng cho kỳ": "For period",
"Dữ liệu ERP đã thay đổi — cần chạy lại STEP 2 và STEP 3.": "ERP data changed — re-run STEP 2 and STEP 3.",
"Dữ liệu ERP được import sau lần chạy STEP 2 gần nhất. Chạy lại STEP 2 trước STEP 3.": "ERP data was imported after the latest STEP 2 run. Re-run STEP 2 before STEP 3.",
"Dữ liệu doanh thu đã import nhưng chưa Validate & Save hoặc còn dòng BLOCK.": "Revenue data imported but not yet Validated & Saved, or BLOCK rows remain.",
"Dữ liệu giá thành đã cập nhật": "Costing data updated",
"Dữ liệu hàng trả lại hoặc cách xử lý (hoá đơn gốc / đơn giá) đã đổi sau lần chạy STEP 5R": "Return data or its handling (original invoice / unit cost) changed after the STEP 5R run",
"Dữ liệu được mở lại để điều chỉnh. Cần kiểm tra các checkpoint.": "The data has been reopened for adjustment. Check the checkpoints.",
"Dữ liệu đầu vào đã thay đổi": "Input data changed",
"Dự phòng: chưa có phân bổ R5a–c cho lô nhận trong kỳ.": "Fallback: no R5a–c allocation to receiving lots in the period.",
"Dự phòng: nhóm không có lô nhận, chia theo PC RM Cost trên O.": "Fallback: group without receiving lots, split by PC RM Cost across O.",
"ERP MAP đã cập nhật – không có vật tư mới.": "ERP MAP updated – no new materials.",
"FG tiêu dùng nội bộ (FIFO, tính trước giá vốn bán hàng)": "FG internal consumption (FIFO, costed before sales COGS)",
"FG đầu kỳ đã validate lại": "Opening FG validated again",
"FG đầu ra": "Output FG",
"FIFO đã chạy lại": "FIFO re-run",
"FILE CHI TIẾT": "DETAIL FILE",
"File không có dòng SALES RETURN / CREDIT NOTE nào.": "The file has no SALES RETURN / CREDIT NOTE lines.",
"File không có dòng SALES RETURN / CREDIT NOTE nào. Kỳ không có hàng trả lại / giảm giá thì không cần import.": "The file has no SALES RETURN / CREDIT NOTE lines. If the period has no returns / discounts, no import is needed.",
"File không có dòng doanh thu bán hàng nào (toàn bộ là SALES RETURN / CREDIT NOTE – import ở màn hình 5R).": "The file has no sales revenue lines (all are SALES RETURN / CREDIT NOTE – import them on screen 5R).",
"File không có dòng dữ liệu.": "The file has no data rows.",
"File đầu kỳ cũ": "Old opening file",
"GT còn lại": "Value left",
"Giá bán": "Selling price",
"Giá bán / đv": "Price / unit",
"Giá bán USD": "Price USD",
"Giá bán/đv": "Price/unit",
"Giá bán/đv (VND)": "Price/unit (VND)",
"Giá thành / đv": "Cost / unit",
"Giá thành > giá bán": "Cost > selling price",
"Giá thành STEP 4 đã đổi (điều chỉnh 3B / rework hoàn thành)": "STEP 4 cost changed (3B adjustment / completed rework)",
"Giá thành SX kỳ này / đv": "Production cost this period / unit",
"Giá thành kỳ này": "Cost this period",
"Giá thành lô mới": "New lot cost",
"Giá thành lũy kế": "YTD cost",
"Giá thành từng lô ở STEP 4 đã đổi (điều chỉnh 3B / rework chuyển giữa các lô)": "Lot costs in STEP 4 changed (3B adjustment / rework moved between lots)",
"Giá thành ÷ trung vị": "Cost ÷ median",
"Giá thành/đv kỳ này": "Cost/unit this period",
"Giá thủ công thay đổi sau lần cập nhật Price Master:": "Manual prices changed after the Price Master update:",
"Giá trị (VND)": "Value (VND)",
"Giá trị 4.4 (VND)": "Value 4.4 (VND)",
"Giá trị STEP 5 (VND)": "Value STEP 5 (VND)",
"Giá trị chuyển vào": "Value transferred in",
"Giá trị còn lại": "Value remaining",
"Giá trị còn lại (VND)": "Value remaining (VND)",
"Giá trị theo định mức": "Value at norm",
"Giá trị thực tế": "Actual value",
"Giá trị vẫn treo ở 154.": "The value stays pending in 154.",
"Giá trị xuất rework": "Value to rework",
"Giá trị – SX năm nay": "Value – produced this year",
"Giá trị – SX năm trước": "Value – produced last year",
"Giá vốn (632)": "COGS (632)",
"Giá vốn / đv": "COGS / unit",
"Giá vốn / đv bình quân": "Average COGS / unit",
"Giá vốn hàng bán": "Cost of goods sold",
"Giá vốn xuất bán trong tháng": "COGS in the month",
"Giá vốn đã xuất": "COGS issued",
"Giá vốn đã xuất (VND)": "COGS issued (VND)",
"Giá vốn đã xuất YTD": "YTD COGS issued",
"Giá vốn đã xuất trước kỳ (VND)": "COGS issued before the period (VND)",
"Giá vốn/đv": "COGS/unit",
"Giảm giá": "Discount",
"Giảm giá vốn hàng trả lại (5R)": "COGS reduction for returns (5R)",
"Gồm các tháng": "Months included",
"Gợi ý kiểm tra": "Suggested checks",
"Hiện lại": "Show again",
"Hoàn tác": "Undo",
"Hoàn tác điều chỉnh": "Undo adjustment",
"Hoàn tất FX / GL": "Complete FX / GL",
"Hoàn tất STEP 4 trước": "Complete STEP 4 first",
"Hoá đơn / phiếu": "Invoice / slip",
"Hoá đơn / phiếu đã lấy lô (FIFO)": "Invoices / slips that took the lot (FIFO)",
"Hoá đơn gốc": "Original invoice",
"Hoá đơn trả": "Return invoice",
"Hàng bán bị trả lại nhập lại kho": "Sales returns received back into stock",
"Hàng hỏng tính vào": "Scrap charged to",
"HĐ gốc": "Original inv.",
"Hướng xử lý": "Outcome",
"Hết lớp FG của tháng (đã dùng cho hoá đơn trước)": "FG layers of the month used up (taken by earlier invoices)",
"Hệ thống giá thành sản xuất tháng": "Monthly production costing system",
"Họ": "Family",
"Hỏng tính vào": "Scrap charged to",
"Import ERP, kiểm soát WIP, phân bổ giá thành, FIFO COGS, Sales Return và đóng kỳ trên một quy trình có kiểm soát.": "ERP import, WIP control, cost allocation, FIFO COGS, sales returns and month close in one controlled process.",
"Import bị chặn.": "Import blocked.",
"Import các báo cáo còn thiếu": "Import the missing reports",
"KHÔNG CÓ trong lô": "NOT IN the lot",
"KHÔNG ghi đè cloud:": "Cloud NOT overwritten:",
"Khoản mục thay đổi nhiều nhất là nơi cần xem trước: NVL → xem bảng Vật tư (đơn giá, định mức); 622/627 → xem tổng chi phí GL kỳ và cơ sở phân bổ (STEP 4.2–4.3).": "Look first at the element that changed most: RM → see the Materials table (unit cost, usage norm); 622/627 → see the period's GL totals and the allocation basis (STEP 4.2–4.3).",
"Không": "No",
"Không có Product Code trong PC-P hoặc Sales Database của kỳ.": "No Product Code in PC-P or the Sales Database for the period.",
"Không có WIP âm – không cần STEP 3B. Chạy STEP 4": "No negative WIP – STEP 3B not needed. Run STEP 4",
"Không có chi tiết PC-M": "No PC-M detail",
"Không có cơ sở phân bổ dương cho pool 622/627 chung.": "No positive allocation basis for the common 622/627 pool.",
"Không có dòng FG History để tạo.": "No FG History lines to build.",
"Không có dòng doanh thu nào lặp lại trong kỳ.": "No repeated revenue lines in the period.",
"Không có dòng giao dịch nào.": "No transaction rows.",
"Không có dòng nào.": "No rows.",
"Không có giá bán trong Price Master – 622/627 không phân bổ được theo đóng góp.": "No selling price in the Price Master – 622/627 cannot be allocated by contribution.",
"Không có lô nào chênh lệch.": "No lots with differences.",
"Không có lô nào giá vốn > NRV.": "No lots with cost > NRV.",
"Không có lớp FG ngày ≤ ngày hoá đơn": "No FG layer dated on or before the invoice date",
"Không có mạng": "Offline",
"Không có phát sinh.": "No movements.",
"Không có rework đang treo.": "No pending rework.",
"Không có vật tư âm – kỳ này không cần điều chỉnh WIP (không BUILD / APPLY)": "No negative materials – no WIP adjustment needed this period (no BUILD / APPLY)",
"Không có yêu cầu đang chờ duyệt cho dòng này.": "No request awaiting approval for this line.",
"Không có điều chỉnh COGS báo cáo": "No reported COGS adjustment",
"Không kết nối được Firebase — chưa xác thực phiên nên chưa hiển thị dữ liệu kế toán trên máy này. Kết nối lại rồi tải lại trang.": "Cannot connect to Firebase — the session is not authenticated, so no accounting data is shown on this device. Reconnect and reload the page.",
"Không nhận 622/627": "No 622/627 received",
"Không nhận diện được báo cáo ERP nào. Cần PC-P/PC-M/MI-P/MI-M/STOCK OUT/MR-P/MR-M + T/S/O trong tên file.": "No ERP report recognised. The file name needs PC-P/PC-M/MI-P/MI-M/STOCK OUT/MR-P/MR-M + T/S/O.",
"Không nhận diện được báo cáo ERP từ tên file": "ERP report cannot be identified from the file name",
"Không phát hiện điểm bất thường theo các quy tắc kiểm tra.": "No anomalies found by the check rules.",
"Không phải file SVL Costing Master (thiếu 00_CONTROL_CENTER).": "Not an SVL Costing Master file (00_CONTROL_CENTER missing).",
"Không tìm thấy bảng WIP closing/opening trong file.": "No WIP closing/opening table found in the file.",
"Không tìm thấy bảng có các cột Kỳ, Product Code, Complete Qty và Tổng giá thành (hoặc RM / 622 / 627). Dùng nút \"Tải template\".": "No table found with Period, Product Code, Complete Qty and Total cost (or RM / 622 / 627) columns. Use the \"Download template\" button.",
"Không tìm thấy bảng có cột Product Code và Unit Price USD.": "No table found with Product Code and Unit Price USD columns.",
"Không tìm thấy bảng mẫu chi tiết (dòng tiêu đề có PC No., Product code, Complete Qty, Cost month).": "Detail table not found (header row with PC No., Product code, Complete Qty, Cost month).",
"Không tìm thấy sheet doanh thu có Invoice Date, Product Number, Quantity và Amount (USD).": "No revenue sheet found with Invoice Date, Product Number, Quantity and Amount (USD).",
"Không xác định được tháng sản xuất (Date trống, số PC không theo PC-YYMM-…)": "Production month cannot be determined (Date blank, PC number not in PC-YYMM-… form)",
"Không được tự duyệt yêu cầu của chính mình.": "You cannot approve your own request.",
"Không đọc được kỳ báo cáo ở 00_CONTROL_CENTER!E4.": "Cannot read the reporting period at 00_CONTROL_CENTER!E4.",
"Khớp FAST": "Matches FAST",
"Kiểm tra & tải bản Cloud": "Check & load Cloud version",
"Kiểm tra cầu nối posting (13-16)": "Check posting bridges (13-16)",
"Kiểm tra giá bán và tỷ giá trên hoá đơn (Sales DB) nếu doanh thu thấp bất thường.": "Check the selling price and FX rate on the invoice (Sales DB) if revenue is unusually low.",
"Kiểm tra hoá đơn gốc / SL trả / giảm giá vốn": "Check original invoices / returned qty / COGS reduction",
"Kiểm tra đơn giá RM": "RM unit cost check",
"Kiểu": "Kind",
"Kết quả STEP 4 không CURRENT. Chạy lại STEP 4 trước.": "STEP 4 result is not CURRENT. Re-run STEP 4 first.",
"Kết quả STEP 5 đã cũ (OUTDATED). Chạy lại RUN FIFO COGS.": "The STEP 5 result is OUTDATED. Re-run RUN FIFO COGS.",
"Kết quả cần kiểm tra / chạy lại": "Results to check / re-run",
"Kết quả này chưa có chi tiết. Bấm RUN FIFO COGS để tạo lại.": "This result has no detail yet. Click RUN FIFO COGS to rebuild it.",
"Kỳ (YYYY-MM)": "Period (YYYY-MM)",
"Kỳ GL Input không khớp kỳ báo cáo.": "The GL Input period does not match the reporting period.",
"Kỳ Price Master không khớp.": "Price Master period does not match.",
"Kỳ STEP 2 không khớp.": "STEP 2 period does not match.",
"Kỳ STEP 3 không khớp.": "STEP 3 period does not match.",
"Kỳ STEP 3A = kỳ báo cáo": "STEP 3A period = reporting period",
"Kỳ SX": "Prod. period",
"Kỳ báo cáo phải có dạng YYYY-MM, ví dụ 2026-08.": "The reporting period must be in the form YYYY-MM, e.g. 2026-08.",
"Kỳ của STEP 2 không phải kỳ hiện tại. Chạy lại STEP 2.": "The STEP 2 period is not the current period. Re-run STEP 2.",
"Kỳ giá thành đã đóng trên Cloud": "Costing period closed in the Cloud",
"Kỳ giá thành đã được cập nhật": "Costing period updated",
"Kỳ gốc": "Source period",
"Kỳ khác": "Different period",
"Kỳ không có PC lot nhưng vẫn có RM / 622 / 627 / direct allocation cần xử lý.": "The period has no PC lots but still has RM / 622 / 627 / direct allocations to handle.",
"Kỳ không phát sinh sản xuất; STEP 5 chỉ chạy tồn đầu kỳ / bán hàng.": "No production in the period; STEP 5 only runs opening stock / sales.",
"Kỳ không đọc được (dùng YYYY-MM)": "Period cannot be read (use YYYY-MM)",
"Kỳ nhập kho": "Receipt period",
"Kỳ này": "This period",
"Kỳ này STEP 3A không có vật tư WIP âm (CHECK NEGATIVE) – không cần BUILD / APPLY. Chuyển sang STEP 4.": "STEP 3A has no negative-WIP materials this period (CHECK NEGATIVE) – no BUILD / APPLY needed. Go to STEP 4.",
"Kỳ này còn mục REVIEW. Xác nhận đã được quản lý review trước khi đóng.": "This period still has REVIEW items. Confirm they were reviewed by management before closing.",
"Kỳ này có": "This period has",
"Kỳ này không có FG xuất rework (sổ 2B trống).": "No FG issued to rework this period (register 2B is empty).",
"Kỳ này vừa được ghi là CLOSED trên cloud; không xoá.": "This period has just been recorded as CLOSED in the cloud; not deleted.",
"Kỳ này vừa được lưu lại trên cloud trong lúc xoá; chưa xoá dữ liệu. Thử lại sau khi kiểm tra.": "This period was saved again in the cloud during the delete; data not deleted. Try again after checking.",
"Kỳ này đã từng CLOSED nên là hồ sơ kế toán lưu trữ; không được hard-delete. Chỉ REOPEN để điều chỉnh rồi CLOSE lại.": "This period was CLOSED before, so it is an archived accounting record; it cannot be hard-deleted. Only REOPEN to adjust, then CLOSE again.",
"Kỳ này đã từng CLOSED trong revision history; không được hard-delete.": "This period was CLOSED in the revision history; it cannot be hard-deleted.",
"Kỳ sản xuất": "Production period",
"Kỳ đã đóng hoặc bạn không có quyền sửa – chỉ xem.": "The period is closed or you have no edit rights – view only.",
"Kỳ đã đóng trên cloud – chỉ quản trị viên ghi được.": "The period is closed in the cloud – only administrators can write.",
"Kỳ đã đóng trên cloud; chỉ quản trị viên được ghi.": "The period is closed in the cloud; only administrators can write.",
"Kỳ đã đóng – cloud giữ nguyên bản đóng kỳ.": "The period is closed – the cloud keeps the closed version.",
"Kỳ đã đóng – mở lại kỳ (5.3) nếu cần xoá": "Period closed – reopen the period (5.3) if it must be deleted",
"Kỳ được chuyển sang chỉ đọc. Các Step không còn được chỉnh sửa.": "The period is now read-only. The steps can no longer be edited.",
"Loại xuất": "Issue type",
"Luân chuyển thành phẩm": "Finished-goods movement",
"Lãi gộp": "Gross margin",
"Lãi gộp theo dòng bán": "Gross margin by sales line",
"Lãi gộp theo giá bán": "Gross margin at selling price",
"Lô PC": "PC lot",
"Lô không có trong 4.4": "Lot not in 4.4",
"Lô không nhận 622/627 chung vì doanh thu theo giá bán − NVL ≤ 0: kiểm tra giá bán trong Price Master và NVL của lô.": "The lot receives no common 622/627 because revenue at selling price − RM ≤ 0: check the Price Master selling price and the lot's RM.",
"Lô lệch: mở PC-P và PC-M của PC No. đó trên ERP, cộng cột Total Cost của PC-M và so với PC-P.": "Lots with differences: open PC-P and PC-M for that PC No. in ERP, add up the PC-M Total Cost column and compare with PC-P.",
"Lô rework": "Rework lot",
"Lô sản xuất trong năm (gộp các dòng của lô). Bấm vào một lô để xem các dòng chi tiết và hoá đơn kỳ này.": "Lots produced in the year (lines of each lot combined). Click a lot to see its detail lines and this period's invoices.",
"Lô trong 4.4 không đủ số lượng còn tồn": "Lot in 4.4 does not have enough quantity in stock",
"Lý do / căn cứ": "Reason / basis",
"Lưu": "Save",
"Lưu xử lý": "Save handling",
"LỆCH GIÁ TRỊ": "VALUE MISMATCH",
"LỆCH SỐ LƯỢNG": "QUANTITY MISMATCH",
"Lệch đơn giá": "Price deviation",
"Lệch định mức": "Norm deviation",
"Lệch – cần xác nhận trước khi đóng kỳ": "Difference – confirm before month close",
"Lọc theo cột": "Filter by column",
"Lọc trạng thái MISSING PRICE / NOT IN PRICE MASTER ở bảng dưới; bổ sung giá ở tab Sales Order fallback hoặc Giá thủ công rồi Update Price Master.": "Filter status MISSING PRICE / NOT IN PRICE MASTER in the table below; add prices in the Sales Order fallback or Manual price tab, then Update Price Master.",
"Lỗi đồng bộ:": "Sync error:",
"Lỗi — file bị chặn, chưa import:": "Errors — files blocked, not imported:",
"Lỗi:": "Error:",
"Lớp FIFO": "FIFO layer",
"Lớp tô màu: giá vốn/đv cao hơn giá bán/đv. Mở \"Truy xuất\" của lô đó (tab Giá thành sản xuất) để xem vì sao giá thành cao.": "Highlighted layers: COGS/unit above price/unit. Open the \"Trace\" of that lot (Production cost tab) to see why its cost is high.",
"Lớp đã xuất bán": "Layers sold",
"Lớp đầu kỳ (OPENING) mang giá thành của kỳ gốc; lớp PRODUCTION mang giá thành kỳ này. Chênh lớn giữa các lớp thường do một lô có NVL/đv bất thường – mở tab Giá thành sản xuất để xem lô đó.": "Opening layers (OPENING) carry the cost of their source period; PRODUCTION layers carry this period's cost. A large gap between layers usually comes from one lot with abnormal RM/unit – open the Production cost tab to see that lot.",
"Lựa chọn xử lý FIFO (override) đã đổi": "FIFO override choices changed",
"MONTHLY lấy lớp cũ nhất còn lại sau bán hàng – dùng STRICT_DATE để FIFO theo ngày xuất": "MONTHLY takes the oldest layer left after sales – use STRICT_DATE for FIFO by issue date",
"Màn hình 5R → RUN STEP 5R": "Screen 5R → RUN STEP 5R",
"Mã": "Code",
"Mọi thay đổi được tự động lưu lên Firestore (đã nén).": "Every change is saved to Firestore automatically (compressed).",
"Mỗi dòng là một lô (hoặc một sản phẩm / tháng). Bắt buộc: Kỳ (YYYY-MM, cùng năm và trước kỳ dùng), Product Code, Complete Qty, Tổng giá thành (hoặc RM + 622 + 627). Không đổi tiêu đề dòng 4. Hướng dẫn chi tiết và ví dụ: sheet HUONG_DAN.": "Each line is one lot (or one product / month). Required: Period (YYYY-MM, same year and before the period used), Product Code, Complete Qty, Total cost (or RM + 622 + 627). Do not rename the row-4 headers. Detailed guide and examples: sheet HUONG_DAN.",
"Mỗi dòng là một lô còn tồn. Bắt buộc: PC No., Layer Date, Product Code, Qty, RM / 622 / 627 / Total Amount. Không đổi tiêu đề dòng 4 và dấu A1. Hướng dẫn chi tiết và ví dụ: sheet HUONG_DAN.": "Each line is one lot in stock. Required: PC No., Layer Date, Product Code, Qty, RM / 622 / 627 / Total Amount. Do not change the row-4 headers or the A1 marker. Detailed guide and examples: sheet HUONG_DAN.",
"Mỗi dòng là một phần của lô (PC No. + Product code). Có Cost month (YYYYMM) = đã ghi nhận giá vốn / đã xuất trong tháng đó; KHÔNG có Cost month = còn tồn. Tổng dòng chưa có Cost month = FG đầu kỳ. Không đổi tiêu đề dòng 4. Hướng dẫn: sheet HUONG_DAN.": "Each line is part of a lot (PC No. + Product code). With a Cost month (YYYYMM) = COGS recognised / issued in that month; WITHOUT a Cost month = still in stock. Total of lines without a Cost month = opening FG. Do not rename the row-4 headers. Guide: sheet HUONG_DAN.",
"Một phiên bản dữ liệu mới đã được lưu lên Cloud.": "A new data version has been saved to the Cloud.",
"Mở Opening WIP → Roll forward": "Open Opening WIP → Roll forward",
"Mở STEP 1": "Open STEP 1",
"Mở STEP 2": "Open STEP 2",
"Mở STEP 3A": "Open STEP 3A",
"Mở STEP 4": "Open STEP 4",
"Mở STEP 5": "Open STEP 5",
"Mở STEP 5.2": "Open STEP 5.2",
"Mở lại kỳ…": "Reopen period…",
"Mở trang này bằng": "Open this page in",
"Mở từ biểu tượng SVL Costing trên màn hình chính. Ứng dụng tự cập nhật khi có phiên bản mới.": "Open it from the SVL Costing icon on the home screen. The app updates itself when a new version is available.",
"Mức": "Level",
"NOT COSTED (PC No. không bắt đầu PC-)": "NOT COSTED (PC No. does not start with PC-)",
"NRV: so giá thành/đv của lớp với giá bán quy đổi (Price Master × tỷ giá). Tồn lâu: xác nhận với kho/bán hàng khả năng tiêu thụ, cân nhắc trích lập dự phòng.": "NRV: compare the layer's cost/unit with the converted selling price (Price Master × FX). Slow-moving: confirm saleability with warehouse/sales and consider a provision.",
"NVL / đv": "RM / unit",
"NVL vật tư chung theo định mức": "Common materials RM at norm",
"NVL vật tư chung thực tế": "Common materials RM actual",
"NVL/đv": "RM/unit",
"NVL/đv ÷ trung vị": "RM/unit ÷ median",
"Nguồn dòng": "Line source",
"Ngày HĐ / xuất": "Invoice / issue date",
"Ngày ghi nhận": "Recognition date",
"Ngày lô": "Lot date",
"Người duyệt: APPROVE / HOLD trong CONTROL": "Reviewer: APPROVE / HOLD in CONTROL",
"Người dùng khác": "Another user",
"Người xử lý": "Handled by",
"Nhân công 622": "Labour 622",
"Nhân công 622 / đv": "Labour 622 / unit",
"Nhóm": "Group",
"Nhóm Stock Out": "Stock Out group",
"Nhập FX / GL rồi chạy STEP 4": "Enter FX / GL, then run STEP 4",
"Nhập tỷ giá, GL 622, GL 627 của kỳ": "Enter the FX rate, GL 622 and GL 627 for the period",
"Năm mới – tồn kho": "New year – stock",
"Nếu PC-M thiếu hẳn: import lại file PC-M của hệ tương ứng ở STEP 1.": "If PC-M is missing entirely: re-import the PC-M file of that system in STEP 1.",
"O VE* (kèm SVL-VE) -> O VE*.": "O VE* (incl. SVL-VE) -> O VE*.",
"Opening WIP thay đổi sau STEP 3. Chạy lại STEP 3.": "Opening WIP changed after STEP 3. Re-run STEP 3.",
"PASS - ĐÃ XÁC NHẬN BẤT THƯỜNG": "PASS - ANOMALIES CONFIRMED",
"PC No. (lô)": "PC No. (lot)",
"PC-P ≠ tổng PC-M": "PC-P ≠ total PC-M",
"Phiên bản": "Version",
"Phiếu trả lại (MR-M)": "Return slips (MR-M)",
"Phiếu xuất kho (MI-M) của vật tư cho sản phẩm": "Material issue slips (MI-M) for the product",
"Phân bổ (VND)": "Allocated (VND)",
"Phân bổ 622/627": "622/627 allocation",
"Phải bằng 0 ở chế độ MONTHLY": "Must be 0 in MONTHLY mode",
"Qua các kỳ": "Across periods",
"Quan trọng / Khẩn": "Important / Urgent",
"Quyết định dòng nghi trùng đã đổi": "Suspected-duplicate decisions changed",
"Quyết định trước không còn áp dụng: phân bổ theo PC đã đổi (hoặc chưa có dấu vân tay) – duyệt lại": "The earlier decision no longer applies: the PC allocation changed (or has no fingerprint) – review again",
"RM gốc": "Original RM",
"RM gốc (PC + Stock Out)": "Original RM (PC + Stock Out)",
"RM lũy kế": "YTD RM",
"RUN FIFO để tính giá rework": "RUN FIFO to cost the rework",
"Return: no earlier invoice of this customer/product with returnable quantity – chọn hoá đơn gốc hoặc nhập đơn giá vốn ở STEP 5R;": "Return: no earlier invoice of this customer/product with returnable quantity – choose the original invoice or enter a unit cost in STEP 5R;",
"Review NRV (sau dự phòng)": "NRV review (after provision)",
"Rework chuyển vào": "Rework transferred in",
"Rework hoàn thành chuyển vào": "Completed rework transferred in",
"Rework hoàn thành – vào giá thành lô mới (qua STEP 4.3)": "Rework completed – into the cost of a new lot (via STEP 4.3)",
"Rework ra chi phí (hủy / không sửa được / hàng hỏng)": "Rework expensed (scrapped / not repairable / damaged)",
"Rework trả về kho": "Rework returned to stock",
"Rework trả về kho nguyên trạng": "Rework returned to stock unchanged",
"Roll forward / import FG đầu kỳ": "Roll forward / import opening FG",
"Roll forward / upload file đầu kỳ (mẫu chi tiết)": "Roll forward / upload opening file (detail layout)",
"S other -> T+O theo tỷ lệ R5a/R5b/R5c.": "S other -> T+O by the R5a/R5b/R5c shares.",
"SANDBOX – dữ liệu thử, không đồng bộ cloud": "SANDBOX – test data, no cloud sync",
"SL / Total Cost là chữ, không phải số": "Qty / Total Cost is text, not a number",
"SL / giá trị âm": "Negative qty / value",
"SL / sp bình quân": "Average qty / unit",
"SL / sản phẩm": "Qty / unit",
"SL > 0 nhưng giá thành ≤ 0": "Qty > 0 but cost ≤ 0",
"SL còn lại": "Qty remaining",
"SL còn tồn cuối của lô": "Lot closing qty in stock",
"SL hỏng": "Scrap qty",
"SL kỳ này": "Qty this period",
"SL lô": "Lot qty",
"SL lũy kế": "YTD qty",
"SL lấy": "Qty taken",
"SL lớp": "Layer qty",
"SL nhập kho": "Qty received",
"SL theo định mức": "Qty at norm",
"SL thực tế": "Actual qty",
"SL tiêu hao": "Qty consumed",
"SL trả": "Qty returned",
"SL vào": "Qty in",
"SL xuất bán": "Qty sold",
"SL xuất bán trong tháng": "Qty sold in the month",
"SL xuất rework": "Qty to rework",
"SL đã xuất bán": "Qty sold",
"SL đã xuất bán YTD": "YTD qty sold",
"SL đã xuất trước kỳ": "Qty issued before the period",
"SL đã xuất trước kỳ phải từ 0 đến Complete Qty": "Qty issued before the period must be between 0 and Complete Qty",
"SL – SX năm nay": "Qty – produced this year",
"SL – SX năm trước": "Qty – produced last year",
"STEP 2 - TIÊU HAO NVL": "STEP 2 - RM CONSUMPTION",
"STEP 2 chạy lại sau lần Update Price Master gần nhất": "STEP 2 re-run after the latest Update Price Master",
"STEP 2 còn checkpoint BLOCK. Xử lý/duyệt fallback trước khi chạy STEP 3.": "STEP 2 still has BLOCK checkpoints. Handle / approve the fallback before running STEP 3.",
"STEP 2 mới hơn STEP 3. Chạy lại STEP 3.": "STEP 2 is newer than STEP 3. Re-run STEP 3.",
"STEP 2 – Phân bổ Stock Out vào lô PC": "STEP 2 – Stock Out allocation to PC lots",
"STEP 3B chưa APPLY sau lần BUILD gần nhất (2 - APPLY & SYNC).": "STEP 3B not APPLIED after the latest BUILD (2 - APPLY & SYNC).",
"STEP 3B chưa BUILD.": "STEP 3B not BUILT.",
"STEP 3B đã đóng kỳ, không điều chỉnh WIP.": "STEP 3B closed the period with no WIP adjustment.",
"STEP 3B đóng không điều chỉnh: lý do quá ngắn (tối thiểu 5 ký tự).": "STEP 3B closed without adjustment: reason too short (at least 5 characters).",
"STEP 3B: INPUT / ERP map / STEP 3A đổi sau BUILD – BUILD lại.": "STEP 3B: INPUT / ERP map / STEP 3A changed after BUILD – BUILD again.",
"STEP 3B: INPUT / ERP map đã đổi sau BUILD": "STEP 3B: INPUT / ERP map changed after BUILD",
"STEP 4 BLOCKED – bổ sung giá / FX / GL / phân bổ trực tiếp.": "STEP 4 BLOCKED – add prices / FX / GL / direct allocations.",
"STEP 4 bị BLOCK.": "STEP 4 BLOCKED.",
"STEP 4 chưa có kết quả": "STEP 4 has no result",
"STEP 4 có giá thành / sản lượng nhưng 04_COST_ALLOCATION không có lô sản xuất.": "STEP 4 has cost / output but 04_COST_ALLOCATION has no production lots.",
"STEP 4 đã chạy lại": "STEP 4 re-run",
"STEP 4.3 đã thay đổi": "STEP 4.3 changed",
"STEP 5.2 OUTDATED – chạy lại RUN FIFO rồi STEP 5R": "STEP 5.2 OUTDATED – re-run RUN FIFO, then STEP 5R",
"STEP 5: FG đầu kỳ chưa VALIDATED hoặc STEP 4 chưa chạy được – chưa chạy FIFO.": "STEP 5: opening FG not VALIDATED or STEP 4 cannot run – FIFO not run.",
"STEP 5R cần chạy lại:": "STEP 5R needs to be re-run:",
"SVL - THÀNH PHẨM SẢN XUẤT LŨY KẾ TỪ ĐẦU NĂM (FILE ĐẦU KỲ CHO STEP 4.4)": "SVL - FG PRODUCED YEAR TO DATE (OPENING FILE FOR STEP 4.4)",
"SX chung 627 / đv": "Overhead 627 / unit",
"SX năm": "Produced in year",
"SX năm trước – SL": "Produced in prior year – qty",
"SX năm trước – VND": "Produced in prior year – VND",
"Sales Database mới hơn Price Master. Chạy Update Price Master.": "The Sales Database is newer than the Price Master. Run Update Price Master.",
"Sales Database trống.": "The Sales Database is empty.",
"Sales Database đang trống. Hãy Validate & Save doanh thu trước.": "The Sales Database is empty. Validate & Save the revenue first.",
"Sales Database đã lưu lại": "Sales Database saved again",
"Sandbox (thử nghiệm)": "Sandbox (testing)",
"Sau khi lưu: chạy lại STEP 4 (nếu hoàn thành → lô mới) rồi RUN FIFO để cập nhật giá trị.": "After saving: re-run STEP 4 (if completed → new lot), then RUN FIFO to update the values.",
"So sánh với các lô khác của sản phẩm": "Compared with the product's other lots",
"So với kỳ trước": "Vs previous period",
"Stock Out NVL phân bổ vào các lô": "RM Stock Out allocated to the lots",
"Stock Out lớn": "Large Stock Out",
"Stock Out phân bổ": "Stock Out allocated",
"Stock Out → lô PC": "Stock Out → PC lots",
"Sắp xếp từ dòng lỗ nhiều nhất.": "Sorted from the biggest loss.",
"Sắp xếp từ lớp có giá vốn/đv cao nhất.": "Sorted from the highest COGS/unit.",
"Số HĐ": "Invoice no.",
"Số NRV đã ghi FAST": "NRV amount booked in FAST",
"Số SP": "Products",
"Số chứng từ": "Document no.",
"Số dư đầu kỳ cần chuyển lại": "Opening balances need to be carried again",
"Số không hợp lệ": "Invalid number",
"Số lô / SL hoàn thành": "Lots / completed qty",
"Số lô dùng": "Lots using it",
"Số lô lệch": "Lots with difference",
"Số lượng hoàn thành": "Completed quantity",
"Số mã thành phẩm": "Finished-goods codes",
"Số âm (SL hoặc Total Cost)": "Negative (qty or Total Cost)",
"Sổ FG Rework được tạo khi chạy STEP 2.": "The FG Rework register is created when STEP 2 runs.",
"Sổ được tạo khi chạy STEP 2.": "The register is created when STEP 2 runs.",
"Sửa INPUT": "Fix INPUT",
"THAY ĐỔI – XÁC NHẬN LẠI": "CHANGED – CONFIRM AGAIN",
"THEO LÔ": "BY LOT",
"THIẾU": "SHORT",
"TIÊU HAO NVL – Nợ 632 / Có 152 (không phân bổ vào lô PC)": "RM CONSUMPTION – Dr 632 / Cr 152 (not allocated to PC lots)",
"TK chi phí": "Expense account",
"Template không có dòng dữ liệu (dữ liệu bắt đầu từ dòng 5).": "The template has no data rows (data starts at row 5).",
"Thao tác duyệt không hợp lệ.": "Invalid approval action.",
"Theo khoản mục (VND/sp)": "By cost element (VND/unit)",
"Theo từng lô": "By lot",
"Thiếu #notice-root": "#notice-root missing",
"Thiếu FG": "FG short",
"Thiếu FG cho cả kỳ (chế độ PRORATA)": "FG short for the whole period (PRORATA mode)",
"Thiếu PC No. (dòng theo sản phẩm, không theo lô)": "Missing PC No. (line per product, not per lot)",
"Thiếu Product Code": "Missing Product Code",
"Thiếu Product code": "Missing Product code",
"Thu gọn": "Collapse",
"Thành phẩm xuất đi rework (FIFO)": "Finished goods issued to rework (FIFO)",
"Tháng 1: roll forward để mang các dòng còn tồn từ tháng 12 sang (hoặc upload file chi tiết).": "January: roll forward to carry the lines still in stock from December (or upload the detail file).",
"Tháng sản xuất": "Production month",
"Tháng xuất": "Issue month",
"Thêm": "Add",
"Thêm dòng": "Add line",
"Thêm vào MH chính": "Add to Home Screen",
"Thông báo phát sinh khi dữ liệu đã được Cloud xác nhận. Chỉ hiển thị 80 bản ghi gần nhất.": "Notifications appear once the data is confirmed by the Cloud. Only the latest 80 records are shown.",
"Thấp nhất": "Lowest",
"Thời điểm (server)": "Time (server)",
"Thứ tự FIFO: lớp cũ nhất trước (ngày lô, lớp đầu kỳ trước lớp sản xuất).": "FIFO order: oldest layer first (lot date, opening layers before production layers).",
"Thực tế / định mức": "Actual / norm",
"Tiêu dùng nội bộ": "Internal consumption",
"Tiêu dùng nội bộ FG theo FIFO (tiêu hao)": "FG internal consumption by FIFO (consumption)",
"Tiêu dùng nội bộ FG: không đủ lớp FG": "FG internal consumption: not enough FG layers",
"Tiêu dùng nội bộ FG: không đủ lớp FG ngày ≤ ngày xuất": "FG internal consumption: no FG layers dated on or before the issue date",
"Tiêu hao (PC-M) SL": "Consumed (PC-M) qty",
"Tiêu hao (VND)": "Consumption (VND)",
"Tiêu hao GT": "Consumed value",
"Tiêu hao NVL – xuất thẳng vào 632": "RM consumption – issued directly to 632",
"Tiêu hao SL": "Consumed qty",
"Tiêu hao giá trị": "Consumed value",
"Toàn bộ hàng trả lại đã khớp hoá đơn gốc và giảm giá vốn đúng giá gốc.": "All returns are matched to their original invoices and COGS is reduced at the original cost.",
"Toàn bộ vật tư xuất cho MO trong kỳ (một MO có thể gồm nhiều lô PC).": "All materials issued to the MO in the period (one MO can cover several PC lots).",
"Treo · hoàn thành · chi phí": "Pending · completed · expensed",
"Trong đó SX năm": "Of which produced in year",
"Trong đó xuất rework – SL": "Of which issued to rework – qty",
"Trung vị (STEP 4)": "Median (STEP 4)",
"Trung vị NVL / đv các lô": "Median RM / unit of the lots",
"Trung vị giá thành / đv": "Median cost / unit",
"Truy xuất chi tiết": "Detailed trace",
"Truy xuất giá thành": "Cost trace",
"Trùng ERP + PC No. + Product Code:": "Duplicate ERP + PC No. + Product Code:",
"Trùng:": "Duplicates:",
"Trạng thái STEP 2 chưa PASS.": "STEP 2 status is not PASS.",
"Trạng thái đã đọc đang lưu trên thiết bị này; chưa đồng bộ giữa các thiết bị.": "Read state is stored on this device; not synced across devices.",
"Trả hàng (có SL)": "Return (with qty)",
"Trả lại (MR) SL": "Returned (MR) qty",
"Trả lại SL": "Returned qty",
"Tuổi (ngày)": "Age (days)",
"Tài khoản của bạn chỉ có quyền xem. Nhờ quản trị viên cấp quyền Chỉnh sửa nếu cần.": "Your account has view-only access. Ask an administrator for Edit access if needed.",
"Tên": "Name",
"Tạm giữ": "On hold",
"Tạo kỳ": "Create period",
"Tất cả các bước đã PASS – CLOSE MONTH.": "All steps PASS – CLOSE MONTH.",
"Tất cả kỳ": "All periods",
"Tất cả lớp FIFO của sản phẩm": "All FIFO layers of the product",
"TẮT": "OFF",
"TẮT tiêu hao (phân bổ vào lô PC)": "Turn consumption OFF (allocate to PC lots)",
"Tồn lâu": "Slow-moving",
"Tồn đầu kỳ": "Opening stock",
"Tồn đầu kỳ – SL": "Opening stock – qty",
"Tồn đầu kỳ – VND": "Opening stock – VND",
"TỔNG GIÁ THÀNH": "TOTAL COST",
"Tổng NVL": "Total RM",
"Tổng Total Cost PC-M (VND)": "Total PC-M Total Cost (VND)",
"Tổng chi tiết PC-M": "PC-M detail total",
"Tổng dòng chưa có Cost month của 4.4 = FG đầu kỳ (5.1) và = FG cuối kỳ sau FIFO (5.2)": "Total of 4.4 lines without a Cost month = opening FG (5.1) and = closing FG after FIFO (5.2)",
"Tổng giá thành": "Total cost",
"Tổng giá thành (VND)": "Total cost (VND)",
"Tổng giá trị NVL trên PC-P của từng lô so với tổng các dòng vật tư PC-M cùng PC No.": "Total RM value of each lot on PC-P vs the total of the PC-M material lines with the same PC No.",
"Tỷ giá · chi phí": "FX · costs",
"Tỷ lệ": "Ratio",
"Tỷ lệ NRV": "NRV rate",
"Tỷ lệ chi phí bán hàng (NRV) đã đổi": "Selling cost rate (NRV) changed",
"Tỷ lệ phân bổ": "Allocation share",
"Validate & lưu doanh thu": "Validate & save revenue",
"Vào lô mới": "New lot",
"VƯỢT": "OVER",
"Vẫn import?": "Import anyway?",
"Vật tư SL ≠ 0 nhưng Total Cost = 0": "Materials with qty ≠ 0 but Total Cost = 0",
"Vật tư WIP âm (CHECK NEGATIVE) ở STEP 3A": "Negative-WIP materials (CHECK NEGATIVE) in STEP 3A",
"Vật tư của lô so với định mức các lô khác": "Lot materials vs the norm of other lots",
"Vật tư giá trị 0 (PC-M & WIP = 0 VND) – chia theo SL, ghi sổ 0 VND": "Zero-value materials (PC-M & WIP = 0 VND) – split by qty, posted 0 VND",
"Vật tư số âm hoặc sai kiểu dữ liệu · đơn giá xuất NVL bất thường (MI-M trong kỳ)": "Negative or wrong-type materials · abnormal material issue price (MI-M in the period)",
"Vật tư × lô": "Materials × lots",
"Vật tư đã xuất kho nhưng chưa vào lô hoàn thành nào: phần này nằm trong WIP cuối kỳ (STEP 3).": "Materials issued but not yet in any completed lot: this part sits in closing WIP (STEP 3).",
"WIP cuối = Closing ERP (không điều chỉnh)": "Closing WIP = ERP closing (no adjustment)",
"WIP âm → lô PC": "Negative WIP → PC lots",
"Worker lỗi": "Worker error",
"Xem lại WIP âm còn lại / sổ 632": "Review remaining negative WIP / account 632",
"Xem lại cầu nối STEP 4": "Review the STEP 4 bridges",
"Xem đối chiếu 4.4 ↔ STEP 5 (chênh lệch)": "View the 4.4 ↔ STEP 5 reconciliation (differences)",
"Xoá": "Delete",
"Xoá dữ liệu giá thành lưu trên máy này khi đăng xuất? (Nên chọn OK nếu là máy dùng chung. Dữ liệu trên cloud không bị ảnh hưởng.)": "Delete the costing data stored on this device when signing out? (Choose OK on a shared computer. Cloud data is not affected.)",
"Xoá toàn bộ dữ liệu giá thành lưu trên máy này? Dữ liệu trên cloud không bị ảnh hưởng.": "Delete all costing data stored on this device? Cloud data is not affected.",
"Xung đột cloud –": "Cloud conflict –",
"Xuất Excel hồ sơ sản phẩm": "Export product file to Excel",
"Xuất kho": "Stock issue",
"Xuất kho (MI) SL": "Issued (MI) qty",
"Xuất kho (MI) và trả lại (MR) là chứng từ kỳ này theo mã sản phẩm; tiêu hao (PC-M) là phần đã vào lô hoàn thành. Phần còn lại nằm trong WIP. Bấm một vật tư để xem theo từng lô.": "Issues (MI) and returns (MR) are this period's documents by product code; consumption (PC-M) is the part that went into completed lots. The rest sits in WIP. Click a material to see it by lot.",
"Xuất kho GT": "Issued value",
"Xuất kho SL": "Issued qty",
"Xuất kho giá trị": "Issued value",
"Xuất rework": "Issued to rework",
"Xuất rework – VND": "Issued to rework – VND",
"Xuất rework – giá trị": "Issued to rework – value",
"Xuất theo tháng (SL)": "Issued by month (qty)",
"Xuất đi rework": "Issued to rework",
"Xác nhận chênh lệch": "Confirm differences",
"Xác nhận fallback >5%": "Confirm fallback >5%",
"Xóa xác nhận": "Clear confirmation",
"Xử lý BLOCK trong CONTROL": "Clear BLOCKs in CONTROL",
"Xử lý các checkpoint STEP 3A, chạy lại STEP 3": "Clear the STEP 3A checkpoints, re-run STEP 3",
"Xử lý dòng trả lại": "Return line handling",
"Xử lý rework đã đổi (hoàn thành / trả về kho / ra chi phí)": "Rework handling changed (completed / returned to stock / expensed)",
"YTD · đầu kỳ · roll": "YTD · opening · roll",
"archive đóng kỳ": "closed-period archive",
"bấm Duyệt; không dùng để trả vượt số lượng còn lại của hoá đơn gốc. Nhập": "clicks Approve; it cannot be used to return more than the quantity left on the original invoice. Enter",
"chưa chạy STEP 2": "STEP 2 not run",
"chưa có STEP 5": "no STEP 5",
"chưa có số liệu": "no figures yet",
"chưa cập nhật": "not updated",
"chưa nhập": "not entered",
"chưa đọc": "unread",
"dòng": "lines",
"dòng FIFO kỳ này lấy từ lô không có / không đủ trong bảng 4.4 (xem tab Đối chiếu).": "FIFO lines this period took lots missing / short in the 4.4 table (see the Reconciliation tab).",
"giá trị": "value",
"giảm": "down",
"hệ": "system",
"khi hàng bán trước thời kỳ dùng web, kèm ghi chú, rồi bấm RUN STEP 5R lại.": "when the goods were sold before the web was used, with a note, then click RUN STEP 5R again.",
"không có cờ": "no flags",
"không tính giá vốn FIFO": "not costed by FIFO",
"khớp": "match",
"khớp đầu kỳ + vào − ra": "matches opening + in − out",
"kỳ trước": "previous period",
"kỳ đang xem": "period shown",
"lô sản xuất kỳ trước": "previous-period production lots",
"lệch": "difference",
"lớp FG đầu kỳ": "opening FG layers",
"mang tồn kho sang năm mới": "carry stock into the new year",
"một người dùng khác": "another user",
"người khác": "someone else",
"phù hợp bộ lọc": "matching the filter",
"register chưa đóng": "register not closed",
"sau lần chuyển gần nhất (chạy lại phân bổ / 3B / rework). Bấm": "after the latest transfer (allocation / 3B / rework re-run). Click",
"sau lần chuyển gần nhất – dòng tách theo Cost month chưa cập nhật. Bấm": "after the latest transfer – lines split by Cost month not updated. Click",
"số lượng": "quantity",
"thiết bị này": "this device",
"thấp": "low",
"tiêu dùng nội bộ (632 / 155)": "internal consumption (632 / 155)",
"tăng": "up",
"tất cả hệ": "all systems",
"và trên cloud": "and in the cloud",
"và ĐÓNG KỲ": "and CLOSED the period",
"xoá dòng": "delete line",
"· chuyển từ Sales Database cũ": "· moved from the old Sales Database",
"· đã ghi": "· booked",
"Áp dụng điều chỉnh về PC-M": "Apply adjustment to PC-M",
"Ít lô dùng": "Used by few lots",
"Đang APPLY STEP 3B…": "Running STEP 3B APPLY…",
"Đang BUILD STEP 3B…": "Running STEP 3B BUILD…",
"Đang Validate & Save doanh thu…": "Validating & saving revenue…",
"Đang Validate & Save hàng trả lại / giảm giá…": "Validating & saving returns / discounts…",
"Đang chạy FIFO COGS (bán hàng)…": "Running FIFO COGS (sales)…",
"Đang chạy STEP 2…": "Running STEP 2…",
"Đang chạy STEP 3…": "Running STEP 3…",
"Đang chạy STEP 4…": "Running STEP 4…",
"Đang chạy STEP 5R – hàng bán bị trả lại…": "Running STEP 5R – sales returns…",
"Đang chạy như ứng dụng": "Running as an app",
"Đang cập nhật Price Master…": "Updating Price Master…",
"Đang dùng file Excel Costing Master? Vào": "Using the Costing Master Excel file? Go to",
"Đang kết nối Google…": "Connecting to Google…",
"Đang tạo FG History…": "Building FG History…",
"Đang tải danh sách…": "Loading list…",
"Đang tải dữ liệu từ cloud…": "Loading data from the cloud…",
"Đang đọc file ERP…": "Reading ERP files…",
"Đang đồng bộ": "Syncing",
"Điều chỉnh": "Adjust",
"Điều chỉnh 3B": "3B adjustment",
"Điều chỉnh WIP 3B": "WIP adjustment 3B",
"Điều chỉnh WIP trực tiếp (3B) đã post": "Direct WIP adjustment (3B) posted",
"Điểm cần kiểm tra": "Points to check",
"ĐÃ XÁC NHẬN": "CONFIRMED",
"Đã bán": "Sold",
"Đã bán kỳ này": "Sold this period",
"Đã bỏ chọn": "Deselected",
"Đã chọn": "Selected",
"Đã có phiên bản mới của SVL Costing.": "A new version of SVL Costing is available.",
"Đã lưu nhưng CHƯA gửi duyệt được:": "Saved but NOT sent for approval:",
"Đã lưu và gửi duyệt đơn giá. Bấm RUN STEP 5R sau khi được duyệt.": "Saved and sent the unit cost for approval. Click RUN STEP 5R once it is approved.",
"Đã mở lại kỳ giá thành": "Costing period reopened",
"Đã xuất (file đầu kỳ)": "Issued (opening file)",
"Đã xác nhận bởi": "Confirmed by",
"Đã đóng kỳ giá thành": "Costing period closed",
"Đóng": "Close",
"Đóng kỳ": "Month close",
"Đăng nhập Google": "Sign in with Google",
"Đăng nhập Google để chỉnh sửa dữ liệu.": "Sign in with Google to edit data.",
"Đăng nhập bằng Google": "Sign in with Google",
"Đơn giá": "Unit cost",
"Đơn giá / sp": "Unit cost / unit",
"Đơn giá RM (kiểm tra STEP 4)": "RM unit cost (STEP 4 check)",
"Đơn giá bình quân": "Average unit cost",
"Đơn giá bình quân YTD": "YTD average unit cost",
"Đơn giá các lớp FIFO đã xuất bán": "Unit cost of the FIFO layers sold",
"Đơn giá kỳ này": "Unit cost this period",
"Đơn giá lô": "Lot unit cost",
"Đơn giá nhập tay phải lớn hơn 0.": "The manual unit cost must be greater than 0.",
"Đơn giá tiêu hao BQ": "Average consumption unit cost",
"Đơn giá vật tư": "Material unit cost",
"Đơn giá vốn": "Unit cost",
"Đơn giá vốn/sp (VND)": "Unit cost/unit (VND)",
"Đơn giá xuất kho BQ": "Average issue unit cost",
"Đơn giá đã đổi sau khi gửi duyệt – người gửi cần gửi lại.": "The unit cost changed after the approval request – the requester must resend it.",
"Định mức": "Norm",
"Định mức /sp": "Norm /unit",
"Định mức = trung vị SL/sp của vật tư ở các lô có dùng (chỉ tính vật tư có ở ≥ 50% số lô). Giá trị theo định mức = định mức × SL lô × đơn giá bình quân của sản phẩm.": "Norm = median qty/unit of the material in the lots that use it (only materials used in ≥ 50% of lots). Value at norm = norm × lot qty × the product's average unit cost.",
"Định mức tiêu hao": "Consumption norm",
"Định mức trung vị /sp": "Median norm /unit",
"Đọc tất cả": "Mark all read",
"Đọc từ Sales Database cũ": "Read from the old Sales Database",
"Đối chiếu PC-P ↔ PC-M theo lô": "PC-P ↔ PC-M reconciliation by lot",
"Đối chiếu STEP 2 chưa PASS.": "STEP 2 reconciliation not PASS.",
"Đối chiếu kế toán STEP 3 chưa PASS.": "STEP 3 accounting reconciliation not PASS.",
"Đổi chế độ FIFO": "FIFO mode changed",
"đang Active": "active",
"đang theo dõi revision Cloud, chưa có chi tiết chỉnh sửa hoặc Step. Admin cần publish Firestore Rules v1.14.43 để bật đầy đủ thông báo realtime.": "following Cloud revisions, no edit or step detail yet. An admin needs to publish Firestore Rules v1.14.43 to enable full realtime notifications.",
"đang tải…": "loading…",
"đã lưu trên Cloud. Chế độ tương thích không có chi tiết thao tác / Step.": "saved to the Cloud. Compatibility mode has no action / step detail.",
"đã thay đổi trạng thái sau khi dữ liệu được cập nhật.": "changed status after the data was updated.",
"đã từng đóng – đang mở lại": "closed before – reopened",
"đã xác nhận": "confirmed",
"đơn giá": "unit cost",
"để cập nhật số liệu.": "to update the figures.",
"để nạp nguyên một kỳ từ file .xlsm.": "to load a whole period from the .xlsm file.",
"Ảnh hưởng": "Impact",
"Ảnh hưởng trên tồn cuối": "Impact on closing stock",
"Ảnh hưởng đơn giá": "Price impact",
"Ảnh hưởng định mức": "Norm impact",
"Ẩn kỳ…": "Hide period…",
"– chưa được tính. Xem tab \"Số đầu kỳ\", sửa file rồi upload lại.": "– not counted. See the \"Opening figures\" tab, fix the file and upload again.",
"– kiểm tra file xuất ERP trước khi chạy STEP 2:": "– check the ERP export before running STEP 2:",
"– sẽ tự thử lại.": "– will retry automatically.",
"– đã đóng kỳ": "– period closed",
"— PC-P đã import lại sau điều chỉnh, điều chỉnh không còn khớp dữ liệu.": "— PC-P was re-imported after the adjustment; the adjustment no longer matches the data.",
"→ bấm nút": "→ tap the",
"→ dùng “Ẩn kỳ”.": "→ use “Hide period”.",
"− Xuất bán (FIFO)": "− Sold (FIFO)",
"− Xuất rework": "− Issued to rework"
};
export const SRC_WILD = [
["Đơn giá xuất NVL (MI-M) · {*} dòng · {*} bất thường", "Material issue unit cost (MI-M) · {*} lines · {*} abnormal"],
["{*} dòng xuất NVL đơn giá bất thường", "{*} lines with abnormal material issue prices"],
["Đơn giá lô PC (PC-P) · {*} lô · {*} bất thường", "PC-lot unit cost (PC-P) · {*} lots · {*} abnormal"],
["{*} lô PC bất thường (PC-P)", "{*} abnormal PC lots (PC-P)"],
["• PC-P hệ {*}: {*} lô bất thường, {*} mã SP", "• PC-P system {*}: {*} abnormal lots, {*} product codes"],
["Đơn giá xuất NVL (MI-M) · {*} dòng · {*} bất thường · tham khảo, không chặn STEP 2", "Material issue unit cost (MI-M) · {*} lines · {*} abnormal · for reference, not blocking STEP 2"],
["Chưa có dữ liệu PC-P trong kỳ {*}.", "No PC-P data in period {*}."],
["{*} lô · {*} mã sản phẩm · {*} lô bất thường · chưa có PC-P hệ {*}", "{*} lots · {*} product codes · {*} abnormal lots · no PC-P for system {*}"],
["{*} lô · {*} mã sản phẩm · {*} lô bất thường", "{*} lots · {*} product codes · {*} abnormal lots"],
["Đơn giá lệch {*} % so với chuẩn", "Unit cost {*} % vs reference"],
["Validate & Save doanh thu bán hàng ({*})", "Validate & Save sales revenue ({*})"],
["Validate & Save hàng trả lại / giảm giá ({*})", "Validate & Save returns / discounts ({*})"],
["Kỳ {*}: cả máy này và cloud đều có thay đổi.", "Period {*}: both this computer and the cloud have changes."],
["Cloud: cập nhật {*} bởi {*}.", "Cloud: updated {*} by {*}."],
["Kỳ {*} CHƯA ĐÓNG.", "Period {*} is NOT CLOSED."],
["Kỳ {*} chưa đóng. Lý do: {*}", "Period {*} not closed. Reason: {*}"],
["Thay thế toàn bộ dòng cũ từ {*} đến {*}: {*} dòng", "Replace all old lines from {*} to {*}: {*} lines"],
["Thay thế dòng trả lại cũ từ {*} đến {*}: {*} dòng", "Replace old return lines from {*} to {*}: {*} lines"],
["Thêm mới từ file: {*} dòng", "Add from file: {*} lines"],
["Giữ nguyên ngoài khoảng: {*} dòng", "Kept outside the range: {*} lines"],
["Bỏ qua {*} dòng SALES RETURN / CREDIT NOTE (import ở màn hình 5R)", "Skipped {*} SALES RETURN / CREDIT NOTE lines (import on screen 5R)"],
["Kỳ có {*} dòng hàng trả lại → bước tiếp: RUN STEP 5R ở màn hình 5R.", "The period has {*} return lines → next: RUN STEP 5R on screen 5R."],
["Kỳ có {*} dòng trả lại có SL → RUN STEP 5R.", "The period has {*} return lines with qty → RUN STEP 5R."],
["Kỳ {*} đã ĐÓNG{*}. Rework WIP chuyển kỳ: {*} dòng / {*} VND. Bước tiếp: tạo kỳ {*} → Roll forward.", "Period {*} CLOSED{*}. Rework WIP carried forward: {*} lines / {*} VND. Next: create period {*} → Roll forward."],
["Đã lưu {*} dòng doanh thu (REVIEW {*}, thay thế {*} dòng cũ){*}. Price Master → OUTDATED, hãy Update Price Master.", "Saved {*} revenue lines (REVIEW {*}, replaced {*} old lines){*}. Price Master → OUTDATED, please run Update Price Master."],
[
"Cloud có revision mới (#{*}).",
"The cloud has a new revision (#{*})."
],
[
"{*} đã cập nhật kỳ {*}{*}. Dữ liệu trên màn hình có thể đã cũ; hệ thống chặn chỉnh sửa để tránh ghi đè.",
"{*} updated period {*}{*}. The data on screen may be out of date; editing is blocked to avoid overwriting."
],
[
"Kỳ {*} trên cloud mới hơn (cập nhật {*} bởi {*}). Tải bản cloud về máy này?",
"Period {*} in the cloud is newer (updated {*} by {*}). Load the cloud version to this device?"
],
[
"Kỳ {*} còn thay đổi CHƯA đồng bộ lên cloud và sẽ MẤT. Vẫn xoá toàn bộ dữ liệu trên máy này?",
"Period {*} has changes NOT yet synced to the cloud and they will be LOST. Delete all data on this device anyway?"
],
[
"{*} · chờ đồng bộ kỳ {*}",
"{*} · waiting to sync period {*}"
],
[
"SVL – Starry Vietnam Co., Ltd. · Kỳ {*} · {*} · Xuất lúc {*}",
"SVL – Starry Vietnam Co., Ltd. · Period {*} · {*} · Exported {*}"
],
[
"{*} báo cáo",
"{*} reports"
],
[
"{*} dòng treo quá {*} tháng",
"{*} lines pending over {*} months"
],
[
"{*}/{*} đã xử lý",
"{*}/{*} handled"
],
[
"Kỳ đã đóng. Tạo kỳ {*} và roll forward.",
"Period closed. Create period {*} and roll forward."
],
[
"Lệch {*}",
"Difference {*}"
],
[
"Điều chỉnh 3B: {*}{*}",
"3B adjustment: {*}{*}"
],
[
"{*} FG khả dụng",
"{*} of FG available"
],
[
"Kiểm tra dữ liệu ERP: PC-P = PC-M ở mọi hệ ({*}); không có dòng vật tư bất thường ở PC-M / MI-M / MR-M.",
"ERP data check: PC-P = PC-M in every system ({*}); no abnormal material lines in PC-M / MI-M / MR-M."
],
[
"{*} PC lệch PC-P / PC-M",
"{*} PCs with PC-P / PC-M difference"
],
[
"{*} dòng SL ≠ 0 nhưng Total Cost = 0",
"{*} lines with qty ≠ 0 but Total Cost = 0"
],
[
"{*} dòng số âm / sai kiểu",
"{*} negative / wrong-type lines"
],
[
"{*} dòng xuất NVL đơn giá bất thường",
"{*} material issue lines with abnormal unit cost"
],
[
"lúc {*}: {*}",
"at {*}: {*}"
],
[
"sau lần xác nhận {*} của {*} – cần xác nhận lại.",
"after the confirmation of {*} by {*} – confirm again."
],
[
"Xác nhận lại phần {*}",
"Confirm part {*} again"
],
[
"Xác nhận phần {*}",
"Confirm part {*}"
],
[
"A · Chênh lệch PC-P và PC-M {*}",
"A · PC-P vs PC-M difference {*}"
],
[
"B · Vật tư SL ≠ 0 nhưng Total Cost = 0 {*}",
"B · Materials with qty ≠ 0 but Total Cost = 0 {*}"
],
[
"C · Vật tư số âm, sai kiểu dữ liệu hoặc đơn giá xuất NVL bất thường {*}",
"C · Negative, wrong-type or abnormally priced material issues {*}"
],
[
"Kiểm tra dữ liệu ERP: {*} {*}",
"ERP data check: {*} {*}"
],
[
"· chưa có MI-M hệ {*}",
"· no MI-M for system {*}"
],
[
"Chưa có dữ liệu MI-M trong kỳ {*}.",
"No MI-M data in period {*}."
],
[
"{*}: {*} dòng ({*}){*}",
"{*}: {*} rows ({*}){*}"
],
[
"Có dòng ngày ngoài kỳ {*}",
"Rows dated outside period {*}"
],
[
"Hệ {*}",
"System {*}"
],
[
"{*} báo cáo · {*} hệ",
"{*} reports · {*} systems"
],
[
"Đang đọc {*} ({*}/{*})…",
"Reading {*} ({*}/{*})…"
],
[
"{*} · {*} · {*} dòng",
"{*} · {*} · {*} rows"
],
[
"… (+{*} mã)",
"… (+{*} codes)"
],
[
"{*}: {*} dòng SL ≠ 0 nhưng Total Cost = 0 – chỉ thông tin: PC-M-S không dùng trong giá thành (hệ S không có lô PC).",
"{*}: {*} lines with qty ≠ 0 but Total Cost = 0 – information only: PC-M-S is not used in costing (system S has no PC lots)."
],
[
"{*}: {*} dòng SL ≠ 0 nhưng Total Cost = 0 ({*} vật tư: {*}). Xem và xác nhận ở mục \"Dữ liệu ERP bất thường\" bên dưới.",
"{*}: {*} lines with qty ≠ 0 but Total Cost = 0 ({*} materials: {*}). Review and confirm in \"ERP data anomalies\" below."
],
[
"Chọn dòng tiêu hao · {*} dòng Stock Out NVL kỳ này · đã chọn {*} dòng",
"Select consumption lines · {*} RM Stock Out lines this period · {*} lines selected"
],
[
"{*} hàng loạt {*} dòng ({*})",
"{*} in bulk {*} lines ({*})"
],
[
"Lần chạy gần nhất {*}",
"Last run {*}"
],
[
"ngoài kỳ {*}",
"outside period {*}"
],
[
"trống ngày {*}",
"date blank {*}"
],
[
"ngày lỗi {*}",
"invalid date {*}"
],
[
"thiếu cột Date {*}",
"Date column missing {*}"
],
[
"{*} · NVL phân bổ {*} · FG rework {*} dòng",
"{*} · RM allocated {*} · FG rework {*} lines"
],
[
"Đã tick {*} dòng · SL {*}",
"Ticked {*} lines · qty {*}"
],
[
"{*} dòng tiêu dùng nội bộ chưa được tính giá – chạy RUN FIFO (STEP 5.2) để ghi Nợ 632 / Có 155.",
"{*} internal consumption lines not yet costed – run RUN FIFO (STEP 5.2) to post Dr 632 / Cr 155."
],
[
"(đã đóng {*})",
"(closed {*})"
],
[
"kỳ {*} chưa đóng khi chuyển",
"period {*} not closed when carried"
],
[
"; lý do: {*}",
"; reason: {*}"
],
[
"Nguồn: Closing WIP {*} {*} · chuyển lúc {*}",
"Source: Closing WIP {*} {*} · carried at {*}"
],
[
"Đang đọc {*}…",
"Reading {*}…"
],
[
"{*} · {*} dòng · {*} VND · {*}",
"{*} · {*} rows · {*} VND · {*}"
],
[
"{*}{*} dòng / {*} VND từ {*} {*}",
"{*}{*} lines / {*} VND from {*} {*}"
],
[
"Closing WIP kỳ {*} đã thay đổi sau khi chuyển sang Opening WIP kỳ {*} – roll forward lại.",
"Closing WIP of period {*} changed after it was carried to the Opening WIP of period {*} – roll forward again."
],
[
"Opening WIP được chuyển khi kỳ {*} chưa đóng; kỳ {*} nay đã đóng – roll forward lại để dùng số chính thức.",
"Opening WIP was carried while period {*} was not closed; period {*} is now closed – roll forward again to use the official figures."
],
[
"Kỳ {*} đã MỞ LẠI sau khi số dư được chuyển sang kỳ {*} – đóng lại kỳ {*}, rồi roll forward lại trước khi đóng kỳ {*}.",
"Period {*} was REOPENED after its balances were carried to period {*} – close period {*} again, then roll forward again before closing period {*}."
],
[
"Rework WIP cuối kỳ {*} khác số đã chuyển sang B/F kỳ {*}{*}.",
"Closing rework WIP of period {*} differs from the amount carried as B/F to period {*}{*}."
],
[
"Đã điều chỉnh {*} dòng PC-P về PC-M · tổng {*} VND · {*} · {*} · lý do: {*}{*}",
"Adjusted {*} PC-P lines to PC-M · total {*} VND · {*} · {*} · reason: {*}{*}"
],
[
"Có {*} PC chỉ có ở PC-M và {*} PC chỉ có ở PC-P. Không điều chỉnh tự động được; kiểm tra lại file ERP.",
"{*} PCs only in PC-M and {*} PCs only in PC-P. Cannot adjust automatically; check the ERP files."
],
[
"Chênh lệch PC-M − PC-P: {*} VND ở {*} dòng. Áp dụng sẽ đặt Total Cost PC-P bằng PC-M cho từng PC và sản phẩm; số gốc được lưu để hoàn tác.",
"PC-M − PC-P difference: {*} VND on {*} lines. Applying sets the PC-P Total Cost equal to PC-M for each PC and product; the original figures are kept for undo."
],
[
"Vật tư={*}; Mới={*}; Closing={*}",
"Materials={*}; New={*}; Closing={*}"
],
[
"Đang tải nhật ký cloud… {*}",
"Loading cloud audit log… {*}"
],
[
"Nhật ký cloud: {*} sự kiện{*}",
"Cloud audit log: {*} events{*}"
],
[
"Hiện cả {*} kỳ đã ẩn",
"Also show {*} hidden periods"
],
[
"Đăng nhập Google để lưu và mở dữ liệu trên mọi máy. {*}",
"Sign in with Google to save and open data on any device. {*}"
],
[
"Không đọc được danh sách: {*}",
"Cannot read the list: {*}"
],
[
"Cập nhật lần cuối {*} bởi {*}",
"Last updated {*} by {*}"
],
[
"Đang đọc {*} (file lớn có thể mất 10–30 giây)…",
"Reading {*} (large files may take 10–30 seconds)…"
],
[
"Kỳ {*} trên web đã ĐÓNG – không ghi đè. Quản trị viên mở lại kỳ trước nếu thật sự cần.",
"Period {*} on the web is CLOSED – not overwritten. An administrator can reopen the period first if really needed."
],
[
"CẢNH BÁO: kỳ {*} còn thay đổi CHƯA đồng bộ lên cloud. OK = vẫn xoá dữ liệu trên máy này khi đăng xuất (mất các thay đổi đó). Huỷ = đăng xuất nhưng giữ dữ liệu trên máy.",
"WARNING: period {*} has changes NOT yet synced to the cloud. OK = still delete the data on this device when signing out (those changes are lost). Cancel = sign out but keep the data on this device."
],
[
"{*} dòng · tổng {*} VND · {*}",
"{*} lines · total {*} VND · {*}"
],
[
"{*} dòng · {*}",
"{*} lines · {*}"
],
[
"{*} · lỗi {*}",
"{*} · error {*}"
],
[
"• MI-M {*} {*} {*}: {*} dòng, lệch lớn nhất {*} %",
"• MI-M {*} {*} {*}: {*} lines, largest deviation {*} %"
],
[
"• PC-P vs PC-M hệ {*}: chênh {*} VND – {*} PC lệch, {*} chỉ ở PC-M, {*} chỉ ở PC-P",
"• PC-P vs PC-M system {*}: difference {*} VND – {*} PCs with difference, {*} only in PC-M, {*} only in PC-P"
],
[
"• {*}: {*} – {*} dòng, {*} vật tư",
"• {*}: {*} – {*} lines, {*} materials"
],
[
"Phần {*} ({*}) · {*} mục · {*}",
"Part {*} ({*}) · {*} items · {*}"
],
[
"Phần {*} ({*}) · xóa xác nhận · {*}",
"Part {*} ({*}) · confirmation cleared · {*}"
],
[
"{*} dòng tick · {*}",
"{*} lines ticked · {*}"
],
[
"{*} dòng · SL {*} · {*} · {*}",
"{*} lines · qty {*} · {*} · {*}"
],
[
"Đã xoá {*} báo cáo: {*} · Lý do: {*}",
"Cleared {*} reports: {*} · Reason: {*}"
],
[
"Tổng hợp phân bổ Stock Out · kỳ {*}",
"Stock Out allocation summary · period {*}"
],
[
"Đã lưu lên cloud (bản {*}).",
"Saved to the cloud (version {*})."
],
[
"Đã ẩn kỳ {*}.",
"Period {*} hidden."
],
[
"Kỳ {*} hiện lại trong danh sách.",
"Period {*} shown in the list again."
],
[
"Xoá toàn bộ kỳ {*}{*}",
"Delete the whole period {*}{*}"
],
[
"Sửa / xuất lại {*} báo cáo có lỗi ngày giao dịch trước khi chạy STEP 2",
"Fix / re-export {*} reports with transaction-date errors before running STEP 2"
],
[
"và {*} PC lệch PC-P / PC-M",
"and {*} PCs with PC-P / PC-M difference"
],
[
"Rà soát và xác nhận {*} dòng dữ liệu ERP bất thường{*} (STEP 1) trước khi chạy STEP 2",
"Review and confirm {*} abnormal ERP data lines{*} (STEP 1) before running STEP 2"
],
[
"Kỳ vọng = ngưỡng {*}% × tổng đã phân bổ; Chênh lệch = số tiền vượt ngưỡng (VND). Tỷ lệ thực tế {*}. Vượt ngưỡng phải được Quản trị xác nhận kèm lý do",
"Expected = threshold {*}% × total allocated; Difference = amount above the threshold (VND). Actual share {*}. Above the threshold must be confirmed by an Admin with a reason"
],
[
"Ghi sổ 0 VND: {*}",
"Posted 0 VND: {*}"
],
[
"Thiếu cột: {*} (dòng tiêu đề {*} của sheet {*}).",
"Missing columns: {*} (header row {*} of sheet {*})."
],
[
"Lô sản xuất {*} không trước kỳ {*} (lô của kỳ này lấy từ STEP 4.3)",
"Production lot {*} is not before period {*} (lots of this period come from STEP 4.3)"
],
[
"Tháng theo Date ({*}) khác tháng trên số PC ({*})",
"Month from Date ({*}) differs from the month in the PC number ({*})"
],
[
"Thiếu {*}",
"Missing {*}"
],
[
"Cột {*} không phải số",
"Column {*} is not a number"
],
[
"RM + Direct labors + Production cost lệch Total cost {*}",
"RM + Direct labors + Production cost differs from Total cost {*}"
],
[
"RM cost (L) lệch RM cost + RM cost (ST) {*}",
"RM cost (L) differs from RM cost + RM cost (ST) {*}"
],
[
"Cost month '{*}' không đọc được (dùng YYYYMM, ví dụ 202608)",
"Cost month '{*}' cannot be read (use YYYYMM, e.g. 202608)"
],
[
"Cost month {*} không trước kỳ {*} – coi là CÒN TỒN",
"Cost month {*} is not before period {*} – treated as IN STOCK"
],
[
"Cost month {*} trước tháng sản xuất {*}",
"Cost month {*} is before the production month {*}"
],
[
"{*} dòng {*}",
"{*} lines {*}"
],
[
"{*} – {*} Định dạng: {*}",
"{*} – {*} Format: {*}"
],
[
"SVL - THÀNH PHẨM SẢN XUẤT & TỒN KHO CHI TIẾT THEO DÒNG (STEP 4.4 · đầu kỳ {*})",
"SVL - FG PRODUCTION & STOCK DETAIL BY LINE (STEP 4.4 · opening {*})"
],
[
"Thành phẩm chi tiết theo dòng – đầu kỳ {*}",
"FG detail by line – opening {*}"
],
[
"TỔNG HỢP THEO COST MONTH – file đầu kỳ {*}",
"SUMMARY BY COST MONTH – opening file {*}"
],
[
"Dòng \"CÒN TỒN\" = FG đầu kỳ {*}: SL {*} · {*} VND{*}",
"\"IN STOCK\" lines = opening FG {*}: qty {*} · {*} VND{*}"
],
[
"4.4 tổng hợp theo cost month {*}",
"4.4 summary by cost month {*}"
],
[
"Kỳ {*} không thuộc năm {*}",
"Period {*} is not in year {*}"
],
[
"Kỳ {*} không trước kỳ {*} (số kỳ này lấy từ STEP 4.3)",
"Period {*} is not before period {*} (this period's figures come from STEP 4.3)"
],
[
"{*} không phải số",
"{*} is not a number"
],
[
"RM + 622 + 627 = {*} khác Tổng giá thành {*}",
"RM + 622 + 627 = {*} differs from Total cost {*}"
],
[
"Năm mới {*}",
"New year {*}"
],
[
"Kỳ {*} chưa chuyển kết quả STEP 4.3 vào bảng Thành phẩm SX lũy kế (mở kỳ {*} → 4.4 → Cập nhật từ STEP 4.3).",
"Period {*} has not moved its STEP 4.3 results into the FG produced (cumulative) table (open period {*} → 4.4 → Update from STEP 4.3)."
],
[
"{*}từ {*}",
"{*}from {*}"
],
[
"{*} → {*} ({*} tháng)",
"{*} → {*} ({*} months)"
],
[
"{*}-01 … tháng trước {*}",
"{*}-01 … month before {*}"
],
[
"Ví dụ: {*}",
"Example: {*}"
],
[
"{*} – {*} Định dạng: {*}{*}",
"{*} – {*} Format: {*}{*}"
],
[
"Thành phẩm SX lũy kế – file đầu kỳ {*}",
"FG produced (cumulative) – opening file {*}"
],
[
"THÀNH PHẨM SẢN XUẤT LŨY KẾ – TỔNG HỢP THEO THÁNG (file đầu kỳ {*})",
"FG PRODUCED (CUMULATIVE) – MONTHLY SUMMARY (opening file {*})"
],
[
"Số liệu của sheet FG_PRODUCTION · {*} dòng",
"Figures from sheet FG_PRODUCTION · {*} lines"
],
[
"Thành phẩm SX lũy kế – tổng hợp {*}",
"FG produced (cumulative) – summary {*}"
],
[
"{*} thao tác được ghi nhận trong lần lưu này.",
"{*} actions recorded in this save."
],
[
"Có {*} PC chỉ có ở PC-M và {*} PC chỉ có ở PC-P. Không tự điều chỉnh được; kiểm tra lại file ERP.",
"{*} PCs only in PC-M and {*} PCs only in PC-P. Cannot adjust automatically; check the ERP files."
],
[
"Thiếu PC-P-{*} để hoàn tác.",
"PC-P-{*} missing for the undo."
],
[
"PC-P đã thay đổi sau khi điều chỉnh ({*}). Không hoàn tác tự động.",
"PC-P changed after the adjustment ({*}). No automatic undo."
],
[
"Return: đơn giá vốn nhập tay {*} đang CHỜ DUYỆT – cần một người dùng khác người nhập ({*}) bấm Duyệt ở STEP 5R;",
"Return: manual unit cost {*} is AWAITING APPROVAL – a user other than the one who entered it ({*}) must click Approve in STEP 5R;"
],
[
"Return: Original Invoice {*} not found for product {*} – chọn hoá đơn khác hoặc nhập đơn giá vốn ở STEP 5R;",
"Return: Original Invoice {*} not found for product {*} – choose another invoice or enter a unit cost in STEP 5R;"
],
[
"Return qty {*} vượt số còn trả được {*} của hoá đơn {*} (vượt {*}); không dùng đơn giá tay để vượt hoá đơn gốc;",
"Return qty {*} exceeds the {*} still returnable on invoice {*} (over by {*}); a manual unit cost cannot be used to exceed the original invoice;"
],
[
"{*}-{*}: tên file ghi NO DATA nhưng có {*} dòng có số liệu. Đổi tên file (bỏ NO DATA) hoặc xuất lại báo cáo.",
"{*}-{*}: the file name says NO DATA but has {*} rows with figures. Rename the file (remove NO DATA) or re-export the report."
],
[
"{*} dòng ÂM (dòng Excel {*}{*}; vật tư {*})",
"{*} NEGATIVE rows (Excel rows {*}{*}; materials {*})"
],
[
"{*} dòng Quantity/Total Cost là chữ, không phải số (dòng Excel {*})",
"{*} rows with Quantity/Total Cost as text, not numbers (Excel rows {*})"
],
[
"PC-M-{*}: file bị CHẶN, chưa import. {*}. Sửa trên ERP rồi xuất lại PC-M.",
"PC-M-{*}: file BLOCKED, not imported. {*}. Fix in ERP and re-export PC-M."
],
[
"{*} - không phải file Excel",
"{*} - not an Excel file"
],
[
"Kỳ của file ERP ({*}) không khớp kỳ báo cáo {*}. Import bị CHẶN để tránh tính giá lẫn kỳ.",
"The ERP file period ({*}) does not match the reporting period {*}. Import BLOCKED to avoid mixing periods."
],
[
"Thiếu PC-P-{*}. Hãy import dữ liệu ERP trước.",
"PC-P-{*} missing. Import the ERP data first."
],
[
"Thiếu STOCK OUT-{*}. Hãy import dữ liệu ERP trước.",
"STOCK OUT-{*} missing. Import the ERP data first."
],
[
"Closing WIP được chọn là kỳ {*}, trong khi kỳ mở là {*}.",
"The selected Closing WIP is period {*}, while the open period is {*}."
],
[
"Opening WIP được chọn là kỳ {*}, trong khi kỳ báo cáo là {*}.",
"The selected Opening WIP is period {*}, while the reporting period is {*}."
],
[
"STEP 2 còn Stock Out chưa phân bổ {*}.",
"STEP 2 still has unallocated Stock Out {*}."
],
[
"Chưa có Opening WIP cho kỳ {*}. Import hoặc roll forward Opening WIP rồi Validate.",
"No Opening WIP for period {*}. Import or roll forward the Opening WIP, then Validate."
],
[
"Opening WIP kỳ {*} chưa sẵn sàng ({*}).",
"Opening WIP for period {*} is not ready ({*})."
],
[
"Thiếu dữ liệu {*}.",
"Missing data {*}."
],
[
"REVIEW - ERP CHANGED (kỳ {*}: {*})",
"REVIEW - ERP CHANGED (period {*}: {*})"
],
[
"Kỳ {*} chỉ có phát sinh ở hệ {*} ({*}) nhưng map đang là {*}. Xác nhận bằng User ERP Override.",
"Period {*} only has movements in system {*} ({*}) but the map is {*}. Confirm with User ERP Override."
],
[
"{*} vật tư có phát sinh kỳ này ở hệ ERP khác map – cần xác nhận (Review = ERP CHANGED).",
"{*} materials have movements this period in an ERP system different from the map – confirmation needed (Review = ERP CHANGED)."
],
[
"ERP MAP: {*} vật tư mới, {*} cần REVIEW.",
"ERP MAP: {*} new materials, {*} need REVIEW."
],
[
"STEP 2 chưa chạy cho kỳ {*}. Chạy STEP 2 trước.",
"STEP 2 has not run for period {*}. Run STEP 2 first."
],
[
"Column 'Total Cost' not found in PC-M-{*} (cần cho phân bổ theo giá trị).",
"Column 'Total Cost' not found in PC-M-{*} (needed for value-based allocation)."
],
[
"{*} ({*}, {*}/{*} dòng PC-M Total Cost ≤ 0, SL {*})",
"{*} ({*}, {*}/{*} PC-M lines with Total Cost ≤ 0, qty {*})"
],
[
"ACTUAL_USAGE đang chọn AMOUNT nhưng {*} vật tư có PC-M Total Cost tổng ≤ 0 (SL > 0): {*}. Không tự fallback sang QTY. Sửa PC-M trên ERP rồi import lại, hoặc chọn QTY như một ngoại lệ legacy có chủ ý.",
"ACTUAL_USAGE is set to AMOUNT but {*} materials have total PC-M Total Cost ≤ 0 (qty > 0): {*}. No automatic fallback to QTY. Fix PC-M in ERP and re-import, or deliberately choose QTY as a legacy exception."
],
[
"Không thể đóng STEP 3B với HOLD / NO ADJ: còn {*} vật tư CONTROL chưa PASS ({*}). Sửa DETAIL / BUILD rồi mới quyết định.",
"STEP 3B cannot close with HOLD / NO ADJ: {*} CONTROL materials not PASS ({*}). Fix DETAIL / BUILD before deciding."
],
[
"APPLY dừng, chưa post gì. Dòng APPROVE bị BLOCK: {*}; vật tư không có trong WIP: {*}.",
"APPLY stopped, nothing posted. APPROVE lines BLOCKed: {*}; materials not in WIP: {*}."
],
[
"APPLY dừng bởi kiểm tra chiều số dư: {*} dòng làm tăng |WIP ERP|. Xem lại INPUT / CONTROL.",
"APPLY stopped by the balance-direction check: {*} lines increase |ERP WIP|. Review INPUT / CONTROL."
],
[
"STEP 3B còn {*} vật tư CONTROL chưa PASS ({*}). HOLD không gỡ được BLOCK: sửa nguyên nhân rồi BUILD lại.",
"STEP 3B still has {*} CONTROL materials not PASS ({*}). HOLD cannot clear a BLOCK: fix the cause, then BUILD again."
],
[
"STEP 3B còn {*} dòng chưa có quyết định (APPROVE / HOLD / REVIEW).",
"STEP 3B still has {*} lines without a decision (APPROVE / HOLD / REVIEW)."
],
[
"STEP 3B có {*} dòng đã APPROVE nhưng chưa APPLY.",
"STEP 3B has {*} APPROVED lines not yet APPLIED."
],
[
"STEP 3B: {*} dòng đổi quyết định sau lần APPLY – bấm 2 - APPLY & SYNC lại.",
"STEP 3B: {*} lines changed decision after APPLY – click 2 - APPLY & SYNC again."
],
[
"STEP 3B còn {*} bút toán DIRECT_632 chưa ghi FAST (cột Record phải là RECORDED).",
"STEP 3B still has {*} DIRECT_632 entries not posted in FAST (the Record column must be RECORDED)."
],
[
"03_WIP_ALLOCATION chưa chạy cho kỳ {*}. Chạy STEP 3A trước.",
"03_WIP_ALLOCATION has not run for period {*}. Run STEP 3A first."
],
[
"{*} validation có {*} dòng BLOCK. Sửa Recognition/Bill Date, Transaction Type, Product/Quantity rồi Validate & Save lại.",
"{*} validation has {*} BLOCK rows. Fix Recognition/Bill Date, Transaction Type, Product/Quantity, then Validate & Save again."
],
[
"Chế độ YTD sẽ XOÁ toàn bộ doanh thu từ 01/01/{*} đến cuối kỳ {*} rồi thay bằng file này, nhưng file chỉ bắt đầu từ {*}/{*}/{*}. Các tháng 01–{*}/{*} sẽ bị mất. Không lưu. Với file theo tháng: chọn Chế độ = MONTHLY rồi chọn lại file; hoặc dùng file doanh thu đủ từ tháng 01.",
"YTD mode DELETES all revenue from 01/01/{*} to the end of period {*} and replaces it with this file, but the file only starts at {*}/{*}/{*}. Months 01–{*}/{*} would be lost. Not saved. For a monthly file: set Mode = MONTHLY and choose the file again; or use a revenue file complete from month 01."
],
[
"Price Master thuộc kỳ {*}",
"Price Master belongs to period {*}"
],
[
"BLOCK - MANUAL OVERLAP ({*} dòng hiệu lực)",
"BLOCK - MANUAL OVERLAP ({*} active lines)"
],
[
"{*}: dòng giá thủ công đã bị xoá sau lần cập nhật Price Master gần nhất.",
"{*}: a manual price line was deleted after the latest Price Master update."
],
[
"{*}: giá thủ công đã thay đổi sau lần cập nhật Price Master gần nhất.",
"{*}: the manual price changed after the latest Price Master update."
],
[
"{*}: nguồn giá thủ công đã thay đổi.",
"{*}: the manual price source changed."
],
[
"Staging doanh thu thuộc kỳ {*}, không phải kỳ {*}.",
"The revenue staging belongs to period {*}, not period {*}."
],
[
"Price Master chưa CURRENT ({*}). Chạy Update Price Master sau lần Validate & Save gần nhất.",
"Price Master is not CURRENT ({*}). Run Update Price Master after the latest Validate & Save."
],
[
"Thiếu Product Code ở PC-P-{*} ({*}).",
"Missing Product Code in PC-P-{*} ({*})."
],
[
"Stock Out phân bổ trên PC-P không khớp STEP 2. Chênh lệch {*}",
"Stock Out allocated on PC-P does not match STEP 2. Difference {*}"
],
[
"RM STEP 4 không khớp cầu nối WIP STEP 3 (RM lô PC + Stock Out phân bổ + tiêu hao 632/152). Chênh lệch {*}",
"STEP 4 RM does not match the STEP 3 WIP bridge (PC lot RM + allocated Stock Out + consumption 632/152). Difference {*}"
],
[
"Opening Period trên template (C2) là '{*}' nhưng kỳ đang mở là {*}.",
"The Opening Period in the template (C2) is '{*}' but the open period is {*}."
],
[
"cột {*} phải là '{*}' (đang là '{*}')",
"column {*} must be '{*}' (currently '{*}')"
],
[
"Không thấy template (A1 = {*}) hay sheet 'month detail' trong {*}.",
"No template (A1 = {*}) or 'month detail' sheet found in {*}."
],
[
"Không thấy dòng tiêu đề (PC No. / Product code / Complete Qty / Cost month) trong 30 dòng đầu của {*}.",
"No header row (PC No. / Product code / Complete Qty / Cost month) in the first 30 rows of {*}."
],
[
"Thiếu cột trong {*} (dòng tiêu đề {*}): {*}",
"Missing columns in {*} (header row {*}): {*}"
],
[
"Chưa có Closing FG của kỳ {*} trên web.",
"No Closing FG for period {*} on the web."
],
[
"Closing FG {*} chưa đối chiếu xong (Run Result = {*}). Sửa STEP 5 của {*} trước.",
"Closing FG {*} not fully reconciled (Run Result = {*}). Fix STEP 5 of {*} first."
],
[
"Opening FG đang ở trạng thái '{*}'. Chạy VALIDATE OPENING FG (không còn BLOCK) trước.",
"Opening FG is in status '{*}'. Run VALIDATE OPENING FG (no BLOCK left) first."
],
[
"Kỳ của Opening FG khác kỳ {*}.",
"The Opening FG period differs from period {*}."
],
[
"STEP 4 tổng thể chưa PASS ({*}).",
"STEP 4 overall not PASS ({*})."
],
[
"BLOCK - STRICT DATE REQUIRED: có {*} dòng FG Rework Active. Rework phải chạy STRICT_DATE để không lấy layer FG hoàn thành sau ngày xuất.",
"BLOCK - STRICT DATE REQUIRED: {*} active FG Rework lines. Rework must run STRICT_DATE so that FG layers completed after the issue date are not used."
],
[
"Rework trả về kho: {*}",
"Rework returned to stock: {*}"
],
[
"Kỳ {*} đã đóng lúc {*} bởi {*}.",
"Period {*} was closed at {*} by {*}."
],
[
"FG Rework Batch 8 = {*}. Mọi kiểm soát Rework FIFO phải PASS.",
"FG Rework Batch 8 = {*}. All Rework FIFO controls must PASS."
],
[
"Batch 7 (giá thành STEP 5) = {*}.",
"Batch 7 (STEP 5 cost) = {*}."
],
[
"FG History = {*}. Chạy BUILD FG HISTORY trước.",
"FG History = {*}. Run BUILD FG HISTORY first."
],
[
"Giá thành/đv {*} {*}% so với trung vị",
"Cost/unit {*} {*}% vs median"
],
[
"Lô {*}: giá thành đơn vị {*} = {*} so với trung vị các lô ({*}). Ảnh hưởng {*} VND.",
"Lot {*}: unit cost {*} = {*} vs the lot median ({*}). Impact {*} VND."
],
[
"Lô {*}: PC-P có NVL {*} nhưng PC-M-{*} không có dòng nào cùng PC No.",
"Lot {*}: PC-P has RM {*} but PC-M-{*} has no rows with the same PC No."
],
[
"Lô {*}: Total Cost trên PC-P ({*}) khác tổng chi tiết PC-M ({*}), chênh {*} VND.",
"Lot {*}: Total Cost on PC-P ({*}) differs from the PC-M detail total ({*}), difference {*} VND."
],
[
"Lô {*}: đóng góp ≤ 0 (doanh thu theo giá bán − RM) nên không nhận 622/627 chung. Kiểm tra giá bán / RM.",
"Lot {*}: contribution ≤ 0 (revenue at selling price − RM), so it receives no common 622/627. Check the selling price / RM."
],
[
"Lô {*}: giá thành {*} > giá bán quy đổi {*} VND/đv (GP {*}).",
"Lot {*}: cost {*} > converted selling price {*} VND/unit (GP {*})."
],
[
"Lô {*}: Stock Out phân bổ {*} VND = {*} RM của lô.",
"Lot {*}: allocated Stock Out {*} VND = {*} of the lot's RM."
],
[
"Lô {*}: nhận điều chỉnh WIP trực tiếp (3B) {*} VND.",
"Lot {*}: receives a direct WIP adjustment (3B) of {*} VND."
],
[
"Lô {*}: nhận giá trị rework hoàn thành {*} VND.",
"Lot {*}: receives completed rework value of {*} VND."
],
[
"Kỳ này chưa có dữ liệu PC-M-{*} (chưa import hoặc đã bị xoá) – không xem được chi tiết vật tư và không đối chiếu được PC-P ↔ PC-M cho các lô {*}. Import lại PC-M-{*} ở STEP 1.",
"No PC-M-{*} data this period (not imported or deleted) – material detail cannot be shown and PC-P ↔ PC-M cannot be reconciled for lots {*}. Re-import PC-M-{*} in STEP 1."
],
[
"{*} lô: dòng PC-M ghi Product Code / Sub-MO khác PC-P – đã ghép theo PC No. (cùng cách đối chiếu ở STEP 3).",
"{*} lots: PC-M lines show a Product Code / Sub-MO different from PC-P – matched by PC No. (same as the STEP 3 reconciliation)."
],
[
"Lô {*}: đơn giá RM {*} = {*}× trung vị ({*}). {*}. Ảnh hưởng {*} VND.",
"Lot {*}: RM unit cost {*} = {*}× median ({*}). {*}. Impact {*} VND."
],
[
"Giá bán dùng để phân bổ lấy từ: {*}.",
"The selling price used for allocation comes from: {*}."
],
[
"Đơn giá {*}",
"Unit cost {*}"
],
[
"Định mức {*}",
"Usage norm {*}"
],
[
"{*} {*}: đơn giá giữa các lô dao động {*} → {*} (bình quân {*}); {*}/{*} lô lệch > {*}%: {*}.",
"{*} {*}: unit cost across lots ranges {*} → {*} (average {*}); {*}/{*} lots deviate > {*}%: {*}."
],
[
"{*} {*}: số lượng/sp lệch > {*}% so với trung vị {*} {*}/sp ở {*} lô: {*}.",
"{*} {*}: qty per unit deviates > {*}% from the median {*} {*}/unit in {*} lots: {*}."
],
[
"{*} {*}: {*} dòng PC-M có số lượng hoặc giá trị âm.",
"{*} {*}: {*} PC-M lines with negative quantity or value."
],
[
"{*} {*}: tiêu hao {*} {*} nhưng giá trị 0 ở {*} lô (vật tư không tính giá / hàng miễn phí?).",
"{*} {*}: consumed {*} {*} but zero value in {*} lots (unpriced material / free goods?)."
],
[
"{*} {*}: đã xuất kho {*} {*} ({*} VND) cho sản phẩm nhưng chưa tiêu hao vào lô nào trong kỳ – nằm lại WIP.",
"{*} {*}: issued {*} {*} ({*} VND) for the product but not consumed in any lot this period – stays in WIP."
],
[
"{*} lô bất thường",
"{*} abnormal lots"
],
[
"Giá thành đơn vị {*} {*} {*} so với {*} ({*} – {*}). Thay đổi chủ yếu do {*} ({*}{*}/đv).",
"Unit cost {*} {*} {*} vs {*} ({*} – {*}). Mainly driven by {*} ({*}{*}/unit)."
],
[
"Giá vốn {*} > doanh thu {*} VND – lỗ gộp {*} ({*}).",
"COGS {*} > revenue {*} VND – gross loss {*} ({*})."
],
[
"{*} ({*}): giá vốn {*} > doanh thu {*} VND (lỗ {*}).",
"{*} ({*}): COGS {*} > revenue {*} VND (loss {*})."
],
[
"{*}: không đủ tồn kho FG để xuất bán ({*}).",
"{*}: not enough FG stock to sell ({*})."
],
[
"Giá vốn đơn vị {*} khác giá thành SX kỳ này {*} ({*}) do xuất bán từ lớp cũ theo FIFO.",
"Unit COGS {*} differs from this period's production cost {*} ({*}) because sales came from older FIFO layers."
],
[
"Các lớp đã xuất bán có đơn giá chênh lớn: {*} → {*} ({*}×). Kiểm tra lô có giá thành bất thường.",
"Sold layers have widely different unit costs: {*} → {*} ({*}×). Check lots with an abnormal cost."
],
[
"Lớp {*}: {*}",
"Layer {*}: {*}"
],
[
"Lớp {*} (lô {*}, ngày {*}): còn {*} sp sau {*} ngày.",
"Layer {*} (lot {*}, date {*}): {*} units left after {*} days."
],
[
"{*} sp xuất đi rework theo FIFO, giá trị {*} VND.",
"{*} units issued to rework by FIFO, value {*} VND."
],
[
"So sánh giá thành đơn vị với {*}",
"Unit cost compared with {*}"
],
[
"Kỳ trước lấy từ {*} ({*} sp).",
"Previous period taken from {*} ({*} units)."
],
[
"Giá thành/đv {*}",
"Cost/unit {*}"
],
[
"Dòng bán {*}",
"Sales line {*}"
],
[
"Ghi chú FIFO: {*}",
"FIFO note: {*}"
],
[
"Lớp FIFO {*}",
"FIFO layer {*}"
],
[
"PC-P và PC-M lệch {*} VND: mở PC {*} trên ERP, cộng Total Cost các dòng vật tư và so với Total Cost thành phẩm.",
"PC-P and PC-M differ by {*} VND: open PC {*} in ERP, add up the Total Cost of the material lines and compare with the finished-goods Total Cost."
],
[
"{*} vật tư mà phần lớn các lô khác đều dùng nhưng lô này không có (giá trị theo định mức ≈ {*} VND): kiểm tra phiếu xuất kho MI của MO {*} đã được ghi vào PC chưa, hoặc PC hoàn thành trước khi xuất vật tư.",
"{*} materials used by most other lots are missing in this lot (value at norm ≈ {*} VND): check whether the MI issue slips of MO {*} were posted to the PC, or the PC was completed before the materials were issued."
],
[
"{*} vật tư tiêu hao thấp hơn định mức > {*}%: kiểm tra số lượng xuất kho, ĐVT, xuất bổ sung ở kỳ sau.",
"{*} materials consumed below the norm by > {*}%: check issued quantities, units, and top-up issues in the next period."
],
[
"{*} vật tư tiêu hao cao hơn định mức > {*}%: kiểm tra hao hụt, xuất dư, hoặc vật tư của lô/MO khác bị ghi nhầm vào lô này.",
"{*} materials consumed above the norm by > {*}%: check losses, over-issues, or materials of another lot/MO posted to this lot by mistake."
],
[
"Lô {*}",
"Lot {*}"
],
[
"Phiếu xuất kho MI-M theo MO {*}",
"MI-M issue slips for MO {*}"
],
[
"Đơn giá trên PC-M là giá xuất kho ERP tính cho từng lô. So sánh với đơn giá trên phiếu MI (bình quân {*}) và giá mua trong kỳ; lô lệch nhiều thường do xuất từ lô hàng nhập giá khác hoặc giá tạm tính.",
"The PC-M unit cost is the ERP issue cost for each lot. Compare with the MI slip unit cost (average {*}) and purchase prices in the period; large deviations usually come from issues out of receipts at a different price or provisional prices."
],
[
"Định mức trung vị {*} {*}/sp. Lô lệch: kiểm tra BOM, ĐVT trên phiếu, xuất bổ sung / trả lại, hoặc vật tư của lô khác ghi nhầm vào lô này.",
"Median norm {*} {*}/unit. Deviating lots: check the BOM, the unit on the slip, top-up issues / returns, or materials of another lot posted here by mistake."
],
[
"Vật tư của {*} trong kỳ – {*}/{*} lô có dùng.",
"Materials of {*} in the period – used by {*}/{*} lots."
],
[
"'{*}' không phải số hợp lệ",
"'{*}' is not a valid number"
],
[
"'{*}' không rõ là {*}{*} hay {*}{*} – nhập {*}{*} (không dấu phân cách) hoặc {*}{*}",
"'{*}' is ambiguous: {*}{*} or {*}{*} – enter {*}{*} (no separators) or {*}{*}"
],
[
"Tài khoản {*} không có quyền truy cập.",
"Account {*} has no access."
],
[
"Tài khoản {*} chưa được cấp quyền dùng dữ liệu giá thành. Nhờ quản trị viên thêm email này trong Cài đặt → Người dùng & phân quyền.",
"Account {*} is not yet authorised for costing data. Ask an administrator to add this email in Settings → Users & permissions."
],
[
"Không kiểm tra được quyền ({*}) – đang chỉ xem dữ liệu trên máy. Kết nối lại rồi tải lại trang để chỉnh sửa.",
"Cannot check permissions ({*}) – viewing data on this device only. Reconnect and reload the page to edit."
],
[
"Kỳ này trên cloud đã được {*} cập nhật lúc {*} (bản {*}). Không ghi đè – hãy tải bản cloud về rồi làm lại thay đổi.",
"This period was updated in the cloud by {*} at {*} (version {*}). Not overwritten – load the cloud version and redo the change."
],
[
"Chunk {*} đã tồn tại nhưng nội dung không khớp content hash – dừng commit để bảo vệ revision history.",
"Chunk {*} already exists but its content does not match the content hash – commit stopped to protect the revision history."
],
[
"Đang tải {*}…",
"Loading {*}…"
],
[
"Thiếu dữ liệu {*} (phần {*}/{*}) trên cloud.",
"Missing data {*} (part {*}/{*}) in the cloud."
],
[
"Dữ liệu {*} trên cloud không khớp mã kiểm tra.",
"Data {*} in the cloud does not match its checksum."
],
[
"Không kết nối được thông báo: {*}",
"Cannot connect to notifications: {*}"
],
[
"Kỳ {*} · Rev #{*} · {*} · {*}",
"Period {*} · Rev #{*} · {*} · {*}"
],
[
"Không có thông báo{*}.",
"No notifications{*}."
],
[
"{*} chưa đọc · {*} gần nhất",
"{*} unread · latest {*}"
],
[
"Kỳ đang xem{*}",
"Current period{*}"
],
[
"{*} / {*} dòng",
"{*} / {*} lines"
],
[
"{*}: {*} lô · SL {*} · {*} VND · FIFO {*} dòng phân bổ",
"{*}: {*} lots · qty {*} · {*} VND · FIFO {*} allocation lines"
],
[
"Kỳ {*} đã đóng – chỉ xem.",
"Period {*} is closed – view only."
],
[
"Chưa chạy FIFO kỳ này – chưa có dòng Cost month {*}.",
"FIFO not run this period – no Cost month {*} lines yet."
],
[
"STEP 4.3 đang {*} – số kỳ này có thể còn đổi. Chạy lại STEP 4.3.",
"STEP 4.3 is {*} – this period's figures may still change. Re-run STEP 4.3."
],
[
"File đầu kỳ có {*} dòng lỗi",
"The opening file has {*} error lines"
],
[
"(trong đó lô năm trước {*} dòng · {*} VND)",
"(of which prior-year lots {*} lines · {*} VND)"
],
[
"{*} dòng REVIEW",
"{*} REVIEW lines"
],
[
"Số đầu kỳ: {*} · {*} dòng · {*} lô ·",
"Opening figures: {*} · {*} lines · {*} lots ·"
],
[
"còn tồn {*} dòng · SL {*} · {*} VND",
"in stock {*} lines · qty {*} · {*} VND"
],
[
"Số đầu kỳ (mẫu cũ theo lô): {*} · {*} dòng · tháng {*} · {*} VND{*}. Bảng chi tiết được dựng từ số theo lô; để có đủ lô năm trước còn tồn, upload file chi tiết theo dòng.",
"Opening figures (old lot layout): {*} · {*} lines · month {*} · {*} VND{*}. The detail table is built from the lot figures; to include all prior-year lots still in stock, upload the line-level detail file."
],
[
"({*}; {*} lô) – chỉ cảnh báo, không chặn. Xem tab",
"({*}; {*} lots) – warning only, not blocking. See tab"
],
[
"Chi tiết theo dòng ({*})",
"Line-level detail ({*})"
],
[
"({*} dòng chưa có Cost month).",
"({*} lines without a Cost month)."
],
[
": \"CÒN TỒN\" = dòng chưa ghi nhận giá vốn. Dòng Cost month {*} được app tách từ FIFO kỳ này (cột Chứng từ xuất = hoá đơn / phiếu rework).",
": \"IN STOCK\" = lines with no COGS recognised. Cost month {*} lines are split by the app from this period's FIFO (Issue document column = invoice / rework slip)."
],
[
"Mỗi dòng là một tháng ghi nhận giá vốn (Cost month); \"CÒN TỒN\" = tồn FG cuối kỳ {*} theo 4.4.",
"Each line is one COGS recognition month (Cost month); \"IN STOCK\" = closing FG stock {*} per 4.4."
],
[
"các bước khác. Quy tắc: tổng dòng chưa có Cost month của 4.4 = FG đầu kỳ (STEP 5.1) và = FG cuối kỳ sau FIFO (STEP 5.2). Kết quả: {*}",
"other steps. Rule: total of 4.4 lines without a Cost month = opening FG (STEP 5.1) and = closing FG after FIFO (STEP 5.2). Result: {*}"
],
[
"Lô {*} · {*} · nhập kho {*} · SL {*}",
"Lot {*} · {*} · received {*} · qty {*}"
],
[
"Mỗi dòng = một phần lô thành phẩm đã xuất cho một dòng hoá đơn (hoặc xuất rework) theo FIFO.{*}",
"Each line = part of a finished lot issued to an invoice line (or to rework) by FIFO.{*}"
],
[
"{*} · {*} · nạp {*} · {*} · BLOCK {*} · REVIEW {*}",
"{*} · {*} · loaded {*} · {*} · BLOCK {*} · REVIEW {*}"
],
[
"· còn tồn {*} dòng / SL {*} / {*} VND",
"· in stock {*} lines / qty {*} / {*} VND"
],
[
"{*} · {*} · {*} · {*} dòng · {*} VND{*} · BLOCK {*} · REVIEW {*}",
"{*} · {*} · {*} · {*} lines · {*} VND{*} · BLOCK {*} · REVIEW {*}"
],
[
"File đầu kỳ có {*} dòng lỗi – xem tab Số đầu kỳ.",
"The opening file has {*} error lines – see the Opening figures tab."
],
[
"Đã nạp {*} dòng chi tiết · còn tồn (chưa có Cost month) SL {*} · {*} VND.",
"Loaded {*} detail lines · in stock (no Cost month) qty {*} · {*} VND."
],
[
"Đã nạp {*} dòng số đầu kỳ ({*}) · {*} VND.",
"Loaded {*} opening lines ({*}) · {*} VND."
],
[
"{*} · {*} dòng · {*} VND",
"{*} · {*} lines · {*} VND"
],
[
"Đã {*}: {*} dòng · còn tồn SL {*} · {*} VND từ {*}.",
"{*}: {*} lines · in stock qty {*} · {*} VND from {*}."
],
[
"Bắt đầu năm {*} – không có số đầu kỳ.",
"Start of year {*} – no opening figures."
],
[
"Đã roll forward {*} dòng ({*}) · {*} VND từ {*}.",
"Rolled forward {*} lines ({*}) · {*} VND from {*}."
],
[
"Đến hết {*}{*}",
"Through {*}{*}"
],
[
"ĐỐI CHIẾU 4.4 ↔ STEP 5.1 / 5.2 – kỳ {*} (chỉ cảnh báo, không chặn)",
"RECONCILIATION 4.4 ↔ STEP 5.1 / 5.2 – period {*} (warning only, not blocking)"
],
[
"Bảng 4.4 kỳ {*} (gồm Cost month {*})",
"Table 4.4 period {*} (incl. Cost month {*})"
],
[
"· Đóng không điều chỉnh: {*}",
"· Closed without adjustment: {*}"
],
[
"INPUT chưa khớp WIP âm hiện tại: thiếu {*}, thừa {*}, basis khác {*}. Bấm “Đồng bộ INPUT với WIP âm” (giữ lựa chọn / lý do đã nhập).",
"INPUT does not match the current negative WIP: {*} missing, {*} extra, {*} with a different basis. Click “Sync INPUT with negative WIP” (choices / reasons entered are kept)."
],
[
"Đồng bộ INPUT với WIP âm{*}",
"Sync INPUT with negative WIP{*}"
],
[
"+{*} / −{*} / basis khác {*} → {*} vật tư",
"+{*} / −{*} / different basis {*} → {*} materials"
],
[
"[{*} quyết định cũ đã đặt lại – phân bổ theo PC đã đổi]",
"[{*} earlier decisions reset – the PC allocation changed]"
],
[
"· {*} vật tư giá trị 0 (PC-M & WIP = 0 VND) chia theo SL, ghi sổ 0 VND: {*}.",
"· {*} zero-value materials (PC-M & WIP = 0 VND) split by qty, posted 0 VND: {*}."
],
[
"{*}BUILD xong: {*} dòng detail,{*}/{*} vật tư PASS. {*}{*}",
"{*}BUILD done: {*} detail lines,{*}/{*} materials PASS. {*}{*}"
],
[
"HOLD={*}; REVIEW={*}; lý do: {*}",
"HOLD={*}; REVIEW={*}; reason: {*}"
],
[
"APPLY xong: {*} vật tư, điều chỉnh vào PC {*} VND.",
"APPLY done: {*} materials, {*} VND adjusted into PCs."
],
[
"{*} dòng = {*}",
"{*} lines = {*}"
],
[
"Giảm trừ doanh thu kỳ này (xem 5R): 5212 = {*} VND ({*} dòng) · 5213 = {*} VND ({*} dòng).",
"Revenue deductions this period (see 5R): 5212 = {*} VND ({*} lines) · 5213 = {*} VND ({*} lines)."
],
[
"Đã xác nhận hết (loại {*} dòng).",
"All confirmed ({*} lines excluded)."
],
[
"nhóm dòng doanh thu giống hệt nhau (cùng ngày, hoá đơn, sản phẩm, số lượng, tiền – file không có Invoice Line No.). {*}",
"groups of identical revenue lines (same date, invoice, product, quantity, amount – the file has no Invoice Line No.). {*}"
],
[
"Nghi trùng{*}",
"Suspected duplicates{*}"
],
[
"Kiểm tra giá PC{*}",
"PC price check{*}"
],
[
"Tất cả dòng lặp = {*}",
"All repeated lines = {*}"
],
[
"Lưu lần cuối {*} · {*} dòng doanh thu bán hàng. Sales Database được mang sang kỳ sau. Hàng trả lại / giảm giá:",
"Last saved {*} · {*} sales revenue lines. The Sales Database carries forward. Returns / discounts:"
],
[
"Cập nhật {*} · nguồn đến {*}",
"Updated {*} · source through {*}"
],
[
"{*} lô PC chưa có giá.",
"{*} PC lots without a price."
],
[
"{*} dòng PC-P có PC No. không bắt đầu bằng \"PC-\" – STEP 4 không tính giá thành cho các dòng này (giống workbook), nên không cần giá.",
"{*} PC-P lines have a PC No. not starting with \"PC-\" – STEP 4 does not cost these lines (as in the workbook), so no price is needed."
],
[
"{*} giá thủ công chưa được duyệt.",
"{*} manual prices not yet approved."
],
[
"{*} dòng; {*}",
"{*} lines; {*}"
],
[
"{*} · {*} dòng",
"{*} · {*} lines"
],
[
"Chuyển {*} dòng SALES RETURN / CREDIT NOTE từ Sales Database sang Returns Database (5R)",
"Move {*} SALES RETURN / CREDIT NOTE lines from the Sales Database to the Returns Database (5R)"
],
[
"Bỏ qua {*} dòng SALES RETURN / CREDIT NOTE (import ở màn hình 5R)",
"Skip {*} SALES RETURN / CREDIT NOTE lines (import them on screen 5R)"
],
[
"; bỏ {*} dòng thiếu ngày của lần lưu trước",
"; drop {*} undated lines from the previous save"
],
[
"{*} {*}→{*}: lưu {*} dòng; bỏ qua (trả lại / giảm giá) {*}; PASS {*}; REVIEW {*}; BLOCK {*}; lặp {*}; thay thế {*}{*}",
"{*} {*}→{*}: saved {*} lines; skipped (returns / discounts) {*}; PASS {*}; REVIEW {*}; BLOCK {*}; repeated {*}; replaced {*}{*}"
],
[
"; bỏ qua {*} dòng trả lại / giảm giá → import ở màn hình 5R",
"; skipped {*} return / discount lines → import on screen 5R"
],
[
"; {*} dòng trả lại cũ đã chuyển sang 5R",
"; {*} old return lines moved to 5R"
],
[
"{*} sản phẩm; thiếu giá {*}; manual overlap {*}; manual chưa duyệt {*}; manual date lỗi {*}; SO sau kỳ {*}; SO date lỗi {*}; cũ {*}",
"{*} products; missing price {*}; manual overlap {*}; manual not approved {*}; manual date error {*}; SO after period {*}; SO date error {*}; old {*}"
],
[
"thiếu giá {*}",
"missing price {*}"
],
[
"manual chưa duyệt {*}",
"manual not approved {*}"
],
[
"manual date lỗi {*}",
"manual date error {*}"
],
[
"SO sau kỳ {*}",
"SO after period {*}"
],
[
"SO date lỗi {*}",
"SO date error {*}"
],
[
"Price Master CURRENT – {*} sản phẩm có giá.",
"Price Master CURRENT – {*} products priced."
],
[
"{*}{*} % so với kỳ trước",
"{*}{*} % vs previous period"
],
[
"Lưu lúc {*}",
"Saved at {*}"
],
[
"bởi {*} lúc {*} · {*}",
"by {*} at {*} · {*}"
],
[
"{*} dòng Direct 622/627 chưa được duyệt.",
"{*} Direct 622/627 lines not yet approved."
],
[
"· đồng bộ 3B {*}",
"· 3B sync {*}"
],
[
"Thiếu giá: {*} · Phân bổ trực tiếp lỗi: {*} · FX/GL đủ: {*}",
"Missing price: {*} · Direct allocation errors: {*} · FX/GL complete: {*}"
],
[
"{*} · Ảnh hưởng tuyệt đối {*} VND · còn trong FG cuối kỳ {*} VND · {*}",
"{*} · Absolute impact {*} VND · still in closing FG {*} VND · {*}"
],
[
"{*} vật tư WIP âm chưa đưa vào STEP 3B – SYNC → BUILD → duyệt (APPROVE / HOLD) → APPLY.",
"{*} negative-WIP materials not yet in STEP 3B – SYNC → BUILD → review (APPROVE / HOLD) → APPLY."
],
[
"Direct 622/627 có {*} dòng Active chưa được duyệt (màn hình 4.2 → Duyệt Direct 622/627).",
"Direct 622/627 has {*} active lines not yet approved (screen 4.2 → Approve Direct 622/627)."
],
[
"BLOCKED · thiếu giá {*}; direct lỗi {*}",
"BLOCKED · missing price {*}; direct errors {*}"
],
[
"STEP 4 xong: {*} lô, giá thành {*} VND.",
"STEP 4 done: {*} lots, cost {*} VND."
],
[
"STEP 5 OUTDATED: {*}. Chạy lại theo thứ tự STEP 4 → RUN FIFO → BUILD FG HISTORY.",
"STEP 5 OUTDATED: {*}. Re-run in order STEP 4 → RUN FIFO → BUILD FG HISTORY."
],
[
"Số dư đầu kỳ đã lệch so với kỳ trước: {*}",
"Opening balances differ from the previous period: {*}"
],
[
"Sales Database có {*} dòng thiếu / sai ngày hoá đơn (vd. {*}) – không xác định được kỳ nên chưa tính giá vốn. Sửa ngày rồi import & lưu lại.",
"The Sales Database has {*} lines with a missing / invalid invoice date (e.g. {*}) – the period cannot be determined, so no COGS yet. Fix the date, then import & save again."
],
[
"Còn {*} dòng doanh thu nghi trùng trong kỳ chưa xác nhận (màn hình 4.1 → Nghi trùng).",
"{*} suspected duplicate revenue lines in the period are not yet confirmed (screen 4.1 → Suspected duplicates)."
],
[
"STEP 5R (hàng bán bị trả lại) chưa hoàn tất: {*}. Mở màn hình 5R → RUN STEP 5R.",
"STEP 5R (sales returns) not complete: {*}. Open screen 5R → RUN STEP 5R."
],
[
"STEP 5R Sales Return còn {*} giao dịch chưa xử lý đầy đủ (invoice gốc / số lượng / COGS reversal).",
"STEP 5R Sales Return still has {*} transactions not fully processed (original invoice / quantity / COGS reversal)."
],
[
"NRV đề xuất dự phòng {*} VND chưa có quyết định kế toán hiện hành (RECORDED hoặc NO ADJUSTMENT APPROVED).",
"The proposed NRV provision of {*} VND has no current accounting decision (RECORDED or NO ADJUSTMENT APPROVED)."
],
[
"Sales completeness BLOCK: web không có doanh thu 511 trong kỳ nhưng FAST = {*} VND. Không được override bằng approval – kiểm tra file doanh thu / Bill Date / phạm vi import.",
"Sales completeness BLOCK: the web has no 511 revenue in the period but FAST = {*} VND. Cannot be overridden by approval – check the revenue file / Bill Date / import range."
],
[
"Số liệu lệch FAST ở {*} tài khoản chưa được xác nhận (STEP 5.3 → Đối chiếu FAST → Xác nhận chênh lệch).",
"FAST differences on {*} accounts not yet confirmed (STEP 5.3 → FAST reconciliation → Confirm differences)."
],
[
"Hiển thị 500 / {*} dòng đầu, sắp theo chênh lệch.",
"Showing the first 500 / {*} lines, sorted by difference."
],
[
"{*} sp · {*} VND giảm giá vốn (theo giá vốn hoá đơn gốc)",
"{*} units · {*} VND COGS reduction (at the original invoice cost)"
],
[
"{*} VND – xử lý ở màn hình 5B (hoàn thành / trả về kho / ra chi phí)",
"{*} VND – handled on screen 5B (completed / returned to stock / expensed)"
],
[
"Chênh lệch đã xác nhận bởi {*}",
"Difference confirmed by {*}"
],
[
"Kỳ đã đóng – tạo kỳ {*}",
"Period closed – create period {*}"
],
[
"Chạy {*} · {*}s · {*}",
"Run {*} · {*}s · {*}"
],
[
"{*}. Chạy lại theo thứ tự (STEP 4 nếu cần) → RUN FIFO COGS → BUILD FG HISTORY.",
"{*}. Re-run in order (STEP 4 if needed) → RUN FIFO COGS → BUILD FG HISTORY."
],
[
"Giá vốn thuần 632: {*}",
"Net COGS 632: {*}"
],
[
"Kết quả 5.2 chỉ gồm bán hàng. Kỳ có {*} dòng hàng bán bị trả lại – chạy riêng ở",
"The 5.2 result covers sales only. The period has {*} sales return lines – run them separately on"
],
[
"Run snapshot: chế độ {*} · {*} lớp đầu kỳ · override dùng {*} · kết quả {*}",
"Run snapshot: {*} mode · {*} opening layers · overrides used {*} · result {*}"
],
[
"Lưu lần cuối {*}{*}",
"Last saved {*}{*}"
],
[
"{*} · {*} dòng (mọi kỳ). Dữ liệu được mang sang kỳ sau. Dòng SALES RETURN chỉ có tiền (không SL) vẫn vào TK 5212; nếu FAST hạch toán là giảm giá thì sửa Transaction Type thành CREDIT NOTE ở file nguồn.",
"{*} · {*} lines (all periods). The data carries forward. Amount-only SALES RETURN lines (no qty) still go to account 5212; if FAST books them as discounts, change the Transaction Type to CREDIT NOTE in the source file."
],
[
"Chạy {*}",
"Run {*}"
],
[
"Giảm trừ chỉ có tiền: 5212 = {*} · 5213 = {*} VND, đối chiếu FAST ở STEP 5.3.",
"Amount-only deductions: 5212 = {*} · 5213 = {*} VND, reconciled with FAST in STEP 5.3."
],
[
"Kỳ này không có hàng bán bị trả lại có số lượng – không có giá vốn cần xử lý.{*}",
"No sales returns with quantity this period – no COGS to process.{*}"
],
[
"{*}. Chạy lại RUN FIFO COGS rồi RUN STEP 5R.",
"{*}. Re-run RUN FIFO COGS, then RUN STEP 5R."
],
[
"sau lần RUN FIFO gần nhất ({*}). Bấm",
"after the latest RUN FIFO ({*}). Click"
],
[
"Còn {*} dòng trả lại chưa xử lý.",
"{*} return lines not yet processed."
],
[
"{*} dòng trả lại cần xác nhận",
"{*} return lines need confirmation"
],
[
"{*} Thứ tự: STEP 5.2 RUN FIFO (bán hàng) →",
"{*} Order: STEP 5.2 RUN FIFO (sales) →"
],
[
"{*} · {*} · {*} dòng (trả lại / giảm giá {*})",
"{*} · {*} · {*} lines (returns / discounts {*})"
],
[
"(bỏ qua {*} dòng bán hàng)",
"(skipped {*} sales lines)"
],
[
"Đã import {*} dòng trả lại / giảm giá{*}. Bước tiếp: Validate & Save.",
"Imported {*} return / discount lines{*}. Next: Validate & Save."
],
[
"Bỏ qua {*} dòng bán hàng (thuộc 4.1)",
"Skip {*} sales lines (belong to 4.1)"
],
[
"{*} {*}→{*}: lưu {*} dòng; bỏ qua (bán hàng) {*}; PASS {*}; REVIEW {*}; thay thế {*}",
"{*} {*}→{*}: saved {*} lines; skipped (sales) {*}; PASS {*}; REVIEW {*}; replaced {*}"
],
[
"Kỳ có {*} dòng trả lại có SL → RUN STEP 5R.",
"The period has {*} return lines with qty → RUN STEP 5R."
],
[
"Đã duyệt: {*}",
"Approved: {*}"
],
[
"{*}: đơn giá {*} (gửi bởi {*}) – {*}",
"{*}: unit cost {*} (sent by {*}) – {*}"
],
[
"{*}: xoá",
"{*}: delete"
],
[
"· còn {*} dòng chưa xử lý",
"· {*} lines not yet processed"
],
[
"· {*} dòng cần xác nhận",
"· {*} lines need confirmation"
],
[
"· yêu cầu {*} VND{*} · {*} · {*}{*}",
"· requested {*} VND{*} · {*} · {*}{*}"
],
[
"Đóng {*}",
"Close {*}"
],
[
"Cổng đóng kỳ: {*}",
"Month-close gate: {*}"
],
[
"Kỳ {*} đã đóng",
"Period {*} closed"
],
[
"lúc {*} bởi {*} · trạng thái {*}. Tạo kỳ {*} rồi Roll forward FG đầu kỳ.",
"at {*} by {*} · status {*}. Create period {*}, then roll forward the opening FG."
],
[
"History đến {*} · tạo {*}",
"History through {*} · built {*}"
],
[
"Đối chiếu FAST{*}",
"FAST reconciliation{*}"
],
[
"Nhập bởi {*} lúc {*}.",
"Entered by {*} at {*}."
],
[
"bởi {*} lúc {*}: {*}",
"by {*} at {*}: {*}"
],
[
"{*} tài khoản lệch FAST.",
"{*} accounts differ from FAST."
],
[
"Kiểm tra nguyên nhân (bút toán chưa ghi, điều chỉnh tay trên FAST, chênh làm tròn…) rồi xác nhận.{*}",
"Check the cause (entries not posted, manual adjustments in FAST, rounding…) and then confirm.{*}"
],
[
"Khớp FAST ở cả {*} tài khoản.",
"Matches FAST on all {*} accounts."
],
[
"FG History không khớp (gate {*}).",
"FG History does not match (gate {*})."
],
[
"{*}: Firestore từ chối quyền ghi. Kiểm tra (1) tài khoản đang đăng nhập là Quản trị (email chủ sở hữu trong firestore.rules trên Firebase console hoặc role admin ở Cài đặt → Người dùng); (2) đã Publish firestore.rules mới nhất. Kỳ vẫn giữ nguyên trạng thái trên cloud.",
"{*}: Firestore denied write permission. Check (1) the signed-in account is an Admin (owner email in firestore.rules in the Firebase console, or the admin role in Settings → Users); (2) the latest firestore.rules has been published. The period keeps its state in the cloud."
],
[
"Đóng kỳ kế toán {*}? Final Production Status: {*} Month Close Gate: {*} FG History: PASS Batch 7: PASS",
"Close accounting period {*}? Final Production Status: {*} Month Close Gate: {*} FG History: PASS Batch 7: PASS"
],
[
"Cloud chưa xác nhận: {*}",
"Not confirmed by the cloud: {*}"
],
[
"{*} (đóng lúc {*} bởi {*})",
"{*} (closed at {*} by {*})"
],
[
"· {*} quá {*} tháng",
"· {*} over {*} months"
],
[
"{*} dòng treo{*}",
"{*} pending lines{*}"
],
[
". Web dùng giá FIFO của chính lô thành phẩm (gồm NVL + 622 + 627) cho 154 / 155.{*}",
". The web uses the FIFO cost of the finished lot itself (RM + 622 + 627) for 154 / 155.{*}"
],
[
"Cảnh báo treo quá {*} tháng",
"Warn when pending over {*} months"
],
[
"TK chi phí mặc định {*}",
"Default expense account {*}"
],
[
"{*} Dòng treo từ {*} tháng trở lên được đánh dấu.",
"{*} Lines pending {*} months or more are flagged."
],
[
"Treo ≥ {*} tháng",
"Pending ≥ {*} months"
],
[
"Xử lý: {*}",
"Handling: {*}"
],
[
"{*} · {*} · SL {*} · giá trị FIFO {*} VND · xuất {*} ({*} tháng)",
"{*} · {*} · qty {*} · FIFO value {*} VND · issued {*} ({*} months)"
],
[
"→ {*} (hỏng {*} → {*})",
"→ {*} (scrap {*} → {*})"
],
[
"Xem tất cả {*}",
"Show all {*}"
],
[
"({*} lô)",
"({*} lots)"
],
[
"Giá thành sản xuất{*}",
"Production cost{*}"
],
[
"Kỳ {*} không có lô sản xuất nào của {*} (sản phẩm chỉ có xuất bán từ tồn kho).",
"Period {*} has no production lots of {*} (the product was only sold from stock)."
],
[
"{*} lô · {*}",
"{*} lots · {*}"
],
[
"{*}/đv · {*}",
"{*}/unit · {*}"
],
[
"Lô PC ({*})",
"PC lots ({*})"
],
[
"Vật tư ({*})",
"Materials ({*})"
],
[
"So với {*}",
"Vs {*}"
],
[
"Giá {*} USD · {*}",
"Price {*} USD · {*}"
],
[
"NVL {*} · 622 {*} (trực tiếp {*}) · 627 {*} (trực tiếp {*}). 622/627 chung phân bổ theo đóng góp dương = doanh thu theo giá bán − NVL.",
"RM {*} · 622 {*} (direct {*}) · 627 {*} (direct {*}). Common 622/627 is allocated by positive contribution = revenue at selling price − RM."
],
[
"Dòng bán ({*})",
"Sales lines ({*})"
],
[
"Lớp FIFO ({*})",
"FIFO layers ({*})"
],
[
"Lớp đã xuất bán ({*})",
"Layers sold ({*})"
],
[
"Tồn cuối ({*})",
"Closing stock ({*})"
],
[
"– đang tải {*} kỳ…",
"– loading {*} periods…"
],
[
"Giá thành đơn vị (lô sản xuất), giá vốn và giá bán bình quân / sp của {*} trong {*} kỳ gần nhất, lấy từ kết quả STEP 5 từng kỳ{*}.",
"Unit production cost (production lots), COGS and average selling price / unit of {*} over the last {*} periods, from each period's STEP 5 results{*}."
],
[
"{*} · kỳ {*}{*}",
"{*} · period {*}{*}"
]
];
