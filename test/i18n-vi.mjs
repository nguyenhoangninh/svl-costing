// Vietnamese-mode translation (v1.14.72): the English text the app writes itself is shown in Vietnamese,
// data and engine status codes are left alone, and English mode still reads the Vietnamese source.
import { trVi, tr } from '../src/i18n.js';
import { VI_FROM_EN } from '../src/i18n-vi.js';

let total = 0, fail = 0;
const ok = (label, cond) => { total++; if (!cond) fail++; console.log(`${cond ? '✓' : '✗'} ${label}`); };
const count = (s) => (String(s).match(/\{#\}/g) || []).length;

// dictionary shape
const entries = Object.entries(VI_FROM_EN);
ok('dictionary has entries', entries.length > 300);
ok('no empty translation', entries.every(([k, v]) => String(v).trim() !== ''));
ok('every {#} in a key has a {#} in its translation', entries.every(([k, v]) => count(k) === count(v)));
ok('no key is only whitespace or a number', entries.every(([k]) => k.trim() === k && !/^[\d\s.,{#}]+$/.test(k)));

// exact and number-aware lookups
ok('exact label', trVi('Must be zero') === 'Phải bằng 0');
ok('label with a number keeps the number', trVi('Opening layers: 12') === 'Số lớp đầu kỳ: 12');
ok('thousands separators are kept', trVi('Production layers: 3,456') === 'Số lớp sản xuất: 3,456');
ok('step checkpoint keeps its counts', trVi('Checkpoint STEP 4 (14 / 14 OK)') === 'Điểm kiểm tra STEP 4 (14 / 14 OK)');
ok('step 3B checkpoint keeps its counts', trVi('Checkpoint STEP 3B (20 / 22 OK)') === 'Điểm kiểm tra STEP 3B (20 / 22 OK)');
ok('composite warnings are translated piece by piece', trVi('Missing SI Invoice No.; Missing/invalid Exchange Rate') === 'Thiếu số hoá đơn SI; Thiếu hoặc tỷ giá không hợp lệ');
ok('unit-cost message with its review flag', trVi('Unit cost after provision 718,670 > NRV 463,708 VND (price 470,770 − 1.5% selling cost); provision needed 11,473,255 STEP 4 REVIEW: no 622/627 allocated (non-positive contribution)') === 'Giá vốn sau dự phòng 718,670 > NRV 463,708 VND (giá 470,770 − 1.5% chi phí bán hàng); cần dự phòng 11,473,255 STEP 4 CẦN RÀ SOÁT: không phân bổ 622/627 (đóng góp không dương)');

// what is left alone
ok('engine status codes stay English', trVi('PASS WITH REVIEW') === null && trVi('NOT RUN') === null);
ok('Vietnamese text is not translated again', trVi('Phải bằng 0') === null);
ok('product data stays as it is', trVi('TET1012531 Do not Remove sticker 43x13 RevB1') === null);
ok('audit action names stay as recorded', trVi('STEP 5 - RUN FIFO COGS') === null && trVi('STEP 5 - CLOSE MONTH') === null);
ok('unknown English text stays as it is', trVi('Some unknown sentence here') === null);

// English mode still works from the Vietnamese source
ok('EN mode: Vietnamese source is translated', tr('Dự phòng FG · TK 2294') === 'FG provision · TK 2294');
ok('EN mode: English text is left alone', tr('Must be zero') === null);

console.log(`\n${total - fail}/${total} Vietnamese-mode checks passed`);
process.exit(fail ? 1 : 0);
