// ─────────────────────────────────────────────
// Bottom navigation
// ─────────────────────────────────────────────
document.querySelectorAll('.navButton').forEach(btn => {
  btn.addEventListener('click', () => {
    const panelId = btn.dataset.panel;
    switchPanel(panelId);

    document.querySelectorAll('.navButton').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    if (panelId === 'rewardPanel') loadRewards();
    if (panelId === 'calendarPanel') renderCalendar();
    if (panelId === 'achievementPanel') renderMorePanel();
  });
});

function switchPanel(panelId) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  const panel = document.getElementById(panelId);
  if (panel) panel.classList.add('active');
}

// ─────────────────────────────────────────────
// Owner: give points
// ─────────────────────────────────────────────
document.querySelectorAll('.quickActions button[data-points]').forEach(btn => {
  btn.addEventListener('click', () => givePoints(parseInt(btn.dataset.points, 10)));
});

document.getElementById('customPointsBtn')?.addEventListener('click', async () => {
  const amount = prompt('How many points?');
  if (!amount) return;
  const num = parseInt(amount, 10);
  if (isNaN(num) || num === 0) return alert('Enter a valid number');
  await givePoints(num);
});

async function givePoints(amount) {
  if (!currentUserData || currentUserData.role !== 'owner') return;
  const puppyUid = currentUserData.linkedUid;
  if (!puppyUid) return alert('Link a puppy first 🐾');

  try {
    await db.collection('users').doc(puppyUid).update({
      points: firebase.firestore.FieldValue.increment(amount)
    });
    addPraise(amount > 0 ? `🩷 +${amount} points! Good girl~` : `Took ${Math.abs(amount)} points`);
  } catch (err) {
    console.error(err);
    alert('Could not update points');
  }
}

function addPraise(text) {
  const feed = document.getElementById('praiseFeed');
  if (!feed) return;
  const div = document.createElement('div');
  div.className = 'praise';
  div.textContent = text;
  feed.prepend(div);
  while (feed.children.length > 6) feed.removeChild(feed.lastChild);
}

// ─────────────────────────────────────────────
// REWARDS
// ─────────────────────────────────────────────
document.getElementById('addRewardBtn')?.addEventListener('click', openAddRewardModal);

function openAddRewardModal() {
  if (!currentUserData || currentUserData.role !== 'owner') return;
  document.getElementById('rewardModal')?.remove();

  const modal = document.createElement('div');
  modal.id = 'rewardModal';
  modal.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal-card">
        <h3>Add Reward 🎁</h3>
        <input id="modalTitle" placeholder="Reward name (e.g. Pets)" maxlength="40">
        <input id="modalCost" type="number" placeholder="Cost in points" min="1">
        <input id="modalDesc" placeholder="Short description (optional)" maxlength="80">
        <div class="modal-actions">
          <button id="modalCancel" class="secondary">Cancel</button>
          <button id="modalSave">Save ♡</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById('modalCancel').onclick = () => modal.remove();
  document.getElementById('modalSave').onclick = async () => {
    const title = document.getElementById('modalTitle').value.trim();
    const cost = parseInt(document.getElementById('modalCost').value, 10);
    const description = document.getElementById('modalDesc').value.trim();

    if (!title) return alert('Give it a name');
    if (isNaN(cost) || cost < 1) return alert('Enter a valid point cost');

    try {
      await db.collection('rewards').add({
        title,
        cost,
        description,
        active: true,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      modal.remove();
      loadRewards();
      addPraise(`🎁 New reward added: ${title}`);
    } catch (err) {
      console.error(err);
      alert('Could not save reward');
    }
  };
}

async function loadRewards() {
  const list = document.getElementById('rewardList');
  if (!list) return;

  list.innerHTML = `<p class="empty">Loading…</p>`;

  try {
    const snap = await db.collection('rewards')
      .where('active', '==', true)
      .orderBy('cost')
      .get();

    if (snap.empty) {
      list.innerHTML = `<p class="empty">No rewards yet 🐾<br><small>Owner can add some with the ＋ button</small></p>`;
      return;
    }

    list.innerHTML = '';
    snap.forEach(doc => {
      const r = doc.data();
      const card = document.createElement('div');
      card.className = 'reward-card';
      card.innerHTML = `
        <div class="reward-info">
          <strong>${escapeHtml(r.title)}</strong>
          ${r.description ? `<div class="reward-desc">${escapeHtml(r.description)}</div>` : ''}
        </div>
        <div class="reward-actions">
          <span class="cost-badge">${r.cost} pts</span>
          ${currentUserData?.role === 'owner'
            ? `<button class="delete-reward" data-id="${doc.id}">✕</button>`
            : `<button class="redeem-btn" data-id="${doc.id}" data-cost="${r.cost}">Redeem</button>`
          }
        </div>
      `;
      list.appendChild(card);
    });

    list.querySelectorAll('.delete-reward').forEach(btn => {
      btn.onclick = async () => {
        if (!confirm('Remove this reward?')) return;
        await db.collection('rewards').doc(btn.dataset.id).update({ active: false });
        loadRewards();
      };
    });

    list.querySelectorAll('.redeem-btn').forEach(btn => {
      btn.onclick = async () => {
        const cost = parseInt(btn.dataset.cost, 10);
        const uid = auth.currentUser.uid;
        const userDoc = await db.collection('users').doc(uid).get();
        const points = userDoc.data()?.points || 0;

        if (points < cost) {
          alert('Not enough points yet… keep being a good girl 🐾');
          return;
        }
        if (!confirm(`Redeem for ${cost} points?`)) return;

        await db.collection('users').doc(uid).update({
          points: firebase.firestore.FieldValue.increment(-cost)
        });
        addPraise(`🎁 Redeemed a reward! (−${cost} pts)`);
        alert('Redeemed! Go tell your Owner 💕');
        loadRewards();
      };
    });
  } catch (err) {
    console.error(err);
    list.innerHTML = `<p class="empty">Could not load rewards</p>`;
  }
}

// ─────────────────────────────────────────────
// CALENDAR
// ─────────────────────────────────────────────
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();

async function renderCalendar() {
  const cal = document.getElementById('calendar');
  if (!cal) return;

  const uid = getCalendarUid();
  if (!uid) {
    cal.innerHTML = `<p class="empty">Link accounts first to use the calendar 🐾</p>`;
    return;
  }

  const monthNames = ['January','February','March','April','May','June',
                      'July','August','September','October','November','December'];

  const start = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(currentYear, currentMonth + 1, 0).getDate();
  const end = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const eventsSnap = await db.collection('calendar').doc(uid).collection('events')
    .where('date', '>=', start)
    .where('date', '<=', end)
    .get();

  const eventsByDate = {};
  eventsSnap.forEach(doc => {
    const d = doc.data();
    if (!eventsByDate[d.date]) eventsByDate[d.date] = [];
    eventsByDate[d.date].push({ id: doc.id, ...d });
  });

  cal.innerHTML = `
    <div class="cal-header">
      <button class="cal-nav" id="prevMonth">‹</button>
      <h3>${monthNames[currentMonth]} ${currentYear}</h3>
      <button class="cal-nav" id="nextMonth">›</button>
    </div>
    <div class="cal-grid" id="calGrid"></div>
    <div class="cal-actions">
      <button class="cal-btn" id="markPeriodStart">Period Start</button>
      <button class="cal-btn" id="markPeriodEnd">Period End</button>
      <button class="cal-btn spicy" id="markSpicy">Spicy 🔥</button>
    </div>
    <div class="legend">
      <span><i class="dot period"></i> Period</span>
      <span><i class="dot spicy"></i> Spicy</span>
    </div>
  `;

  const grid = document.getElementById('calGrid');
  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const dayNames = ['S','M','T','W','T','F','S'];

  dayNames.forEach(d => {
    const el = document.createElement('div');
    el.className = 'cal-day-name';
    el.textContent = d;
    grid.appendChild(el);
  });

  for (let i = 0; i < firstDay; i++) {
    const empty = document.createElement('div');
    empty.className = 'cal-day empty';
    grid.appendChild(empty);
  }

  const todayStr = new Date().toISOString().slice(0, 10);

  for (let day = 1; day <= lastDay; day++) {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayEl = document.createElement('div');
    const evts = eventsByDate[dateStr] || [];

    let extraClass = '';
    if (evts.some(e => e.type.startsWith('period'))) extraClass += ' has-period';
    if (evts.some(e => e.type === 'spicy')) extraClass += ' has-spicy';
    if (dateStr === todayStr) extraClass += ' is-today';

    dayEl.className = `cal-day${extraClass}`;
    dayEl.dataset.date = dateStr;
    dayEl.innerHTML = `<span class="day-num">${day}</span>`;

    dayEl.addEventListener('click', () => {
      document.querySelectorAll('.cal-day').forEach(d => d.classList.remove('selected'));
      dayEl.classList.add('selected');
    });

    grid.appendChild(dayEl);
  }

  document.getElementById('prevMonth').onclick = () => {
    currentMonth--;
    if (currentMonth < 0) { currentMonth = 11; currentYear--; }
    renderCalendar();
  };
  document.getElementById('nextMonth').onclick = () => {
    currentMonth++;
    if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    renderCalendar();
  };

  document.getElementById('markPeriodStart').onclick = () => markDay('period-start');
  document.getElementById('markPeriodEnd').onclick = () => markDay('period-end');
  document.getElementById('markSpicy').onclick = () => markDay('spicy');
}

function getCalendarUid() {
  if (!currentUserData) return null;
  if (currentUserData.role === 'owner') return currentUserData.linkedUid;
  return auth.currentUser?.uid;
}

async function markDay(type) {
  const selected = document.querySelector('.cal-day.selected');
  if (!selected) {
    alert('First tap a day, then choose what to mark 🐾');
    return;
  }

  const date = selected.dataset.date;
  const uid = getCalendarUid();
  if (!uid) return;

  try {
    const existing = await db.collection('calendar').doc(uid).collection('events')
      .where('date', '==', date)
      .where('type', '==', type)
      .limit(1)
      .get();

    if (!existing.empty) {
      await existing.docs[0].ref.delete();
    } else {
      await db.collection('calendar').doc(uid).collection('events').add({
        date,
        type,
        note: '',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
    renderCalendar();
  } catch (err) {
    console.error(err);
    alert('Could not save');
  }
}

// ─────────────────────────────────────────────
// MORE PANEL
// ─────────────────────────────────────────────
function renderMorePanel() {
  const panel = document.getElementById('achievementPanel');
  if (!panel) return;

  panel.innerHTML = `
    <h2 class="panel-title">More</h2>
    <div class="more-list">
      <button class="more-btn" id="btnAchievements">🏆 Achievements</button>
      <button class="more-btn ownerOnly" id="btnStats">📊 Statistics</button>
      <button class="more-btn" id="btnTheme">🎨 Theme</button>
      <button class="more-btn" id="btnSounds">🔊 Sounds</button>
      <button class="more-btn" id="btnLink">🔗 Link / Relationship</button>
      <button class="more-btn" id="btnLogoutMore">Logout</button>
    </div>
    <div id="moreContent" style="margin-top:18px"></div>
  `;

  document.getElementById('btnAchievements').onclick = showAchievements;
  document.getElementById('btnStats')?.addEventListener('click', showStats);
  document.getElementById('btnTheme').onclick = showTheme;
  document.getElementById('btnSounds').onclick = showSounds;
  document.getElementById('btnLink').onclick = () => showScreen('inviteScreen');
  document.getElementById('btnLogoutMore').onclick = () => auth.signOut();
}

function showAchievements() {
  document.getElementById('moreContent').innerHTML = `
    <div class="card" style="gap:10px">
      <h3 style="color:var(--hot);margin-bottom:4px">Achievements</h3>
      <div class="ach">🔒 First Points</div>
      <div class="ach">🔒 Good Girl (50 pts)</div>
      <div class="ach">🔒 Spoiled (200 pts)</div>
      <div class="ach">🔒 Period Tracker</div>
      <div class="ach">🔒 Spicy Day</div>
      <p style="font-size:0.85rem;color:var(--text-light);margin-top:6px">
        Real tracking coming in the next update 🐾
      </p>
    </div>
  `;
}

function showStats() {
  document.getElementById('moreContent').innerHTML = `
    <div class="card">
      <h3 style="color:var(--hot)">Statistics</h3>
      <p style="color:var(--text-light)">Total points given, rewards redeemed, and streaks will live here soon.</p>
    </div>
  `;
}

function showTheme() {
  document.getElementById('moreContent').innerHTML = `
    <div class="card">
      <h3 style="color:var(--hot)">Theme</h3>
      <p style="color:var(--text-light);margin-bottom:12px">More pastel themes coming soon</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="theme-btn">💗 Pink</button>
        <button class="theme-btn">💜 Lavender</button>
        <button class="theme-btn">🍑 Peach</button>
      </div>
    </div>
  `;
}

function showSounds() {
  const enabled = localStorage.getItem('soundsEnabled') !== 'false';
  const content = document.getElementById('moreContent');
  content.innerHTML = `
    <div class="card">
      <h3 style="color:var(--hot)">Sounds</h3>
      <p style="color:var(--text-light);margin-bottom:12px">Cute sounds when giving points or redeeming</p>
      <button id="toggleSounds" class="secondary">
        Sounds are ${enabled ? 'ON 🔊' : 'OFF 🔇'}
      </button>
    </div>
  `;
  document.getElementById('toggleSounds').onclick = () => {
    const next = localStorage.getItem('soundsEnabled') === 'false';
    localStorage.setItem('soundsEnabled', next ? 'true' : 'false');
    showSounds();
  };
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
