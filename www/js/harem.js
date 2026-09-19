// ============================================================
// harem.js — V8.5 后宫 / 皇室 / 子嗣 / 联姻系统
// ------------------------------------------------------------
// 历史依据（《南史·后妃传》《北史·后妃传》《隋书·后妃传》）：
//  · 晋制三夫人（贵嫔/夫人/贵人）、九嫔、美人才人；
//    北魏孝文改定内官：左右昭仪、三夫人、三嫔、六嫔、世妇、御女。
//  · 南北朝选后极重门第，纳后必冠族；政治联姻（世婚）频繁，
//    皇女出降以结好邻国，如兰陵公主、义兴公主之类。
//  · 立嫡立长，太子承继；皇子年长出阁，皇女下嫁。
// 设计：
//  · 每势力一份后宫记录：consorts[]（妃嫔）、children[]（皇子皇女）、heirId（太子）。
//  · 妃嫔分五等：皇后/贵妃/妃/嫔/美人，位愈尊生育概率愈高、正统民心加成愈厚。
//  · 每回合按「等级概率 + 君主魅力」生育；子嗣属性按君主与母妃均值 + 随机。
//  · 皇子成年可立为太子；皇女成年可联姻他国，联姻后外交关系+20。
// ============================================================
import { FACTIONS, HAREM_RANKS, HAREM_NAME_POOL, HAREM_BIRTH_BASE,
         HAREM_CHARM_BONUS, HAREM_PRINCE_AGE_ADULT, HAREM_MARRY_PRINCESS_MIN_AGE } from './data.js';

let childSeq = 1000;
let consortSeq = 1;

// 性能优化（harem.js）：HAREM_RANKS 按 id 建索引，避免 getHaremBag/settleBirth 等
// 每回合对每位妃嫔都做一次 HAREM_RANKS.find（O(位分数)），整体降为 O(1)/次。
const _RANK_BY_ID = {};
for (const _r of HAREM_RANKS) _RANK_BY_ID[_r.id] = _r;
function _rankById(id) { return _RANK_BY_ID[id] || null; }

export class HaremSystem {
  constructor() {
    this.factions = {};   // { [fid]: { consorts:[], children:[], heirId:null } }
  }

  // 初始化某势力后宫（开局给每位君主一位皇后）
  init(activeFactions, generalsMap) {
    for (const fid of activeFactions) {
      this.factions[fid] = { consorts: [], children: [], heirId: null };
      // 初始立一位皇后（随机名）
      const empress = this._makeConsort('empress', this._pickName());
      this.factions[fid].consorts.push(empress);
    }
  }

  _pickName() {
    const n = HAREM_NAME_POOL[consortSeq % HAREM_NAME_POOL.length];
    consortSeq++;
    return n;
  }

  _makeConsort(rankId, name) {
    const rank = _rankById(rankId) || HAREM_RANKS[HAREM_RANKS.length - 1];
    return {
      id: 'cs_' + (++consortSeq),
      name: name || this._pickName(),
      rank: rankId,
      rankName: rank.name,
      age: 18 + Math.floor(Math.random() * 8)
    };
  }

  get(fid) { return this.factions[fid] || null; }

  // 当前势力妃嫔总数（按位分统计）
  rankCount(fid, rankId) {
    const rec = this.factions[fid];
    if (!rec) return 0;
    return rec.consorts.filter(c => c.rank === rankId).length;
  }

  // 册封新妃嫔（升级现有或新增）
  takeInConsort(fid, rankId) {
    const rec = this.factions[fid];
    if (!rec) return { ok: false, msg: '无后宫记录' };
    const rank = _rankById(rankId);
    if (!rank) return { ok: false, msg: '未知位分' };
    if (this.rankCount(fid, rankId) >= rank.max) {
      return { ok: false, msg: `${rank.name}名额已满（${this.rankCount(fid, rankId)}/${rank.max}）` };
    }
    const c = this._makeConsort(rankId);
    rec.consorts.push(c);
    return { ok: true, msg: `新纳 ${rank.name}【${c.name}】入宫`, consort: c };
  }

  // 后宫加成袋（正统/民心）：由 game 在结算时叠加
  getHaremBag(fid) {
    const rec = this.factions[fid];
    const bag = { legit: 0, morale: 0 };
    if (!rec) return bag;
    for (const c of rec.consorts) {
      const rank = _rankById(c.rank);
      if (!rank) continue;
      bag.legit += rank.legit || 0;
      bag.morale += rank.morale || 0;
    }
    return bag;
  }

  // ---------- 生育 ----------
  // 每回合对每位在后宫的妃嫔掷生育概率；君主四维均值为魅力加成。
  settleBirth(game, fid) {
    const rec = this.factions[fid];
    if (!rec) return;
    const emperorId = game.dynastySystem && game.dynastySystem.get(fid)
      ? game.dynastySystem.get(fid).emperorId : null;
    const emperor = emperorId ? game.generals.get(emperorId) : null;
    // BUG修复（harem.js）：旧存档/模组武将四维可能缺失（undefined），
    //   直接 (cmd+force+intel+politics)/4 会得 NaN，进而使生育概率 p 为 NaN，
    //   `Math.random() >= NaN` 恒为 false → 每回合无条件疯狂生育（子嗣爆炸）。
    //   修复：四维缺失时回退到默认 60，与无君主时的分支一致。
    const eCmd = Number(emperor && emperor.command) || 60;
    const eForce = Number(emperor && emperor.force) || 60;
    const eIntel = Number(emperor && emperor.intel) || 60;
    const ePolitics = Number(emperor && emperor.politics) || 60;
    const charm = (eCmd + eForce + eIntel + ePolitics) / 4;
    const charmBonus = Math.max(0, (charm - 60) / 10) * HAREM_CHARM_BONUS;

    for (const c of rec.consorts) {
      const rank = _rankById(c.rank);
      const p = HAREM_BIRTH_BASE + (rank ? rank.birthChance : 0) + charmBonus;
      if (Math.random() >= Math.min(0.6, p)) continue;
      // 诞生子嗣
      const gender = Math.random() < 0.55 ? 'male' : 'female';
      const child = this._makeChild(gender, c, emperor, fid);
      rec.children.push(child);
      if (fid === game.playerFaction) {
        game.pushLog(`👶 【${c.rankName} ${c.name}】诞下${gender === 'male' ? '皇子' : '皇女'}【${child.name}】！大赦天下，民心大振。`);
        // 皇子出生：民心 +3
        // 性能优化（harem.js V21.0·120城回合结算）：优先复用 settleTurn 玩家城市缓存。
        for (const city of (game._playerCitiesTurnCache || game.getFactionCities(fid))) city.morale = Math.min(100, city.morale + 3);
        if (game.eventSystem) game._pendingRoyalBirth = child.id;
      }
    }
    // 子嗣年长
    // BUG修复（harem.js V22.0 成熟子嗣年龄无限膨胀）：
    //   基准：原写法 `for (const ch of rec.children) ch.age++` 对所有子嗣每回合涨一岁，
    //   包括已 mature=true（已由 matureChildToGeneral 转为武将加入 generals）的皇子。
    //   长局后这些皇子在 children 里年龄无限增长（如皇子已 50 岁仍每年 +1），
    //   顶栏/剧情里显示怪异，且 children 数组随生育只增不减、内存缓慢膨胀。
    //   修复：已 mature（已出阁为武将）的子嗣跳过年龄增长；未出阁的皇女/皇
    //   子仍正常长大（marriagablePrincesses 按 age>=MIN_AGE 过滤不受影响）。
    for (const ch of rec.children) {
      if (ch.mature) continue;
      ch.age++;
    }
  }

  _makeChild(gender, mother, father, fid) {
    const surname = FACTIONS[fid] ? (FACTIONS[fid].name || '萧') : '萧';
    const given = this._childName(gender);
    // BUG修复（harem.js V24.0 子嗣姓氏丢失）：原写法算出 `surname` 却未使用，
    //   `name: given` 只给了单字名（如「勇」「丽华」），皇子皇女一律不带王朝姓氏，
    //   与「按势力国姓命名」的设计不符。修复：姓名 = 国姓 + 名。
    const baseCmd = father ? father.command : 60;
    const baseForce = father ? father.force : 60;
    const baseIntel = mother.rank === 'empress' ? 75 : (60 + Math.random() * 15);
    const basePolitics = father ? father.politics : 60;
    return {
      id: 'ch_' + (childSeq++),
      name: surname + given,
      gender,
      age: 0,
      motherId: mother.id,
      motherName: mother.name,
      stats: {
        command: Math.max(20, Math.round(baseCmd + (Math.random() * 20 - 10))),
        force: Math.max(20, Math.round(baseForce + (Math.random() * 20 - 10))),
        intel: Math.max(20, Math.round(baseIntel + (Math.random() * 20 - 10))),
        politics: Math.max(20, Math.round(basePolitics + (Math.random() * 20 - 10)))
      },
      marriedTo: null
    };
  }

  _childName(gender) {
    const princeNames = ['勇', '德', '恭', '毅', '文', '武', '安', '广', '深', '庄'];
    const princessNames = ['丽华', '玉娆', '妙容', '嫒姿', '木兰', '琼华', '瑶英', '苕华'];
    const pool = gender === 'male' ? princeNames : princessNames;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // ---------- 太子 ----------
  appointHeir(fid, childId) {
    const rec = this.factions[fid];
    if (!rec) return { ok: false, msg: '无后宫记录' };
    const ch = rec.children.find(c => c.id === childId);
    if (!ch) return { ok: false, msg: '子嗣不存在' };
    if (ch.gender !== 'male') return { ok: false, msg: '非皇子，不可立储' };
    if (ch.age < HAREM_PRINCE_AGE_ADULT) return { ok: false, msg: `皇子方龄${ch.age}，未及成年（${HAREM_PRINCE_AGE_ADULT}），不宜立储` };
    rec.heirId = childId;
    return { ok: true, msg: `已立【${ch.name}】为皇太子，正统大增。`, child: ch };
  }

  // 子嗣成年（转为武将）：返回新 General 数据，由 game 加入 generals
  matureChildToGeneral(game, fid, childId) {
    const rec = this.factions[fid];
    if (!rec) return null;
    const ch = rec.children.find(c => c.id === childId);
    if (!ch || ch.gender !== 'male') return null;
    ch.mature = true;
    return {
      id: 'prince_' + childId,
      name: ch.name,
      faction: fid,
      role: '皇子',
      command: ch.stats.command, force: ch.stats.force,
      intel: ch.stats.intel, politics: ch.stats.politics,
      loyalty: 85, portrait: 'prince'  // 默认立绘
    };
  }

  // ---------- 联姻 ----------
  // 可联姻的皇女列表
  marriageablePrincesses(fid) {
    const rec = this.factions[fid];
    if (!rec) return [];
    return rec.children.filter(c =>
      c.gender === 'female' && !c.marriedTo && c.age >= HAREM_MARRY_PRINCESS_MIN_AGE);
  }

  // 联姻：将皇女嫁与目标势力（由 diplomacy 层调用，返回结果）
  marryPrincess(game, fid, princessId, targetFid) {
    const rec = this.factions[fid];
    if (!rec) return { ok: false, msg: '无后宫记录' };
    const ch = rec.children.find(c => c.id === princessId);
    if (!ch) return { ok: false, msg: '皇女不存在' };
    if (ch.gender !== 'female') return { ok: false, msg: '非皇女' };
    if (ch.age < HAREM_MARRY_PRINCESS_MIN_AGE) return { ok: false, msg: `皇女方龄${ch.age}，未及笄` };
    if (ch.marriedTo) return { ok: false, msg: '皇女已嫁' };
    if (fid === targetFid) return { ok: false, msg: '不可与本国联姻' };
    // BUG修复（harem.js #2）：targetFid 为无效/已灭势力时 FACTIONS[targetFid] 为 undefined，
    //   直接取 .name 会抛 TypeError。此处做空值兜底。
    if (!FACTIONS[targetFid]) return { ok: false, msg: '联姻目标势力不存在' };
    ch.marriedTo = targetFid;
    return { ok: true, msg: `皇女【${ch.name}】下嫁${FACTIONS[targetFid].name}，两国秦晋之好。`, child: ch };
  }

  // ---------- 序列化 ----------
  serialize() {
    const out = {};
    for (const [fid, rec] of Object.entries(this.factions)) {
      out[fid] = {
        consorts: rec.consorts,
        children: rec.children,
        heirId: rec.heirId
      };
    }
    return out;
  }
  static deserialize(data) {
    const s = new HaremSystem();
    if (data && typeof data === 'object') {
      for (const [fid, rec] of Object.entries(data)) {
        // BUG修复（harem.js #3）：损坏存档/跨版本迁移中某势力的 rec 可能为 null 或
        //   非对象，直接取 rec.consorts 会抛 TypeError，导致整个读档失败。
        //   修复：rec 非法时该势力跳过（保持空后宫），不影响其余势力恢复。
        if (!rec || typeof rec !== 'object') continue;
        s.factions[fid] = {
          consorts: Array.isArray(rec.consorts) ? rec.consorts : [],
          children: Array.isArray(rec.children) ? rec.children : [],
          heirId: rec.heirId || null
        };
      }
    }
    return s;
  }
}
