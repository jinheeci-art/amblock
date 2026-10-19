// 게임 방(room) 관리: 모든 게임이 같은 방식으로 들어오고 나가요.
const GAMES = {
  battle: require('./games/battle'),
  tower: require('./games/tower'),
  forest: require('./games/forest'),
  tsunami: require('./games/tsunami'),
  rivals: require('./games/rivals'),
};

const rooms = new Map();      // roomId -> Room
const whereIs = new Map();    // userId -> roomId
let roomSeq = 1;
let io = null;

class Room {
  constructor(gameKey) {
    this.id = gameKey + '-' + (roomSeq++);
    this.game = gameKey;
    this.def = GAMES[gameKey];
    this.players = new Map(); // userId -> player
    this.state = this.def.create(this);
    this.last = Date.now();
    this.timer = setInterval(() => {
      const now = Date.now();
      const dt = Math.min(0.25, (now - this.last) / 1000);
      this.last = now;
      try { this.def.tick(this, dt); } catch (e) { console.error(this.id, e); }
    }, this.def.tickMs);
  }
  emit(t, d) { io.to(this.id).emit('g', { t, d }); }
  emitTo(userId, t, d) {
    const p = this.players.get(userId);
    if (p) io.to(p.socketId).emit('g', { t, d });
  }
  destroy() { clearInterval(this.timer); rooms.delete(this.id); }
}

function init(_io) { io = _io; }

function join(socket, user, gameKey, roomId) {
  const def = GAMES[gameKey];
  if (!def) return { ok: false, error: '없는 게임이에요' };
  leave(socket, user.id);

  let room = roomId && rooms.get(roomId);
  if (room && (room.game !== gameKey || room.players.size >= room.def.max || !room.def.canJoin(room))) {
    return { ok: false, error: '방이 꽉 찼거나 들어갈 수 없어요' };
  }
  if (!room) {
    for (const r of rooms.values()) {
      if (r.game === gameKey && r.players.size < r.def.max && r.def.canJoin(r)) { room = r; break; }
    }
  }
  if (!room) { room = new Room(gameKey); rooms.set(room.id, room); }

  const player = { id: user.id, nick: user.nick, color: user.color, socketId: socket.id, user };
  room.players.set(user.id, player);
  whereIs.set(user.id, room.id);
  socket.join(room.id);
  def.onJoin(room, player);
  return { ok: true, roomId: room.id, init: def.initFor(room, player) };
}

function leave(socket, userId) {
  const roomId = whereIs.get(userId);
  if (!roomId) return;
  whereIs.delete(userId);
  const room = rooms.get(roomId);
  if (!room) return;
  const p = room.players.get(userId);
  if (socket) socket.leave(roomId);
  if (p && (!socket || p.socketId === socket.id)) {
    room.players.delete(userId);
    room.def.onLeave(room, p);
  }
  if (room.players.size === 0) room.destroy();
}

function roomOf(userId) { const id = whereIs.get(userId); return id ? rooms.get(id) : null; }

function message(userId, socketId, t, d) {
  const room = roomOf(userId);
  if (!room) return;
  const p = room.players.get(userId);
  if (!p || p.socketId !== socketId) return;
  try { room.def.onMsg(room, p, t, d || {}); } catch (e) { console.error(room.id, e); }
}

function quizResult(userId, correct, purpose) {
  const room = roomOf(userId);
  if (!room || !room.def.onQuiz) return;
  const p = room.players.get(userId);
  if (p) room.def.onQuiz(room, p, correct, purpose);
}

function counts() {
  const c = {};
  for (const k of Object.keys(GAMES)) c[k] = 0;
  for (const r of rooms.values()) c[r.game] += r.players.size;
  return c;
}

function statusOf(userId) {
  const room = roomOf(userId);
  return room ? { game: room.game, roomId: room.id } : null;
}

module.exports = { init, join, leave, message, quizResult, counts, statusOf, GAMES };
