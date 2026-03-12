// // home.js — navigation for the welcome page

// document.getElementById('btnCreate').addEventListener('click', function () {
//     // Add a quick scale-out animation before navigating
//     this.style.transform = 'scale(0.95)';
//     setTimeout(() => {
//       window.location.href = 'homecreate.html';
//     }, 150);
//   });
  
//   document.getElementById('btnLogin').addEventListener('click', function () {
//     this.style.transform = 'scale(0.95)';
//     setTimeout(() => {
//       window.location.href = 'homelogin.html';
//     }, 150);
//   });

  // home.js — welcome page + show logged-in user info

// ── Fetch current user from session ─────────────────────────
async function loadUserProfile() {
  try {
    const res = await fetch('/api/auth/me');

    // ถ้ายังไม่ได้ login → redirect ไปหน้า login
    if (res.status === 401) {
      window.location.href = '/frontend/html/homelogin.html';
      return;
    }

    const data = await res.json();

    if (data.success && data.user) {
      renderUserUI(data.user);
    }
  } catch (err) {
    console.error('Failed to load user profile:', err);
  }
}

// ── Render user info ─────────────────────────────────────────
function renderUserUI(user) {
  // ชื่อ
  const nameEl = document.getElementById('userName');
  if (nameEl) nameEl.textContent = user.first_name
    ? `${user.first_name} ${user.last_name || ''}`.trim()
    : user.user_name;

  // อีเมล
  const emailEl = document.getElementById('userEmail');
  if (emailEl) emailEl.textContent = user.university_email;

  // รูปโปรไฟล์
  const imgEl = document.getElementById('userAvatar');
  if (imgEl && user.profile_img) {
    imgEl.src = user.profile_img;
    imgEl.alt = user.first_name || user.user_name;
  }

  // Role badge (optional)
  const roleEl = document.getElementById('userRole');
  if (roleEl) roleEl.textContent = user.role || 'user';
}

// ── Navigation buttons (ถ้ายังมีอยู่ใน home.html) ────────────
const btnCreate = document.getElementById('btnCreate');
const btnLogin  = document.getElementById('btnLogin');
const btnLogout = document.getElementById('btnLogout');

if (btnCreate) {
  btnCreate.addEventListener('click', function () {
    this.style.transform = 'scale(0.95)';
    setTimeout(() => { window.location.href = '/html/homecreate.html'; }, 150);
  });
}

if (btnLogin) {
  btnLogin.addEventListener('click', function () {
    this.style.transform = 'scale(0.95)';
    setTimeout(() => { window.location.href = '/frontend/html/homelogin.html'; }, 150);
  });
}

// ── Logout button ────────────────────────────────────────────
if (btnLogout) {
  btnLogout.addEventListener('click', () => {
    window.location.href = '/auth/logout';
  });
}

// ── Run on page load ─────────────────────────────────────────
loadUserProfile();