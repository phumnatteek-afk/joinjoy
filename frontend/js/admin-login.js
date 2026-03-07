document.getElementById('login-btn').addEventListener('click', async () => {
    const gmail = document.getElementById('admin-gmail').value.trim();
    const password = document.getElementById('admin-password').value.trim();

    try {
        const response = await fetch('http://localhost:3000/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ gmail, password })
        });

        const data = await response.json();

        if (response.ok) {
            alert('ยินดีต้อนรับแอดมิน!');
            localStorage.setItem('adminToken', data.token);
            // เก็บ ID ของแอดมินที่ส่งมาจาก Backend)
            localStorage.setItem('adminId', data.admin.user_id);

            window.location.href = 'admin-dashboard.html';
        } else {
            alert(data.message || 'อีเมลหรือรหัสผ่านไม่ถูกต้อง');
        }
    } catch (error) {
        console.error('Login Error:', error);
        alert('ระบบมีปัญหา กรุณาลองใหม่ภายหลัง');
    }
});

const togglePassword = document.getElementById('toggle-password');
const passwordInput = document.getElementById('admin-password');
const eyeIconInner = document.getElementById('eye-icon-inner');

togglePassword.addEventListener('click', () => {
    // สลับ Type ของ Input
    const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
    passwordInput.setAttribute('type', type);

    // สลับไอคอนระหว่าง eye-open และ eye-close
    if (type === 'password') {
        eyeIconInner.setAttribute('icon', 'el:eye-close');
    } else {
        eyeIconInner.setAttribute('icon', 'el:eye-open');
    }
});