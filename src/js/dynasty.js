// ============================================================
// dynasty.js — V7.0 王朝 / 正统 / 年号 / 禅让系统
// ------------------------------------------------------------
// 历史背景（据《南史》《隋书·百官志》《魏书·官氏志》）：
//  · 南北朝禅让次第：晋→宋(420刘裕)→齐(479萧道成)→梁(502萧衍)→陈(557陈霸先)；
//    北朝：北魏分裂为东魏/西魏，高洋代东魏建齐(550)，宇文觉代西魏建周(557)，
//    杨坚代周建隋(581)。禅让流程为「前朝下诏禅位→遣使奉策→受禅者即位于太极前殿
//    →大赦改元」。
//  · 年号为皇帝纪年之名，如天保(北齐文宣)、武成(北周)、太建(陈宣帝)、
//    天监(梁武帝)、永明(齐武帝)。新君即位必「改元」。
//  · 正统观：占据洛阳/长安/建康等故都即「膺天命」；受前朝禅让则「继正统」；
//    一统天下正统满盈。正统高则民心附、外交重、易招募。
// 设计：每个激活势力一份王朝记录；玩家势力在顶栏显示年号与正统。
// ============================================================
import { FACTIONS } from './data.js';

// ---------- 历史王朝定义 ----------
// color / colorLight 用于禅让后更换势力旗色；flagEmoji 用于旗帜/事件插画
export const DYNASTIES = {
  song:   { id: 'song',   name: '宋', color: '#3a6ea5', colorLight: '#5A8EC5', flag: '🟦', desc: '刘裕代晋所建，典午受命，江左定鼎。' },
  qi:     { id: 'qi',     name: '齐', color: '#8B5A2B', colorLight: '#AB7A4B', flag: '🟫', desc: '萧道成受宋禅，立国建康，是为南齐。' },
  liang:  { id: 'liang',  name: '梁', color: '#2E7D5B', colorLight: '#4E9D7B', flag: '🟩', desc: '萧衍受齐禅，四十余年文物最盛。' },
  chen:   { id: 'chen',   name: '陈', color: '#1B7A5A', colorLight: '#2E9E7A', flag: '🟢', desc: '陈霸先起自寒微，受梁禅以存江左。' },
  beiwei: { id: 'beiwei', name: '北魏', color: '#6B4C7A', colorLight: '#8B6C9A', flag: '🟪', desc: '拓跋氏北都平城，孝文汉化迁洛。' },
  dongwei:{ id: 'dongwei',name: '东魏', color: '#A0522D', colorLight: '#C07840', flag: '🟧', desc: '高氏挟魏帝居邺，元氏虚位。' },
  xiwei:  { id: 'xiwei',  name: '西魏', color: '#2C3E6B', colorLight: '#4A6090', flag: '🟦', desc: '宇文氏奉魏帝都长安，关陇立业。' },
  beiqi:  { id: 'beiqi',  name: '北齐', color: '#B5462B', colorLight: '#D5664B', flag: '🟥', desc: '高洋代东魏，据河北，铁骑横行。' },
  beizhou:{ id: 'beizhou',name: '北周', color: '#34547A', colorLight: '#54749A', flag: '🟦', desc: '宇文觉代西魏，府兵耕战，势压山东。' },
  sui:    { id: 'sui',    name: '隋', color: '#7A2E3B', colorLight: '#9A4E5B', flag: '🔴', desc: '杨坚受周禅，南下灭陈，再一统。' }
};

// ---------- 古都（占之增正统） ----------
// 历史地理：洛阳（汉魏故城，中原正统所在）、长安（周秦汉旧都）、
// 建康（六朝金陵）、邺城（东魏北齐霸府）。
export { }; // placeholder
export const ANCIENT_CAPITALS = ['luoyang', 'changan', 'jiankang', 'yecheng'];
export const LEGIT_PER_CAPITAL = 18;     // 每占一古都 +18 正统
export const LEGIT_ABDICATE_BONUS = 25;  // 禅让得前朝正统 +25（可叠加累计）
export const LEGIT_UNIFY_BONUS = 100;    // 一统天下直接拉满
export const ABDICATE_MIN_LEGIT = 80;    // 禅让所需正统
export const ABDICATE_MIN_CITIES = 20;   // 禅让所需城市数
export const ABDICATE_MIN_POLITICS = 80;  // 君主所需政治

// ---------- 年号池（南北朝真实年号） ----------
// 新君即位/改元时从中按势力取向选取；避免重复。
export const ERA_NAMES = [
  '天保', '武成', '太建', '天嘉', '天康', '光大', '至德', '祯明',        // 南朝陈
  '天监', '普通', '大通', '中大通', '大同', '中大同', '太清', '天正', '承圣', '绍泰', '太平', // 梁
  '永明', '建元', '隆昌', '延兴', '建武', '中兴',                        // 南齐
  '永初', '景平', '元嘉', '孝建', '大明', '泰始', '元徽', '升明',        // 宋
  '太和', '延昌', '熙平', '神龟', '正光', '永安', '太昌', '永熙',        // 北魏
  '天平', '元象', '兴和', '武定',                                        // 东魏
  '大统', '魏废帝', '魏恭帝',                                            // 西魏
  '天保', '乾明', '皇建', '太宁', '河清', '天统', '武平', '隆化',        // 北齐（与南朝部分重名，去重时跳过）
  '周武成', '保定', '天和', '建德', '宣政', '大成', '大象', '大定',       // 北周
  '开皇', '仁寿', '大业'                                                 // 隋
];

// 庙号/谥号素材（君主驾崩/受禅后追尊用）
export const TEMPLE_NAMES = ['太祖', '高祖', '世祖', '世宗', '中宗', '显祖', '肃宗'];
export const POSTHUMOUS_NAMES = ['武皇帝', '文皇帝', '明皇帝', '宣皇帝', '景皇帝', '元皇帝'];

let eraCounter = 0;

export class DynastySystem {
  constructor() {
    // factions: { [fid]: {
    //   dynastyId, eraName, eraYear, emperorId, heirId,
    //   legitimacy, abdicated, capitalSwitched, usedEras:Set(serialized as array)
    // } }
    this.factions = {};
  }

  // 为激活势力初始化王朝记录。
  // 初始王朝依据势力 id 映射（与 FACTIONS 命名对齐）。
  init(activeFactions, generalsMap) {
    const startMap = {
      nanchao: 'chen', dongwei: 'beiqi', xiwei: 'beizhou',
      hou_liang: 'liang', wang_lin: 'liang', xiao_zhuang: 'liang'
    };
    for (const fid of activeFactions) {
      const dynastyId = startMap[fid] || 'liang';
      // 君主 = 该势力 role==='君主' 的武将
      const emperor = (generalsMap ? [...generalsMap.values()] : [])
        .find(g => g.faction === fid && g.role === '君主');
      const rec = {
        dynastyId,
        eraName: this._pickEra(dynastyId, []),
        eraYear: 1,
        emperorId: emperor ? emperor.id : null,
        heirId: null,
        legitimacy: 30,           // 开局基础正统
        abdicateBonus: 0,         // 累计禅让加成
        abdicated: false,
        usedEras: []
      };
      rec.usedEras.push(rec.eraName);
      this.factions[fid] = rec;
      this._pickHeir(fid, generalsMap);
    }
  }

  _pickEra(dynastyId, used) {
    const pool = [...new Set(ERA_NAMES.filter(e => !used.includes(e)))];
    if (!pool.length) return '改元';
    // 简单轮询选取，保证不重复
    const name = pool[eraCounter++ % pool.length];
    return name;
  }

  // 选定继承人（太子）：非君主武将中政治最高者
  _pickHeir(fid, generalsMap) {
    const rec = this.factions[fid];
    if (!rec) return;
    const cands = (generalsMap ? [...generalsMap.values()] : [])
      .filter(g => g.faction === fid && g.id !== rec.emperorId && !g.onHostage && !g.onMission)
      .sort((a, b) => b.politics - a.politics);
    rec.heirId = cands[0] ? cands[0].id : null;
  }

  get(fid) { return this.factions[fid] || null; }

  // 当前势力展示用：王朝名 + 年号
  getDynastyName(fid) {
    const rec = this.factions[fid];
    if (!rec) return (FACTIONS[fid] && FACTIONS[fid].name) || '';
    const d = DYNASTIES[rec.dynastyId];
    return d ? d.name : (FACTIONS[fid] && FACTIONS[fid].name);
  }
  getEraLabel(fid) {
    const rec = this.factions[fid];
    return rec ? `${rec.eraName} ${rec.eraYear}年` : '';
  }

  // ---------- 正统计算 ----------
  // 正统 = 古都数×18 + 禅让累计加成，封顶100；若一统则直接100。
  calcLegitimacy(game, fid) {
    const rec = this.factions[fid];
    if (!rec) return 0;
    let leg = 30 + rec.abdicateBonus;
    // 古都加成
    const cities = game.getFactionCities(fid);
    const cityIds = new Set(cities.map(c => c.id));
    for (const cap of ANCIENT_CAPITALS) if (cityIds.has(cap)) leg += LEGIT_PER_CAPITAL;
    // 君主声望：政治/10 微调
    const emperor = rec.emperorId ? game.getGeneral(rec.emperorId) : null;
    if (emperor) {
      // BUG修复（dynasty.js NaN 污染）：旧存档/模组武将 politics 可能为 undefined 或非数。
      //   原 `(emperor.politics - 60)/8` 遇 undefined 得 NaN → leg=NaN → 经 Math.max/min
      //   钳制后仍为 NaN（Math.min(100, NaN)=NaN）→ rec.legitimacy=NaN，顶栏正统显示空白/NaN，
      //   禅让判定 `leg < ABDICATE_MIN_LEGIT` 恒为 false 而卡死。
      //   修复：缺失/非数时回退到基准 60（与「无君主」分支一致），保证 leg 恒为有限数。
      const pol = Number(emperor.politics);
      leg += Math.round(((Number.isFinite(pol) ? pol : 60) - 60) / 8);
    }
    // 一统判定
    if (cities.length >= (game.cities.size || 35) - 1) leg = 100;
    rec.legitimacy = Math.max(0, Math.min(100, Math.round(leg)));
    return rec.legitimacy;
  }

  // 全局君主 buff：皇帝魅力(由四维均值近似)→民心/收入微调
  getEmperorBag(game, fid) {
    const rec = this.factions[fid];
    if (!rec || !rec.emperorId) return {};
    const emperor = game.getGeneral(rec.emperorId);
    if (!emperor) return {};
    const charm = (emperor.command + emperor.force + emperor.intel + emperor.politics) / 4;
    const bag = {};
    if (charm >= 85) { bag.moraleFlat = 3; bag.incomeMult = 0.05; }
    else if (charm >= 70) { bag.moraleFlat = 1; }
    return bag;
  }

  // ---------- 禅让 ----------
  canAbdicate(game, fid) {
    const rec = this.factions[fid];
    if (!rec) return { ok: false, msg: '无王朝记录' };
    if (rec.abdicated) return { ok: false, msg: '本朝已受禅，不可再受禅' };
    const leg = this.calcLegitimacy(game, fid);
    const cityCount = game.getFactionCities(fid).length;
    const emperor = rec.emperorId ? game.getGeneral(rec.emperorId) : null;
    if (leg < ABDICATE_MIN_LEGIT) return { ok: false, msg: `正统不足（需≥${ABDICATE_MIN_LEGIT}，当前${leg}）` };
    if (cityCount < ABDICATE_MIN_CITIES) return { ok: false, msg: `城邑不足（需≥${ABDICATE_MIN_CITIES}，当前${cityCount}）` };
    if (!emperor || emperor.politics < ABDICATE_MIN_POLITICS) {
      return { ok: false, msg: `君主须具备王佐之才（政治≥${ABDICATE_MIN_POLITICS}）` };
    }
    return { ok: true, msg: '可受禅建号' };
  }

  // 执行禅让：建立新王朝 newDynastyId，更改势力名/色，正统大涨，改元大赦。
  abdicate(game, fid, newDynastyId) {
    const chk = this.canAbdicate(game, fid);
    if (!chk.ok) return chk;
    const rec = this.factions[fid];
    const dyn = DYNASTIES[newDynastyId] || DYNASTIES.sui;
    // BUG修复（dynasty.js #3）：hotseat/模组场景下 FACTIONS[fid] 可能缺失，
    //   直接取 .name 会抛 TypeError。此处做空值兜底。
    const oldName = (FACTIONS[fid] && FACTIONS[fid].name) || rec.dynastyId || '本朝';
    rec.dynastyId = dyn.id;
    rec.abdicated = true;
    rec.abdicateBonus += LEGIT_ABDICATE_BONUS;
    // 改元
    rec.eraName = this._pickEra(dyn.id, rec.usedEras);
    rec.usedEras.push(rec.eraName);
    rec.eraYear = 1;
    // 更改势力旗色（与剧本 override 同模式，直接改 FACTIONS 显示字段）
    if (FACTIONS[fid]) {
      FACTIONS[fid].name = dyn.name;
      FACTIONS[fid].color = dyn.color;
      FACTIONS[fid].colorLight = dyn.colorLight;
    }
    this.calcLegitimacy(game, fid);
    // 大赦：全势力城市民心 +15，武将忠诚 +10
    for (const c of game.getFactionCities(fid)) c.morale = Math.min(100, c.morale + 15);
    for (const g of game.getFactionGenerals(fid)) g.loyalty = Math.min(100, g.loyalty + 10);
    // 历史事件文案
    const emperor = rec.emperorId ? game.getGeneral(rec.emperorId) : null;
    game.pushLog(`👑 【禅让大典】${oldName} 之 ${emperor ? emperor.name : '主公'} 受前朝禅让，即位于郊坛，改国号为「${dyn.name}」，改元「${rec.eraName}」，大赦天下！正统 ${rec.legitimacy}/100，天下归心。`);
    game.pushLog(`   （${dyn.desc}）`);
    return { ok: true, msg: `受禅建号，国号「${dyn.name}」！`, dynasty: dyn, record: rec };
  }

  // 新君即位（君主死亡/更替时）：换年号
  _acclaimNewEmperor(game, fid) {
    const rec = this.factions[fid];
    if (!rec) return;
    const newEmp = rec.heirId ? game.getGeneral(rec.heirId) : null;
    if (!newEmp) return;
    rec.emperorId = newEmp.id;
    if (newEmp.role !== '君主') newEmp.role = '君主';
    rec.eraName = this._pickEra(rec.dynastyId, rec.usedEras);
    rec.usedEras.push(rec.eraName);
    rec.eraYear = 1;
    this._pickHeir(fid, game.generals);
    game.pushLog(`👑 先君晏驾，太子 ${newEmp.name} 即皇帝位，改元「${rec.eraName}」，大赦天下。`);
  }

  // 回合结算：推进年号、检测君主是否在位
  settleTurn(game, fid) {
    const rec = this.factions[fid];
    if (!rec) return;
    rec.eraYear++;
    // 君主死亡检测：君主武将已不在本势力（战死/下野）→ 太子即位
    const emperor = rec.emperorId ? game.getGeneral(rec.emperorId) : null;
    if (!emperor || emperor.faction !== fid) {
      // 尝试寻找本势力新的 role==='君主'
      const newEmp = game.getFactionGenerals(fid).find(g => g.role === '君主');
      if (newEmp) rec.emperorId = newEmp.id;
      else this._acclaimNewEmperor(game, fid);
    }
    this.calcLegitimacy(game, fid);
  }

  serialize() {
    const out = {};
    for (const [fid, rec] of Object.entries(this.factions)) {
      out[fid] = { ...rec };
    }
    return out;
  }
  static deserialize(data) {
    const s = new DynastySystem();
    if (data && typeof data === 'object') {
      for (const [fid, rec] of Object.entries(data)) {
        // BUG修复（dynasty.js #4）：损坏存档/跨版本迁移中某势力的王朝记录 rec
        //   可能为 null 或非对象，直接取 rec.dynastyId 会抛 TypeError。此处做防御：
        //   非法记录跳过，用默认值兜底，不阻塞其余势力的恢复。
        if (!rec || typeof rec !== 'object') continue;
        s.factions[fid] = {
          dynastyId: rec.dynastyId || 'liang',
          eraName: rec.eraName || '承光',
          eraYear: rec.eraYear || 1,
          emperorId: rec.emperorId || null,
          heirId: rec.heirId || null,
          legitimacy: typeof rec.legitimacy === 'number' ? rec.legitimacy : 30,
          abdicateBonus: rec.abdicateBonus || 0,
          abdicated: !!rec.abdicated,
          usedEras: Array.isArray(rec.usedEras) ? rec.usedEras : []
        };
      }
    }
    return s;
  }
}
