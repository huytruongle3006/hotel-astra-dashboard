-- Script DDL: Tạo các bảng dữ liệu cho Hotel Management
-- 1. Chuyển vào Keyspace
USE hotel_ks;

-- 2. Bảng thông tin khách sạn
CREATE TABLE IF NOT EXISTS hotels (
    hotel_id TEXT,
    hotel_name TEXT,
    city TEXT,
    address TEXT,
    star_rating INT,
    phone TEXT,
    PRIMARY KEY (hotel_id)
);

-- 3. Bảng phòng theo khách sạn (Partition Key: hotel_id, Clustering: room_number)
CREATE TABLE IF NOT EXISTS rooms_by_hotel (
    hotel_id TEXT,
    room_number INT,
    room_type TEXT,
    price_per_night DECIMAL,
    status TEXT, -- 'AVAILABLE', 'OCCUPIED', 'MAINTENANCE'
    PRIMARY KEY (hotel_id, room_number)
);

-- 4. Bảng hồ sơ khách hàng
CREATE TABLE IF NOT EXISTS guests (
    guest_id TEXT,
    full_name TEXT,
    phone TEXT,
    email TEXT,
    national_id TEXT,
    PRIMARY KEY (guest_id)
);

-- 5. Lịch sử đặt phòng theo khách hàng (Sắp xếp check-in mới nhất trước)
CREATE TABLE IF NOT EXISTS bookings_by_guest (
    guest_id TEXT,
    check_in_date DATE,
    booking_id UUID,
    hotel_id TEXT,
    hotel_name TEXT,
    room_number INT,
    check_out_date DATE,
    total_amount DECIMAL,
    status TEXT, -- 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED'
    PRIMARY KEY (guest_id, check_in_date, booking_id)
) WITH CLUSTERING ORDER BY (check_in_date DESC, booking_id DESC);

-- 6. Đặt phòng theo khách sạn & ngày (Dùng tra cứu phòng trống & báo cáo)
CREATE TABLE IF NOT EXISTS bookings_by_hotel_date (
    hotel_id TEXT,
    check_in_date DATE,
    booking_id UUID,
    guest_id TEXT,
    guest_name TEXT,
    room_number INT,
    check_out_date DATE,
    total_amount DECIMAL,
    status TEXT,
    PRIMARY KEY (hotel_id, check_in_date, booking_id)
) WITH CLUSTERING ORDER BY (check_in_date ASC, booking_id ASC);

-- 7. Bảng hóa đơn gắn liền với lượt đặt phòng
CREATE TABLE IF NOT EXISTS invoices_by_booking (
    booking_id UUID,
    invoice_id UUID,
    guest_id TEXT,
    hotel_id TEXT,
    room_charge DECIMAL,
    service_charge DECIMAL,
    tax DECIMAL,
    total_amount DECIMAL,
    payment_status TEXT, -- 'UNPAID', 'PAID', 'REFUNDED'
    issued_at TIMESTAMP,
    PRIMARY KEY (booking_id, invoice_id)
);