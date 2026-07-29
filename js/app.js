// ─────────────────────────────────────────────
// Bottom navigation
// ─────────────────────────────────────────────
document.querySelectorAll('.navButton').forEach(btn => {
  btn.addEventListener('click', () => {
    const panelId = btn.dataset.panel;
    switchPanel(panelId);

    // update active state
    document.querySelectorAll('.navButton').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

function switchPanel(panelId) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  const panel = document.getElementById(panelId);
  if (panel) panel.classList.add('active');
}

// ─────────────────────────────────────────────
// Real-time points
// ─────────────────────────────────────────────
let pointsUnsub = null;

function startPointsListener() {
  if (pointsUnsub) pointsUnsub();

  const uid = getPointsUid(); // owner looks at linked puppy, puppy looks at self
  if (!uid) return;

  pointsUnsub = db.collection('users').doc(uid)
    .onSnapshot(snap => {
      if (!snap.exists) return;
      const points = snap.data().points || 0;
      const el = document.getElementById('pointCounter');
      if (el) el.textContent = `⭐ ${points}`;
    });
}

function getPointsUid() {
  if (!currentUserData) return null;
  if (currentUserData.role === 'owner') {
    return currentUserData.linkedUid || null;
  }
  return auth.currentUser?.uid || null;
}

// ─────────────────────────────────────────────
// Owner: quick give points
// ─────────────────────────────────────────────
document.querySelectorAll('.quickActions button[data-points]').forEach(btn => {
  btn.addEventListener('click', async () => {
    const amount = parseInt(btn.dataset.points, 10);
    await givePoints(amount);
  });
});

document.getElementById('customPointsBtn')?.addEventListener('click', async () => {
  const amount = prompt('How many points do you want to give?');
  if (!amount) return;
  const num = parseInt(amount, 10);
  if (isNaN(num) || num === 0) {
    alert('Please enter a valid number');
    return;
  }
  await givePoints(num);
});

async function givePoints(amount) {
  if (!currentUserData || currentUserData.role !== 'owner') return;
  const puppyUid = currentUserData.linkedUid;
  if (!puppyUid) {
    alert('You need to link a puppy first');
    return;
  }

  try {
    await db.collection('users').doc(puppyUid).update({
      points: firebase.firestore.FieldValue.increment(amount)
    });

    // Optional: add a little praise
    addPraise(amount > 0
      ? `🩷 +${amount} points! Good girl~`
      : `Took ${Math.abs(amount)} points`);
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

  // keep only last 6
  while (feed.children.length > 6) {
    feed.removeChild(feed.lastChild);
  }
}

// ─────────────────────────────────────────────
// Load rewards (basic)
// ─────────────────────────────────────────────
async function loadRewards() {
  const list = document.getElementById('rewardList');
  if (!list) return;

  list.innerHTML = '<p class="empty">Loading…</p>';

  try {
    const snap = await db.collection('rewards')
      .where('active', '==', true)
      .orderBy('cost')
      .get();

    if (snap.empty) {
      list.innerHTML = '<p class="empty">No rewards yet</p>';
      return;
    }

    list.innerHTML = '';
    snap.forEach(doc => {
      const r = doc.data();
      const card = document.createElement('div');
      card.className = 'reward-card';
      card.style.cssText = `
        background:#fff5fa; border-radius:18px; padding:14px 16px;
        margin-bottom:10px; display:flex; justify-content:space-between;
        align-items:center; border:2px solid #ffd0e8;
      `;
      card.innerHTML = `
        <div>
          <strong>${r.title}</strong>
          ${r.description ? `<div style="font-size:0.85rem;color:#9e8a98">${r.description}</div>` : ''}
        </div>
        <div style="display:flex;align-items:center;gap:10px">
          <span style="background:#ff8ec4;color:white;padding:4px 10px;border-radius:20px;font-size:0.85rem;font-weight:700">
            ${r.cost} pts
          </span>
        </div>
      `;
      list.appendChild(card);
    });
  } catch (err) {
    console.error(err);
    list.innerHTML = '<p class="empty">Could not load rewards</p>';
  }
}

// Call when rewards panel is shown
document.querySelector('.navButton[data-panel="rewardPanel"]')
  ?.addEventListener('click', loadRewards);

// ─────────────────────────────────────────────
// Simple calendar placeholder
// ─────────────────────────────────────────────
function renderCalendarPlaceholder() {
  const cal = document.getElementById('calendar');
  if (!cal) return;
  cal.innerHTML = `
    <div style="text-align:center;padding:30px 10px;color:#9e8a98">
      <div style="font-size:2.5rem;margin-bottom:8px">📅</div>
      <p>Calendar coming soon</p>
      <p style="font-size:0.9rem;margin-top:6px">Period tracking + spicy days</p>
    </div>
  `;
}

document.querySelector('.navButton[data-panel="calendarPanel"]')
  ?.addEventListener('click', renderCalendarPlaceholder);
