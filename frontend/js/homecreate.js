
// homecreate.js

// ── Password toggle ──────────────────────────────────────────
const eyeBtn    = document.getElementById('eyeBtn');
const passInput = document.getElementById('password');

eyeBtn.addEventListener('click', () => {
  const isHidden = passInput.type === 'password';
  passInput.type = isHidden ? 'text' : 'password';
  document.getElementById('eyeIcon').setAttribute('stroke', isHidden ? '#F28695' : '#bbb');
});

// ── Show error / success helpers ────────────────────────────
const errEl = document.getElementById('errorMsg');

function showError(msg) {
  errEl.textContent = msg;
  errEl.style.background = '#fff0f1';
  errEl.style.borderColor = '#f8c0c4';
  errEl.style.color = '#c0392b';
  errEl.classList.add('show');
}

function showSuccess(msg) {
  errEl.textContent = msg;
  errEl.style.background = '#f0fff4';
  errEl.style.borderColor = '#a8e6b0';
  errEl.style.color = '#1a7a35';
  errEl.classList.add('show');
}

// ── Show OAuth error from redirect ──────────────────────────
const oauthErrors = {
  invalid_email:   'Only @silpakorn.edu university emails are allowed.',
  banned:          'Your account has been suspended.',
  auth_failed:     'Sign-in failed. Please try again.',
  access_denied:   'Google sign-in was cancelled.',
};

const params = new URLSearchParams(window.location.search);
const errKey = params.get('error');
if (errKey && oauthErrors[errKey]) showError(oauthErrors[errKey]);

// ── Google button loading state ──────────────────────────────
document.getElementById('googleBtn').addEventListener('click', function () {
  this.style.opacity = '0.6';
  this.style.pointerEvents = 'none';
});

// ── Get Started — register via API ──────────────────────────
document.getElementById('btnGetStarted').addEventListener('click', async () => {
  const fullname = document.getElementById('fullname').value.trim();
  const email    = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const btn      = document.getElementById('btnGetStarted');

  // Client-side checks
  if (!fullname || !email || !password) {
    return showError('Please fill in all fields.');
  }
  if (!email.endsWith('@silpakorn.edu')) {
    return showError('Only @silpakorn.edu university emails are accepted.');
  }
  if (password.length < 6) {
    return showError('Password must be at least 6 characters.');
  }

  // Loading state
  btn.textContent = 'Creating account…';
  btn.disabled = true;
  errEl.classList.remove('show');

  try {
    // ✅ แก้ไข: URL ที่ถูกต้อง (เพิ่ม / ที่หายไป) + ใช้ relative path
    const res = await fetch('/api/auth/register', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ fullname, email, password }),
    });

    const data = await res.json();

    if (data.success) {
      showSuccess('Account created! Signing you in…');

      // ✅ Auto-login หลัง register สำเร็จ
      const loginRes = await fetch('/api/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password }),
      });

      const loginData = await loginRes.json();

      setTimeout(() => {
        if (loginData.success) {
          // ✅ เข้า home.html โดยตรง (root level)
          window.location.href = loginData.redirect || '/frontend/html/homepage.html';
        } else {
          // ถ้า auto-login ไม่ได้ ให้ไปหน้า login แทน
          window.location.href = '/frontend/html/homelogin.html';
        }
      }, 1000);
    } else {
      showError(data.message || 'Something went wrong.');
    }
  } catch (err) {
    showError('Network error. Please try again.');
  } finally {
    btn.textContent = 'Get Started';
    btn.disabled = false;
  }
});