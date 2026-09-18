// ============================================================
// espionage.js — V2.5 谍报系统（V15.0 系统深化版）
// ============================================================
// 密报任务（见 GDD §三）：
//  intel     刺探情报：获取目标城详情，成功率 = min(80%, 智力/120)；
//            成功后授予该城 3 回合临时视野。
//  sabotage  破坏农业/商业/防御（随机 -5~-15），成功率 = min(70%, 智力/150)。
//  defect    策反低忠诚武将：成功率随 (60-忠诚) 与智力提升，硬上限 60%；
//            成功则该武将带部分城防投诚。
// 费用：intel 500 / sabotage 1200 / defect 2000；执行 1 回合。
// 被发现率 = 城防/200 + 太守智力/200（上限 80%）；
// 被发现：密探（所派武将）被处决，双方关系 -10。
//
// V15.0 新增 5 项谍报行动：
//  gather_info   收集情报：获取对方兵力/粮草/城防信息
//  spread_rumors 散布谣言：降低对方武将忠诚/民心
//  damage_irrigation 破坏水利：降低对方农业产出
//  defector      策反武将：秘密接触对方武将
//  spy_tech      刺探科技：获取对方最新科技
// 成功率受：谍报武将智力 / 对方反谍等级 / 双方外交关系 影响。
// 新增 API：espionageAction(agent, targetFaction, actionType, targetGeneral)
// ============================================================
import { SPY_COST, SPY_TURNS, SPY_SUCCESS_CAP, FACTIONS } from './data.js';
import { grantIntelVision } from './fog.js';

let spyCounter = 0;

// V15.0：新增谍报行动费用表
export const V15_SPY_COST = {
  gather_info:     800,    // 收集情报
  spread_rumors:   1000,   // 散布谣言
  damage_irrigation: 1500,  // 破坏水利
  defector:        2000,   // 策反武将（同 defect）
  spy_tech:        1800    // 刺探科技
};

// V15.0：行动中文名映射
const V15_ACTION_NAMES = {
  gather_info: '收集情报',
  spread_rumors: '散布谣言',
  damage_irrigation: '破坏水利',
  defector: '策反武将',
  spy_tech: '刺探科技'
};

// 选择派出密探（自动选本势力智力最高、闲居无职的武将）
function pickSpyGeneral(game, factionId) {
  const gens = game.getFactionGenerals(factionId)
    .filter(g => !g.inArmy && !g.onHostage && g.role !== '君主')
    .sort((a, b) => b.effIntel - a.effIntel);
  return gens[0] || null;
}

// 派遣密探。factionId 为派遣方（玩家或 AI）。
export function sendSpy(game, factionId, cityId, mission) {
  if (!SPY_COST[mission]) return { ok: false, msg: '未知任务类型' };
  const target = game.cities.get(cityId);
  if (!target) return { ok: false, msg: '目标城市不存在' };
  if (!target.owner || target.owner === factionId) {
    return { ok: false, msg: '不能在己方城市派遣密探' };
  }
  const res = game.factionRes.get(factionId);
  const cost = SPY_COST[mission];
  if (!res || res.money < cost) return { ok: false, msg: `资金不足（需 ${cost} 金）` };
  const spyGen = pickSpyGeneral(game, factionId);
  if (!spyGen) return { ok: false, msg: '本势力无可用密探（需一名闲居武将）' };

  res.money -= cost;
  const spy = {
    id: 'spy_' + (++spyCounter),
    faction: factionId,
    targetFaction: target.owner,
    targetCity: cityId,
    mission,
    spyGeneralId: spyGen.id,
    turnsLeft: SPY_TURNS,
    status: 'active'
  };
  game.spies.push(spy);
  spyGen.onMission = true;   // 出发执行任务期间不可任职
  game.pushLog(`【${FACTIONS[factionId].name}】遣 ${spyGen.name} 潜入 ${target.name} 执行【${missionName(mission)}】`);
  return { ok: true, msg: `密探 ${spyGen.name} 已潜入 ${target.name}`, spy };
}

function missionName(m) {
  return { intel: '刺探情报', sabotage: '破坏', defect: '策反',
    ...V15_ACTION_NAMES }[m] || m;
}

// 被发现率公式：城防/200 + 太守智力/200，上限 80%
export function detectChance(game, city) {
  let ch = (city.defense || 0) / 200;
  if (city.mayor) {
    const mg = game.generals.get(city.mayor);
    if (mg) ch += mg.effIntel / 200;
  }
  return Math.min(0.80, ch);
}

// 成功率公式（mission 分支），硬上限见 SPY_SUCCESS_CAP
function successChance(game, spy, city) {
  const gen = game.generals.get(spy.spyGeneralId);
  const intel = gen ? gen.effIntel : 50;
  if (spy.mission === 'intel') {
    return Math.min(SPY_SUCCESS_CAP, intel / 120);
  }
  if (spy.mission === 'sabotage') {
    return Math.min(0.70, intel / 150);
  }
  // defect：挑城中忠诚最低且非太守/非君主的武将
  const targetGen = pickDefectTarget(game, city);
  if (!targetGen) return 0;
  // 忠诚越低越易策反；智力越高越易成功
  const loyaltyPart = Math.max(0, (60 - targetGen.loyalty)) / 100;
  return Math.min(0.60, loyaltyPart + intel / 200);
}

function pickDefectTarget(game, city) {
  const candidates = [...game.generals.values()].filter(g =>
    g.faction === city.owner &&
    g.location === city.id &&
    !g.inArmy &&
    g.role !== '君主'
  );
  candidates.sort((a, b) => a.loyalty - b.loyalty);
  return candidates[0] || null;
}

// 回合结算：推进密探任务，到期则判定
export function resolveSpies(game) {
  const finished = [];
  game.spies = game.spies.filter(spy => {
    if (spy.status !== 'active') return false;
    spy.turnsLeft--;
    if (spy.turnsLeft > 0) return true;
    _resolveSpy(game, spy);
    finished.push(spy);
    return false; // 已结算，移出活动队列
  });
  return finished;
}

function _resolveSpy(game, spy) {
  const city = game.cities.get(spy.targetCity);
  const spyGen = game.generals.get(spy.spyGeneralId);
  if (spyGen) spyGen.onMission = false;
  if (!city) return;

  const detect = detectChance(game, city);
  const caught = Math.random() < detect;
  if (caught) {
    // 被发现：密探被处决，关系 -10
    if (spyGen) {
      spyGen.faction = null;
      spyGen.inArmy = null;
      spyGen.location = null;
    }
    const rel = game.diplomacy.getRelation(spy.faction, spy.targetFaction);
    if (rel) rel.relation = Math.max(-100, rel.relation - 10);
    game.pushLog(`⚠ 密探 ${spyGen ? spyGen.name : ''} 在 ${city.name} 暴露，被处决！双方关系恶化。`);
    spy.status = 'caught';
    return;
  }

  const success = Math.random() < successChance(game, spy, city);
  spy.status = success ? 'success' : 'failed';
  if (!success) {
    game.pushLog(`${spyGen ? spyGen.name : ''} 于 ${city.name} 的【${missionName(spy.mission)}】未能得手，悄然撤回。`);
    return;
  }

  if (spy.mission === 'intel') {
    grantIntelVision(game, city.id, 3);
    game.pushLog(`✓ 刺探成功！探明 ${city.name}：兵力 ${city.garrison}、城防 ${city.defense}、太守 ${city.mayor || '无'}（视野 3 回合）。`);
  } else if (spy.mission === 'sabotage') {
    const keys = ['agri', 'comm', 'defense'];
    const key = keys[Math.floor(Math.random() * keys.length)];
    const delta = -(5 + Math.floor(Math.random() * 11)); // -5 ~ -15
    city[key] = Math.max(0, city[key] + delta);
    game.pushLog(`✓ 破坏成功！${city.name} ${{ agri: '农业', comm: '商业', defense: '防御' }[key]} ${delta}。`);
  } else if (spy.mission === 'defect') {
    const targetGen = pickDefectTarget(game, city);
    if (!targetGen) { spy.status = 'failed'; return; }
    targetGen.faction = spy.faction;
    targetGen.loyalty = 60;
    const capital = game.cities.get(FACTIONS[spy.faction].capital);
    targetGen.location = capital ? capital.id : null;
    // 带部分城防投诚（带走 20% 驻军）
    const stolen = Math.round(city.garrison * 0.2);
    city.garrison = Math.max(0, city.garrison - stolen);
    game.pushLog(`✓ 策反成功！${targetGen.name} 率所部 ${stolen} 人弃暗投明！`);
  }
}

// ============================================================
// V15.0 新增统一谍报行动 API
// espionageAction(agent, targetFaction, actionType, targetGeneral)
//   agent: 执行谍报的武将（需含 effIntel；若挂有 agent.game 则可实际执行效果）
//   targetFaction: 目标势力 id
//   actionType: gather_info / spread_rumors / damage_irrigation / defector / spy_tech
//   targetGeneral: 目标武将 id（仅 defector 使用）
// 成功率 = 基础(智力/150) - 对方反谍等级 + 双方关系修正
// ============================================================
export function espionageAction(agent, targetFaction, actionType, targetGeneral) {
  if (!agent) return { ok: false, success: false, msg: '无密探武将' };
  const intel = agent.effIntel || agent.intel || 50;
  const game = agent.game || null;   // 调用方需将 game 挂到 agent 上

  // 基础成功率：智力越高越易成功
  let baseChance = intel / 150;
  // 双方关系修正：敌对易渗透，友好难下手
  let relMod = 0;
  if (game && game.diplomacy) {
    try {
      const rel = game.diplomacy.getRelation(agent.faction, targetFaction);
      if (rel) relMod = -rel.relation / 500; // 关系越好越难（-0.2~+0.2）
    } catch (e) {}
  }
  // 对方反谍等级：取目标势力平均太守智力（简化为固定惩罚）
  const counterSpy = 0.05; // 默认反谍惩罚 5%
  let chance = Math.max(0.05, Math.min(0.85, baseChance + relMod - counterSpy));

  // 不同行动的硬上限
  const caps = { gather_info: 0.80, spread_rumors: 0.65,
                 damage_irrigation: 0.60, defector: 0.55, spy_tech: 0.50 };
  chance = Math.min(chance, caps[actionType] || 0.70);

  const success = Math.random() < chance;
  const cost = V15_SPY_COST[actionType] || 1000;
  const actionName = V15_ACTION_NAMES[actionType] || actionType;

  if (!success) {
    return { ok: true, success: false, chance: Math.round(chance * 100),
             msg: `${agent.name} 执行【${actionName}】失败，悄然撤回。`, cost };
  }

  // 成功效果（需 game 引用才能落地修改）
  if (!game) {
    return { ok: true, success: true, chance: Math.round(chance * 100),
             msg: `${agent.name}【${actionName}】成功（无 game 引用，仅计算概率）。`, cost };
  }

  let detail = '';
  try {
    if (actionType === 'gather_info') {
      // 收集情报：获取对方兵力/粮草/城防信息
      const cities = game.getFactionCities(targetFaction) || [];
      const troops = cities.reduce((s, c) => s + (c.garrison || 0), 0);
      const defense = cities.reduce((s, c) => s + (c.defense || 0), 0);
      detail = `探明 ${FACTIONS[targetFaction].name}：驻军 ${troops}，城防 ${defense}。`;
      game.pushLog(`✓ 谍报【收集情报】：${detail}`);
    } else if (actionType === 'spread_rumors') {
      // 散布谣言：降低对方武将忠诚/民心
      const gens = game.getFactionGenerals(targetFaction) || [];
      for (const g of gens) {
        if (g.role === '君主') continue;
        g.loyalty = Math.max(0, g.loyalty - (5 + Math.floor(Math.random() * 10)));
      }
      const cities = game.getFactionCities(targetFaction) || [];
      for (const c of cities) c.morale = Math.max(0, c.morale - 3);
      detail = `散布谣言成功，${FACTIONS[targetFaction].name} 武将忠诚与民心下降。`;
      game.pushLog(`⚠ ${detail}`);
    } else if (actionType === 'damage_irrigation') {
      // 破坏水利：降低对方农业产出
      const cities = game.getFactionCities(targetFaction) || [];
      for (const c of cities) c.agri = Math.max(0, (c.agri || 0) - 8);
      detail = `破坏水利成功，${FACTIONS[targetFaction].name} 各城农业产出下降。`;
      game.pushLog(`⚠ ${detail}`);
    } else if (actionType === 'defector') {
      // 策反武将：秘密接触指定武将
      if (targetGeneral && game.generals) {
        const tg = game.generals.get(targetGeneral);
        if (tg && tg.faction === targetFaction) {
          tg.faction = agent.faction;
          tg.loyalty = 60;
          const cap = game.cities.get(FACTIONS[agent.faction].capital);
          tg.location = cap ? cap.id : null;
          detail = `策反成功！${tg.name} 投奔我方！`;
          game.pushLog(`✓ ${detail}`);
        } else {
          detail = '目标武将不存在或已不在该势力。';
        }
      } else {
        detail = '未指定策反目标武将。';
      }
    } else if (actionType === 'spy_tech') {
      // 刺探科技：获取对方最新科技
      const enemyTechs = game.techs ? game.techs.filter(t =>
        (game._enemyTechs && game._enemyTechs[targetFaction] || []).includes(t)) : [];
      detail = `刺探科技成功，获知 ${FACTIONS[targetFaction].name} 的 ${enemyTechs.length} 项科技。`;
      game.pushLog(`✓ ${detail}`);
    }
  } catch (e) {
    detail = `行动执行异常：${e.message}`;
  }

  return { ok: true, success: true, chance: Math.round(chance * 100),
           msg: `${agent.name}【${actionName}】成功！${detail}`, cost, detail };
}
