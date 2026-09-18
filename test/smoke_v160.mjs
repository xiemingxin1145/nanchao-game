// ============================================================
// V16.0 冒烟测试 — 验证新增武将/随机事件/历史事件/剧本/战役/平衡常量/美术素材
// ============================================================
import {
  GENERALS, EVENTS, HISTORICAL_EVENTS,
  FACTIONS, SCENARIOS, V16_BALANCE, CAMPAIGN_SCENARIOS,
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

console.log('\n=== V16.0 冒烟测试 ===\n');

// ---------- 1. 15 位新武将 ----------
console.log('--- 1. 15 位新武将（v16_ 前缀）---');
const v16Generals = [
  'v16_niu_hong',       // 牛弘
  'v16_xue_daoheng',    // 薛道衡
  'v16_xu_shanshen',    // 许善心
  'v16_yu_shiji',       // 虞世基
  'v16_pei_ju',         // 裴矩
  'v16_cui_zhongfang',  // 崔仲方
  'v16_yuwen_kai',      // 宇文恺
  'v16_yang_yichen',    // 杨义臣
  'v16_zhang_xutuo',    // 张须陀
  'v16_chen_leng',      // 陈稜
  'v16_zhou_fashang',   // 周法尚
  'v16_xue_shixiong',   // 薛世雄
  'v16_yang_shuang',    // 杨爽
  'v16_xiao_cong',      // 萧琮
  'v16_kong_fan'        // 孔范
];
assert(v16Generals.length === 15, `新武将清单数量=15 (实际: ${v16Generals.length})`);
for (const gid of v16Generals) {
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
console.log('\n--- 2. 20 个随机事件（v16_ 前缀）---');
const v16Events = [
  // 军事 5
  'v16_bianfeng_baojing', 'v16_qingqi_zhanyao', 'v16_louchuan_xiajiang',
  'v16_junzhong_caoze', 'v16_chengxi_lei_gong',
  // 政治 4
  'v16_shengui_liuzhi', 'v16_yushi_fengwen', 'v16_zongshi_ruwei', 'v16_mensheng_jianju',
  // 经济 4
  'v16_juntun_kaitian', 'v16_yunchao_zhili', 'v16_guanshi_zhiju', 'v16_yantie_shiguan',
  // 文化 4
  'v16_mingtang_yashi', 'v16_dazang_jinglou', 'v16_yinshi_jiangxue', 'v16_lezhi_dingzhang',
  // 特殊 3
  'v16_jingxing_chutu', 'v16_renhe_xianqing', 'v16_jiquan_baoma'
];
assert(v16Events.length === 20, `随机事件清单数量=20 (实际: ${v16Events.length})`);
for (const eid of v16Events) {
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
console.log('\n--- 3. 5 个历史事件（v16_ 前缀）---');
const v16HistEvents = [
  'v16_wangbo_shouyi',       // 王薄首义
  'v16_yangxuangan_zhiluan', // 玄感黎阳
  'v16_limi_wagang',         // 李密瓦岗
  'v16_jiande_hebei',       // 建德夏王
  'v16_fuwei_jianghuai'      // 伏威江淮
];
assert(v16HistEvents.length === 5, `历史事件清单数量=5 (实际: ${v16HistEvents.length})`);
for (const hid of v16HistEvents) {
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
const v16Scenarios = ['580'];
assert(v16Scenarios.length === 1, `新剧本清单数量=1 (实际: ${v16Scenarios.length})`);
for (const sid of v16Scenarios) {
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

// ---------- 5. 5 个战役关卡 ----------
console.log('\n--- 5. 5 个战役关卡（CAMPAIGN_SCENARIOS）---');
assert(Array.isArray(CAMPAIGN_SCENARIOS), 'CAMPAIGN_SCENARIOS 是数组');
assert(CAMPAIGN_SCENARIOS.length === 5, `战役数量=5 (实际: ${CAMPAIGN_SCENARIOS.length})`);
const expectedCampaignIds = [
  'v16_liuyu_beifa', 'v16_zhongli_dajie', 'v16_yubi_baowei',
  'v16_shayuan_fuji', 'v16_suimie_chen'
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

// ---------- 6. V16_BALANCE 常量 ----------
console.log('\n--- 6. V16_BALANCE 平衡常量 ---');
assert(V16_BALANCE && typeof V16_BALANCE === 'object', 'V16_BALANCE 导出存在');
const requiredBalanceKeys = [
  'counterBonus', 'aiAttackThreshold', 'eventBaseProbability',
  'loyaltyDecayRate', 'maxTaxRate', 'incomePopFactor',
  'recruitCostDiscount', 'cityUpkeepFactor',
  'campaignRewardMult', 'campaignEnemyMult', 'recruitInitialLoyalty'
];
for (const k of requiredBalanceKeys) {
  assert(typeof V16_BALANCE[k] === 'number', `V16_BALANCE.${k} 是数字`);
}
assert(V16_BALANCE.counterBonus > 0 && V16_BALANCE.counterBonus < 1, 'counterBonus 在(0,1)');
assert(V16_BALANCE.aiAttackThreshold > 0 && V16_BALANCE.aiAttackThreshold < 1, 'aiAttackThreshold 在(0,1)');
assert(V16_BALANCE.eventBaseProbability > 0 && V16_BALANCE.eventBaseProbability < 1, 'eventBaseProbability 在(0,1)');
assert(V16_BALANCE.loyaltyDecayRate >= 0 && V16_BALANCE.loyaltyDecayRate < 2, 'loyaltyDecayRate 合理');
assert(V16_BALANCE.maxTaxRate > 0 && V16_BALANCE.maxTaxRate <= 100, 'maxTaxRate 合理');

// ---------- 7. ID 唯一性 ----------
console.log('\n--- 7. ID 唯一性 ---');
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

// ---------- 8. 新武将技能已注册 ----------
console.log('\n--- 8. 新武将技能注册 ---');
for (const gid of v16Generals) {
  assert(Array.isArray(NEW_GENERAL_SKILLS[gid]), `${gid} 已注册到 NEW_GENERAL_SKILLS`);
}

// ---------- 9. 美术素材文件存在（20张） ----------
console.log('\n--- 9. 美术素材文件（20张） ---');
const expectedAssets = [
  // 15 武将立绘
  'portraits/v16_niu_hong.png', 'portraits/v16_xue_daoheng.png', 'portraits/v16_xu_shanshen.png',
  'portraits/v16_yu_shiji.png', 'portraits/v16_pei_ju.png', 'portraits/v16_cui_zhongfang.png',
  'portraits/v16_yuwen_kai.png', 'portraits/v16_yang_yichen.png', 'portraits/v16_zhang_xutuo.png',
  'portraits/v16_chen_leng.png', 'portraits/v16_zhou_fashang.png', 'portraits/v16_xue_shixiong.png',
  'portraits/v16_yang_shuang.png', 'portraits/v16_xiao_cong.png', 'portraits/v16_kong_fan.png',
  // 5 战役插画
  'campaigns/v16_liuyu_beifa.png', 'campaigns/v16_zhongli_dajie.png',
  'campaigns/v16_yubi_baowei.png', 'campaigns/v16_shayuan_fuji.png',
  'campaigns/v16_suimie_chen.png'
];
assert(expectedAssets.length === 20, `素材清单数量=20 (实际: ${expectedAssets.length})`);
for (const rel of expectedAssets) {
  const p = path.join(ASSETS, rel);
  assert(fs.existsSync(p), `素材存在: ${rel}`);
}

// ---------- 10. 数据统计 ----------
console.log('\n--- 10. 数据统计 ---');
console.log(`  武将总数: ${GENERALS.length}`);
console.log(`  随机事件总数: ${EVENTS.length}`);
console.log(`  历史事件总数: ${HISTORICAL_EVENTS.length}`);
console.log(`  剧本总数: ${Object.keys(SCENARIOS).length}`);
console.log(`  战役总数: ${CAMPAIGN_SCENARIOS.length}`);
assert(GENERALS.length >= 155, `武将总数>=155 (实际: ${GENERALS.length})`);
assert(EVENTS.length >= 335, `随机事件数>=335 (实际: ${EVENTS.length})`);
assert(HISTORICAL_EVENTS.length >= 110, `历史事件数>=110 (实际: ${HISTORICAL_EVENTS.length})`);
assert(Object.keys(SCENARIOS).length >= 28, `剧本数>=28 (实际: ${Object.keys(SCENARIOS).length})`);
assert(CAMPAIGN_SCENARIOS.length >= 5, `战役数>=5 (实际: ${CAMPAIGN_SCENARIOS.length})`);

// 结果汇总
console.log(`\n=== 结果: ${pass} 通过, ${fail} 失败 ===`);
process.exit(fail > 0 ? 1 : 0);
