// ============================================================
// espionage.js — V2.5 谍报系统
// ============================================================
// 密探任务（见 GDD §三）：
//  intel     刺探情报：获取目标城详情，成功率 = min(80%, 智力/120)；
//            成功后授予该城 3 回合临时视野。
//  sabotage  破坏农业/商业/防御（随机 -5~-15），成功率 = min(70%, 智力/150)。
//  defect    策反低忠诚武将：成功率随 (60-忠诚) 与智力提升，硬上限 60%；
//            成功则该武将带部分城防投诚。
// 费用：intel 500 / sabotage 1200 / defect 2000；执行 1 回合。
// 被发现率 = 城防/200 + 太守智力/200（上限 80%）；
// 被发现：密探（所派武将）被处决，双方关系 -10。
// ============================================================
import { SPY_COST, SPY_TURNS, SPY_SUCCESS_CAP, FACTIONS } from './data.js';
import { grantIntelVision } from './fog.js';

let spyCounter = 0;

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
  return { intel: '刺探情报', sabotage: '破坏', defect: '策反' }[m] || m;
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
