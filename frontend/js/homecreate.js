// homecreate.js

// ── Password toggle ──
const eyeBtn  = document.getElementById('eyeBtn');
const passInput = document.getElementById('password');

eyeBtn.addEventListener('click', () => {
  const isHidden = passInput.type === 'password';
  passInput.type = isHidden ? 'text' : 'password';

  // Swap icon stroke color
  const icon = document.getElementById('eyeIcon');
  icon.setAttribute('stroke', isHidden ? '#F28695' : '#bbb');
});

// ── Google button loading state ──
document.getElementById('googleBtn').addEventListener('click', function () {
  this.style.opacity = '0.6';
  this.style.pointerEvents = 'none';
});

// ── Show errors from OAuth redirect ──
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

// ── Get Started button (frontend validation) ──
document.getElementById('btnGetStarted').addEventListener('click', () => {
  const name  = document.getElementById('fullname').value.trim();
  const email = document.getElementById('email').value.trim();
  const pass  = document.getElementById('password').value;

  if (!name || !email || !pass) {
    errEl.textContent = 'Please fill in all fields.';
    errEl.classList.add('show');
    return;
  }

  if (!email.endsWith('@su.ac.th')) {
    errEl.textContent = 'Only @su.ac.th university emails are accepted.';
    errEl.classList.add('show');
    return;
  }

  errEl.classList.remove('show');

  // TODO: call your backend register API here
  // fetch('/api/register', { method:'POST', body: JSON.stringify({name, email, pass}) })
  console.log('Register:', { name, email });
});