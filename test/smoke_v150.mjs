// ============================================================
// V15.0 冒烟测试 — 验证新增武将/随机事件/历史事件/剧本/平衡常量/美术素材
// ============================================================
import {
  GENERALS, EVENTS, HISTORICAL_EVENTS,
  FACTIONS, SCENARIOS, V15_BALANCE, NEW_GENERAL_SKILLS
} from '../src/js/data.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.resolve(__dirname, '..', 'assets');

let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; console.log('  PASS:', msg); }
  else { fail++; console.log('  FAIL:', msg); }
}

// events.js applyEvent 已支持的 effect 键白名单
const ALLOWED_EFFECT_KEYS = new Set([
  'money', 'food', 'pop', 'morale', 'armyMorale', 'agri', 'comm', 'prosperity',
  'armyLoss', 'recruitRandom', 'recruitGeneral', 'garrisonBuff', 'massBattle',
  'recaptureJiankang', 'shouyang_rebel', 'barbarianRel', 'spyMaster',
  'factionMorale', 'generalBuff', 'generalDebuff', 'generalPolitics',
  'generalIntel', 'generalLoyalty', 'generalDeath', 'culture', 'tech', 'destroyTemple'
]);

// 合法 faction id
const VALID_FACTIONS = new Set(Object.keys(FACTIONS));

console.log('\n=== V15.0 冒烟测试 ===\n');

// ---------- 1. 15 位新武将 ----------
console.log('--- 1. 15 位新武将（v15_ 前缀）---');
const v15Generals = [
  'v15_yang_guang',     // 杨广
  'v15_yuwen_shu',      // 宇文述
  'v15_lai_huer',       // 来护儿
  'v15_daxi_changru',   // 达奚长儒
  'v15_yu_juluo',       // 鱼俱罗
  'v15_shen_guang',     // 沈光
  'v15_li_delin',       // 李德林
  'v15_zhou_luohou',    // 周罗睺
  'v15_zhang_lihua',    // 张丽华
  'v15_jiang_zong',     // 江总
  'v15_xie_zhen',       // 谢贞
  'v15_yao_cha',        // 姚察
  'v15_yao_zui',        // 姚最
  'v15_xiao_zhengde',   // 萧正德
  'v15_xiao_yuanming'   // 萧渊明
];
assert(v15Generals.length === 15, `新武将清单数量=15 (实际: ${v15Generals.length})`);
for (const gid of v15Generals) {
  const g = GENERALS.find(x => x.id === gid);
  assert(g, `武将 ${gid} 存在`);
  if (g) {
    assert(g.name && g.name.length > 0, `${gid} 有名称`);
    assert(g.faction === null || VALID_FACTIONS.has(g.faction), `${gid} faction 合法 (${g.faction})`);
    assert(typeof g.command === 'number' && g.command >= 1 && g.command <= 100, `${gid} command 合理`);
    assert(typeof g.force === 'number' && g.force >= 1 && g.force <= 100, `${gid} force 合理`);
    assert(typeof g.intel === 'number' && g.intel >= 1 && g.intel <= 100, `${gid} intel 合理`);
    assert(typeof g.politics === 'number' && g.politics >= 1 && g.politics <= 100, `${gid} politics 合理`);
    assert(typeof g.loyalty === 'number' && g.loyalty >= 0 && g.loyalty <= 100, `${gid} loyalty 合理`);
    assert(typeof g.age === 'number' && g.age > 0, `${gid} age 存在`);
    assert(g.description && g.description.length > 10, `${gid} description 完整`);
    assert(Array.isArray(g.skills) && g.skills.length >= 1, `${gid} skills 数组非空`);
    assert(Array.isArray(g.bonds), `${gid} bonds 数组存在`);
    assert(g.portrait === gid, `${gid} portrait 字段与 id 一致`);
  }
}

// ---------- 2. 20 个随机事件 ----------
console.log('\n--- 2. 20 个随机事件（v15_ 前缀）---');
const v15Events = [
  // 军事 5
  'v15_yingyang_jiaozhan', 'v15_qibing_jieji', 'v15_shuijun_chuhai',
  'v15_junzhong_jingbian', 'v15_chengxia_yuandian',
  // 政治 4
  'v15_zaixiang_xiechu', 'v15_jiangjun_jinjie', 'v15_zongshi_xiangqin', 'v15_keshen_jianshi',
  // 经济 4
  'v15_tianjuan_kaitang', 'v15_guanshi_sijin', 'v15_canglin_xiangshi', 'v15_zhutie_yezhu',
  // 文化 4
  'v15_guozijian_jiangxue', 'v15_foshi_kaiguang', 'v15_shijing_kance', 'v15_mingtong_huijing',
  // 特殊 3
  'v15_longjian_jianghai', 'v15_yilao_yishi', 'v15_yiyu_laike'
];
assert(v15Events.length === 20, `随机事件清单数量=20 (实际: ${v15Events.length})`);
for (const eid of v15Events) {
  const ev = EVENTS.find(e => e.id === eid);
  assert(ev, `随机事件 ${eid} 存在`);
  if (ev) {
    assert(ev.name && ev.name.length > 0, `${eid} 有名称`);
    assert(ev.description && ev.description.length > 0, `${eid} 有描述`);
    assert(ev.options && ev.options.length >= 1, `${eid} 至少1个选项`);
    assert(typeof ev.illustration === 'string' && ev.illustration.length > 0, `${eid} 有 illustration`);
    for (const opt of (ev.options || [])) {
      assert(opt.effect && typeof opt.effect === 'object', `${eid} 选项 effect 是对象`);
      for (const k of Object.keys(opt.effect)) {
        assert(ALLOWED_EFFECT_KEYS.has(k), `${eid} effect 键 "${k}" 在白名单内`);
      }
    }
  }
}

// ---------- 3. 5 个历史事件 ----------
console.log('\n--- 3. 5 个历史事件（v15_ 前缀）---');
const v15HistEvents = [
  'v15_qiandu_luoyang',      // 孝文迁都
  'v15_sheshen_tongtai',     // 梁武舍身
  'v15_dai_zhou_jian_sui',   // 杨坚代周
  'v15_bing_xia_jiangdu',    // 韩贺渡江
  'v15_tujue_nanxia'         // 隋御突厥
];
assert(v15HistEvents.length === 5, `历史事件清单数量=5 (实际: ${v15HistEvents.length})`);
for (const hid of v15HistEvents) {
  const he = HISTORICAL_EVENTS.find(e => e.id === hid);
  assert(he, `历史事件 ${hid} 存在`);
  if (he) {
    assert(he.name && he.name.length > 0, `${hid} 有名称`);
    assert(typeof he.minTurn === 'number' && he.minTurn > 0, `${hid} 有 minTurn>0`);
    assert(he.options && he.options.length >= 1, `${hid} 至少1个选项`);
    assert(typeof he.illustration === 'string' && he.illustration.length > 0, `${hid} 有 illustration`);
    if (he.factions) {
      for (const f of he.factions) assert(VALID_FACTIONS.has(f), `${hid} faction ${f} 合法`);
    }
    if (he.faction) assert(VALID_FACTIONS.has(he.faction), `${hid} faction ${he.faction} 合法`);
  }
}

// ---------- 4. 1 个新剧本 ----------
console.log('\n--- 4. 1 个新剧本 ---');
const v15Scenarios = ['502'];
assert(v15Scenarios.length === 1, `新剧本清单数量=1 (实际: ${v15Scenarios.length})`);
for (const sid of v15Scenarios) {
  const sc = SCENARIOS[sid];
  assert(sc, `剧本 ${sid} 存在`);
  if (sc) {
    assert(sc.name && sc.name.length > 0, `${sid} 有名称`);
    assert(typeof sc.year === 'number' && sc.year > 0, `${sid} year 合理`);
    assert(sc.description && sc.description.length > 10, `${sid} 有描述`);
    assert(Array.isArray(sc.factions) && sc.factions.length >= 2, `${sid} 至少2个势力`);
    for (const f of sc.factions) assert(VALID_FACTIONS.has(f), `${sid} 势力 ${f} 合法`);
  }
}

// ---------- 5. V15_BALANCE 常量 ----------
console.log('\n--- 5. V15_BALANCE 平衡常量 ---');
assert(V15_BALANCE && typeof V15_BALANCE === 'object', 'V15_BALANCE 导出存在');
const requiredBalanceKeys = [
  'counterBonus', 'aiAttackThreshold', 'eventBaseProbability',
  'loyaltyDecayRate', 'maxTaxRate', 'incomePopFactor',
  'recruitCostDiscount', 'cityUpkeepFactor'
];
for (const k of requiredBalanceKeys) {
  assert(typeof V15_BALANCE[k] === 'number', `V15_BALANCE.${k} 是数字`);
}
assert(V15_BALANCE.counterBonus > 0 && V15_BALANCE.counterBonus < 1, 'counterBonus 在(0,1)');
assert(V15_BALANCE.aiAttackThreshold > 0 && V15_BALANCE.aiAttackThreshold < 1, 'aiAttackThreshold 在(0,1)');
assert(V15_BALANCE.eventBaseProbability > 0 && V15_BALANCE.eventBaseProbability < 1, 'eventBaseProbability 在(0,1)');
assert(V15_BALANCE.loyaltyDecayRate >= 0 && V15_BALANCE.loyaltyDecayRate < 2, 'loyaltyDecayRate 合理');
assert(V15_BALANCE.maxTaxRate > 0 && V15_BALANCE.maxTaxRate <= 100, 'maxTaxRate 合理');

// ---------- 6. ID 唯一性 ----------
console.log('\n--- 6. ID 唯一性 ---');
const generalIds = new Set();
let gDup = 0;
for (const g of GENERALS) { if (generalIds.has(g.id)) gDup++; generalIds.add(g.id); }
assert(gDup === 0, `武将 ID 无重复 (重复数: ${gDup})`);

const eventIds = new Set();
let eDup = 0;
for (const e of EVENTS) { if (eventIds.has(e.id)) eDup++; eventIds.add(e.id); }
assert(eDup === 0, `随机事件 ID 无重复 (重复数: ${eDup})`);

const histIds = new Set();
let hDup = 0;
for (const e of HISTORICAL_EVENTS) { if (histIds.has(e.id)) hDup++; histIds.add(e.id); }
assert(hDup === 0, `历史事件 ID 无重复 (重复数: ${hDup})`);

// ---------- 7. 新武将技能已注册 ----------
console.log('\n--- 7. 新武将技能注册 ---');
for (const gid of v15Generals) {
  assert(Array.isArray(NEW_GENERAL_SKILLS[gid]), `${gid} 已注册到 NEW_GENERAL_SKILLS`);
}

// ---------- 8. 美术素材文件存在（20张） ----------
console.log('\n--- 8. 美术素材文件（20张） ---');
const expectedAssets = [
  // 15 武将立绘
  'portraits/v15_yang_guang.png', 'portraits/v15_yuwen_shu.png', 'portraits/v15_lai_huer.png',
  'portraits/v15_daxi_changru.png', 'portraits/v15_yu_juluo.png', 'portraits/v15_shen_guang.png',
  'portraits/v15_li_delin.png', 'portraits/v15_zhou_luohou.png', 'portraits/v15_zhang_lihua.png',
  'portraits/v15_jiang_zong.png', 'portraits/v15_xie_zhen.png', 'portraits/v15_yao_cha.png',
  'portraits/v15_yao_zui.png', 'portraits/v15_xiao_zhengde.png', 'portraits/v15_xiao_yuanming.png',
  // 5 历史事件插画
  'events/v15_qiandu_luoyang.png', 'events/v15_sheshen_tongtai.png', 'events/v15_dai_zhou_jian_sui.png',
  'events/v15_bing_xia_jiangdu.png', 'events/v15_tujue_nanxia.png'
];
assert(expectedAssets.length === 20, `素材清单数量=20 (实际: ${expectedAssets.length})`);
for (const rel of expectedAssets) {
  const p = path.join(ASSETS, rel);
  assert(fs.existsSync(p), `素材存在: ${rel}`);
}

// ---------- 9. 数据统计 ----------
console.log('\n--- 9. 数据统计 ---');
console.log(`  武将总数: ${GENERALS.length}`);
console.log(`  随机事件总数: ${EVENTS.length}`);
console.log(`  历史事件总数: ${HISTORICAL_EVENTS.length}`);
console.log(`  剧本总数: ${Object.keys(SCENARIOS).length}`);
assert(GENERALS.length >= 140, `武将总数>=140 (实际: ${GENERALS.length})`);
assert(EVENTS.length >= 315, `随机事件数>=315 (实际: ${EVENTS.length})`);
assert(HISTORICAL_EVENTS.length >= 105, `历史事件数>=105 (实际: ${HISTORICAL_EVENTS.length})`);
assert(Object.keys(SCENARIOS).length >= 27, `剧本数>=27 (实际: ${Object.keys(SCENARIOS).length})`);

// 结果汇总
console.log(`\n=== 结果: ${pass} 通过, ${fail} 失败 ===`);
process.exit(fail > 0 ? 1 : 0);
