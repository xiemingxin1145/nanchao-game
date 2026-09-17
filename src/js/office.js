// ============================================================
// office.js — V7.0 官职 / 爵位系统
// ------------------------------------------------------------
// 历史背景（据《魏书·官氏志》《隋书·百官志》《通典·职官》）：
//  · 中央：三师(太师/太傅/太保)为上公；三公(太尉/司徒/司空)；二大(大司马/大将军)。
//  · 军事：骠骑、车骑、卫将军，四征(征东/南/西/北)、四镇将军；
//    北周创「柱国大将军」「上柱国」「开府仪同三司」(从一品)。
//  · 地方：州置刺史，郡置太守，县置令长。
//  · 爵位：王/公(开国郡公/县公)/侯(县侯)/伯/子/男，六等爵。
// 设计：
//  - OFFICES：中央/武官官职，每职仅一人(unique)，任命后给全局加成。
//  - TITLES：爵位，可多人同爵，给个人忠诚/属性。
//  - 太守由城市 mayor 自动兼任（见 game.cityAssignMayor 处挂接）。
// ============================================================

// ---------- 官职表 ----------
// type: 'central' 中央 / 'military' 武官 / 'regional' 地方
// req: 属性门槛；effect: 全局或个人加成袋；unique: 每职仅一人
export const OFFICES = [
  // ===== 中央三公二大 =====
  { id: 'chengxiang', name: '丞相', type: 'central', rank: 1,
    req: { politics: 85 }, unique: true,
    effect: { politicsFlat: 10, incomeMult: 0.05 },
    desc: '百官之长，掌丞天子。政治+10，全局收入+5%。' },
  { id: 'taiwei', name: '太尉', type: 'central', rank: 1,
    req: { command: 85 }, unique: true,
    effect: { commandFlat: 10, recruitMult: 0.05 },
    desc: '掌全国武事。统帅+10，全局征兵费用-5%。' },
  { id: 'situ', name: '司徒', type: 'central', rank: 2,
    req: { politics: 75 }, unique: true,
    effect: { politicsFlat: 8, moraleFlat: 5 },
    desc: '掌人民水土。政治+8，全势力民心+5。' },
  { id: 'sikong', name: '司空', type: 'central', rank: 2,
    req: { intel: 75 }, unique: true,
    effect: { intelFlat: 8, researchMult: 0.10 },
    desc: '掌水土营建。智力+8，研究速度+10%。' },
  { id: 'dasima', name: '大司马', type: 'military', rank: 1,
    req: { command: 88 }, unique: true,
    effect: { commandFlat: 12, combatMult: 0.02 },
    desc: '掌武兵官。统帅+12，全局战力+2%。' },
  { id: 'dajiangjun', name: '大将军', type: 'military', rank: 1,
    req: { command: 85, force: 80 }, unique: true,
    effect: { commandFlat: 15, combatMult: 0.03 },
    desc: '匹除征讨，一名大将军。统帅+15，全局战力+3%。' },
  // ===== 高级武官（南北朝特色）=====
  { id: 'kaifu', name: '开府仪同三司', type: 'military', rank: 2,
    req: { politics: 70, command: 70 }, unique: true,
    effect: { politicsFlat: 6, loyaltyFlat: 10 },
    desc: '仪同三公，开府置官属。政治+6，忠诚+10。' },
  { id: 'zhuguo', name: '柱国大将军', type: 'military', rank: 1,
    req: { command: 90 }, unique: true,
    effect: { commandFlat: 14, combatMult: 0.02, loyaltyFlat: 8 },
    desc: '北周八柱国之贵。统帅+14，战力+2%，忠诚+8。' },
  { id: 'piaoji', name: '骠骑将军', type: 'military', rank: 2,
    req: { command: 75 }, unique: true,
    effect: { commandFlat: 8, cavalryMult: 0.05 },
    desc: '骑兵主将。统帅+8，骑兵+5%。' },
  { id: 'cheqi', name: '车骑将军', type: 'military', rank: 2,
    req: { command: 73 }, unique: true,
    effect: { commandFlat: 8, infantryMult: 0.05 },
    desc: '车骑主将。统帅+8，步兵+5%。' },
  { id: 'wei_jiangjun', name: '卫将军', type: 'military', rank: 3,
    req: { command: 70 }, unique: true,
    effect: { commandFlat: 7, defenseMult: 0.05 },
    desc: '掌宫掖卫尉。统帅+7，城防+5%。' },
  { id: 'zhengdong', name: '征东将军', type: 'military', rank: 3,
    req: { command: 68 }, unique: true,
    effect: { commandFlat: 6, archerMult: 0.04 },
    desc: '征东方面。统帅+6，弓兵+4%。' },
  { id: 'jishi', name: '祭酒参军', type: 'central', rank: 4,
    req: { intel: 65 }, unique: false,
    effect: { intelFlat: 5, recruitBonus: 0.05 },
    desc: '赞务幕府。智力+5，招募在野将+5%。' },
  // ===== 地方长官 =====
  { id: 'cishi', name: '刺史', type: 'regional', rank: 3,
    req: { politics: 65 }, unique: true,
    effect: { politicsFlat: 6, regionalIncomeMult: 0.10 },
    desc: '一州之牧。政治+6，全势力城市收入+10%。' }
];

// ---------- 爵位表（六等爵） ----------
// level: 6王 > 5公 > 4侯 > 3伯 > 2子 > 1男
// 可多人同爵；封赏加忠诚与全属性。
export const TITLES = [
  { id: 'wang',  name: '王',   level: 6, loyaltyBonus: 20, statBonus: 10, desc: '亲王，位极人臣。' },
  { id: 'gong',  name: '公',   level: 5, loyaltyBonus: 15, statBonus: 8,  desc: '开国郡公。' },
  { id: 'hou',   name: '侯',   level: 4, loyaltyBonus: 12, statBonus: 6,  desc: '县侯。' },
  { id: 'bo',    name: '伯',   level: 3, loyaltyBonus: 8,  statBonus: 4,  desc: '开国伯。' },
  { id: 'zi',    name: '子',   level: 2, loyaltyBonus: 5,  statBonus: 3,  desc: '开国子。' },
  { id: 'nan',   name: '男',   level: 1, loyaltyBonus: 3,  statBonus: 2,  desc: '开国男。' }
];

export function getOffice(id) { return OFFICES.find(o => o.id === id) || null; }
export function getTitle(id) { return TITLES.find(t => t.id === id) || null; }

// 汇总某势力所有在任官职的全局加成袋。
// generalsMap: game.generals (Map). 返回 { incomeMult, recruitMult, combatMult, ... }
export function aggregateOfficeBag(generalsMap, fid) {
  const bag = {};
  for (const g of generalsMap.values()) {
    if (g.faction !== fid || !g.office) continue;
    const off = getOffice(g.office);
    if (!off || !off.effect) continue;
    for (const [k, v] of Object.entries(off.effect)) {
      bag[k] = (bag[k] || 0) + v;
    }
  }
  return bag;
}

// 爵位对个人的加成（加到四维）。
export function getTitleStatBonus(titleId) {
  const t = getTitle(titleId);
  return t ? t.statBonus : 0;
}
export function getTitleLoyaltyBonus(titleId) {
  const t = getTitle(titleId);
  return t ? t.loyaltyBonus : 0;
}

// 校验某武将是否够格任某职。
export function canHoldOffice(general, officeId) {
  const off = getOffice(officeId);
  if (!off) return { ok: false, msg: '官职不存在' };
  const req = off.req || {};
  if (req.command && general.command < req.command) return { ok: false, msg: `统帅需≥${req.command}` };
  if (req.force && general.force < req.force) return { ok: false, msg: `武力需≥${req.force}` };
  if (req.intel && general.intel < req.intel) return { ok: false, msg: `智力需≥${req.intel}` };
  if (req.politics && general.politics < req.politics) return { ok: false, msg: `政治需≥${req.politics}` };
  return { ok: true };
}
