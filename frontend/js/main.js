// script home
(function() {
    const menuLinks = document.querySelectorAll('.mainmenu .menu-item a');

    const currentPath = window.location.pathname;
    let currentPage = currentPath.substring(currentPath.lastIndexOf('/') + 1);

    // จัดการกรณีที่อยู่หน้าหลักและ URL อาจเป็นแค่ /
    if (currentPage === '' || currentPage.toUpperCase() === 'INDEX.HTML') {
        currentPage = 'home.html';
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


// === 2. หน้า Home: เลือก Chip ได้อันเดียว (เช็คก่อนรัน) ===
const homeChips = document.querySelectorAll('.chip');
if (homeChips.length > 0) {
    homeChips.forEach(chip => {
        chip.addEventListener('click', function() {
            homeChips.forEach(c => c.classList.remove('active')); // ลบอันอื่นออก (Single Select)
            this.classList.add('active');
        });
    });
}

// === 3. หน้า Create: เลือกได้หลาย Category (Multi-select) ===
const categoryWrapper = document.querySelector('.category-chips-wrapper');
if (categoryWrapper) {
    const tags = categoryWrapper.querySelectorAll('.tag-chip');
    tags.forEach(tag => {
        tag.addEventListener('click', function(e) {
            e.preventDefault();
            // toggle คือการสลับสถานะ (เลือก/ไม่เลือก) โดยไม่ยุ่งกับปุ่มอื่น
            this.classList.toggle('active');

            const selected = Array.from(categoryWrapper.querySelectorAll('.tag-chip.active'))
                .map(el => el.innerText);
            console.log("หมวดหมู่ที่เลือกตอนนี้:", selected);
        });
    });
}

// === 4. หน้า Create: อัปโหลดรูปภาพ ===
const coverInput = document.getElementById('cover-photo');
const uploadBox = document.getElementById('drop-area');
if (coverInput && uploadBox) {
    coverInput.addEventListener('change', function(event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                uploadBox.innerHTML = `<img src="${e.target.result}" class="preview-img">`;
            };
            reader.readAsDataURL(file);
        }
    });
}
const groupLinkInput = document.getElementById('group_link');
const linkBox = document.getElementById('link-box');
const linkError = document.getElementById('link-error');

groupLinkInput.addEventListener('input', function() {
    const val = this.value.trim();

    // Pattern สำหรับเช็คว่าเป็นลิงก์ (ขึ้นต้นด้วย http, https หรือมีจุดแบบโดเมน)
    const urlPattern = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;

    if (val === "") {
        // ถ้าว่างเปล่า (เพราะเป็น Optional) ให้กลับเป็นสีปกติ
        linkBox.style.borderColor = "#F28B95";
        linkError.style.color = "#F28B95";
        linkError.textContent = "* ลิงก์นี้จะปรากฏให้เห็นเฉพาะคนที่ได้รับอนุมัติให้เข้าร่วมทริปแล้วเท่านั้น";
    } else if (!urlPattern.test(val)) {
        // ถ้าพิมพ์แล้วไม่ใช่ลิงก์ ให้แสดงสีแดงเตือน
        linkBox.style.borderColor = "#ff4d4d";
        linkError.style.color = "#ff4d4d";
        linkError.textContent = "⚠️ กรุณาใส่ลิงก์ที่ถูกต้อง (เช่น https://line.me/...)";
    } else {
        // ถ้าถูกต้อง ให้เป็นสีชมพู/เขียวปกติ
        linkBox.style.borderColor = "#2ecc71"; // หรือใช้สีชมพู #F28B95 ตามเดิม
        linkError.style.color = "#2ecc71";
        linkError.textContent = "link Verified";
    }
});