// home.js — navigation for the welcome page

document.getElementById('btnCreate').addEventListener('click', function () {
    // Add a quick scale-out animation before navigating
    this.style.transform = 'scale(0.95)';
    setTimeout(() => {
      window.location.href = 'homecreate.html';
    }, 150);
  });
  
  document.getElementById('btnLogin').addEventListener('click', function () {
    this.style.transform = 'scale(0.95)';
    setTimeout(() => {
      window.location.href = 'homelogin.html';
    }, 150);
  });