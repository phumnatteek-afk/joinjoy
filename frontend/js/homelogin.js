// homelogin.js

// ── Password toggle ──
const eyeBtn    = document.getElementById('eyeBtn');
const passInput = document.getElementById('password');

eyeBtn.addEventListener('click', () => {
  const isHidden = passInput.type === 'password';
  passInput.type = isHidden ? 'text' : 'password';
  document.getElementById('eyeIcon').setAttribute('stroke', isHidden ? '#F28695' : '#bbb');
});

// ── Google button loading state ──
document.getElementById('googleBtn').addEventListener('click', function () {
  this.style.opacity = '0.6';
  this.style.pointerEvents = 'none';
});

// ── Show OAuth error messages ──
const errors = {
  invalid_email:   'Only @su.ac.th university emails are allowed.',
  banned:          'Your account has been suspended.',
  auth_failed:     'Sign-in failed. Please try again.',
  access_denied:   'Google sign-in was cancelled.',
  session_expired: 'Your session expired. Please sign in again.',
};

const params = new URLSearchParams(window.location.search);
const errKey = params.get('error');
const errEl  = document.getElementById('errorMsg');

if (errKey && errors[errKey]) {
  errEl.textContent = errors[errKey];
  errEl.classList.add('show');
}

// ── Log in button (frontend validation) ──
document.getElementById('btnLogin').addEventListener('click', () => {
  const email = document.getElementById('email').value.trim();
  const pass  = document.getElementById('password').value;

  if (!email || !pass) {
    errEl.textContent = 'Please enter your email and password.';
    errEl.classList.add('show');
    return;
  }

  errEl.classList.remove('show');

  // TODO: call your backend login API here
  // fetch('/api/login', { method:'POST', body: JSON.stringify({ email, pass }) })
  console.log('Login:', { email });
});