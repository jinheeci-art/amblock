// 초6영어 대전쟁 화면 — 내 성은 항상 왼쪽!
(function () {
  const { UNITS, UNIT_ORDER, BATTLE } = DEFS;
  let C, S, quiz, hudEls;

  function vx(x) { return S.side === 0 ? x : BATTLE.lane - x; } // 내 쪽이 왼쪽이 되도록

  function buildHud() {
    C.hud.innerHTML = `
      <div class="hud-top" id="bTop"></div>
      <div class="bquiz pe" id="bQuiz"><div class="quiz-kind">💰 문제를 맞히면 +${BATTLE.quizMoney}원 & 대포 충전</div>
        <div class="quiz-text" id="bqText">...</div><div class="quiz-choices" id="bqCh"></div></div>
      <div class="battle-bar pe" id="bBar">
        ${UNIT_ORDER.map((k) => `<button class="unit-btn" data-u="${k}"><span class="em">${UNITS[k].emoji}</span>
          <small>${UNITS[k].name}</small><br><small>💰${UNITS[k].cost}</small><div class="cdm"></div></button>`).join('')}
        <button class="unit-btn" id="bCannon" style="background:#fde68a"><span class="em">💣</span><small>영어 대포</small><br><small id="bCan">0/${BATTLE.cannonNeed}</small><div class="cdm"></div></button>
      </div>
      <div class="hud-center pe" id="bCenter"></div>`;
    hudEls = { top: C.hud.querySelector('#bTop'), center: C.hud.querySelector('#bCenter') };
    C.hud.querySelectorAll('[data-u]').forEach((b) => (b.onclick = () => C.send('spawn', { type: b.dataset.u })));
    C.hud.querySelector('#bCannon').onclick = () => C.send('cannon');
    nextQuestion();
  }

  // 화면에 계속 떠 있는 퀴즈 (빠르게 풀수록 돈이 많아져요)
  function nextQuestion() {
    if (!quiz.alive) return;
    Amblox.socket.emit('quiz:get', { purpose: 'battle' }, (q) => {
      if (!quiz.alive) return;
      quiz.q = q; quiz.busy = false;
      C.hud.querySelector('#bqText').textContent = q.text;
      const box = C.hud.querySelector('#bqCh');
      box.innerHTML = q.choices.map((c, i) => `<button data-i="${i}"><span class="n">${i + 1}</span>${esc(c)}</button>`).join('');
      box.querySelectorAll('button').forEach((b) => (b.onclick = () => answer(+b.dataset.i)));
    });
  }
  function answer(i) {
    if (quiz.busy || !quiz.q || S.phase !== 'play') return;
    quiz.busy = true;
    Amblox.socket.emit('quiz:answer', { id: quiz.q.id, choice: i }, (r) => {
      const btns = C.hud.querySelectorAll('#bqCh button');
      if (btns[r.answerIndex]) btns[r.answerIndex].classList.add('right');
      if (!r.correct && btns[i]) btns[i].classList.add('wrong');
      if (r.correct) S.pops.push({ t: 1, text: `+${BATTLE.quizMoney}💰` });
      setTimeout(nextQuestion, r.correct ? 400 : 1200);
    });
  }

  function center(html) { hudEls.center.innerHTML = html; }

  function showPhase() {
    if (S.phase === 'wait') {
      center(`상대를 기다리는 중... ⏳<small>친구가 친구 목록에서 '같이하기'를 누르면 들어와요!</small>
        <button class="btn yellow" id="bAi" style="margin-top:14px">🤖 영어봇과 대결하기</button>`);
      hudEls.center.querySelector('#bAi').onclick = () => C.send('ai');
    } else if (S.phase === 'play') center('');
  }

  window.GAMES.battle = {
    start(ctx) {
      C = ctx;
      S = { side: ctx.init.side, phase: ctx.init.phase, names: ctx.init.names, units: [], bases: [BATTLE.baseHp, BATTLE.baseHp], money: [0, 0], cannon: [0, 0], cds: [{}, {}], t: 0, pops: [], boom: [] };
      quiz = { alive: true, q: null, busy: false };
      buildHud();
      showPhase();
    },
    stop() { quiz.alive = false; },
    msg(t, d) {
      if (t === 's') { S.units = d.u; S.bases = d.b; S.money = d.m; S.cannon = d.c; S.cds = d.cd; }
      else if (t === 'names') S.names = d.names;
      else if (t === 'start') { S.phase = 'play'; S.names = d.names; showPhase(); }
      else if (t === 'cannon') S.boom.push({ side: d.side, t: 1 });
      else if (t === 'end') {
        S.phase = 'end';
        const win = d.winner === S.side;
        center(`${win ? '🎉 승리! 🎉' : '😢 패배...'}<small>${d.reason || (win ? '상대 성을 무너뜨렸어요!' : '다음엔 더 빨리 문제를 풀어봐요!')}</small>
          <button class="btn green" id="bRe" style="margin-top:14px">🔁 다시 하기</button>`);
        hudEls.center.querySelector('#bRe').onclick = () => C.send('rematch');
      }
    },
    key(code) {
      const n = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(code);
      if (n >= 0) answer(n);
      const u = ['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT'].indexOf(code);
      if (u >= 0) C.send('spawn', { type: UNIT_ORDER[u] });
      if (code === 'Space') C.send('cannon');
    },
    update(dt) {
      S.t += dt;
      S.pops.forEach((p) => (p.t -= dt)); S.pops = S.pops.filter((p) => p.t > 0);
      S.boom.forEach((p) => (p.t -= dt * 1.5)); S.boom = S.boom.filter((p) => p.t > 0);
      const my = S.side;
      hudEls.top.innerHTML = `${esc(S.names[my] || '나')} vs ${esc(S.names[1 - my] || '???')}<br>💰 ${S.money[my] || 0}원`;
      C.hud.querySelectorAll('[data-u]').forEach((b) => {
        const def = UNITS[b.dataset.u];
        const cd = (S.cds[my] && S.cds[my][b.dataset.u]) || 0;
        b.classList.toggle('poor', (S.money[my] || 0) < def.cost);
        b.querySelector('.cdm').style.height = (cd / def.cd) * 100 + '%';
      });
      const can = S.cannon[my] || 0;
      C.hud.querySelector('#bCan').textContent = can >= BATTLE.cannonNeed ? '발사 준비!' : `${can}/${BATTLE.cannonNeed}`;
      C.hud.querySelector('#bCannon').classList.toggle('poor', can < BATTLE.cannonNeed);
    },
    draw(g, w, h) {
      const D = C.Draw;
      // 하늘과 들판
      const sky = g.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, '#8fd3ff'); sky.addColorStop(1, '#e0f7ff');
      g.fillStyle = sky; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(255,255,255,.8)';
      for (let i = 0; i < 5; i++) {
        const cx = ((i * 330 + S.t * 12) % (w + 200)) - 100, cy = 50 + (i % 3) * 40;
        g.beginPath(); g.arc(cx, cy, 24, 0, 7); g.arc(cx + 26, cy - 8, 28, 0, 7); g.arc(cx + 54, cy, 22, 0, 7); g.fill();
      }
      const ground = h * 0.62;
      g.fillStyle = '#7bd389'; g.fillRect(0, ground, w, h - ground);
      g.fillStyle = '#5fbf72'; g.fillRect(0, ground, w, 8);
      const scale = (w - 120) / BATTLE.lane;
      const X = (x) => 60 + vx(x) * scale;

      // 성 그리기
      const castle = (x, mine, hp) => {
        g.save(); g.translate(x, ground);
        g.fillStyle = mine ? '#93c5fd' : '#fca5a5';
        g.fillRect(-40, -110, 80, 110);
        for (let i = -40; i < 40; i += 20) g.fillRect(i, -125, 12, 15);
        g.fillStyle = '#fff'; D.rr(g, -14, -40, 28, 40, 12); g.fill();
        g.font = '30px sans-serif'; g.textAlign = 'center'; g.fillText(mine ? '🏰' : '🏯', 0, -70);
        D.bar(g, 0, -145, 100, 10, hp / BATTLE.baseHp, mine ? '#3b82f6' : '#ef4444');
        g.fillStyle = '#fff'; g.font = 'bold 12px sans-serif'; g.fillText(Math.ceil(hp), 0, -150);
        g.restore();
      };
      castle(X(0) - 10, true, S.bases[S.side]);
      castle(X(BATTLE.lane) + 10, false, S.bases[1 - S.side]);

      // 유닛
      g.textAlign = 'center'; g.textBaseline = 'middle';
      for (const [id, type, side, x, hp, atk] of S.units) {
        const def = UNITS[type];
        const mine = side === S.side;
        const sx = X(x), sy = ground - 22 - (id % 4) * 6;
        const bob = atk ? -8 : Math.abs(Math.sin(S.t * 8 + id)) * -4;
        g.save(); g.translate(sx, sy + bob);
        g.fillStyle = mine ? 'rgba(59,130,246,.35)' : 'rgba(239,68,68,.35)';
        g.beginPath(); g.ellipse(0, 22 - bob, 18, 5, 0, 0, 7); g.fill();
        if (!mine) g.scale(-1, 1);
        g.fillStyle = '#000';
        g.font = (type === 'unicorn' || type === 'bear' ? 40 : 32) + 'px sans-serif';
        g.fillText(def.emoji, 0, 0);
        g.restore();
        D.bar(g, sx, sy - 30, 32, 4, hp / def.hp, mine ? '#3b82f6' : '#ef4444');
        if (atk && def.range > 100) { g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + (mine ? 30 : -30), sy - 5); g.stroke(); }
      }
      g.textBaseline = 'alphabetic';
      // 대포 효과
      for (const b of S.boom) {
        const mine = b.side === S.side;
        const fromX = mine ? X(0) : X(BATTLE.lane);
        const len = 650 * scale * (1 - b.t);
        g.fillStyle = `rgba(255,200,40,${b.t})`;
        g.fillRect(mine ? fromX : fromX - len, ground - 70, len, 50);
        g.font = '40px sans-serif'; g.fillText('💥', mine ? fromX + len : fromX - len, ground - 30);
      }
      // 돈 +효과
      g.font = 'bold 26px sans-serif'; g.fillStyle = '#facc15';
      for (const p of S.pops) g.fillText(p.text, w / 2, 110 - (1 - p.t) * 40);
      g.fillStyle = 'rgba(0,0,0,.5)'; g.font = '12px sans-serif';
      g.fillText('단축키: 숫자 1~4 = 정답 고르기 · Q/W/E/R/T = 병사 보내기 · 스페이스 = 영어 대포', w / 2, ground + 40);
    },
  };
})();
