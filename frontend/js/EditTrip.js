// js/EditTrip.js

const BASE_URL = 'http://localhost:3000/api';

// 1. ดึง trip_id จาก URL (?id=18)
const urlParams = new URLSearchParams(window.location.search);
const tripId = urlParams.get('id');

// เช็คว่ามี ID ไหม ถ้าไม่มีให้เด้งกลับ
if (!tripId) {
    alert("Trip ID not found!");
    window.location.href = "Profile.html";
}

// ── ฟังก์ชันดึงข้อมูลเก่ามาใส่ในฟอร์ม ──────────────────────────
async function fetchTripData() {
    try {
        const res = await fetch(`${BASE_URL}/trips/${tripId}`);
        const trip = await res.json();

        if (!res.ok) throw new Error(trip.error || 'Failed to fetch data');

        // ใส่ค่าใน Input ต่างๆ
        document.getElementById('trip_name').value = trip.trip_name;
        document.getElementById('location_name').value = trip.location_name;
        document.getElementById('max_member').value = trip.max_member;
        document.getElementById('budget_range').value = (trip.budget_min && trip.budget_max) 
            ? `${trip.budget_min}-${trip.budget_max}` : (trip.budget_min || '');
        document.getElementById('budget_type').value = trip.budget_type || "";
        document.getElementById('description').value = trip.description || '';
        document.getElementById('trip_detail').value = trip.trip_detail || '';

        // จัดการวันที่สำหรับ datetime-local (ต้องเป็น YYYY-MM-DDTHH:mm)
        if (trip.start_time) document.getElementById('start_time').value = trip.start_time.substring(0, 16);
        if (trip.end_time) document.getElementById('end_time').value = trip.end_time.substring(0, 16);
        if (trip.limit_date_accept) document.getElementById('limit_date_accept').value = trip.limit_date_accept.substring(0, 16);

        // แสดงรูปตัวอย่างเก่า
        if (trip.cover_image) {
            const previewArea = document.getElementById('preview-content');
            previewArea.innerHTML = `<img src="/${trip.cover_image}" style="width:100%; height:100%; object-fit:cover; border-radius:15px;">`;
        }

        // ติ๊ก Category เดิม (อิงจาก main.js ที่คุณมี)
        if (trip.category) {
            const savedCats = trip.category.split(',');
            document.querySelectorAll('.tag-chip').forEach(chip => {
                if (savedCats.includes(chip.dataset.value)) {
                    chip.classList.add('active');
                }
            });
        }

    } catch (err) {
        console.error(err);
        alert("Error loading trip data!");
    }
}

// ── ฟังก์ชันส่งข้อมูลที่แก้ไขไป Backend ────────────────────────
async function handleUpdateTrip() {
    const formData = new FormData();
    
    // ดึงค่าจากฟอร์ม (เหมือนหน้า Create)
    formData.append('trip_name', document.getElementById('trip_name').value.trim());
    formData.append('location_name', document.getElementById('location_name').value.trim());
    formData.append('budget_type', document.getElementById('budget_type').value);
    formData.append('max_member', document.getElementById('max_member').value);
    formData.append('start_time', document.getElementById('start_time').value);
    formData.append('end_time', document.getElementById('end_time').value);
    formData.append('limit_date_accept', document.getElementById('limit_date_accept').value);
    formData.append('description', document.getElementById('description').value);
    formData.append('trip_detail', document.getElementById('trip_detail').value);

    // Categories
    const actives = document.querySelectorAll('.tag-chip.active');
    const categories = Array.from(actives).map(el => el.dataset.value).join(',');
    formData.append('category', categories);

    // Budget Min/Max
    const budgetRaw = document.getElementById('budget_range').value;
    const parts = budgetRaw.split('-');
    if(parts.length === 2) {
        formData.append('budget_min', parts[0]);
        formData.append('budget_max', parts[1]);
    }

    // รูปใหม่ (ถ้ามี)
    const fileInput = document.getElementById('cover-photo');
    if (fileInput.files[0]) {
        formData.append('cover_image', fileInput.files[0]);
    }

    try {
        const res = await fetch(`${BASE_URL}/trips/${tripId}`, {
            method: 'PUT',
            body: formData,
            credentials: 'include'
        });

        const data = await res.json();
        if (data.success) {
            alert("✅ Update Success!");
            
            // 🚩 แก้ไขจากเปลี่ยนหน้า เป็นการบอกหน้าแม่ให้ปิด Modal
            if (window.parent && window.parent.closeEditTripModal) {
                window.parent.closeEditTripModal();
            } else {
                window.location.href = "Profile.html";
            }
        } else {
            alert("❌ Update Failed: " + data.error);
        }
    } catch (err) {
        console.error(err);
        alert("Network Error!");
    }
}

// ── เริ่มทำงานเมื่อโหลดหน้า ──
document.addEventListener('DOMContentLoaded', () => {
    fetchTripData();

    // ผูก Event กับปุ่ม Save
    const saveBtn = document.getElementById('btn-create-trip');
    if (saveBtn) {
        saveBtn.textContent = "Save Changes"; // เปลี่ยนชื่อปุ่ม
        saveBtn.addEventListener('click', handleUpdateTrip);
    }
    
    const topSaveBtn = document.getElementById('btn-save');
    if (topSaveBtn) topSaveBtn.addEventListener('click', handleUpdateTrip);
});