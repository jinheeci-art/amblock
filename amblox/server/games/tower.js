// 영어 초보는 못 깨는 무기 타워 — 제한 시간 안에 꼭대기까지! 중간 문제 게이트에서 틀리면 처음으로!
const { TOWER, TOWER_WEAPONS } = require('../../public/shared/defs');

function newSeed() { return Math.floor(Math.random() * 1e9) + 1; }

function nearest(room, p, filter) {
  let best = null, bd = Infinity;
  for (const o of room.players.values()) {
    if (o === p || o.y == null) continue;
    const d = Math.hypot(o.x - p.x, o.y - p.y);
    if (filter(o, d) && d < bd) { bd = d; best = o; }
  }
  return best;
}

module.exports = {
  max: 8,
  tickMs: 100,
  create: () => ({ phase: 'lobby', timer: TOWER.lobbyTime, seed: newSeed(), bananas: [], bananaSeq: 1, winner: null }),
  canJoin: () => true,
  onJoin(room, p) { p.x = 400; p.y = null; p.cd = 0; p.f = 1; },
  initFor(room, p) {
    const st = room.state;
    return { phase: st.phase, timer: st.timer, seed: st.seed, bananas: st.bananas, owned: p.user.weapons.tower };
  },
  onLeave() {},
  onMsg(room, p, t, d) {
    const st = room.state;
    if (t === 'pos') {
      p.x = +d.x || 0; p.y = +d.y || 0; p.f = d.f > 0 ? 1 : -1; p.fx = d.fx || '';
    } else if (t === 'weapon') {
      const w = TOWER_WEAPONS[d.w];
      if (!w || st.phase !== 'play' || !p.user.weapons.tower.includes(d.w) || p.cd > 0 || p.y == null) return;
      let target = null;
      if (d.w === 'banana') {
        st.bananas.push({ id: st.bananaSeq++, x: p.x, y: p.y, t: 30 });
        if (st.bananas.length > 12) st.bananas.shift();
        room.emit('bananas', st.bananas);
      } else if (d.w === 'lightning') {
        target = nearest(room, p, (o, dist) => o.y < p.y - 20 && dist < w.range);
      } else {
        target = nearest(room, p, (o, dist) => dist < w.range);
      }
      if (d.w !== 'banana' && !target) { room.emitTo(p.id, 'msg', '근처에 맞출 친구가 없어요!'); return; }
      p.cd = TOWER.cooldown;
      room.emitTo(p.id, 'cd', TOWER.cooldown);
      room.emit('wfx', { w: d.w, from: p.id, to: target ? target.id : null, fx: target ? target.x : p.x, fy: target ? target.y : p.y, sx: p.x, sy: p.y });
      if (target) room.emitTo(target.id, 'hit', { w: d.w, from: p.nick, dir: Math.sign(target.x - p.x) || 1 });
    } else if (t === 'banana') {
      const i = st.bananas.findIndex((b) => b.id === d.id);
      if (i >= 0) { st.bananas.splice(i, 1); room.emit('bananas', st.bananas); }
    } else if (t === 'win') {
      if (st.phase !== 'play' || p.y == null || p.y > d.goalY + 200) return;
      st.phase = 'end'; st.timer = TOWER.endTime; st.winner = p.nick;
      p.user.stats.wins++; global.AMBLOX.db.save();
      room.emit('end', { winner: p.nick });
    }
  },
  tick(room, dt) {
    const st = room.state;
    st.timer -= dt;
    for (const p of room.players.values()) p.cd = Math.max(0, (p.cd || 0) - dt);
    if (st.bananas.length) {
      const before = st.bananas.length;
      st.bananas.forEach((b) => { b.t -= dt; });
      st.bananas = st.bananas.filter((b) => b.t > 0);
      if (st.bananas.length !== before) room.emit('bananas', st.bananas);
    }
    if (st.timer <= 0) {
      if (st.phase === 'lobby') {
        st.phase = 'play'; st.timer = TOWER.playTime;
        room.emit('start', { seed: st.seed, timer: st.timer });
      } else if (st.phase === 'play') {
        st.phase = 'end'; st.timer = TOWER.endTime; st.winner = null;
        room.emit('end', { winner: null });
      } else {
        st.phase = 'lobby'; st.timer = TOWER.lobbyTime; st.seed = newSeed(); st.bananas = [];
        room.emit('lobby', { seed: st.seed, timer: st.timer });
      }
    }
    const ps = [];
    for (const p of room.players.values()) if (p.y != null) ps.push([p.id, p.nick, p.color, Math.round(p.x), Math.round(p.y), p.f, p.fx || '']);
    room.emit('s', { p: ps, ph: st.phase, tm: Math.max(0, Math.ceil(st.timer)) });
  },
};
