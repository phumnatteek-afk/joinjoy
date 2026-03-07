let selectedUserId = null;

document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('adminToken');

    if (!token) {
        alert('กรุณาเข้าสู่ระบบก่อน');
        window.location.href = 'admin-login.html';
        return;
    }

    console.log("Admin User Management Loaded");
    loadUsers();

    const logoutBtn = document.querySelector('.logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const isConfirmed = confirm("คุณแน่ใจหรือไม่ว่าต้องการออกจากระบบ?");
            if (isConfirmed) {
                localStorage.removeItem('adminToken');
                alert('ออกจากระบบสำเร็จ');
                window.location.href = 'admin-login.html';
            }
        });
    }

    const searchInput = document.getElementById('user-search');
    const statFilt = document.getElementById('status-filter');

    if (searchInput) searchInput.addEventListener('input', loadUsers);
    if (statFilt) statFilt.addEventListener('change', loadUsers);
});

async function loadUsers() {
    const search = document.getElementById('user-search')?.value || '';
    const status = document.getElementById('status-filter')?.value || '';

    try {
        const url = `http://localhost:3000/api/admin/users-list?search=${search}&status=${status}`;
        const res = await fetch(url);
        const users = await res.json();

        const tbody = document.getElementById('user-list');
        const totalCount = document.getElementById('total-users-count');

        if (!tbody) return;

        tbody.innerHTML = '';
        totalCount.innerText = users.length;

        if (users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">ไม่พบข้อมูลผู้ใช้</td></tr>';
            return;
        }

        users.forEach(user => {
            const statusClass = user.status === 'active' ? 'status-active' : 'status-banned';

            tbody.innerHTML += `
                <tr>
                    <td>${user.user_id}</td>
                    <td>${user.user_name}</td>
                    <td>${user.university_email}</td>
                    <td>${user.user_password}</td>
                    <td><span class="badge-role">${user.role}</span></td>
                    <td>
                        <select class="status-badge ${statusClass}" onchange="handleStatusChange(${user.user_id}, this.value)">
                            <option value="active" ${user.status === 'active' ? 'selected' : ''}>active</option>
                            <option value="banned" ${user.status === 'banned' ? 'selected' : ''}>banned</option>
                        </select>
                    </td>
                    <td class="reason-text">${user.reason || '-'}</td>
                </tr>
            `;
        });
    } catch (error) {
        console.error("Error loading users:", error);
    }
}

// ฟังก์ชันเมื่อมีการเปลี่ยนสถานะใน Dropdown ของตาราง
function handleStatusChange(userId, newStatus) {
    if (newStatus === 'banned') {
        openBanModal(userId);
    } else {
        updateUserStatus(userId, 'active', '');
    }
}

function openBanModal(userId) {
    selectedUserId = userId;
    document.getElementById('ban-modal').style.display = 'block';
}

function closeModal() {
    document.getElementById('ban-modal').style.display = 'none';
    loadUsers();
}

// ฟังก์ชันส่งข้อมูลการแบน
document.getElementById('submit-ban').addEventListener('click', async () => {
    const reason = document.getElementById('ban-reason-input').value;

    if (!reason.trim()) {
        alert('กรุณาใส่เหตุผลการแบนด้วยนะคะ');
        return;
    }

    const currentAdminId = localStorage.getItem('adminId') || 1;

    try {
        const res = await fetch('http://localhost:3000/api/admin/ban-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: selectedUserId,
                admin_id: currentAdminId,
                reason: reason
            })
        });

        if (res.ok) {
            alert('แบนผู้ใช้เรียบร้อยแล้ว');
            document.getElementById('ban-reason-input').value = "";
            closeModal();
            loadUsers();
        } else {
            alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
        }
    } catch (error) {
        console.error("Fetch Error:", error);
    }
});

async function updateUserStatus(userId, status, reason) {
    const currentAdminId = localStorage.getItem('adminId') || 1;

    try {
        const res = await fetch('http://localhost:3000/api/admin/ban-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: userId,
                admin_id: currentAdminId,
                reason: reason
            })
        });

        if (res.ok) {
            alert(status === 'banned' ? 'แบนผู้ใช้สำเร็จ' : 'ปลดแบนสำเร็จ');
            loadUsers();
        }
    } catch (error) {
        console.error("Update Status Error:", error);
    }
}