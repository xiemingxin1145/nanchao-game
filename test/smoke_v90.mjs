// ============================================================
// smoke_v90.mjs — V9.0 冒烟测试
// 验证：军团系统 / 阵法系统(12阵+等级+克制) / 新武将(5) /
//       新事件(20随机+5历史) / 存档读写
// ============================================================
import { GENERALS, NEW_GENERAL_SKILLS, EVENTS, HISTORICAL_EVENTS } from '../src/js/data.js';
import { FORMATIONS, FORMATION_COUNTER, getFormationBag, availableFormations,
         maxFormationLevel, confuseEnemyMult, FORMATION_MAX_LEVEL } from '../src/js/formation.js';
import { TECHS, TECH_LINES } from '../src/js/tech.js';
import { Legion, createLegion, addArmyToLegion, resolveLegionBattle,
         applyLegionBattleResult, LEGION_MAX_ARMIES, LEGION_MAX_TROOPS,
         MASS_BATTLE_TROOP_MIN } from '../src/js/legion.js';

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; console.log(`  ✓ ${msg}`); }
  else { failed++; console.log(`  ✗ FAIL: ${msg}`); }
}

console.log('=== V9.0 冒烟测试 ===\n');

// ===== 1. 阵法系统 =====
console.log('--- 1. 阵法系统（12阵） ---');
assert(Object.keys(FORMATIONS).length === 12, `阵型总数=12（实际${Object.keys(FORMATIONS).length}）`);
const fmIds = Object.keys(FORMATIONS);
for (const must of ['heyi','fengshi','yulin','yanxing','fangyuan','changshe','jixing','zhuixing','gouxing','xuanxiang','woji','bagua']) {
  assert(fmIds.includes(must), `含阵型 ${must}`);
}
// 阵型等级缩放
const bag1 = getFormationBag('heyi', null, 1);
const bag5 = getFormationBag('heyi', null, 5);
assert(Math.abs(bag5.allUnitMult - bag1.allUnitMult * 1.4) < 0.01, `阵型5级效果=1级×1.4（${bag1.allUnitMult}→${bag5.allUnitMult}）`);
// 克制：锋矢克鹤翼（锋矢 allUnitMult 基础 -0.10，+克制0.15 → 0.05）
const cBag = getFormationBag('fengshi', 'heyi', 1);
assert(Math.abs((cBag.allUnitMult || 0) - 0.05) < 0.01, `锋矢克鹤翼，克制+15%（allUnitMult=${cBag.allUnitMult}）`);
// 玄襄迷惑
const confuse = confuseEnemyMult('xuanxiang', 1);
assert(confuse < 1 && confuse > 0.8, `玄襄阵迷惑折减敌方（${confuse}）`);
// 科技未解锁新阵
assert(availableFormations([]).includes('heyi'), `基础阵鹤翼默认解锁`);
assert(!availableFormations([]).includes('bagua'), `八卦阵需科技解锁`);
assert(maxFormationLevel('bagua', ['f6']) === 5, `八卦阵f6解锁后5级`);
assert(TECH_LINES.formation, `阵法科技分支存在`);
const fTechs = TECHS.filter(t => t.line === 'formation');
assert(fTechs.length === 6, `阵法科技线6项（实际${fTechs.length}）`);

// ===== 2. 新武将（5位） =====
console.log('\n--- 2. 武将（V9.0为80，V9.5新增至85） ---');
assert(GENERALS.length >= 85, `武将总数≥85（实际${GENERALS.length}）`);
const newGens = ['er_zhurong','hou_jing','xiao_yan','yuan_hong','wang_sizheng'];
for (const gid of newGens) {
  const g = GENERALS.find(x => x.id === gid);
  assert(!!g, `新武将存在: ${gid}`);
  if (g) assert(g.command && g.force && g.intel && g.politics && g.loyalty, `${g.name} 五维齐全`);
  assert(NEW_GENERAL_SKILLS[gid] !== undefined, `${gid} 已绑定技能映射`);
}
// 立绘文件存在
import fs from 'fs';
for (const gid of newGens) {
  assert(fs.existsSync(`assets/portraits/${gid}.png`), `立绘文件存在: ${gid}.png`);
}
const portraitCount = fs.readdirSync('assets/portraits').filter(f => f.endsWith('.png')).length;
assert(portraitCount >= 85, `portraits 目录≥85张PNG（实际${portraitCount}）`);

// ===== 3. 新事件 =====
console.log('\n--- 3. 新事件（20随机+5历史） ---');
const v9Random = EVENTS.filter(e => e.id.startsWith('v9_'));
assert(v9Random.length === 25, `V9.0随机事件=25（实际${v9Random.length}）`);
const v9Hist = HISTORICAL_EVENTS.filter(e => e.id.startsWith('v90_'));
assert(v9Hist.length === 5, `V9.0历史事件=5（实际${v9Hist.length}）`);
for (const hid of ['v90_erzhu_rong_luo','v90_gao_huan_hanling','v90_yuwen_taiguanzhong','v90_chen_founding','v90_yangjian_daizhou']) {
  assert(HISTORICAL_EVENTS.some(e => e.id === hid), `历史事件存在: ${hid}`);
}

// ===== 4. 军团系统 =====
console.log('\n--- 4. 军团系统 ---');
assert(LEGION_MAX_ARMIES === 5, `军团最多5军`);
assert(LEGION_MAX_TROOPS === 50000, `军团总兵上限50000`);
assert(MASS_BATTLE_TROOP_MIN === 10000, `会战阈值10000`);

// 构造一个最小 game 桩测试军团编制与会战
const fakeGame = {
  factions: { test: { name: '测试' } },
  legions: new Map(),
  armies: [], generals: new Map(),
  factionRes: new Map([['test', { money: 10000, food: 10000 }]]),
  playerFaction: 'test', techs: [],
  pushLog() {},
  getFactionGenerals() { return [...this.generals.values()]; },
  getFactionCities() { return []; },
  factionNameOf(fid) { return '测试'; }
};
// 造两个武将
fakeGame.generals.set('g1', { id:'g1', name:'甲', effCommand: 90, effForce: 80, effIntel: 75, command:90, force:80, intel:75, loyalty:80, faction:'test', gainExp(){return 0} });
fakeGame.generals.set('g2', { id:'g2', name:'乙', effCommand: 70, effForce: 60, effIntel: 65, command:70, force:60, intel:65, loyalty:80, faction:'test', gainExp(){return 0} });
// 造两支军队
class FakeArmy {
  constructor(id, genId, troops) {
    this.id=id; this.faction='test'; this.generalId=genId; this.cityId='c1';
    this.troops=troops; this.formation='heyi'; this.legionId=null; this.formationExp=0;
  }
  getMainUnit(){return 'infantry';}
  getAvgUnitCoeff(){return 1.0;}
}
fakeGame.armies.push(new FakeArmy('a1','g1',6000), new FakeArmy('a2','g2',5000));
const r = createLegion(fakeGame, 'a1', '测试军团');
assert(r.ok, `创建军团成功`);
const L = r.legion;
assert(L.size() === 1, `军团初编1军`);
const r2 = addArmyToLegion(fakeGame, L.id, 'a2');
assert(r2.ok, `加入第二军`);
assert(L.size() === 2, `军团现2军`);
assert(L.totalTroops(fakeGame.armies) === 11000, `军团总兵11000`);
assert(L.commanderId === 'g1', `军团长取统帅最高(g1)`);

// 会战结算
const enemyL = new Legion({ factionId: 'enemy', name: '敌军军团' });
enemyL.armyIds = ['a3'];
fakeGame.armies.push({ id:'a3', faction:'enemy', generalId:'g3', cityId:'c1', troops:12000, formation:'fengshi', getMainUnit(){return 'cavalry';}, getAvgUnitCoeff(){return 1.1;} });
fakeGame.generals.set('g3', { id:'g3', name:'敌将', effCommand: 80, effForce: 75, effIntel: 70, command:80, force:75, intel:70, loyalty:80, faction:'enemy', gainExp(){return 0} });
enemyL.commanderId = 'g3';
const battle = resolveLegionBattle(fakeGame, L, enemyL, 'plain');
assert(Array.isArray(battle.phases) && battle.phases.length === 4, `会战四阶段（列阵/交锋/决战/追击）`);
assert(battle.attackerPower > 0 && battle.defenderPower > 0, `双方战力计算正常`);
assert(typeof battle.attackerLoss === 'number' && typeof battle.defenderLoss === 'number', `伤亡数值`);
applyLegionBattleResult(fakeGame, battle);
assert(L.battles === 1, `军团战史记+1`);

// ===== 5. 存档读写（军团序列化） =====
console.log('\n--- 5. 存档读写 ---');
const serialized = L.serialize();
assert(serialized.armyIds.length === 2, `军团序列化含2军`);
assert(serialized.commanderId === 'g1', `序列化军团长`);
const restored = Legion.deserialize(serialized);
assert(restored.id === L.id && restored.size() === 2, `反序列化军团一致`);
assert(restored.commanderId === 'g1', `反序列化军团长正确`);

console.log(`\n=== 结果：${passed} 通过, ${failed} 失败 ===`);
process.exit(failed > 0 ? 1 : 0);
