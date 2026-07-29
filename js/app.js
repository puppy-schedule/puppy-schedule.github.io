let currentUser = null;
let unsubscribePoints = null;

auth.onAuthStateChanged(user => {
  currentUser = user;
  if (user) {
    // Real-time points listener
    if (unsubscribePoints) unsubscribePoints();
    unsubscribePoints = db.collection('users').doc(user.uid)
      .onSnapshot(snap => {
        if (snap.exists) {
          document.getElementById('points-value').textContent = snap.data().points || 0;
        }
      });

    loadRewards();
  }
});

// Simple tab switching
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
  });
});

async function loadRewards() {
  const list = document.getElementById('rewards-list');
  list.innerHTML = '<p>Loading rewards...</p>';

  const snap = await db.collection('rewards')
    .where('active', '==', true)
    .orderBy('cost')
    .get();

  if (snap.empty) {
    list.innerHTML = '<p>No rewards yet… be a good girl and earn some!</p>';
    return;
  }

  list.innerHTML = '';
  snap.forEach(doc => {
    const r = doc.data();
    const div = document.createElement('div');
    div.className = 'reward-card';
    div.innerHTML = `
      <strong>${r.title}</strong>
      <span class="cost">${r.cost} pts</span>
      <button class="redeem-btn" data-id="${doc.id}" data-cost="${r.cost}">Redeem</button>
    `;
    list.appendChild(div);
  });
}
