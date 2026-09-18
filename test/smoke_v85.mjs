// ============================================================
// smoke_v85.mjs — V8.5 冒烟测试
// 验证：历法节气系统 / 天文异象 / 后宫系统 / 新增武将(5) / 新增事件 / 存档读写
// ============================================================
import { GENERALS, NEW_GENERAL_SKILLS, SOLAR_TERMS, CELESTIAL_ANOMALIES,
         ANOMALY_BASE_CHANCE, HAREM_RANKS, HAREM_NAME_POOL,
         HAREM_BIRTH_BASE, HAREM_PRINCE_AGE_ADULT, EVENTS } from '../src/js/data.js';
import { CalendarSystem } from '../src/js/calendar.js';
import { HaremSystem } from '../src/js/harem.js';

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; console.log(`  ✓ ${msg}`); }
  else { failed++; console.log(`  ✗ FAIL: ${msg}`); }
}

console.log('=== V8.5 冒烟测试 ===\n');

// ===== 1. 二十四节气验证 =====
console.log('--- 1. 二十四节气 ---');
assert(SOLAR_TERMS.length === 24, `节气总数=24（实际${SOLAR_TERMS.length}）`);
const seasonCounts = [0, 0, 0, 0];
for (const t of SOLAR_TERMS) seasonCounts[t.season]++;
assert(seasonCounts.every(c => c === 6), `每季6个节气（${seasonCounts.join(',')}）`);
// 关键节气
const byId = Object.fromEntries(SOLAR_TERMS.map(t => [t.id, t]));
assert(byId.qingming && byId.qingming.special === 'qingming', `清明为特殊节气`);
assert(byId.dongzhi && byId.dongzhi.special === 'dongzhi', `冬至为特殊节气`);
assert(byId.licheng === undefined, `立春节气 id 为 lichun 而非 licheng`);
assert(byId.lichun && byId.dahan, `立春/大寒首尾俱全`);
// 节气循环
const cal = new CalendarSystem();
const startTerm = cal.term.id;
for (let i = 0; i < 24; i++) cal.advance();
assert(cal.term.id === startTerm, `节气24步循环回原点`);
// seasonIdx 派生
assert(typeof cal.seasonIdx === 'number' && cal.seasonIdx >= 0 && cal.seasonIdx < 4, `seasonIdx 合法`);

// ===== 2. 天文异象验证 =====
console.log('\n--- 2. 天文异象 ---');
assert(CELESTIAL_ANOMALIES.length === 5, `异象种类=5（实际${CELESTIAL_ANOMALIES.length}）`);
const anIds = CELESTIAL_ANOMALIES.map(a => a.id);
assert(anIds.includes('solar_eclipse') && anIds.includes('yinghuo_shouxing'), `含日食/荧惑守心`);
assert(ANOMALY_BASE_CHANCE > 0 && ANOMALY_BASE_CHANCE < 0.2, `异象概率在合理范围`);
// 异象事件注册
for (const a of CELESTIAL_ANOMALIES) {
  const ev = EVENTS.find(e => e.id === a.eventId);
  assert(!!ev, `异象事件已注册: ${a.eventId}`);
}

// ===== 3. 节气效果结算（mock game） =====
console.log('\n--- 3. 节气效果结算 ---');
const mockCities = [
  { morale: 50, agri: 40, comm: 40, religion: { culture: 0 } },
  { morale: 55, agri: 45, comm: 45, religion: { culture: 0 } }
];
const mockRes = { money: 1000, food: 1000, totalMorale: 60 };
const mockGame = {
  playerFaction: 'nanchao',
  factionRes: new Map([['nanchao', mockRes]]),
  getFactionCities: () => mockCities,
  pushLog: () => {},
  dynastySystem: null
};
cal.termIdx = SOLAR_TERMS.findIndex(t => t.id === 'qingming');
cal.applyTermEffects(mockGame);
assert(mockCities[0].religion.culture > 0, `清明文化加成生效`);
// 大寒负面
cal.termIdx = SOLAR_TERMS.findIndex(t => t.id === 'dahan');
const beforeMorale = mockCities[0].morale;
cal.applyTermEffects(mockGame);
assert(mockCities[0].morale < beforeMorale, `大寒民心下降`);

// ===== 4. 后宫系统验证 =====
console.log('\n--- 4. 后宫系统 ---');
assert(HAREM_RANKS.length === 5, `妃嫔五等（实际${HAREM_RANKS.length}）`);
assert(HAREM_RANKS[0].id === 'empress' && HAREM_RANKS[0].max === 1, `皇后1人`);
assert(HAREM_RANKS[4].id === 'meiren' && HAREM_RANKS[4].max === 99, `美人不限`);
assert(HAREM_NAME_POOL.length >= 10, `妃嫔姓名池充足`);
assert(HAREM_PRINCE_AGE_ADULT === 15, `皇子成年=15`);

const harem = new HaremSystem();
harem.init(['nanchao', 'xiwei'], new Map());
assert(harem.get('nanchao').consorts.length === 1, `开局立皇后1人`);
assert(harem.get('nanchao').consorts[0].rank === 'empress', `初始为皇后`);
// 纳妃
const r1 = harem.takeInConsort('nanchao', 'guifei');
assert(r1.ok, `可纳贵妃`);
const r2 = harem.takeInConsort('nanchao', 'guifei');
assert(r2.ok, `贵妃可至2人`);
const r3 = harem.takeInConsort('nanchao', 'guifei');
assert(!r3.ok, `贵妃满2人后拒绝`);
// 后宫加成袋
const bag = harem.getHaremBag('nanchao');
assert(bag.legit >= 5 && bag.morale >= 3, `后宫正统/民心加成正确`);

// 生育（mock game）
const mockGame2 = {
  playerFaction: 'nanchao',
  factionRes: new Map([['nanchao', {}]]),
  getFactionCities: () => [{ morale: 60 }],
  pushLog: () => {},
  dynastySystem: { get: () => ({ emperorId: 'chen_baxian' }) },
  generals: new Map([['chen_baxian', { command: 80, force: 80, intel: 80, politics: 80 }]])
};
harem.settleBirth(mockGame2, 'nanchao');
// 不抛异常即可（生育随机）
assert(Array.isArray(harem.get('nanchao').children), `生育结算不抛异常`);

// 立太子
const rec = harem.get('nanchao');
rec.children.push({ id: 'test_p1', name: '勇', gender: 'male', age: 16, motherId: rec.consorts[0].id, motherName: '皇后', stats: {}, marriedTo: null });
const appt = harem.appointHeir('nanchao', 'test_p1');
assert(appt.ok, `成年皇子可立太子`);
const appt2 = harem.appointHeir('nanchao', 'nonexist');
assert(!appt2.ok, `不存在子嗣拒绝立储`);
// 皇女联姻
rec.children.push({ id: 'test_p2', name: '丽华', gender: 'female', age: 13, motherId: rec.consorts[0].id, motherName: '皇后', stats: {}, marriedTo: null });
const marry = harem.marryPrincess(mockGame2, 'nanchao', 'test_p2', 'xiwei');
assert(marry.ok, `皇女可联姻`);

// ===== 5. 存档读写验证 =====
console.log('\n--- 5. 存档读写 ---');
const calSaved = cal.serialize();
const calRestored = CalendarSystem.deserialize(calSaved);
assert(calRestored.termIdx === cal.termIdx, `历法存档一致`);
const oldCal = CalendarSystem.deserialize(null);
assert(typeof oldCal.termIdx === 'number' && oldCal.termIdx >= 0, `旧存档历法默认值正确`);

const hSaved = harem.serialize();
const hRestored = HaremSystem.deserialize(hSaved);
assert(hRestored.get('nanchao').consorts.length === harem.get('nanchao').consorts.length, `后宫存档妃嫔数一致`);
assert(hRestored.get('nanchao').children.length === harem.get('nanchao').children.length, `后宫存档子嗣数一致`);
const oldHarem = HaremSystem.deserialize(null);
assert(oldHarem.factions && typeof oldHarem.factions === 'object', `旧存档后宫默认空`);

// ===== 6. 新增武将验证 =====
console.log('\n--- 6. 新增武将（5位）---');
const newGens = ['chen_shubao', 'yuwen_yun', 'gao_wei', 'sima_xiaonan', 'wang_qian'];
assert(GENERALS.length >= 75, `武将总数 >= 75（实际${GENERALS.length}）`);
for (const gid of newGens) {
  const g = GENERALS.find(x => x.id === gid);
  assert(!!g, `武将存在: ${gid}`);
  if (g) {
    assert(g.command && g.force && g.intel && g.politics, `${gid} 四维完整`);
    assert(g.portrait === gid, `${gid} 立绘名匹配`);
  }
  assert(Array.isArray(NEW_GENERAL_SKILLS[gid]), `${gid} 技能映射已并入`);
}

// ===== 7. 新增事件验证 =====
console.log('\n--- 7. 新增事件 ---');
const newEvts = ['anomaly_solar_eclipse', 'anomaly_lunar_eclipse', 'anomaly_comet',
                 'anomaly_meteor', 'anomaly_yinghuo', 'term_qingming', 'term_dongzhi'];
for (const eid of newEvts) {
  const ev = EVENTS.find(e => e.id === eid);
  assert(!!ev, `事件存在: ${eid}`);
}

// ===== 结果汇总 =====
console.log(`\n=== 测试结果：${passed} 通过, ${failed} 失败 ===`);
process.exit(failed > 0 ? 1 : 0);
