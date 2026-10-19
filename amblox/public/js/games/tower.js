// 영어 초보는 못 깨는 무기 타워 화면
(function () {
  const { TOWER_WEAPONS, genTower } = DEFS;
  const WKEYS = Object.keys(TOWER_WEAPONS);
  const PW = 26, PH = 40, GRAV = 1900, JUMP = 770, SPEED = 270;
  let C, S, P, T;

  function buildTower(seed) {
    T = genTower(seed);
    T.time = 0;
    resetMe('');
  }
  function resetMe(msg) {
    P = Object.assign(P || {}, {
      x: T.w / 2 + (Math.random() * 200 - 100), y: T.startY, vx: 0, vy: 0, ground: null, face: 1,
      opened: new Set(), inQuiz: false, freeze: 0, stun: 0, reverse: 0, honey: 0, slide: 0, drop: 0, immune: 0,
    });
    if (msg) flash(msg);
  }
  function flash(text, color) { S.flash = { text, color: color || '#fff', t: 2 }; }

  function platX(p) { return p.t === 'move' ? p.x + Math.sin(T.time * 1.2 + p.ph) * 60 : p.x; }

  function weaponsHtml() {
    const owned = C.me.weapons.tower;
    if (!owned.length) return `<div class="hud-box pe" style="left:10px;bottom:10px">무기가 없어요 🥲<br>Ambox 12개로 무기를 살 수 있어요!
      <button class="btn small yellow" id="tShop">🛒 상점</button></div>`;
    return `<div class="hud-box" style="left:10px;bottom:10px">🗡️ 무기 (숫자키)<br>${owned.map((k) => {
      const i = WKEYS.indexOf(k) + 1;
      return `<span style="margin-right:8px">[${i}] ${TOWER_WEAPONS[k].emoji} ${TOWER_WEAPONS[k].name}</span>`;
    }).join('<br>')}<div id="tCd"></div></div>`;
  }
  function buildHud() {
    C.hud.innerHTML = `<div class="hud-top" id="tTop"></div>
      <div class="hud-center" id="tCenter"></div>
      ${weaponsHtml()}
      <div class="feed" id="tFeed"></div>
      <div class="keys">← → 이동 · 스페이스/↑ 점프 · 숫자키 무기 · ❓게이트에 머리를 박으면 문제!</div>`;
    const b = C.hud.querySelector('#tShop');
    if (b) b.onclick = () => Amblox.openShop();
  }
  function feed(text) {
    const f = C.hud.querySelector('#tFeed');
    const d = document.createElement('div'); d.textContent = text; f.prepend(d);
    setTimeout(() => d.remove(), 4000);
  }

  async function gateQuiz(gate) {
    P.inQuiz = true; P.vx = 0; P.vy = 0;
    const ok = await C.quiz('tower', { noClose: true });
    P.inQuiz = false;
    if (!S) return;
    if (ok) {
      P.opened.add(gate.g);
      P.y = gate.y; P.vy = 0;
      flash(`⭕ 정답! 게이트 ${gate.g + 1} 통과!`, '#86efac');
    } else {
      resetMe('❌ 틀렸어요! 처음으로 돌아가요...');
    }
  }

  function physics(dt) {
    T.time += dt;
    for (const k of ['freeze', 'stun', 'reverse', 'honey', 'slide', 'drop', 'immune']) P[k] = Math.max(0, P[k] - dt);
    if (P.inQuiz) return;
    const K = C.keys;
    let dir = (K.has('ArrowRight') || K.has('KeyD') ? 1 : 0) - (K.has('ArrowLeft') || K.has('KeyA') ? 1 : 0);
    if (P.reverse > 0) dir = -dir;
    const canMove = P.freeze <= 0 && P.stun <= 0;
    if (P.slide > 0) P.vx *= Math.pow(0.15, dt);
    else P.vx = canMove ? dir * SPEED * (P.honey > 0 ? 0.4 : 1) : 0;
    if (dir) P.face = dir;
    if (canMove && P.ground && (K.has('Space') || K.has('ArrowUp') || K.has('KeyW'))) {
      P.vy = -JUMP * (P.honey > 0 ? 0.75 : 1); P.ground = null;
    }
    // 움직이는 발판 위에 있으면 같이 움직여요
    if (P.ground && P.ground.t === 'move') {
      const now = platX(P.ground);
      P.x += now - (P.ground._lastX != null ? P.ground._lastX : now);
    }
    for (const p of T.plats) if (p.t === 'move') p._lastX = platX(p);

    P.vy = Math.min(1400, P.vy + GRAV * dt);
    const prevY = P.y, prevTop = P.y - PH;
    P.x = Math.max(PW / 2, Math.min(T.w - PW / 2, P.x + P.vx * dt));
    P.y += P.vy * dt;
    P.ground = null;
    for (const p of T.plats) {
      const px = platX(p);
      const overlapX = P.x + PW / 2 > px && P.x - PW / 2 < px + p.w;
      if (!overlapX) continue;
      if (p.t === 'kill') {
        if (P.y > p.y && P.y - PH < p.y + p.h) { resetMe('🔥 위험 발판! 처음으로...'); return; }
        continue;
      }
      // 아래에서 게이트에 머리 쿵!
      if (p.t === 'gate' && !P.opened.has(p.g) && P.vy < 0 && prevTop >= p.y + p.h - 1 && P.y - PH < p.y + p.h) {
        P.y = p.y + p.h + PH; P.vy = 0;
        gateQuiz(p);
        return;
      }
      // 위에서 발판에 착지
      if (P.vy >= 0 && P.drop <= 0 && prevY <= p.y + 1 && P.y >= p.y) {
        P.y = p.y; P.vy = 0; P.ground = p;
        if (p.t === 'goal' && S.phase === 'play' && !S.won) { S.won = true; C.send('win', { goalY: T.goalY }); }
      }
    }
    // 바나나 밟기
    if (P.immune <= 0) {
      for (const b of S.bananas) {
        if (Math.abs(b.x - P.x) < 22 && Math.abs(b.y - P.y) < 12) {
          P.slide = 0.9; P.vx = (P.face || 1) * 750; P.stun = 0.9; P.immune = 1;
          C.send('banana', { id: b.id });
          flash('🍌 미끄덩!');
          break;
        }
      }
    }
  }

  window.GAMES.tower = {
    start(ctx) {
      C = ctx;
      S = { phase: ctx.init.phase, timer: ctx.init.timer, bananas: ctx.init.bananas || [], others: [], fx: [], sendT: 0, cd: 0, won: false, flash: null };
      P = null;
      buildTower(ctx.init.seed);
      buildHud();
    },
    stop() { S = null; },
    onMe() { buildHud(); },
    msg(t, d) {
      if (t === 's') { S.others = d.p.filter((p) => p[0] !== C.me.id); S.phase = d.ph; S.timer = d.tm; }
      else if (t === 'start') { S.won = false; buildTower(d.seed); flash('🏁 시작! 꼭대기까지 올라가요!', '#fde047'); }
      else if (t === 'lobby') { S.won = false; buildTower(d.seed); }
      else if (t === 'end') {
        C.hud.querySelector('#tCenter').innerHTML = d.winner ? `🏆 ${esc(d.winner)} 승리!<small>곧 새 탑이 나타나요</small>` : '⏰ 시간 끝!<small>아무도 꼭대기에 못 갔어요</small>';
        setTimeout(() => { if (S) C.hud.querySelector('#tCenter').innerHTML = ''; }, 6000);
      }
      else if (t === 'bananas') S.bananas = d;
      else if (t === 'cd') S.cd = d;
      else if (t === 'msg') flash(d);
      else if (t === 'wfx') { S.fx.push(Object.assign({ t: 0.8 }, d)); }
      else if (t === 'hit') {
        const w = TOWER_WEAPONS[d.w];
        feed(`${w.emoji} ${d.from} 님이 ${w.name}을(를) 썼어요!`);
        if (d.w === 'freeze') P.freeze = 2.5;
        if (d.w === 'hammer') { P.slide = 0.7; P.vx = d.dir * 950; P.vy = -380; P.stun = 0.7; P.ground = null; }
        if (d.w === 'lightning') { P.vy = 800; P.drop = 0.35; P.stun = 1; P.ground = null; }
        if (d.w === 'reverse') P.reverse = 4;
        if (d.w === 'honey') P.honey = 5;
      }
    },
    key(code) {
      const n = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6'].indexOf(code);
      if (n >= 0 && C.me.weapons.tower.includes(WKEYS[n])) {
        if (S.cd > 0) return flash(`무기 재충전 중... ${Math.ceil(S.cd)}초`);
        if (WKEYS[n] === 'banana') P.immune = 1.5;
        C.send('weapon', { w: WKEYS[n] });
      }
    },
    update(dt) {
      if (!S) return;
      physics(dt);
      S.cd = Math.max(0, S.cd - dt);
      S.fx.forEach((f) => (f.t -= dt)); S.fx = S.fx.filter((f) => f.t > 0);
      if (S.flash) { S.flash.t -= dt; if (S.flash.t <= 0) S.flash = null; }
      S.sendT -= dt;
      if (S.sendT <= 0) {
        S.sendT = 0.08;
        const fx = P.freeze > 0 ? 'ice' : P.reverse > 0 ? 'rev' : P.honey > 0 ? 'honey' : P.inQuiz ? 'quiz' : '';
        C.send('pos', { x: P.x, y: P.y, f: P.face, fx });
      }
      const m = Math.floor(S.timer / 60), s = String(S.timer % 60).padStart(2, '0');
      const pct = Math.round(Math.max(0, Math.min(1, (T.startY - P.y) / (T.startY - T.goalY))) * 100);
      C.hud.querySelector('#tTop').innerHTML = S.phase === 'lobby' ? `⏳ 시작까지 ${S.timer}초` :
        S.phase === 'play' ? `⏱ ${m}:${s} &nbsp; 🧗 ${pct}%` : '🏁 끝!';
      const cdEl = C.hud.querySelector('#tCd');
      if (cdEl) cdEl.textContent = S.cd > 0 ? `재충전 ${Math.ceil(S.cd)}초` : '✅ 사용 가능!';
    },
    draw(g, w, h) {
      const D = C.Draw;
      const scale = Math.min(1.1, (w - 40) / T.w);
      const offX = (w - T.w * scale) / 2;
      let camY = P.y - (h * 0.6) / scale;
      camY = Math.max(T.goalY - 200, Math.min(T.h - h / scale + 10, camY));
      // 높이 올라갈수록 하늘색이 바뀌어요
      const prog = Math.max(0, Math.min(1, (T.startY - P.y) / (T.startY - T.goalY)));
      const sky = g.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, `hsl(${220 + prog * 60},70%,${55 - prog * 25}%)`);
      sky.addColorStop(1, `hsl(${200 + prog * 60},70%,${75 - prog * 20}%)`);
      g.fillStyle = sky; g.fillRect(0, 0, w, h);
      g.save();
      g.translate(offX, 0); g.scale(scale, scale); g.translate(0, -camY);
      // 탑 벽
      g.fillStyle = 'rgba(255,255,255,.08)';
      for (let y = Math.floor(camY / 120) * 120; y < camY + h / scale; y += 120) g.fillRect(0, y, T.w, 60);
      g.strokeStyle = 'rgba(255,255,255,.4)'; g.lineWidth = 4; g.strokeRect(0, T.goalY - 300, T.w, T.h);
      // 발판
      const colors = ['#60a5fa', '#34d399', '#fbbf24', '#f472b6', '#a78bfa'];
      let sec = 0;
      for (const p of T.plats) {
        if (p.y < camY - 50 || p.y > camY + h / scale + 50) { if (p.t === 'gate') sec = p.g + 1; continue; }
        const px = platX(p);
        if (p.t === 'floor') { g.fillStyle = '#4b5563'; g.fillRect(px, p.y, p.w, p.h); }
        else if (p.t === 'kill') {
          g.fillStyle = `rgba(239,68,68,${0.7 + Math.sin(T.time * 6) * 0.3})`; D.rr(g, px, p.y, p.w, p.h, 4); g.fill();
          g.fillStyle = '#fff'; g.font = 'bold 10px sans-serif'; g.textAlign = 'center'; g.fillText('위험!', px + p.w / 2, p.y + 11);
        } else if (p.t === 'gate') {
          const open = P.opened.has(p.g);
          g.fillStyle = open ? 'rgba(134,239,172,.45)' : '#7c3aed'; g.fillRect(px, p.y, p.w, p.h);
          g.fillStyle = '#fff'; g.font = 'bold 15px sans-serif'; g.textAlign = 'center';
          g.fillText(open ? `✅ 게이트 ${p.g + 1} 통과` : `❓ 영어 게이트 ${p.g + 1} — 아래에서 점프해서 머리를 박으면 문제!`, T.w / 2, p.y + 16);
          sec = p.g + 1;
        } else if (p.t === 'goal') {
          g.fillStyle = '#facc15'; D.rr(g, px, p.y, p.w, p.h, 6); g.fill();
          g.font = '40px sans-serif'; g.textAlign = 'center'; g.fillText('🏆', px + p.w / 2, p.y - 10);
        } else {
          g.fillStyle = p.t === 'move' ? '#fb923c' : colors[sec % colors.length];
          D.rr(g, px, p.y, p.w, p.h, 5); g.fill();
          g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(px + 4, p.y + 3, p.w - 8, 3);
          if (p.t === 'move') { g.fillStyle = '#fff'; g.font = '11px sans-serif'; g.textAlign = 'center'; g.fillText('⟷', px + p.w / 2, p.y + 13); }
        }
      }
      // 바나나
      g.font = '22px sans-serif'; g.textAlign = 'center';
      for (const b of S.bananas) g.fillText('🍌', b.x, b.y - 2);
      // 다른 친구들
      for (const [, nick, color, x, y, f, fx] of S.others) {
        D.avatar(g, x, y - 26, 18, color, f);
        D.name(g, x, y - 52, nick + (fx === 'quiz' ? ' ✏️' : ''));
        if (fx === 'ice') { g.fillStyle = 'rgba(147,197,253,.6)'; g.fillRect(x - 18, y - 46, 36, 46); }
        if (fx === 'rev') { g.font = '18px sans-serif'; g.fillText('🌀', x, y - 66); }
        if (fx === 'honey') { g.font = '18px sans-serif'; g.fillText('🍯', x, y - 66); }
      }
      // 나
      D.avatar(g, P.x, P.y - 26, 18, C.me.color, P.face);
      D.name(g, P.x, P.y - 52, C.me.nick, '#fde047');
      if (P.freeze > 0) { g.fillStyle = 'rgba(147,197,253,.6)'; g.fillRect(P.x - 18, P.y - 46, 36, 46); }
      if (P.reverse > 0) { g.font = '18px sans-serif'; g.fillText('🌀', P.x, P.y - 66); }
      if (P.honey > 0) { g.font = '18px sans-serif'; g.fillText('🍯', P.x, P.y - 66); }
      // 무기 효과
      for (const f of S.fx) {
        const e = TOWER_WEAPONS[f.w].emoji;
        g.globalAlpha = Math.min(1, f.t * 2);
        if (f.w === 'lightning') { g.strokeStyle = '#fde047'; g.lineWidth = 5; g.beginPath(); g.moveTo(f.fx, f.fy - 300); g.lineTo(f.fx + 15, f.fy - 150); g.lineTo(f.fx - 10, f.fy - 100); g.lineTo(f.fx, f.fy); g.stroke(); }
        else if (f.w !== 'banana') { g.strokeStyle = '#fff'; g.setLineDash([6, 6]); g.lineWidth = 3; g.beginPath(); g.moveTo(f.sx, f.sy - 25); g.lineTo(f.fx, f.fy - 25); g.stroke(); g.setLineDash([]); }
        g.font = '34px sans-serif'; g.fillText(e, f.fx, f.fy - 60 - (0.8 - f.t) * 40);
        g.globalAlpha = 1;
      }
      g.restore();
      // 높이 지도 (오른쪽)
      const mx = w - 26, top = 70, bot = h - 80;
      g.fillStyle = 'rgba(0,0,0,.35)'; D.rr(g, mx - 8, top - 10, 16, bot - top + 20, 8); g.fill();
      const toMap = (y) => bot - Math.max(0, Math.min(1, (T.startY - y) / (T.startY - T.goalY))) * (bot - top);
      for (const o of S.others) { g.fillStyle = o[2]; g.beginPath(); g.arc(mx, toMap(o[4]), 6, 0, 7); g.fill(); }
      g.fillStyle = '#fde047'; g.beginPath(); g.arc(mx, toMap(P.y), 8, 0, 7); g.fill();
      g.font = '16px sans-serif'; g.textAlign = 'center'; g.fillText('🏆', mx, top - 14);
      if (S.flash) {
        g.globalAlpha = Math.min(1, S.flash.t);
        g.font = 'bold 28px sans-serif'; g.lineWidth = 5; g.strokeStyle = 'rgba(0,0,0,.6)';
        g.strokeText(S.flash.text, w / 2, h * 0.25); g.fillStyle = S.flash.color; g.fillText(S.flash.text, w / 2, h * 0.25);
        g.globalAlpha = 1;
      }
    },
  };
})();
