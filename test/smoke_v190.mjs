// ============================================================
// V19.0 冒烟测试 — 验证新增武将/城市/随机事件/历史事件/剧本/战役/平衡常量/美术素材
// ============================================================
import {
  GENERALS, CITIES, CITY_LINKS, EVENTS, HISTORICAL_EVENTS,
  FACTIONS, SCENARIOS, V19_BALANCE, CAMPAIGN_SCENARIOS,
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

console.log('\n=== V19.0 冒烟测试 ===\n');

// ---------- 1. 15 位新武将 ----------
console.log('--- 1. 15 位新武将（v19_ 前缀）---');
const v19Generals = [
  'v19_yang_xuangan',   // 杨玄感
  'v19_sima_dekan',     // 司马德戡
  'v19_pei_qiantong',   // 裴虔通
  'v19_chai_shao',      // 柴绍
  'v19_yuchi_jingde',   // 尉迟敬德
  'v19_changsun_wuji',  // 长孙无忌
  'v19_fang_xuanling',  // 房玄龄
  'v19_du_ruhui',       // 杜如晦
  'v19_li_xiaogong',    // 李孝恭
  'v19_li_jiancheng',   // 李建成
  'v19_li_yuanji',      // 李元吉
  'v19_liu_heita',      // 刘黑闼
  'v19_dan_xiongxin',   // 单雄信
  'v19_wang_bodang',    // 王伯当
  'v19_su_dingfang'     // 苏定方
];
assert(v19Generals.length === 15, `新武将清单数量=15 (实际: ${v19Generals.length})`);
for (const gid of v19Generals) {
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
console.log('\n--- 2. 12 座新城市（v19_ 前缀）---');
const v19Cities = [
  'v19_yuanzhou', 'v19_weizhou', 'v19_lanzhou', 'v19_minzhou',
  'v19_taozhou', 'v19_ganzhou', 'v19_suzhou', 'v19_liucheng',
  'v19_lulong', 'v19_yunzhong', 'v19_shuozhou', 'v19_guangchang'
];
assert(v19Cities.length === 12, `新城市清单数量=12 (实际: ${v19Cities.length})`);
for (const cid of v19Cities) {
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
for (const cid of v19Cities) {
  for (const nbr of (CITY_LINKS[cid] || [])) {
    const back = CITY_LINKS[nbr];
    assert(Array.isArray(back) && back.includes(cid), `双向链接: ${nbr} -> ${cid}`);
  }
}

// ---------- 3. 20 个随机事件 ----------
console.log('\n--- 3. 20 个随机事件（v19_ 前缀）---');
const v19Events = [
  // 军事 5
  'v19_mu_yanmen', 'v19_mu_xueye', 'v19_mu_houshao', 'v19_mu_jiehu', 'v19_mu_jianchen',
  // 政治 4
  'v19_zheng_tangyi', 'v19_zheng_laoqie', 'v19_zheng_wufang', 'v19_zheng_jingcheng',
  // 经济 4
  'v19_jing_huanghe', 'v19_jing_chama', 'v19_jing_yantie', 'v19_jing_huangtun',
  // 文化 4
  'v19_wen_shigu', 'v19_wen_guozijian', 'v19_wen_yuefu', 'v19_wen_fangji',
  // 特殊 3
  'v19_te_longmen', 'v19_te_yima', 'v19_te_baichan'
];
assert(v19Events.length === 20, `随机事件清单数量=20 (实际: ${v19Events.length})`);
for (const eid of v19Events) {
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
console.log('\n--- 4. 5 个历史事件（v19_ 前缀）---');
const v19HistEvents = [
  'v19_yanmen_zhiwei',   // 雁门之围
  'v19_qianshuiyuan',    // 浅水原之战
  'v19_ping_ligui',      // 唐平李轨
  'v19_ping_xiaoxian',   // 唐平萧铣
  'v19_ping_liuheita'    // 唐平刘黑闼
];
assert(v19HistEvents.length === 5, `历史事件清单数量=5 (实际: ${v19HistEvents.length})`);
for (const hid of v19HistEvents) {
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
const v19Scenarios = ['621'];
assert(v19Scenarios.length === 1, `新剧本清单数量=1 (实际: ${v19Scenarios.length})`);
for (const sid of v19Scenarios) {
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
assert(CAMPAIGN_SCENARIOS.length === 20, `战役数量=20 (实际: ${CAMPAIGN_SCENARIOS.length})`);
const expectedCampaignIds = [
  'v19_qianshuiyuan',        // 浅水原之战 618
  'v19_jinyang_baowei',      // 晋阳保卫战 619
  'v19_jingling_pingxiao',   // 江陵平萧铣 621
  'v19_mingshui_pingheita',  // 洺水破刘黑闼 622
  'v19_dujiang_miefu'        // 渡江灭辅公祏 624
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

// ---------- 7. V19_BALANCE 常量 ----------
console.log('\n--- 7. V19_BALANCE 平衡常量 ---');
assert(V19_BALANCE && typeof V19_BALANCE === 'object', 'V19_BALANCE 导出存在');
const requiredBalanceKeys = [
  'counterBonus', 'aiAttackThreshold', 'eventBaseProbability',
  'loyaltyDecayRate', 'maxTaxRate', 'incomePopFactor',
  'recruitCostDiscount', 'cityUpkeepFactor',
  'campaignRewardMult', 'campaignEnemyMult', 'recruitInitialLoyalty',
  'desertSupplyPenalty'
];
for (const k of requiredBalanceKeys) {
  assert(typeof V19_BALANCE[k] === 'number', `V19_BALANCE.${k} 是数字`);
}
assert(V19_BALANCE.counterBonus > 0 && V19_BALANCE.counterBonus < 1, 'counterBonus 在(0,1)');
assert(V19_BALANCE.aiAttackThreshold > 0 && V19_BALANCE.aiAttackThreshold < 1, 'aiAttackThreshold 在(0,1)');
assert(V19_BALANCE.eventBaseProbability > 0 && V19_BALANCE.eventBaseProbability < 1, 'eventBaseProbability 在(0,1)');
assert(V19_BALANCE.loyaltyDecayRate >= 0 && V19_BALANCE.loyaltyDecayRate < 2, 'loyaltyDecayRate 合理');
assert(V19_BALANCE.maxTaxRate > 0 && V19_BALANCE.maxTaxRate <= 100, 'maxTaxRate 合理');

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
for (const gid of v19Generals) {
  assert(Array.isArray(NEW_GENERAL_SKILLS[gid]), `${gid} 已注册到 NEW_GENERAL_SKILLS`);
}

// ---------- 10. 美术素材文件存在（20张） ----------
console.log('\n--- 10. 美术素材文件（20张） ---');
const expectedAssets = [
  // 15 武将立绘
  'portraits/v19_yang_xuangan.png', 'portraits/v19_sima_dekan.png', 'portraits/v19_pei_qiantong.png',
  'portraits/v19_chai_shao.png', 'portraits/v19_yuchi_jingde.png', 'portraits/v19_changsun_wuji.png',
  'portraits/v19_fang_xuanling.png', 'portraits/v19_du_ruhui.png', 'portraits/v19_li_xiaogong.png',
  'portraits/v19_li_jiancheng.png', 'portraits/v19_li_yuanji.png', 'portraits/v19_liu_heita.png',
  'portraits/v19_dan_xiongxin.png', 'portraits/v19_wang_bodang.png', 'portraits/v19_su_dingfang.png',
  // 5 战役插画
  'campaigns/v19_qianshuiyuan.png', 'campaigns/v19_jinyang_baowei.png',
  'campaigns/v19_jingling_pingxiao.png', 'campaigns/v19_mingshui_pingheita.png',
  'campaigns/v19_dujiang_miefu.png'
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
assert(GENERALS.length >= 200, `武将总数>=200 (实际: ${GENERALS.length})`);
assert(CITIES.length >= 92, `城市总数>=92 (实际: ${CITIES.length})`);
assert(EVENTS.length >= 395, `随机事件数>=395 (实际: ${EVENTS.length})`);
assert(HISTORICAL_EVENTS.length >= 125, `历史事件数>=125 (实际: ${HISTORICAL_EVENTS.length})`);
assert(Object.keys(SCENARIOS).length >= 31, `剧本数>=31 (实际: ${Object.keys(SCENARIOS).length})`);
assert(CAMPAIGN_SCENARIOS.length >= 20, `战役数>=20 (实际: ${CAMPAIGN_SCENARIOS.length})`);

// 结果汇总
console.log(`\n=== 结果: ${pass} 通过, ${fail} 失败 ===`);
process.exit(fail > 0 ? 1 : 0);
