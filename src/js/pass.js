// ============================================================
// pass.js — V2.5 关隘要塞
// ============================================================
// 关隘运行时状态：game.passes = { passId: { built, owner, garrison, pending } }
//  - built=false：未建造，不阻塞行军。
//  - built=true：阻塞 cityA<->cityB 段行军；敌军须先攻关隘。
//  - 攻方攻关隘：战力 ×(1 - PASS_ATTACKER_PENALTY)。
//  - 关隘守军 = defense × PASS_GARRISON_PER_DEFENSE。
//  - 攻破后关隘归属攻方（守将可选择摧毁，此处由 game 层处理）。
// ============================================================
import {
  PASSES, getPassById, CITY_LINKS,
  PASS_BUILD_COST_MONEY, PASS_BUILD_COST_FOOD, PASS_BUILD_TURNS,
  PASS_ATTACKER_PENALTY, PASS_GARRISON_PER_DEFENSE, FACTIONS
} from './data.js';
import { computeBattle } from './army.js';

// 初始化运行时关隘表
export function initPasses() {
  const passes = {};
  for (const p of PASSES) {
    passes[p.id] = { id: p.id, built: false, owner: null, garrison: 0, pending: 0 };
  }
  return passes;
}

// 找到阻塞 cityA<->cityB 通道的「已建成」关隘（无则返回 null）
export function getBlockingPass(cityA, cityB, passes) {
  for (const p of PASSES) {
    const rt = passes[p.id];
    if (!rt || !rt.built) continue;
    const match = (p.cityA === cityA && p.cityB === cityB) ||
                  (p.cityA === cityB && p.cityB === cityA);
    if (match) return { static: p, runtime: rt };
  }
  return null;
}

// 某条链路上是否有关隘（无论建成与否，供 UI 提示可建造）
export function getPassOnLink(cityA, cityB) {
  return PASSES.find(p =>
    (p.cityA === cityA && p.cityB === cityB) ||
    (p.cityA === cityB && p.cityB === cityA)
  ) || null;
}

// 玩家/AI 在 locationCity 发起建造关隘。
// 返回 { ok, msg, passId }
export function requestBuildPass(game, factionId, cityId, passNameOrId) {
  const res = game.factionRes.get(factionId);
  if (!res) return { ok: false, msg: '资源不存在' };
  const city = game.cities.get(cityId);
  if (!city || city.owner !== factionId) return { ok: false, msg: '须在己方城市建造' };
  // 按名字或 id 匹配未建成关隘
  const target = PASSES.find(p =>
    p.locationCity === cityId &&
    (p.id === passNameOrId || p.name === passNameOrId) &&
    // BUG修复（pass.js）：模组新增关隘时，game.passes 运行时表可能尚未为该 id
    //   初始化条目（旧存档/热重载模组后）。直接取 game.passes[p.id].built 会抛
    //   TypeError。此处做空值兜底：条目缺失视为「未建成」。
    !(game.passes[p.id] && game.passes[p.id].built)
  );
  if (!target) return { ok: false, msg: '此处无可建造的关隘（或已建成）' };
  if (res.money < PASS_BUILD_COST_MONEY || res.food < PASS_BUILD_COST_FOOD) {
    return { ok: false, msg: `建造关隘需 ${PASS_BUILD_COST_MONEY} 金 / ${PASS_BUILD_COST_FOOD} 粮` };
  }
  res.money -= PASS_BUILD_COST_MONEY;
  res.food -= PASS_BUILD_COST_FOOD;
  game.passes[target.id].pending = PASS_BUILD_TURNS;
  game.pushLog(`${FACTIONS[factionId].name} 开始修建【${target.name}】（${PASS_BUILD_TURNS} 回合）`);
  return { ok: true, msg: `开始修建${target.name}`, passId: target.id };
}

// 回合推进：建造中的关隘完工并配置守军
export function settlePasses(game) {
  for (const pid of Object.keys(game.passes)) {
    const rt = game.passes[pid];
    if (rt.built || !rt.pending) continue;
    rt.pending--;
    if (rt.pending <= 0) {
      const staticPass = getPassById(pid);
      rt.built = true;
      rt.owner = game.cities.get(staticPass.locationCity)?.owner;
      rt.garrison = staticPass.defense * PASS_GARRISON_PER_DEFENSE;
      game.pushLog(`【${staticPass.name}】修建完成，驻军 ${rt.garrison}！`);
    }
  }
}

// 攻关隘：army 攻击 built 的 blocking pass。
// 攻方战力 ×(1-PASS_ATTACKER_PENALTY)。结算后：
//  - 胜：关隘易主（owner=攻方，garrison 重置为残军）或可摧毁。
//  - 败：攻方折兵撤退。
export function attackPass(game, army, blocking) {
  const { static: sp, runtime: rt } = blocking;
  const attackerGen = game.generals.get(army.generalId);
  const defenderGen = game.findDefenderGeneral(sp.locationCity);
  const attackerData = {
    troops: army.troops,
    unitType: army.getMainUnit(),
    unitCoeff: army.getAvgUnitCoeff(),
    bags: [game.getTechBag(army.faction), { allUnitMult: -PASS_ATTACKER_PENALTY }],
    general: attackerGen ? {
      command: attackerGen.effCommand, force: attackerGen.effForce,
      intel: attackerGen.effIntel, name: attackerGen.name
    } : { command: 50, force: 50, intel: 50 },
    cityDefense: 0
  };
  const defenderData = {
    troops: rt.garrison,
    unitType: 'infantry',
    unitCoeff: 1.0,
    bags: [game.getTechBag(rt.owner)],
    general: defenderGen ? {
      command: defenderGen.effCommand, force: defenderGen.effForce,
      intel: defenderGen.effIntel, name: defenderGen.name
    } : { command: 50, force: 50, intel: 50 },
    // 关隘防御加成：防御值折算进城防加成
    cityDefense: sp.defense
  };
  const result = computeBattle(attackerData, defenderData, sp.terrain, sp.terrain);
  result.attackerName = attackerGen ? attackerGen.name : '我军';
  result.defenderName = sp.name + '守军';

  army.troops = Math.max(0, army.troops - result.attackerLoss);
  rt.garrison = Math.max(0, rt.garrison - result.defenderLoss);

  if (result.attackerWin && !result.draw) {
    rt.owner = army.faction;
    // 败军退回关隘残兵
    rt.garrison = Math.round(rt.garrison * 0.3);
    game.pushLog(`${result.attackerName} 攻破【${sp.name}】！关隘易主。`);
  } else {
    game.pushLog(`${result.attackerName} 攻关【${sp.name}】不克，折兵撤退。`);
  }
  if (army.troops <= 0) {
    army.destroyed = true;
    if (attackerGen) { attackerGen.inArmy = null; attackerGen.location = army.cityId; }
  }
  return result;
}

// 摧毁关隘（占领后主动拆毁）
export function destroyPass(game, passId, factionId) {
  const rt = game.passes[passId];
  const sp = getPassById(passId);
  if (!rt || !rt.built) return { ok: false, msg: '关隘不存在或未建成' };
  if (rt.owner !== factionId) return { ok: false, msg: '非我方关隘' };
  rt.built = false; rt.owner = null; rt.garrison = 0;
  game.pushLog(`${FACTIONS[factionId].name} 下令拆毁【${sp.name}】。`);
  return { ok: true, msg: `已拆毁${sp.name}` };
}
