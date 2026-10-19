// 영어 퀴즈: 문제 만들기 + 채점 + Ambox 지급 (10문제 맞히면 Ambox 1개)
const { WORDS, GRAMMAR } = require('./words');
const db = require('./db');

const pending = new Map(); // userId -> { id, answer, choices, purpose }
let seq = 1;

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function wrongWords(correct, idx) {
  const set = new Set([correct[idx]]);
  const out = [];
  while (out.length < 3) {
    const w = pick(WORDS)[idx];
    if (!set.has(w)) { set.add(w); out.push(w); }
  }
  return out;
}

function makeQuestion() {
  const r = Math.random();
  if (r < 0.45) {
    const w = pick(WORDS);
    return { kind: '단어 뜻', text: `"${w[0]}" 의 뜻은?`, answer: w[1], wrong: wrongWords(w, 1) };
  }
  if (r < 0.7) {
    const w = pick(WORDS);
    return { kind: '영어로', text: `"${w[1]}" 를(을) 영어로 하면?`, answer: w[0], wrong: wrongWords(w, 0) };
  }
  const g = pick(GRAMMAR);
  return { kind: '영문법', text: g[0], answer: g[1], wrong: g.slice(2) };
}

function newQuestion(userId, purpose) {
  const q = makeQuestion();
  const choices = shuffle([q.answer, ...q.wrong]);
  const id = seq++;
  pending.set(userId, { id, answer: choices.indexOf(q.answer), choices, purpose: purpose || 'lobby' });
  return { id, kind: q.kind, text: q.text, choices };
}

// 반환: { ok, correct, answerIndex, purpose, earned, user }
function answer(userId, id, choice) {
  const p = pending.get(userId);
  if (!p || p.id !== id) return { ok: false };
  pending.delete(userId);
  const correct = choice === p.answer;
  const u = db.getUser(userId);
  let earned = false;
  if (u) {
    u.stats.solved++;
    if (correct) {
      u.stats.correct++;
      u.quizProgress++;
      if (u.quizProgress >= 10) { u.quizProgress = 0; u.ambox++; earned = true; }
    }
    db.save();
  }
  return { ok: true, correct, answerIndex: p.answer, purpose: p.purpose, earned };
}

module.exports = { newQuestion, answer };
