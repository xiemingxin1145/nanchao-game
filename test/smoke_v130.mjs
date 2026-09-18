// ============================================================
// V13.0 冒烟测试 — 验证新增武将/随机事件/历史事件/平衡常量数据完整性
// ============================================================
import {
  GENERALS, EVENTS, HISTORICAL_EVENTS, FACTIONS,
  V13_BALANCE, NEW_GENERAL_SKILLS
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

console.log('\n=== V13.0 冒烟测试 ===\n');

// ---------- 1. 6 位新武将 ----------
console.log('--- 1. 6 位新武将（v13_ 前缀）---');
const v13Generals = [
  'v13_su_chuo',     // 苏绰
  'v13_heba_yue',    // 贺拔岳
  'v13_peng_le',     // 彭乐
  'v13_dugu_yongye', // 独孤永业
  'v13_lu_fahe',     // 陆法和
  'v13_lu_guangda'   // 鲁广达
];
for (const gid of v13Generals) {
  const g = GENERALS.find(x => x.id === gid);
  assert(g, `武将 ${gid} 存在`);
  if (g) {
    assert(g.name && g.name.length > 0, `${gid} 有名称`);
    // faction 必须在 FACTIONS 中（或 null=在野）
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

// ---------- 2. 15 个随机事件 ----------
console.log('\n--- 2. 15 个随机事件（v13_ 前缀）---');
const v13Events = [
  // 军事 3
  'v13_shibing_jinglian', 'v13_liangdao_bei_chao', 'v13_di_bi_cheng_xia',
  // 政治 3
  'v13_tanhe_quanchen', 'v13_chaju_xianliang', 'v13_juanfu_kuang_min',
  // 经济 3
  'v13_quannong_sang', 'v13_guanshi_tong_shang', 'v13_caoqu_jiyun',
  // 文化 3
  'v13_xieshu_chuanlu', 'v13_yilin_jiangjing', 'v13_wenxuan_qushi',
  // 特殊 3
  'v13_yishi_lai_gui', 'v13_fengrui_zhuzhi', 'v13_yiren_yijia'
];
assert(v13Events.length === 15, `随机事件清单数量=15 (实际: ${v13Events.length})`);
for (const eid of v13Events) {
  const ev = EVENTS.find(e => e.id === eid);
  assert(ev, `随机事件 ${eid} 存在`);
  if (ev) {
    assert(ev.name && ev.name.length > 0, `${eid} 有名称`);
    assert(ev.description && ev.description.length > 0, `${eid} 有描述`);
    assert(ev.options && ev.options.length >= 1, `${eid} 至少1个选项`);
    assert(typeof ev.illustration === 'string' && ev.illustration.length > 0, `${eid} 有 illustration`);
    // 校验 effect 键均在白名单内
    for (const opt of (ev.options || [])) {
      assert(opt.effect && typeof opt.effect === 'object', `${eid} 选项 effect 是对象`);
      for (const k of Object.keys(opt.effect)) {
        // 嵌套对象字段（generalLoyalty/generalBuff 等）允许
        assert(ALLOWED_EFFECT_KEYS.has(k), `${eid} effect 键 "${k}" 在白名单内`);
      }
    }
  }
}

// ---------- 3. 4 个历史事件 ----------
console.log('\n--- 3. 4 个历史事件（v13_ 前缀）---');
const v13HistEvents = [
  'v13_yingchuan_zhi_wei',  // 颍川之围
  'v13_baling_zhi_zhan',    // 巴陵之战
  'v13_heyin_zhi_bian',     // 河阴之变
  'v13_lvliang_fu_jun'      // 吕梁覆军
];
for (const hid of v13HistEvents) {
  const he = HISTORICAL_EVENTS.find(e => e.id === hid);
  assert(he, `历史事件 ${hid} 存在`);
  if (he) {
    assert(he.name && he.name.length > 0, `${hid} 有名称`);
    assert(typeof he.minTurn === 'number' && he.minTurn > 0, `${hid} 有 minTurn>0`);
    assert(he.options && he.options.length >= 1, `${hid} 至少1个选项`);
    assert(typeof he.illustration === 'string' && he.illustration.length > 0, `${hid} 有 illustration`);
    // factions/faction 必须合法
    if (he.factions) {
      for (const f of he.factions) assert(VALID_FACTIONS.has(f), `${hid} faction ${f} 合法`);
    }
    if (he.faction) assert(VALID_FACTIONS.has(he.faction), `${hid} faction ${he.faction} 合法`);
  }
}

// ---------- 4. V13_BALANCE 常量 ----------
console.log('\n--- 4. V13_BALANCE 平衡常量 ---');
assert(V13_BALANCE && typeof V13_BALANCE === 'object', 'V13_BALANCE 导出存在');
const requiredBalanceKeys = [
  'counterBonus', 'aiAttackThreshold', 'eventBaseProbability',
  'loyaltyDecayRate', 'maxTaxRate', 'incomePopFactor'
];
for (const k of requiredBalanceKeys) {
  assert(typeof V13_BALANCE[k] === 'number', `V13_BALANCE.${k} 是数字`);
}
// 数值合理性
assert(V13_BALANCE.counterBonus > 0 && V13_BALANCE.counterBonus < 1, 'counterBonus 在(0,1)');
assert(V13_BALANCE.aiAttackThreshold > 0 && V13_BALANCE.aiAttackThreshold < 1, 'aiAttackThreshold 在(0,1)');
assert(V13_BALANCE.eventBaseProbability > 0 && V13_BALANCE.eventBaseProbability < 1, 'eventBaseProbability 在(0,1)');
assert(V13_BALANCE.loyaltyDecayRate >= 0 && V13_BALANCE.loyaltyDecayRate < 2, 'loyaltyDecayRate 合理');
assert(V13_BALANCE.maxTaxRate > 0 && V13_BALANCE.maxTaxRate <= 100, 'maxTaxRate 合理');

// ---------- 5. ID 唯一性 ----------
console.log('\n--- 5. ID 唯一性 ---');
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

// ---------- 6. 新武将技能已注册到 NEW_GENERAL_SKILLS ----------
console.log('\n--- 6. 新武将技能注册 ---');
for (const gid of v13Generals) {
  assert(Array.isArray(NEW_GENERAL_SKILLS[gid]), `${gid} 已注册到 NEW_GENERAL_SKILLS`);
}

// ---------- 7. 美术素材文件存在 ----------
console.log('\n--- 7. 美术素材文件 ---');
const expectedAssets = [
  'portraits/v13_su_chuo.png',
  'portraits/v13_heba_yue.png',
  'portraits/v13_peng_le.png',
  'portraits/v13_dugu_yongye.png',
  'portraits/v13_lu_fahe.png',
  'portraits/v13_lu_guangda.png',
  'battles/v13_yingchuan_siege.png',
  'battles/v13_lvliang_fujun.png',
  'events/v13_heyin_event.png',
  'events/v13_baling_battle.png'
];
for (const rel of expectedAssets) {
  const p = path.join(ASSETS, rel);
  assert(fs.existsSync(p), `素材存在: ${rel}`);
}

// ---------- 8. 数据统计 ----------
console.log('\n--- 8. 数据统计 ---');
console.log(`  武将总数: ${GENERALS.length}`);
console.log(`  随机事件总数: ${EVENTS.length}`);
console.log(`  历史事件总数: ${HISTORICAL_EVENTS.length}`);
assert(GENERALS.length >= 105, `武将总数>=105 (实际: ${GENERALS.length})`);
assert(EVENTS.length > 200, `随机事件数>200 (实际: ${EVENTS.length})`);
assert(HISTORICAL_EVENTS.length > 60, `历史事件数>60 (实际: ${HISTORICAL_EVENTS.length})`);

// 结果汇总
console.log(`\n=== 结果: ${pass} 通过, ${fail} 失败 ===`);
process.exit(fail > 0 ? 1 : 0);
