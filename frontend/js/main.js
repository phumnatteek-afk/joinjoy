// script home
        (function () {
        const menuLinks = document.querySelectorAll('.mainmenu .menu-item a');
        
        // ดึงชื่อไฟล์ของหน้าปัจจุบัน (เช่น index.html, podcast.html)
        const currentPath = window.location.pathname;
        let currentPage = currentPath.substring(currentPath.lastIndexOf('/') + 1); 

        // จัดการกรณีที่อยู่หน้าหลักและ URL อาจเป็นแค่ /
        if (currentPage === '' || currentPage.toUpperCase() === 'INDEX.HTML') {
             currentPage = 'index.html';
        }
        
        // ตรวจสอบและใส่คลาส 'active'
        menuLinks.forEach(link => {
            let linkTarget = link.getAttribute('href');

            if (linkTarget && linkTarget !== '#') {
                // ตรวจสอบว่า href ของเมนูตรงกับชื่อไฟล์ปัจจุบันหรือไม่
                if (linkTarget.toUpperCase() === currentPage.toUpperCase()) {
                    link.classList.add('active'); // ใส่คลาส active
                }
            } 
        });
    })();
  // 1. ข้อมูลสมมติ (ในอนาคตส่วนนี้จะถูกแทนที่ด้วยการเรียก API)
const trips = [
    "1-day Trip", "Chill & Relax", "Travel Group", "Beach Trips", 
    "Café Hopping", "Nightlife / Party", "Short Getaway", "Food", 
    "Events", "Concert", "Healing", "Backpacking", "Camping"
];

const searchInput = document.getElementById('searchInput');
const resultsDiv = document.getElementById('results');
let debounceTimer;

// 2. ฟังก์ชันหลักเมื่อมีการพิมพ์
searchInput.addEventListener('input', (e) => {
    const value = e.target.value.trim().toLowerCase();
    
    // ล้างผลลัพธ์เก่าทิ้งถ้าช่องว่าง
    if (value.length === 0) {
        resultsDiv.innerHTML = '';
        return;
    }

    // จำลองการรอโหลด (เหมือนรอ Backend) 
    // หยุดพิมพ์ 300ms ค่อยเริ่มหา
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        const filtered = trips.filter(item => item.toLowerCase().includes(value));
        renderResults(filtered);
    }, 300);
});

// 3. ฟังก์ชันสำหรับสร้าง HTML แสดงผล
function renderResults(data) {
    resultsDiv.innerHTML = ''; // ล้างค่าเก่า

    if (data.length === 0) {
        resultsDiv.innerHTML = '<p class="no-result">No results found</p>';
        return;
    }

    // สร้างรายการผลลัพธ์
    data.forEach(item => {
        const div = document.createElement('div');
        div.className = 'result-item';
        div.innerHTML = `
            <div class="result-content">
                <span class="icon">📍</span>
                <span class="text">${item}</span>
            </div>
            <span class="arrow">›</span>
        `;
        
        // ทำให้คลิกได้ (เช่น ไปหน้าทริปนั้นๆ)
        div.onclick = () => alert('You selected: ' + item);
        
        resultsDiv.appendChild(div);
    });
}