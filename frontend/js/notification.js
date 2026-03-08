(async function initNotifications() {
  const listEl = document.getElementById('notif-list');
  const emptyEl = document.getElementById('empty-state');
  const sectionLabelEl = document.getElementById('section-label');

  const getUserId = () => {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get('user_id');
    const fromStorage =
      localStorage.getItem('userId') ||
      localStorage.getItem('user_id') ||
      localStorage.getItem('currentUserId');

    return fromQuery || fromStorage || '1';
  };

  const escapeHtml = (text) => {
    if (text === null || text === undefined) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '-';

    return date.toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const iconSvg = `<svg viewBox="0 0 24 24"><path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V8H4v2H2v2h2v2h2v-2h2v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`;

  const userId = getUserId();

  try {
    const response = await fetch(`/api/notification/${encodeURIComponent(userId)}`);

    if (!response.ok) {
      throw new Error(`โหลดแจ้งเตือนไม่สำเร็จ (${response.status})`);
    }

    const notifications = await response.json();

    if (!Array.isArray(notifications) || notifications.length === 0) {
      listEl.style.display = 'none';
      sectionLabelEl.style.display = 'none';
      emptyEl.style.display = 'flex';
      return;
    }

    const grouped = notifications.reduce((acc, item) => {
      const key = item.date_group || 'This week';
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {});

    const groupOrder = ['Today', 'Yesterday', 'This week'];
    const htmlParts = [];

    groupOrder.forEach((groupName) => {
      const items = grouped[groupName];
      if (!items || !items.length) return;

      htmlParts.push(`<div class="section-label">${escapeHtml(groupName)}</div>`);

      items.forEach((item) => {
        const tripLink = item.trip_id
          ? `Board.html?trip_id=${encodeURIComponent(item.trip_id)}`
          : '#';

        htmlParts.push(`
          <div class="notif-item">
            <div class="dot"></div>
            <div class="notif-icon">${iconSvg}</div>
            <div class="notif-body">
              <div class="notif-title">${escapeHtml(item.notification_title)}</div>
              <a class="notif-link" href="${tripLink}">View Details</a>
              <div class="notif-detail">${escapeHtml(item.notification_detail)}</div>
            </div>
            <div class="notif-time">${escapeHtml(formatTime(item.create_at))}</div>
          </div>
        `);
      });
    });

    sectionLabelEl.style.display = 'none';
    listEl.innerHTML = htmlParts.join('');
  } catch (error) {
    console.error('Notification load error:', error);
    listEl.style.display = 'none';
    sectionLabelEl.style.display = 'none';
    emptyEl.style.display = 'flex';
  }
})();
