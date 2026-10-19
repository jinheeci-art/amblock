// 암 라이벌 화면 — 탄창이 비면 R을 눌러 영어 문제를 맞혀야 다시 쏠 수 있어요!
(function () {
  const { RIVAL_WEAPONS: W, RIVAL_ORDER, RIVALS: M, PELLET_OFFSETS } = DEFS;
  const RAD = 18;
  let C, S, P;

  function hitWall(x, y, r) {
    if (x < r || y < r || x > M.w - r || y > M.h - r) return true;
    return M.walls.some(([wx, wy, ww, wh]) => x + r > wx && x - r < wx + ww && y + r > wy && y - r < wy + wh);
  }
  function owned() { return RIVAL_ORDER.filter((k) => C.me.weapons.rivals.includes(k)); }

  function buildHud() {
    C.hud.innerHTML = `<div class="hud-top" id="rTop"></div>
      <div class="hud-box" id="rBoard" style="left:10px;top:56px"></div>
      <div class="hud-box" id="rGun" style="right:12px;bottom:46px;text-align:right"></div>
      <div class="hud-center" id="rCenter"></div>
      <div class="feed" id="rFeed"></div>
      <div class="keys">WASD 이동 · 마우스 조준/클릭 발사 · R 영어문제로 재장전 · 숫자키 무기 바꾸기</div>`;
  }
  function feed(text) {
    const f = C.hud.querySelector('#rFeed');
    const d = document.createElement('div'); d.textContent = text; f.prepend(d);
    while (f.children.length > 5) f.lastChild.remove();
    setTimeout(() => d.remove(), 5000);
  }

  function reload() {
    if (S.reloading || !S.alive) return;
    if (S.ammo[S.w] >= W[S.w].mag) return;
    S.reloading = true;
    C.quiz('rivals').then((ok) => {
      if (!S) return;
      S.reloading = false;
      if (ok) { S.ammo[S.w] = W[S.w].mag; feed('🔄 재장전 완료!'); }
      else if (ok === false) feed('❌ 틀려서 재장전 실패! 다시 R');
    });
  }

  function spawnBullets(x, y, a, wk, owner, mine) {
    const w = W[wk];
    for (let i = 0; i < w.pellets; i++) {
      const ang = a + (PELLET_OFFSETS[i] || 0) * w.spread + (w.pellets === 1 ? (Math.random() - 0.5) * w.spread : 0);
      S.bullets.push({ x, y, vx: Math.cos(ang) * w.speed, vy: Math.sin(ang) * w.speed, life: w.range / w.speed, w: wk, owner, mine });
    }
  }

  function shoot() {
    if (!S.alive || S.phase !== 'play') return;
    const w = W[S.w];
    const now = performance.now() / 1000;
    if (now - S.lastShot < w.rate) return;
    if (S.ammo[S.w] <= 0) { if (!S.reloading) { feed('탄창이 비었어요! R을 눌러 영어 문제를 풀어요'); reload(); } return; }
    S.lastShot = now;
    S.ammo[S.w]--;
    const bx = P.x + Math.cos(P.a) * 26, by = P.y + Math.sin(P.a) * 26;
    spawnBullets(bx, by, P.a, S.w, C.me.id, true);
    C.send('shoot', { x: bx, y: by, a: P.a, w: S.w });
  }

  function explode(b) {
    const w = W[b.w];
    S.booms.push({ x: b.x, y: b.y, r: w.splash, t: 0.4 });
    if (!b.mine) return;
    for (const p of S.players) {
      if (p[0] === C.me.id || !p[8]) continue;
      const d = S.disp[p[0]];
      if (d && Math.hypot(d.x - b.x, d.y - b.y) < w.splash + RAD) C.send('hit', { target: p[0], w: b.w });
    }
  }

  window.GAMES.rivals = {
    start(ctx) {
      C = ctx;
      S = { players: [], bullets: [], booms: [], disp: {}, ammo: Object.assign({}, ctx.init.ammo), w: 'water', alive: true, phase: ctx.init.phase,
        lastShot: 0, sendT: 0, reloading: false, hurt: 0, tm: 0, deadT: 0 };
      P = { x: ctx.init.x, y: ctx.init.y, a: 0 };
      buildHud();
    },
    stop() { S = null; },
    onMe() { for (const k of owned()) if (S.ammo[k] == null) S.ammo[k] = W[k].mag; },
    msg(t, d) {
      if (t === 's') {
        S.players = d.p; S.tm = d.tm; S.phase = d.ph;
        const me = d.p.find((p) => p[0] === C.me.id);
        if (me) { S.alive = !!me[8]; S.hp = me[7]; }
      } else if (t === 'shot') { if (d.id !== C.me.id) spawnBullets(d.x, d.y, d.a, d.w, d.id, false); }
      else if (t === 'ammo') { Object.assign(S.ammo, d); }
      else if (t === 'dmg') { if (d.id === C.me.id) S.hurt = 0.35; }
      else if (t === 'kill') {
        feed(`${d.killer} ${W[d.w].emoji} ${d.victim}`);
        if (d.id === C.me.id) { S.alive = false; S.deadT = M.respawn; }
      } else if (t === 'respawn') { P.x = d.x; P.y = d.y; S.alive = true; Object.assign(S.ammo, d.ammo); }
      else if (t === 'end') C.hud.querySelector('#rCenter').innerHTML = d.winner ? `🏆 ${esc(d.winner)} 승리!<small>곧 다음 판이 시작돼요</small>` : '⏰ 시간 끝!<small>곧 다음 판이 시작돼요</small>';
      else if (t === 'round') C.hud.querySelector('#rCenter').innerHTML = '';
    },
    key(code) {
      if (code === 'KeyR') reload();
      const n = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6'].indexOf(code);
      if (n >= 0) {
        const k = RIVAL_ORDER[n];
        if (C.me.weapons.rivals.includes(k)) { S.w = k; if (S.ammo[k] == null) S.ammo[k] = W[k].mag; }
        else feed(`${W[k].emoji} ${W[k].name}은(는) 상점에서 Ambox ${W[k].price}개로 살 수 있어요`);
      }
    },
    click(x, y, button) { if (button === 0) shoot(); },
    update(dt) {
      if (!S) return;
      S.hurt = Math.max(0, S.hurt - dt);
      S.deadT = Math.max(0, S.deadT - dt);
      const K = C.keys;
      P.a = Math.atan2(C.mouse.y - C.h / 2, C.mouse.x - C.w / 2);
      if (S.alive) {
        const dx = (K.has('KeyD') || K.has('ArrowRight') ? 1 : 0) - (K.has('KeyA') || K.has('ArrowLeft') ? 1 : 0);
        const dy = (K.has('KeyS') || K.has('ArrowDown') ? 1 : 0) - (K.has('KeyW') || K.has('ArrowUp') ? 1 : 0);
        if (dx || dy) {
          const l = Math.hypot(dx, dy), sp = 240 * dt;
          const nx = P.x + (dx / l) * sp, ny = P.y + (dy / l) * sp;
          if (!hitWall(nx, P.y, RAD)) P.x = nx;
          if (!hitWall(P.x, ny, RAD)) P.y = ny;
        }
        if (C.mouse.down && !Amblox.Quiz.open && W[S.w].rate < 0.5) shoot(); // 연사 무기는 꾹 누르기
      }
      S.sendT -= dt;
      if (S.sendT <= 0) { S.sendT = 0.05; C.send('pos', { x: P.x, y: P.y, a: P.a, w: S.w }); }
      for (const p of S.players) {
        const d = S.disp[p[0]] || (S.disp[p[0]] = { x: p[3], y: p[4] });
        if (Math.hypot(p[3] - d.x, p[4] - d.y) > 200) { d.x = p[3]; d.y = p[4]; }
        d.x += (p[3] - d.x) * Math.min(1, dt * 15); d.y += (p[4] - d.y) * Math.min(1, dt * 15);
      }
      // 총알
      for (const b of S.bullets) {
        b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
        if (hitWall(b.x, b.y, 1)) { b.life = 0; if (W[b.w].splash) explode(b); continue; }
        if (b.life <= 0) { if (W[b.w].splash) explode(b); continue; }
        for (const p of S.players) {
          if (p[0] === b.owner || !p[8]) continue;
          const d = p[0] === C.me.id ? P : S.disp[p[0]];
          if (d && Math.hypot(d.x - b.x, d.y - b.y) < RAD + 4) {
            b.life = 0;
            if (W[b.w].splash) explode(b);
            else if (b.mine) C.send('hit', { target: p[0], w: b.w });
            break;
          }
        }
      }
      S.bullets = S.bullets.filter((b) => b.life > 0);
      S.booms.forEach((b) => (b.t -= dt)); S.booms = S.booms.filter((b) => b.t > 0);
      // HUD
      C.hud.querySelector('#rTop').innerHTML = `⏱ ${Math.floor(S.tm / 60)}:${String(S.tm % 60).padStart(2, '0')}<br><small>${M.killsToWin}킬 먼저 하면 승리!</small>`;
      C.hud.querySelector('#rBoard').innerHTML = '🏆 점수<br>' + S.players.slice().sort((a, b) => b[9] - a[9])
        .map((p) => `${p[0] === C.me.id ? '⭐' : ''}${esc(p[1])} ${p[9]}킬 ${p[10]}데스`).join('<br>');
      const w = W[S.w];
      C.hud.querySelector('#rGun').innerHTML = owned().map((k) => `<span style="opacity:${k === S.w ? 1 : 0.5}">[${RIVAL_ORDER.indexOf(k) + 1}]${W[k].emoji}</span>`).join(' ') +
        `<br><b style="font-size:22px">${w.emoji} ${w.name}</b><br>🔸 ${S.ammo[S.w] || 0} / ${w.mag} ${S.ammo[S.w] <= 0 ? '<b style="color:#fca5a5">R: 재장전!</b>' : ''}` +
        (S.alive ? '' : `<br><b style="color:#fca5a5">💀 ${Math.ceil(S.deadT)}초 뒤 부활</b>`);
    },
    draw(g, w, h) {
      const D = C.Draw;
      const camX = P.x - w / 2, camY = P.y - h / 2;
      g.fillStyle = '#1f2937'; g.fillRect(0, 0, w, h);
      g.save(); g.translate(-camX, -camY);
      g.fillStyle = '#e5e7eb'; g.fillRect(0, 0, M.w, M.h);
      g.strokeStyle = '#d1d5db'; g.lineWidth = 1;
      for (let x = 0; x <= M.w; x += 50) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, M.h); g.stroke(); }
      for (let y = 0; y <= M.h; y += 50) { g.beginPath(); g.moveTo(0, y); g.lineTo(M.w, y); g.stroke(); }
      for (const [x, y, ww, hh] of M.walls) {
        g.fillStyle = '#b45309'; D.rr(g, x, y, ww, hh, 6); g.fill();
        g.strokeStyle = '#78350f'; g.lineWidth = 3; g.strokeRect(x + 4, y + 4, ww - 8, hh - 8);
      }
      for (const b of S.bullets) {
        g.fillStyle = W[b.w].color; g.beginPath(); g.arc(b.x, b.y, b.w === 'rocket' ? 7 : 4, 0, 7); g.fill();
      }
      for (const b of S.booms) { g.fillStyle = `rgba(251,146,60,${b.t * 2})`; g.beginPath(); g.arc(b.x, b.y, b.r * (1.2 - b.t), 0, 7); g.fill(); }
      for (const p of S.players) {
        if (!p[8]) continue;
        const mine = p[0] === C.me.id;
        const d = mine ? P : S.disp[p[0]];
        if (!d) continue;
        const a = mine ? P.a : p[5];
        g.strokeStyle = '#374151'; g.lineWidth = 7; g.beginPath(); g.moveTo(d.x, d.y); g.lineTo(d.x + Math.cos(a) * 30, d.y + Math.sin(a) * 30); g.stroke();
        D.avatar(g, d.x, d.y + 2, 15, p[2], Math.cos(a) >= 0 ? 1 : -1);
        D.name(g, d.x, d.y - 34, `${W[p[6]] ? W[p[6]].emoji : ''} ${p[1]}`, mine ? '#fde047' : '#fff');
        D.bar(g, d.x, d.y - 30, 40, 5, p[7] / M.maxHp, mine ? '#22c55e' : '#ef4444');
      }
      g.restore();
      // 조준점
      g.strokeStyle = '#ef4444'; g.lineWidth = 2;
      g.beginPath(); g.arc(C.mouse.x, C.mouse.y, 10, 0, 7); g.moveTo(C.mouse.x - 15, C.mouse.y); g.lineTo(C.mouse.x + 15, C.mouse.y);
      g.moveTo(C.mouse.x, C.mouse.y - 15); g.lineTo(C.mouse.x, C.mouse.y + 15); g.stroke();
      if (S.hurt > 0) { g.fillStyle = `rgba(239,68,68,${S.hurt})`; g.fillRect(0, 0, w, h); }
      if (!S.alive) { g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(0, 0, w, h); }
    },
  };
})();
