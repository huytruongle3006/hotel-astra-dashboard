-- Tổng hợp 12 câu truy vấn CQL nghiệp vụ
-- ============================================================================
-- HỆ THỐNG QUẢN LÝ KHÁCH SẠN (HOTEL MANAGEMENT - CASSANDRA / ASTRA DB)
-- TẬP HỢP 12 TRUY VẤN CQL CHUẨN NGHIỆP VỤ (03_queries_collection.cql)
-- ============================================================================

USE default_keyspace;

-- ----------------------------------------------------------------------------
-- Q1: Xem thông tin chi tiết của một khách sạn theo mã khách sạn
-- Mục đích: Hiển thị thông tin địa chỉ, số sao, số điện thoại lên header/chi tiết
-- Bảng: hotels | Partition Key: hotel_id (Tra cứu O(1))
-- ----------------------------------------------------------------------------
SELECT hotel_id, hotel_name, city, address, star_rating, phone 
FROM hotels 
WHERE hotel_id = 'HTL001';

-- ----------------------------------------------------------------------------
-- Q2: Xem danh sách toàn bộ phòng và trạng thái của một khách sạn
-- Mục đích: Phục vụ sơ đồ phòng trực quan của lễ tân/quản trị viên
-- Bảng: rooms_by_hotel | Partition Key: hotel_id | Clustering: room_number ASC
-- ----------------------------------------------------------------------------
SELECT room_number, room_type, price_per_night, status 
FROM rooms_by_hotel 
WHERE hotel_id = 'HTL001';

-- ----------------------------------------------------------------------------
-- Q3: Xem toàn bộ lịch sử đặt phòng của một khách hàng (Mới nhất lên đầu)
-- Mục đích: Tra cứu hồ sơ lịch sử lưu trú khi khách quay lại
-- Bảng: bookings_by_guest | PK: guest_id | Clustering: check_in_date DESC
-- ----------------------------------------------------------------------------
SELECT check_in_date, booking_id, hotel_id, hotel_name, room_number, check_out_date, total_amount, status 
FROM bookings_by_guest 
WHERE guest_id = 'GUEST001';

-- ----------------------------------------------------------------------------
-- Q4: Tra cứu đặt phòng của một khách sạn trong khoảng thời gian nhận phòng
-- Mục đích: Quản lý lịch trình phòng, kiểm tra phòng trống theo đợt
-- Bảng: bookings_by_hotel_date | PK: hotel_id | Clustering: check_in_date ASC
-- ----------------------------------------------------------------------------
SELECT check_in_date, booking_id, guest_id, guest_name, room_number, check_out_date, total_amount, status 
FROM bookings_by_hotel_date 
WHERE hotel_id = 'HTL001' 
  AND check_in_date >= '2026-10-01' 
  AND check_in_date <= '2026-12-31';

-- ----------------------------------------------------------------------------
-- Q5: Tra cứu chi tiết hóa đơn theo mã đặt phòng (booking_id)
-- Mục đích: Thu ngân xuất hóa đơn thanh toán tiền phòng, dịch vụ và thuế
-- Bảng: invoices_by_booking | Partition Key: booking_id
-- ----------------------------------------------------------------------------
SELECT invoice_id, booking_id, guest_id, hotel_id, room_charge, service_charge, tax, total_amount, payment_status, issued_at 
FROM invoices_by_booking 
WHERE booking_id = 3f2504e0-4f89-11d3-9a0c-0305e82c3301;

-- ----------------------------------------------------------------------------
-- Q6: Đăng ký tạo mới hồ sơ định danh khách hàng
-- Mục đích: Lưu trữ thông tin cá nhân khách lưu trú (CCCD, SĐT, Email)
-- Bảng: guests | Partition Key: guest_id
-- ----------------------------------------------------------------------------
INSERT INTO guests (guest_id, full_name, phone, email, national_id) 
VALUES ('GUEST003', 'Le Van C', '0988776655', 'levanc@gmail.com', '079200005566');

-- ----------------------------------------------------------------------------
-- Q7: Cập nhật trạng thái phòng khi khách Check-in hoặc Check-out
-- Mục đích: Đổi trạng thái 'AVAILABLE' -> 'OCCUPIED' hoặc 'MAINTENANCE'
-- Bảng: rooms_by_hotel | WHERE đầy đủ Partition Key + Clustering Key
-- ----------------------------------------------------------------------------
UPDATE rooms_by_hotel 
SET status = 'OCCUPIED' 
WHERE hotel_id = 'HTL001' AND room_number = 101;

-- ----------------------------------------------------------------------------
-- Q8: Tạo đặt phòng mới đồng thời vào 2 bảng bằng ATOMIC LOGGED BATCH
-- Mục đích: Đảm bảo tính nhất quán (Consistency) trong NoSQL giữa 2 bảng
-- Bảng tác động: bookings_by_guest VÀ bookings_by_hotel_date
-- ----------------------------------------------------------------------------
BEGIN BATCH
  INSERT INTO bookings_by_guest (
    guest_id, check_in_date, booking_id, 
    hotel_id, hotel_name, room_number, 
    check_out_date, total_amount, status
  ) VALUES (
    'GUEST002', '2026-11-05', 8a1e2f30-4f89-11d3-9a0c-0305e82c9999', 
    'HTL001', 'Saigon Riverside Hotel', 201, 
    '2026-11-07', 5000000, 'CONFIRMED'
  );

  INSERT INTO bookings_by_hotel_date (
    hotel_id, check_in_date, booking_id, 
    guest_id, guest_name, room_number, 
    check_out_date, total_amount, status
  ) VALUES (
    'HTL001', '2026-11-05', 8a1e2f30-4f89-11d3-9a0c-0305e82c9999', 
    'GUEST002', 'Tran Thi B', 201, 
    '2026-11-07', 5000000, 'CONFIRMED'
  );
APPLY BATCH;

-- ----------------------------------------------------------------------------
-- Q9: Hủy đơn đặt phòng đồng bộ trên cả 2 bảng bằng BATCH DELETE
-- Mục đích: Tránh tình trạng lệch dữ liệu giữa danh sách khách và danh sách phòng
-- Bảng tác động: bookings_by_guest VÀ bookings_by_hotel_date
-- ----------------------------------------------------------------------------
BEGIN BATCH
  DELETE FROM bookings_by_guest 
  WHERE guest_id = 'GUEST001' 
    AND check_in_date = '2026-10-01' 
    AND booking_id = 3f2504e0-4f89-11d3-9a0c-0305e82c3301;

  DELETE FROM bookings_by_hotel_date 
  WHERE hotel_id = 'HTL001' 
    AND check_in_date = '2026-10-01' 
    AND booking_id = 3f2504e0-4f89-11d3-9a0c-0305e82c3301;
APPLY BATCH;

-- ----------------------------------------------------------------------------
-- Q10: Thống kê số lượng phòng, giá phòng thấp nhất và cao nhất theo khách sạn
-- Mục đích: Báo cáo nhanh tình hình giá niêm yết trong phân hệ Báo cáo
-- Bảng: rooms_by_hotel | Hàm thống kê: COUNT, MIN, MAX
-- ----------------------------------------------------------------------------
SELECT COUNT(*) AS total_rooms, 
       MIN(price_per_night) AS min_price, 
       MAX(price_per_night) AS max_price 
FROM rooms_by_hotel 
WHERE hotel_id = 'HTL001';

-- ----------------------------------------------------------------------------
-- Q11: Báo cáo danh sách các hóa đơn chưa thanh toán (UNPAID)
-- Mục đích: Quản lý công nợ và lọc các đơn cần thu tiền
-- Bảng: invoices_by_booking | Sử dụng ALLOW FILTERING cho tác vụ báo cáo
-- ----------------------------------------------------------------------------
SELECT booking_id, invoice_id, guest_id, total_amount, payment_status, issued_at 
FROM invoices_by_booking 
WHERE payment_status = 'UNPAID' 
ALLOW FILTERING;

-- ----------------------------------------------------------------------------
-- Q12: Tra cứu chi tiết hồ sơ định danh của một khách hàng
-- Mục đích: Hiển thị thẻ thông tin liên hệ của khách hàng khi nhập Guest ID
-- Bảng: guests | Partition Key: guest_id (Tra cứu O(1))
-- ----------------------------------------------------------------------------
SELECT guest_id, full_name, phone, email, national_id 
FROM guests 
WHERE guest_id = 'GUEST001';

-- ----------------------------------------------------------------------------
-- Q13: Điều chỉnh giá phòng và nâng/hạ hạng phòng của chi nhánh
-- Mục đích: Quản lý chính sách giá linh hoạt và phân loại buồng phòng
-- Bảng: rooms_by_hotel | WHERE đầy đủ Partition Key + Clustering Key
-- ----------------------------------------------------------------------------
UPDATE rooms_by_hotel 
SET price_per_night = 1500000, 
    room_type = 'Deluxe Ocean', 
    status = 'AVAILABLE' 
WHERE hotel_id = 'HTL001' AND room_number = 101;

-- ----------------------------------------------------------------------------
-- Q14: Cập nhật thông tin liên hệ của khách hàng (Số điện thoại, Email)
-- Mục đích: Hỗ trợ chăm sóc khách hàng và cập nhật thông tin liên lạc mới
-- Bảng: guests | Partition Key: guest_id (Tra cứu O(1))
-- ----------------------------------------------------------------------------
UPDATE guests 
SET phone = '0911223344', 
    email = 'nguyenvanb_new@gmail.com' 
WHERE guest_id = 'GUEST001';

-- ----------------------------------------------------------------------------
-- Q15: Quyết toán thu tiền và chuyển trạng thái hóa đơn sang PAID
-- Mục đích: Thu ngân xác nhận thanh toán tiền phòng và dịch vụ hoàn tất
-- Bảng: invoices_by_booking | WHERE đầy đủ Partition Key + Clustering Key
-- ----------------------------------------------------------------------------
UPDATE invoices_by_booking 
SET payment_status = 'PAID' 
WHERE booking_id = 3f2504e0-4f89-11d3-9a0c-0305e82c3301 
  AND invoice_id = 4a1234e0-4f89-11d3-9a0c-0305e82c0001;

-- ----------------------------------------------------------------------------
-- Q16: Mở rộng thêm chi nhánh khách sạn mới vào hệ thống chuỗi
-- Mục đích: Lưu trữ thông tin cơ sở mới mở rộng vào bảng danh mục chi nhánh
-- Bảng: hotels | Partition Key: hotel_id
-- ----------------------------------------------------------------------------
INSERT INTO hotels (hotel_id, hotel_name, city, address, star_rating, phone) 
VALUES ('HTL003', 'Grand Da Nang Beach Resort', 'Da Nang', 'Vo Nguyen Giap, Son Tra', 5, '02363999888');

-- ----------------------------------------------------------------------------
-- Q17: Xóa vĩnh viễn hồ sơ khách hàng theo yêu cầu bảo mật định danh
-- Mục đích: Dọn dẹp dữ liệu khách hủy tài khoản hoặc hồ sơ rác
-- Bảng: guests | Partition Key: guest_id
-- ----------------------------------------------------------------------------
DELETE FROM guests 
WHERE guest_id = 'GUEST003';

-- ----------------------------------------------------------------------------
-- Q18: Thống kê tổng số lượt đặt phòng của khách sạn trong năm theo khoảng ngày
-- Mục đích: Báo cáo số lượt phòng đặt thành công trong phân hệ Báo cáo & Thống kê
-- Bảng: bookings_by_hotel_date | Hàm tổng hợp: COUNT(*) trên Clustering Key
-- ----------------------------------------------------------------------------
SELECT COUNT(*) AS total_bookings 
FROM bookings_by_hotel_date 
WHERE hotel_id = 'HTL001' 
  AND check_in_date >= '2026-01-01' 
  AND check_in_date <= '2026-12-31';