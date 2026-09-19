// ============================================================
// V20.0 冒烟测试 — 验证新增武将/城市/随机事件/历史事件/剧本/战役/平衡常量/美术素材
// ============================================================
import {
  GENERALS, CITIES, CITY_LINKS, EVENTS, HISTORICAL_EVENTS,
  FACTIONS, SCENARIOS, V20_BALANCE, CAMPAIGN_SCENARIOS,
  NEW_GENERAL_SKILLS
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

console.log('\n=== V20.0 冒烟测试 ===\n');

// ---------- 1. 15 位新武将 ----------
console.log('--- 1. 15 位新武将（v20_ 前缀）---');
const v20Generals = [
  'v20_li_yuan',          // 李渊
  'v20_li_shimin',       // 李世民
  'v20_yang_dong',        // 杨侗
  'v20_yang_you',         // 杨侑
  'v20_yang_hao',         // 杨浩
  'v20_yong',             // 杨勇
  'v20_xian_furen',       // 冼夫人
  'v20_fang_ang',         // 冯盎
  'v20_wang_bo',          // 王薄
  'v20_liu_hongji',      // 刘弘基
  'v20_changsun_shunde', // 长孙顺德
  'v20_duan_zhixuan',    // 段志玄
  'v20_liu_wenjing',     // 刘文静
  'v20_pei_ji',          // 裴寂
  'v20_dugu_qieluo'      // 独孤伽罗
];
assert(v20Generals.length === 15, `新武将清单数量=15 (实际: ${v20Generals.length})`);
for (const gid of v20Generals) {
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

// ---------- 2. 12 座新城市 ----------
console.log('\n--- 2. 12 座新城市（v20_ 前缀）---');
const v20Cities = [
  'v20_anxi', 'v20_beiting', 'v20_qiuci', 'v20_shule',
  'v20_yanqi', 'v20_shanshan', 'v20_anbei', 'v20_chanyu',
  'v20_yanzhou', 'v20_pingzhou', 'v20_andong', 'v20_heishui'
];
assert(v20Cities.length === 12, `新城市清单数量=12 (实际: ${v20Cities.length})`);
for (const cid of v20Cities) {
  const c = CITIES.find(x => x.id === cid);
  assert(c, `城市 ${cid} 存在`);
  if (c) {
    assert(c.name && c.name.length > 0, `${cid} 有名称`);
    assert(typeof c.isoX === 'number', `${cid} isoX 是数字`);
    assert(typeof c.isoY === 'number', `${cid} isoY 是数字`);
    assert(typeof c.pop === 'number' && c.pop > 0, `${cid} pop 合理`);
    assert(typeof c.agri === 'number', `${cid} agri 合理`);
    assert(typeof c.comm === 'number', `${cid} comm 合理`);
    assert(typeof c.defense === 'number', `${cid} defense 合理`);
    assert(typeof c.prosperity === 'number', `${cid} prosperity 合理`);
    assert(typeof c.taxRate === 'number', `${cid} taxRate 合理`);
    assert(typeof c.terrain === 'string' && c.terrain.length > 0, `${cid} 有 terrain`);
    assert(Array.isArray(CITY_LINKS[cid]) && CITY_LINKS[cid].length >= 1, `${cid} 有邻接关系`);
  }
}
// 双向链接校验：新城 -> 邻居，邻居 -> 新城
for (const cid of v20Cities) {
  for (const nbr of (CITY_LINKS[cid] || [])) {
    const back = CITY_LINKS[nbr];
    assert(Array.isArray(back) && back.includes(cid), `双向链接: ${nbr} -> ${cid}`);
  }
}

// ---------- 3. 20 个随机事件 ----------
console.log('\n--- 3. 20 个随机事件（v20_ 前缀）---');
const v20Events = [
  // 军事 5
  'v20_mu_fengsui', 'v20_mu_liangdao', 'v20_mu_mudu', 'v20_mu_tujue', 'v20_mu_huobing',
  // 政治 4
  'v20_zheng_baibi', 'v20_zheng_dangyi', 'v20_zheng_chushi', 'v20_zheng_fengshan',
  // 经济 4
  'v20_jing_tiantong', 'v20_jing_shidian', 'v20_jing_yingtian', 'v20_jing_huangzai',
  // 文化 4
  'v20_wen_shijing', 'v20_wen_fota', 'v20_wen_yanle', 'v20_wen_mingchen',
  // 特殊 3（灾害）
  'v20_te_dizhen', 'v20_te_hongshui', 'v20_te_gunhan'
];
assert(v20Events.length === 20, `随机事件清单数量=20 (实际: ${v20Events.length})`);
for (const eid of v20Events) {
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

// ---------- 4. 5 个历史事件 ----------
console.log('\n--- 4. 5 个历史事件（v20_ 前缀）---');
const v20HistEvents = [
  'v20_suimiefuchen',     // 隋灭陈
  'v20_jinyang_qibing',   // 晋阳起兵
  'v20_mangshan_zhan',    // 邙山之败
  'v20_tangshoushuchan',  // 唐受隋禅
  'v20_xuanwu_zhibian'    // 玄武门之变
];
assert(v20HistEvents.length === 5, `历史事件清单数量=5 (实际: ${v20HistEvents.length})`);
for (const hid of v20HistEvents) {
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

// ---------- 5. 1 个新剧本 ----------
console.log('\n--- 5. 1 个新剧本 ---');
const v20Scenarios = ['617'];
assert(v20Scenarios.length === 1, `新剧本清单数量=1 (实际: ${v20Scenarios.length})`);
for (const sid of v20Scenarios) {
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

// ---------- 6. 5 个新战役关卡 ----------
console.log('\n--- 6. 5 个新战役关卡（CAMPAIGN_SCENARIOS）---');
assert(Array.isArray(CAMPAIGN_SCENARIOS), 'CAMPAIGN_SCENARIOS 是数组');
assert(CAMPAIGN_SCENARIOS.length === 25, `战役数量=25 (实际: ${CAMPAIGN_SCENARIOS.length})`);
const expectedCampaignIds = [
  'v20_jinyang_qibing',     // 晋阳起兵 617
  'v20_huoyi_zhan',         // 霍邑破宋老生 617
  'v20_mangshan_zhan',      // 邙山败李密 618
  'v20_lingnan_guifu',      // 岭南归唐 622
  'v20_xuanwu_zhibian'     // 玄武门之变 626
];
for (const cid of expectedCampaignIds) {
  const c = CAMPAIGN_SCENARIOS.find(x => x.id === cid);
  assert(c, `战役 ${cid} 存在`);
  if (c) {
    assert(c.name && c.name.length > 0, `${cid} 有名称`);
    assert(typeof c.year === 'number' && c.year > 0, `${cid} year 合理`);
    assert(c.objective && c.objective.length > 0, `${cid} 有胜利条件`);
    assert(c.defeatCondition && c.defeatCondition.length > 0, `${cid} 有失败条件`);
    assert(c.startingState && typeof c.startingState === 'object', `${cid} 有初始状态`);
    assert(c.startingState && typeof c.startingState.troops === 'number', `${cid} 有初始兵力`);
    assert(c.startingState && Array.isArray(c.startingState.generals), `${cid} 有初始武将列表`);
    assert(c.reward && typeof c.reward === 'object', `${cid} 有通关奖励`);
    assert(Array.isArray(c.mapSetup) && c.mapSetup.length >= 2, `${cid} 有地图配置(>=2城)`);
    assert(typeof c.illustration === 'string' && c.illustration.length > 0, `${cid} 有 illustration`);
  }
}

// ---------- 7. V20_BALANCE 常量 ----------
console.log('\n--- 7. V20_BALANCE 平衡常量 ---');
assert(V20_BALANCE && typeof V20_BALANCE === 'object', 'V20_BALANCE 导出存在');
const requiredBalanceKeys = [
  'counterBonus', 'aiAttackThreshold', 'eventBaseProbability',
  'loyaltyDecayRate', 'maxTaxRate', 'incomePopFactor',
  'recruitCostDiscount', 'cityUpkeepFactor',
  'campaignRewardMult', 'campaignEnemyMult', 'recruitInitialLoyalty',
  'desertSupplyPenalty'
];
for (const k of requiredBalanceKeys) {
  assert(typeof V20_BALANCE[k] === 'number', `V20_BALANCE.${k} 是数字`);
}
assert(V20_BALANCE.counterBonus > 0 && V20_BALANCE.counterBonus < 1, 'counterBonus 在(0,1)');
assert(V20_BALANCE.aiAttackThreshold > 0 && V20_BALANCE.aiAttackThreshold < 1, 'aiAttackThreshold 在(0,1)');
assert(V20_BALANCE.eventBaseProbability > 0 && V20_BALANCE.eventBaseProbability < 1, 'eventBaseProbability 在(0,1)');
assert(V20_BALANCE.loyaltyDecayRate >= 0 && V20_BALANCE.loyaltyDecayRate < 2, 'loyaltyDecayRate 合理');
assert(V20_BALANCE.maxTaxRate > 0 && V20_BALANCE.maxTaxRate <= 100, 'maxTaxRate 合理');

// ---------- 8. ID 唯一性 ----------
console.log('\n--- 8. ID 唯一性 ---');
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

const cityIds = new Set();
let cDup = 0;
for (const c of CITIES) { if (cityIds.has(c.id)) cDup++; cityIds.add(c.id); }
assert(cDup === 0, `城市 ID 无重复 (重复数: ${cDup})`);

// ---------- 9. 新武将技能已注册 ----------
console.log('\n--- 9. 新武将技能注册 ---');
for (const gid of v20Generals) {
  assert(Array.isArray(NEW_GENERAL_SKILLS[gid]), `${gid} 已注册到 NEW_GENERAL_SKILLS`);
}

// ---------- 10. 美术素材文件存在（20张） ----------
console.log('\n--- 10. 美术素材文件（20张） ---');
const expectedAssets = [
  // 15 武将立绘
  'portraits/v20_li_yuan.png', 'portraits/v20_li_shimin.png', 'portraits/v20_yang_dong.png',
  'portraits/v20_yang_you.png', 'portraits/v20_yong.png', 'portraits/v20_yang_hao.png',
  'portraits/v20_xian_furen.png', 'portraits/v20_fang_ang.png', 'portraits/v20_wang_bo.png',
  'portraits/v20_liu_hongji.png', 'portraits/v20_changsun_shunde.png', 'portraits/v20_duan_zhixuan.png',
  'portraits/v20_liu_wenjing.png', 'portraits/v20_pei_ji.png', 'portraits/v20_dugu_qieluo.png',
  // 5 战役插画
  'campaigns/v20_jinyang_qibing.png', 'campaigns/v20_huoyi_zhan.png',
  'campaigns/v20_mangshan_zhan.png', 'campaigns/v20_lingnan_guifu.png',
  'campaigns/v20_xuanwu_zhibian.png'
];
assert(expectedAssets.length === 20, `素材清单数量=20 (实际: ${expectedAssets.length})`);
for (const rel of expectedAssets) {
  const p = path.join(ASSETS, rel);
  assert(fs.existsSync(p), `素材存在: ${rel}`);
}

// ---------- 11. 数据统计 ----------
console.log('\n--- 11. 数据统计 ---');
console.log(`  武将总数: ${GENERALS.length}`);
console.log(`  城市总数: ${CITIES.length}`);
console.log(`  随机事件总数: ${EVENTS.length}`);
console.log(`  历史事件总数: ${HISTORICAL_EVENTS.length}`);
console.log(`  剧本总数: ${Object.keys(SCENARIOS).length}`);
console.log(`  战役总数: ${CAMPAIGN_SCENARIOS.length}`);
assert(GENERALS.length >= 215, `武将总数>=215 (实际: ${GENERALS.length})`);
assert(CITIES.length >= 104, `城市总数>=104 (实际: ${CITIES.length})`);
assert(EVENTS.length >= 415, `随机事件数>=415 (实际: ${EVENTS.length})`);
assert(HISTORICAL_EVENTS.length >= 130, `历史事件数>=130 (实际: ${HISTORICAL_EVENTS.length})`);
assert(Object.keys(SCENARIOS).length >= 32, `剧本数>=32 (实际: ${Object.keys(SCENARIOS).length})`);
assert(CAMPAIGN_SCENARIOS.length >= 25, `战役数>=25 (实际: ${CAMPAIGN_SCENARIOS.length})`);

// 结果汇总
console.log(`\n=== 结果: ${pass} 通过, ${fail} 失败 ===`);
process.exit(fail > 0 ? 1 : 0);
