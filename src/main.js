import { supabase } from './supabaseClient.js';

const content = document.getElementById('content');
let session = null;
let destinations = [];
let cardsByDestination = {};
let progressByDestination = {};   // { destination_id: cards_completed }
let earnedBadgeDestIds = new Set();

// ---------------------------------------------------------------
// Boot
// ---------------------------------------------------------------
init();

async function init() {
  const { data } = await supabase.auth.getSession();
  session = data.session;

  supabase.auth.onAuthStateChange((_event, newSession) => {
    session = newSession;
    render();
  });

  render();
}

async function render() {
  if (!session) {
    renderAuth();
    return;
  }
  content.innerHTML = `<p class="loading-note">Loading your destinations…</p>`;
  await loadContentAndProgress();
  renderHome();
}

// ---------------------------------------------------------------
// Data loading
// ---------------------------------------------------------------
async function loadContentAndProgress() {
  const { data: dests } = await supabase
    .from('destinations')
    .select('*')
    .order('sort_order');
  destinations = dests || [];

  const { data: cards } = await supabase
    .from('cards')
    .select('*')
    .order('sort_order');
  cardsByDestination = {};
  (cards || []).forEach(c => {
    if (!cardsByDestination[c.destination_id]) cardsByDestination[c.destination_id] = [];
    cardsByDestination[c.destination_id].push(c);
  });

  const { data: progressRows } = await supabase
    .from('user_progress')
    .select('*')
    .eq('user_id', session.user.id);
  progressByDestination = {};
  (progressRows || []).forEach(p => { progressByDestination[p.destination_id] = p.cards_completed; });

  const { data: badgeRows } = await supabase
    .from('user_badges')
    .select('destination_id')
    .eq('user_id', session.user.id);
  earnedBadgeDestIds = new Set((badgeRows || []).map(b => b.destination_id));
}

function isUnlocked(dest) {
  if (dest.unlock_rule === 'open') return true;
  if (dest.unlock_rule === 'requires_n_destinations') {
    return earnedBadgeDestIds.size >= dest.unlock_count;
  }
  return true;
}

// ---------------------------------------------------------------
// Auth screen
// ---------------------------------------------------------------
function renderAuth(mode = 'signin') {
  content.innerHTML = `
    <div class="screen active">
      <div class="brand">
        <svg viewBox="0 0 40 40" class="logo-poly"><polygon points="20,2 36,20 20,38 4,20" fill="none" stroke="#D9A441" stroke-width="2"/><polygon points="20,10 30,20 20,30 10,20" fill="#C25B37"/></svg>
        <h1>Speak Rwanda</h1>
      </div>
      <p class="eyebrow">Kinyarwanda · Culture · Wildlife</p>
      <p class="intro">Sign in to track your progress, badges, and pronunciation scores across sessions.</p>

      <div class="auth-box">
        <input class="auth-field" id="auth-email" type="email" placeholder="Email" autocomplete="email" />
        <input class="auth-field" id="auth-password" type="password" placeholder="Password" autocomplete="${mode === 'signin' ? 'current-password' : 'new-password'}" />
        <div class="auth-error" id="auth-error"></div>
        <button class="primary-btn" id="auth-submit">${mode === 'signin' ? 'Sign in' : 'Create account'}</button>
        <div class="auth-toggle">
          ${mode === 'signin'
            ? `New here? <button id="auth-switch">Create an account</button>`
            : `Already have an account? <button id="auth-switch">Sign in</button>`}
        </div>
      </div>
    </div>
  `;

  document.getElementById('auth-switch').onclick = () => renderAuth(mode === 'signin' ? 'signup' : 'signin');
  document.getElementById('auth-submit').onclick = () => handleAuthSubmit(mode);
}

async function handleAuthSubmit(mode) {
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  const errorEl = document.getElementById('auth-error');
  errorEl.textContent = '';

  if (!email || !password) {
    errorEl.textContent = 'Enter both an email and a password.';
    return;
  }

  const { error } = mode === 'signin'
    ? await supabase.auth.signInWithPassword({ email, password })
    : await supabase.auth.signUp({ email, password });

  if (error) {
    errorEl.textContent = error.message;
    return;
  }

  if (mode === 'signup') {
    errorEl.style.color = 'var(--forest)';
    errorEl.textContent = 'Account created — check your email if confirmation is required, then sign in.';
  }
}

// ---------------------------------------------------------------
// Home screen
// ---------------------------------------------------------------
function renderHome() {
  const destCardsHtml = destinations.map(d => {
    const total = (cardsByDestination[d.id] || []).length;
    const done = progressByDestination[d.id] || 0;
    const unlocked = isUnlocked(d);
    const pct = total ? Math.round((done / total) * 100) : 0;

    if (!unlocked) {
      return `
        <div class="dest-card locked">
          <div class="medallion" style="background:var(--lake)">
            <svg viewBox="0 0 24 24" fill="none" stroke="#F2E9D8" stroke-width="2"><path d="M3 15c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/></svg>
          </div>
          <div class="dest-info">
            <h3>${d.title}</h3>
            <p>Earn ${d.unlock_count} badges to unlock</p>
          </div>
          <div class="lock-icon">🔒</div>
        </div>`;
    }

    return `
      <div class="dest-card" data-dest-id="${d.id}">
        <div class="medallion" style="background:var(--clay)">
          <svg viewBox="0 0 24 24" fill="none" stroke="#F2E9D8" stroke-width="2"><path d="M8 12h8M12 8v8"/></svg>
        </div>
        <div class="dest-info">
          <h3>${d.title}</h3>
          <p>${d.description || ''}</p>
          <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
          <div class="dest-progress">${done} / ${total} cards</div>
        </div>
      </div>`;
  }).join('');

  const badgeShelfHtml = destinations.map(d => `
    <div class="badge-slot ${earnedBadgeDestIds.has(d.id) ? 'earned' : ''}">${d.badge_emoji || '🎖'}</div>
  `).join('');

  content.innerHTML = `
    <div class="screen active enter-left">
      <div class="top-bar">
        <div class="brand">
          <svg viewBox="0 0 40 40" class="logo-poly"><polygon points="20,2 36,20 20,38 4,20" fill="none" stroke="#D9A441" stroke-width="2"/><polygon points="20,10 30,20 20,30 10,20" fill="#C25B37"/></svg>
          <h1>Speak Rwanda</h1>
        </div>
        <button class="signout-btn" id="signout-btn">Sign out</button>
      </div>
      <p class="eyebrow">Kinyarwanda · Culture · Wildlife</p>
      <p class="intro">Unlock real Rwandan destinations by learning the words that live there.</p>
      <div class="dest-list stagger">${destCardsHtml}</div>
      <div class="badge-shelf">${badgeShelfHtml}</div>
      <p class="nav-hint">Pronunciation scoring is simulated in this build — swap in a real speech model when ready.</p>
    </div>
  `;

  document.getElementById('signout-btn').onclick = async () => { await supabase.auth.signOut(); };
  content.querySelectorAll('.dest-card[data-dest-id]').forEach(el => {
    el.onclick = () => openLevel(el.dataset.destId);
  });
}

// ---------------------------------------------------------------
// Level screen
// ---------------------------------------------------------------
function openLevel(destId) {
  const dest = destinations.find(d => d.id === destId);
  const cards = cardsByDestination[destId] || [];

  const cardsHtml = cards.map(c => `
    <div class="word-card" data-card-id="${c.id}">
      <div class="card-inner">
        <div class="card-face card-front">
          <div class="glyph">${c.glyph || '📖'}</div>
          <div class="kiny">${c.kinyarwanda_word}</div>
        </div>
        <div class="card-face card-back">
          <div class="eng">${c.english_word}</div>
          <div class="kiny-small">${c.kinyarwanda_word}</div>
          <div class="fact">${c.fact || ''}</div>
          <button class="mic-btn" data-card-id="${c.id}">🎤</button>
          <div class="score-wrap">
            <svg class="score-ring-svg" data-ring-for="${c.id}" viewBox="0 0 22 22">
              <circle class="score-ring-bg" cx="11" cy="11" r="9"/>
              <circle class="score-ring-fg" data-ring-fg-for="${c.id}" cx="11" cy="11" r="9"/>
            </svg>
            <div class="score-line" data-score-for="${c.id}"></div>
          </div>
        </div>
      </div>
    </div>
  `).join('');

  content.innerHTML = `
    <div class="screen active enter-right">
      <button class="back-btn" id="back-btn">← Destinations</button>
      <p class="eyebrow">${dest.title.toUpperCase()}</p>
      <p class="intro" style="margin-bottom:10px;">${dest.description || ''}</p>
      <div class="card-grid stagger">${cardsHtml}</div>
    </div>
    <div class="overlay" id="badge-overlay">
      <div class="badge-modal" id="badge-modal-inner">
        <div class="big-medal" id="modal-emoji">🏅</div>
        <h2 id="modal-title">Badge earned!</h2>
        <p id="modal-desc"></p>
        <button class="primary-btn" id="modal-continue">Continue</button>
      </div>
    </div>
  `;

  document.getElementById('back-btn').onclick = renderHome;

  content.querySelectorAll('.word-card').forEach(card => {
    card.onclick = () => card.classList.toggle('flipped');
  });

  content.querySelectorAll('.mic-btn').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      handleScoreAttempt(dest, btn.dataset.cardId);
    };
  });
}

// ---------------------------------------------------------------
// Scoring (simulated) + persistence
// ---------------------------------------------------------------
async function handleScoreAttempt(dest, cardId) {
  const btn = content.querySelector(`.mic-btn[data-card-id="${cardId}"]`);
  btn.classList.add('listening');
  btn.textContent = '●';

  // NOTE: this is a simulated score. Replace with a real pronunciation-scoring
  // call (e.g. an ASR + phoneme-alignment service) before shipping.
  const score = Math.floor(65 + Math.random() * 35);

  setTimeout(async () => {
    btn.classList.remove('listening');
    btn.textContent = '🎤';
    renderScore(cardId, score);

    await supabase.from('pronunciation_scores').insert({
      user_id: session.user.id,
      card_id: cardId,
      score
    });

    const cardEl = content.querySelector(`.word-card[data-card-id="${cardId}"]`);
    if (!cardEl.dataset.scored) {
      cardEl.dataset.scored = '1';
      const front = cardEl.querySelector('.card-front');
      const tick = document.createElement('div');
      tick.className = 'done-tick';
      tick.textContent = '✓';
      front.appendChild(tick);

      await bumpProgress(dest);
    }
  }, 1000);
}

function renderScore(cardId, score) {
  const line = content.querySelector(`[data-score-for="${cardId}"]`);
  const ringSvg = content.querySelector(`[data-ring-for="${cardId}"]`);
  const ringFg = content.querySelector(`[data-ring-fg-for="${cardId}"]`);
  const verdict = score > 90 ? 'Excellent accent!' : score > 75 ? 'Good — close to native rhythm' : 'Understandable — try the stress on the first syllable';
  const color = score > 90 ? '#3F6B4C' : score > 75 ? '#8f3f24' : '#C25B37';

  line.style.color = color;
  ringSvg.classList.add('show');
  requestAnimationFrame(() => {
    ringFg.style.stroke = color;
    ringFg.style.strokeDashoffset = 56.5 * (1 - score / 100);
  });

  let current = 0;
  const step = Math.max(1, Math.round(score / 20));
  const timer = setInterval(() => {
    current = Math.min(score, current + step);
    line.textContent = `${current}%`;
    if (current >= score) {
      clearInterval(timer);
      line.textContent = `${score}% · ${verdict}`;
    }
  }, 22);
}

async function bumpProgress(dest) {
  const total = (cardsByDestination[dest.id] || []).length;
  const current = (progressByDestination[dest.id] || 0) + 1;
  progressByDestination[dest.id] = current;

  await supabase.from('user_progress').upsert({
    user_id: session.user.id,
    destination_id: dest.id,
    cards_completed: current,
    completed_at: current === total ? new Date().toISOString() : null,
    updated_at: new Date().toISOString()
  }, { onConflict: 'user_id,destination_id' });

  if (current === total && !earnedBadgeDestIds.has(dest.id)) {
    await awardBadge(dest);
  }
}

async function awardBadge(dest) {
  const { error } = await supabase.from('user_badges').insert({
    user_id: session.user.id,
    destination_id: dest.id
  });
  if (error) return; // e.g. already awarded — ignore race
  earnedBadgeDestIds.add(dest.id);
  showBadgeModal(dest);
}

function showBadgeModal(dest) {
  const overlay = document.getElementById('badge-overlay');
  const modal = document.getElementById('badge-modal-inner');
  document.getElementById('modal-emoji').textContent = dest.badge_emoji || '🏅';
  document.getElementById('modal-title').textContent = `${dest.badge_name || 'Badge'} earned!`;
  document.getElementById('modal-desc').textContent = dest.badge_description || '';
  overlay.classList.add('active');
  modal.classList.remove('pop'); void modal.offsetWidth; modal.classList.add('pop');
  fireConfetti(modal);

  document.getElementById('modal-continue').onclick = () => {
    overlay.classList.remove('active');
    renderHome();
  };
}

function fireConfetti(container) {
  const colors = ['#D9A441', '#C25B37', '#3F6B4C', '#F2E9D8'];
  for (let n = 0; n < 22; n++) {
    const p = document.createElement('div');
    p.className = 'confetti-piece';
    const angle = Math.random() * Math.PI * 2;
    const dist = 70 + Math.random() * 90;
    p.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
    p.style.setProperty('--dy', `${Math.sin(angle) * dist - 40}px`);
    p.style.setProperty('--rot', `${(Math.random() * 360) | 0}deg`);
    p.style.background = colors[n % colors.length];
    p.style.animationDelay = `${Math.random() * 0.15}s`;
    container.appendChild(p);
    setTimeout(() => p.remove(), 1700);
  }
}
