// homelogin.js

// ── Password toggle ──────────────────────────────────────────
const eyeBtn    = document.getElementById('eyeBtn');
const passInput = document.getElementById('password');

eyeBtn.addEventListener('click', () => {
  const isHidden = passInput.type === 'password';
  passInput.type = isHidden ? 'text' : 'password';
  document.getElementById('eyeIcon').setAttribute('stroke', isHidden ? '#F28695' : '#bbb');
});

// ── Error helper ─────────────────────────────────────────────
const errEl = document.getElementById('errorMsg');

function showError(msg) {
  errEl.textContent = msg;
  errEl.classList.add('show');
}

// ── Show OAuth error from redirect ───────────────────────────
const oauthErrors = {
  invalid_email:   'Only @silpakorn.edu university emails are allowed.',
  banned:          'Your account has been suspended.',
  auth_failed:     'Sign-in failed. Please try again.',
  access_denied:   'Google sign-in was cancelled.',
  session_expired: 'Your session expired. Please sign in again.',
};

const params = new URLSearchParams(window.location.search);
const errKey = params.get('error');
if (errKey && oauthErrors[errKey]) showError(oauthErrors[errKey]);

// ── Google button loading state ───────────────────────────────
document.getElementById('googleBtn').addEventListener('click', function () {
  this.style.opacity = '0.6';
  this.style.pointerEvents = 'none';
});

// ── Log in — POST to API ──────────────────────────────────────
document.getElementById('btnLogin').addEventListener('click', async () => {
  const email    = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const btn      = document.getElementById('btnLogin');

  if (!email || !password) {
    return showError('Please enter your email and password.');
  }

  // Loading state
  btn.textContent = 'Logging in…';
  btn.disabled = true;
  errEl.classList.remove('show');

  try {
    const res  = await fetch('/api/auth/login', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (data.success) {
      // Redirect to the page the server tells us
      window.location.href = data.redirect || '/html/home.html';
    } else {
      showError(data.message || 'Login failed.');
    }
  } catch (err) {
    showError('Network error. Please try again.');
  } finally {
    btn.textContent = 'Log in';
    btn.disabled = false;
  }
});