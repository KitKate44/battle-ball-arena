'use strict';

/* ───────── Audio ───────── */
let audioCtx = null;

function initGameAudio() {
  if (audioCtx) { audioCtx.resume(); return; }
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    audioCtx.resume();
  } catch {}
}

function playWallBounce(speed) {
  if (!audioCtx || speed < 1.5) return;
  const t = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain); gain.connect(audioCtx.destination);
  osc.type = 'sine';
  const freq = 80 + speed * 8;
  osc.frequency.setValueAtTime(freq, t);
  osc.frequency.exponentialRampToValueAtTime(freq * 0.5, t + 0.09);
  const vol = Math.min(0.18, 0.06 + speed * 0.008);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
  osc.start(t); osc.stop(t + 0.1);
}

function playBallCollision(speed) {
  if (!audioCtx || speed < 0.6) return;
  const t = audioCtx.currentTime;
  const vol = Math.min(0.4, 0.08 + speed * 0.022);
  const bufSize = Math.ceil(audioCtx.sampleRate * 0.12);
  const buf = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
  const src = audioCtx.createBufferSource();
  src.buffer = buf;
  const filter = audioCtx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = Math.min(1400, 250 + speed * 50);
  filter.Q.value = 0.7;
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
  src.connect(filter); filter.connect(gain); gain.connect(audioCtx.destination);
  src.start(t); src.stop(t + 0.15);
}

/* ───────── Particle ───────── */
class Particle {
  constructor(x, y, vx, vy, color, life, size) {
    this.x = x; this.y = y;
    this.vx = vx; this.vy = vy;
    this.color = color;
    this.life = life; this.maxLife = life;
    this.size = size;
  }
  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vx *= 0.97; this.vy *= 0.97;
    this.vy += 30 * dt; // subtle gravity
    this.life -= dt;
    this.size *= 0.985;
  }
  render(ctx) {
    const alpha = Math.max(0, this.life / this.maxLife);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.color;
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(this.x, this.y, Math.max(0.5, this.size), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  get dead() { return this.life <= 0 || this.size < 0.4; }
}

/* ───────── FloatingText ───────── */
class FloatingText {
  constructor(x, y, text, color) {
    this.x = x; this.y = y;
    this.text = text; this.color = color;
    this.life = 1.2; this.maxLife = 1.2;
    this.vy = -55;
  }
  update(dt) {
    this.y += this.vy * dt;
    this.vy *= 0.93;
    this.life -= dt;
  }
  render(ctx) {
    const alpha = Math.max(0, this.life / this.maxLife);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = 'bold 16px "Segoe UI", sans-serif';
    ctx.fillStyle = this.color;
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.lineWidth = 3;
    ctx.textAlign = 'center';
    ctx.shadowBlur = 0;
    ctx.strokeText(this.text, this.x, this.y);
    ctx.fillText(this.text, this.x, this.y);
    ctx.restore();
  }
  get dead() { return this.life <= 0; }
}

const BOUNCE = 1.0;      // perfectly elastic wall bounce (no energy loss)

/* ───────── Ball ───────── */
class Ball {
  constructor(data, isPlayer) {
    this.id = data.id;
    this.name = data.name;
    this.icon = data.icon;
    this.isPlayer = isPlayer;
    this.maxHp = data.stats.health;
    this.hp = data.stats.health;
    this.damageMult = data.stats.damage;
    this.size = data.stats.size;
    this.colors = data.colors;

    // Physics
    this.x = 0; this.y = 0;
    this.vx = 0; this.vy = 0;

    // Special timers
    this.freezeTimer = 0;
    this.baseSpeed = data.stats.speed;
    this.staticTimer = 2 + Math.random() * 2;

    // Visual state
    this.hitFlash = 0;
    this.dead = false;
    this.trail = [];
    this.wallSoundTimer = 0;

    // Stats
    this.totalDamageDealt = 0;
    this.totalDamageTaken = 0;
    this.hitCount = 0;
  }

  get hpPct() { return Math.max(0, this.hp / this.maxHp); }

  update(W, H, dt) {
    if (this.dead) return;

    this._updateSpecials(dt);

    // Freeze drag (Glacier special) — slows to 25% of base speed, restores to base speed on expiry
    if (this.freezeTimer > 0) {
      const minSpeed = this.baseSpeed * 0.25;
      const drag = Math.pow(0.88, dt * 60);
      this.vx *= drag;
      this.vy *= drag;
      const cur = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
      if (cur < minSpeed && cur > 0.01) {
        this.vx = (this.vx / cur) * minSpeed;
        this.vy = (this.vy / cur) * minSpeed;
      }
      this.freezeTimer -= dt;
      if (this.freezeTimer <= 0) {
        const c = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        if (c > 0.01) { this.vx = (this.vx / c) * this.baseSpeed; this.vy = (this.vy / c) * this.baseSpeed; }
      }
    }

    // Move
    this.x += this.vx * dt * 60;
    this.y += this.vy * dt * 60;

    // Wall bounce
    const pad = 8;
    if (this.wallSoundTimer > 0) this.wallSoundTimer -= dt;
    if (this.x - this.size < pad)      { this.vx =  Math.abs(this.vx) * BOUNCE; this.x = pad + this.size;        if (this.wallSoundTimer <= 0) { playWallBounce(Math.abs(this.vx)); this.wallSoundTimer = 0.08; } }
    if (this.x + this.size > W - pad)  { this.vx = -Math.abs(this.vx) * BOUNCE; this.x = W - pad - this.size;    if (this.wallSoundTimer <= 0) { playWallBounce(Math.abs(this.vx)); this.wallSoundTimer = 0.08; } }
    if (this.y - this.size < pad)      { this.vy =  Math.abs(this.vy) * BOUNCE; this.y = pad + this.size;         if (this.wallSoundTimer <= 0) { playWallBounce(Math.abs(this.vy)); this.wallSoundTimer = 0.08; } }
    if (this.y + this.size > H - pad)  { this.vy = -Math.abs(this.vy) * BOUNCE; this.y = H - pad - this.size;    if (this.wallSoundTimer <= 0) { playWallBounce(Math.abs(this.vy)); this.wallSoundTimer = 0.08; } }

    // Trail
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > 18) this.trail.shift();

    if (this.hitFlash > 0) this.hitFlash -= dt * 4;
  }

  _updateSpecials(dt) {
    // Thunder: random velocity kick every few seconds
    if (this.id === 'thunder') {
      this.staticTimer -= dt;
      if (this.staticTimer <= 0) {
        this.staticTimer = 3 + Math.random() * 2;
        const kickAngle = Math.random() * Math.PI * 2;
        const kickSpeed = 7 + Math.random() * 4;
        this.vx += Math.cos(kickAngle) * kickSpeed;
        this.vy += Math.sin(kickAngle) * kickSpeed;
        const spd = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        if (spd > 14) { this.vx = (this.vx / spd) * 14; this.vy = (this.vy / spd) * 14; }
      }
    }
  }

  takeDamage(amount, attacker) {
    if (this.dead) return 0;
    // Crystal armor
    if (this.id === 'crystal') amount *= 0.75;
    this.hp -= amount;
    this.totalDamageTaken += amount;
    this.hitFlash = 1;
    if (this.hp <= 0) { this.hp = 0; this.dead = true; }
    return amount;
  }

  heal(amount) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  render(ctx) {
    if (this.dead) return;

    // Trail
    for (let i = 0; i < this.trail.length; i++) {
      const t = this.trail[i];
      const alpha = (i / this.trail.length) * 0.35;
      const radius = this.size * 0.55 * (i / this.trail.length);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = this.colors.trail || this.colors.primary;
      ctx.beginPath();
      ctx.arc(t.x, t.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.shadowBlur = 0;

    // Ball gradient
    const grad = ctx.createRadialGradient(
      this.x - this.size * 0.32, this.y - this.size * 0.32, this.size * 0.05,
      this.x, this.y, this.size
    );

    if (this.hitFlash > 0) {
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.5, this.colors.primary);
      grad.addColorStop(1, this.colors.secondary);
    } else {
      grad.addColorStop(0, 'rgba(255,255,255,0.55)');
      grad.addColorStop(0.35, this.colors.primary);
      grad.addColorStop(1, this.colors.secondary);
    }

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Specular highlight
    ctx.save();
    ctx.globalAlpha = 0.55;
    const shine = ctx.createRadialGradient(
      this.x - this.size * 0.38, this.y - this.size * 0.38, 0,
      this.x - this.size * 0.2, this.y - this.size * 0.2, this.size * 0.5
    );
    shine.addColorStop(0, 'rgba(255,255,255,0.85)');
    shine.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = shine;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Special visual effects
    this.renderSpecialFX(ctx);
  }

  renderSpecialFX(ctx) {
    const t = Date.now();

    if (this.id === 'thunder') {
      // Rotating lightning sparks
      for (let i = 0; i < 4; i++) {
        const angle = (t / 120 + i * 90) * (Math.PI / 180);
        const r1 = this.size; const r2 = this.size + 6 + Math.random() * 4;
        ctx.save();
        ctx.strokeStyle = '#ffff00';
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.7;
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.moveTo(this.x + Math.cos(angle) * r1, this.y + Math.sin(angle) * r1);
        ctx.lineTo(this.x + Math.cos(angle) * r2, this.y + Math.sin(angle) * r2);
        ctx.stroke();
        ctx.restore();
      }
    }

    if (this.id === 'plasma') {
      const pulse = (Math.sin(t / 180) + 1) / 2;
      ctx.save();
      ctx.strokeStyle = this.colors.glow;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.5 + pulse * 0.3;
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size + 5 + pulse * 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    if (this.id === 'shadow') {
      ctx.save();
      ctx.globalAlpha = 0.25;
      const dark = ctx.createRadialGradient(this.x, this.y, this.size * 0.8, this.x, this.y, this.size * 2);
      dark.addColorStop(0, '#9b59b6'); dark.addColorStop(1, 'transparent');
      ctx.fillStyle = dark;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (this.id === 'fireball') {
      const flicker = 0.7 + Math.sin(t / 70) * 0.15;
      ctx.save();
      ctx.globalAlpha = 0.28 * flicker;
      ctx.fillStyle = '#ff8c00';
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size * 0.85, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (this.id === 'glacier') {
      const rot = t / 2200;
      for (let i = 0; i < 5; i++) {
        const a = rot + (i / 5) * Math.PI * 2;
        const r = this.size + 9;
        ctx.save();
        ctx.globalAlpha = 0.45;
        ctx.strokeStyle = '#00bfff'; ctx.lineWidth = 2;
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.moveTo(this.x + Math.cos(a) * this.size, this.y + Math.sin(a) * this.size);
        ctx.lineTo(this.x + Math.cos(a) * r, this.y + Math.sin(a) * r);
        ctx.stroke();
        ctx.restore();
      }
    }

    if (this.id === 'crystal') {
      const rot = t / 3500;
      ctx.save();
      ctx.globalAlpha = 0.28;
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1;
      for (let i = 0; i < 6; i++) {
        const a = rot + (i / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x + Math.cos(a) * this.size * 0.88, this.y + Math.sin(a) * this.size * 0.88);
        ctx.stroke();
      }
      ctx.restore();
    }

    if (this.id === 'boulder') {
      // Rock crack lines
      ctx.save();
      ctx.globalAlpha = 0.2;
      ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 1.5;
      const cracks = [[0.3, 0.7, -0.5, -0.3], [-0.6, 0.1, 0.4, -0.7], [0.1, -0.6, -0.4, 0.5]];
      for (const [x1, y1, x2, y2] of cracks) {
        ctx.beginPath();
        ctx.moveTo(this.x + x1 * this.size, this.y + y1 * this.size);
        ctx.lineTo(this.x + x2 * this.size, this.y + y2 * this.size);
        ctx.stroke();
      }
      ctx.restore();
    }
  }
}

/* ───────── Game ───────── */
class Game {
  constructor(canvas, playerData, opponentData, callbacks = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.W = canvas.width;
    this.H = canvas.height;

    this.playerBall = new Ball(playerData, true);
    this.opponentBall = new Ball(opponentData, false);

    // Random starting positions in lower half (anti-gravity floats them up)
    this.playerBall.x = this.W * (0.15 + Math.random() * 0.3);
    this.playerBall.y = this.H * (0.5 + Math.random() * 0.35);
    const a1 = Math.random() * Math.PI * 2;
    const s1 = 4 + Math.random() * 3;
    this.playerBall.vx = Math.cos(a1) * s1;
    this.playerBall.vy = Math.sin(a1) * s1;

    this.opponentBall.x = this.W * (0.55 + Math.random() * 0.3);
    this.opponentBall.y = this.H * (0.5 + Math.random() * 0.35);
    const a2 = Math.random() * Math.PI * 2;
    const s2 = 4 + Math.random() * 3;
    this.opponentBall.vx = Math.cos(a2) * s2;
    this.opponentBall.vy = Math.sin(a2) * s2;

    // Particles & text
    this.particles = [];
    this.floatTexts = [];

    // Screen shake
    this.shakeX = 0; this.shakeY = 0;
    this.shakeIntensity = 0; this.shakeTimer = 0;

    // State machine
    this.state = 'countdown'; // countdown | playing | ended
    this.countdownVal = 3;
    this.countdownTimer = 0;
    this.introTimer = 0;
    this.winner = null;
    this.duration = 0;

    // Callbacks
    this.onHUDUpdate = callbacks.onHUDUpdate || null;
    this.onGameEnd = callbacks.onGameEnd || null;

    this.lastTime = 0;
    this.raf = null;
  }

  start() {
    this.lastTime = performance.now();
    this.raf = requestAnimationFrame(t => this._loop(t));
  }

  stop() {
    if (this.raf) { cancelAnimationFrame(this.raf); this.raf = null; }
  }

  _loop(ts) {
    const dt = Math.min((ts - this.lastTime) / 1000, 0.05);
    this.lastTime = ts;
    this._update(dt);
    this._render();
    this.raf = requestAnimationFrame(t => this._loop(t));
  }

  _update(dt) {
    /* ── Countdown phase ── */
    if (this.state === 'countdown') {
      this.countdownTimer += dt;
      if (this.countdownTimer >= 1) {
        this.countdownTimer -= 1;
        this.countdownVal--;
        if (this.countdownVal <= 0) {
          this.state = 'playing';
          this.introTimer = 1.6;
        }
      }
      return;
    }

    if (this.state === 'ended') return;

    this.duration += dt;

    /* ── Screen shake decay ── */
    if (this.shakeTimer > 0) {
      this.shakeTimer -= dt;
      const intensity = this.shakeIntensity * (this.shakeTimer / 0.35);
      this.shakeX = (Math.random() - 0.5) * intensity;
      this.shakeY = (Math.random() - 0.5) * intensity;
    } else { this.shakeX = 0; this.shakeY = 0; }

    /* ── Intro text ── */
    if (this.introTimer > 0) this.introTimer -= dt;

    /* ── Ball updates ── */
    this.playerBall.update(this.W, this.H, dt);
    this.opponentBall.update(this.W, this.H, dt);

    /* ── Collision ── */
    this._resolveCollision();

    /* ── Particles & texts ── */
    this.particles = this.particles.filter(p => !p.dead);
    this.particles.forEach(p => p.update(dt));
    this.floatTexts = this.floatTexts.filter(t => !t.dead);
    this.floatTexts.forEach(t => t.update(dt));

    /* ── HUD callback ── */
    if (this.onHUDUpdate) {
      this.onHUDUpdate(
        this.playerBall.hp, this.playerBall.maxHp,
        this.opponentBall.hp, this.opponentBall.maxHp,
        this.duration
      );
    }

    /* ── Win check ── */
    if ((this.playerBall.dead || this.opponentBall.dead) && this.state === 'playing') {
      this.state = 'ended';
      this.winner = this.playerBall.dead ? 'opponent' : 'player';
      const dead = this.playerBall.dead ? this.playerBall : this.opponentBall;
      this._deathBurst(dead);
      if (this.onGameEnd) {
        setTimeout(() => {
          this.onGameEnd(this.winner, {
            duration: this.duration,
            playerDamage: this.playerBall.totalDamageDealt,
            opponentDamage: this.opponentBall.totalDamageDealt,
            playerHits: this.playerBall.hitCount,
          });
        }, 2200);
      }
    }
  }

  _resolveCollision() {
    const b1 = this.playerBall;
    const b2 = this.opponentBall;
    if (b1.dead || b2.dead) return;

    const dx = b2.x - b1.x;
    const dy = b2.y - b1.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
    const minDist = b1.size + b2.size;

    if (dist >= minDist) return;

    const nx = dx / dist;
    const ny = dy / dist;

    // Relative velocity along normal
    const relVx = b1.vx - b2.vx;
    const relVy = b1.vy - b2.vy;
    const relVN = relVx * nx + relVy * ny;

    // Only resolve approaching
    if (relVN <= 0) {
      // Still separate overlapping balls
      const overlap = minDist - dist;
      const m1 = b1.size * b1.size;
      const m2 = b2.size * b2.size;
      const tot = m1 + m2;
      b1.x -= nx * overlap * (m2 / tot);
      b1.y -= ny * overlap * (m2 / tot);
      b2.x += nx * overlap * (m1 / tot);
      b2.y += ny * overlap * (m1 / tot);
      return;
    }

    // Mass = size²  (bigger balls hit harder)
    const m1 = b1.size * b1.size;
    const m2 = b2.size * b2.size;
    const tot = m1 + m2;
    const e = 0.68; // restitution
    const impulse = (1 + e) * relVN / tot;

    b1.vx -= impulse * m2 * nx;
    b1.vy -= impulse * m2 * ny;
    b2.vx += impulse * m1 * nx;
    b2.vy += impulse * m1 * ny;

    // Separate
    const overlap = minDist - dist;
    b1.x -= nx * overlap * (m2 / tot);
    b1.y -= ny * overlap * (m2 / tot);
    b2.x += nx * overlap * (m1 / tot);
    b2.y += ny * overlap * (m1 / tot);

    // Damage calc
    const impactSpeed = Math.abs(relVN);
    if (impactSpeed < 0.6) return;

    let dmg1to2 = impactSpeed * b1.damageMult * 9;
    let dmg2to1 = impactSpeed * b2.damageMult * 9;

    // Special damage modifiers
    if (b1.id === 'fireball') dmg1to2 *= 1.3;
    if (b2.id === 'fireball') dmg2to1 *= 1.3;
    if (b1.id === 'plasma') dmg1to2 *= (1 + (1 - b1.hpPct) * 0.8);
    if (b2.id === 'plasma') dmg2to1 *= (1 + (1 - b2.hpPct) * 0.8);

    // Deal damage
    b2.takeDamage(dmg1to2, b1);
    b1.takeDamage(dmg2to1, b2);
    b1.hitCount++;

    // Track damage dealt
    b1.totalDamageDealt += dmg1to2;
    b2.totalDamageDealt += dmg2to1;

    // Lifesteal (Shadow)
    if (b1.id === 'shadow') b1.heal(dmg1to2 * 0.2);
    if (b2.id === 'shadow') b2.heal(dmg2to1 * 0.2);

    // Freeze (Glacier) — freezes opponent; restores to their base speed on expiry
    if (b1.id === 'glacier') { b2.freezeTimer = 1.5; }
    if (b2.id === 'glacier') { b1.freezeTimer = 1.5; }

    // Sound + hit effects
    playBallCollision(impactSpeed);
    const hitX = b1.x + nx * b1.size;
    const hitY = b1.y + ny * b1.size;
    this._hitBurst(hitX, hitY, impactSpeed, b1, b2);

    // Screen shake (Boulder hits harder)
    const shakeStrength = (b1.id === 'boulder' || b2.id === 'boulder') ? 22 : (impactSpeed > 5 ? 10 : 5);
    this.shakeIntensity = shakeStrength;
    this.shakeTimer = 0.35;

    // Floating damage numbers
    this._spawnDmgText(b2.x, b2.y - b2.size - 8, Math.round(dmg1to2));
    this._spawnDmgText(b1.x, b1.y - b1.size - 8, Math.round(dmg2to1));

    // Lifesteal heal text
    if (b1.id === 'shadow' && dmg1to2 > 0) {
      this.floatTexts.push(new FloatingText(b1.x, b1.y + b1.size + 14, `+${Math.round(dmg1to2 * 0.2)}`, '#00ff88'));
    }
  }

  _spawnDmgText(x, y, value) {
    this.floatTexts.push(new FloatingText(x, y, `-${value}`, '#ff4444'));
  }

  _hitBurst(x, y, speed, b1, b2) {
    const count = Math.min(20, Math.floor(8 + speed * 1.5));
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 60 + Math.random() * speed * 18;
      const color = Math.random() < 0.5 ? b1.colors.primary : b2.colors.primary;
      this.particles.push(new Particle(x, y, Math.cos(a) * v, Math.sin(a) * v, color, 0.35 + Math.random() * 0.3, 2.5 + Math.random() * 3));
    }
    // White flash
    this.particles.push(new Particle(x, y, 0, 0, '#ffffff', 0.12, 18));
  }

  _deathBurst(ball) {
    for (let i = 0; i < 50; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 90 + Math.random() * 160;
      this.particles.push(new Particle(ball.x, ball.y, Math.cos(a) * v, Math.sin(a) * v, ball.colors.primary, 0.9 + Math.random(), 4 + Math.random() * 8));
    }
    this.particles.push(new Particle(ball.x, ball.y, 0, 0, '#ffffff', 0.45, 70));
    this.shakeIntensity = 28; this.shakeTimer = 0.5;
  }

  /* ──────── Rendering ──────── */
  _render() {
    const ctx = this.ctx;
    ctx.save();

    if (this.shakeTimer > 0) ctx.translate(this.shakeX, this.shakeY);

    // Background
    ctx.fillStyle = '#080816';
    ctx.fillRect(0, 0, this.W, this.H);

    this._renderGrid(ctx);
    this._renderBorder(ctx);

    // Large death flash particles first
    this.particles.filter(p => p.size > 12).forEach(p => p.render(ctx));

    // Balls
    this.playerBall.render(ctx);
    this.opponentBall.render(ctx);

    // Small hit particles on top
    this.particles.filter(p => p.size <= 12).forEach(p => p.render(ctx));

    // Floating texts
    this.floatTexts.forEach(t => t.render(ctx));

    // Overlays
    if (this.state === 'countdown') this._renderCountdown(ctx);
    if (this.state === 'playing' && this.introTimer > 0) this._renderFight(ctx);
    if (this.state === 'ended') this._renderEndBanner(ctx);

    ctx.restore();
  }

  _renderGrid(ctx) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
    const gs = 50;
    for (let x = 0; x <= this.W; x += gs) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, this.H); ctx.stroke(); }
    for (let y = 0; y <= this.H; y += gs) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.W, y); ctx.stroke(); }
    // Center dashed line
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.setLineDash([12, 12]);
    ctx.beginPath(); ctx.moveTo(this.W / 2, 0); ctx.lineTo(this.W / 2, this.H); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  _renderBorder(ctx) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    ctx.strokeRect(4, 4, this.W - 8, this.H - 8);
    ctx.restore();
  }

  _renderCountdown(ctx) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, this.W, this.H);

    const display = Math.max(1, Math.ceil(this.countdownVal - this.countdownTimer));
    const scale = 1 + (1 - this.countdownTimer) * 0.4;

    ctx.textAlign = 'center';
    ctx.font = `bold ${Math.round(90 * scale)}px "Segoe UI", sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#555566';
    ctx.lineWidth = 3;
    ctx.shadowBlur = 0;
    ctx.strokeText(display, this.W / 2, this.H / 2 + 28);
    ctx.fillText(display, this.W / 2, this.H / 2 + 28);

    ctx.font = 'bold 22px "Segoe UI", sans-serif';
    ctx.fillStyle = '#aaaaaa';
    ctx.fillText('GET READY!', this.W / 2, this.H / 2 - 50);
    ctx.restore();
  }

  _renderFight(ctx) {
    const p = 1 - this.introTimer / 1.6;
    const alpha = p < 0.25 ? p / 0.25 : p > 0.7 ? (1 - p) / 0.3 : 1;
    const scale = 0.7 + p * 0.6;

    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.textAlign = 'center';
    ctx.font = `bold ${Math.round(78 * scale)}px "Segoe UI", sans-serif`;
    ctx.fillStyle = '#ddddee';
    ctx.strokeStyle = '#444455';
    ctx.lineWidth = 4;
    ctx.shadowBlur = 0;
    ctx.strokeText('FIGHT!', this.W / 2, this.H / 2 + 24);
    ctx.fillText('FIGHT!', this.W / 2, this.H / 2 + 24);
    ctx.restore();
  }

  _renderEndBanner(ctx) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.62)';
    ctx.fillRect(0, 0, this.W, this.H);

    const isWin = this.winner === 'player';
    const text = isWin ? 'VICTORY!' : 'DEFEAT!';
    const color = isWin ? '#ddddaa' : '#cc6666';

    ctx.textAlign = 'center';
    ctx.font = 'bold 70px "Segoe UI", sans-serif';
    ctx.fillStyle = color;
    ctx.strokeStyle = isWin ? '#665500' : '#661111';
    ctx.lineWidth = 4;
    ctx.shadowBlur = 0;
    ctx.strokeText(text, this.W / 2, this.H / 2 + 22);
    ctx.fillText(text, this.W / 2, this.H / 2 + 22);
    ctx.restore();
  }
}

window.Game = Game;
