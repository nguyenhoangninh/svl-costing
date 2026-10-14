// Firebase project used for cloud sync. These keys are public identifiers (not secrets);
// data is protected by Google sign-in + the Firestore rules in firestore.rules.
// Set FIREBASE_CONFIG = null to run fully offline (data stays in this browser only).
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDvlXlxD5WfYGoSvkuo1Lm6B9WjeXxdHGM',
  authDomain: 'svl-costing.firebaseapp.com',
  projectId: 'svl-costing',
  storageBucket: 'svl-costing.firebasestorage.app',
  messagingSenderId: '369004239067',
  appId: '1:369004239067:web:4d58f572f7fcc834b414fe',
};

// Only these Google accounts may open cloud data (must match firestore.rules).
export const ALLOWED_EMAILS = []; // e.g. ['ten@gmail.com'] — optional UI check; firestore.rules is the real guard

// Firestore collection holding one document per costing period (YYYY-MM).
export const CLOUD_COLLECTION = 'svl_costing_periods';

export const APP_VERSION = 'web 1.14.45 · Đơn giá xuất NVL (MI-M) trong STEP 1: đơn giá BQ, đơn giá chuẩn (trung vị), dòng lệch > 30 % và dòng cost = 0 · R6 (S khác) chia theo tỷ lệ đã phân bổ từ R5a/R5b/R5c thay vì RM Cost (FAMILY; WORKBOOK giữ nguyên) · NOTIFICATIONS: chế độ tương thích theo revision Cloud khi Firestore chưa cấp quyền collection thông báo, hiển thị cảnh báo rõ ràng và lưu trạng thái đọc trên thiết bị · LIVE NOTIFICATIONS: chuông và cảnh báo realtime về chỉnh sửa, tính toán, duyệt, CLOSE/REOPEN, cảnh báo revision mới, đã đọc xuyên thiết bị · CI publish Firestore rules khi merge vào main (cần secret FIREBASE_SA_JSON, OWNER_EMAIL) ·Duyệt đơn giá nhập tay STEP 5R bằng biên nhận Firestore (không cần Cloud Functions): người gửi không tự duyệt được, sửa đơn giá làm mất hiệu lực duyệt cũ · Rà soát sau khi hoàn tác ENH-06: tài liệu kiểm soát duyệt và giới hạn gói Spark được sửa cho đúng · Hoàn tác ENH-06 (không dùng Cloud Functions/Blaze; duyệt đơn giá nhập tay quay về phía máy khách) · Sửa mất chunk khi phản hồi cloud bị mất sau CLOSE (kiểm thử trình duyệt) · Đợt 3 audit: đồng bộ có hàng đợi theo kỳ, thử lại lũy tiến, chuyển kỳ đẩy kỳ cũ trước (ENH-07) · CLOSE: ghi cloud trước rồi mới ghi nhật ký/FG, hoàn tác đầy đủ (ENH-09) · kiểm tra kỳ trước lại trước khi CLOSE (ENH-10) · STEP 3B: quyết định gắn với phân bổ theo PC, HOLD không gỡ BLOCK, cổng 3B dùng chung STEP 4/5/CLOSE, Step 4 không tự đồng bộ sau APPLY · STEP 4 · Cầu nối RM tính tiêu hao NVL (632/152) – hết lệch giả khi có tiêu hao · Tiêu hao NVL: dòng đã chọn tô màu, lọc theo phân hệ, thống kê theo phân hệ, tiêu đề cố định khi cuộn · 2B tiêu dùng nội bộ: khối riêng, chọn dòng, lưu nháp, xác nhận có lý do, hoàn tác · STEP 1 xác nhận từng phần (A/B/C) có ô xóa xác nhận · Tiêu hao NVL theo dòng (632/152) & tiêu dùng FG theo ngày STRICT (632/155) · STEP 1 cảnh báo tách 3 nhóm · Xử lý Rework (5B) · FIFO tách theo hoá đơn · TP sản xuất & tồn kho chi tiết theo dòng (4.4) · Doanh thu / Hàng trả lại tách riêng (511 · 5212 · 5213) · engine Costing Master v30.9';
