// ============================================================
// tax.js — V8.0 赋税系统
//
// 历史背景：南北朝赋税制度复杂——曹魏租调制、北魏均田制、隋唐租庸调制。
// 赋税轻重直接影响民心、人口与叛乱。5级赋税可由玩家/AI调节，调整有冷却。
//
// 核心逻辑：
//  - 每城独立 taxLevel（1~5），收入乘数见 TAX_LEVELS
//  - 赋税过重（4/5级）且民心低时触发「农民起义」「百姓逃亡」事件
//  - AI 根据民心和经济状况自动调整赋税
// ============================================================
import { TAX_LEVELS, TAX_ADJUST_COOLDOWN } from './data.js';

// 获取某势力所有城市的平均赋税等级
export function getFactionAvgTaxLevel(game, factionId) {
  const cities = game.getFactionCities(factionId);
  if (cities.length === 0) return 2;
  return Math.round(cities.reduce((s, c) => s + (c.taxLevel || 2), 0) / cities.length);
}

// 获取某势力平均赋税效果（民心加成/人口修正）
export function getFactionTaxModifiers(game, factionId) {
  const cities = game.getFactionCities(factionId);
  if (cities.length === 0) return { moraleDelta: 0, popMult: 0, incomeMult: 1.0 };
  let moraleDelta = 0, popMult = 0, incomeMultSum = 0;
  for (const c of cities) {
    const lv = TAX_LEVELS[(c.taxLevel || 2) - 1] || TAX_LEVELS[1];
    moraleDelta += lv.moraleDelta;
    popMult += lv.popMult || 0;
    incomeMultSum += lv.multiplier || 1.0;
  }
  const n = cities.length;
  return {
    moraleDelta: Math.round(moraleDelta / n),
    popMult: popMult / n,
    incomeMult: incomeMultSum / n
  };
}

// 赋税过重检查：返回应触发的事件id（null=无事件）
export function checkTaxEvent(game, factionId) {
  const cities = game.getFactionCities(factionId);
  let heavyCities = 0;
  let lowMoraleCities = 0;
  for (const c of cities) {
    if ((c.taxLevel || 2) >= 4) heavyCities++;
    if (c.morale < 25) lowMoraleCities++;
  }
  // 苛捐杂税（5级）+ 民心极低 → 农民起义
  if (cities.some(c => (c.taxLevel || 2) >= 5 && c.morale < 20) && Math.random() < 0.3) {
    return 'tax_rebellion';
  }
  // 沉重赋税（4级）+ 多城民心低 → 百姓逃亡
  if (heavyCities >= 2 && lowMoraleCities >= 1 && Math.random() < 0.25) {
    return 'tax_refugees';
  }
  return null;
}

// AI 赋税决策：根据民心和经济自动调整
export function aiAdjustTax(game, factionId) {
  const cities = game.getFactionCities(factionId);
  for (const city of cities) {
    if (city.taxCooldown > 0) continue;
    const curLv = city.taxLevel || 2;
    // 民心低 → 降税
    if (city.morale < 25 && curLv > 2) {
      city.setTaxLevel(curLv - 1);
      game.pushLog(`【AI】${city.name} 降税至「${TAX_LEVELS[city.taxLevel - 1].name}」安抚民心`);
    }
    // 经济好+民心高 → 适当加税
    else if (city.morale > 75 && curLv < 3) {
      city.setTaxLevel(curLv + 1);
      game.pushLog(`【AI】${city.name} 加税至「${TAX_LEVELS[city.taxLevel - 1].name}」充实府库`);
    }
  }
}

// 序列化/反序列化（赋税状态已在 City 中，这里提供势力级辅助）
export function serializeTax() {
  return { TAX_LEVELS };
}

// ============================================================
// V14.0「霸业宏图」：税收系统优化 API
// 三类税收：农业税（按粮食产出）/ 商业税（按金钱产出）/ 人口税（按人口）
// ============================================================

/**
 * 按指定税率计算某城税收总额
 * @param {object} city - City 实例
 * @param {number} taxRate - 税率 0~100（百分比）
 * @returns {number} 税收金额（金钱）
 */
export function calculateTax(city, taxRate) {
  const rate = Math.max(0, Math.min(100, taxRate != null ? taxRate : (city.taxRate || 30))) / 100;
  // 农业税：粮食产出 × 税率 × 0.5（折算金钱）
  const food = (typeof city.calcFood === 'function') ? city.calcFood() : 0;
  const agriTax = food * rate * 0.5;
  // 商业税：城市商业规模 × 税率
  const commTax = (city.comm || 0) * rate * (city.pop || 0) / 1000;
  // 人口税：人口 × 税率 × 0.02
  const popTax = (city.pop || 0) * rate * 0.02;
  return Math.round(agriTax + commTax + popTax);
}

/**
 * 获取某城税收明细（三类税收分项）
 * @returns {agricultureTax, commerceTax, populationTax, total}
 */
export function getTaxBreakdown(city) {
  const rate = Math.max(0, Math.min(100, city.taxRate || 30)) / 100;
  const food = (typeof city.calcFood === 'function') ? city.calcFood() : 0;
  const agricultureTax = Math.round(food * rate * 0.5);
  const commerceTax = Math.round((city.comm || 0) * rate * (city.pop || 0) / 1000);
  const populationTax = Math.round((city.pop || 0) * rate * 0.02);
  return {
    agricultureTax,
    commerceTax,
    populationTax,
    total: agricultureTax + commerceTax + populationTax
  };
}

/**
 * 对某势力应用税收政策
 * policy: { taxLevel: 1~5, description: string }
 * 遍历该势力所有城市调整赋税等级
 * @returns {ok, msg, affected}
 */
export function applyTaxPolicy(game, faction, policy) {
  const cities = game.getFactionCities ? game.getFactionCities(faction.id || faction) : [];
  if (!cities.length) return { ok: false, msg: '无城市可应用政策' };
  const level = Math.max(1, Math.min(5, policy.taxLevel || 2));
  let affected = 0;
  for (const c of cities) {
    if (typeof c.setTaxLevel === 'function') {
      c.setTaxLevel(level);
      affected++;
    }
  }
  const lv = TAX_LEVELS[level - 1] || TAX_LEVELS[1];
  return {
    ok: true,
    msg: `已对 ${affected} 城应用「${lv.name}」政策：${lv.desc}`,
    affected,
    taxLevel: level
  };
}
