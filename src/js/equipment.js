// ============================================================
// equipment.js — 武将装备系统 + 武将羁绊系统
//
// 装备槽位：weapon 武器 / armor 护甲 / mount 坐骑 / treasure 宝物
// 品质：common 普通(白) / fine 精良(绿) / rare 稀有(蓝) /
//       epic 史诗(紫) / legendary 传说(橙)
//
// 数值平衡约定（可复算）：
//  - 单件传说装备属性 +15 相对基础属性 ~85，约 17%；
//    四槽合计加成远低于基础属性的 50% 上限。
//  - stats 中百分比字段（attackMult/cavalryMult/...）为乘算系数，
//    与 skills/tech 同语义，最终经 army.js clampBonus 封顶 +100%。
// ============================================================

// ---------- 品质表 ----------
export const RARITIES = {
  common:    { id: 'common',    name: '普通', color: '#BBBBBB' },
  fine:      { id: 'fine',      name: '精良', color: '#4CAF50' },
  rare:      { id: 'rare',      name: '稀有', color: '#3D7BFF' },
  epic:      { id: 'epic',      name: '史诗', color: '#9C4DFF' },
  legendary: { id: 'legendary', name: '传说', color: '#FF8C00' }
};

export const EQUIP_SLOTS = ['weapon', 'armor', 'mount', 'treasure'];

// ---------- 装备表（30 件，南北朝题材） ----------
// stats 字段语义：
//   force/command/intel/politics  四维属性加成（直接加到武将基础值）
//   attackMult      全军攻击乘算（归入 allUnitMult 袋）
//   defenseMult     防御乘算（守城/防御动作）
//   cavalryMult     骑兵战力乘算
//   troopMax        带兵上限固定值
//   moveSpeed       移动力（行军消耗/距离）
//   retreatChance   撤退成功率
//   loyalty/morale  忠诚/民心固定值
export const EQUIPMENT_ITEMS = {
  // ===== 传说（橙） =====
  fangtian_ji: {
    id: 'fangtian_ji', name: '方天画戟', slot: 'weapon', rarity: 'legendary',
    stats: { force: 15, attackMult: 0.05 },
    description: '神兵天降，武力+15，全军攻击+5%。'
  },
  qinglong_gundao: {
    id: 'qinglong_gundao', name: '青龙偃月刀', slot: 'weapon', rarity: 'legendary',
    stats: { force: 12, cavalryMult: 0.10 },
    description: '武圣遗刃，武力+12，骑兵战力+10%。'
  },
  mingguang_kai: {
    id: 'mingguang_kai', name: '明光铠', slot: 'armor', rarity: 'legendary',
    stats: { defenseMult: 0.15, troopMax: 500 },
    description: '铠如明镜，防御+15%，带兵上限+500。'
  },
  diluma: {
    id: 'diluma', name: '的卢马', slot: 'mount', rarity: 'legendary',
    stats: { moveSpeed: 2, retreatChance: 0.30 },
    description: '跃檀溪之骏，移动+2，撤退成功率+30%。'
  },
  chuanguo_xi: {
    id: 'chuanguo_xi', name: '传国玉玺', slot: 'treasure', rarity: 'legendary',
    stats: { politics: 20, morale: 10 },
    description: '受命于天，政治+20，每城民心+10。'
  },

  // ===== 史诗（紫） =====
  changshuo: {
    id: 'changshuo', name: '长槊', slot: 'weapon', rarity: 'epic',
    stats: { force: 10 },
    description: '马槊透甲，武力+10。'
  },
  huanshou_dao: {
    id: 'huanshou_dao', name: '环首刀', slot: 'weapon', rarity: 'epic',
    stats: { force: 8, attackMult: 0.05 },
    description: '百炼精钢，武力+8，攻击+5%。'
  },
  xipi_kai: {
    id: 'xipi_kai', name: '犀皮铠', slot: 'armor', rarity: 'epic',
    stats: { defenseMult: 0.10 },
    description: '犀革坚甲，防御+10%。'
  },
  tie_futu_jia: {
    id: 'tie_futu_jia', name: '铁浮屠甲', slot: 'armor', rarity: 'epic',
    stats: { defenseMult: 0.12, troopMax: 300 },
    description: '重铠如山，防御+12%，带兵上限+300。'
  },
  hanxue_ma: {
    id: 'hanxue_ma', name: '汗血马', slot: 'mount', rarity: 'epic',
    stats: { moveSpeed: 1, cavalryMult: 0.08 },
    description: '西域良驹，移动+1，骑兵+8%。'
  },
  wuzhui_ma: {
    id: 'wuzhui_ma', name: '乌骓马', slot: 'mount', rarity: 'epic',
    stats: { moveSpeed: 1, force: 5 },
    description: '踏雪乌骓，移动+1，武力+5。'
  },
  sunzi_bingfa: {
    id: 'sunzi_bingfa', name: '孙子兵法', slot: 'treasure', rarity: 'epic',
    stats: { intel: 15 },
    description: '武圣兵典，智力+15。'
  },
  wuzi_bingfa: {
    id: 'wuzi_bingfa', name: '吴子兵法', slot: 'treasure', rarity: 'epic',
    stats: { intel: 12, command: 5 },
    description: '吴子贵胜，智力+12，统帅+5。'
  },

  // ===== 稀有（蓝） =====
  tie_jian: {
    id: 'tie_jian', name: '铁剑', slot: 'weapon', rarity: 'rare',
    stats: { force: 6 },
    description: '精铁利剑，武力+6。'
  },
  gang_dao: {
    id: 'gang_dao', name: '钢刀', slot: 'weapon', rarity: 'rare',
    stats: { force: 5, attackMult: 0.03 },
    description: '百炼钢刀，武力+5，攻击+3%。'
  },
  pi_jia: {
    id: 'pi_jia', name: '皮甲', slot: 'armor', rarity: 'rare',
    stats: { defenseMult: 0.06 },
    description: '牛皮护甲，防御+6%。'
  },
  suizi_jia: {
    id: 'suizi_jia', name: '锁子甲', slot: 'armor', rarity: 'rare',
    stats: { defenseMult: 0.08 },
    description: '环锁相扣，防御+8%。'
  },
  junma: {
    id: 'junma', name: '骏马', slot: 'mount', rarity: 'rare',
    stats: { moveSpeed: 1 },
    description: '北地良马，移动+1。'
  },
  kuaima: {
    id: 'kuaima', name: '快马', slot: 'mount', rarity: 'rare',
    stats: { retreatChance: 0.15 },
    description: '脚程迅捷，撤退成功率+15%。'
  },
  bingshu: {
    id: 'bingshu', name: '兵书', slot: 'treasure', rarity: 'rare',
    stats: { intel: 8 },
    description: '阵图要义，智力+8。'
  },
  yupei: {
    id: 'yupei', name: '玉佩', slot: 'treasure', rarity: 'rare',
    stats: { politics: 6, loyalty: 5 },
    description: '君子温润，政治+6，忠诚+5。'
  },

  // ===== 精良（绿） =====
  mu_qiang: {
    id: 'mu_qiang', name: '木枪', slot: 'weapon', rarity: 'fine',
    stats: { force: 3 },
    description: '白木长枪，武力+3。'
  },
  duan_dao: {
    id: 'duan_dao', name: '短刀', slot: 'weapon', rarity: 'fine',
    stats: { force: 2 },
    description: '随身短刀，武力+2。'
  },
  bu_jia: {
    id: 'bu_jia', name: '布甲', slot: 'armor', rarity: 'fine',
    stats: { defenseMult: 0.03 },
    description: '粗布护甲，防御+3%。'
  },
  qing_jia: {
    id: 'qing_jia', name: '轻甲', slot: 'armor', rarity: 'fine',
    stats: { defenseMult: 0.04 },
    description: '皮甲轻铠，防御+4%。'
  },
  putong_ma: {
    id: 'putong_ma', name: '普通马', slot: 'mount', rarity: 'fine',
    stats: { moveSpeed: 0.5 },
    description: '寻常驿马，移动+0.5。'
  },
  tongqian: {
    id: 'tongqian', name: '铜钱', slot: 'treasure', rarity: 'fine',
    stats: { politics: 2 },
    description: '盘缠不菲，政治+2。'
  },

  // ===== 普通（白） =====
  mu_gun: {
    id: 'mu_gun', name: '木棍', slot: 'weapon', rarity: 'common',
    stats: { force: 1 },
    description: '临时削制，武力+1。'
  },
  buyi: {
    id: 'buyi', name: '布衣', slot: 'armor', rarity: 'common',
    stats: { defenseMult: 0.01 },
    description: '粗麻布衣，防御+1%。'
  },
  lie_ma: {
    id: 'lie_ma', name: '劣马', slot: 'mount', rarity: 'common',
    stats: {},
    description: '驽马一匹，聊胜于无。'
  }
};

export function getItem(itemId) {
  return EQUIPMENT_ITEMS[itemId] || null;
}

// ---------- 工坊打造：按工坊等级解锁品质 ----------
// 工坊 3 级解锁精良、5 级稀有、7 级史诗、9 级传说
// 公式：可用最高品质 = RARITY_TIER[workshopLv]
export const FORGE_RARITY_BY_WORKSHOP = {
  3: 'fine', 5: 'rare', 7: 'epic', 9: 'legendary'
};
const RARITY_ORDER = ['common', 'fine', 'rare', 'epic', 'legendary'];

// 打造费用：基础 100 + 品质阶数 × 200
// common=100 / fine=300 / rare=500 / epic=700 / legendary=900
export function forgeCost(rarity) {
  return 100 + RARITY_ORDER.indexOf(rarity) * 200;
}

// 工坊等级 → 可打造的最高品质
export function maxRarityByWorkshop(workshopLv) {
  let r = 'common';
  for (const [lv, rarity] of Object.entries(FORGE_RARITY_BY_WORKSHOP)) {
    if (workshopLv >= Number(lv)) r = rarity;
  }
  return r;
}

// 按可打造品质区间随机出一件装备 id
// 概率：普通 50% / 精良 30% / 稀有 15% / 史诗 4.5% / 传说 0.5%（随上限截断）
export function rollForgeItem(workshopLv, rng = Math.random) {
  const maxRarity = maxRarityByWorkshop(workshopLv);
  const maxIdx = RARITY_ORDER.indexOf(maxRarity);
  const pool = Object.values(EQUIPMENT_ITEMS).filter(it =>
    RARITY_ORDER.indexOf(it.rarity) <= maxIdx
  );
  if (!pool.length) return null;
  const weights = [0.50, 0.30, 0.15, 0.045, 0.005].slice(0, maxIdx + 1);
  const totalW = weights.reduce((s, w) => s + w, 0);
  let r = rng() * totalW;
  let chosenRarity = RARITY_ORDER[0];
  for (let i = 0; i < weights.length; i++) {
    if (r < weights[i]) { chosenRarity = RARITY_ORDER[i]; break; }
    r -= weights[i];
  }
  const candidates = pool.filter(it => it.rarity === chosenRarity);
  const pick = (candidates.length ? candidates : pool)[Math.floor(rng() * (candidates.length ? candidates.length : pool.length))];
  return pick.id;
}

// ============================================================
// 羁绊系统
// ============================================================
// members 中全部武将 id 同属一方势力 → 羁绊激活
// effect 为战斗/内政效果袋，与 skills/tech 同语义
export const BONDS = [
  { id: 'junchen_tongxin', name: '君臣同心', members: ['chen_baxian', 'hou_zhen'],
    description: '陈霸先+侯瑱：全军攻击+15%。',
    effect: { allUnitMult: 0.15 } },
  { id: 'beiqi_shuangbi', name: '北齐双璧', members: ['gao_huan', 'hu_luguang'],
    description: '高欢+斛律光：骑兵战力+20%。',
    effect: { cavalryMult: 0.20 } },
  { id: 'yobi_chuanqi', name: '玉璧传奇', members: ['yuwen_tai', 'wei_xiaokuan'],
    description: '宇文泰+韦孝宽：守城战力+25%。',
    effect: { garrisonMult: 0.25 } },
  { id: 'xiongdui_juezheng', name: '双雄对决', members: ['gao_huan', 'yuwen_tai'],
    description: '高欢+宇文泰同处一方时：全属性+10%（全兵种+10%）。',
    effect: { allUnitMult: 0.10 } },
  { id: 'nanchao_shuangchen', name: '南朝双陈', members: ['chen_qingzhi', 'chen_baxian'],
    description: '陈庆之+陈霸先：移动速度+20%。',
    effect: { moveMult: 0.20 } },
  { id: 'guanlong_jituan_bond', name: '关陇集团', members: ['dugu_xin', 'yuwen_tai'],
    description: '独孤信+宇文泰：民心每回合+15。',
    effect: { moralePerTurn: 15 } },
  { id: 'zhongli_zhi_zhan', name: '钟离之战组合', members: ['wei_rui', 'cao_jingzong'],
    description: '韦睿+曹景宗：全军攻击+20%。',
    effect: { allUnitMult: 0.20 } },
  { id: 'nanchao_mingjiang', name: '南朝名将', members: ['tan_daoji', 'chen_qingzhi'],
    description: '檀道济+陈庆之：奇袭概率+30%。',
    effect: { ambushBonus: 0.30 } },
  { id: 'beiqi_mingjiang', name: '北齐名将', members: ['hu_luguang', 'gao_changgong'],
    description: '斛律光+高长恭：骑兵+25%。',
    effect: { cavalryMult: 0.25 } },
  { id: 'bazhuguo', name: '八柱国', members: ['li_hu', 'dugu_xin'],
    description: '李虎+独孤信：步兵+15%。',
    effect: { infantryMult: 0.15 } },
  // ---- V6.5 新增羁绊 ----
  { id: 'chen_chu_kaijiang', name: '陈朝开疆', members: ['chen_baxian', 'zhou_wenyu', 'du_sengming'],
    description: '陈霸先+周文育+杜僧明：全军攻击+12%。',
    effect: { allUnitMult: 0.12 } },
  { id: 'hu_lu_shuangxiong', name: '斛律双雄', members: ['hu_luguang', 'hu_luxian'],
    description: '斛律光+斛律羡：骑兵+20%。',
    effect: { cavalryMult: 0.20 } },
  { id: 'bazhuguo_plus', name: '柱国群英', members: ['li_hu', 'dugu_xin', 'li_bi', 'yuwen_tai'],
    description: '关陇柱国集团：步兵+15%，民心每回合+8。',
    effect: { infantryMult: 0.15, moralePerTurn: 8 } },
  { id: 'weishi_shuangbi', name: '韦氏双璧', members: ['wei_xiaokuan', 'wei_xuan'],
    description: '韦孝宽+韦夐：智力+10，文化产出+20%。',
    effect: { culturePerTurnMult: 0.20 } },
  { id: 'beizhou_shujiang', name: '北周蜀将', members: ['yu_chijiong', 'yuwen_tai'],
    description: '尉迟迥+宇文泰：攻城+15%。',
    effect: { siegeMult: 0.15 } }
];

// 检测一组武将 id 中激活的羁绊
// generalIds: Set/Array 武将 id
// 返回 { activated: [bond...], bag: {聚合效果} }
export function checkBonds(generalIds) {
  const set = new Set(generalIds);
  const activated = [];
  const bag = {};
  for (const bond of BONDS) {
    if (bond.members.every(m => set.has(m))) {
      activated.push(bond);
      for (const [k, v] of Object.entries(bond.effect)) {
        bag[k] = (bag[k] || 0) + v;
      }
    }
  }
  return { activated, bag };
}
