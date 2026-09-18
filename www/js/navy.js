// ============================================================
// navy.js — V6.0 海战/水战系统
//
// 历史背景（搜索整理）：
//   魏晋南北朝水战频繁，战船种类繁多：
//   - 楼船：多层甲板大型战船，外观像楼阁，船体宽大稳定，
//     可容纳数百至千人，置本阵。操作回转性较差。
//   - 蒙冲（艨艟）：船体狭长，航速快，专用突击，
//     船包皮革以防火箭。赤壁之战黄盖即以蒙冲斗舰满载薪膏火攻曹营。
//   - 斗舰：中型战船，船舷建女墙，开弩窗牙孔，攻防兼备，均衡型。
//   水战火攻：赤壁之战是最经典战例——黄盖诈降，
//     蒙冲斗舰数十艘内装薪草灌膏油，借东风冲入曹军舰队。
//
// 技术方案（搜索整理）：
//   Canvas 水战动画使用粒子系统（fire particles）+
//   水波纹高度场模拟（height-map wave equation）。
//   火焰粒子：从火源持续生成，带重力/速度衰减/颜色渐变。
// ============================================================

import { UNIT_TYPES, CITY_LINKS, CITIES } from './data.js';

// ---------- 水军兵种定义（嵌入 UNIT_TYPES） ----------
// 历史：楼船为本阵主力（大而稳），蒙冲为突击先锋（快而脆），斗舰为中坚（均衡）
export const NAVY_UNITS = {
  louchuan: {
    id: 'louchuan', name: '楼船', type: 'navy',
    coeff: 1.3,        // 基础战力系数
    cost: 40,          // 征兵费用/人
    waterBonus: 1.5,   // 水战地形加成 +50%
    landPenalty: 0.3,  // 陆上惩罚 -70%（不习水战反过来：水军上岸极弱）
    hpBonus: 1.3,      // 兵力承载加成（楼船大，容纳多）
    speed: 1,          // 移动速度（1=正常，蒙冲=2）
    desc: '大型楼船，多层甲板，兵力众多，防御坚固，移动迟缓。'
  },
  mengchong: {
    id: 'mengchong', name: '蒙冲', type: 'navy',
    coeff: 1.2,
    cost: 35,
    waterBonus: 1.6,   // 蒙冲突击力强，水战加成更高
    landPenalty: 0.25,
    hpBonus: 0.8,      // 船体小，容纳少
    speed: 2,          // 快速突击
    desc: '狭长快船，蒙以生牛皮，快速突击敌舰，攻击高防御低。'
  },
  douchian: {
    id: 'douchian', name: '斗舰', type: 'navy',
    coeff: 1.15,
    cost: 30,
    waterBonus: 1.4,
    landPenalty: 0.35,
    hpBonus: 1.0,
    speed: 1,
    desc: '中型战船，船舷女墙弩窗，攻防均衡，水战中坚。'
  }
};

// 水军兵种在 UNIT_TYPES 中的注册 key
export const NAVY_UNIT_KEYS = ['louchuan', 'mengchong', 'douchian'];

// ---------- 河流城市标记 ----------
// 历史：长江沿线水军重镇——建康（建康是东吴以来水军中心）、
// 郢城（郢州水军）、江州、吴郡、会稽、广州（岭南港口）、
// 江陵（荆州水军）、湘州等。
// 这些城市 terrain 已有 'river' 或沿海属性，此处补充可建水军的城市列表。
export const RIVER_CITIES = [
  'jiankang',   // 建康 — 长江下游水军核心
  'yingcheng',  // 郢城 — 郢州水军重镇
  'jiangzhou',  // 江州 — 长江中游
  'wujun',      // 吴郡 — 江南港口
  'kuaiji',     // 会稽 — 东海港口
  'guangzhou',  // 广州 — 岭南港口
  'jiangling',  // 江陵 — 荆州水军
  'xiangzhou',  // 湘州 — 湘水流域
  'jiangxia'    // 江夏 — V6.5 新增，长江中游夏口重镇
];

// 可建石窟的特殊城市（平城/洛阳/建康）
export const GROTTO_CITIES = ['pingcheng', 'luoyang', 'jiankang'];

// ---------- 水战连接标记 ----------
// 在 CITY_LINKS 中，河流城市之间的水路连接标记为水战通道。
// 返回两座城市之间是否为水路连接（用于水军移动判定）。
export function isWaterLink(cityIdA, cityIdB) {
  const a = getCityDef(cityIdA);
  const b = getCityDef(cityIdB);
  if (!a || !b) return false;
  // 两城都是河流城市 → 水路
  if (a.terrain === 'river' && b.terrain === 'river') return true;
  // 一河一陆的港口连接（如广州→交州）
  const riverCoastal = ['guangzhou', 'jiaozhou', 'kuaiji', 'wujun'];
  if (riverCoastal.includes(cityIdA) && riverCoastal.includes(cityIdB)) return true;
  return false;
}

function getCityDef(cityId) {
  return CITIES.find(c => c.id === cityId);
}

// ---------- 水战地形判定 ----------
// 判断某场战斗是否为水战：攻方或守方城市在河流上，且连接为水路。
export function isNavalBattle(attackerCityId, defenderCityId) {
  const a = getCityDef(attackerCityId);
  const b = getCityDef(defenderCityId);
  if (!a || !b) return false;
  // 双方都是河流城市 → 水战
  if (a.terrain === 'river' && b.terrain === 'river') return true;
  // 攻城方在河流城市进攻 → 可能是渡江战
  if (a.terrain === 'river' || b.terrain === 'river') {
    return isWaterLink(attackerCityId, defenderCityId);
  }
  return false;
}

// ---------- 水战战力修正 ----------
// 水军在水上：waterBonus × 1.5（+50%）
// 陆军在水上：landPenalty × 0.7（-30%）
// 水军在陆上：landPenalty × 0.3（极弱）
// 陆军在陆上：正常
export function applyWaterTerrainMod(unitType, isWaterTerrain) {
  if (!isWaterTerrain) {
    // 陆地：水军极弱
    if (NAVY_UNIT_KEYS.includes(unitType)) return 0.3;
    return 1.0;
  }
  // 水上
  if (NAVY_UNIT_KEYS.includes(unitType)) {
    const nu = NAVY_UNITS[unitType];
    return nu ? nu.waterBonus : 1.5;
  }
  // 陆军在水上 -30%
  return 0.7;
}

// ---------- 火攻机制（赤壁式） ----------
// 水战时，攻击方智力高的武将有概率发动火攻。
// 火攻成功：防守方战力 -30%，并触发火焰粒子动画。
// 风向：随机风向影响火攻成功率（顺风火攻+20%成功率）。
export function checkFireAttack(attackerIntel, isNaval, windDirection) {
  if (!isNaval) return { success: false, chance: 0 };
  // 基础概率 = 智力/100 × 0.3（智力80 → 24%基础）
  let chance = (attackerIntel / 100) * 0.3;
  // 风向加成：如果风向利于火攻（简化：50%概率顺风）
  const windBoost = (windDirection === 'favorable') ? 0.2 : 0;
  chance = Math.min(0.6, chance + windBoost);
  const success = Math.random() < chance;
  return { success, chance, windDirection };
}

// 火攻战力惩罚
export const FIRE_ATTACK_PENALTY = 0.70; // 防守方战力 ×0.70

// ---------- 水军运输陆军 ----------
// 1支水军可运输1支陆军渡河（跨越河流格子）
// 运输规则：水军在河流城市时，可携带1支友方陆军从河流城市移动到相邻河流城市
export const NAVY_TRANSPORT_CAPACITY = 1; // 1支水军运1支陆军

// ---------- 水军建造 ----------
// 码头(dock)建筑升级到3级可建造水军
// 建造成本：楼船 80金/艘, 蒙冲 60金/艘, 斗舰 50金/艘
export const NAVY_BUILD_REQUIREMENT = 3; // dock 等级要求
export const NAVY_BUILD_COSTS = {
  louchuan: 80,
  mengchong: 60,
  douchien: 50
};

// 检查城市是否可以建造水军
export function canBuildNavy(city) {
  if (!city) return false;
  if (!RIVER_CITIES.includes(city.id)) return false;
  const dockLevel = city.buildings.dock || 0;
  return dockLevel >= NAVY_BUILD_REQUIREMENT;
}

// 获取城市可建造的水军类型列表
export function getAvailableNavyTypes(city) {
  if (!canBuildNavy(city)) return [];
  return NAVY_UNIT_KEYS.map(k => ({ id: k, ...NAVY_UNITS[k] }));
}

// ---------- 水军移动规则 ----------
// 水军只能在河流城市和相邻河流城市之间移动
export function getNavyMoveableCities(army, cities) {
  const cur = army.cityId;
  const links = CITY_LINKS[cur] || [];
  const result = [];
  for (const linkId of links) {
    if (!isWaterLink(cur, linkId)) continue;
    const city = cities.get(linkId);
    if (!city) continue;
    if (city.owner === army.faction || city.owner === null) {
      result.push(linkId);
    }
  }
  return result;
}

// 水军可攻击的城市（相邻水路敌方城市）
export function getNavyAttackableCities(army, cities) {
  const cur = army.cityId;
  const links = CITY_LINKS[cur] || [];
  const result = [];
  for (const linkId of links) {
    if (!isWaterLink(cur, linkId)) continue;
    const city = cities.get(linkId);
    if (!city) continue;
    if (city.owner !== null && city.owner !== army.faction) {
      result.push(linkId);
    }
  }
  return result;
}

// ---------- 水战动画数据 ----------
// 提供给 UI 层的水战场景数据
export function getNavalBattleScene(attackerName, defenderName, fireAttack) {
  return {
    type: 'naval',
    background: 'river',
    attackerShip: fireAttack?.attackerShip || 'louchuan',
    defenderShip: 'douchian',
    fireActive: fireAttack?.success || false,
    windDirection: fireAttack?.windDirection || 'favorable',
    waves: true,
    ships: [
      { name: attackerName, x: 0.2, y: 0.6, type: 'louchuan', side: 'attacker' },
      { name: defenderName, x: 0.8, y: 0.4, type: 'douchian', side: 'defender' }
    ]
  };
}

// ---------- 序列化辅助 ----------
export function serializeNavyState() {
  return {
    navyUnits: NAVY_UNIT_KEYS,
    riverCities: RIVER_CITIES,
    grottoCities: GROTTO_CITIES,
    version: '6.0'
  };
}
