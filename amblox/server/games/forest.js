// 99나이트 앳 더 영어 포레스트 — 함께 모닥불을 지키며 99번의 밤을 버텨요!
// 광신도를 공격하려면 영어 문제를 맞혀 무기를 충전해야 해요.
const { FOREST, FOREST_CLASSES } = require('../../public/shared/defs');

const [FX, FY] = FOREST.fire;
const R = (a, b) => a + Math.random() * (b - a);

function makeWorld() {
  const trees = [], bushes = [];
  let id = 1;
  while (trees.length < 90) {
    const x = R(60, FOREST.w - 60), y = R(60, FOREST.h - 60);
    if (Math.hypot(x - FX, y - FY) < 260) continue;
    if (Math.hypot(x - FOREST.pond[0], y - FOREST.pond[1]) < FOREST.pond[2] + 40) continue;
    trees.push({ id: id++, x: Math.round(x), y: Math.round(y), wood: 4 });
  }
  while (bushes.length < 30) {
    const x = R(80, FOREST.w - 80), y = R(80, FOREST.h - 80);
    if (Math.hypot(x - FX, y - FY) < 200) continue;
    bushes.push({ id: id++, x: Math.round(x), y: Math.round(y), b: 3 });
  }
  return { trees, bushes };
}

function fresh() {
  const w = makeWorld();
  return {
    phase: 'day', timer: FOREST.dayTime, night: 0, fuel: 70,
    trees: w.trees, bushes: w.bushes, cultists: [], cSeq: 1, spawnLeft: 0, spawnT: 0,
    over: false, overT: 0, resDirty: true,
  };
}

function fireRadius(st) { return 90 + st.fuel * 2.2; }

function maxHp(p) { return p.cls === 'brawler' ? 150 : 100; }

function resetPlayer(p, full) {
  p.x = FX + R(-60, 60); p.y = FY + R(-60, 60);
  p.hp = full ? maxHp(p) : Math.ceil(maxHp(p) / 2);
  p.alive = true;
  if (full) { p.food = 100; p.wood = 0; p.berries = 2; p.charges = 0; p.kills = 0; }
  p.actT = 0;
}

module.exports = {
  max: 6,
  tickMs: 100,
  create: () => fresh(),
  canJoin: (room) => !room.state.over,
  onJoin(room, p) { p.cls = 'camper'; resetPlayer(p, true); room.state.resDirty = true; },
  initFor(room, p) { return { x: p.x, y: p.y }; },
  onLeave() {},
  onMsg(room, p, t, d) {
    const st = room.state;
    if (t === 'class' && FOREST_CLASSES[d.cls]) {
      p.cls = d.cls; p.hp = Math.min(p.hp, maxHp(p));
      return;
    }
    if (t === 'pos') {
      if (!p.alive) return;
      p.x = Math.max(0, Math.min(FOREST.w, +d.x || 0));
      p.y = Math.max(0, Math.min(FOREST.h, +d.y || 0));
      return;
    }
    if (!p.alive || st.over) return;
    const now = Date.now();
    if (t === 'act') {
      // 가까운 물건에 따라 자동으로 행동해요: 모닥불 → 나무 넣기 / 나무 → 베기 / 덤불 → 열매 / 연못 → 낚시
      if (now < p.actT) return;
      if (Math.hypot(p.x - FX, p.y - FY) < 120 && p.wood > 0) {
        const per = p.cls === 'camper' ? 12 : 8;
        st.fuel = Math.min(100, st.fuel + p.wood * per);
        room.emitTo(p.id, 'msg', `🔥 나무 ${p.wood}개를 넣었어요!`);
        p.wood = 0; p.actT = now + 300;
        return;
      }
      const tree = st.trees.filter((tr) => tr.wood > 0 && Math.hypot(tr.x - p.x, tr.y - p.y) < 75)
        .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
      if (tree) {
        if (p.wood >= 10) { room.emitTo(p.id, 'msg', '나무를 더 들 수 없어요! 모닥불에 넣어요'); return; }
        tree.wood--; p.wood++; st.resDirty = true;
        p.actT = now + (p.cls === 'lumberjack' ? 250 : 550);
        room.emit('chop', { x: tree.x, y: tree.y });
        return;
      }
      const bush = st.bushes.find((b) => b.b > 0 && Math.hypot(b.x - p.x, b.y - p.y) < 65);
      if (bush) {
        bush.b--; p.berries += p.cls === 'scavenger' ? 2 : 1; st.resDirty = true;
        p.actT = now + 400;
        return;
      }
      if (p.cls === 'fisherman' && Math.hypot(p.x - FOREST.pond[0], p.y - FOREST.pond[1]) < FOREST.pond[2] + 50) {
        p.berries += 1; p.actT = now + 1500;
        room.emitTo(p.id, 'msg', '🐟 물고기를 잡았어요!');
      }
    } else if (t === 'eat') {
      if (p.berries <= 0 || p.food >= 100) return;
      p.berries--; p.food = Math.min(100, p.food + (p.cls === 'cook' ? 50 : 25));
    } else if (t === 'attack') {
      if (p.charges <= 0) { room.emitTo(p.id, 'msg', '무기가 비었어요! Q를 눌러 영어 문제를 풀어요'); return; }
      if (now < (p.atkT || 0)) return;
      p.atkT = now + 350;
      const range = p.cls === 'ranger' ? 240 : 80;
      const ang = Math.atan2(+d.dy || 0, +d.dx || 1);
      let best = null, bd = Infinity;
      for (const c of st.cultists) {
        const dist = Math.hypot(c.x - p.x, c.y - p.y);
        if (dist > range + 20) continue;
        let da = Math.abs(Math.atan2(c.y - p.y, c.x - p.x) - ang);
        if (da > Math.PI) da = 2 * Math.PI - da;
        if (da < 0.9 && dist < bd) { bd = dist; best = c; }
      }
      p.charges--;
      room.emit('swing', { id: p.id, a: ang, r: range });
      if (!best) return;
      let dmg = 34;
      if (p.cls === 'hunter') dmg *= 1.5;
      if (p.cls === 'berserker' && p.hp < maxHp(p) * 0.4) dmg *= 2;
      if (p.cls === 'assassin' && !best.hitBy) dmg *= 3;
      best.hitBy = true;
      best.hp -= dmg;
      if (best.hp <= 0) { p.kills++; room.emit('kill', { x: best.x, y: best.y, by: p.nick }); }
      st.cultists = st.cultists.filter((c) => c.hp > 0);
    }
  },
  onQuiz(room, p, correct, purpose) {
    if (purpose !== 'forest' || !correct) return;
    p.charges = Math.min(30, p.charges + (p.cls === 'blacksmith' ? 8 : 5));
  },
  tick(room, dt) {
    const st = room.state;
    const ps = [...room.players.values()];
    if (st.over) {
      st.overT -= dt;
      if (st.overT <= 0) {
        Object.assign(st, fresh());
        ps.forEach((p) => resetPlayer(p, true));
        room.emit('restart', {});
      }
      room.emit('s', { over: true });
      return;
    }
    st.timer -= dt;
    if (st.timer <= 0) {
      if (st.phase === 'day') {
        st.phase = 'night'; st.night++; st.timer = FOREST.nightTime;
        st.spawnLeft = Math.min(40, 2 + Math.floor(st.night * 1.5)); st.spawnT = 0;
        room.emit('phase', { phase: 'night', night: st.night });
      } else {
        if (st.night >= FOREST.maxNights) {
          st.over = true; st.overT = 15;
          room.emit('over', { win: true, night: st.night });
          return;
        }
        st.phase = 'day'; st.timer = FOREST.dayTime; st.cultists = [];
        st.trees.forEach((tr) => { tr.wood = Math.min(4, tr.wood + 2); });
        st.bushes.forEach((b) => { b.b = Math.min(3, b.b + 2); });
        st.resDirty = true;
        ps.forEach((p) => { if (!p.alive) resetPlayer(p, false); });
        room.emit('phase', { phase: 'day', night: st.night });
      }
    }
    // 모닥불이 줄어들어요
    st.fuel = Math.max(0, st.fuel - dt * (st.phase === 'night' ? 0.9 : 0.35));
    const fr = fireRadius(st);
    // 광신도 등장
    if (st.phase === 'night' && st.spawnLeft > 0) {
      st.spawnT -= dt;
      if (st.spawnT <= 0) {
        st.spawnT = 1.2; st.spawnLeft--;
        const side = Math.floor(Math.random() * 4);
        const x = side === 0 ? 20 : side === 1 ? FOREST.w - 20 : R(0, FOREST.w);
        const y = side === 2 ? 20 : side === 3 ? FOREST.h - 20 : R(0, FOREST.h);
        const hp = 100 + st.night * 6;
        st.cultists.push({ id: st.cSeq++, x, y, hp, max: hp, hitT: 0 });
      }
    }
    // 광신도 움직임
    const speed = Math.min(150, 85 + st.night * 1.2);
    for (const c of st.cultists) {
      let target = null, bd = Infinity;
      for (const p of ps) {
        if (!p.alive) continue;
        const dd = Math.hypot(p.x - c.x, p.y - c.y);
        if (dd < bd) { bd = dd; target = p; }
      }
      c.hitT = Math.max(0, c.hitT - dt);
      if (target) {
        if (bd > 26) {
          c.x += ((target.x - c.x) / bd) * speed * dt;
          c.y += ((target.y - c.y) / bd) * speed * dt;
        } else if (c.hitT <= 0) {
          c.hitT = 1;
          target.hp -= 9 + Math.floor(st.night / 10);
          room.emitTo(target.id, 'hurt', {});
        }
      }
      // 광신도는 모닥불 빛을 무서워해요
      const df = Math.hypot(c.x - FX, c.y - FY);
      if (df < fr) { c.x = FX + ((c.x - FX) / (df || 1)) * fr; c.y = FY + ((c.y - FY) / (df || 1)) * fr; }
    }
    // 플레이어 상태
    for (const p of ps) {
      if (!p.alive) continue;
      p.food = Math.max(0, p.food - dt * 0.5);
      if (p.food <= 0) p.hp -= dt * 1.5;
      const nearFire = Math.hypot(p.x - FX, p.y - FY) < fr;
      if (nearFire && p.food > 40) p.hp = Math.min(maxHp(p), p.hp + dt * 1.5);
      if (p.cls === 'medic') {
        for (const o of ps) if (o.alive && Math.hypot(o.x - p.x, o.y - p.y) < 160) o.hp = Math.min(maxHp(o), o.hp + dt * 2);
      }
      if (p.hp <= 0) {
        p.alive = false; p.hp = 0;
        room.emit('dead', { nick: p.nick });
      }
    }
    if (st.phase === 'night' && ps.length && ps.every((p) => !p.alive)) {
      st.over = true; st.overT = 12;
      room.emit('over', { win: false, night: st.night });
    }
    const snap = {
      ph: st.phase, tm: Math.ceil(st.timer), n: st.night, f: Math.round(st.fuel), fr: Math.round(fr),
      p: ps.map((p) => ({
        id: p.id, nick: p.nick, color: p.color, cls: p.cls, x: Math.round(p.x), y: Math.round(p.y),
        hp: Math.ceil(p.hp), mhp: maxHp(p), food: Math.ceil(p.food), wood: p.wood, ber: p.berries, ch: p.charges, k: p.kills, alive: p.alive,
      })),
      c: st.cultists.map((c) => [c.id, Math.round(c.x), Math.round(c.y), Math.round((c.hp / c.max) * 100)]),
    };
    if (st.resDirty) { snap.trees = st.trees; snap.bushes = st.bushes; st.resDirty = false; }
    room.emit('s', snap);
  },
};
