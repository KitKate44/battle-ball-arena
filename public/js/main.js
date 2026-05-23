'use strict';

/* ──────── State ──────── */
let allBalls = [];
let selectedPlayer = null;
let selectedOpponent = null;
let activeGame = null;

/* ──────── Init ──────── */
async function init() {
  try {
    const res = await fetch('/api/balls');
    allBalls = await res.json();
  } catch {
    // Fallback if API fails
    allBalls = [];
  }

  renderGrid('player-grid', 'player');
  renderGrid('opponent-grid', 'opponent');

  document.getElementById('battle-btn').addEventListener('click', startBattle);
  document.getElementById('back-btn').addEventListener('click', goBack);
  document.getElementById('btn-play-again').addEventListener('click', playAgain);
  document.getElementById('btn-change-ball').addEventListener('click', changeBall);

  showScreen('selector');
}

/* ──────── Screen management ──────── */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + id).classList.add('active');
}

/* ──────── Ball Grid rendering ──────── */
function renderGrid(gridId, role) {
  const grid = document.getElementById(gridId);
  grid.innerHTML = '';

  allBalls.forEach(ball => {
    const card = buildCard(ball, role);
    grid.appendChild(card);
  });
}

function buildCard(ball, role) {
  const card = document.createElement('div');
  card.className = 'ball-card';
  card.dataset.id = ball.id;
  card.dataset.role = role;

  // Stat bar widths (normalized)
  const hpW  = Math.round(ball.stats.health  / 400 * 100);
  const spdW = Math.round(ball.stats.speed   / 8.0 * 100);
  const dmgW = Math.round(ball.stats.damage  / 1.8 * 100);

  // Stat bar colors
  const statColor = ball.colors.glow || ball.colors.primary;

  card.innerHTML = `
    <div class="card-ball-preview">
      <div class="card-ball-inner" style="
        background: radial-gradient(circle at 35% 32%, rgba(255,255,255,0.5) 0%, ${ball.colors.primary} 45%, ${ball.colors.secondary} 100%);
        box-shadow: 0 0 18px ${ball.colors.glow};
      ">${ball.icon}</div>
    </div>
    <div class="card-rarity rarity-${ball.rarity}">${ball.rarity}</div>
    <div class="card-name">${ball.name}</div>
    <div class="card-desc">${ball.description}</div>
    <div class="card-stats">
      <div class="stat-row">
        <span class="stat-row-label">HP</span>
        <div class="stat-bar-wrap"><div class="stat-bar-fill" style="width:${hpW}%; background:${statColor};"></div></div>
      </div>
      <div class="stat-row">
        <span class="stat-row-label">SPD</span>
        <div class="stat-bar-wrap"><div class="stat-bar-fill" style="width:${spdW}%; background:${statColor};"></div></div>
      </div>
      <div class="stat-row">
        <span class="stat-row-label">DMG</span>
        <div class="stat-bar-wrap"><div class="stat-bar-fill" style="width:${dmgW}%; background:${statColor};"></div></div>
      </div>
    </div>
    <div class="card-special">
      <div class="special-name">${ball.special.name}</div>
      <div class="special-desc">${ball.special.desc}</div>
    </div>
  `;

  card.addEventListener('click', () => selectBall(ball, role, card));
  return card;
}

/* ──────── Ball selection ──────── */
function selectBall(ball, role, clickedCard) {
  // Deselect previous in same role
  document.querySelectorAll(`.ball-card[data-role="${role}"]`).forEach(c => {
    c.classList.remove('selected-player', 'selected-opponent');
  });

  if (role === 'player') {
    selectedPlayer = ball;
    clickedCard.classList.add('selected-player');
    updatePreview('player', ball);
  } else {
    selectedOpponent = ball;
    clickedCard.classList.add('selected-opponent');
    updatePreview('opponent', ball);
  }

  document.getElementById('battle-btn').disabled = !(selectedPlayer && selectedOpponent);
}

function updatePreview(role, ball) {
  const previewEl = document.getElementById(`preview-${role}`);
  const nameEl    = document.getElementById(`preview-${role}-name`);

  previewEl.innerHTML = `
    <div style="
      width:100%; height:100%; border-radius:50%;
      background: radial-gradient(circle at 35% 32%, rgba(255,255,255,0.5) 0%, ${ball.colors.primary} 45%, ${ball.colors.secondary} 100%);
      box-shadow: 0 0 22px ${ball.colors.glow};
      display:flex; align-items:center; justify-content:center;
      font-size:36px;
    ">${ball.icon}</div>
  `;
  previewEl.classList.add('has-ball');
  previewEl.style.borderColor = role === 'player' ? '#ffffff' : '#888888';
  previewEl.style.boxShadow = `0 0 18px ${ball.colors.glow}`;

  nameEl.textContent = ball.name;
  nameEl.style.color = role === 'player' ? '#ffffff' : '#888888';
}

/* ──────── Battle ──────── */
function startBattle() {
  if (!selectedPlayer || !selectedOpponent) return;

  showScreen('battle');
  setupBattleHUD();

  const canvas = document.getElementById('arena-canvas');

  if (activeGame) { activeGame.stop(); activeGame = null; }

  activeGame = new Game(canvas, selectedPlayer, selectedOpponent, {
    onHUDUpdate: updateBattleHUD,
    onGameEnd: handleGameEnd,
  });

  activeGame.start();
}

function setupBattleHUD() {
  const p = selectedPlayer;
  const o = selectedOpponent;

  document.getElementById('hud-player-icon').textContent = p.icon;
  document.getElementById('hud-player-name').textContent = p.name;
  document.getElementById('hud-player-label').textContent = `${p.stats.health} / ${p.stats.health}`;
  document.getElementById('hud-player-hp').style.width = '100%';
  document.getElementById('hud-player-hp').style.background = 'var(--hp-green)';

  document.getElementById('hud-opp-icon').textContent = o.icon;
  document.getElementById('hud-opp-name').textContent = o.name;
  document.getElementById('hud-opp-label').textContent = `${o.stats.health} / ${o.stats.health}`;
  document.getElementById('hud-opp-hp').style.width = '100%';
  document.getElementById('hud-opp-hp').style.background = 'var(--hp-green)';

  document.getElementById('player-special-badge').textContent = p.special.name;
  document.getElementById('opp-special-badge').textContent = o.special.name;

  document.getElementById('round-timer').textContent = '0:00';
}

function updateBattleHUD(playerHP, playerMax, oppHP, oppMax, duration) {
  const pPct = playerHP / playerMax;
  const oPct = oppHP / oppMax;

  const pBar = document.getElementById('hud-player-hp');
  pBar.style.width = `${Math.max(0, pPct * 100)}%`;
  pBar.style.background = pPct > 0.6 ? 'var(--hp-green)' : pPct > 0.28 ? 'var(--hp-yellow)' : 'var(--hp-red)';
  pBar.style.boxShadow = `0 0 8px ${pPct > 0.6 ? 'var(--hp-green)' : pPct > 0.28 ? 'var(--hp-yellow)' : 'var(--hp-red)'}`;

  const oBar = document.getElementById('hud-opp-hp');
  oBar.style.width = `${Math.max(0, oPct * 100)}%`;
  oBar.style.background = oPct > 0.6 ? 'var(--hp-green)' : oPct > 0.28 ? 'var(--hp-yellow)' : 'var(--hp-red)';
  oBar.style.boxShadow = `0 0 8px ${oPct > 0.6 ? 'var(--hp-green)' : oPct > 0.28 ? 'var(--hp-yellow)' : 'var(--hp-red)'}`;

  document.getElementById('hud-player-label').textContent = `${Math.ceil(playerHP)} / ${playerMax}`;
  document.getElementById('hud-opp-label').textContent = `${Math.ceil(oppHP)} / ${oppMax}`;

  const mins = Math.floor(duration / 60);
  const secs = Math.floor(duration % 60).toString().padStart(2, '0');
  document.getElementById('round-timer').textContent = `${mins}:${secs}`;
}

/* ──────── Results ──────── */
function handleGameEnd(winner, stats) {
  if (activeGame) { activeGame.stop(); activeGame = null; }

  // Log to backend
  fetch('/api/game/result', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      winnerId: winner === 'player' ? selectedPlayer.id : selectedOpponent.id,
      loserId:  winner === 'player' ? selectedOpponent.id : selectedPlayer.id,
      duration: stats.duration,
      playerDamage: stats.playerDamage,
    }),
  }).catch(() => {});

  populateResults(winner, stats);
  showScreen('results');
}

function populateResults(winner, stats) {
  const isWin = winner === 'player';
  const winBall = isWin ? selectedPlayer : selectedOpponent;
  const loseBall = isWin ? selectedOpponent : selectedPlayer;

  // Header
  const titleEl = document.getElementById('result-title');
  titleEl.textContent = isWin ? 'VICTORY!' : 'DEFEAT!';
  titleEl.className = 'result-title ' + (isWin ? 'victory' : 'defeat');
  document.getElementById('result-subtitle').textContent = isWin
    ? `${selectedPlayer.name} wins the arena!`
    : `${selectedOpponent.name} was too powerful!`;

  // Winner/Loser ball previews
  renderResultBall('result-winner-ball', winBall);
  renderResultBall('result-loser-ball', loseBall);
  document.getElementById('result-winner-name').textContent = winBall.name;
  document.getElementById('result-loser-name').textContent = loseBall.name;

  // Stats
  const mins = Math.floor(stats.duration / 60);
  const secs = Math.floor(stats.duration % 60).toString().padStart(2, '0');
  document.getElementById('stat-duration').textContent = `${mins}:${secs}`;
  document.getElementById('stat-player-dmg').textContent = Math.round(stats.playerDamage);
  document.getElementById('stat-opp-dmg').textContent = Math.round(stats.opponentDamage);
  document.getElementById('stat-player-hits').textContent = stats.playerHits;
}

function renderResultBall(elId, ball) {
  const el = document.getElementById(elId);
  el.style.cssText = `
    background: radial-gradient(circle at 35% 32%, rgba(255,255,255,0.5) 0%, ${ball.colors.primary} 45%, ${ball.colors.secondary} 100%);
    box-shadow: 0 0 22px ${ball.colors.glow};
    display: flex; align-items: center; justify-content: center;
    font-size: 30px; border-radius: 50%;
    width: 70px; height: 70px; margin: 0 auto 10px;
  `;
  el.textContent = ball.icon;
}

/* ──────── Navigation ──────── */
function goBack() {
  if (activeGame) { activeGame.stop(); activeGame = null; }
  showScreen('selector');
}

function playAgain() {
  startBattle();
}

function changeBall() {
  if (activeGame) { activeGame.stop(); activeGame = null; }
  showScreen('selector');
}

/* ──────── Boot ──────── */
document.addEventListener('DOMContentLoaded', init);
