// ============================================================
// family.js — V21.0 家族谱系 / 联姻系统
// ------------------------------------------------------------
// 历史背景（据《宋书》《南齐书》《魏书》列传与门阀故事）：
//  · 六朝最重门第，王谢袁萧、崔卢李郑，联姻即国是。
//  · 帝室与功臣、胡汉豪族互为婚姻，以婚好缔盟，以离婚构隙。
//  · 君主世系以血缘相承，无子则择近支宗室。
// 设计：
//  - 家族树：每名武将登记 father / mother / spouse / children 关系。
//  - 联姻：势力间为将校择配，提升两国外交关系与家族声望。
//  - 家族声望：族众越繁、在朝官职越高，声望越高，利招募与外交。
//  - 继承：君主身故，按血缘（子女 > 近支）择嗣。
//  - 家族冲突：联姻破裂/和离，两国外交关系恶化。
//
// 新增 API：
//  - getFamilyTree(generalId)
//  - arrangeMarriage(factionA, generalA, factionB, generalB, game)
//  - getFamilyPrestige(factionId)
//  - getHeir(factionId)
//  - divorceMarriage(generalA, generalB, game)
//
// 说明：家族关系全部由本系统自持（按 generalId 索引），不改动
//   general.js / save.js 的武将序列化结构；与游戏解耦、可空挂。
// ============================================================

// 联姻对关系的增益 / 离婚对关系的折损
export const V21_MARRIAGE_REL_BOOST = 30;
export const V21_DIVORCE_REL_HIT = -40;
// 声望计算参数
export const V21_PRESTIGE_PER_MEMBER = 8;     // 每位家族成员基础声望
export const V21_PRESTIGE_PER_MARRIAGE = 6;   // 每桩联姻声望
export const V21_PRESTIGE_RANK_CAP = 60;       // 官职带来的声望上限

export class FamilySystem {
  constructor() {
    // generalId -> { id, name, father, mother, spouse, children: [] }
    this.trees = {};
    // 现存联姻记录（active 未离婚）
    this.marriages = []; // { a:{faction,id,name}, b:{faction,id,name}, turn, active }
    // 累计统计（成就 / 结局读取）
    this.stats = {
      marriages: 0,       // 累计成婚礼数
      divorces: 0,        // 累计和离/破裂数
      bloodHeirs: 0       // 血缘继承发生次数
    };
  }

  // ---------- 内部工具 ----------
  _gen(game, id) {
    try { return game.generals ? game.generals.get(id) : null; } catch (e) { return null; }
  }

  // 惰性登记一名武将到家族树
  ensureGeneral(game, generalId) {
    if (this.trees[generalId]) return this.trees[generalId];
    const g = this._gen(game, generalId);
    if (!g) return null;
    this.trees[generalId] = {
      id: generalId,
      name: g.name,
      father: null,
      mother: null,
      spouse: null,
      children: []
    };
    return this.trees[generalId];
  }

  // ---------- API：家族树 ----------
  // 返回某武将的家族谱系（父/母/配偶/子女）
  getFamilyTree(generalId) {
    const node = this.trees[generalId];
    if (!node) return null;
    return {
      id: node.id,
      name: node.name,
      father: node.father,
      mother: node.mother,
      spouse: node.spouse,
      children: [...node.children]
    };
  }

  // ---------- API：联姻 ----------
  // 为 A 势力 generalA 与 B 势力 generalB 缔结婚好
  arrangeMarriage(factionA, generalA, factionB, generalB, game) {
    if (factionA === factionB) return { ok: false, msg: '同姓同宗，不宜为婚' };
    const ga = this.ensureGeneral(game, generalA);
    const gb = this.ensureGeneral(game, generalB);
    if (!ga || !gb) return { ok: false, msg: '联姻双方须为在世武将' };
    if (ga.spouse || gb.spouse) return { ok: false, msg: '其中一人已有配偶，须先和离' };
    const aGen = this._gen(game, generalA);
    const bGen = this._gen(game, generalB);
    if (!aGen || !bGen) return { ok: false, msg: '武将不存在' };
    if (aGen.alive === false || bGen.alive === false) return { ok: false, msg: '已故之人不能成婚' };

    // 互为配偶
    ga.spouse = { faction: factionB, id: generalB, name: gb.name };
    gb.spouse = { faction: factionA, id: generalA, name: ga.name };

    // 记录联姻
    this.marriages.push({
      a: { faction: factionA, id: generalA, name: ga.name },
      b: { faction: factionB, id: generalB, name: gb.name },
      turn: game.turn,
      active: true
    });
    this.stats.marriages += 1;

    // 联姻提升两国外交关系
    try {
      if (game.diplomacy && game.diplomacy.getRelation) {
        const rel = game.diplomacy.getRelation(factionA, factionB);
        if (rel) rel.relation = Math.min(100, (rel.relation || 0) + V21_MARRIAGE_REL_BOOST);
      }
    } catch (e) { /* 无外交系统则忽略 */ }

    try {
      game.pushLog(`💍 ${game._factionName ? game._factionName(factionA) : factionA} 与 ` +
        `${game._factionName ? game._factionName(factionB) : factionB} 联姻：` +
        `${ga.name} 配 ${gb.name}，两国秦晋之好。`);
    } catch (e) {}
    return { ok: true, msg: `联姻成：${ga.name} × ${gb.name}，两国外交和睦` };
  }

  // ---------- API：家族声望 ----------
  // 声望 0~100：族众 + 联姻 + 在朝官职（以四维/忠诚近似官职高低）
  getFamilyPrestige(factionId, game) {
    let prestige = 0;
    let members = 0;
    let officialScore = 0;
    try {
      const gens = (game && game.getFactionGenerals) ? game.getFactionGenerals(factionId) : [];
      members = gens.length;
      for (const g of gens) {
        // 官职高低近似：四维总和 + 忠诚
        officialScore += (g.command + g.force + g.intel + g.politics + (g.loyalty || 50));
      }
      // 平均官职贡献（归一化到 0~V21_PRESTIGE_RANK_CAP）
      const avgRank = members ? officialScore / members : 0;
      prestige += Math.min(V21_PRESTIGE_RANK_CAP, Math.round(avgRank / 10));
    } catch (e) { /* 无武将数据则仅算联姻 */ }

    // 族众贡献（封顶，避免碾压）
    prestige += Math.min(40, members * V21_PRESTIGE_PER_MEMBER);

    // 联姻贡献：数活联姻中任一方属本势力
    const activeMarriages = this.marriages.filter(m => m.active &&
      (m.a.faction === factionId || m.b.faction === factionId));
    prestige += Math.min(30, activeMarriages.length * V21_PRESTIGE_PER_MARRIAGE);

    prestige = Math.max(0, Math.min(100, prestige));
    let tier = '寒微';
    if (prestige >= 80) tier = '望族';
    else if (prestige >= 60) tier = '冠族';
    else if (prestige >= 40) tier = '豪族';
    else if (prestige >= 20) tier = '士族';
    return { value: prestige, tier, members, marriages: activeMarriages.length };
  }

  // ---------- API：继承 ----------
  // 返回某势力的继承人 generalId（优先君主本人；若亡故则血缘子女，再近支，再最强将）
  getHeir(factionId, game) {
    try {
      const gens = (game && game.getFactionGenerals) ? game.getFactionGenerals(factionId) : [];
      if (!gens.length) return null;
      const lord = gens.find(g => g.role === '君主') || gens[0];
      // 君主在世：即自身
      if (lord && lord.alive !== false && lord.faction !== null) return lord.id;

      // 君主身故：先找其血缘子女
      const lordNode = this.trees[lord.id];
      if (lordNode && Array.isArray(lordNode.children) && lordNode.children.length) {
        const child = gens.find(g => g.id === lordNode.children[0] && g.alive !== false);
        if (child) { this.stats.bloodHeirs += 1; return child.id; }
      }
      // 再找君主的配偶所生近支
      // 兜底：忠诚最高的在世武将
      const alive = gens.filter(g => g.alive !== false && g.faction !== null);
      alive.sort((a, b) => (b.loyalty || 0) - (a.loyalty || 0));
      return alive.length ? alive[0].id : null;
    } catch (e) { return null; }
  }

  // ---------- API：家族冲突（和离） ----------
  // 解除两将联姻，两国外交关系恶化
  divorceMarriage(generalA, generalB, game) {
    const ga = this.trees[generalA];
    const gb = this.trees[generalB];
    if (!ga || !gb) return { ok: false, msg: '二人并无婚约' };
    if (!ga.spouse || ga.spouse.id !== generalB) return { ok: false, msg: '二人并非夫妻' };

    // 解除配偶
    ga.spouse = null;
    gb.spouse = null;

    // 标记联姻失效
    const m = this.marriages.find(x =>
      x.active && ((x.a.id === generalA && x.b.id === generalB) ||
                   (x.a.id === generalB && x.b.id === generalA)));
    if (m) m.active = false;
    this.stats.divorces += 1;

    // 外交恶化
    let fa = null, fb = null;
    try {
      const ag = this._gen(game, generalA);
      const bg = this._gen(game, generalB);
      fa = ag ? ag.faction : null;
      fb = bg ? bg.faction : null;
      if (fa && fb && game.diplomacy && game.diplomacy.getRelation) {
        const rel = game.diplomacy.getRelation(fa, fb);
        if (rel) rel.relation = Math.max(-100, (rel.relation || 0) + V21_DIVORCE_REL_HIT);
      }
    } catch (e) {}

    try {
      game.pushLog('💔 联姻破裂：' + (ga.name) + ' 与 ' + (gb.name) + ' 和离，两国旧好自此衰矣。');
    } catch (e) {}
    return { ok: true, msg: `已和离，两国外交恶化`, factionA: fa, factionB: fb };
  }

  // ---------- 序列化 ----------
  serialize() {
    return {
      trees: this.trees,
      marriages: this.marriages,
      stats: this.stats
    };
  }
  static deserialize(data) {
    const f = new FamilySystem();
    if (data) {
      f.trees = (data.trees && typeof data.trees === 'object') ? data.trees : {};
      f.marriages = Array.isArray(data.marriages) ? data.marriages : [];
      f.stats = {
        marriages: 0, divorces: 0, bloodHeirs: 0,
        ...(data.stats || {})
      };
    }
    return f;
  }
}
