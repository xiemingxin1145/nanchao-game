// ============================================================
// V17.0 冒烟测试 — 验证新增武将/随机事件/历史事件/剧本/战役/平衡常量/美术素材
// ============================================================
import {
  GENERALS, EVENTS, HISTORICAL_EVENTS,
  FACTIONS, SCENARIOS, V17_BALANCE, CAMPAIGN_SCENARIOS,
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

console.log('\n=== V17.0 冒烟测试 ===\n');

// ---------- 1. 15 位新武将 ----------
console.log('--- 1. 15 位新武将（v17_ 前缀）---');
const v17Generals = [
  'v17_yang_xiu',       // 杨秀
  'v17_yang_liang',     // 杨谅
  'v17_yang_jun',       // 杨俊
  'v17_shen_keqing',    // 沈客卿
  'v17_shi_wenqing',    // 施文庆
  'v17_ren_yue',        // 任约
  'v17_yuwen_huaji',    // 宇文化及
  'v17_wang_shichong',  // 王世充
  'v17_dou_jiande',     // 窦建德
  'v17_xiao_xian',      // 萧铣
  'v17_xu_shiji',       // 李勣
  'v17_qin_shubao',     // 秦叔宝
  'v17_cheng_yaojin',   // 程知节
  'v17_wei_zheng',      // 魏徵
  'v17_li_jing'         // 李靖
];
assert(v17Generals.length === 15, `新武将清单数量=15 (实际: ${v17Generals.length})`);
for (const gid of v17Generals) {
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
console.log('\n--- 2. 20 个随机事件（v17_ 前缀）---');
const v17Events = [
  // 军事 5
  'v17_hu_qi_raobian', 'v17_jian_ying_lian_zhai', 'v17_shui_jun_chu_haikou',
  'v17_jiang_zhong_jing_bian', 'v17_gong_cheng_lei_shi',
  // 政治 4
  'v17_tai_zi_jian_guo', 'v17_zaixiang_xie_chu', 'v17_zongshi_neidou', 'v17_keqing_jian_tu',
  // 经济 4
  'v17_tuntian_fengshou', 'v17_cao_yun_shutong', 'v17_guanshi_tongshang', 'v17_yantie_yezhu',
  // 文化 4
  'v17_taixue_jiangxue', 'v17_fo_xiang_kaiguang', 'v17_shufa_dajia', 'v17_shijing_kance',
  // 特殊 3
  'v17_long_jian_jianghai', 'v17_mingma_chuchu', 'v17_yiren_xiabao'
];
assert(v17Events.length === 20, `随机事件清单数量=20 (实际: ${v17Events.length})`);
for (const eid of v17Events) {
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
console.log('\n--- 3. 5 个历史事件（v17_ 前缀）---');
const v17HistEvents = [
  'v17_sui_zheng_gaogouli',  // 炀帝征辽
  'v17_mie_houliang',        // 隋废后梁
  'v17_kai_dayunhe',         // 开通济渠
  'v17_taiyuan_bingqi',      // 太原起兵
  'v17_jiangdu_zhibian'      // 江都之变
];
assert(v17HistEvents.length === 5, `历史事件清单数量=5 (实际: ${v17HistEvents.length})`);
for (const hid of v17HistEvents) {
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
const v17Scenarios = ['543'];
assert(v17Scenarios.length === 1, `新剧本清单数量=1 (实际: ${v17Scenarios.length})`);
for (const sid of v17Scenarios) {
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

// ---------- 5. 5 个新战役关卡 ----------
console.log('\n--- 5. 5 个新战役关卡（CAMPAIGN_SCENARIOS）---');
assert(Array.isArray(CAMPAIGN_SCENARIOS), 'CAMPAIGN_SCENARIOS 是数组');
assert(CAMPAIGN_SCENARIOS.length === 10, `战役数量=10 (实际: ${CAMPAIGN_SCENARIOS.length})`);
const expectedCampaignIds = [
  'v16_liuyu_beifa', 'v16_zhongli_dajie', 'v16_yubi_baowei',
  'v16_shayuan_fuji', 'v16_suimie_chen',
  'v17_mangshan_dazhan', 'v17_ybi_aozhan', 'v17_jiangling_xianluo',
  'v17_huainan_beifa', 'v17_jinyang_zhizhan'
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

// ---------- 6. V17_BALANCE 常量 ----------
console.log('\n--- 6. V17_BALANCE 平衡常量 ---');
assert(V17_BALANCE && typeof V17_BALANCE === 'object', 'V17_BALANCE 导出存在');
const requiredBalanceKeys = [
  'counterBonus', 'aiAttackThreshold', 'eventBaseProbability',
  'loyaltyDecayRate', 'maxTaxRate', 'incomePopFactor',
  'recruitCostDiscount', 'cityUpkeepFactor',
  'campaignRewardMult', 'campaignEnemyMult', 'recruitInitialLoyalty'
];
for (const k of requiredBalanceKeys) {
  assert(typeof V17_BALANCE[k] === 'number', `V17_BALANCE.${k} 是数字`);
}
assert(V17_BALANCE.counterBonus > 0 && V17_BALANCE.counterBonus < 1, 'counterBonus 在(0,1)');
assert(V17_BALANCE.aiAttackThreshold > 0 && V17_BALANCE.aiAttackThreshold < 1, 'aiAttackThreshold 在(0,1)');
assert(V17_BALANCE.eventBaseProbability > 0 && V17_BALANCE.eventBaseProbability < 1, 'eventBaseProbability 在(0,1)');
assert(V17_BALANCE.loyaltyDecayRate >= 0 && V17_BALANCE.loyaltyDecayRate < 2, 'loyaltyDecayRate 合理');
assert(V17_BALANCE.maxTaxRate > 0 && V17_BALANCE.maxTaxRate <= 100, 'maxTaxRate 合理');

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
for (const gid of v17Generals) {
  assert(Array.isArray(NEW_GENERAL_SKILLS[gid]), `${gid} 已注册到 NEW_GENERAL_SKILLS`);
}

// ---------- 9. 美术素材文件存在（20张） ----------
console.log('\n--- 9. 美术素材文件（20张） ---');
const expectedAssets = [
  // 15 武将立绘
  'portraits/v17_yang_xiu.png', 'portraits/v17_yang_liang.png', 'portraits/v17_yang_jun.png',
  'portraits/v17_shen_keqing.png', 'portraits/v17_shi_wenqing.png', 'portraits/v17_ren_yue.png',
  'portraits/v17_yuwen_huaji.png', 'portraits/v17_wang_shichong.png', 'portraits/v17_dou_jiande.png',
  'portraits/v17_xiao_xian.png', 'portraits/v17_xu_shiji.png', 'portraits/v17_qin_shubao.png',
  'portraits/v17_cheng_yaojin.png', 'portraits/v17_wei_zheng.png', 'portraits/v17_li_jing.png',
  // 5 战役插画
  'campaigns/v17_mangshan_dazhan.png', 'campaigns/v17_ybi_aozhan.png',
  'campaigns/v17_jiangling_xianluo.png', 'campaigns/v17_huainan_beifa.png',
  'campaigns/v17_jinyang_zhizhan.png'
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
assert(GENERALS.length >= 170, `武将总数>=170 (实际: ${GENERALS.length})`);
assert(EVENTS.length >= 355, `随机事件数>=355 (实际: ${EVENTS.length})`);
assert(HISTORICAL_EVENTS.length >= 115, `历史事件数>=115 (实际: ${HISTORICAL_EVENTS.length})`);
assert(Object.keys(SCENARIOS).length >= 29, `剧本数>=29 (实际: ${Object.keys(SCENARIOS).length})`);
assert(CAMPAIGN_SCENARIOS.length >= 10, `战役数>=10 (实际: ${CAMPAIGN_SCENARIOS.length})`);

// 结果汇总
console.log(`\n=== 结果: ${pass} 通过, ${fail} 失败 ===`);
process.exit(fail > 0 ? 1 : 0);
