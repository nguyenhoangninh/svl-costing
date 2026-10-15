// Read-only invoice drilldown and exact GP bridge from STEP 5 results.
// Never imputes RM/622/627 causes without a cost-component evidence source.
import { num, ttxt, utxt } from './util.js';
import { custResolver, custKey } from './custpl.js';
const n = (x) => num(x);
export function invoiceDetail(res, filter={}) {
  if (!res || !Array.isArray(res.sales)) return [];
  const resolve = custResolver(res);
  const cust = custKey(filter.cust), product = utxt(filter.prod);
  return res.sales.filter((s) => (!cust || custKey(resolve(s))===cust) && (!product || utxt(s.prod)===product))
    .map((s,i) => ({
      row:i+1, customer:resolve(s), product:ttxt(s.prod)||'(Không mã SP)',
      invoice:ttxt(s.inv)||'(Không số hóa đơn)', original:ttxt(s.matchedOrigInv || s.origInv),
      account:ttxt(s.acc), quantity:n(s.fq), revenue:n(s.vnd), cogs: n(s.tot),
      profit:n(s.vnd)-n(s.tot), status:ttxt(s.status), kind:ttxt(s.fin),
      lot:ttxt(s.lot || s.fgLot || s.fifoLot || s.layer || ''),
    }));
}
export function gpBridge(current, previous) {
  if (!current || !previous || !current.totals || !previous.totals) return null;
  const now=invoiceDetail(current), prev=invoiceDetail(previous);
  const summarize=(rows) => ({
    revenue:rows.reduce((a,r)=>a+r.revenue,0),
    cogs:rows.filter(r=>r.kind==='FIFO COGS'||r.kind==='RETURN').reduce((a,r)=>a+r.cogs,0),
  });
  const c=summarize(now), p=summarize(prev);
  const consNow=n(current.totals.consA), consPrev=n(previous.totals.consA);
  const before={...p, cogs:p.cogs+consPrev}, after={...c,cogs:c.cogs+consNow};
  const revenueEffect=after.revenue-before.revenue, cogsEffect=-(after.cogs-before.cogs);
  const oldGP=before.revenue-before.cogs, newGP=after.revenue-after.cogs;
  return { oldGP,newGP,revenueEffect,cogsEffect,change:newGP-oldGP,
    reconciles: Math.abs(oldGP+revenueEffect+cogsEffect-newGP)<1,
    source:'STEP5', note:'Cầu nối GP tuyệt đối từ doanh thu và tổng giá vốn; chưa phân rã ảnh hưởng giá bán/sản lượng hoặc RM/622/627.' };
}
export function profitSignals(res) {
  if (!res || !Array.isArray(res.sales)) return [];
  const out=[];
  for(const row of invoiceDetail(res)){
    if(row.account==='511' && Math.abs(row.revenue)>1 && row.cogs===0 && row.kind==='FIFO COGS' && row.quantity>0)
      out.push({...row,signal:'MISSING_COGS',reason:'Có xuất bán FIFO và doanh thu nhưng giá vốn bằng 0'});
    if(row.account==='511' && row.revenue>1 && row.cogs>row.revenue)
      out.push({...row,signal:'NEGATIVE_GP',reason:'Giá vốn lớn hơn doanh thu'});
  }
  return out;
}
