// 암 라이벌 — 무기를 사서 싸우는 대전! 총알을 다시 채우려면 영어 문제를 맞혀야 해요.
const { RIVAL_WEAPONS, RIVALS } = require('../../public/shared/defs');

function spawnPoint() { return RIVALS.spawns[Math.floor(Math.random() * RIVALS.spawns.length)]; }

function respawn(p) {
  const [x, y] = spawnPoint();
  p.x = x; p.y = y; p.hp = RIVALS.maxHp; p.alive = true; p.respawnT = 0;
}

function resetRound(room) {
  const st = room.state;
  st.phase = 'play'; st.timer = RIVALS.roundTime; st.winner = null;
  for (const p of room.players.values()) {
    p.kills = 0; p.deaths = 0; respawn(p);
    for (const k in p.ammo) p.ammo[k] = RIVAL_WEAPONS[k].mag;
    room.emitTo(p.id, 'respawn', { x: p.x, y: p.y, ammo: p.ammo });
  }
  room.emit('round', {});
}

module.exports = {
  max: 8,
  tickMs: 50,
  create: () => ({ phase: 'play', timer: RIVALS.roundTime, winner: null, endT: 0 }),
  canJoin: () => true,
  onJoin(room, p) {
    p.kills = 0; p.deaths = 0; p.a = 0; p.w = 'water'; p.ammo = {}; p.last = {}; p.hitBudget = 0;
    for (const k of p.user.weapons.rivals) p.ammo[k] = RIVAL_WEAPONS[k].mag;
    respawn(p);
  },
  initFor(room, p) {
    return { x: p.x, y: p.y, owned: p.user.weapons.rivals, ammo: p.ammo, phase: room.state.phase };
  },
  onLeave() {},
  onMsg(room, p, t, d) {
    const st = room.state;
    if (t === 'pos') {
      if (!p.alive) return;
      p.x = +d.x || 0; p.y = +d.y || 0; p.a = +d.a || 0;
      if (p.user.weapons.rivals.includes(d.w)) {
        p.w = d.w;
        if (p.ammo[d.w] == null) { p.ammo[d.w] = RIVAL_WEAPONS[d.w].mag; room.emitTo(p.id, 'ammo', p.ammo); }
      }
    } else if (t === 'shoot') {
      const w = RIVAL_WEAPONS[d.w];
      if (!w || !p.alive || st.phase !== 'play' || !p.user.weapons.rivals.includes(d.w)) return;
      const now = Date.now();
      if ((p.ammo[d.w] || 0) <= 0 || now - (p.last[d.w] || 0) < w.rate * 800) return;
      p.last[d.w] = now;
      p.ammo[d.w]--;
      p.hitBudget = Math.min(30, p.hitBudget + w.pellets * (w.splash ? 4 : 1));
      room.emit('shot', { id: p.id, x: Math.round(d.x), y: Math.round(d.y), a: +d.a, w: d.w });
      room.emitTo(p.id, 'ammo', p.ammo);
    } else if (t === 'hit') {
      const w = RIVAL_WEAPONS[d.w];
      const target = room.players.get(d.target);
      if (!w || !target || target === p || !target.alive || !p.alive || st.phase !== 'play' || p.hitBudget <= 0) return;
      if (Math.hypot(target.x - p.x, target.y - p.y) > w.range + 200) return;
      p.hitBudget--;
      target.hp -= w.dmg;
      room.emit('dmg', { id: target.id, hp: target.hp, by: p.id });
      if (target.hp <= 0) {
        target.alive = false; target.respawnT = RIVALS.respawn; target.deaths++;
        p.kills++;
        room.emit('kill', { killer: p.nick, victim: target.nick, w: d.w, id: target.id });
        if (p.kills >= RIVALS.killsToWin) {
          st.phase = 'end'; st.endT = RIVALS.endTime; st.winner = p.nick;
          p.user.stats.wins++; global.AMBLOX.db.save();
          room.emit('end', { winner: p.nick });
        }
      }
    }
  },
  onQuiz(room, p, correct, purpose) {
    if (purpose !== 'rivals' || !correct) return;
    if (p.ammo[p.w] != null) p.ammo[p.w] = RIVAL_WEAPONS[p.w].mag;
    room.emitTo(p.id, 'ammo', p.ammo);
  },
  tick(room, dt) {
    const st = room.state;
    if (st.phase === 'play') {
      st.timer -= dt;
      if (st.timer <= 0) {
        const best = [...room.players.values()].sort((a, b) => b.kills - a.kills)[0];
        st.phase = 'end'; st.endT = RIVALS.endTime; st.winner = best && best.kills > 0 ? best.nick : null;
        room.emit('end', { winner: st.winner });
      }
    } else {
      st.endT -= dt;
      if (st.endT <= 0) resetRound(room);
    }
    for (const p of room.players.values()) {
      if (!p.alive) {
        p.respawnT -= dt;
        if (p.respawnT <= 0) { respawn(p); room.emitTo(p.id, 'respawn', { x: p.x, y: p.y, ammo: p.ammo }); }
      }
    }
    room.emit('s', {
      p: [...room.players.values()].map((p) => [p.id, p.nick, p.color, Math.round(p.x), Math.round(p.y), +p.a.toFixed(2), p.w, Math.max(0, p.hp), p.alive ? 1 : 0, p.kills, p.deaths]),
      tm: Math.ceil(Math.max(0, st.phase === 'play' ? st.timer : st.endT)), ph: st.phase,
    });
  },
};
