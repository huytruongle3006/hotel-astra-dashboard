-- Script DML: Nạp dữ liệu mẫu
USE Demo_hotel;

-- Dữ liệu khách sạn
INSERT INTO hotels (hotel_id, hotel_name, city, address, star_rating, phone) 
VALUES ('HTL001', 'Saigon Riverside Hotel', 'Ho Chi Minh City', '123 Ton Duc Thang, Q1', 4, '028-1234567');
INSERT INTO hotels (hotel_id, hotel_name, city, address, star_rating, phone) 
VALUES ('HTL002', 'Hanoi Old Quarter Hotel', 'Ha Noi', '45 Hang Bac, Hoan Kiem', 3, '024-7654321');

-- Dữ liệu phòng
INSERT INTO rooms_by_hotel (hotel_id, room_number, room_type, price_per_night, status) 
VALUES ('HTL001', 101, 'Standard', 800000, 'AVAILABLE');
INSERT INTO rooms_by_hotel (hotel_id, room_number, room_type, price_per_night, status) 
VALUES ('HTL001', 102, 'Deluxe', 1200000, 'OCCUPIED');
INSERT INTO rooms_by_hotel (hotel_id, room_number, room_type, price_per_night, status) 
VALUES ('HTL001', 201, 'Suite', 2500000, 'AVAILABLE');
INSERT INTO rooms_by_hotel (hotel_id, room_number, room_type, price_per_night, status) 
VALUES ('HTL002', 101, 'Standard', 700000, 'AVAILABLE');

-- Dữ liệu khách hàng
INSERT INTO guests (guest_id, full_name, phone, email, national_id) 
VALUES ('GUEST001', 'Nguyen Van A', '0901234567', 'nguyenvana@gmail.com', '079198001122');
INSERT INTO guests (guest_id, full_name, phone, email, national_id) 
VALUES ('GUEST002', 'Tran Thi B', '0912345678', 'tranthib@gmail.com', '079199003344');

-- Đặt phòng mẫu (booking_id chung: 3f2504e0-4f89-11d3-9a0c-0305e82c3301)
INSERT INTO bookings_by_guest (guest_id, check_in_date, booking_id, hotel_id, hotel_name, room_number, check_out_date, total_amount, status)
VALUES ('GUEST001', '2026-10-01', 3f2504e0-4f89-11d3-9a0c-0305e82c3301, 'HTL001', 'Saigon Riverside Hotel', 102, '2026-10-03', 2400000, 'CONFIRMED');

INSERT INTO bookings_by_hotel_date (hotel_id, check_in_date, booking_id, guest_id, guest_name, room_number, check_out_date, total_amount, status)
VALUES ('HTL001', '2026-10-01', 3f2504e0-4f89-11d3-9a0c-0305e82c3301, 'GUEST001', 'Nguyen Van A', 102, '2026-10-03', 2400000, 'CONFIRMED');

-- Hóa đơn mẫu
INSERT INTO invoices_by_booking (booking_id, invoice_id, guest_id, hotel_id, room_charge, service_charge, tax, total_amount, payment_status, issued_at)
VALUES (3f2504e0-4f89-11d3-9a0c-0305e82c3301, uuid(), 'GUEST001', 'HTL001', 2400000, 100000, 250000, 2750000, 'UNPAID', toTimestamp(now()));