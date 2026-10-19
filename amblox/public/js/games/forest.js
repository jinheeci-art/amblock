// 99나이트 앳 더 영어 포레스트 화면
(function () {
  const { FOREST, FOREST_CLASSES } = DEFS;
  const [FX, FY] = FOREST.fire;
  let C, S, P, dark;

  function pickClass() {
    const box = document.createElement('div');
    box.className = 'picker';
    box.innerHTML = `<div class="picker-box"><h2>🌲 직업을 골라요! <small style="color:#16a34a">Amblox에서는 모든 직업이 무료!!!</small></h2>
      <p>밤이 되면 광신도가 나타나요. <b>Q</b>를 눌러 영어 문제를 맞히면 무기가 충전돼요!</p>
      <div class="cls-grid">${Object.entries(FOREST_CLASSES).map(([k, c]) =>
        `<button class="cls" data-c="${k}"><b>${c.emoji} ${c.name}</b><span class="free">무료</span><p>${c.desc}</p></button>`).join('')}</div></div>`;
    C.hud.appendChild(box);
    box.querySelectorAll('[data-c]').forEach((b) => (b.onclick = () => {
      C.send('class', { cls: b.dataset.c });
      S.cls = b.dataset.c;
      box.remove();
      S.picking = false;
    }));
  }

  function buildHud() {
    C.hud.innerHTML = `<div class="hud-top" id="fTop"></div>
      <div class="hud-box" id="fStat" style="left:10px;top:56px"></div>
      <div class="hud-center" id="fCenter"></div>
      <div class="feed" id="fFeed"></div>
      <div class="keys">WASD 이동 · E 나무베기/열매/불에 넣기 · F 먹기 · Q 영어문제로 무기 충전 · 클릭/스페이스 공격</div>`;
  }
  function feed(text) {
    const f = C.hud.querySelector('#fFeed');
    const d = document.createElement('div'); d.textContent = text; f.prepend(d);
    setTimeout(() => d.remove(), 4000);
  }
  function center(text, ms) {
    const el = C.hud.querySelector('#fCenter');
    el.innerHTML = text;
    clearTimeout(S.centerT);
    if (ms) S.centerT = setTimeout(() => { if (S) el.innerHTML = ''; }, ms);
  }

  function attack() {
    if (!S.mine || !S.mine.alive || S.picking) return;
    const dx = C.mouse.x - C.w / 2, dy = C.mouse.y - C.h / 2;
    C.send('attack', { dx, dy });
  }

  window.GAMES.forest = {
    start(ctx) {
      C = ctx;
      S = { ph: 'day', tm: 45, n: 0, f: 70, fr: 200, players: [], cult: [], trees: [], bushes: [], mine: null, sendT: 0, swings: [], fx: [], picking: true, cls: 'camper', t: 0, hurt: 0, disp: {} };
      P = { x: ctx.init.x, y: ctx.init.y, face: 1 };
      dark = document.createElement('canvas');
      buildHud();
      pickClass();
      center('☀️ 낮이에요! 나무를 모아 모닥불을 지켜요', 3000);
    },
    stop() { S = null; },
    msg(t, d) {
      if (t === 's') {
        if (d.over) return;
        Object.assign(S, { ph: d.ph, tm: d.tm, n: d.n, f: d.f, fr: d.fr, players: d.p, cult: d.c });
        if (d.trees) { S.trees = d.trees; S.bushes = d.bushes; }
        const mine = d.p.find((p) => p.id === C.me.id);
        if (mine && (!S.mine || (!S.mine.alive && mine.alive))) { P.x = mine.x; P.y = mine.y; }
        S.mine = mine;
      } else if (t === 'phase') {
        if (d.phase === 'night') center(`🌙 ${d.night}번째 밤!<small>광신도가 온다! Q로 무기를 충전해요</small>`, 3500);
        else center(`☀️ ${d.night}번째 밤을 버텼어요!<small>나무와 열매를 모아요</small>`, 3500);
      } else if (t === 'msg') feed(d);
      else if (t === 'chop') S.fx.push({ x: d.x, y: d.y, e: '🪵', t: 0.7 });
      else if (t === 'swing') S.swings.push({ id: d.id, a: d.a, r: d.r, t: 0.25 });
      else if (t === 'kill') { S.fx.push({ x: d.x, y: d.y, e: '💨', t: 1 }); feed(`⚔️ ${d.by} 님이 광신도를 물리쳤어요!`); }
      else if (t === 'hurt') S.hurt = 0.4;
      else if (t === 'dead') feed(`💀 ${d.nick} 님이 쓰러졌어요... (아침에 부활)`);
      else if (t === 'over') center(d.win ? `🎉 99번의 밤을 모두 버텼어요!!!` : `💀 모두 쓰러졌어요...<small>${d.night}번째 밤까지 버텼어요! 곧 다시 시작해요</small>`);
      else if (t === 'restart') { center('🌲 새 게임 시작!', 2500); S.mine = null; }
    },
    key(code) {
      if (S.picking) return;
      if (code === 'KeyE') C.send('act');
      if (code === 'KeyF') C.send('eat');
      if (code === 'KeyQ') C.quiz('forest').then((ok) => { if (ok) feed(`⚔️ 무기 충전! (+${S.cls === 'blacksmith' ? 8 : 5})`); });
      if (code === 'Space') attack();
    },
    click() { attack(); },
    update(dt) {
      if (!S) return;
      S.t += dt; S.hurt = Math.max(0, S.hurt - dt);
      S.swings.forEach((s) => (s.t -= dt)); S.swings = S.swings.filter((s) => s.t > 0);
      S.fx.forEach((s) => (s.t -= dt)); S.fx = S.fx.filter((s) => s.t > 0);
      const m = S.mine;
      if (m && m.alive && !S.picking) {
        const K = C.keys;
        let dx = (K.has('KeyD') || K.has('ArrowRight') ? 1 : 0) - (K.has('KeyA') || K.has('ArrowLeft') ? 1 : 0);
        let dy = (K.has('KeyS') || K.has('ArrowDown') ? 1 : 0) - (K.has('KeyW') || K.has('ArrowUp') ? 1 : 0);
        if (dx || dy) {
          const l = Math.hypot(dx, dy), sp = 210 * (m.cls === 'scavenger' ? 1.25 : 1);
          P.x = Math.max(0, Math.min(FOREST.w, P.x + (dx / l) * sp * dt));
          P.y = Math.max(0, Math.min(FOREST.h, P.y + (dy / l) * sp * dt));
          if (dx) P.face = dx;
        }
      }
      S.sendT -= dt;
      if (S.sendT <= 0) { S.sendT = 0.07; C.send('pos', { x: P.x, y: P.y }); }
      // 다른 사람 위치 부드럽게
      for (const p of S.players) {
        const d = S.disp[p.id] || (S.disp[p.id] = { x: p.x, y: p.y });
        d.x += (p.x - d.x) * Math.min(1, dt * 12); d.y += (p.y - d.y) * Math.min(1, dt * 12);
      }
      const top = C.hud.querySelector('#fTop');
      top.innerHTML = (S.ph === 'day' ? `☀️ 낮 · ${S.n}번째 밤을 버팀` : `🌙 ${S.n}번째 밤`) + ` · ⏱ ${S.tm}초<br><small>목표: 99번째 밤까지 살아남기!</small>`;
      if (m) {
        C.hud.querySelector('#fStat').innerHTML = `${FOREST_CLASSES[m.cls].emoji} <b>${FOREST_CLASSES[m.cls].name}</b><br>
          ❤️ 체력 ${m.hp}/${m.mhp}<br>🍖 배고픔 ${m.food}/100<br>🪵 나무 ${m.wood}/10<br>🫐 먹을 것 ${m.ber}개<br>
          ⚔️ 무기 충전 <b>${m.ch}</b>번 ${m.ch === 0 ? '(Q!)' : ''}<br>🔥 모닥불 ${S.f}%<br>👊 처치 ${m.k}
          ${m.alive ? '' : '<br><b style="color:#fca5a5">💀 쓰러짐 — 아침에 부활해요</b>'}`;
      }
    },
    draw(g, w, h) {
      const D = C.Draw;
      const camX = P.x - w / 2, camY = P.y - h / 2;
      g.fillStyle = '#4a7c3a'; g.fillRect(0, 0, w, h);
      g.save(); g.translate(-camX, -camY);
      // 풀 무늬
      g.fillStyle = '#558b45';
      const sx = Math.floor(camX / 80) * 80, sy = Math.floor(camY / 80) * 80;
      for (let x = sx; x < camX + w + 80; x += 80) for (let y = sy; y < camY + h + 80; y += 80) {
        const r = Math.abs(Math.sin(x * 12.9898 + y * 78.233)) * 43758.5453 % 1;
        g.fillRect(x + r * 60, y + ((r * 7) % 1) * 60, 6, 10);
      }
      g.strokeStyle = '#2d4a24'; g.lineWidth = 10; g.strokeRect(0, 0, FOREST.w, FOREST.h);
      // 연못
      g.fillStyle = '#3b82f6'; g.beginPath(); g.ellipse(FOREST.pond[0], FOREST.pond[1], FOREST.pond[2], FOREST.pond[2] * 0.7, 0, 0, 7); g.fill();
      g.fillStyle = '#fff'; g.font = 'bold 13px sans-serif'; g.textAlign = 'center'; g.fillText('🐟 연못', FOREST.pond[0], FOREST.pond[1]);
      // 덤불
      for (const b of S.bushes) {
        g.fillStyle = '#2f6b2a'; g.beginPath(); g.arc(b.x, b.y, 22, 0, 7); g.fill();
        g.fillStyle = '#7c3aed';
        for (let i = 0; i < b.b; i++) { g.beginPath(); g.arc(b.x - 10 + i * 10, b.y - 4 + (i % 2) * 8, 5, 0, 7); g.fill(); }
      }
      // 모닥불
      g.fillStyle = '#6b4423'; g.fillRect(FX - 26, FY + 4, 52, 10); g.fillRect(FX - 6, FY - 8, 12, 26);
      const fs = 20 + S.f * 0.25;
      g.fillStyle = '#f97316'; g.beginPath(); g.ellipse(FX, FY - fs * 0.3, fs * 0.6, fs + Math.sin(S.t * 10) * 3, 0, 0, 7); g.fill();
      g.fillStyle = '#fde047'; g.beginPath(); g.ellipse(FX, FY - fs * 0.1, fs * 0.3, fs * 0.6, 0, 0, 7); g.fill();
      // 정렬해서 그리기 (아래쪽이 앞)
      const things = [];
      for (const t of S.trees) things.push({ y: t.y, f: () => {
        g.fillStyle = '#6b4423'; g.fillRect(t.x - 7, t.y - 10, 14, 24);
        if (t.wood > 0) {
          g.fillStyle = '#1f5f2b'; g.beginPath(); g.moveTo(t.x, t.y - 80); g.lineTo(t.x - 34, t.y - 4); g.lineTo(t.x + 34, t.y - 4); g.fill();
          g.fillStyle = '#2a7a38'; g.beginPath(); g.moveTo(t.x, t.y - 95); g.lineTo(t.x - 25, t.y - 40); g.lineTo(t.x + 25, t.y - 40); g.fill();
        }
      } });
      for (const p of S.players) {
        const d = p.id === C.me.id ? P : S.disp[p.id] || p;
        things.push({ y: d.y, f: () => {
          g.globalAlpha = p.alive ? 1 : 0.35;
          D.avatar(g, d.x, d.y - 10, 16, p.color, p.id === C.me.id ? P.face : 1);
          D.name(g, d.x, d.y - 46, `${FOREST_CLASSES[p.cls].emoji} ${p.nick}`, p.id === C.me.id ? '#fde047' : '#fff');
          D.bar(g, d.x, d.y - 42, 36, 4, p.hp / p.mhp, '#ef4444');
          g.globalAlpha = 1;
        } });
      }
      for (const [, x, y, hp] of S.cult) things.push({ y, f: () => {
        g.fillStyle = '#7f1d1d'; g.beginPath(); g.moveTo(x, y - 40); g.lineTo(x - 18, y + 10); g.lineTo(x + 18, y + 10); g.fill();
        g.fillStyle = '#450a0a'; g.beginPath(); g.arc(x, y - 30, 12, 0, 7); g.fill();
        g.fillStyle = '#facc15'; g.fillRect(x - 6, y - 32, 4, 3); g.fillRect(x + 2, y - 32, 4, 3);
        D.bar(g, x, y - 50, 34, 4, hp / 100, '#f87171');
        D.name(g, x, y - 55, '광신도', '#fca5a5');
      } });
      things.sort((a, b) => a.y - b.y).forEach((t) => t.f());
      // 공격 효과
      for (const s of S.swings) {
        const p = s.id === C.me.id ? P : S.disp[s.id];
        if (!p) continue;
        g.strokeStyle = `rgba(255,255,255,${s.t * 4})`; g.lineWidth = 6;
        g.beginPath(); g.arc(p.x, p.y - 10, s.r * 0.7, s.a - 0.7, s.a + 0.7); g.stroke();
      }
      g.font = '26px sans-serif';
      for (const f of S.fx) g.fillText(f.e, f.x, f.y - 40 - (1 - f.t) * 30);
      g.restore();
      // 밤 어둠 (모닥불과 플레이어 주변만 밝아요)
      const nightA = S.ph === 'night' ? 0.82 : 0;
      if (nightA > 0) {
        if (dark.width !== w || dark.height !== h) { dark.width = w; dark.height = h; }
        const dg = dark.getContext('2d');
        dg.globalCompositeOperation = 'source-over';
        dg.clearRect(0, 0, w, h);
        dg.fillStyle = `rgba(5,10,35,${nightA})`; dg.fillRect(0, 0, w, h);
        dg.globalCompositeOperation = 'destination-out';
        const hole = (x, y, r) => {
          const gr = dg.createRadialGradient(x, y, r * 0.5, x, y, r);
          gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
          dg.fillStyle = gr; dg.beginPath(); dg.arc(x, y, r, 0, 7); dg.fill();
        };
        hole(FX - camX, FY - camY, S.fr + Math.sin(S.t * 8) * 4);
        hole(w / 2, h / 2, 110);
        g.drawImage(dark, 0, 0, w, h);
      }
      if (S.hurt > 0) { g.fillStyle = `rgba(239,68,68,${S.hurt})`; g.fillRect(0, 0, w, h); }
      // 미니맵
      const mm = 130, mx = w - mm - 12, my = h - mm - 50, sc = mm / FOREST.w;
      g.fillStyle = 'rgba(20,40,20,.85)'; g.fillRect(mx, my, mm, mm);
      g.fillStyle = '#f97316'; g.beginPath(); g.arc(mx + FX * sc, my + FY * sc, 4, 0, 7); g.fill();
      g.fillStyle = '#ef4444'; for (const c of S.cult) g.fillRect(mx + c[1] * sc - 1, my + c[2] * sc - 1, 3, 3);
      for (const p of S.players) { g.fillStyle = p.id === C.me.id ? '#fde047' : '#fff'; g.fillRect(mx + (p.id === C.me.id ? P.x : p.x) * sc - 2, my + (p.id === C.me.id ? P.y : p.y) * sc - 2, 4, 4); }
    },
  };
})();
