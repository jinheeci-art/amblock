// 쓰나미에서 포켓몬 찾기 — 포켓몬을 골라 영어 문제를 맞히면 데려갈 수 있어요.
// 기지로 데려가기 전에 쓰나미에 맞으면 포켓몬이 원래 자리로 도망가요!
const { POKEMON, RARITY, TSUNAMI } = require('../../public/shared/defs');

const R = (a, b) => a + Math.random() * (b - a);
const BY_RAR = [0, 1, 2, 3, 4].map((r) => POKEMON.filter((p) => p.rar === r));

function inShelter(x) { return TSUNAMI.shelters.some(([sx, w]) => x >= sx && x <= sx + w); }

function spawnOne(st) {
  // 멀리 갈수록 희귀한 포켓몬! 뮤는 아주 가끔만 나타나요
  let rar = Math.random() < 0.45 ? 0 : Math.random() < 0.55 ? 1 : Math.random() < 0.6 ? 2 : 3;
  const mewOut = st.pk.some((p) => p.k === 'mew');
  if (!mewOut && Math.random() < 0.04) rar = 4;
  const z = RARITY[rar];
  const kind = BY_RAR[rar][Math.floor(Math.random() * BY_RAR[rar].length)];
  let x;
  do { x = R(z.from, z.to); } while (inShelter(x));
  const y = R(60, TSUNAMI.h - 40);
  st.pk.push({ id: st.seq++, k: kind.k, rar, x, y, hx: x, hy: y, st: 'free', by: null, lockT: 0 });
}

module.exports = {
  max: 10,
  tickMs: 100,
  create() {
    const st = { pk: [], seq: 1, wave: null, waveT: 18, warned: false };
    while (st.pk.length < 34) spawnOne(st);
    return st;
  },
  canJoin: () => true,
  onJoin(room, p) { p.x = 150; p.y = TSUNAMI.h / 2; p.carry = null; p.score = 0; },
  initFor(room, p) { return { x: p.x, y: p.y }; },
  onLeave(room, p) {
    for (const k of room.state.pk) if (k.by === p.id) { k.st = 'free'; k.by = null; k.x = k.hx; k.y = k.hy; }
  },
  onMsg(room, p, t, d) {
    const st = room.state;
    if (t === 'pos') {
      p.x = Math.max(0, Math.min(TSUNAMI.w, +d.x || 0));
      p.y = Math.max(0, Math.min(TSUNAMI.h, +d.y || 0));
    } else if (t === 'claim') {
      const k = st.pk.find((q) => q.id === d.id);
      if (!k || k.st !== 'free' || p.carry) return room.emitTo(p.id, 'claimNo', { msg: p.carry ? '이미 포켓몬을 데리고 있어요!' : '다른 친구가 먼저 잡고 있어요!' });
      if (Math.hypot(k.x - p.x, k.y - p.y) > 110) return room.emitTo(p.id, 'claimNo', { msg: '더 가까이 가야 해요!' });
      k.st = 'lock'; k.by = p.id; k.lockT = 20;
      room.emitTo(p.id, 'claimOk', { id: k.id });
    } else if (t === 'cancel') {
      const k = st.pk.find((q) => q.id === d.id && q.by === p.id && q.st === 'lock');
      if (k) { k.st = 'free'; k.by = null; }
    }
  },
  onQuiz(room, p, correct, purpose) {
    if (purpose !== 'tsunami') return;
    const k = room.state.pk.find((q) => q.by === p.id && q.st === 'lock');
    if (!k) return;
    if (correct) { k.st = 'carry'; p.carry = k.id; }
    else { k.st = 'free'; k.by = null; room.emitTo(p.id, 'msg', '앗! 틀려서 포켓몬이 도망쳤어요. 다시 도전!'); }
  },
  tick(room, dt) {
    const st = room.state;
    const ps = [...room.players.values()];
    // 쓰나미
    if (!st.wave) {
      st.waveT -= dt;
      if (st.waveT <= 4 && !st.warned) { st.warned = true; room.emit('warn', {}); }
      if (st.waveT <= 0) {
        const big = Math.random() < 0.25;
        st.wave = { x: TSUNAMI.w + 100, speed: TSUNAMI.waveSpeed * (big ? 1.35 : 1), big };
      }
    } else {
      const prev = st.wave.x;
      st.wave.x -= st.wave.speed * dt;
      for (const p of ps) {
        // 파도 앞부분이 플레이어를 지나가면 맞은 거예요 (피난처 안은 안전)
        if (p.x <= prev + 30 && p.x >= st.wave.x - 10 && p.x > TSUNAMI.base && !inShelter(p.x)) {
          if (p.carry) {
            const k = st.pk.find((q) => q.id === p.carry);
            if (k) { k.st = 'free'; k.by = null; k.x = k.hx; k.y = k.hy; }
            p.carry = null;
          }
          p.x = 150; p.y = TSUNAMI.h / 2;
          room.emitTo(p.id, 'hit', { x: p.x, y: p.y });
        }
      }
      if (st.wave.x < TSUNAMI.base) { st.wave = null; st.waveT = R(16, 26); st.warned = false; }
    }
    // 포켓몬 따라오기 / 기지 도착
    for (const k of st.pk) {
      if (k.st === 'lock') { k.lockT -= dt; if (k.lockT <= 0) { k.st = 'free'; k.by = null; } }
      if (k.st === 'carry') {
        const p = room.players.get(k.by);
        if (!p) { k.st = 'free'; k.by = null; k.x = k.hx; k.y = k.hy; continue; }
        k.x = p.x - 30; k.y = p.y - 30;
        if (p.x < TSUNAMI.base) {
          const name = POKEMON.find((q) => q.k === k.k).name;
          p.user.pokemon[k.k] = (p.user.pokemon[k.k] || 0) + 1;
          global.AMBLOX.db.save();
          global.AMBLOX.pushMe(p.user);
          p.score += 1 + k.rar * 2;
          p.carry = null; k.st = 'gone';
          room.emit('secured', { nick: p.nick, name, rar: k.rar });
        }
      }
    }
    st.pk = st.pk.filter((k) => k.st !== 'gone');
    while (st.pk.length < 34) spawnOne(st);
    room.emit('s', {
      p: ps.map((p) => [p.id, p.nick, p.color, Math.round(p.x), Math.round(p.y), p.carry, p.score]),
      k: st.pk.map((k) => [k.id, k.k, Math.round(k.x), Math.round(k.y), k.st === 'free' ? 0 : 1]),
      w: st.wave ? Math.round(st.wave.x) : null, wb: st.wave ? st.wave.big : false,
      wt: st.wave ? 0 : Math.ceil(st.waveT),
    });
  },
};
