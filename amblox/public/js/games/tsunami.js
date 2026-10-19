// 쓰나미에서 포켓몬 찾기 화면
(function () {
  const { POKEMON, RARITY, TSUNAMI } = DEFS;
  const PK = {};
  POKEMON.forEach((p) => (PK[p.k] = p));
  let C, S, P;

  function buildHud() {
    C.hud.innerHTML = `<div class="hud-top" id="sTop"></div>
      <div class="hud-box" id="sBoard" style="left:10px;top:56px"></div>
      <div class="feed" id="sFeed"></div>
      <div class="keys">WASD/방향키 이동 · 포켓몬 가까이 가서 E 또는 클릭 → 영어 문제 · 🛡️피난처에 숨어서 쓰나미를 피해요!</div>`;
  }
  function feed(text) {
    const f = C.hud.querySelector('#sFeed');
    const d = document.createElement('div'); d.textContent = text; f.prepend(d);
    setTimeout(() => d.remove(), 5000);
  }
  function flash(text, color) { S.flash = { text, color: color || '#fff', t: 2.2 }; }
  function view() {
    const scale = Math.min(1.3, (C.h - 120) / TSUNAMI.h);
    const camX = Math.max(0, Math.min(TSUNAMI.w - C.w / scale, P.x - C.w / scale / 2));
    const offY = (C.h - TSUNAMI.h * scale) / 2 + 10;
    return { scale, camX, offY };
  }
  function inShelter(x) { return TSUNAMI.shelters.some(([sx, w]) => x >= sx && x <= sx + w); }

  function tryClaim(pk) {
    if (!pk || S.claiming) return;
    if (S.carry) return flash('이미 포켓몬을 데리고 있어요! 기지로 가요 🏠');
    S.claiming = pk[0];
    C.send('claim', { id: pk[0] });
    setTimeout(() => { if (S && S.claiming === pk[0] && !Amblox.Quiz.open) S.claiming = null; }, 1500);
  }
  function nearestPk(x, y, maxD) {
    let best = null, bd = maxD;
    for (const k of S.pk) {
      if (k[4]) continue;
      const d = Math.hypot(k[2] - x, k[3] - y);
      if (d < bd) { bd = d; best = k; }
    }
    return best;
  }

  window.GAMES.tsunami = {
    start(ctx) {
      C = ctx;
      S = { players: [], pk: [], wave: null, big: false, wt: 20, sendT: 0, carry: null, t: 0, flash: null, claiming: null, disp: {} };
      P = { x: ctx.init.x, y: ctx.init.y, face: 1 };
      buildHud();
      flash('포켓몬을 찾아 떠나요! 멀리 갈수록 희귀해요 ✨', '#fde047');
    },
    stop() { S = null; },
    msg(t, d) {
      if (t === 's') {
        S.players = d.p; S.pk = d.k; S.wave = d.w; S.big = d.wb; S.wt = d.wt;
        const me = d.p.find((p) => p[0] === C.me.id);
        S.carry = me ? me[5] : null;
      } else if (t === 'claimOk') {
        C.quiz('tsunami').then((ok) => {
          S && (S.claiming = null);
          if (ok === null) C.send('cancel', { id: d.id });
          else if (ok) flash('⭕ 정답! 포켓몬이 따라와요! 기지로 데려가요 🏠', '#86efac');
        });
      } else if (t === 'claimNo') { S.claiming = null; flash(d.msg); }
      else if (t === 'hit') { P.x = d.x; P.y = d.y; flash('🌊 쓰나미에 휩쓸렸어요! 포켓몬이 도망갔어요', '#93c5fd'); }
      else if (t === 'warn') flash('⚠️ 쓰나미가 온다!! 피난처나 기지로!', '#fca5a5');
      else if (t === 'secured') {
        feed(`${d.nick} 님이 ${d.name}(${RARITY[d.rar].name})를 데려왔어요!`);
        if (d.rar === 4) flash(`✨ ${d.nick} 님이 전설의 뮤를 얻었어요!! ✨`, '#fde047');
      } else if (t === 'msg') flash(d);
    },
    key(code) {
      if (code === 'KeyE') tryClaim(nearestPk(P.x, P.y, 100));
    },
    click(mx, my) {
      const v = view();
      const wx = mx / v.scale + v.camX, wy = (my - v.offY) / v.scale;
      const k = nearestPk(wx, wy, 45);
      if (!k) return;
      if (Math.hypot(k[2] - P.x, k[3] - P.y) > 100) return flash('더 가까이 가야 해요!');
      tryClaim(k);
    },
    update(dt) {
      if (!S) return;
      S.t += dt;
      const K = C.keys;
      const dx = (K.has('KeyD') || K.has('ArrowRight') ? 1 : 0) - (K.has('KeyA') || K.has('ArrowLeft') ? 1 : 0);
      const dy = (K.has('KeyS') || K.has('ArrowDown') ? 1 : 0) - (K.has('KeyW') || K.has('ArrowUp') ? 1 : 0);
      if (dx || dy) {
        let sp = 250;
        if (S.carry) { const k = S.pk.find((q) => q[0] === S.carry); if (k) sp *= 1 - PK[k[1]].rar * 0.07; }
        const l = Math.hypot(dx, dy);
        P.x = Math.max(0, Math.min(TSUNAMI.w, P.x + (dx / l) * sp * dt));
        P.y = Math.max(20, Math.min(TSUNAMI.h - 10, P.y + (dy / l) * sp * dt));
        if (dx) P.face = dx;
      }
      S.sendT -= dt;
      if (S.sendT <= 0) { S.sendT = 0.06; C.send('pos', { x: P.x, y: P.y }); }
      for (const p of S.players) {
        const d = S.disp[p[0]] || (S.disp[p[0]] = { x: p[3], y: p[4] });
        d.x += (p[3] - d.x) * Math.min(1, dt * 12); d.y += (p[4] - d.y) * Math.min(1, dt * 12);
      }
      if (S.flash) { S.flash.t -= dt; if (S.flash.t <= 0) S.flash = null; }
      const zone = RARITY.slice().reverse().find((z) => P.x >= z.from);
      C.hud.querySelector('#sTop').innerHTML = (S.wave ? `🌊 ${S.big ? '거대 ' : ''}쓰나미 발생!!` : `🌊 다음 쓰나미까지 ${S.wt}초`) +
        `<br><small>${P.x < TSUNAMI.base ? '🏠 기지 (안전)' : inShelter(P.x) ? '🛡️ 피난처 (안전)' : '📍 ' + (zone ? zone.name + ' 구역' : '')}</small>`;
      C.hud.querySelector('#sBoard').innerHTML = '🏆 이번 판 점수<br>' + S.players.slice().sort((a, b) => b[6] - a[6])
        .map((p) => `${p[0] === C.me.id ? '⭐' : ''}${esc(p[1])}: ${p[6]}점`).join('<br>');
    },
    draw(g, w, h) {
      const D = C.Draw;
      const { scale, camX, offY } = view();
      g.fillStyle = '#7dd3fc'; g.fillRect(0, 0, w, h);
      g.save(); g.translate(0, offY); g.scale(scale, scale); g.translate(-camX, 0);
      // 구역별 바닥
      const zcol = ['#fde68a', '#bbf7d0', '#bfdbfe', '#e9d5ff', '#fef08a'];
      g.fillStyle = '#d6c08f'; g.fillRect(0, 0, TSUNAMI.w, TSUNAMI.h);
      RARITY.forEach((z, i) => {
        g.fillStyle = zcol[i]; g.fillRect(z.from, 0, z.to - z.from, TSUNAMI.h);
        g.fillStyle = z.color; g.font = 'bold 20px sans-serif'; g.textAlign = 'left';
        g.fillText(`${z.name} 구역`, z.from + 10, 26);
      });
      g.fillStyle = '#86efac'; g.fillRect(0, 0, TSUNAMI.base, TSUNAMI.h);
      g.font = '50px sans-serif'; g.textAlign = 'center'; g.fillText('🏠', TSUNAMI.base / 2, TSUNAMI.h / 2);
      g.font = 'bold 20px sans-serif'; g.fillStyle = '#166534'; g.fillText('기지 (안전)', TSUNAMI.base / 2, TSUNAMI.h / 2 + 40);
      g.font = 'bold 14px sans-serif'; g.fillText('포켓몬을 여기로!', TSUNAMI.base / 2, TSUNAMI.h / 2 + 62);
      // 피난처
      for (const [sx, sw] of TSUNAMI.shelters) {
        g.fillStyle = '#94a3b8'; g.fillRect(sx, 0, sw, TSUNAMI.h);
        g.fillStyle = '#64748b'; for (let y = 0; y < TSUNAMI.h; y += 40) g.fillRect(sx + ((y / 40) % 2) * 20, y, sw - 20, 4);
        g.fillStyle = '#fff'; g.font = 'bold 16px sans-serif'; g.fillText('🛡️ 피난처', sx + sw / 2, TSUNAMI.h / 2);
      }
      // 포켓몬
      for (const [, k, x, y, busy] of S.pk) {
        if (x < camX - 60 || x > camX + w / scale + 60) continue;
        const def = PK[k];
        if (def.rar >= 3) {
          g.fillStyle = def.rar === 4 ? `rgba(255,215,0,${0.3 + Math.sin(S.t * 5) * 0.15})` : 'rgba(168,85,247,.25)';
          g.beginPath(); g.arc(x, y, 34, 0, 7); g.fill();
        }
        g.globalAlpha = busy ? 0.75 : 1;
        D.pokemon(g, x, y, def, def.rar === 4 ? 16 : 18, S.t + x);
        D.name(g, x, y - 30, def.name, RARITY[def.rar].color === '#9e9e9e' ? '#fff' : RARITY[def.rar].color);
        g.globalAlpha = 1;
      }
      // 플레이어
      for (const p of S.players) {
        const mine = p[0] === C.me.id;
        const d = mine ? P : S.disp[p[0]] || { x: p[3], y: p[4] };
        D.avatar(g, d.x, d.y - 12, 16, p[2], mine ? P.face : 1);
        D.name(g, d.x, d.y - 46, p[1], mine ? '#fde047' : '#fff');
      }
      // 내 주변 잡을 수 있는 포켓몬 표시
      const near = nearestPk(P.x, P.y, 100);
      if (near && !S.carry) { g.strokeStyle = '#fde047'; g.lineWidth = 3; g.setLineDash([5, 5]); g.beginPath(); g.arc(near[2], near[3], 30, 0, 7); g.stroke(); g.setLineDash([]); D.name(g, near[2], near[3] + 46, 'E: 잡기!', '#fde047'); }
      // 쓰나미
      if (S.wave != null) {
        const wx = S.wave;
        const gr = g.createLinearGradient(wx, 0, wx + 400, 0);
        gr.addColorStop(0, 'rgba(30,64,175,.85)'); gr.addColorStop(1, 'rgba(30,58,138,.95)');
        g.fillStyle = gr; g.fillRect(wx, -40, TSUNAMI.w + 600 - wx, TSUNAMI.h + 80);
        g.fillStyle = '#e0f2fe';
        for (let y = -40; y < TSUNAMI.h + 40; y += 20) {
          g.beginPath(); g.arc(wx + Math.sin(y * 0.2 + S.t * 15) * 8, y, 12, 0, 7); g.fill();
        }
        g.font = '40px sans-serif'; g.fillText('🌊', wx + 40, TSUNAMI.h / 2);
      }
      g.restore();
      // 쓰나미 경고 화살표
      if (S.wave != null && S.wave > camX + w / scale) {
        g.fillStyle = `rgba(239,68,68,${0.5 + Math.sin(S.t * 12) * 0.4})`;
        g.font = 'bold 26px sans-serif'; g.textAlign = 'right'; g.fillText('🌊 쓰나미가 오고 있어요! ▶', w - 20, h / 2);
      }
      if (S.flash) {
        g.globalAlpha = Math.min(1, S.flash.t); g.textAlign = 'center';
        g.font = 'bold 26px sans-serif'; g.lineWidth = 5; g.strokeStyle = 'rgba(0,0,0,.6)';
        g.strokeText(S.flash.text, w / 2, h * 0.22); g.fillStyle = S.flash.color; g.fillText(S.flash.text, w / 2, h * 0.22);
        g.globalAlpha = 1;
      }
    },
  };
})();
