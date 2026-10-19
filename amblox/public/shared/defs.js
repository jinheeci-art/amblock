// 서버(Node)와 브라우저가 함께 쓰는 게임 데이터
(function (E) {
  // ───────── 초6영어 대전쟁 유닛 ─────────
  E.UNITS = {
    bunny:   { name: '토끼 병사',     emoji: '🐰', cost: 50,  hp: 120,  atk: 12, range: 28,  speed: 55, rate: 0.8, cd: 2 },
    chick:   { name: '병아리 방패',   emoji: '🐥', cost: 100, hp: 450,  atk: 6,  range: 24,  speed: 35, rate: 1.0, cd: 4 },
    penguin: { name: '펭귄 궁수',     emoji: '🐧', cost: 150, hp: 90,   atk: 28, range: 150, speed: 40, rate: 1.4, cd: 5 },
    bear:    { name: '곰돌이 장군',   emoji: '🐻', cost: 250, hp: 600,  atk: 45, range: 34,  speed: 38, rate: 1.2, cd: 8 },
    unicorn: { name: '무지개 유니콘', emoji: '🦄', cost: 500, hp: 1000, atk: 90, range: 70,  speed: 50, rate: 1.5, cd: 15, splash: true },
  };
  E.UNIT_ORDER = ['bunny', 'chick', 'penguin', 'bear', 'unicorn'];
  E.BATTLE = { lane: 1200, baseHp: 2000, quizMoney: 120, cannonNeed: 5 };

  // ───────── 무기 타워 ─────────
  E.TOWER_WEAPONS = {
    banana:    { name: '바나나 껍질',   emoji: '🍌', price: 12, desc: '발밑에 바나나를 놓아 친구를 미끄러뜨려요' },
    freeze:    { name: '얼음 광선',     emoji: '❄️', price: 12, desc: '가까운 친구를 2.5초 동안 꽁꽁 얼려요', range: 350 },
    hammer:    { name: '뿅망치',        emoji: '🔨', price: 12, desc: '옆에 있는 친구를 멀리 날려버려요', range: 140 },
    lightning: { name: '번개',          emoji: '⚡', price: 12, desc: '내 위에 있는 친구를 아래로 떨어뜨려요', range: 700 },
    reverse:   { name: '뒤죽박죽 마법', emoji: '🌀', price: 12, desc: '친구의 방향키를 4초 동안 반대로!', range: 450 },
    honey:     { name: '끈끈이 꿀단지', emoji: '🍯', price: 12, desc: '친구를 5초 동안 느릿느릿하게', range: 400 },
  };
  E.TOWER = { playTime: 240, lobbyTime: 12, endTime: 8, cooldown: 7 };

  // ───────── 암 라이벌 ─────────
  E.RIVAL_WEAPONS = {
    water:   { name: '물총',      emoji: '🔫', price: 0,  dmg: 14, mag: 8,  rate: 0.28, speed: 720,  range: 650,  pellets: 1, spread: 0.04, color: '#4fc3f7' },
    bow:     { name: '활',        emoji: '🏹', price: 4,  dmg: 34, mag: 5,  rate: 0.6,  speed: 900,  range: 900,  pellets: 1, spread: 0,    color: '#a1887f' },
    shotgun: { name: '샷건',      emoji: '💥', price: 6,  dmg: 11, mag: 4,  rate: 0.75, speed: 750,  range: 380,  pellets: 6, spread: 0.35, color: '#ffb74d' },
    sniper:  { name: '저격총',    emoji: '🎯', price: 8,  dmg: 75, mag: 3,  rate: 1.3,  speed: 1700, range: 1600, pellets: 1, spread: 0,    color: '#e57373' },
    minigun: { name: '기관총',    emoji: '⚙️', price: 10, dmg: 7,  mag: 40, rate: 0.08, speed: 850,  range: 700,  pellets: 1, spread: 0.12, color: '#fff176' },
    rocket:  { name: '로켓 런처', emoji: '🚀', price: 12, dmg: 55, mag: 2,  rate: 1.1,  speed: 520,  range: 900,  pellets: 1, spread: 0,    color: '#ff7043', splash: 110 },
  };
  E.RIVAL_ORDER = ['water', 'bow', 'shotgun', 'sniper', 'minigun', 'rocket'];
  E.RIVALS = {
    w: 1600, h: 1000, killsToWin: 10, roundTime: 180, endTime: 8, maxHp: 100, respawn: 3,
    walls: [
      [350, 200, 60, 250], [1190, 550, 60, 250], [700, 120, 200, 50], [700, 830, 200, 50],
      [740, 430, 120, 140], [150, 700, 220, 50], [1230, 250, 220, 50], [480, 620, 50, 150], [1070, 230, 50, 150],
    ],
    spawns: [[100, 100], [1500, 100], [100, 900], [1500, 900], [800, 300], [800, 700], [300, 500], [1300, 500]],
  };
  // 샷건 같은 여러 발 무기의 퍼짐(모든 화면에서 똑같이 보이도록 고정값)
  E.PELLET_OFFSETS = [0, -0.6, 0.6, -0.3, 0.3, -0.9, 0.9, 0.15];

  // ───────── 99나이트 앳 더 영어 포레스트 (직업 전부 무료!) ─────────
  E.FOREST_CLASSES = {
    camper:     { name: '캠퍼',       emoji: '⛺', desc: '모닥불에 나무를 넣으면 1.5배로 타올라요' },
    lumberjack: { name: '나무꾼',     emoji: '🪓', desc: '나무를 2배 빨리 베요' },
    medic:      { name: '의무병',     emoji: '🩹', desc: '주변 친구와 나의 체력을 천천히 회복시켜요' },
    ranger:     { name: '레인저',     emoji: '🔫', desc: '총으로 멀리 있는 광신도도 공격해요 (사거리 3배)' },
    hunter:     { name: '사냥꾼',     emoji: '🏹', desc: '공격력이 1.5배예요' },
    cook:       { name: '요리사',     emoji: '🍳', desc: '음식을 먹으면 배고픔이 2배로 채워져요' },
    scavenger:  { name: '정찰병',     emoji: '🎒', desc: '25% 빨리 달리고 열매를 2개씩 따요' },
    brawler:    { name: '격투가',     emoji: '🥊', desc: '최대 체력이 150이에요' },
    berserker:  { name: '광전사',     emoji: '😤', desc: '체력이 40% 이하면 공격력 2배!' },
    assassin:   { name: '암살자',     emoji: '🗡️', desc: '광신도를 처음 때릴 때 3배 피해' },
    blacksmith: { name: '대장장이',   emoji: '⚒️', desc: '문제를 맞히면 무기 충전이 8번 (보통 5번)' },
    fisherman:  { name: '어부',       emoji: '🎣', desc: '연못에서 물고기를 잡을 수 있어요' },
  };
  E.FOREST = { w: 2400, h: 2400, fire: [1200, 1200], pond: [1750, 600, 120], dayTime: 45, nightTime: 40, maxNights: 99 };

  // ───────── 쓰나미에서 포켓몬 찾기 ─────────
  E.RARITY = [
    { name: '흔함', color: '#9e9e9e', from: 450,  to: 2000 },
    { name: '보통', color: '#4caf50', from: 2000, to: 3500 },
    { name: '희귀', color: '#2196f3', from: 3500, to: 4800 },
    { name: '영웅', color: '#9c27b0', from: 4800, to: 5700 },
    { name: '전설', color: '#ffc107', from: 5600, to: 5900 },
  ];
  E.POKEMON = [
    { k: 'rattata',    name: '꼬렛',     color: '#9575cd', ear: 'round', rar: 0 },
    { k: 'pidgey',     name: '구구',     color: '#bc8f5f', ear: 'wing',  rar: 0 },
    { k: 'caterpie',   name: '캐터피',   color: '#7cb342', ear: 'ant',   rar: 0 },
    { k: 'weedle',     name: '뿔충이',   color: '#d4a056', ear: 'ant',   rar: 0 },
    { k: 'jigglypuff', name: '푸린',     color: '#f8a5c2', ear: 'point', rar: 0 },
    { k: 'pikachu',    name: '피카츄',   color: '#ffd600', ear: 'long',  rar: 1 },
    { k: 'charmander', name: '파이리',   color: '#ff8a50', ear: 'none',  rar: 1 },
    { k: 'squirtle',   name: '꼬부기',   color: '#64b5f6', ear: 'none',  rar: 1 },
    { k: 'bulbasaur',  name: '이상해씨', color: '#4db6ac', ear: 'point', rar: 1 },
    { k: 'psyduck',    name: '고라파덕', color: '#ffe082', ear: 'ant',   rar: 1 },
    { k: 'eevee',      name: '이브이',   color: '#a1887f', ear: 'long',  rar: 2 },
    { k: 'snorlax',    name: '잠만보',   color: '#37717a', ear: 'point', rar: 2 },
    { k: 'lapras',     name: '라프라스', color: '#4fc3f7', ear: 'point', rar: 2 },
    { k: 'gengar',     name: '팬텀',     color: '#7e57c2', ear: 'point', rar: 2 },
    { k: 'dragonite',  name: '망나뇽',   color: '#ffa726', ear: 'ant',   rar: 3 },
    { k: 'charizard',  name: '리자몽',   color: '#ff7043', ear: 'wing',  rar: 3 },
    { k: 'gyarados',   name: '갸라도스', color: '#1e88e5', ear: 'point', rar: 3 },
    { k: 'mew',        name: '뮤',       color: '#f48fb1', ear: 'round', rar: 4 },
  ];
  E.TSUNAMI = {
    w: 6000, h: 520, base: 350, waveSpeed: 520, crest: 70,
    shelters: [900, 1650, 2400, 3150, 3900, 4600, 5300].map(function (x) { return [x, 130]; }),
  };

  // ───────── 무기 타워 맵 만들기 (같은 seed면 모두에게 같은 탑) ─────────
  function rng(seed) {
    var s = (seed >>> 0) || 1;
    return function () { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  }
  E.rng = rng;
  E.genTower = function (seed) {
    var R = rng(seed), W = 800, sections = 5, per = 10, step = 85;
    var H = 300 + sections * (per * step + 120) + 140;
    var plats = [{ x: 0, y: H - 40, w: W, h: 40, t: 'floor' }];
    var y = H - 40, x = W / 2;
    for (var s = 0; s < sections; s++) {
      for (var i = 0; i < per; i++) {
        y -= step;
        var nw = Math.max(70, 150 - s * 12 - R() * 40);
        var prevX = x;
        x = Math.min(W - 70, Math.max(70, x + (R() * 2 - 1) * 220));
        var t = R() < 0.08 + s * 0.05 ? 'move' : 'n';
        plats.push({ x: x - nw / 2, y: y, w: nw, h: 16, t: t, ph: R() * 6 });
        if (s > 0 && R() < 0.3) {
          var kx = x > W / 2 ? x - 260 - R() * 80 : x + 180 + R() * 80;
          // 위험 발판은 점프하는 길(이전 발판 위)을 막지 않게 멀리 둬요
          if (kx > 10 && kx < W - 90 && Math.abs(kx + 40 - prevX) > 170) plats.push({ x: kx, y: y + 30, w: 80, h: 14, t: 'kill' });
        }
      }
      y -= 120;
      plats.push({ x: 0, y: y, w: W, h: 22, t: 'gate', g: s });
    }
    y -= 110;
    plats.push({ x: W / 2 - 130, y: y, w: 260, h: 20, t: 'goal' });
    return { w: W, h: H, plats: plats, goalY: y, startY: H - 40 };
  };
})(typeof module !== 'undefined' ? module.exports : (window.DEFS = {}));
