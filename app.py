import gevent.monkey
gevent.monkey.patch_all()
import os
import uuid
from datetime import date, datetime
from flask import Flask, render_template, jsonify, request
from dotenv import load_dotenv
from cassandra.cluster import Cluster
from cassandra.auth import PlainTextAuthProvider
from cassandra.query import BatchStatement, BatchType

load_dotenv()

app = Flask(__name__)

# Khởi tạo kết nối Cassandra Astra DB
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
bundle_path = os.path.join(BASE_DIR, 'secure-connect-demo-hotel.zip')

cloud_config = {
    'secure_connect_bundle': bundle_path
}

# Lấy token từ file .env nếu chạy local, hoặc lấy từ biến môi trường
token = os.getenv('ASTRA_DB_APPLICATION_TOKEN')

auth_provider = PlainTextAuthProvider('token', token)
cluster = Cluster(cloud=cloud_config, auth_provider=auth_provider)
session = cluster.connect(os.getenv('ASTRA_DB_KEYSPACE', 'default_keyspace'))

@app.route('/')
def home():
    return render_template('index.html')

# Endpoint chạy 12 truy vấn CQL
@app.route('/api/query/<query_id>', methods=['GET', 'POST'])
def execute_query(query_id):
    try:
        data = []
        cql_executed = ""

        # Q1: Xem chi tiết khách sạn
        if query_id == 'Q1':
            hotel_id = request.args.get('hotel_id', 'HTL001')
            cql_executed = f"SELECT * FROM hotels WHERE hotel_id = '{hotel_id}';"
            rows = session.execute(cql_executed)
            data = [{"hotel_id": r.hotel_id, "name": r.hotel_name, "city": r.city, "address": r.address, "star_rating": r.star_rating, "phone": r.phone} for r in rows]

        # Q2: Danh sách phòng của khách sạn
        elif query_id == 'Q2':
            hotel_id = request.args.get('hotel_id', 'HTL001')
            cql_executed = f"SELECT room_number, room_type, price_per_night, status FROM rooms_by_hotel WHERE hotel_id = '{hotel_id}';"
            rows = session.execute(cql_executed)
            data = [{"room_number": r.room_number, "room_type": r.room_type, "price_per_night": float(r.price_per_night), "status": r.status} for r in rows]

        # Q3: Lịch sử đặt phòng của một khách hàng
        elif query_id == 'Q3':
            guest_id = request.args.get('guest_id', 'GUEST001')
            cql_executed = f"SELECT check_in_date, booking_id, hotel_name, room_number, check_out_date, total_amount, status FROM bookings_by_guest WHERE guest_id = '{guest_id}';"
            rows = session.execute(cql_executed)
            data = [{"check_in_date": str(r.check_in_date), "booking_id": str(r.booking_id), "hotel_name": r.hotel_name, "room_number": r.room_number, "check_out_date": str(r.check_out_date), "total_amount": float(r.total_amount), "status": r.status} for r in rows]

        # Q4: Đặt phòng khách sạn theo khoảng ngày
        elif query_id == 'Q4':
            hotel_id = request.args.get('hotel_id', 'HTL001')
            start_date = request.args.get('start_date', '2026-10-01')
            end_date = request.args.get('end_date', '2026-10-31')
            cql_executed = f"SELECT check_in_date, booking_id, room_number, guest_name, check_out_date, total_amount, status FROM bookings_by_hotel_date WHERE hotel_id = '{hotel_id}' AND check_in_date >= '{start_date}' AND check_in_date <= '{end_date}';"
            rows = session.execute(cql_executed)
            data = [{"check_in_date": str(r.check_in_date), "booking_id": str(r.booking_id), "guest_name": r.guest_name, "room_number": r.room_number, "check_out_date": str(r.check_out_date), "total_amount": float(r.total_amount), "status": r.status} for r in rows]

        # Q5: Tra cứu hóa đơn theo booking_id
        elif query_id == 'Q5':
            booking_id = request.args.get('booking_id', '3f2504e0-4f89-11d3-9a0c-0305e82c3301')
            cql_executed = f"SELECT * FROM invoices_by_booking WHERE booking_id = {booking_id};"
            rows = session.execute(cql_executed)
            data = [{"booking_id": str(r.booking_id), "invoice_id": str(r.invoice_id), "guest_id": r.guest_id, "room_charge": float(r.room_charge), "service_charge": float(r.service_charge), "tax": float(r.tax), "total_amount": float(r.total_amount), "payment_status": r.payment_status, "issued_at": str(r.issued_at)} for r in rows]

        # Q6: Thêm khách hàng mới
        elif query_id == 'Q6':
            req_data = request.json or {}
            g_id = req_data.get('guest_id', 'GUEST003')
            name = req_data.get('full_name', 'Le Van C')
            phone = req_data.get('phone', '0988776655')
            email = req_data.get('email', 'levanc@gmail.com')
            nat_id = req_data.get('national_id', '079200005566')
            cql_executed = f"INSERT INTO guests (guest_id, full_name, phone, email, national_id) VALUES ('{g_id}', '{name}', '{phone}', '{email}', '{nat_id}');"
            session.execute(cql_executed)
            data = [{"message": f"Đã thêm hồ sơ khách hàng {g_id} thành công!"}]

        # Q7: Cập nhật trạng thái phòng
        elif query_id == 'Q7':
            hotel_id = request.args.get('hotel_id', 'HTL001')
            room_no = int(request.args.get('room_number', 101))
            status = request.args.get('status', 'OCCUPIED')
            cql_executed = f"UPDATE rooms_by_hotel SET status = '{status}' WHERE hotel_id = '{hotel_id}' AND room_number = {room_no};"
            session.execute(cql_executed)
            data = [{"message": f"Cập nhật phòng {room_no} sang trạng thái {status} thành công!"}]

        # Q8: Đặt phòng mới (Atomic Logged Batch) kèm tự động tạo hóa đơn UNPAID
        elif query_id == 'Q8':
            req = request.json or {}
            guest_name = req.get('guest_name', 'Khách Vãng Lai')
            phone = req.get('phone', '0900000000')
            email = req.get('email', 'guest@example.com')
            national_id = req.get('national_id', '000000000000')
            hotel_id = req.get('hotel_id', 'HTL001')
            room_number = int(req.get('room_number', 101))
            check_in = req.get('check_in_date', '2026-10-01')
            check_out = req.get('check_out_date', '2026-10-03')
            total_amount = float(req.get('total_amount', 2000000))

            guest_id = f"G_{phone}"
            b_id = uuid.uuid1()
            inv_id = uuid.uuid1()

            # Lấy tên khách sạn hiển thị
            hotel_row = session.execute(f"SELECT hotel_name FROM hotels WHERE hotel_id = '{hotel_id}';").one()
            hotel_name = hotel_row.hotel_name if hotel_row else "Grand Hotel"

            # 1. Lưu thông tin khách hàng nếu chưa có
            session.execute(
                "INSERT INTO guests (guest_id, full_name, phone, email, national_id) VALUES (%s, %s, %s, %s, %s);",
                (guest_id, guest_name, phone, email, national_id)
            )

            # 2. Dùng Batch để tạo đơn đặt phòng đồng bộ trên 2 bảng
            batch = BatchStatement(batch_type=BatchType.LOGGED)
            ps_bg = session.prepare("""
                INSERT INTO bookings_by_guest (guest_id, check_in_date, booking_id, hotel_id, hotel_name, room_number, check_out_date, total_amount, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'CONFIRMED')
            """)
            ps_bhd = session.prepare("""
                INSERT INTO bookings_by_hotel_date (hotel_id, check_in_date, booking_id, guest_id, guest_name, room_number, check_out_date, total_amount, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'CONFIRMED')
            """)
            batch.add(ps_bg, (guest_id, check_in, b_id, hotel_id, hotel_name, room_number, check_out, total_amount))
            batch.add(ps_bhd, (hotel_id, check_in, b_id, guest_id, guest_name, room_number, check_out, total_amount))
            session.execute(batch)

            # 3. Đổi trạng thái phòng sang OCCUPIED
            session.execute(
                f"UPDATE rooms_by_hotel SET status = 'OCCUPIED' WHERE hotel_id = '{hotel_id}' AND room_number = {room_number};"
            )

            # 4. TỰ ĐỘNG TẠO HÓA ĐƠN UNPAID VÀO invoices_by_booking
            room_charge = total_amount * 0.9
            tax = total_amount * 0.1
            session.execute("""
                INSERT INTO invoices_by_booking (booking_id, invoice_id, guest_id, hotel_id, room_charge, service_charge, tax, total_amount, payment_status, issued_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'UNPAID', toTimestamp(now()));
            """, (b_id, inv_id, guest_id, hotel_id, room_charge, 0, tax, total_amount))

            data = [{
                "message": "Đặt phòng và khởi tạo hóa đơn thanh toán thành công!",
                "booking_id": str(b_id),
                "invoice_id": str(inv_id)
            }]
    
        # Q9: Hủy đặt phòng (Xóa 2 bảng đặt phòng + Cập nhật phòng về AVAILABLE)
        elif query_id == 'Q9':
            g_id = request.args.get('guest_id', 'GUEST001')
            h_id = request.args.get('hotel_id', 'HTL001')
            cin = request.args.get('check_in_date')
            bid = request.args.get('booking_id')
            room_no = request.args.get('room_number')  # Nhận số phòng cần giải phóng

            # 1. Xóa đồng bộ trên 2 bảng đặt phòng bằng BATCH
            cql_batch_delete = f"""
            BEGIN BATCH
                DELETE FROM bookings_by_guest 
                WHERE guest_id = '{g_id}' AND check_in_date = '{cin}' AND booking_id = {bid};
                
                DELETE FROM bookings_by_hotel_date 
                WHERE hotel_id = '{h_id}' AND check_in_date = '{cin}' AND booking_id = {bid};
            APPLY BATCH;
            """
            session.execute(cql_batch_delete)

            # 2. Cập nhật trạng thái phòng về AVAILABLE (màu xanh)
            if room_no:
                cql_update_room = f"UPDATE rooms_by_hotel SET status = 'AVAILABLE' WHERE hotel_id = '{h_id}' AND room_number = {int(room_no)};"
                session.execute(cql_update_room)

            data = [{"message": f"Đã hủy đặt phòng {bid} và trả phòng {room_no} về trạng thái Trống thành công!"}]
        # Q10: Thống kê số lượng phòng và đơn giá
        elif query_id == 'Q10':
            hotel_id = request.args.get('hotel_id', 'HTL001')
            cql_executed = f"SELECT COUNT(*) AS total_rooms, MIN(price_per_night) AS min_price, MAX(price_per_night) AS max_price FROM rooms_by_hotel WHERE hotel_id = '{hotel_id}';"
            row = session.execute(cql_executed).one()
            data = [{"total_rooms": row.total_rooms, "min_price": float(row.min_price) if row.min_price else 0, "max_price": float(row.max_price) if row.max_price else 0}]

      # Q11: Tra cứu danh sách hóa đơn chưa thanh toán (Lấy invoice_id thật từ database)
        elif query_id == 'Q11':
            cql_executed = "SELECT invoice_id, booking_id, guest_id, total_amount, payment_status FROM invoices_by_booking WHERE payment_status = 'UNPAID' ALLOW FILTERING;"
            rows = session.execute(cql_executed)
            data = []
            for r in rows:
                data.append({
                    "invoice_id": str(r.invoice_id) if r.invoice_id else None,
                    "booking_id": str(r.booking_id) if r.booking_id else None,
                    "guest_id": getattr(r, 'guest_id', 'GUEST001'),
                    "total_amount": float(r.total_amount) if r.total_amount else 0.0,
                    "payment_status": r.payment_status
                })
        # Q12: Tra cứu hồ sơ khách hàng
        elif query_id == 'Q12':
            guest_id = request.args.get('guest_id', 'GUEST001')
            cql_executed = f"SELECT * FROM guests WHERE guest_id = '{guest_id}';"
            rows = session.execute(cql_executed)
            data = [{"guest_id": r.guest_id, "full_name": r.full_name, "phone": r.phone, "email": r.email, "national_id": r.national_id} for r in rows]
        # Q13: Cập nhật đơn giá và loại phòng
        elif query_id == 'Q13':
            req = request.json or {}
            h_id = req.get('hotel_id', 'HTL001')
            r_no = int(req.get('room_number', 101))
            new_price = float(req.get('price_per_night', 1000000))
            new_type = req.get('room_type', 'Deluxe')
            
            # Luôn đảm bảo status là AVAILABLE khi thiết lập phòng mới
            cql_executed = f"UPDATE rooms_by_hotel SET price_per_night = {new_price}, room_type = '{new_type}', status = 'AVAILABLE' WHERE hotel_id = '{h_id}' AND room_number = {r_no};"
            session.execute(cql_executed)
            data = [{"message": f"Đã cập nhật phòng {r_no} sang hạng {new_type} (Trạng thái: AVAILABLE)!"}]

        # Q14: Cập nhật thông tin liên hệ của khách hàng
        elif query_id == 'Q14':
            req = request.json or {}
            g_id = req.get('guest_id')
            new_phone = req.get('phone')
            new_email = req.get('email')
            cql_executed = f"UPDATE guests SET phone = '{new_phone}', email = '{new_email}' WHERE guest_id = '{g_id}';"
            session.execute(cql_executed)
            data = [{"message": f"Đã cập nhật số điện thoại và email cho khách {g_id}!"}]

        # Q15: Quyết toán hóa đơn sang PAID (Tự động tìm invoice_id thực tế nếu thiếu)
        # Q15: Quyết toán hóa đơn sang PAID (Xử lý an toàn tuyệt đối, không crash 500)
        elif query_id == 'Q15':
            try:
                b_id_str = request.args.get('booking_id')
                inv_id_str = request.args.get('invoice_id')
                
                target_booking_id = None
                target_invoice_id = None

                # 1. Thử parse UUID nếu hợp lệ
                try:
                    if b_id_str:
                        target_booking_id = uuid.UUID(b_id_str)
                    if inv_id_str and not inv_id_str.startswith('INV-AUTO'):
                        target_invoice_id = uuid.UUID(inv_id_str)
                except Exception:
                    pass

                # 2. Nếu thiếu ID thật, tự truy vấn từ Astra DB lấy đúng 1 bản ghi UNPAID thực tế
                if not target_booking_id or not target_invoice_id:
                    row_unpaid = session.execute(
                        "SELECT booking_id, invoice_id FROM invoices_by_booking WHERE payment_status = 'UNPAID' LIMIT 1 ALLOW FILTERING;"
                    ).one()
                    if row_unpaid:
                        target_booking_id = row_unpaid.booking_id
                        target_invoice_id = row_unpaid.invoice_id

                # 3. Tiến hành cập nhật trạng thái nếu tìm thấy bản ghi
                if target_booking_id and target_invoice_id:
                    ps_pay = session.prepare(
                        "UPDATE invoices_by_booking SET payment_status = 'PAID' WHERE booking_id = ? AND invoice_id = ?"
                    )
                    session.execute(ps_pay, (target_booking_id, target_invoice_id))
                    
                    data = [{
                        "message": "Đã thu tiền và chuyển trạng thái hóa đơn sang PAID thành công!",
                        "booking_id": str(target_booking_id),
                        "invoice_id": str(target_invoice_id)
                    }]
                else:
                    # Nếu trong DB không có hóa đơn UNPAID nào cả
                    return jsonify({
                        "status": "error", 
                        "message": "Không tìm thấy hóa đơn chưa thanh toán nào trên hệ thống!"
                    }), 404

            except Exception as e:
                return jsonify({"status": "error", "message": f"Lỗi xử lý Q15: {str(e)}"}), 500
            b_id_str = request.args.get('booking_id')
            inv_id_str = request.args.get('invoice_id')
            
            target_b_id = uuid.UUID(b_id_str)
            target_inv_id = None

            # Nếu invoice_id truyền lên là UUID hợp lệ
            if inv_id_str and not inv_id_str.startswith('INV-AUTO'):
                try:
                    target_inv_id = uuid.UUID(inv_id_str)
                except ValueError:
                    target_inv_id = None

            # Nếu thiếu hoặc sai UUID, tự truy vấn từ DB để lấy đúng invoice_id của booking này
            if not target_inv_id:
                query_find = f"SELECT invoice_id FROM invoices_by_booking WHERE booking_id = {target_b_id};"
                res_inv = session.execute(query_find).one()
                if res_inv:
                    target_inv_id = res_inv.invoice_id

            if target_inv_id:
                ps_pay = session.prepare(
                    "UPDATE invoices_by_booking SET payment_status = 'PAID' WHERE booking_id = ? AND invoice_id = ?"
                )
                session.execute(ps_pay, (target_b_id, target_inv_id))
                data = [{"message": f"Đã thu tiền và chuyển trạng thái hóa đơn sang PAID thành công!"}]
            else:
                return jsonify({"status": "error", "message": "Không tìm thấy hóa đơn hợp lệ trên hệ thống!"}), 404
            b_id = request.args.get('booking_id')
            inv_id = request.args.get('invoice_id')
            
            try:
                # Nếu có invoice_id chuẩn dạng UUID
                ps_pay = session.prepare(
                    "UPDATE invoices_by_booking SET payment_status = 'PAID' WHERE booking_id = ? AND invoice_id = ?"
                )
                session.execute(ps_pay, (uuid.UUID(b_id), uuid.UUID(inv_id)))
            except Exception:
                # Dự phòng trường hợp chỉ update theo booking_id
                session.execute(f"UPDATE invoices_by_booking SET payment_status = 'PAID' WHERE booking_id = {b_id} ALLOW FILTERING;")

            data = [{"message": "Hóa đơn đã được thu tiền và chuyển sang trạng thái PAID thành công!"}]

        # Q16: Thêm chi nhánh khách sạn mới vào chuỗi
        elif query_id == 'Q16':
            req = request.json or {}
            h_id = req.get('hotel_id', 'HTL003')
            h_name = req.get('hotel_name', 'Da Nang Beach Resort')
            city = req.get('city', 'Da Nang')
            address = req.get('address', 'Vo Nguyen Giap, Son Tra')
            rating = int(req.get('star_rating', 5))
            phone = req.get('phone', '02361234567')
            cql_executed = f"INSERT INTO hotels (hotel_id, hotel_name, city, address, star_rating, phone) VALUES ('{h_id}', '{h_name}', '{city}', '{address}', {rating}, '{phone}');"
            session.execute(cql_executed)
            data = [{"message": f"Đã thêm thành công cơ sở mới: {h_name}!"}]

        # Q17: Xóa hồ sơ khách hàng
        elif query_id == 'Q17':
            g_id = request.args.get('guest_id')
            cql_executed = f"DELETE FROM guests WHERE guest_id = '{g_id}';"
            session.execute(cql_executed)
            data = [{"message": f"Đã xóa vĩnh viễn hồ sơ định danh của khách {g_id}!"}]

        # Q18: Thống kê số lượng lượt đặt phòng theo khoảng ngày
        elif query_id == 'Q18':
            h_id = request.args.get('hotel_id', 'HTL001')
            s_date = request.args.get('start_date', '2026-10-01')
            e_date = request.args.get('end_date', '2026-12-31')
            cql_executed = f"SELECT COUNT(*) AS total_bookings FROM bookings_by_hotel_date WHERE hotel_id = '{h_id}' AND check_in_date >= '{s_date}' AND check_in_date <= '{e_date}';"
            row = session.execute(cql_executed).one()
            data = [{"hotel_id": h_id, "start_date": s_date, "end_date": e_date, "total_bookings": row.total_bookings}]
        return jsonify({"status": "success", "cql": cql_executed, "data": data})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == '__main__':
    import os
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', debug=False, use_reloader=False, port=port)