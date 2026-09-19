// ============================================================
// V21.0 冒烟测试 — 验证新增武将/城市/随机事件/历史事件/剧本/战役/平衡常量/美术素材
// ============================================================
import {
  GENERALS, CITIES, CITY_LINKS, EVENTS, HISTORICAL_EVENTS,
  FACTIONS, SCENARIOS, V21_BALANCE, CAMPAIGN_SCENARIOS,
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

console.log('\n=== V21.0 冒烟测试 ===\n');

// ---------- 1. 15 位新武将 ----------
console.log('--- 1. 15 位新武将（v21_ 前缀）---');
const v21Generals = [
  'v21_xue_rengui',      // 薛仁贵
  'v21_pei_xingjian',   // 裴行俭
  'v21_zhang_gongjin',   // 张公谨
  'v21_hou_junji',       // 侯君集
  'v21_niu_jinda',       // 牛进达
  'v21_qian_jiulong',     // 钱九陇
  'v21_fan_xing',        // 樊兴
  'v21_gongsun_wuda',    // 公孙武达
  'v21_mai_mengcai',     // 麦孟才
  'v21_wang_junkuo',     // 王君廓
  'v21_luo_shixin',      // 罗士信
  'v21_qiu_xinggong',    // 丘行恭
  'v21_yin_kaishan',     // 殷开山
  'v21_tang_jian',       // 唐俭
  'v21_ashi_helu'        // 阿史那贺鲁
];
assert(v21Generals.length === 15, `新武将清单数量=15 (实际: ${v21Generals.length})`);
for (const gid of v21Generals) {
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
console.log('\n--- 2. 12 座新城市（v21_ 前缀）---');
const v21Cities = [
  'v21_yiwu', 'v21_gaochang', 'v21_qiemo', 'v21_jingjue',
  'v21_ronglu', 'v21_xiaoyuan', 'v21_qule', 'v21_pishan',
  'v21_yutian', 'v21_shache', 'v21_puli', 'v21_suiye'
];
assert(v21Cities.length === 12, `新城市清单数量=12 (实际: ${v21Cities.length})`);
for (const cid of v21Cities) {
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
// 双向链接校验
for (const cid of v21Cities) {
  for (const nbr of (CITY_LINKS[cid] || [])) {
    const back = CITY_LINKS[nbr];
    assert(Array.isArray(back) && back.includes(cid), `双向链接: ${nbr} -> ${cid}`);
  }
}

// ---------- 3. 20 个随机事件 ----------
console.log('\n--- 3. 20 个随机事件（v21_ 前缀）---');
const v21Events = [
  // 军事 5
  'v21_mu_shanbei', 'v21_mu_hushan', 'v21_mu_hanshui', 'v21_mu_shazhou', 'v21_mu_chitu',
  // 政治 4
  'v21_zheng_duhu', 'v21_zheng_huya', 'v21_zheng_jiebing', 'v21_zheng_jimi',
  // 经济 4（丝路贸易）
  'v21_jing_silu', 'v21_jing_yushi', 'v21_jing_xiangliao', 'v21_jing_hushi',
  // 文化 4
  'v21_wen_yuqu', 'v21_wen_jingjiao', 'v21_wen_hulei', 'v21_wen_yijing',
  // 特殊 3
  'v21_te_shachen', 'v21_te_hushi', 'v21_te_zouji'
];
assert(v21Events.length === 20, `随机事件清单数量=20 (实际: ${v21Events.length})`);
for (const eid of v21Events) {
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
console.log('\n--- 4. 5 个历史事件（v21_ 前缀）---');
const v21HistEvents = [
  'v21_tang_mie_tujue',       // 唐灭东突厥 630
  'v21_tang_mie_gaochang',    // 唐灭高昌 640
  'v21_su_dingfang_xiyu',     // 苏定方西平贺鲁 657
  'v21_baijiang_kouchuan',    // 白江口破倭 663
  'v21_tang_mie_gaoli'        // 唐灭高丽 668
];
assert(v21HistEvents.length === 5, `历史事件清单数量=5 (实际: ${v21HistEvents.length})`);
for (const hid of v21HistEvents) {
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
const v21Scenarios = ['630'];
assert(v21Scenarios.length === 1, `新剧本清单数量=1 (实际: ${v21Scenarios.length})`);
for (const sid of v21Scenarios) {
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
assert(CAMPAIGN_SCENARIOS.length === 30, `战役数量=30 (实际: ${CAMPAIGN_SCENARIOS.length})`);
const expectedCampaignIds = [
  'v21_yinshan_yixi',       // 阴山夜袭 630
  'v21_mie_gaochang',       // 攻灭高昌 640
  'v21_yedie_pohelu',       // 曳咥河破贺鲁 657
  'v21_baijiang_fenzhou',   // 白江口焚舟 663
  'v21_weiping_miegaoli'    // 围平壤灭高丽 668
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

// ---------- 7. V21_BALANCE 常量 ----------
console.log('\n--- 7. V21_BALANCE 平衡常量 ---');
assert(V21_BALANCE && typeof V21_BALANCE === 'object', 'V21_BALANCE 导出存在');
const requiredBalanceKeys = [
  'counterBonus', 'aiAttackThreshold', 'eventBaseProbability',
  'loyaltyDecayRate', 'maxTaxRate', 'incomePopFactor',
  'recruitCostDiscount', 'cityUpkeepFactor',
  'campaignRewardMult', 'campaignEnemyMult', 'recruitInitialLoyalty',
  'desertSupplyPenalty'
];
for (const k of requiredBalanceKeys) {
  assert(typeof V21_BALANCE[k] === 'number', `V21_BALANCE.${k} 是数字`);
}
assert(V21_BALANCE.counterBonus > 0 && V21_BALANCE.counterBonus < 1, 'counterBonus 在(0,1)');
assert(V21_BALANCE.aiAttackThreshold > 0 && V21_BALANCE.aiAttackThreshold < 1, 'aiAttackThreshold 在(0,1)');
assert(V21_BALANCE.eventBaseProbability > 0 && V21_BALANCE.eventBaseProbability < 1, 'eventBaseProbability 在(0,1)');
assert(V21_BALANCE.loyaltyDecayRate >= 0 && V21_BALANCE.loyaltyDecayRate < 2, 'loyaltyDecayRate 合理');
assert(V21_BALANCE.maxTaxRate > 0 && V21_BALANCE.maxTaxRate <= 100, 'maxTaxRate 合理');

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
for (const gid of v21Generals) {
  assert(Array.isArray(NEW_GENERAL_SKILLS[gid]), `${gid} 已注册到 NEW_GENERAL_SKILLS`);
}

// ---------- 10. 美术素材文件存在（20张） ----------
console.log('\n--- 10. 美术素材文件（20张） ---');
const expectedAssets = [
  // 15 武将立绘
  'portraits/v21_xue_rengui.png', 'portraits/v21_pei_xingjian.png', 'portraits/v21_zhang_gongjin.png',
  'portraits/v21_hou_junji.png', 'portraits/v21_niu_jinda.png', 'portraits/v21_qian_jiulong.png',
  'portraits/v21_fan_xing.png', 'portraits/v21_gongsun_wuda.png', 'portraits/v21_mai_mengcai.png',
  'portraits/v21_wang_junkuo.png', 'portraits/v21_luo_shixin.png', 'portraits/v21_qiu_xinggong.png',
  'portraits/v21_yin_kaishan.png', 'portraits/v21_tang_jian.png', 'portraits/v21_ashi_helu.png',
  // 5 战役插画
  'campaigns/v21_yinshan_yixi.png', 'campaigns/v21_mie_gaochang.png',
  'campaigns/v21_yedie_pohelu.png', 'campaigns/v21_baijiang_fenzhou.png',
  'campaigns/v21_weiping_miegaoli.png'
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
assert(GENERALS.length >= 230, `武将总数>=230 (实际: ${GENERALS.length})`);
assert(CITIES.length >= 116, `城市总数>=116 (实际: ${CITIES.length})`);
assert(EVENTS.length >= 435, `随机事件数>=435 (实际: ${EVENTS.length})`);
assert(HISTORICAL_EVENTS.length >= 135, `历史事件数>=135 (实际: ${HISTORICAL_EVENTS.length})`);
assert(Object.keys(SCENARIOS).length >= 33, `剧本数>=33 (实际: ${Object.keys(SCENARIOS).length})`);
assert(CAMPAIGN_SCENARIOS.length >= 30, `战役数>=30 (实际: ${CAMPAIGN_SCENARIOS.length})`);

// 结果汇总
console.log(`\n=== 结果: ${pass} 通过, ${fail} 失败 ===`);
process.exit(fail > 0 ? 1 : 0);
