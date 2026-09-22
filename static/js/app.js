// ============================================================================
// HỆ THỐNG QUẢN TRỊ KHÁCH SẠN - XỬ LÝ NGHIỆP VỤ ASTRA DB (APP.JS - 18 QUERIES)
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    // 1. Tải toàn bộ dữ liệu ban đầu
    reloadAllData();

    // 2. Lắng nghe sự kiện mở Modal Đặt Phòng Mới để nạp danh sách phòng trống (Q2)
    const bookingModalEl = document.getElementById('newBookingModal');
    if (bookingModalEl) {
        bookingModalEl.addEventListener('show.bs.modal', function () {
            loadAvailableRoomsDropdown();
        });
    }
});

// Lấy ID khách sạn đang chọn trên thanh điều hướng
function getSelectedHotel() {
    const select = document.getElementById('currentHotelSelect');
    return select ? select.value : 'HTL001';
}

// Tải lại toàn bộ phân hệ khi đổi chi nhánh
function reloadAllData() {
    loadHotelInfo();
    loadRooms();
    loadBookings();
    loadHotelStats();
}

// ----------------------------------------------------------------------------
// 1. Áp dụng Q1: Xem thông tin chi tiết khách sạn
// ----------------------------------------------------------------------------
function loadHotelInfo() {
    const hotelId = getSelectedHotel();
    fetch(`/api/query/Q1?hotel_id=${hotelId}`)
        .then(r => r.json())
        .then(res => {
            if (res.data && res.data.length > 0) {
                const h = res.data[0];
                document.getElementById('hotelInfoBadge').innerHTML = 
                    `<i class="bi bi-geo-alt-fill text-danger me-1"></i>${h.address}, ${h.city} | ⭐ ${h.star_rating} Sao`;
            }
        })
        .catch(err => console.error("Lỗi tải thông tin khách sạn:", err));
}

// ----------------------------------------------------------------------------
// 2. Áp dụng Q2 & Q7: Sơ đồ phòng trực quan & Cập nhật trạng thái phòng
// ----------------------------------------------------------------------------
function loadRooms() {
    const hotelId = getSelectedHotel();
    const container = document.getElementById('roomContainer');
    container.innerHTML = `<div class="text-center py-5"><div class="spinner-border text-primary"></div><div class="small mt-2 text-muted">Đang tải sơ đồ phòng...</div></div>`;

    fetch(`/api/query/Q2?hotel_id=${hotelId}`)
        .then(r => r.json())
        .then(res => {
            container.innerHTML = '';
            if (!res.data || res.data.length === 0) {
                container.innerHTML = '<div class="col-12 text-center text-muted py-5">Chưa có dữ liệu phòng cho chi nhánh này.</div>';
                return;
            }
            res.data.forEach(room => {
                let statusClass = 'room-available';
                let statusBadge = '<span class="badge bg-success">Trống</span>';
                if (room.status === 'OCCUPIED') {
                    statusClass = 'room-occupied';
                    statusBadge = '<span class="badge bg-danger">Đang Sử Dụng</span>';
                } else if (room.status === 'MAINTENANCE') {
                    statusClass = 'room-maintenance';
                    statusBadge = '<span class="badge bg-warning text-dark">Bảo Trì</span>';
                }

                container.innerHTML += `
                    <div class="col-md-4 col-lg-3">
                        <div class="card p-3 room-card ${statusClass}">
                            <div class="d-flex justify-content-between align-items-center mb-2">
                                <h4 class="fw-bold mb-0">P.${room.room_number}</h4>
                                ${statusBadge}
                            </div>
                            <div class="small text-muted mb-2">Hạng: <strong>${room.room_type}</strong></div>
                            <div class="fw-bold text-dark mb-3">${Number(room.price_per_night).toLocaleString()} đ/đêm</div>
                            <div class="d-flex gap-1">
                                <button class="btn btn-sm btn-outline-success w-100" onclick="updateRoomStatus(${room.room_number}, 'AVAILABLE')">Trả phòng</button>
                                <button class="btn btn-sm btn-outline-danger w-100" onclick="updateRoomStatus(${room.room_number}, 'OCCUPIED')">Nhận phòng</button>
                            </div>
                        </div>
                    </div>
                `;
            });
        })
        .catch(err => {
            container.innerHTML = `<div class="col-12 text-danger text-center py-4">Lỗi kết nối phòng: ${err}</div>`;
        });
}

// Cập nhật trạng thái phòng (Q7)
function updateRoomStatus(roomNo, newStatus) {
    const hotelId = getSelectedHotel();
    fetch(`/api/query/Q7?hotel_id=${hotelId}&room_number=${roomNo}&status=${newStatus}`)
        .then(r => r.json())
        .then(res => {
            loadRooms();
            loadHotelStats();
        })
        .catch(err => alert("Lỗi khi cập nhật trạng thái phòng: " + err));
}

// ----------------------------------------------------------------------------
// 3. Nghiệp vụ Modal Đặt phòng: Lọc phòng trống (Q2) & Tự tính tiền
// ----------------------------------------------------------------------------
function loadAvailableRoomsDropdown() {
    const hotelId = getSelectedHotel();
    const select = document.getElementById('formRoomNo');
    const submitBtn = document.getElementById('btnSubmitBooking');

    select.innerHTML = '<option value="">-- Đang kiểm tra phòng trống trên Astra DB... --</option>';
    select.disabled = true;

    fetch(`/api/query/Q2?hotel_id=${hotelId}`)
        .then(r => r.json())
        .then(res => {
            select.disabled = false;
            select.innerHTML = '';

            // Lọc ra các phòng có trạng thái AVAILABLE
            const freeRooms = (res.data || []).filter(r => r.status === 'AVAILABLE' || !r.status);

            if (freeRooms.length === 0) {
                select.innerHTML = '<option value="">❌ HẾT SẠCH PHÒNG TRỐNG TẠI CHI NHÁNH NÀY</option>';
                if (submitBtn) submitBtn.disabled = true;
                document.getElementById('formAmount').value = '';
            } else {
                if (submitBtn) submitBtn.disabled = false;
                select.innerHTML = '<option value="">-- Chọn phòng còn trống --</option>';
                freeRooms.forEach(r => {
                    select.innerHTML += `
                        <option value="${r.room_number}" data-price="${r.price_per_night}">
                            Phòng ${r.room_number} - [${r.room_type}] (${Number(r.price_per_night).toLocaleString()} đ/đêm)
                        </option>
                    `;
                });
            }
        })
        .catch(err => {
            select.innerHTML = '<option value="">Lỗi nạp danh sách phòng trống</option>';
        });
}

// Tự động tính tổng tiền khi chọn phòng hoặc đổi ngày
function onRoomSelected() {
    const select = document.getElementById('formRoomNo');
    const selectedOption = select.selectedOptions[0];
    if (!selectedOption || !selectedOption.value) return;

    const price = parseFloat(selectedOption.getAttribute('data-price')) || 0;
    const cinVal = document.getElementById('formCheckIn').value;
    const coutVal = document.getElementById('formCheckOut').value;

    if (!cinVal || !coutVal) return;

    const cin = new Date(cinVal);
    const cout = new Date(coutVal);

    if (cout <= cin) {
        alert("Ngày trả phòng phải sau ngày nhận phòng ít nhất 1 ngày!");
        document.getElementById('formCheckOut').value = '';
        document.getElementById('formAmount').value = '';
        return;
    }

    const diffDays = Math.max(1, Math.round((cout - cin) / (1000 * 60 * 60 * 24)));
    document.getElementById('formAmount').value = price * diffDays;
}

// ----------------------------------------------------------------------------
// 4. Áp dụng Q8: Xử lý Đặt phòng mới (Atomic Logged Batch) - Chống Submit Trùng
// ----------------------------------------------------------------------------
let isBookingProcessing = false;

function handleCreateBooking() {
    if (isBookingProcessing) return;

    const select = document.getElementById('formRoomNo');
    if (!select || !select.value) {
        alert("Vui lòng chọn một phòng còn trống!");
        return;
    }

    const nameInput = document.getElementById('formGuestName').value.trim();
    const phoneInput = document.getElementById('formGuestPhone').value.trim();
    const natIdInput = document.getElementById('formGuestNatId').value.trim();
    const cinInput = document.getElementById('formCheckIn').value;
    const coutInput = document.getElementById('formCheckOut').value;
    const amountInput = document.getElementById('formAmount').value;

    if (!nameInput || !phoneInput || !natIdInput || !cinInput || !coutInput) {
        alert("Vui lòng điền đầy đủ thông tin khách hàng và ngày lưu trú!");
        return;
    }

    const hotelId = getSelectedHotel();
    const hotelName = document.getElementById('currentHotelSelect').selectedOptions[0].text;
    const guestId = "GUEST_" + phoneInput.replace(/[^0-9]/g, '');

    const payload = {
        hotel_id: hotelId,
        hotel_name: hotelName,
        guest_id: guestId,
        guest_name: nameInput,
        phone: phoneInput,
        national_id: natIdInput,
        email: document.getElementById('formGuestEmail').value.trim(),
        room_number: parseInt(select.value),
        total_amount: parseFloat(amountInput) || 0,
        check_in_date: cinInput,
        check_out_date: coutInput
    };

    isBookingProcessing = true;
    const btn = document.getElementById('btnSubmitBooking');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Đang lưu...';
    }

    fetch('/api/query/Q8', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
    .then(r => r.json())
    .then(res => {
        isBookingProcessing = false;
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="bi bi-check2-circle me-1"></i> Xác Nhận Đặt Phòng';
        }

        if (res.status === 'success') {
            const modalEl = document.getElementById('newBookingModal');
            const modalInstance = bootstrap.Modal.getInstance(modalEl);
            if (modalInstance) modalInstance.hide();

            // Xóa sạch các ô nhập
            document.getElementById('formGuestName').value = '';
            document.getElementById('formGuestPhone').value = '';
            document.getElementById('formGuestNatId').value = '';
            document.getElementById('formGuestEmail').value = '';
            document.getElementById('formAmount').value = '';

            // Cập nhật lại lịch và nạp danh sách
            document.getElementById('bkStart').value = payload.check_in_date;
            loadBookings();
            loadRooms();
            loadHotelStats();

            alert(`✅ Đã đặt phòng ${payload.room_number} thành công cho khách [${payload.guest_name}]!`);
        } else {
            alert("Lỗi khi ghi vào Cassandra: " + res.message);
        }
    })
    .catch(err => {
        isBookingProcessing = false;
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="bi bi-check2-circle me-1"></i> Xác Nhận Đặt Phòng';
        }
        alert("Lỗi kết nối máy chủ: " + err);
    });
}

// ----------------------------------------------------------------------------
// 5. Áp dụng Q4 & Q9: Tra cứu lịch đặt phòng & Hủy đơn (kèm giải phóng phòng)
// ----------------------------------------------------------------------------
function loadBookings() {
    const hotelId = getSelectedHotel();
    const start = document.getElementById('bkStart').value;
    const end = document.getElementById('bkEnd').value;
    const tbody = document.getElementById('bookingTableBody');

    tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4"><div class="spinner-border spinner-border-sm text-primary"></div> Đang kiểm tra lịch đặt...</td></tr>';

    fetch(`/api/query/Q4?hotel_id=${hotelId}&start_date=${start}&end_date=${end}`)
        .then(r => r.json())
        .then(res => {
            tbody.innerHTML = '';
            if (!res.data || res.data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4">Không có lượt đặt phòng nào trong khoảng ngày này.</td></tr>';
                return;
            }
            res.data.forEach(b => {
                tbody.innerHTML += `
                    <tr>
                        <td><code class="small text-secondary">${b.booking_id.substring(0, 8)}...</code></td>
                        <td>${b.check_in_date}</td>
                        <td>${b.check_out_date}</td>
                        <td class="fw-bold">${b.guest_name}</td>
                        <td><span class="badge bg-secondary">P.${b.room_number}</span></td>
                        <td class="text-primary fw-bold">${Number(b.total_amount).toLocaleString()} đ</td>
                        <td><span class="badge bg-info text-dark">${b.status}</span></td>
                        <td class="text-end">
                            <button class="btn btn-sm btn-outline-danger" onclick="cancelBooking('${b.booking_id}', '${b.check_in_date}', ${b.room_number}, '${b.guest_id || 'GUEST001'}')">
                                <i class="bi bi-trash"></i> Hủy đơn (Q9)
                            </button>
                        </td>
                    </tr>
                `;
            });
        })
        .catch(err => {
            tbody.innerHTML = `<tr><td colspan="8" class="text-danger text-center py-3">Lỗi tải lịch: ${err}</td></tr>`;
        });
}

// Hàm hủy đơn: Xóa cả 2 bảng đặt phòng và cập nhật phòng sang AVAILABLE
function cancelBooking(bookingId, checkInDate, roomNumber, guestId) {
    if (!confirm(`Bạn có chắc chắn muốn hủy đặt phòng P.${roomNumber}? Phòng sẽ được chuyển lại sang trạng thái TRỐNG.`)) return;

    const hotelId = getSelectedHotel();

    fetch(`/api/query/Q9?hotel_id=${hotelId}&booking_id=${bookingId}&check_in_date=${checkInDate}&room_number=${roomNumber}&guest_id=${guestId}`)
        .then(r => r.json())
        .then(res => {
            loadBookings();
            loadRooms();
            loadHotelStats();
            alert(`✅ Đã hủy đơn đặt phòng! Phòng ${roomNumber} đã chuyển về màu XANH (Trống).`);
        })
        .catch(err => alert("Lỗi khi hủy đơn: " + err));
}

// ----------------------------------------------------------------------------
// 6. Áp dụng Q12, Q3, Q14, Q17: Hồ sơ khách hàng & Thao tác định danh
// ----------------------------------------------------------------------------
function lookupGuest() {
    const guestId = document.getElementById('searchGuestId').value.trim();
    const profileBox = document.getElementById('guestProfileDetails');
    const historyBody = document.getElementById('guestHistoryBody');

    if (!guestId) {
        alert("Vui lòng nhập Guest ID!");
        return;
    }

    profileBox.innerHTML = '<div class="text-muted small">Đang tìm hồ sơ...</div>';
    historyBody.innerHTML = '<tr><td colspan="5" class="text-center py-3"><div class="spinner-border spinner-border-sm text-primary"></div></td></tr>';

    // Q12: Tra cứu hồ sơ khách hàng
    fetch(`/api/query/Q12?guest_id=${guestId}`)
        .then(r => r.json())
        .then(res => {
            if (res.data && res.data.length > 0) {
                const g = res.data[0];
                profileBox.innerHTML = `
                    <h6 class="fw-bold text-primary mb-2">${g.full_name}</h6>
                    <div>Mã định danh: <code>${g.guest_id}</code></div>
                    <div>Điện thoại: <strong>${g.phone}</strong></div>
                    <div>Email: ${g.email || 'Chưa cập nhật'}</div>
                    <div>Số CCCD: <strong>${g.national_id}</strong></div>
                    <div class="mt-3 d-flex gap-2">
                        <button class="btn btn-sm btn-outline-warning" onclick="handleUpdateGuestContact('${g.guest_id}')">
                            <i class="bi bi-pencil"></i> Sửa liên hệ (Q14)
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="handleDeleteGuest('${g.guest_id}')">
                            <i class="bi bi-trash"></i> Xóa hồ sơ (Q17)
                        </button>
                    </div>
                `;
            } else {
                profileBox.innerHTML = `<div class="text-danger small">Không tìm thấy khách có mã: ${guestId}</div>`;
            }
        });

    // Q3: Lịch sử đặt phòng của khách hàng
    fetch(`/api/query/Q3?guest_id=${guestId}`)
        .then(r => r.json())
        .then(res => {
            historyBody.innerHTML = '';
            if (!res.data || res.data.length === 0) {
                historyBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-3">Khách chưa có lịch sử đặt phòng nào.</td></tr>';
                return;
            }
            res.data.forEach(h => {
                historyBody.innerHTML += `
                    <tr>
                        <td>${h.check_in_date}</td>
                        <td>${h.hotel_name}</td>
                        <td>P.${h.room_number}</td>
                        <td>${Number(h.total_amount).toLocaleString()} đ</td>
                        <td><span class="badge bg-success">${h.status}</span></td>
                    </tr>
                `;
            });
        });
}

// Q6: Đăng ký khách hàng mới
function handleCreateGuest() {
    const payload = {
        guest_id: document.getElementById('gGuestId').value.trim(),
        full_name: document.getElementById('gName').value.trim(),
        phone: document.getElementById('gPhone').value.trim(),
        email: document.getElementById('gEmail').value.trim(),
        national_id: document.getElementById('gNatId').value.trim()
    };

    if (!payload.guest_id || !payload.full_name || !payload.phone || !payload.national_id) {
        alert("Vui lòng điền đầy đủ thông tin khách hàng!");
        return;
    }

    fetch('/api/query/Q6', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
    .then(r => r.json())
    .then(res => {
        const modalEl = document.getElementById('newGuestModal');
        const modalInstance = bootstrap.Modal.getInstance(modalEl);
        if (modalInstance) modalInstance.hide();

        document.getElementById('searchGuestId').value = payload.guest_id;
        lookupGuest();
        alert(res.data[0].message);
    })
    .catch(err => alert("Lỗi khi thêm khách: " + err));
}

// Q14: Cập nhật thông tin liên hệ của khách hàng
function handleUpdateGuestContact(guestId) {
    const newPhone = prompt("Nhập số điện thoại mới:", "0911223344");
    if (!newPhone) return;
    const newEmail = prompt("Nhập email mới:", "new_email@gmail.com");
    if (!newEmail) return;

    fetch('/api/query/Q14', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guest_id: guestId, phone: newPhone, email: newEmail })
    })
    .then(r => r.json())
    .then(res => {
        lookupGuest();
        alert(res.data[0].message);
    })
    .catch(err => alert("Lỗi cập nhật liên hệ: " + err));
}

// Q17: Xóa vĩnh viễn hồ sơ khách
function handleDeleteGuest(guestId) {
    if (!confirm(`Cảnh báo: Bạn có chắc chắn muốn xóa hồ sơ khách ${guestId} khỏi cụm dữ liệu?`)) return;

    fetch(`/api/query/Q17?guest_id=${guestId}`)
        .then(r => r.json())
        .then(res => {
            document.getElementById('guestProfileDetails').innerHTML = `<div class="text-success small">${res.data[0].message}</div>`;
            document.getElementById('guestHistoryBody').innerHTML = '<tr><td colspan="5" class="text-center text-muted py-3">Hồ sơ đã bị xóa.</td></tr>';
            alert(res.data[0].message);
        })
        .catch(err => alert("Lỗi xóa hồ sơ: " + err));
}

// ----------------------------------------------------------------------------
// 7. Áp dụng Q11 & Q15: Thu ngân & Quyết toán hóa đơn
// ----------------------------------------------------------------------------
function loadUnpaidInvoices() {
    const tbody = document.getElementById('invoiceTableBody');
    tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4"><div class="spinner-border spinner-border-sm text-danger"></div> Đang lọc hóa đơn chưa thanh toán từ Astra DB...</td></tr>';

    fetch('/api/query/Q11')
        .then(r => r.json())
        .then(res => {
            tbody.innerHTML = '';
            if (!res.data || res.data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="8" class="text-center text-success py-4 fw-bold"><i class="bi bi-check-circle-fill me-1"></i> Tất cả hóa đơn đều đã được thanh toán (PAID)!</td></tr>';
                return;
            }
            res.data.forEach((iv, index) => {
                const invId = iv.invoice_id || '';
                const bId = iv.booking_id || '';
                const displayInv = invId.length > 8 ? invId.substring(0, 8) + '...' : (invId || 'INV-AUTO');
                const displayBk = bId.length > 8 ? bId.substring(0, 8) + '...' : (bId || 'BOOKING-AUTO');

                tbody.innerHTML += `
                    <tr id="row-inv-${index}">
                        <td><code class="small text-secondary">${displayInv}</code></td>
                        <td><code>${displayBk}</code></td>
                        <td><strong>${iv.guest_id || 'GUEST001'}</strong></td>
                        <td>-</td>
                        <td>-</td>
                        <td class="text-danger fw-bold">${Number(iv.total_amount || 0).toLocaleString()} đ</td>
                        <td><span class="badge bg-danger" id="badge-${index}">${iv.payment_status}</span></td>
                        <td class="text-end">
                            <button class="btn btn-sm btn-outline-success" id="btn-pay-${index}" onclick="handlePayInvoice('${bId}', '${invId}', ${index})">
                                <i class="bi bi-cash-coin me-1"></i> Thu tiền (Q15)
                            </button>
                        </td>
                    </tr>
                `;
            });
        })
        .catch(err => {
            tbody.innerHTML = `<tr><td colspan="8" class="text-danger text-center py-3">Lỗi tải hóa đơn: ${err}</td></tr>`;
        });
}

// Q15: Quyết toán hóa đơn sang PAID
function handlePayInvoice(bookingId, invoiceId, rowIndex) {
    if (!confirm("Xác nhận đã thu đủ tiền và chuyển trạng thái hóa đơn sang PAID?")) return;

    const btn = document.getElementById(`btn-pay-${rowIndex}`);
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Đang xử lý...';
    }

    fetch(`/api/query/Q15?booking_id=${bookingId}&invoice_id=${invoiceId}`)
        .then(r => r.json())
        .then(res => {
            if (res.status === 'success') {
                const badge = document.getElementById(`badge-${rowIndex}`);
                if (badge) {
                    badge.className = 'badge bg-success';
                    badge.innerText = 'PAID';
                }
                if (btn) {
                    btn.className = 'btn btn-sm btn-secondary disabled';
                    btn.innerHTML = '<i class="bi bi-check2"></i> Đã thanh toán';
                }
                alert("✅ " + res.data[0].message);
            } else {
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = '<i class="bi bi-cash-coin me-1"></i> Thu tiền (Q15)';
                }
                alert("Lỗi khi quyết toán: " + res.message);
            }
        })
        .catch(err => {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="bi bi-cash-coin me-1"></i> Thu tiền (Q15)';
            }
            alert("Lỗi kết nối máy chủ: " + err);
        });
}
// ----------------------------------------------------------------------------
// 8. Áp dụng Q10 & Q18: Báo cáo & Thống kê phòng
// ----------------------------------------------------------------------------
function loadHotelStats() {
    const hotelId = getSelectedHotel();
    const box = document.getElementById('statsContainer');

    // Q10: Thống kê phòng và đơn giá
    fetch(`/api/query/Q10?hotel_id=${hotelId}`)
        .then(r => r.json())
        .then(res => {
            if (res.data && res.data.length > 0) {
                const s = res.data[0];
                box.innerHTML = `
                    <div class="col-md-4">
                        <div class="card border-0 shadow-sm p-3">
                            <span class="text-muted small">Tổng số phòng</span>
                            <h2 class="fw-bold text-primary my-1">${s.total_rooms}</h2>
                            <small class="text-muted">Đang quản lý trên cụm</small>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="card border-0 shadow-sm p-3">
                            <span class="text-muted small">Giá phòng thấp nhất</span>
                            <h2 class="fw-bold text-success my-1">${Number(s.min_price).toLocaleString()} đ</h2>
                            <small class="text-muted">Hạng Standard</small>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="card border-0 shadow-sm p-3">
                            <span class="text-muted small">Giá phòng cao nhất</span>
                            <h2 class="fw-bold text-warning my-1">${Number(s.max_price).toLocaleString()} đ</h2>
                            <small class="text-muted">Hạng Suite</small>
                        </div>
                    </div>
                `;

                // Q18: Thống kê số lượt đặt phòng trong năm 2026
                fetch(`/api/query/Q18?hotel_id=${hotelId}&start_date=2026-01-01&end_date=2026-12-31`)
                    .then(r => r.json())
                    .then(resQ18 => {
                        if (resQ18.data && resQ18.data.length > 0) {
                            const totalBk = resQ18.data[0].total_bookings;
                            const div = document.createElement('div');
                            div.className = 'col-md-12 mt-2';
                            div.innerHTML = `
                                <div class="card border-0 shadow-sm p-3 bg-light border-start border-4 border-info">
                                    <div class="d-flex justify-content-between align-items-center">
                                        <div>
                                            <span class="text-muted small">Lượt đặt phòng năm 2026 (Q18 - COUNT):</span>
                                            <h4 class="fw-bold text-dark my-1">${totalBk} Lượt đặt thành công</h4>
                                        </div>
                                        <i class="bi bi-calendar2-range fs-1 text-info"></i>
                                    </div>
                                </div>
                            `;
                            box.appendChild(div);
                        }
                    })
                    .catch(e => console.error("Lỗi Q18:", e));
            }
        })
        .catch(err => console.error("Lỗi tải thống kê:", err));
}

// ----------------------------------------------------------------------------
// 9. Nghiệp vụ mở rộng: Q13 (Đổi giá phòng) & Q16 (Thêm chi nhánh)
// ----------------------------------------------------------------------------

// Q13: Đổi giá & hạng phòng
function handleUpdateRoomPrice() {
    const payload = {
        hotel_id: getSelectedHotel(),
        room_number: parseInt(document.getElementById('mEditRoomNo').value),
        room_type: document.getElementById('mEditRoomType').value.trim(),
        price_per_night: parseFloat(document.getElementById('mEditRoomPrice').value)
    };

    fetch('/api/query/Q13', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
    .then(r => r.json())
    .then(res => {
        const modalEl = document.getElementById('editRoomModal');
        const modalInstance = bootstrap.Modal.getInstance(modalEl);
        if (modalInstance) modalInstance.hide();

        loadRooms();
        loadHotelStats();
        alert(res.data[0].message);
    })
    .catch(err => alert("Lỗi cập nhật giá phòng: " + err));
}

// Q16: Khai trương khách sạn mới
function handleCreateHotel() {
    const payload = {
        hotel_id: document.getElementById('hHotelId').value.trim(),
        hotel_name: document.getElementById('hName').value.trim(),
        city: document.getElementById('hCity').value.trim(),
        address: document.getElementById('hAddress').value.trim(),
        star_rating: parseInt(document.getElementById('hStars').value),
        phone: document.getElementById('hPhone').value.trim()
    };

    fetch('/api/query/Q16', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
    .then(r => r.json())
    .then(res => {
        const modalEl = document.getElementById('newHotelModal');
        const modalInstance = bootstrap.Modal.getInstance(modalEl);
        if (modalInstance) modalInstance.hide();

        // Bổ sung chi nhánh mới vào danh sách lựa chọn trên Navbar
        const select = document.getElementById('currentHotelSelect');
        const opt = document.createElement('option');
        opt.value = payload.hotel_id;
        opt.text = `${payload.hotel_id} - ${payload.hotel_name}`;
        select.add(opt);
        select.value = payload.hotel_id;

        reloadAllData();
        alert(res.data[0].message);
    })
    .catch(err => alert("Lỗi khi thêm khách sạn: " + err));
}