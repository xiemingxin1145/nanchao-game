// ============================================================
// V14.0 冒烟测试 — 验证新增武将/城市/随机事件/历史事件/剧本/平衡常量/美术素材
// ============================================================
import {
  GENERALS, CITIES, CITY_LINKS, EVENTS, HISTORICAL_EVENTS,
  FACTIONS, SCENARIOS, V14_BALANCE, NEW_GENERAL_SKILLS
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

console.log('\n=== V14.0 冒烟测试 ===\n');

// ---------- 1. 18 位新武将 ----------
console.log('--- 1. 18 位新武将（v14_ 前缀）---');
const v14Generals = [
  'v14_chang_yizhi',   // 昌义之
  'v14_pei_sui',       // 裴邃
  'v14_xiahou_kui',    // 夏侯夔
  'v14_dao_yanzhi',    // 到彦之
  'v14_zhu_lingshi',   // 朱龄石
  'v14_shen_tianzi',   // 沈田子
  'v14_shen_linzi',    // 沈林子
  'v14_liu_muzhi',     // 刘穆之
  'v14_he_chengtian',  // 何承天
  'v14_zu_chongzhi',   // 祖冲之
  'v14_fan_ye',        // 范晔
  'v14_xie_lingyun',   // 谢灵运
  'v14_shen_yue',      // 沈约
  'v14_jiang_yan',     // 江淹
  'v14_tao_hongjing',  // 陶弘景
  'v14_ke_qianzhi',    // 寇谦之
  'v14_fa_xian',       // 法显
  'v14_tan_luan'       // 昙鸾
];
assert(v14Generals.length === 18, `新武将清单数量=18 (实际: ${v14Generals.length})`);
for (const gid of v14Generals) {
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
console.log('\n--- 2. 12 座新城市（v14_ 前缀）---');
const v14Cities = [
  'v14_lingwu',   // 灵武
  'v14_xiazhou',  // 夏州
  'v14_yanzhou',  // 延州
  'v14_huazhou',  // 华州
  'v14_qizhou',   // 岐州
  'v14_bingzhou', // 豳州
  'v14_fengzhou', // 凤州
  'v14_lizhou',   // 利州
  'v14_xinzhou',  // 信州
  'v14_hengzhou', // 衡州
  'v14_chenzhou', // 郴州
  'v14_yaizhou'   // 崖州
];
assert(v14Cities.length === 12, `新城市清单数量=12 (实际: ${v14Cities.length})`);
// 检查坐标不重叠
const coordSet = new Set();
for (const c of CITIES) {
  const key = `${c.isoX},${c.isoY}`;
  if (coordSet.has(key)) assert(false, `坐标重叠: ${key} (${c.id})`);
  coordSet.add(key);
}
assert(coordSet.size === CITIES.length, `所有城市坐标唯一 (${coordSet.size}/${CITIES.length})`);

for (const cid of v14Cities) {
  const c = CITIES.find(x => x.id === cid);
  assert(c, `城市 ${cid} 存在`);
  if (c) {
    assert(c.name && c.name.length > 0, `${cid} 有名称`);
    assert(typeof c.isoX === 'number' && c.isoX >= 0 && c.isoX <= 15, `${cid} isoX 合理 (${c.isoX})`);
    assert(typeof c.isoY === 'number' && c.isoY >= 0 && c.isoY <= 12, `${cid} isoY 合理 (${c.isoY})`);
    assert(typeof c.size === 'number' && c.size >= 1 && c.size <= 4, `${cid} size 合理`);
    assert(typeof c.pop === 'number' && c.pop > 0, `${cid} pop 合理`);
    assert(typeof c.agri === 'number' && c.agri >= 0 && c.agri <= 100, `${cid} agri 合理`);
    assert(typeof c.comm === 'number' && c.comm >= 0 && c.comm <= 100, `${cid} comm 合理`);
    assert(typeof c.defense === 'number' && c.defense >= 0 && c.defense <= 100, `${cid} defense 合理`);
    // CITY_LINKS 中该城市存在且连接至少2座
    const links = CITY_LINKS[cid];
    assert(Array.isArray(links) && links.length >= 2, `${cid} CITY_LINKS 连接>=2 (实际: ${links ? links.length : 0})`);
    if (links) {
      for (const lid of links) {
        assert(CITIES.size ? CITIES.some(x => x.id === lid) : true, `${cid} 连接的城市 ${lid} 存在`);
      }
    }
  }
}
// 验证双向连接：A→B 则 B→A
let bidirErrors = 0;
for (const [city, links] of Object.entries(CITY_LINKS)) {
  for (const neighbor of links) {
    const nLinks = CITY_LINKS[neighbor];
    if (!nLinks || !nLinks.includes(city)) {
      bidirErrors++;
      console.log(`  WARN: 非双向连接 ${city} -> ${neighbor}`);
    }
  }
}
assert(bidirErrors === 0, `CITY_LINKS 双向连接完整 (错误数: ${bidirErrors})`);

// ---------- 3. 25 个随机事件 ----------
console.log('\n--- 3. 25 个随机事件（v14_ 前缀）---');
const v14Events = [
  // 军事 6
  'v14_qingye_zhaying', 'v14_qibing_huanfang', 'v14_chengguo_jiangzuo',
  'v14_bingbu_dajia', 'v14_jianting_yongbing', 'v14_dijun_biancheng',
  // 政治 5
  'v14_menxia_zhengquan', 'v14_shangshu_zoushi', 'v14_yushi_fengshi',
  'v14_zongshi_fengguo', 'v14_guichen_yintu',
  // 经济 5
  'v14_quannong_shijin', 'v14_yantie_gongying', 'v14_hedu_zhuli',
  'v14_sichou_gongshi', 'v14_yangma_fanxi',
  // 文化 5
  'v14_wenxue_qingtan', 'v14_fojiao_kaisui', 'v14_daozang_chuanjing',
  'v14_shufa_dadian', 'v14_yinyue_guchui',
  // 特殊 4
  'v14_chenxing_jishi', 'v14_longma_chutu', 'v14_fengming_qishan',
  'v14_yiren_xiabao'
];
assert(v14Events.length === 25, `随机事件清单数量=25 (实际: ${v14Events.length})`);
for (const eid of v14Events) {
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

// ---------- 4. 6 个历史事件 ----------
console.log('\n--- 4. 6 个历史事件（v14_ 前缀）---');
const v14HistEvents = [
  'v14_yongjia_nandu',      // 永嘉南渡
  'v14_liuyu_mie_nanyan',   // 刘裕灭南燕
  'v14_liuyu_mie_houqin',   // 刘裕灭后秦
  'v14_huatai_zhibai',      // 滑台之败
  'v14_xuanhu_zhizhan',     // 悬瓠之战
  'v14_yijia_zhinan'        // 义嘉之难
];
assert(v14HistEvents.length === 6, `历史事件清单数量=6 (实际: ${v14HistEvents.length})`);
for (const hid of v14HistEvents) {
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

// ---------- 5. 2 个新剧本 ----------
console.log('\n--- 5. 2 个新剧本 ---');
const v14Scenarios = ['430', '554'];
assert(v14Scenarios.length === 2, `新剧本清单数量=2 (实际: ${v14Scenarios.length})`);
for (const sid of v14Scenarios) {
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

// ---------- 6. V14_BALANCE 常量 ----------
console.log('\n--- 6. V14_BALANCE 平衡常量 ---');
assert(V14_BALANCE && typeof V14_BALANCE === 'object', 'V14_BALANCE 导出存在');
const requiredBalanceKeys = [
  'counterBonus', 'aiAttackThreshold', 'eventBaseProbability',
  'loyaltyDecayRate', 'maxTaxRate', 'incomePopFactor',
  'recruitCostDiscount', 'cityUpkeepFactor'
];
for (const k of requiredBalanceKeys) {
  assert(typeof V14_BALANCE[k] === 'number', `V14_BALANCE.${k} 是数字`);
}
assert(V14_BALANCE.counterBonus > 0 && V14_BALANCE.counterBonus < 1, 'counterBonus 在(0,1)');
assert(V14_BALANCE.aiAttackThreshold > 0 && V14_BALANCE.aiAttackThreshold < 1, 'aiAttackThreshold 在(0,1)');
assert(V14_BALANCE.eventBaseProbability > 0 && V14_BALANCE.eventBaseProbability < 1, 'eventBaseProbability 在(0,1)');
assert(V14_BALANCE.loyaltyDecayRate >= 0 && V14_BALANCE.loyaltyDecayRate < 2, 'loyaltyDecayRate 合理');
assert(V14_BALANCE.maxTaxRate > 0 && V14_BALANCE.maxTaxRate <= 100, 'maxTaxRate 合理');

// ---------- 7. ID 唯一性 ----------
console.log('\n--- 7. ID 唯一性 ---');
const generalIds = new Set();
let gDup = 0;
for (const g of GENERALS) { if (generalIds.has(g.id)) gDup++; generalIds.add(g.id); }
assert(gDup === 0, `武将 ID 无重复 (重复数: ${gDup})`);

const cityIds = new Set();
let cDup = 0;
for (const c of CITIES) { if (cityIds.has(c.id)) cDup++; cityIds.add(c.id); }
assert(cDup === 0, `城市 ID 无重复 (重复数: ${cDup})`);

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
for (const gid of v14Generals) {
  assert(Array.isArray(NEW_GENERAL_SKILLS[gid]), `${gid} 已注册到 NEW_GENERAL_SKILLS`);
}

// ---------- 9. 美术素材文件存在（36张） ----------
console.log('\n--- 9. 美术素材文件 ---');
const expectedAssets = [
  // 18 武将立绘
  'portraits/v14_chang_yizhi.png', 'portraits/v14_pei_sui.png', 'portraits/v14_xiahou_kui.png',
  'portraits/v14_dao_yanzhi.png', 'portraits/v14_zhu_lingshi.png', 'portraits/v14_shen_tianzi.png',
  'portraits/v14_shen_linzi.png', 'portraits/v14_liu_muzhi.png', 'portraits/v14_he_chengtian.png',
  'portraits/v14_zu_chongzhi.png', 'portraits/v14_fan_ye.png', 'portraits/v14_xie_lingyun.png',
  'portraits/v14_shen_yue.png', 'portraits/v14_jiang_yan.png', 'portraits/v14_tao_hongjing.png',
  'portraits/v14_ke_qianzhi.png', 'portraits/v14_fa_xian.png', 'portraits/v14_tan_luan.png',
  // 12 城市风貌
  'cities/v14_lingwu.png', 'cities/v14_xiazhou.png', 'cities/v14_yanzhou.png',
  'cities/v14_huazhou.png', 'cities/v14_qizhou.png', 'cities/v14_bingzhou.png',
  'cities/v14_fengzhou.png', 'cities/v14_lizhou.png', 'cities/v14_xinzhou.png',
  'cities/v14_hengzhou.png', 'cities/v14_chenzhou.png', 'cities/v14_yaizhou.png',
  // 6 战斗/事件插画
  'events/v14_yongjia_nandu.png', 'events/v14_liuyu_beifa.png', 'events/v14_huatai_zhibai.png',
  'events/v14_xuanhu_zhizhan.png', 'events/v14_yijia_zhinan.png', 'events/v14_yuanjia_beifa.png'
];
assert(expectedAssets.length === 36, `素材清单数量=36 (实际: ${expectedAssets.length})`);
for (const rel of expectedAssets) {
  const p = path.join(ASSETS, rel);
  assert(fs.existsSync(p), `素材存在: ${rel}`);
}

// ---------- 10. 数据统计 ----------
console.log('\n--- 10. 数据统计 ---');
console.log(`  武将总数: ${GENERALS.length}`);
console.log(`  城市总数: ${CITIES.length}`);
console.log(`  随机事件总数: ${EVENTS.length}`);
console.log(`  历史事件总数: ${HISTORICAL_EVENTS.length}`);
console.log(`  剧本总数: ${Object.keys(SCENARIOS).length}`);
assert(GENERALS.length >= 125, `武将总数>=125 (实际: ${GENERALS.length})`);
assert(CITIES.length >= 70, `城市总数>=70 (实际: ${CITIES.length})`);
assert(EVENTS.length >= 290, `随机事件数>=290 (实际: ${EVENTS.length})`);
assert(HISTORICAL_EVENTS.length >= 100, `历史事件数>=100 (实际: ${HISTORICAL_EVENTS.length})`);
assert(Object.keys(SCENARIOS).length >= 26, `剧本数>=26 (实际: ${Object.keys(SCENARIOS).length})`);

// 结果汇总
console.log(`\n=== 结果: ${pass} 通过, ${fail} 失败 ===`);
process.exit(fail > 0 ? 1 : 0);
