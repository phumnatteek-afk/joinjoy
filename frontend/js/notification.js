(async function initNotifications() {
  const listEl = document.getElementById('notif-list');
  const emptyEl = document.getElementById('empty-state');
  const sectionLabelEl = document.getElementById('section-label');

  const state = { notifications: [] };

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
    return date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  };

  const iconSvg = `<svg viewBox="0 0 24 24"><path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V8H4v2H2v2h2v2h2v-2h2v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`;

  const isJoinRequest = (item) =>
    String(item.notification_title || '').includes('มีคนขอเข้าร่วมทริป') &&
    Number(item.trip_id) > 0;

  const extractRequesterName = (detailText) => {
    const detail = String(detailText || '');
    const matched = detail.match(/^(.+?)\s*ขอเข้าร่วมทริป/);
    return matched ? String(matched[1] || '').trim() : '';
  };

  const enrichMissingRequesterId = async (item) => {
    if (!String(item.notification_title || '').includes('มีคนขอเข้าร่วมทริป')) return item;
    if (Number(item.from_user_id) > 0) return item;

    const requesterName = extractRequesterName(item.notification_detail);
    if (!requesterName) return item;

    try {
      const response = await fetch(`/api/notification/resolve-user?username=${encodeURIComponent(requesterName)}`, {
        credentials: 'include'
      });
      if (!response.ok) return item;
      const payload = await response.json();
      const resolvedUserId = Number(payload.user_id || 0);
      if (!resolvedUserId) return item;
      return { ...item, from_user_id: resolvedUserId };
    } catch {
      return item;
    }
  };

  const resolveRequesterIdByName = async (requesterName) => {
    const name = String(requesterName || '').trim();
    if (!name) return 0;
    try {
      const response = await fetch(`/api/notification/resolve-user?username=${encodeURIComponent(name)}`, {
        credentials: 'include'
      });
      if (!response.ok) return 0;
      const payload = await response.json();
      return Number(payload.user_id || 0);
    } catch {
      return 0;
    }
  };

  const renderProfile = (profile) => {
    const firstName = profile.frist_name || '';
    const lastName = profile.last_name || '';
    const fullName = `${firstName} ${lastName}`.trim() || profile.user_name || '-';
    const tags = profile.tags
      ? String(profile.tags)
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean)
          .slice(0, 5)
          .join(', ')
      : '-';

    return `
      <div class="notif-profile-card">
        <div><strong>Name:</strong> ${escapeHtml(fullName)}</div>
        <div><strong>Username:</strong> ${escapeHtml(profile.user_name || '-')}</div>
        <div><strong>Faculty:</strong> ${escapeHtml(profile.faculty || '-')}</div>
        <div><strong>Email:</strong> ${escapeHtml(profile.university_email || '-')}</div>
        <div><strong>Bio:</strong> ${escapeHtml(profile.bio || '-')}</div>
        <div><strong>Tags:</strong> ${escapeHtml(tags)}</div>
      </div>
    `;
  };

  const renderList = () => {
    if (!Array.isArray(state.notifications) || state.notifications.length === 0) {
      listEl.style.display = 'none';
      sectionLabelEl.style.display = 'none';
      emptyEl.style.display = 'flex';
      return;
    }

    const grouped = state.notifications.reduce((acc, item) => {
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
        const tripLink = item.trip_id ? `Board.html?trip_id=${encodeURIComponent(item.trip_id)}` : '#';
        const requesterName = extractRequesterName(item.notification_detail);
        const isRequest = isJoinRequest(item);
        const detailLinkHtml = isRequest
          ? `<button class="notif-link notif-link-btn" data-action="profile" data-user-id="${item.from_user_id || ''}" data-requester-name="${escapeHtml(requesterName)}" data-target-id="${item.notification_id}">View Profile</button>`
          : `<a class="notif-link" href="${tripLink}">View Details</a>`;
        const actionHtml = isJoinRequest(item)
          ? `
            <div class="notif-actions" data-actions-for="${item.notification_id}">
              <button class="notif-btn accept" data-action="accept" data-trip-id="${item.trip_id}" data-user-id="${item.from_user_id || ''}" data-requester-name="${escapeHtml(requesterName)}">Accept</button>
              <button class="notif-btn reject" data-action="reject" data-trip-id="${item.trip_id}" data-user-id="${item.from_user_id || ''}" data-requester-name="${escapeHtml(requesterName)}">Reject</button>
            </div>
            <div class="notif-inline-profile" id="profile-${item.notification_id}"></div>
          `
          : '';

        htmlParts.push(`
          <div class="notif-item">
            <div class="dot"></div>
            <div class="notif-icon">${iconSvg}</div>
            <div class="notif-body">
              <div class="notif-title">${escapeHtml(item.notification_title)}</div>
              ${detailLinkHtml}
              <div class="notif-detail">${escapeHtml(item.notification_detail)}</div>
              ${actionHtml}
            </div>
            <div class="notif-time">${escapeHtml(formatTime(item.create_at))}</div>
          </div>
        `);
      });
    });

    sectionLabelEl.style.display = 'none';
    emptyEl.style.display = 'none';
    listEl.style.display = 'block';
    listEl.innerHTML = htmlParts.join('');
  };

  const loadNotifications = async () => {
    const userId = getUserId();
    const response = await fetch(`/api/notification/${encodeURIComponent(userId)}`, {
      credentials: 'include'
    });
    if (!response.ok) throw new Error(`โหลดแจ้งเตือนไม่สำเร็จ (${response.status})`);
    const rows = await response.json();
    state.notifications = await Promise.all((rows || []).map(enrichMissingRequesterId));
    renderList();
  };

  listEl.addEventListener('click', async (event) => {
    const button = event.target.closest('.notif-btn');
    if (!button) return;

    const action = button.dataset.action;
    let userId = Number(button.dataset.userId || 0);
    const requesterName = button.dataset.requesterName || '';
    const tripId = Number(button.dataset.tripId || 0);

    if (!userId && requesterName) {
      userId = await resolveRequesterIdByName(requesterName);
      if (userId) {
        button.dataset.userId = String(userId);
      }
    }

    try {
      if (action === 'profile') {
        if (!userId) throw new Error('ไม่พบข้อมูลผู้ขอเข้าร่วม');
        const targetId = button.dataset.targetId;
        const container = document.getElementById(`profile-${targetId}`);
        if (!container) return;
        if (container.dataset.loaded === '1') {
          const isVisible = container.classList.toggle('show');
          button.textContent = isVisible ? 'Hide Profile' : 'View Profile';
          return;
        }

        button.disabled = true;
        button.textContent = 'Loading...';

        const response = await fetch(`/api/notification/user-profile/${encodeURIComponent(userId)}`, {
          credentials: 'include'
        });
        if (!response.ok) throw new Error('โหลดโปรไฟล์ไม่สำเร็จ');

        const profile = await response.json();
        container.innerHTML = renderProfile(profile);
        container.dataset.loaded = '1';
        container.classList.add('show');

        button.textContent = 'Hide Profile';
        button.disabled = false;
        return;
      }

      if (action === 'accept' || action === 'reject') {
        if (!userId) throw new Error('ไม่พบข้อมูลผู้ขอเข้าร่วม');
        const selectedStatus = action === 'accept' ? 'Joined' : 'Rejected';
        button.disabled = true;

        const response = await fetch('/api/notification/respond', {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            trip_id: tripId,
            user_id: userId,
            status: selectedStatus
          })
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'อัปเดตสถานะไม่สำเร็จ');

        await loadNotifications();
      }
    } catch (error) {
      console.error('Notification action error:', error);
      alert(error.message || 'เกิดข้อผิดพลาด');
      button.disabled = false;
      if (action === 'profile') {
        button.textContent = 'View Profile';
      }
    }
  });

  try {
    await loadNotifications();
  } catch (error) {
    console.error('Notification load error:', error);
    listEl.style.display = 'none';
    sectionLabelEl.style.display = 'none';
    emptyEl.style.display = 'flex';
  }
})();
