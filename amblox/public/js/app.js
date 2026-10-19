// Amblox 클라이언트 핵심: 로그인, 메인 화면, 친구, 퀴즈, 상점, 게임 실행기
(function () {
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  window.esc = esc;

  const A = (window.Amblox = { me: null, socket: null, token: localStorage.getItem('amblox_token'), counts: {} });
  window.GAMES = window.GAMES || {};

  const GAME_LIST = [
    { key: 'battle', name: '초6영어 대전쟁', emoji: '🐰⚔️🐧', bg: 'linear-gradient(135deg,#fde68a,#fca5a5)', desc: '영어 문제를 맞혀 돈을 모으고 귀여운 동물 병사를 보내 상대 성을 무너뜨려요! (1:1)' },
    { key: 'tower', name: '영어 초보는 못 깨는 무기 타워', emoji: '🗼🔨', bg: 'linear-gradient(135deg,#c4b5fd,#60a5fa)', desc: '제한 시간 안에 꼭대기까지! 문제 게이트에서 틀리면 처음으로. 무기로 친구를 방해해요.' },
    { key: 'forest', name: '99나이트 앳 더 영어 포레스트', emoji: '🌲🔥🌙', bg: 'linear-gradient(135deg,#166534,#1e3a8a)', desc: '모닥불을 지키며 99밤을 버텨요. 문제를 풀어 무기를 충전하고 광신도를 물리쳐요! 직업 전부 무료!' },
    { key: 'tsunami', name: '쓰나미에서 포켓몬 찾기', emoji: '🌊⚡🐭', bg: 'linear-gradient(135deg,#7dd3fc,#fde68a)', desc: '포켓몬을 찾아 문제를 맞히면 데려갈 수 있어요. 쓰나미를 조심! 운이 좋으면 뮤를 만날지도?' },
    { key: 'rivals', name: '암 라이벌', emoji: '🎯🏹🚀', bg: 'linear-gradient(135deg,#fca5a5,#1f2937)', desc: 'Ambox로 무기를 사서 대결! 총알을 다시 채우려면 영어 문제를 맞혀야 해요.' },
  ];

  // ───────── 공통 도우미 ─────────
  function toast(msg, ms) {
    const d = document.createElement('div');
    d.className = 'toast'; d.textContent = msg;
    $('#toasts').appendChild(d);
    setTimeout(() => d.remove(), ms || 2800);
  }
  A.toast = toast;

  async function api(path, body) {
    const res = await fetch(path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', 'x-token': A.token || '' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return res.json();
  }

  function show(id) {
    for (const s of document.querySelectorAll('.screen')) s.hidden = s.id !== id;
  }

  // ───────── 로그인 / 회원가입 ─────────
  for (const t of document.querySelectorAll('.tab')) {
    t.onclick = () => {
      document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x === t));
      $('#loginForm').hidden = t.dataset.tab !== 'login';
      $('#signupForm').hidden = t.dataset.tab !== 'signup';
      $('#authMsg').textContent = '';
    };
  }
  $('#loginForm').onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const r = await api('/api/login', { id: f.get('id'), password: f.get('password') });
    if (r.error) return ($('#authMsg').textContent = r.error);
    loggedIn(r.token, r.me);
  };
  $('#signupForm').onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    if (f.get('password') !== f.get('password2')) return ($('#authMsg').textContent = '비밀번호가 서로 달라요');
    const r = await api('/api/signup', { id: f.get('id'), password: f.get('password'), nick: f.get('nick') });
    if (r.error) return ($('#authMsg').textContent = r.error);
    toast('🎉 Amblox에 온 걸 환영해요!');
    loggedIn(r.token, r.me);
  };
  $('#btnLogout').onclick = async () => {
    await api('/api/logout', {});
    localStorage.removeItem('amblox_token');
    location.reload();
  };

  function loggedIn(token, me) {
    A.token = token;
    localStorage.setItem('amblox_token', token);
    A.me = me;
    connect();
    renderMe();
    renderGames();
    show('lobby');
  }

  function connect() {
    if (A.socket) A.socket.disconnect();
    const s = (A.socket = io({ auth: { token: A.token } }));
    s.on('connect_error', (err) => {
      if (err.message === 'unauthorized') { localStorage.removeItem('amblox_token'); location.reload(); }
    });
    s.on('me', (me) => { A.me = me; renderMe(); if (Runner.game && Runner.game.onMe) Runner.game.onMe(me); });
    s.on('friends', renderFriends);
    s.on('toast', (m) => toast(m, 4000));
    s.on('counts', (c) => { A.counts = c; renderCounts(); });
    s.on('g', (m) => { if (Runner.game && Runner.game.msg) Runner.game.msg(m.t, m.d); });
    s.on('disconnect', () => { if (Runner.game) { toast('서버와 연결이 끊겼어요'); Runner.exit(); } });
  }

  // ───────── 메인 화면 ─────────
  function renderMe() {
    const me = A.me;
    if (!me) return;
    $('#amboxCount').textContent = me.ambox;
    $('#quizProg').textContent = `${me.quizProgress}/10`;
    $('#quizBar').style.width = me.quizProgress * 10 + '%';
    $('#myNick').textContent = me.nick;
    $('#myId').textContent = '@' + me.id;
    $('#myAvatar').style.background = me.color;
  }
  $('#myAvatar').onclick = () => api('/api/color', {});

  function renderGames() {
    $('#games').innerHTML = GAME_LIST.map((g) => `
      <div class="game-card">
        <div class="game-thumb" style="background:${g.bg}">${g.emoji}<span class="online" data-count="${g.key}">👤 0명 플레이 중</span></div>
        <div class="game-info"><b>${g.name}</b><p>${g.desc}</p>
          <button class="btn green" data-play="${g.key}">▶ 플레이</button></div>
      </div>`).join('');
    document.querySelectorAll('[data-play]').forEach((b) => (b.onclick = () => Runner.play(b.dataset.play)));
    renderCounts();
  }
  function renderCounts() {
    document.querySelectorAll('[data-count]').forEach((el) => {
      el.textContent = `👤 ${A.counts[el.dataset.count] || 0}명 플레이 중`;
    });
  }

  // ───────── 친구 ─────────
  $('#friendForm').onsubmit = async (e) => {
    e.preventDefault();
    const r = await api('/api/friends/request', { id: e.target.id.value.trim() });
    toast(r.error || r.msg);
    if (!r.error) e.target.reset();
  };
  function renderFriends(data) {
    $('#friendReqs').innerHTML = data.requests.map((r) => `
      <div class="req"><span>📨 <b>${esc(r.nick)}</b> (@${esc(r.id)})</span>
        <button class="btn small green" data-acc="${esc(r.id)}">수락</button>
        <button class="btn small" data-dec="${esc(r.id)}">거절</button></div>`).join('');
    const list = data.friends.sort((a, b) => b.online - a.online);
    $('#friendList').innerHTML = list.length ? list.map((f) => {
      const g = f.playing && GAME_LIST.find((x) => x.key === f.playing.game);
      return `<div class="friend">
        <span class="dot ${f.online ? 'on' : ''}"></span>
        <span class="avatar" style="width:26px;height:26px;background:${f.color}"></span>
        <div class="grow"><b>${esc(f.nick)}</b> <small>@${esc(f.id)}</small><br>
          <small>${g ? '🎮 ' + g.name : f.online ? '온라인' : '오프라인'}</small></div>
        ${g ? `<button class="btn small blue" data-join="${f.playing.game}|${f.playing.roomId}">같이하기</button>` : ''}
        <button class="btn small" data-rm="${esc(f.id)}" title="친구 삭제">✕</button>
      </div>`;
    }).join('') : '<div class="empty">아직 친구가 없어요.<br>친구 아이디를 입력해서 추가해 보세요!</div>';
    document.querySelectorAll('[data-acc]').forEach((b) => (b.onclick = () => api('/api/friends/respond', { id: b.dataset.acc, accept: true })));
    document.querySelectorAll('[data-dec]').forEach((b) => (b.onclick = () => api('/api/friends/respond', { id: b.dataset.dec, accept: false })));
    document.querySelectorAll('[data-rm]').forEach((b) => (b.onclick = () => { if (confirm('친구를 삭제할까요?')) api('/api/friends/remove', { id: b.dataset.rm }); }));
    document.querySelectorAll('[data-join]').forEach((b) => (b.onclick = () => { const [g, r] = b.dataset.join.split('|'); Runner.play(g, r); }));
  }

  // ───────── 영어 퀴즈 ─────────
  // Quiz.ask(purpose) → Promise<true/false>  (게임 안에서 쓰기)
  const Quiz = (A.Quiz = {
    open: false, busy: false, resolve: null, current: null, loop: false,
    ask(purpose, opts) {
      opts = opts || {};
      return new Promise((resolve) => {
        if (this.open) this.finish(false);
        this.resolve = resolve; this.purpose = purpose; this.loop = !!opts.loop;
        this.open = true;
        $('#quiz').hidden = false;
        $('#quizClose').hidden = opts.noClose;
        this.next();
      });
    },
    next() {
      this.busy = true;
      $('#quizChoices').innerHTML = '';
      $('#quizText').textContent = '문제를 불러오는 중...';
      A.socket.emit('quiz:get', { purpose: this.purpose }, (q) => {
        if (!this.open) return;
        this.current = q; this.busy = false;
        $('#quizKind').textContent = q.kind;
        $('#quizText').textContent = q.text;
        $('#quizInfo').textContent = this.loop ? `Ambox까지 ${10 - A.me.quizProgress}문제 남았어요` : '숫자키 1~4로도 고를 수 있어요';
        $('#quizChoices').innerHTML = q.choices.map((c, i) => `<button data-i="${i}"><span class="n">${i + 1}</span>${esc(c)}</button>`).join('');
        $('#quizChoices').querySelectorAll('button').forEach((b) => (b.onclick = () => this.choose(+b.dataset.i)));
      });
    },
    choose(i) {
      if (this.busy || !this.current) return;
      this.busy = true;
      A.socket.emit('quiz:answer', { id: this.current.id, choice: i }, (r) => {
        const btns = $('#quizChoices').querySelectorAll('button');
        if (btns[r.answerIndex]) btns[r.answerIndex].classList.add('right');
        if (!r.correct && btns[i]) btns[i].classList.add('wrong');
        $('#quizInfo').textContent = r.correct ? '⭕ 정답이에요!' : '❌ 틀렸어요! 초록색이 정답이에요';
        setTimeout(() => {
          if (this.loop && this.open) { if (this.resolve) this.resolve(r.correct); this.next(); }
          else this.finish(r.correct);
        }, r.correct ? 650 : 1300);
      });
    },
    finish(result) {
      this.open = false; this.current = null;
      $('#quiz').hidden = true;
      const res = this.resolve; this.resolve = null;
      if (res) res(result);
    },
  });
  $('#quizClose').onclick = () => Quiz.finish(null);
  $('#btnQuiz').onclick = () => Quiz.ask('lobby', { loop: true });

  // ───────── 상점 / 포켓몬 도감 ─────────
  function openPanel(html) { $('#panelBody').innerHTML = html; $('#panel').hidden = false; }
  $('#panelClose').onclick = () => ($('#panel').hidden = true);

  function shopHtml() {
    const me = A.me;
    const item = (cat, k, w) => {
      const owned = me.weapons[cat].includes(k);
      return `<div class="item"><div class="em">${w.emoji}</div><b>${w.name}</b>
        <p>${w.desc || `피해 ${w.dmg} · 탄창 ${w.mag}발`}</p>
        ${owned ? '<button class="btn small" disabled>✔ 가지고 있음</button>'
          : `<button class="btn small green" data-buy="${cat}|${k}">Ambox ${w.price}개로 사기</button>`}</div>`;
    };
    return `<h2>🛒 Amblox 상점</h2><p>내 Ambox: <b>${me.ambox}</b>개 (영어 문제 10개 맞히면 1개!)</p>
      <h3>🗼 무기 타워 무기 (각 Ambox 12개)</h3>
      <div class="shop-grid">${Object.entries(DEFS.TOWER_WEAPONS).map(([k, w]) => item('tower', k, w)).join('')}</div>
      <h3>🎯 암 라이벌 무기</h3>
      <div class="shop-grid">${DEFS.RIVAL_ORDER.map((k) => item('rivals', k, DEFS.RIVAL_WEAPONS[k])).join('')}</div>`;
  }
  function openShop() {
    openPanel(shopHtml());
    document.querySelectorAll('[data-buy]').forEach((b) => (b.onclick = async () => {
      const [cat, item] = b.dataset.buy.split('|');
      const r = await api('/api/shop/buy', { cat, item });
      if (r.error) return toast(r.error);
      A.me = r.me; renderMe();
      toast('구매 완료! 🎉');
      openShop();
    }));
  }
  $('#btnShop').onclick = openShop;
  A.openShop = openShop;

  $('#btnDex').onclick = () => {
    const mine = A.me.pokemon || {};
    const got = DEFS.POKEMON.filter((p) => mine[p.k]).length;
    openPanel(`<h2>🎒 내 포켓몬 (${got}/${DEFS.POKEMON.length})</h2>
      <p>'쓰나미에서 포켓몬 찾기'에서 데려온 포켓몬이에요.</p>
      <div class="dex">${DEFS.POKEMON.map((p) => `
        <div class="${mine[p.k] ? '' : 'locked'}" style="border-color:${DEFS.RARITY[p.rar].color}">
          <canvas width="70" height="70" data-pk="${p.k}"></canvas>
          <b>${mine[p.k] ? p.name : '???'}</b><br><small>${DEFS.RARITY[p.rar].name}${mine[p.k] ? ' · ' + mine[p.k] + '마리' : ''}</small>
        </div>`).join('')}</div>`);
    document.querySelectorAll('[data-pk]').forEach((c) => {
      const g = c.getContext('2d');
      Draw.pokemon(g, 35, 40, DEFS.POKEMON.find((p) => p.k === c.dataset.pk), 22, 0);
    });
  };

  // ───────── 그리기 도우미 ─────────
  const Draw = (A.Draw = {
    rr(g, x, y, w, h, r) {
      g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
      g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
    },
    // 로블록스 느낌의 네모 캐릭터
    avatar(g, x, y, s, color, face) {
      g.save(); g.translate(x, y);
      g.fillStyle = 'rgba(0,0,0,.2)'; g.beginPath(); g.ellipse(0, s * 0.95, s * 0.6, s * 0.18, 0, 0, 7); g.fill();
      g.fillStyle = '#3b4252'; g.fillRect(-s * 0.45, s * 0.35, s * 0.4, s * 0.55); g.fillRect(s * 0.05, s * 0.35, s * 0.4, s * 0.55);
      g.fillStyle = color; Draw.rr(g, -s * 0.55, -s * 0.2, s * 1.1, s * 0.6, s * 0.1); g.fill();
      g.fillStyle = '#ffd8a8'; Draw.rr(g, -s * 0.45, -s * 1.0, s * 0.9, s * 0.8, s * 0.15); g.fill();
      g.fillStyle = '#222';
      const fx = (face || 1) * s * 0.08;
      g.beginPath(); g.arc(-s * 0.18 + fx, -s * 0.65, s * 0.07, 0, 7); g.arc(s * 0.18 + fx, -s * 0.65, s * 0.07, 0, 7); g.fill();
      g.strokeStyle = '#222'; g.lineWidth = Math.max(1, s * 0.06);
      g.beginPath(); g.arc(fx, -s * 0.48, s * 0.15, 0.2, Math.PI - 0.2); g.stroke();
      g.restore();
    },
    name(g, x, y, text, color) {
      g.font = 'bold 13px sans-serif'; g.textAlign = 'center';
      g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,.6)'; g.strokeText(text, x, y);
      g.fillStyle = color || '#fff'; g.fillText(text, x, y);
    },
    bar(g, x, y, w, h, v, color) {
      g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(x - w / 2, y, w, h);
      g.fillStyle = color || '#22c55e'; g.fillRect(x - w / 2, y, w * Math.max(0, Math.min(1, v)), h);
    },
    // 귀여운 포켓몬 모양 (이름표는 따로)
    pokemon(g, x, y, def, r, t) {
      g.save(); g.translate(x, y + Math.sin((t || 0) * 4) * 2);
      g.fillStyle = def.color; g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 2;
      if (def.ear === 'long') { for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * r * 0.3, -r * 0.6); g.lineTo(s * r * 0.9, -r * 1.6); g.lineTo(s * r * 0.8, -r * 0.4); g.fill(); g.stroke(); }
        if (def.k === 'pikachu') { g.fillStyle = '#222'; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * r * 0.75, -r * 1.25); g.lineTo(s * r * 0.9, -r * 1.6); g.lineTo(s * r * 0.86, -r * 1.2); g.fill(); } g.fillStyle = def.color; } }
      if (def.ear === 'point') { for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * r * 0.2, -r * 0.8); g.lineTo(s * r * 0.6, -r * 1.25); g.lineTo(s * r * 0.85, -r * 0.5); g.fill(); g.stroke(); } }
      if (def.ear === 'round') { for (const s of [-1, 1]) { g.beginPath(); g.arc(s * r * 0.65, -r * 0.75, r * 0.35, 0, 7); g.fill(); g.stroke(); } }
      if (def.ear === 'ant') { g.beginPath(); g.moveTo(0, -r); g.quadraticCurveTo(r * 0.3, -r * 1.6, r * 0.5, -r * 1.4); g.stroke(); }
      if (def.ear === 'wing') { for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * r * 1.05, 0, r * 0.55, r * 0.3, s * -0.5, 0, 7); g.fill(); g.stroke(); } }
      if (def.k === 'charmander' || def.k === 'charizard') { g.fillStyle = '#ffeb3b'; g.beginPath(); g.arc(r * 1.1, r * 0.4, r * 0.25, 0, 7); g.fill(); g.fillStyle = def.color; }
      if (def.k === 'squirtle') { g.fillStyle = '#a1887f'; g.beginPath(); g.ellipse(0, r * 0.3, r * 1.05, r * 0.8, 0, 0, 7); g.fill(); g.fillStyle = def.color; }
      g.beginPath(); g.ellipse(0, 0, r, r * 0.92, 0, 0, 7); g.fill(); g.stroke();
      if (def.k === 'bulbasaur') { g.fillStyle = '#2e7d32'; g.beginPath(); g.arc(0, -r * 0.9, r * 0.45, 0, 7); g.fill(); }
      g.fillStyle = '#222';
      g.beginPath(); g.arc(-r * 0.35, -r * 0.1, r * 0.13, 0, 7); g.arc(r * 0.35, -r * 0.1, r * 0.13, 0, 7); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(-r * 0.31, -r * 0.15, r * 0.05, 0, 7); g.arc(r * 0.39, -r * 0.15, r * 0.05, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,90,120,.55)'; g.beginPath(); g.arc(-r * 0.6, r * 0.2, r * 0.13, 0, 7); g.arc(r * 0.6, r * 0.2, r * 0.13, 0, 7); g.fill();
      g.strokeStyle = '#222'; g.lineWidth = 1.5; g.beginPath(); g.arc(0, r * 0.15, r * 0.15, 0.3, Math.PI - 0.3); g.stroke();
      g.restore();
    },
  });

  // ───────── 게임 실행기 ─────────
  const canvas = $('#canvas');
  const g = canvas.getContext('2d');
  const keys = new Set();
  const mouse = { x: 0, y: 0, down: false };

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  addEventListener('resize', resize);

  addEventListener('keydown', (e) => {
    if (Quiz.open) {
      const n = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(e.code);
      if (n >= 0) { Quiz.choose(n); e.preventDefault(); return; }
      if (e.code === 'Escape' && !$('#quizClose').hidden) { Quiz.finish(null); return; }
    }
    if (!Runner.game || e.target.tagName === 'INPUT') return;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
    if (!keys.has(e.code) && !Quiz.open && Runner.game.key) Runner.game.key(e.code);
    keys.add(e.code);
  });
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());
  canvas.addEventListener('mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });
  canvas.addEventListener('mousedown', (e) => {
    mouse.down = true; mouse.x = e.clientX; mouse.y = e.clientY;
    if (Runner.game && Runner.game.click) Runner.game.click(e.clientX, e.clientY, e.button);
  });
  addEventListener('mouseup', () => (mouse.down = false));
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  const Runner = (A.Runner = {
    game: null, raf: 0, last: 0,
    play(key, roomId) {
      const mod = window.GAMES[key];
      if (!mod) return toast('준비 중인 게임이에요');
      A.socket.emit('room:join', { game: key, roomId }, (r) => {
        if (!r.ok) return toast(r.error);
        show('game'); resize();
        $('#hud').innerHTML = '';
        keys.clear();
        const ctx = {
          canvas, g, keys, mouse, get me() { return A.me; }, init: r.init, roomId: r.roomId,
          hud: $('#hud'),
          send: (t, d) => A.socket.emit('g', { t, d }),
          quiz: (purpose, opts) => Quiz.ask(purpose, opts),
          toast, Draw,
          get w() { return innerWidth; }, get h() { return innerHeight; },
        };
        this.game = mod;
        mod.start(ctx);
        this.last = performance.now();
        const loop = (now) => {
          if (!this.game) return;
          const dt = Math.min(0.05, (now - this.last) / 1000);
          this.last = now;
          try {
            if (mod.update) mod.update(dt);
            g.clearRect(0, 0, innerWidth, innerHeight);
            mod.draw(g, innerWidth, innerHeight);
          } catch (e) { console.error(e); }
          this.raf = requestAnimationFrame(loop);
        };
        this.raf = requestAnimationFrame(loop);
      });
    },
    exit() {
      if (!this.game) return;
      cancelAnimationFrame(this.raf);
      if (this.game.stop) this.game.stop();
      this.game = null;
      if (Quiz.open) Quiz.finish(null);
      A.socket.emit('room:leave');
      $('#hud').innerHTML = '';
      show('lobby');
    },
  });
  $('#btnExit').onclick = () => Runner.exit();

  // ───────── 시작 ─────────
  (async function boot() {
    if (A.token) {
      const r = await api('/api/me');
      if (r.me) return loggedIn(A.token, r.me);
      localStorage.removeItem('amblox_token');
    }
    show('auth');
  })();
})();
