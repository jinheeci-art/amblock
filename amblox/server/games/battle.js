// 초6영어 대전쟁 (1:1) — 문제를 맞혀 돈을 모으고 귀여운 동물 병사를 보내 상대 성을 무너뜨려요!
const { UNITS, UNIT_ORDER, BATTLE } = require('../../public/shared/defs');

function fresh() {
  return {
    phase: 'wait', sides: [null, null], names: ['', ''],
    bases: [BATTLE.baseHp, BATTLE.baseHp], money: [150, 150], cannon: [0, 0],
    cds: [{}, {}], units: [], nextId: 1, winner: -1, bot: false, botT: 0, botQuizT: 0, fx: [],
  };
}

function start(room) { room.state.phase = 'play'; room.emit('start', { names: room.state.names }); }

function spawn(st, side, type) {
  const def = UNITS[type];
  if (!def || st.phase !== 'play') return false;
  if (st.money[side] < def.cost || (st.cds[side][type] || 0) > 0) return false;
  if (st.units.filter((u) => u.side === side).length >= 30) return false;
  st.money[side] -= def.cost;
  st.cds[side][type] = def.cd;
  st.units.push({ id: st.nextId++, type, side, x: side === 0 ? 40 : BATTLE.lane - 40, hp: def.hp, t: 0, atk: 0 });
  return true;
}

function fireCannon(room, side) {
  const st = room.state;
  if (st.cannon[side] < BATTLE.cannonNeed) return;
  st.cannon[side] = 0;
  const from = side === 0 ? 0 : BATTLE.lane;
  for (const u of st.units) {
    if (u.side !== side && Math.abs(u.x - from) < 650) {
      u.hp -= 160;
      u.x += side === 0 ? 60 : -60; // 뒤로 밀려나요
    }
  }
  room.emit('cannon', { side });
}

module.exports = {
  max: 2,
  tickMs: 100,
  create: () => fresh(),
  canJoin: (room) => room.state.phase === 'wait' && !room.state.bot,
  onJoin(room, p) {
    const st = room.state;
    const side = st.sides[0] === null ? 0 : 1;
    st.sides[side] = p.id; st.names[side] = p.nick; p.side = side;
    room.emit('names', { names: st.names });
    if (st.sides[0] && st.sides[1]) start(room);
  },
  initFor(room, p) { return { side: p.side, phase: room.state.phase, names: room.state.names }; },
  onLeave(room, p) {
    const st = room.state;
    if (st.phase === 'play') { st.phase = 'end'; st.winner = 1 - p.side; room.emit('end', { winner: st.winner, reason: '상대가 나갔어요' }); }
    st.sides[p.side] = null;
  },
  onMsg(room, p, t, d) {
    const st = room.state;
    if (t === 'ai' && st.phase === 'wait' && room.players.size === 1) {
      st.bot = true; st.sides[1 - p.side] = 'BOT'; st.names[1 - p.side] = '🤖 영어봇';
      start(room);
    } else if (t === 'spawn') {
      spawn(st, p.side, d.type);
    } else if (t === 'cannon') {
      fireCannon(room, p.side);
    } else if (t === 'rematch' && st.phase === 'end') {
      const keep = { sides: st.sides, names: st.names, bot: st.bot };
      room.state = Object.assign(fresh(), keep);
      if (keep.bot || (st.sides[0] && st.sides[1])) start(room);
      else { room.state.phase = 'wait'; room.state.bot = false; }
    }
  },
  onQuiz(room, p, correct, purpose) {
    const st = room.state;
    if (purpose !== 'battle' || st.phase !== 'play') return;
    if (correct) {
      st.money[p.side] = Math.min(3000, st.money[p.side] + BATTLE.quizMoney);
      st.cannon[p.side] = Math.min(BATTLE.cannonNeed, st.cannon[p.side] + 1);
    }
  },
  tick(room, dt) {
    const st = room.state;
    if (st.phase !== 'play') return;
    for (let s = 0; s < 2; s++) {
      st.money[s] = Math.min(3000, st.money[s] + 5 * dt);
      for (const k in st.cds[s]) st.cds[s][k] = Math.max(0, st.cds[s][k] - dt);
    }
    // 🤖 봇: 가끔 문제를 맞히고 병사를 보내요
    if (st.bot) {
      const bs = st.sides.indexOf('BOT');
      st.botQuizT -= dt;
      if (st.botQuizT <= 0) {
        st.botQuizT = 3.5 + Math.random() * 2;
        if (Math.random() < 0.7) { st.money[bs] += BATTLE.quizMoney; st.cannon[bs] = Math.min(BATTLE.cannonNeed, st.cannon[bs] + 1); }
      }
      st.botT -= dt;
      if (st.botT <= 0) {
        st.botT = 1.5;
        const options = UNIT_ORDER.filter((k) => UNITS[k].cost <= st.money[bs] && !(st.cds[bs][k] > 0));
        if (options.length) spawn(st, bs, options[Math.floor(Math.random() * options.length)]);
        const near = st.units.filter((u) => u.side !== bs && Math.abs(u.x - (bs === 0 ? 0 : BATTLE.lane)) < 500).length;
        if (st.cannon[bs] >= BATTLE.cannonNeed && near >= 3) fireCannon(room, bs);
      }
    }
    // 병사 움직이기 & 싸우기
    for (const u of st.units) {
      const def = UNITS[u.type];
      const dir = u.side === 0 ? 1 : -1;
      u.t = Math.max(0, u.t - dt);
      u.atk = Math.max(0, u.atk - dt);
      let target = null, best = Infinity;
      for (const e of st.units) {
        if (e.side === u.side || e.hp <= 0) continue;
        const ahead = (e.x - u.x) * dir;
        if (ahead >= -10 && ahead <= def.range && ahead < best) { best = ahead; target = e; }
      }
      const enemyBase = u.side === 0 ? BATTLE.lane : 0;
      const toBase = (enemyBase - u.x) * dir;
      if (target || toBase <= def.range) {
        if (u.t <= 0) {
          u.t = def.rate; u.atk = 0.3;
          if (target) {
            if (def.splash) {
              for (const e of st.units) if (e.side !== u.side && Math.abs(e.x - target.x) < 60) e.hp -= def.atk;
            } else target.hp -= def.atk;
          } else {
            const es = 1 - u.side;
            st.bases[es] = Math.max(0, st.bases[es] - def.atk);
          }
        }
      } else {
        u.x += dir * def.speed * dt;
      }
    }
    st.units = st.units.filter((u) => u.hp > 0);
    for (let s = 0; s < 2; s++) {
      if (st.bases[s] <= 0) {
        st.phase = 'end'; st.winner = 1 - s;
        const w = room.players.get(st.sides[1 - s]);
        if (w) { w.user.stats.wins++; global.AMBLOX.db.save(); }
        room.emit('end', { winner: st.winner });
        break;
      }
    }
    room.emit('s', {
      u: st.units.map((u) => [u.id, u.type, u.side, Math.round(u.x), Math.round(u.hp), u.atk > 0 ? 1 : 0]),
      b: st.bases, m: st.money.map(Math.floor), c: st.cannon, cd: st.cds,
    });
  },
};
