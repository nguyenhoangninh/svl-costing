// Executive dashboard read-only diagnostics. Never mutate STEP 5, JE, or source datasets.
import { num, ttxt } from './util.js';
import { customerPL } from './custpl.js';
const key = (s) => ttxt(s).normalize('NFKC').toLocaleUpperCase('vi-VN').replace(/\s+/g, ' ').trim();
const EPS = 1;
export function dashboardQuality(res, freshness = 'CURRENT') {
  const issues = [];
  if (!res || !Array.isArray(res.sales)) return { status: 'NO_DATA', issues: [], totals: { critical: 0, review: 0 }, eligible: false };
  const pl = customerPL(res);
  if (freshness !== 'CURRENT') issues.push({ id: 'step5-stale', severity: 'critical', title: 'Dữ liệu giá vốn chưa CURRENT', detail: 'Chạy lại STEP 5 và xác minh đối chiếu trước khi sử dụng số liệu GP.', target: 'step5' });
  const names = new Map();
  for (const row of pl.rows) {
    const k = key(row.cust);
    if (k && !names.has(k)) names.set(k, new Set());
    if (k) names.get(k).add(row.cust);
  }
  const alias = [...names.values()].filter((set) => set.size > 1).flatMap((set) => [...set]);
  if (alias.length) issues.push({ id: 'customer-alias', severity: 'review', title: 'Khách hàng có tên viết khác nhau', detail: `${alias.length} tên có thể trùng: ${alias.slice(0, 4).join(' / ')}. Chỉ gộp sau khi xác minh mã khách hàng.`, target: 'dashboard' });
  let noCost = 0, review = 0, unassigned = 0, zeroQty = 0;
  for (const s of res.sales) {
    if (s.acc !== '511') continue;
    const revenue = num(s.vnd), cogs = num(s.tot), qty = num(s.fq);
    if (s.status === 'REVIEW') review++;
    if (Math.abs(revenue) > EPS && !ttxt(s.cust)) unassigned++;
    if (Math.abs(revenue) > EPS && s.fin === 'FIFO COGS' && Math.abs(qty) > 1e-9 && Math.abs(cogs) < EPS) noCost++;
    if (Math.abs(revenue) > EPS && Math.abs(qty) < 1e-9 && s.fin === 'FIFO COGS') zeroQty++;
  }
  if (noCost) issues.push({ id: 'zero-cogs', severity: 'critical', title: 'Doanh thu xuất hàng có giá vốn bằng 0', detail: `${noCost} dòng FIFO có doanh thu và lượng xuất nhưng COGS bằng 0; cần đối chiếu lớp FG và JE07.`, target: 'step5' });
  if (review) issues.push({ id: 'sales-review', severity: 'review', title: 'Dòng bán đang REVIEW', detail: `${review} dòng doanh thu chưa đạt trạng thái chuẩn.`, target: 'step5' });
  if (unassigned) issues.push({ id: 'unknown-customer', severity: 'review', title: 'Doanh thu chưa có khách hàng', detail: `${unassigned} dòng doanh thu chưa có định danh khách hàng.`, target: 'dashboard' });
  if (zeroQty) issues.push({ id: 'zero-qty', severity: 'review', title: 'Doanh thu FIFO không có sản lượng', detail: `${zeroQty} dòng có doanh thu nhưng lượng FIFO bằng 0; không dùng để tính đơn giá bình quân.`, target: 'step5' });
  if (pl && pl.checks.some((x) => x.status === 'CHECK')) issues.push({ id: 'reconciliation', severity: 'critical', title: 'Giá vốn không khớp đối chiếu', detail: 'Dashboard phải khớp tổng COGS và JE07 / JE07B.', target: 'step5' });
  const critical = issues.filter((i) => i.severity === 'critical').length, pending = issues.length - critical;
  return { status: critical ? 'BLOCK' : pending ? 'REVIEW' : 'PASS', issues, totals: { critical, review: pending }, eligible: critical === 0, note: 'Cảnh báo chỉ để phân tích, không thay đổi hạch toán hay điều kiện CLOSE.' };
}
export function comparableAverageUnit(res) {
  if (!res || !Array.isArray(res.sales)) return { value: null, label: 'Không so sánh được' };
  const base = res.sales.filter((s) => s.acc === '511' && s.fin === 'FIFO COGS' && Math.abs(num(s.fq)) > 1e-9);
  const units = new Set(base.map((s) => ttxt(s.uom || s.unit || '')));
  const products = new Set(base.map((s) => key(s.prod)));
  if (units.size !== 1 || products.size !== 1 || !base.length) return { value: null, label: 'Nhiều sản phẩm/ĐVT — không có giá BQ chung' };
  const qty = base.reduce((a,s)=>a+num(s.fq),0), net = base.reduce((a,s)=>a+num(s.vnd),0);
  return { value: Math.abs(qty)>1e-9 ? net/qty : null, label: 'Cùng mã sản phẩm và ĐVT' };
}
