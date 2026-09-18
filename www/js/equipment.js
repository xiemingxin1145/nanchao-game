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
  },

  // ============================================================
  // V14.0「霸业宏图」新增装备（v14_ 前缀）
  // 覆盖四槽位 × 五品质，新增暴击率/闪避率/速度等属性
  // ============================================================

  // ===== 传说（橙）=====
  v14_zhuge_lian: {
    id: 'v14_zhuge_lian', name: '诸葛连弩', slot: 'weapon', rarity: 'legendary',
    stats: { force: 10, archerMult: 0.20, critRate: 0.10 },
    description: '连发弩机，武力+10，弓兵+20%，暴击率+10%。'
  },
  v14_heihu_kai: {
    id: 'v14_heihu_kai', name: '黑犀铠', slot: 'armor', rarity: 'legendary',
    stats: { defenseMult: 0.18, dodge: 0.10, troopMax: 400 },
    description: '黑犀重甲，防御+18%，闪避+10%，带兵+400。'
  },
  v14_qianli_ju: {
    id: 'v14_qianli_ju', name: '千里驹', slot: 'mount', rarity: 'legendary',
    stats: { moveSpeed: 3, speed: 15, cavalryMult: 0.12 },
    description: '日行千里，移动+3，速度+15，骑兵+12%。'
  },
  v14_taisheng_bingfa: {
    id: 'v14_taisheng_bingfa', name: '太公兵法', slot: 'treasure', rarity: 'legendary',
    stats: { intel: 18, command: 10, politics: 8 },
    description: '六韬三略，智力+18，统帅+10，政治+8。'
  },

  // ===== 史诗（紫）=====
  v14_bawang_qiang: {
    id: 'v14_bawang_qiang', name: '霸王枪', slot: 'weapon', rarity: 'epic',
    stats: { force: 12, critRate: 0.08 },
    description: '霸王遗枪，武力+12，暴击率+8%。'
  },
  v14_qilin_jia: {
    id: 'v14_qilin_jia', name: '麒麟铠', slot: 'armor', rarity: 'epic',
    stats: { defenseMult: 0.14, force: 5 },
    description: '麟片如鳞，防御+14%，武力+5。'
  },
  v14_yeyan_ma: {
    id: 'v14_yeyan_ma', name: '夜燕马', slot: 'mount', rarity: 'epic',
    stats: { moveSpeed: 2, dodge: 0.08 },
    description: '夜行如燕，移动+2，闪避+8%。'
  },
  v14_sima_fa: {
    id: 'v14_sima_fa', name: '司马法', slot: 'treasure', rarity: 'epic',
    stats: { command: 12, intel: 8 },
    description: '古司马兵法，统帅+12，智力+8。'
  },
  v14_ju_que: {
    id: 'v14_ju_que', name: '巨阙剑', slot: 'weapon', rarity: 'epic',
    stats: { force: 9, attackMult: 0.08 },
    description: '巨阙断金，武力+9，攻击+8%。'
  },

  // ===== 稀有（蓝）=====
  v14_qingfeng_jian: {
    id: 'v14_qingfeng_jian', name: '青锋剑', slot: 'weapon', rarity: 'rare',
    stats: { force: 7, critRate: 0.05 },
    description: '青锋如电，武力+7，暴击率+5%。'
  },
  v14_lianye_jia: {
    id: 'v14_lianye_jia', name: '炼铁甲', slot: 'armor', rarity: 'rare',
    stats: { defenseMult: 0.09, troopMax: 200 },
    description: '百炼精铁，防御+9%，带兵+200。'
  },
  v14_feihuang_ma: {
    id: 'v14_feihuang_ma', name: '飞黄马', slot: 'mount', rarity: 'rare',
    stats: { moveSpeed: 1, speed: 8 },
    description: '飞黄腾踏，移动+1，速度+8。'
  },
  v14_zhanguo_ce: {
    id: 'v14_zhanguo_ce', name: '战国策', slot: 'treasure', rarity: 'rare',
    stats: { politics: 10, intel: 5 },
    description: '纵横捭阖，政治+10，智力+5。'
  },
  v14_dunjia: {
    id: 'v14_dunjia', name: '铁甲盾', slot: 'armor', rarity: 'rare',
    stats: { defenseMult: 0.07, dodge: 0.05 },
    description: '坚盾护身，防御+7%，闪避+5%。'
  },
  v14_gongnu: {
    id: 'v14_gongnu', name: '神臂弓', slot: 'weapon', rarity: 'rare',
    stats: { archerMult: 0.12, force: 4 },
    description: '神臂弓劲，弓兵+12%，武力+4。'
  },

  // ===== 精良（绿）=====
  v14_tiegun: {
    id: 'v14_tiegun', name: '铁辊', slot: 'weapon', rarity: 'fine',
    stats: { force: 4 },
    description: '沉重铁辊，武力+4。'
  },
  v14_pijia_v: {
    id: 'v14_pijia_v', name: '精制皮甲', slot: 'armor', rarity: 'fine',
    stats: { defenseMult: 0.05 },
    description: '鞣制精良，防御+5%。'
  },
  v14_zouma: {
    id: 'v14_zouma', name: '走骡', slot: 'mount', rarity: 'fine',
    stats: { moveSpeed: 0.5, speed: 4 },
    description: '稳健走骡，移动+0.5，速度+4。'
  },
  v14_mulan: {
    id: 'v14_mulan', name: '木兰卷', slot: 'treasure', rarity: 'fine',
    stats: { intel: 4, politics: 3 },
    description: '木兰辞卷，智力+4，政治+3。'
  },
  v14_yaodao: {
    id: 'v14_yaodao', name: '腰刀', slot: 'weapon', rarity: 'fine',
    stats: { force: 3, critRate: 0.03 },
    description: '随身腰刀，武力+3，暴击率+3%。'
  },

  // ===== 普通（白）=====
  v14_mudun: {
    id: 'v14_mudun', name: '木盾', slot: 'armor', rarity: 'common',
    stats: { defenseMult: 0.02 },
    description: '简陋木盾，防御+2%。'
  },
  v14_tieji: {
    id: 'v14_tieji', name: '铁蒺藜', slot: 'weapon', rarity: 'common',
    stats: { force: 1 },
    description: '铁制蒺藜，武力+1。'
  },
  v14_buma: {
    id: 'v14_buma', name: '挽马', slot: 'mount', rarity: 'common',
    stats: { speed: 2 },
    description: '寻常挽马，速度+2。'
  },
  v14_bijian: {
    id: 'v14_bijian', name: '竹简', slot: 'treasure', rarity: 'common',
    stats: { intel: 2 },
    description: '旧书竹简，智力+2。'
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
    effect: { siegeMult: 0.15 } },
  // ---- V10.0 新增羁绊 ----
  { id: 'beifu_shuangbi', name: '北府双璧', members: ['xie_an', 'xie_xuan'],
    description: '谢安+谢玄：东晋北府兵，弓兵+25%，民心每回合+10。',
    effect: { archerMult: 0.25, moralePerTurn: 10 } },
  { id: 'beifa_tongliao', name: '北伐同袍', members: ['liu_yu', 'wang_zhen_e'],
    description: '刘裕+王镇恶：全军攻击+20%，移动+15%。',
    effect: { allUnitMult: 0.20, moveMult: 0.15 } },
  { id: 'qianqin_xiongzhu', name: '前秦雄主', members: ['fu_jian', 'yang_jian'],
    description: '苻坚+杨坚：一统北方之主，全兵种+10%。',
    effect: { allUnitMult: 0.10 } },
  // ---- V11.0 新增羁绊 ----
  { id: 'beizhou_nanjiang', name: '魏齐南征', members: ['murong_baiyao', 'yuan_ying'],
    description: '慕容白曜+元英：北魏南征双将，攻城+20%。',
    effect: { siegeMult: 0.20 } },
  { id: 'beidi_shuangbi', name: '北地双璧', members: ['murong_baiyao', 'xing_luan'],
    description: '慕容白曜+邢峦：北魏中期文武双璧，智力+15%。',
    effect: { intelMult: 0.15 } },
  { id: 'jiangbei_jiangling', name: '江淮将略', members: ['chen_bozhi', 'xue_andu'],
    description: '陈伯之+薛安都：江淮反复之将，骑兵+15%。',
    effect: { cavalryMult: 0.15 } },
  // ---- V12.0 新增羁绊 ----
  { id: 'zhoushi_shuangbi', name: '周室双璧', members: ['yuwen_xian', 'yuwen_yong'],
    description: '宇文宪+宇文邕：北周宗室双璧，灭齐一统北方，骑兵+20%。',
    effect: { cavalryMult: 0.20 } },
  { id: 'chen_chao_shuijun', name: '陈朝水军', members: ['cheng_lingxi', 'zhou_wenyu'],
    description: '程灵洗+周文育：陈朝水步双将，弓兵+15%。',
    effect: { archerMult: 0.15 } },
  { id: 'liusong_sujiang', name: '刘宋宿将', members: ['shen_qingzhi', 'tan_daoji'],
    description: '沈庆之+檀道济：刘宋北伐双宿将，全军+15%。',
    effect: { allUnitMult: 0.15 } },
  { id: 'liangchu_rujiang', name: '梁初儒将', members: ['feng_daogen', 'wei_rui'],
    description: '冯道根+韦睿：梁初儒将双星，守城+20%。',
    effect: { garrisonMult: 0.20 } },
  { id: 'nanqi_chuangye', name: '南齐创业', members: ['xiao_daocheng', 'shen_qingzhi'],
    description: '萧道成+沈庆之：南齐开国君臣，步兵+15%。',
    effect: { infantryMult: 0.15 } },
  // ---- V13.0 新增羁绊 ----
  { id: 'nanqi_jiangbei', name: '南齐江淮', members: ['pei_shuye', 'chen_xianda'],
    description: '裴叔业+陈显达：南齐江淮双将，弓兵+15%。',
    effect: { archerMult: 0.15 } },
  { id: 'shouchun_shoushu', name: '寿春防守', members: ['yuan_chongzu', 'pei_shuye'],
    description: '垣崇祖+裴叔业：南齐守寿春双将，守城+20%。',
    effect: { garrisonMult: 0.20 } },
  { id: 'dongwei_yuzhou', name: '东魏豫州', members: ['yao_xiong', 'murong_baiyao'],
    description: '尧雄+慕容白曜：东魏河南双镇将，攻城+15%。',
    effect: { siegeMult: 0.15 } },
  { id: 'xizhou_shoujiang', name: '西魏守将', members: ['wang_pi', 'wei_xiaokuan'],
    description: '王罴+韦孝宽：西魏守城双璧，守城+25%。',
    effect: { garrisonMult: 0.25 } }
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

// ============================================================
// V14.0「霸业宏图」：装备系统增强 API
// ============================================================

/** 返回装备槽位定义列表 */
export function getEquipmentSlots() {
  return EQUIP_SLOTS.map(slot => ({
    id: slot,
    name: { weapon: '武器', armor: '护甲', mount: '坐骑', treasure: '宝物' }[slot] || slot
  }));
}

/** 获取某武将某槽位已装备的物品对象（null = 空） */
export function getEquipped(general, slot) {
  if (!general || !general.equipment) return null;
  const itemId = general.equipment[slot];
  if (!itemId) return null;
  return getItem(itemId);
}

/** 装备物品到武将身上（自动卸下该槽位原装备）。返回 { ok, msg } */
export function equipItem(general, itemId) {
  const item = getItem(itemId);
  if (!item) return { ok: false, msg: '装备不存在' };
  if (!general.equipment) general.equipment = { weapon: null, armor: null, mount: null, treasure: null };
  // 同槽位已有则先卸下
  const prev = general.equipment[item.slot];
  general.equipment[item.slot] = itemId;
  return { ok: true, msg: `${general.name} 装备【${item.name}】`, previous: prev };
}

/** 卸下某槽位装备。返回 { ok, msg, itemId } */
export function unequipItem(general, slot) {
  if (!general || !general.equipment || !general.equipment[slot]) {
    return { ok: false, msg: '该槽位无装备' };
  }
  const itemId = general.equipment[slot];
  general.equipment[slot] = null;
  return { ok: true, msg: '已卸下', itemId };
}

/** 获取物品品质等级对象 { id, name, color } */
export function getItemQuality(itemId) {
  const item = getItem(itemId);
  if (!item) return null;
  return RARITIES[item.rarity] || null;
}

/** 获取物品属性加成袋 */
export function getItemStats(itemId) {
  const item = getItem(itemId);
  return item ? { ...(item.stats || {}) } : null;
}
