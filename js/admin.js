// Give points
document.getElementById('give-points-btn')?.addEventListener('click', async () => {
  const amount = parseInt(document.getElementById('points-to-give').value) || 1;
  const adminSnap = await db.collection('users').doc(auth.currentUser.uid).get();
  const linkedUid = adminSnap.data().linkedUid;

  if (!linkedUid) {
    alert('You have not linked a puppy account yet.');
    return;
  }

  const puppyRef = db.collection('users').doc(linkedUid);
  await puppyRef.update({
    points: firebase.firestore.FieldValue.increment(amount)
  });

  alert(`Gave ${amount} point(s)!`);
});

// Add reward
document.getElementById('add-reward-btn')?.addEventListener('click', async () => {
  const title = document.getElementById('new-reward-title').value.trim();
  const cost = parseInt(document.getElementById('new-reward-cost').value);

  if (!title || !cost) {
    alert('Fill in both fields');
    return;
  }

  await db.collection('rewards').add({
    title,
    cost,
    description: '',
    active: true,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  document.getElementById('new-reward-title').value = '';
  document.getElementById('new-reward-cost').value = '';
  alert('Reward added!');
  // you can call a loadAdminRewards() function later
});

// Link account
document.getElementById('link-account-btn')?.addEventListener('click', async () => {
  const puppyUid = document.getElementById('link-uid').value.trim();
  if (!puppyUid) return;

  await db.collection('users').doc(auth.currentUser.uid).update({
    linkedUid: puppyUid
  });

  document.getElementById('linked-status').textContent = `Linked to: ${puppyUid}`;
  alert('Account linked!');
});
