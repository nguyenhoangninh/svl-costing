// v1.14.23 — Import templates with a guide sheet (HUONG_DAN): what each column means, whether it is required,
// the format the app accepts and two example rows. Owner request 13/10/2026: "thêm dòng ví dụ và diễn giải nội dung
// cần điền để người làm điền đúng thông tin".
//
// Safety rule: the import readers search every sheet for a header ROW (sales, SO, FG production) or a marker in A1
// (FG opening) or a sheet name (WIP opening). The guide therefore lists columns VERTICALLY (one column name per row,
// examples in the "Ví dụ" columns) so it can never be taken for a data table, and example rows are never written into
// the data sheet. test/unit.mjs fills each data sheet with the guide's examples and reads it back with the real reader.

const GUIDE_HEAD = ['Cột trong file', 'Bắt buộc', 'Nội dung cần điền', 'Định dạng / quy tắc', 'Ví dụ dòng 1', 'Ví dụ dòng 2'];
export const GUIDE_SHEET = 'HUONG_DAN';

/** Guide sheet as an array sheet for exportBook (keep: true, header row styled). */
function guide(title, intro, cols) {
  const aoa = [[`HƯỚNG DẪN ĐIỀN – ${title}`], ...intro.map((t) => [t]), [], GUIDE_HEAD, ...cols.map((c) => [c[0], c[1], c[2], c[3], c[4] ?? '', c[5] ?? ''])];
  return { name: GUIDE_SHEET, keep: true, header: intro.length + 3, aoa, cols: [26, 12, 60, 46, 30, 30] };
}
/** Data rows from the guide examples (column order of the data sheet), used by the tests to prove the examples import. */
export const exampleRows = (cols) => [4, 5].map((k) => cols.map((c) => (c[k] === undefined ? '' : c[k])));

// ---------------------------------------------------------------- WIP opening (STEP 3A)
export const WIP_COLS = [
  ['Material Code', 'Bắt buộc', 'Mã vật tư đúng như trên ERP (cột Material Code của MI-M / PC-M). Mỗi mã một dòng, không lặp.', 'Chữ / số; định dạng Text để giữ số 0 ở đầu', '50120788', '300001'],
  ['Material Name', 'Nên có', 'Tên vật tư theo ERP (để đối chiếu).', 'Chữ', 'TET1012034 Cross ph ta din 332340', 'Vải 600D đen khổ 1.5m'],
  ['Unit', 'Nên có', 'Đơn vị tính theo ERP.', 'Chữ (PCS, KG, M…)', 'PCS', 'M'],
  ['Opening Qty', 'Bắt buộc', 'Số lượng WIP tồn đầu kỳ = tồn cuối kỳ trước trên ERP. Có thể âm nếu ERP đang âm.', 'Số; dấu chấm hoặc phẩy thập phân đều được', 2400, 15.5],
  ['Opening Amount', 'Bắt buộc', 'Giá trị WIP tồn đầu kỳ (VND).', 'Số VND, không ghi chữ "đ"', 600991.2, 1250000],
  ['Source', 'Nên có', 'Nguồn lấy số (báo cáo / kỳ).', 'Chữ', 'ERP WIP closing 2026-08', 'ERP WIP closing 2026-08'],
  ['Note', 'Không', 'Ghi chú thêm nếu có.', 'Chữ', '', 'Đã đối chiếu kho'],
];
export function wipOpeningTemplate(period) {
  return [
    { name: 'WIP_OPENING', keep: true, header: 5, cols: [16, 34, 8, 14, 18, 26, 26], aoa: [
      ['WIP OPENING BALANCE CONTROL'],
      ['Opening Period', period],
      [`Điền từ dòng 6. Không đổi ô B2 (kỳ) và tiêu đề dòng 5. Hướng dẫn chi tiết và ví dụ: sheet ${GUIDE_SHEET}.`],
      ['Mã vật tư ERP', 'Tên vật tư', 'ĐVT', 'SL tồn đầu kỳ', 'Giá trị tồn (VND)', 'Nguồn số liệu', 'Ghi chú'],
      WIP_COLS.map((c) => c[0]),
    ] },
    guide('WIP ĐẦU KỲ (STEP 3A · Opening WIP)', [
      `Sheet cần điền: WIP_OPENING · Ô B2 = kỳ đang mở (${period}) · Dòng 5 là tiêu đề, KHÔNG đổi tên · Dữ liệu từ dòng 6.`,
      'Mỗi dòng là một mã vật tư còn tồn trong WIP (sản xuất dở dang) đầu kỳ. Không điền dòng tổng.',
      'Thông thường không cần file này: nếu kỳ trước đã chạy STEP 3 trên web, số đầu kỳ được mang sang tự động.',
    ], WIP_COLS),
  ];
}

// ---------------------------------------------------------------- FG opening by lot (STEP 5.1)
export const FG_OPEN_COLS = [
  ['PC No.', 'Bắt buộc', 'Số lô sản xuất (PC) tạo ra lớp tồn này.', 'Chữ', 'PC-2608-0012', 'PC-2607-0145'],
  ['Layer Date', 'Bắt buộc', 'Ngày hoàn thành lô. Phải TRƯỚC ngày 01 của kỳ đang mở.', 'Ngày: 2026-08-20 hoặc 20/08/2026', '2026-08-20', '2026-07-28'],
  ['MO No.', 'Nên có', 'Lệnh sản xuất của lô.', 'Chữ', 'MO-2606-0015-001', 'MO-2605-0008-001'],
  ['Product Code', 'Bắt buộc', 'Mã thành phẩm đầy đủ, đúng như trên PC-P / Sales.', 'Chữ, không viết tắt', 'SP101-10-043-003', 'OLI-4810VU'],
  ['Product Name', 'Nên có', 'Tên thành phẩm.', 'Chữ', 'Doona Infant Car Seat – Sahara Sand', '20 INCH LARGER M-TOTE'],
  ['Location', 'Không', 'Location của lô (MK*, VE*… với hệ O).', 'Chữ', 'FG', 'MKX854V'],
  ['Unit', 'Nên có', 'Đơn vị tính thành phẩm.', 'PC hoặc PCS', 'PCS', 'PCS'],
  ['Qty', 'Bắt buộc', 'Số lượng còn tồn của lớp (chưa bán).', 'Số > 0', 120, 35],
  ['RM Amount', 'Bắt buộc', 'Giá trị nguyên vật liệu của phần còn tồn (VND).', 'Số ≥ 0', 30000000, 5250000],
  ['622 Amount', 'Bắt buộc', 'Nhân công trực tiếp (VND) của phần còn tồn.', 'Số ≥ 0', 4000000, 700000],
  ['627 Amount', 'Bắt buộc', 'Chi phí sản xuất chung (VND) của phần còn tồn.', 'Số ≥ 0', 6000000, 1050000],
  ['Total Amount', 'Bắt buộc', 'Tổng giá trị = RM + 622 + 627 (lệch quá 1 VND sẽ bị báo lỗi).', 'Số > 0', 40000000, 7000000],
  ['Sales Price (USD)', 'Không', 'Giá bán dự kiến / gần nhất – dùng để kiểm tra NRV.', 'Số USD / sản phẩm', 137.78, 9.5],
  ['Provision VND (memo)', 'Không', 'Dự phòng giảm giá đã trích cho lớp này (chỉ ghi nhớ).', 'Số VND', '', 150000],
  ['Consignment 157 (memo)', 'Không', 'Số lượng đang gửi bán (TK 157) trong lớp này (chỉ ghi nhớ).', 'Số', '', ''],
  ['Source Reference', 'Nên có', 'Nguồn số liệu để truy vết.', 'Chữ', '05_FG_CLOSING 2026-08 | PR-202608-PC-2608-0012-001', 'Excel costing 2026-07'],
  ['Note', 'Không', 'Ghi chú.', 'Chữ', '', 'Hàng gửi kho khách'],
];
export const fgOpeningGuide = (period) => guide('FG ĐẦU KỲ THEO LÔ (STEP 5.1)', [
  `Sheet cần điền: FG_OPENING · Ô A1 (dấu nhận diện) và tiêu đề dòng 4 KHÔNG được sửa · Ô C2 = kỳ đang mở (${period}) · Ô G2 = người lập · Dữ liệu từ dòng 5.`,
  'Mỗi dòng là một lớp FIFO còn tồn đầu kỳ (theo lô sản xuất). Không gộp nhiều lô vào một dòng nếu muốn FIFO đúng theo lô.',
  'Nếu kỳ trước đã chạy STEP 5 trên web, chọn "Điền sẵn template bằng FG cuối kỳ" khi tải – không cần nhập tay.',
], FG_OPEN_COLS);

// ---------------------------------------------------------------- FG production YTD (STEP 4.4)
export const FG_PROD_COLS = [
  ['Kỳ (YYYY-MM)', 'Bắt buộc', 'Tháng sản xuất. Cùng năm và TRƯỚC kỳ dùng file.', 'YYYY-MM (2026-07), 07/2026 hoặc 202607', '2026-07', '2026-08'],
  ['ERP', 'Nên có', 'Hệ ERP của lô.', 'T hoặc O', 'T', 'O'],
  ['PC No.', 'Nên có', 'Số lô sản xuất. Để trống nếu chỉ có số theo sản phẩm / tháng.', 'Chữ', 'PC-2607-0031', ''],
  ['PC Date', 'Không', 'Ngày hoàn thành lô.', 'Ngày: 2026-07-25 hoặc 25/07/2026', '2026-07-25', ''],
  ['MO No.', 'Không', 'Lệnh sản xuất.', 'Chữ', 'MO-2606-0015-001', ''],
  ['Product Code', 'Bắt buộc', 'Mã thành phẩm đầy đủ như trên PC-P.', 'Chữ, không viết tắt', 'SP101-10-042-003', 'OLI-5017VU'],
  ['Product Name', 'Nên có', 'Tên thành phẩm.', 'Chữ', 'Doona Infant Car Seat – Desert Green', 'BUCKET, UTILITY STORAGE'],
  ['Costing Family', 'Không', 'Nhóm giá thành.', 'DOONA, MK, VETO, HAMA hoặc O-OTHER', 'DOONA', 'MK'],
  ['Location', 'Không', 'Location của lô.', 'Chữ', 'FG', 'MKX854V'],
  ['Unit', 'Không', 'Đơn vị tính.', 'PCS', 'PCS', 'PCS'],
  ['Complete Qty', 'Bắt buộc', 'Số lượng hoàn thành trong tháng.', 'Số > 0', 1500, 8000],
  ['RM (VND)', 'Có điều kiện', 'Nguyên vật liệu. Bắt buộc nếu không điền "Tổng giá thành".', 'Số VND', 375000000, 84000000],
  ['622 (VND)', 'Có điều kiện', 'Nhân công trực tiếp (cùng điều kiện với RM).', 'Số VND', 45000000, 12000000],
  ['627 (VND)', 'Có điều kiện', 'Chi phí sản xuất chung (cùng điều kiện với RM).', 'Số VND', 60000000, 16000000],
  ['Tổng giá thành (VND)', 'Bắt buộc*', 'Tổng giá thành = RM + 622 + 627. *Có thể bỏ trống nếu đã điền đủ RM, 622, 627.', 'Số VND', 480000000, 112000000],
  ['SL đã xuất trước kỳ', 'Không', 'Số lượng của lô đã bán / xuất trước kỳ dùng file (để theo dõi còn tồn).', 'Số', 1200, ''],
  ['Giá vốn đã xuất trước kỳ (VND)', 'Không', 'Giá vốn tương ứng với số lượng đã xuất ở cột trên.', 'Số VND', 384000000, ''],
  ['Ghi chú', 'Không', 'Ghi chú.', 'Chữ', '', 'Số theo sản phẩm / tháng'],
];
export const fgProductionGuide = (period) => guide('THÀNH PHẨM SẢN XUẤT LŨY KẾ (STEP 4.4 · file đầu kỳ)', [
  `Sheet cần điền: FG_PRODUCTION · Ô A1 và tiêu đề dòng 4 KHÔNG được sửa · Dữ liệu từ dòng 5 · Dùng cho kỳ ${period}: chỉ điền các tháng TRƯỚC kỳ này trong cùng năm.`,
  'Mỗi dòng là một lô (hoặc một sản phẩm trong một tháng nếu không có chi tiết lô).',
  'Tháng 01 không cần file. Các tháng sau: dùng nút "Tải file đầu kỳ cho tháng sau" của kỳ trước để có file điền sẵn.',
], FG_PROD_COLS);

/** Guide of the detail sheet (column, required, meaning, format, example 1 (still in stock), example 2 (sold in a month)). */
export const DETAIL_GUIDE = [
  ['PC No.', 'Bắt buộc', 'Số lô sản xuất (PC). Một lô có thể nằm trên nhiều dòng (tách theo tháng xuất).', 'Chữ, PC-YYMM-…', 'PC-2608-0040', 'PC-2608-0040'],
  ['Date', 'Bắt buộc', 'Ngày hoàn thành lô. Tháng của ngày này = tháng sản xuất; phải TRƯỚC kỳ dùng file.', 'Ngày: 2026-08-20 hoặc 20/08/2026', '2026-08-20', '2026-08-20'],
  ['MO No.', 'Nên có', 'Lệnh sản xuất.', 'Chữ', 'MO-2606-0015-001', 'MO-2606-0015-001'],
  ['Product code', 'Bắt buộc', 'Mã thành phẩm đầy đủ như trên PC-P / Sales.', 'Chữ, không viết tắt', 'SP101-10-033-003', 'SP101-10-033-003'],
  ['Product Name', 'Nên có', 'Tên thành phẩm.', 'Chữ', 'Doona Car Seat', 'Doona Car Seat'],
  ['Location', 'Không', 'Location của lô.', 'Chữ', 'FG', 'FG'],
  ['Unit', 'Nên có', 'Đơn vị tính.', 'PC / PCS', 'PC', 'PC'],
  ['Complete Qty', 'Bắt buộc', 'Số lượng của DÒNG này (phần lô còn tồn, hoặc phần đã xuất trong Cost month).', 'Số', 12, 5],
  ['RM cost', 'Không', 'Nguyên vật liệu (phần chính).', 'Số VND', 3000000, 1250000],
  ['RM cost (ST)', 'Không', 'Nguyên vật liệu từ Stock Out.', 'Số VND', 0, 0],
  ['Total cost(VND)', 'Bắt buộc', 'Tổng giá thành của dòng = RM cost (cột L) + Direct labors + Production cost.', 'Số VND', 4800000, 2000000],
  ['RM cost', 'Có điều kiện', 'Tổng nguyên vật liệu (cột L) = RM cost + RM cost (ST).', 'Số VND', 3000000, 1250000],
  ['Direct labors', 'Có điều kiện', 'Nhân công trực tiếp (622) của dòng.', 'Số VND', 900000, 375000],
  ['Production cost', 'Có điều kiện', 'Chi phí sản xuất chung (627) của dòng.', 'Số VND', 900000, 375000],
  ['Sales Price(USD)', 'Không', 'Giá bán (ghi nhớ).', 'Số USD', 137.78, 137.78],
  ['UNIT COST RM ( vnd)', 'Không', 'App tự tính = RM / SL (không đọc).', 'Số', '', ''],
  ['UNIT COST( vnd)', 'Không', 'App tự tính = Total / SL (không đọc).', 'Số', '', ''],
  ['Cost month', 'Có điều kiện', 'Tháng ghi nhận giá vốn / xuất của dòng. ĐỂ TRỐNG = còn tồn. Phải trước kỳ dùng file.', 'YYYYMM (202608)', '', '202608'],
  ['provision in 2512-usd', 'Không', 'Dự phòng USD (ghi nhớ).', 'Số', '', ''],
  ['7% PL', 'Không', 'Ghi nhớ.', 'Số', '', ''],
  ['UNIT COST ( vnd)', 'Không', 'Ghi nhớ.', 'Số', '', ''],
  ['provision in 2512-vdn', 'Không', 'Dự phòng VND (ghi nhớ).', 'Số', '', ''],
  ['net inventory', 'Không', 'Ghi nhớ.', 'Số', '', ''],
  ['157-good on consignment', 'Không', 'Hàng gửi bán (ghi nhớ).', 'Số / chữ', '', ''],
  ['Note', 'Không', 'Ghi chú.', 'Chữ', '', ''],
  ['total FG stock end of 2025', 'Không', 'Ghi nhớ.', 'Số', '', ''],
  ['Note 1', 'Không', 'Ghi chú.', 'Chữ', '', ''],
  ['Kỳ sản xuất', 'Không', 'App ghi (tháng sản xuất theo Date) – không cần điền.', 'YYYY-MM', '2026-08', '2026-08'],
  ['ERP', 'Không', 'Hệ ERP; bỏ trống thì app suy ra từ số PC (đuôi 4 chữ số = T).', 'T / O', 'T', 'T'],
  ['Loại xuất', 'Không', 'App ghi: Bán hàng (COGS) / Xuất rework.', 'Chữ', '', 'Bán hàng (COGS)'],
  ['Chứng từ xuất', 'Không', 'App ghi các số hoá đơn / phiếu rework đã lấy dòng này.', 'Chữ', '', 'SI-2608-031'],
  ['Nguồn dòng', 'Không', 'App ghi nguồn của dòng.', 'Chữ', '', ''],
];
export const fgDetailGuide = (period) => guide('THÀNH PHẨM SX & TỒN KHO CHI TIẾT THEO DÒNG (STEP 4.4 · mẫu "month detail")', [
  `Sheet cần điền: FG_DETAIL · Tiêu đề dòng 4 KHÔNG đổi (cột A → AA giống file "FG month detail") · Dữ liệu từ dòng 5 · Dùng cho kỳ ${period}.`,
  'Mỗi dòng là một phần của lô (PC No. + Product code). Lô đã bán một phần được tách thành nhiều dòng: dòng đã ghi nhận giá vốn có Cost month (YYYYMM), dòng còn tồn để TRỐNG Cost month.',
  `Tổng các dòng chưa có Cost month phải bằng FG đầu kỳ ${period} (= FG cuối kỳ trước, STEP 5.1). App đối chiếu và cảnh báo nếu lệch (không chặn).`,
  'Gồm lô sản xuất trong năm và lô năm trước còn tồn. Lô của kỳ đang mở KHÔNG điền – app lấy từ STEP 4.3 và tự tách dòng theo FIFO (STEP 5.2).',
  'Thường không cần điền tay: dùng nút "Tải file đầu kỳ cho kỳ sau" của kỳ trước, hoặc upload thẳng file month detail của kế toán.',
], DETAIL_GUIDE);

// ---------------------------------------------------------------- Sales revenue (STEP 4.1, TK 511) and returns (STEP 5R, TK 5212 / 5213)
// Header names are the ones the reader accepts (src/engine/step4.js SALES_HEADERS + Bill Date / Original Invoice No.).
const SALES_BASE = [
  ['Invoice Date', 'Bắt buộc', 'Ngày hoá đơn bán hàng (SI).', 'Ngày: 2026-09-08 hoặc 08/09/2026'],
  ['Bill Date', 'Nên có', 'Ngày B/L (vận đơn). Nếu có, doanh thu và giá vốn ghi nhận theo NGÀY NÀY (có thể sang tháng sau ngày hoá đơn).', 'Ngày; để trống nếu không có'],
  ['SI Invoice No.', 'Bắt buộc', 'Số hoá đơn.', 'Chữ'],
  ['Invoice Line No.', 'Nên có', 'Số dòng trên hoá đơn. Giúp phân biệt 2 dòng giống hệt nhau (cùng ngày, hoá đơn, sản phẩm, SL, tiền).', 'Số 1, 2, 3…'],
  ['Customer', 'Nên có', 'Tên khách hàng.', 'Chữ'],
  ['Product Number', 'Bắt buộc*', 'Mã thành phẩm đầy đủ như trên PC-P. *Bắt buộc với dòng có số lượng.', 'Chữ, không viết tắt'],
  ['Product Name', 'Nên có', 'Tên thành phẩm.', 'Chữ'],
  ['Customer - Item Code', 'Không', 'Mã hàng theo khách hàng (item code / part no. của khách). Lưu cùng dòng và hiển thị ở Sales_COGS (STEP 5.2).', 'Chữ'],
  ['Transaction Type', 'Nên có', 'Loại giao dịch: NORMAL SALE, SALES RETURN, CREDIT NOTE, FOC, SAMPLE, ADJUSTMENT, NON-PRODUCT REVENUE, OTHER. Bỏ trống = NORMAL SALE (dòng số dương).', 'Đúng một trong các giá trị bên trái'],
  ['Quantity', 'Bắt buộc*', 'Số lượng. Bán hàng: dương. Hàng trả lại: ÂM. Để trống với dòng chỉ có tiền (giảm giá, điều chỉnh).', 'Số'],
  ['Unit Price (USD)', 'Nên có', 'Đơn giá USD. App kiểm tra SL × đơn giá ≈ Amount (USD), lệch > 0,5% sẽ cảnh báo.', 'Số; "34,6" được hiểu là 34.6'],
  ['Amount (USD)', 'Bắt buộc', 'Thành tiền USD. Hàng trả lại / giảm giá: số ÂM.', 'Số'],
  ['Exchange Rate', 'Nên có', 'Tỷ giá VND/USD của hoá đơn.', 'Số, ví dụ 26040'],
  ['Amount (VND)', 'Nên có', 'Thành tiền VND = Amount (USD) × tỷ giá (lệch > 0,2% sẽ cảnh báo).', 'Số VND'],
  ['Original Invoice No.', 'Có điều kiện', 'Hoá đơn bán gốc của hàng trả lại – để trả đúng giá vốn của lần bán đó.', 'Chữ; bắt buộc nên có với SALES RETURN'],
  ['ED Number', 'Không', 'Số tờ khai xuất khẩu (ED) của dòng bán. Lưu cùng dòng và hiển thị ở Sales_COGS (STEP 5.2).', 'Chữ'],
  ['Provision Reversal', 'Không', 'Hoàn nhập dự phòng giảm giá gắn với dòng bán. Lưu để đối chiếu và hiển thị ở Sales_COGS; không làm thay đổi giá vốn FIFO.', 'Số VND'],
  ['Remark', 'Không', 'Ghi chú.', 'Chữ'],
];
const withEx = (base, ex) => base.map((c, i) => [...c, ex[0][i], ex[1][i]]);
export const SALES_COLS = withEx(SALES_BASE, [
  ['2026-09-08', '2026-09-10', 'SI-2609-001', 1, 'Traveler Innovations Limited', 'SP101-10-043-003', 'Doona Infant Car Seat – Sahara Sand', 'TRV-DOONA-SS', 'NORMAL SALE', 150, 137.78, 20667, 26040, 538168680, '', 'ED-306012345678', '', ''],
  ['2026-09-28', '2026-10-02', 'SI-2609-045', 1, 'Techtronic Trading Ltd.', 'OLI-4810VU', '20 INCH LARGER M-TOTE', '48-22-8442', 'NORMAL SALE', 1000, 9.5, 9500, 26100, 247950000, '', 'ED-306012349999', 1250000, 'B/L tháng 10 → doanh thu tháng 10'],
]);
export const RETURN_COLS = withEx(SALES_BASE, [
  ['2026-09-20', '', 'CN-2609-001', 1, 'Techtronic Trading Ltd.', 'OLI-4810VU', '20 INCH LARGER M-TOTE', '48-22-8442', 'SALES RETURN', -10, 9.5, -95, 26100, -2479500, 'SI-2608-031', '', '', 'Hàng lỗi trả về'],
  ['2026-09-25', '', 'CN-2609-002', 1, 'Traveler Innovations Limited', 'SP101-10-043-003', 'Doona Infant Car Seat – Sahara Sand', '', 'CREDIT NOTE', '', '', -500, 26040, -13020000, '', '', '', 'Giảm giá theo thoả thuận'],
]);
const salesSheet = (name, title, period, cols, help) => ({
  name, keep: true, header: 4, cols: [13, 13, 15, 10, 28, 20, 34, 20, 18, 11, 13, 14, 12, 16, 18, 18, 16, 26],
  aoa: [
    [title],
    [`Kỳ giá thành: ${period} · Điền từ dòng 5 · Tiêu đề dòng 4 KHÔNG đổi tên · Hướng dẫn chi tiết và ví dụ: sheet ${GUIDE_SHEET}. ${help}`],
    ['Ngày hoá đơn', 'Ngày B/L (ghi nhận)', 'Số hoá đơn', 'Dòng HĐ', 'Khách hàng', 'Mã thành phẩm đầy đủ', 'Tên thành phẩm', 'Loại giao dịch', 'Số lượng', 'Đơn giá USD', 'Thành tiền USD', 'Tỷ giá', 'Thành tiền VND', 'HĐ bán gốc (trả hàng)', 'Ghi chú'],
    cols.map((c) => c[0]),
  ],
});
export function salesTemplate(period) {
  return [
    salesSheet('SALES', 'SVL – DOANH THU BÁN HÀNG (TK 511) · FILE IMPORT STEP 4.1', period, SALES_COLS, 'Chỉ dòng bán hàng; hàng trả lại / giảm giá dùng template của màn hình 5R.'),
    guide('DOANH THU BÁN HÀNG (STEP 4.1 · TK 511)', [
      `Sheet cần điền: SALES · Tiêu đề dòng 4 KHÔNG đổi tên · Dữ liệu từ dòng 5 · Kỳ giá thành ${period}.`,
      'Mỗi dòng là một dòng hoá đơn bán hàng. Không điền dòng tổng / dòng trống giữa bảng.',
      'Chế độ import: MONTHLY = file chỉ gồm các tháng có trong file (thường là một tháng); YTD = file BẮT BUỘC từ 01/01 đến hết kỳ (thay toàn bộ dữ liệu từ đầu năm).',
      'Dòng SALES RETURN / CREDIT NOTE trong file này sẽ được bỏ qua (SKIPPED) – import ở màn hình 5R để ghi TK 5212 / 5213.',
      'Ví dụ dòng 2: hoá đơn 28/09 nhưng B/L 02/10 → doanh thu và giá vốn thuộc tháng 10.',
    ], SALES_COLS),
  ];
}
export function returnsTemplate(period) {
  return [
    salesSheet('RETURNS', 'SVL – HÀNG BÁN BỊ TRẢ LẠI (TK 5212) & GIẢM GIÁ (TK 5213) · FILE IMPORT STEP 5R', period, RETURN_COLS, 'Chỉ dòng SALES RETURN / CREDIT NOTE.'),
    guide('HÀNG TRẢ LẠI & GIẢM GIÁ (STEP 5R · TK 5212 / 5213)', [
      `Sheet cần điền: RETURNS · Tiêu đề dòng 4 KHÔNG đổi tên · Dữ liệu từ dòng 5 · Kỳ giá thành ${period}.`,
      'SALES RETURN (hàng trả lại, TK 5212): Quantity ÂM, Amount ÂM, nên có Original Invoice No. để trả đúng giá vốn của hoá đơn gốc. Không được trả vượt số lượng còn lại của hoá đơn gốc.',
      'CREDIT NOTE (giảm giá, TK 5213): Quantity để TRỐNG, Amount ÂM. Không nhập lại kho, chỉ giảm doanh thu.',
      'Dòng bán hàng (NORMAL SALE…) trong file này sẽ được bỏ qua – import ở màn hình 4.1.',
    ], RETURN_COLS),
  ];
}

// ---------------------------------------------------------------- Sales Order price list (STEP 4.1 · SO fallback)
export const SO_HEADERS = ['Active', 'Product Code', 'SO Date', 'SO No.', 'Customer', 'Qty', 'Unit Price USD', 'Note'];
export const SO_COLS = [
  ['Active', 'Nên có', 'Y = dùng dòng này; N = bỏ qua. Trống = Y.', 'Y hoặc N', 'Y', 'Y'],
  ['Product Code', 'Bắt buộc', 'Mã thành phẩm ĐẦY ĐỦ, đúng như trên PC-P (ví dụ SP101-10-043-003, không viết tắt SP101-10-043). Mã sai sẽ không được dùng làm giá.', 'Chữ', 'SP101-10-043-003', 'OLI-5017VU'],
  ['SO Date', 'Nên có', 'Ngày đơn hàng. Phải ≤ ngày cuối kỳ giá thành; SO sau kỳ bị chặn. SO không có ngày được ưu tiên thấp hơn.', 'Ngày: 2026-09-15 hoặc 15/09/2026', '2026-09-15', '2026-08-30'],
  ['SO No.', 'Nên có', 'Số đơn hàng (để truy vết).', 'Chữ', 'SO-2609-0102', 'SO-2608-0877'],
  ['Customer', 'Không', 'Khách hàng.', 'Chữ', 'Traveler Innovations Limited', 'Milwaukee'],
  ['Qty', 'Không', 'Số lượng đặt hàng (tham khảo).', 'Số', 500, 2000],
  ['Unit Price USD', 'Bắt buộc', 'Đơn giá bán USD / sản phẩm. Chỉ dùng khi sản phẩm không có giá bán thực tế (giá thực tế luôn được ưu tiên).', 'Số > 0; "34,6" được hiểu là 34.6', 137.78, 34.6],
  ['Note', 'Không', 'Ghi chú.', 'Chữ', '', 'Giá theo PO mới'],
];
export function soTemplate(period) {
  return [
    { name: 'SO_PRICE', keep: true, header: 4, cols: [8, 20, 12, 15, 28, 10, 15, 26], aoa: [
      ['SVL – DANH SÁCH GIÁ SALES ORDER (GIÁ DỰ PHÒNG CHO PRICE MASTER) · STEP 4.1'],
      [`Kỳ giá thành: ${period} · Điền từ dòng 5 · Tiêu đề dòng 4 KHÔNG đổi tên · Hướng dẫn chi tiết và ví dụ: sheet ${GUIDE_SHEET}. Import sẽ THAY TOÀN BỘ danh sách SO hiện có.`],
      ['Y / N', 'Mã thành phẩm đầy đủ', 'Ngày SO', 'Số SO', 'Khách hàng', 'SL đặt', 'Đơn giá USD', 'Ghi chú'],
      SO_HEADERS,
    ] },
    guide('GIÁ SALES ORDER (STEP 4.1 · SO fallback)', [
      `Sheet cần điền: SO_PRICE · Tiêu đề dòng 4 KHÔNG đổi tên · Dữ liệu từ dòng 5 · Kỳ giá thành ${period}.`,
      'Thứ tự ưu tiên giá của Price Master: giá thủ công đã duyệt → giá bán thực tế tháng này → giá thực tế gần nhất → giá YTD → giá Sales Order.',
      'Mỗi sản phẩm nên có một dòng SO mới nhất. Nhiều dòng cùng mã: dòng có ngày SO gần kỳ nhất được dùng.',
      'Sau khi import, bấm Update Price Master rồi xem tab "Kiểm tra giá PC".',
    ], SO_COLS),
  ];
}
