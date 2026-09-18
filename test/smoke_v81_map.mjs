// ============================================================
// smoke_v81_map.mjs — V8.1 等距地图视觉升级冒烟测试
// 验证：昼夜时辰推进 / 色调叠加参数 / 季节切换 / 粒子生成 /
//       公共方法存在性 / 默认值 / 边界值（子时/冬季）
// ============================================================
import { IsometricMap } from '../src/js/map.js';
import { SEASONS, TERRAIN } from '../src/js/data.js';

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; console.log(`  ✓ ${msg}`); }
  else { failed++; console.log(`  ✗ FAIL: ${msg}`); }
}

// ============================================================
// Mock DOM 环境（Node 无 window/document/canvas）
// ============================================================
const mockGradient = { addColorStop() {} };
const mockCtx = {
  canvas: null,
  _fillStyle: '#000', _strokeStyle: '#000', _globalAlpha: 1,
  _lineWidth: 1, _font: '', _textAlign: '', _composite: 'source-over',
  save() {}, restore() {}, translate() {}, scale() {}, rotate() {},
  beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, fill() {},
  stroke() {}, arc() {}, ellipse() {}, drawImage() {}, fillRect() {},
  clearRect() {}, rect() {}, quadraticCurveTo() {}, bezierCurveTo() {},
  setLineDash() {}, measureText() { return { width: 10 }; },
  fillText() {}, strokeText() {},
  createLinearGradient() { return mockGradient; },
  createRadialGradient() { return mockGradient; },
  createPattern() { return null; },
  get fillStyle() { return this._fillStyle; },
  set fillStyle(v) { this._fillStyle = v; },
  get strokeStyle() { return this._strokeStyle; },
  set strokeStyle(v) { this._strokeStyle = v; },
  get globalAlpha() { return this._globalAlpha; },
  set globalAlpha(v) { this._globalAlpha = v; },
  get lineWidth() { return this._lineWidth; },
  set lineWidth(v) { this._lineWidth = v; },
  get font() { return this._font; },
  set font(v) { this._font = v; },
  get textAlign() { return this._textAlign; },
  set textAlign(v) { this._textAlign = v; },
  get globalCompositeOperation() { return this._composite; },
  set globalCompositeOperation(v) { this._composite = v; },
  shadowBlur: 0, shadowColor: ''
};
const mockCanvas = {
  width: 1024, height: 600,
  getContext: () => mockCtx,
  addEventListener() {},
  parentElement: { clientWidth: 1024, clientHeight: 600 },
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 1024, height: 600 })
};
// 全局 mock
global.window = { addEventListener() {} };
global.document = { createElement: () => ({ width: 0, height: 0, getContext: () => mockCtx }) };
global.performance = { now: () => Date.now() };
global.requestAnimationFrame = () => 0;
global.cancelAnimationFrame = () => {};

// ============================================================
// 构造最小 game stub
// ============================================================
function makeStubGame() {
  const cities = new Map();
  // 放几个测试城市
  cities.set('c1', { id: 'c1', name: '测试城A', isoX: 6, isoY: 3, terrain: 'plain',
    size: 3, capital: true, owner: 'nanchao', garrison: 10000, pop: 50000 });
  cities.set('c2', { id: 'c2', name: '测试城B', isoX: 9, isoY: 5, terrain: 'river',
    size: 2, capital: false, owner: null, garrison: 5000, pop: 30000 });
  cities.set('c3', { id: 'c3', name: '测试城C', isoX: 4, isoY: 2, terrain: 'mountain',
    size: 2, capital: false, owner: 'dongwei', garrison: 8000, pop: 40000 });
  return {
    turn: 1,
    seasonIdx: 1, // 默认夏
    playerFaction: 'nanchao',
    cities: cities,
    armies: [],
    generals: new Map(),
    selectedCity: null,
    selectedArmy: null,
    isCityExplored: () => true,
    isCityCurrentlyVisible: () => true
  };
}

console.log('=== V8.1 等距地图视觉升级冒烟测试 ===\n');

// ===== 1. 默认值 =====
console.log('--- 1. 默认值 ---');
const map = new IsometricMap(mockCanvas);
assert(map.currentHour === 12, `默认 currentHour=12 (午时, 实际${map.currentHour})`);
assert(map.getSeason() === '夏', `默认季节=夏 (实际${map.getSeason()})`);
assert(map.getTimeOfDay() === '午', `默认时辰=午 (实际${map.getTimeOfDay()})`);

// ===== 2. 公共方法存在性 =====
console.log('\n--- 2. 公共方法存在性 ---');
const publicMethods = ['getTimeOfDay','getHourLabel','setHour','advanceHour',
  'getSeason','setSeason','advanceSeason','onTurnEnd','toJSON','fromJSON'];
for (const m of publicMethods) {
  assert(typeof map[m] === 'function', `公共方法存在: ${m}()`);
}

// ===== 3. 昼夜时辰推进 =====
console.log('\n--- 3. 昼夜时辰推进 ---');
map.setHour(12);
map.onTurnEnd(); // +4 → 16
assert(map.currentHour === 16, `onTurnEnd 推进 4h: 12→16 (实际${map.currentHour})`);
map.onTurnEnd(); // +4 → 20
assert(map.currentHour === 20, `onTurnEnd 推进 4h: 16→20 (实际${map.currentHour})`);
// 6 回合 = 一天
map.setHour(12);
for (let i = 0; i < 6; i++) map.onTurnEnd();
assert(map.currentHour === 12, `6 回合后回到同一天同一时辰: 12→${map.currentHour} (6×4=24h)`);

// ===== 4. 时辰名称对应 =====
console.log('\n--- 4. 时辰名称对应 ---');
map.setHour(0); assert(map.getTimeOfDay() === '子', `子时 hour=0 → 子 (实际${map.getTimeOfDay()})`);
map.setHour(3); assert(map.getTimeOfDay() === '寅', `寅时 hour=3 → 寅 (实际${map.getTimeOfDay()})`);
map.setHour(5); assert(map.getTimeOfDay() === '卯', `卯时 hour=5 → 卯 (实际${map.getTimeOfDay()})`);
map.setHour(9); assert(map.getTimeOfDay() === '巳', `巳时 hour=9 → 巳 (实际${map.getTimeOfDay()})`);
map.setHour(17); assert(map.getTimeOfDay() === '酉', `酉时 hour=17 → 酉 (实际${map.getTimeOfDay()})`);
map.setHour(21); assert(map.getTimeOfDay() === '亥', `亥时 hour=21 → 亥 (实际${map.getTimeOfDay()})`);

// ===== 5. 色调叠加参数 =====
console.log('\n--- 5. 色调叠加参数 ---');
map.setHour(12);
let ov = map._getTimeOverlay(12);
assert(ov.alpha === 0, `正午(12点)无叠加 alpha=0 (实际${ov.alpha})`);
map.setHour(5); // 卯时晨曦
ov = map._getTimeOverlay(5);
assert(ov.alpha > 0.1 && ov.alpha < 0.2, `卯时(5点)晨曦 alpha≈0.15 (实际${ov.alpha.toFixed(3)})`);
assert(ov.r > ov.b, `卯时橙红色 r>b (r=${ov.r}, b=${ov.b})`);
map.setHour(17); // 酉时黄昏
ov = map._getTimeOverlay(17);
assert(ov.alpha >= 0.18 && ov.alpha <= 0.22, `酉时(17点)黄昏 alpha≈0.20 (实际${ov.alpha.toFixed(3)})`);
map.setHour(22); // 深夜
ov = map._getTimeOverlay(22);
assert(ov.alpha >= 0.33, `深夜(22点)深蓝 alpha≈0.35 (实际${ov.alpha.toFixed(3)})`);
assert(ov.b > ov.r && ov.b > ov.g, `深夜蓝色调 b>r,g (r=${ov.r},g=${ov.g},b=${ov.b})`);
map.setHour(3); // 寅时黎明前
ov = map._getTimeOverlay(3);
assert(ov.alpha > 0.2 && ov.alpha < 0.3, `寅时(3点)暗蓝 alpha≈0.25 (实际${ov.alpha.toFixed(3)})`);

// ===== 6. 平滑插值（相邻时辰间不跳变）=====
console.log('\n--- 6. 平滑插值 ---');
const ov5 = map._getTimeOverlay(5).alpha;
const ov6 = map._getTimeOverlay(6).alpha;
const ov7 = map._getTimeOverlay(7).alpha;
assert(ov5 > ov6 && ov6 > ov7, `晨曦→白昼平滑递减: ${ov5.toFixed(2)}>${ov6.toFixed(2)}>${ov7.toFixed(2)}`);
const ov17 = map._getTimeOverlay(17).alpha;
const ov18 = map._getTimeOverlay(18).alpha;
const ov19 = map._getTimeOverlay(19).alpha;
assert(ov17 < ov18 && ov18 < ov19, `黄昏→夜晚平滑递增: ${ov17.toFixed(2)}<${ov18.toFixed(2)}<${ov19.toFixed(2)}`);

// ===== 7. 季节切换（读取 game.seasonIdx）=====
console.log('\n--- 7. 季节切换 ---');
const stub = makeStubGame();
map.game = stub;
map._lastSeasonIdx = 1;
assert(map.getSeason() === '夏', `game.seasonIdx=1 → 夏 (实际${map.getSeason()})`);
map.setSeason(0);
assert(stub.seasonIdx === 0 && map.getSeason() === '春', `setSeason(0)→春 并写入 game (实际${map.getSeason()})`);
map.setSeason('秋');
assert(stub.seasonIdx === 2 && map.getSeason() === '秋', `setSeason('秋')→秋 (实际${map.getSeason()})`);
map.advanceSeason();
assert(stub.seasonIdx === 3 && map.getSeason() === '冬', `advanceSeason()→冬 (实际${map.getSeason()})`);
map.advanceSeason();
assert(stub.seasonIdx === 0 && map.getSeason() === '春', `advanceSeason() 循环→春 (实际${map.getSeason()})`);

// ===== 8. 季节地形色调 =====
console.log('\n--- 8. 季节地形色调 ---');
map.setSeason(0); // 春
const springColor = map._seasonTerrainColor('#4A7C3A', 'plain');
assert(springColor.includes('rgb'), `春草地返回 rgb() 字符串 (实际${springColor})`);
map.setSeason(2); // 秋
const autumnColor = map._seasonTerrainColor('#4A7C3A', 'plain');
assert(autumnColor.includes('rgb'), `秋草地返回 rgb() 字符串 (实际${autumnColor})`);
map.setSeason(3); // 冬
const winterColor = map._seasonTerrainColor('#4A7C3A', 'plain');
assert(winterColor.includes('rgb'), `冬草地返回 rgb() 字符串 (实际${winterColor})`);
// 非草地地形不调整
const mountainSpring = map._seasonTerrainColor('#7A6B5A', 'mountain');
assert(mountainSpring === '#7A6B5A', `山地不随季节变色 (实际${mountainSpring})`);

// ===== 9. 粒子生成与上限 =====
console.log('\n--- 9. 粒子生成与上限 ---');
assert(Array.isArray(map._clouds) && map._clouds.length >= 3 && map._clouds.length <= 5,
  `云层数量 3-5 朵 (实际${map._clouds.length})`);
assert(Array.isArray(map._smokeParticles), `炊烟粒子数组存在`);
assert(Array.isArray(map._ambientParticles), `氛围粒子数组存在`);

// 模拟时间推进触发粒子生成
map.game = stub;
map.setSeason(3); // 冬（飘雪）
map.setHour(12);  // 白天
map._ambientParticles.length = 0;
map._ambientTimer = 0;
// 推进多帧 dt
for (let i = 0; i < 30; i++) map._updateAtmosphere(0.1);
assert(map._ambientParticles.length > 0, `冬季飘雪粒子生成 (实际${map._ambientParticles.length})`);
// 粒子总数 ≤ 80
const totalParticles = map._smokeParticles.length + map._ambientParticles.length;
assert(totalParticles <= 80, `氛围粒子总数≤80 (实际${totalParticles})`);

// 夏季不生成氛围粒子
map.setSeason(1); // 夏
map._ambientParticles.length = 0;
map._ambientTimer = 0;
for (let i = 0; i < 30; i++) map._updateAtmosphere(0.1);
assert(map._ambientParticles.length === 0, `夏季无氛围粒子 (实际${map._ambientParticles.length})`);

// 白天生成炊烟
map.setSeason(1);
map.setHour(12);
map._smokeParticles.length = 0;
map._smokeTimer = 0;
for (let i = 0; i < 30; i++) map._updateAtmosphere(0.1);
assert(map._smokeParticles.length > 0, `白天炊烟粒子生成 (实际${map._smokeParticles.length})`);

// ===== 10. 夜晚灯火判断 =====
console.log('\n--- 10. 夜晚灯火判断 ---');
map.setHour(0);
assert(map._isNight() === true, `子时(0点)为夜晚`);
map.setHour(12);
assert(map._isNight() === false, `午时(12点)非夜晚`);
map.setHour(20);
assert(map._isNight() === true, `戌时(20点)为夜晚`);
map.setHour(6);
assert(map._isNight() === false, `卯时(6点)为白天`);

// ===== 11. 序列化 toJSON/fromJSON =====
console.log('\n--- 11. 序列化 ---');
map.setHour(8);
map._turnCount = 42;
const json = map.toJSON();
assert(typeof json.currentHour === 'number', `toJSON 含 currentHour (实际${json.currentHour})`);
assert(json.turnCount === 42, `toJSON 含 turnCount (实际${json.turnCount})`);
assert(!('currentSeason' in json), `toJSON 不含季节（由 game 存档处理）`);
// 还原
map.setHour(0);
map._turnCount = 0;
map.fromJSON(json);
assert(map.currentHour === 8, `fromJSON 还原 currentHour=8 (实际${map.currentHour})`);
assert(map._turnCount === 42, `fromJSON 还原 turnCount=42 (实际${map._turnCount})`);

// ===== 12. 边界值：子时 =====
console.log('\n--- 12. 边界值：子时 ---');
map.setHour(0);
assert(map.getTimeOfDay() === '子', `hour=0 → 子时`);
map.setHour(23);
assert(map.getTimeOfDay() === '子', `hour=23 → 子时`);
// setHour 负数回绕
map.setHour(-1);
assert(map.currentHour === 23, `setHour(-1) 回绕为 23 (实际${map.currentHour})`);
// advanceHour 跨日
map.setHour(22);
map.advanceHour(4);
assert(map.currentHour === 2, `advanceHour(4) 22→2 跨日 (实际${map.currentHour})`);

// ===== 13. 边界值：冬季地形雪 =====
console.log('\n--- 13. 边界值：冬季 ---');
map.setSeason(3);
assert(map.getSeason() === '冬', `冬季生效`);
// 冬季山地应有积雪标记（_seasonIdx 返回 3）
assert(map._seasonIdx() === 3, `_seasonIdx()=3 冬季`);
// 冬季草地灰白
const winterGrass = map._seasonTerrainColor('#4A7C3A', 'plain');
assert(winterGrass !== '#4A7C3A', `冬季草地颜色变化 (实际${winterGrass})`);

// ===== 14. getHourLabel 格式化 =====
console.log('\n--- 14. getHourLabel ---');
map.setHour(12);
const label = map.getHourLabel();
assert(label.includes('午') && label.includes('12'), `getHourLabel 包含时辰和小时 (实际"${label}")`);
map.setHour(0);
const label0 = map.getHourLabel();
assert(label0.includes('子'), `子时标签包含"子" (实际"${label0}")`);

// ===== 15. 换季 dirty 检测 =====
console.log('\n--- 15. 换季 dirty 检测 ---');
map.game = stub;
map.setSeason(1); // 夏
map.dirty = false;
map._lastSeasonIdx = 1;
// 用 spy 检测静态层是否重建
let rebuildCount = 0;
const origBuild = map._buildStaticLayer.bind(map);
map._buildStaticLayer = (w, h) => { rebuildCount++; origBuild(w, h); };
stub.seasonIdx = 2; // 秋（模拟 game 换季）
map.render(); // 应检测到季节变化 → 重建静态层
assert(rebuildCount > 0, `render() 检测到换季并重建静态层 (重建${rebuildCount}次)`);
// 未换季时不重复重建
rebuildCount = 0;
map.render();
assert(rebuildCount === 0, `未换季时不重复重建静态层 (重建${rebuildCount}次)`);
map._buildStaticLayer = origBuild;

// ===== 16. 云循环滚动 =====
console.log('\n--- 16. 云循环滚动 ---');
const cloudX0 = map._clouds[0].x;
map._updateClouds(1.0); // 推进 1 秒
assert(map._clouds[0].x !== cloudX0, `云层横向移动 (${cloudX0.toFixed(1)} → ${map._clouds[0].x.toFixed(1)})`);

// ===== 17. 无 game 时不崩溃 =====
console.log('\n--- 17. 无 game 时安全降级 ---');
map.game = null;
assert(map.getSeason() === '夏', `无 game 时默认夏季`);
assert(typeof map._getTimeOverlay(12).alpha === 'number', `色调计算不依赖 game`);

console.log(`\n=== 测试结果: ${passed} 通过, ${failed} 失败 ===`);
process.exit(failed > 0 ? 1 : 0);
