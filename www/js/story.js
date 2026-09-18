// ============================================================
// story.js — V3.0 武将个人剧情系统
// 为关键武将设计 3~5 个剧情节点，每个节点有触发条件、剧情文本、
// 2~3 个选择分支与选项效果。剧情进度记录在 game.storyProgress。
// 游戏每回合检查触发条件；触发后由 UI 复用事件弹窗呈现，
// 玩家选择后调用 game.triggerStoryEvent(generalId, eventId, choiceIdx)。
// ============================================================

// ---------- 剧情节点定义 ----------
// trigger(game, gen) => bool：是否触发该节点
// choices[].effect 复用 events 的效果字段（morale/money/food/generalBuff/
//   generalLoyalty/armyLoss/recruitGeneral/pop），由 game.triggerStoryEvent 统一执行。
// reward：剧情完成后的额外奖励（属性提升 / 称号）。
export const STORY_NODES = {
  // ---- 陈霸先：从村官到皇帝 ----
  chen_baxian: [
    {
      id: 'cbx_1', title: '岭南崛起', minTurn: 2,
      trigger: (game, gen) => game.turn >= 2 && gen.faction === game.playerFaction,
      text: '陈霸先出身寒微，于岭南平定李贲之乱，崭露头角。侯景乱起，他率西江豪俊星夜赴援。',
      choices: [
        { text: '整军经武（武力+8）', effect: { generalBuff: { id: 'chen_baxian', amt: 8 } } },
        { text: '结交豪杰（招募一将，忠诚+10）', effect: { recruitRandom: true, generalLoyalty: { id: 'chen_baxian', amt: 10 } } }
      ]
    },
    {
      id: 'cbx_2', title: '京口定策', minTurn: 6,
      trigger: (game, gen) => game.turn >= 6 && gen.faction === game.playerFaction,
      text: '台城围困日久，王僧辩虽拥兵而不进。陈霸先与王僧辩会于京口，刑牲盟约，共奖王室。',
      choices: [
        { text: '推心置腹（民心+15）', effect: { factionMorale: 15 } },
        { text: '独树一帜（政治+8）', effect: { generalPolitics: { id: 'chen_baxian', amt: 8 } } }
      ]
    },
    {
      id: 'cbx_3', title: '建陈称帝', minTurn: 10,
      trigger: (game, gen) => game.turn >= 10 && gen.faction === game.playerFaction,
      text: '梁祚已终，群臣劝进。陈霸先南郊即皇帝位，国号陈。自此南面称孤，志在北伐。',
      choices: [
        { text: '大赦天下（金钱+1000，民心+10）', effect: { money: 1000, factionMorale: 10 } },
        { text: '厉兵秣马（全兵buff，损兵不损威）', effect: { garrisonBuff: true, factionMorale: 5 } }
      ],
      reward: { title: '开国英主', attr: { command: 5, politics: 5 } }
    }
  ],

  // ---- 高欢：从镇兵到权臣 ----
  gao_huan: [
    {
      id: 'gh_1', title: '六镇余烬', minTurn: 2,
      trigger: (game, gen) => game.turn >= 2 && gen.faction === game.playerFaction,
      text: '高欢本六镇戍卒，沉静有大度。尔朱荣见而异之，引为亲信。'
    },
    {
      id: 'gh_2', title: '韩陵之战', minTurn: 6,
      trigger: (game, gen) => game.turn >= 6 && gen.faction === game.playerFaction,
      text: '尔朱氏骄横，高欢于韩陵以少击众，大破尔朱兆，遂据有河北。',
      choices: [
        { text: '乘胜西进（智力+8）', effect: { generalIntel: { id: 'gao_huan', amt: 8 } } },
        { text: '抚纳降众（招募一将）', effect: { recruitRandom: true } }
      ]
    },
    {
      id: 'gh_3', title: '玉璧遗恨', minTurn: 10,
      trigger: (game, gen) => game.turn >= 10 && gen.faction === game.playerFaction,
      text: '玉璧城下，韦孝宽固守，高欢连营五十日，士卒死伤七万。追念前功，悲歌《敕勒》。',
      choices: [
        { text: '英雄迟暮（武力-5，士气-5）', effect: { generalDebuff: { id: 'gao_huan', amt: 5 }, factionMorale: -5 } },
        { text: '遗命后人（政治+5，后继有人）', effect: { generalPolitics: { id: 'gao_huan', amt: 5 } } }
      ],
      reward: { title: '北齐神武帝' }
    }
  ],

  // ---- 宇文泰：从边将到霸主 ----
  yuwen_tai: [
    {
      id: 'ywt_1', title: '接管关陇', minTurn: 3,
      trigger: (game, gen) => game.turn >= 3 && gen.faction === game.playerFaction,
      text: '贺拔岳遇害，三军无主。宇文泰素为众望所归，遂领其众，据有关中。',
      choices: [
        { text: '恩威并施（忠诚+15）', effect: { generalLoyalty: { id: 'yuwen_tai', amt: 15 } } },
        { text: '严明赏罚（智力+8）', effect: { generalIntel: { id: 'yuwen_tai', amt: 8 } } }
      ]
    },
    {
      id: 'ywt_2', title: '沙苑以少胜多', minTurn: 6,
      trigger: (game, gen) => game.turn >= 6 && gen.faction === game.playerFaction,
      text: '高欢二十万压境，宇文泰万人拒之。渭曲苇伏，大破齐师，天下震动。',
      choices: [
        { text: '穷追猛打（士气+15）', effect: { factionMorale: 15 } },
        { text: '收兵安民（金钱+800）', effect: { money: 800, factionMorale: 5 } }
      ]
    },
    {
      id: 'ywt_3', title: '府兵创制', minTurn: 10,
      trigger: (game, gen) => game.turn >= 10 && gen.faction === game.playerFaction,
      text: '宇文泰仿周官，立八柱国，府兵自此成制。关陇将相，出其门者半天下。',
      choices: [
        { text: '耕战一体（步兵buff）', effect: { garrisonBuff: true, factionMorale: 8 } },
        { text: '擢用贤才（招募一将）', effect: { recruitRandom: true } }
      ],
      reward: { title: '北周文帝', attr: { politics: 5 } }
    }
  ],

  // ---- 韦孝宽：玉璧孤城 ----
  wei_xiaokuan: [
    {
      id: 'wxk_1', title: '玉璧固守', minTurn: 6,
      trigger: (game, gen) => game.turn >= 6 && gen.faction === game.playerFaction,
      text: '高欢倾国之师围玉璧，韦孝宽随机应变，城中矢石俱尽而守意愈坚。',
      choices: [
        { text: '随机应变（守城buff两回合）', effect: { garrisonBuff: true } },
        { text: '身先士卒（武力+6）', effect: { generalBuff: { id: 'wei_xiaokuan', amt: 6 } } }
      ]
    },
    {
      id: 'wxk_2', title: '平齐三策', minTurn: 18,
      trigger: (game, gen) => game.turn >= 18 && gen.faction === game.playerFaction,
      text: '韦孝安静观齐政，知其必亡，上平齐三策于周主。',
      choices: [
        { text: '献灭齐之策（智力+10）', effect: { generalIntel: { id: 'wei_xiaokuan', amt: 10 } } }
      ],
      reward: { title: '千古守将' }
    }
  ],

  // ---- 斛律光：落雕都督 ----
  hu_luguang: [
    {
      id: 'hlg_1', title: '落雕射雕', minTurn: 4,
      trigger: (game, gen) => game.turn >= 4 && gen.faction === game.playerFaction,
      text: '斛律光尝从世宗狩，见云表一雕，射之应弦而落，军中号「落雕都督」。',
      choices: [
        { text: '箭无虚发（武力+8）', effect: { generalBuff: { id: 'hu_luguang', amt: 8 } } }
      ]
    },
    {
      id: 'hlg_2', title: '邙山大捷', minTurn: 13,
      trigger: (game, gen) => game.turn >= 13 && gen.faction === game.playerFaction,
      text: '邙山之战，斛律光驰射周骑，所向披靡。周人惮之，呼为「斛律公」。',
      choices: [
        { text: '威震敌胆（弓兵buff，士气+10）', effect: { garrisonBuff: true, factionMorale: 10 } }
      ]
    },
    {
      id: 'hlg_3', title: '谗言殒命', minTurn: 22,
      trigger: (game, gen) => game.turn >= 22 && gen.faction === game.playerFaction,
      text: '祖珽、穆提婆屡进谗言，齐主疑而赐之。光死之日，朝野冤之。',
      choices: [
        { text: '坦然受死（忠诚+10，齐自毁长城）', effect: { generalLoyalty: { id: 'hu_luguang', amt: 10 }, factionMorale: -10 } },
        { text: '自陈其忠（智力+5）', effect: { generalIntel: { id: 'hu_luguang', amt: 5 } } }
      ],
      reward: { title: '落雕都督' }
    }
  ],

  // ---- 高长恭：兰陵王 ----
  gao_changgong: [
    {
      id: 'gcc_1', title: '假面破敌', minTurn: 10,
      trigger: (game, gen) => game.turn >= 10 && gen.faction === game.playerFaction,
      text: '长恭美姿容，虑不足示威，每戴假面以临阵。勇冠三军，齐人壮之。',
      choices: [
        { text: '假面冲阵（武力+8）', effect: { generalBuff: { id: 'gao_changgong', amt: 8 } } }
      ]
    },
    {
      id: 'gcc_2', title: '入阵之歌', minTurn: 14,
      trigger: (game, gen) => game.turn >= 14 && gen.faction === game.playerFaction,
      text: '邙山解金墉之围，武士共歌《兰陵王入阵曲》，传于乐府。',
      choices: [
        { text: '与士卒同乐（忠诚+15，民心+10）', effect: { generalLoyalty: { id: 'gao_changgong', amt: 15 }, factionMorale: 10 } }
      ],
      reward: { title: '兰陵王' }
    },
    {
      id: 'gcc_3', title: '含冤鸩死', minTurn: 24,
      trigger: (game, gen) => game.turn >= 24 && gen.faction === game.playerFaction,
      text: '齐后主忌其威名，赐以鸩毒。长恭叹曰：「我忠如此，何负于天！」饮而薨。',
      choices: [
        { text: '忠而被谤（忠诚+10）', effect: { generalLoyalty: { id: 'gao_changgong', amt: 10 }, factionMorale: -5 } }
      ]
    }
  ],

  // ---- 宇文邕：北周武帝 ----
  yuwen_yong: [
    {
      id: 'ywy_1', title: '隐忍诛护', minTurn: 8,
      trigger: (game, gen) => game.turn >= 8 && gen.faction === game.playerFaction,
      text: '宇文护专政，周邕深自韬晦，相与密谋，终于殿上诛护，始亲万机。',
      choices: [
        { text: '雷霆手段（政治+10）', effect: { generalPolitics: { id: 'yuwen_yong', amt: 10 } } }
      ]
    },
    {
      id: 'ywy_2', title: '灭佛求富', minTurn: 18,
      trigger: (game, gen) => game.turn >= 18 && gen.faction === game.playerFaction,
      text: '周邕断佛道二教，僧尼还俗，户口滋广，国库充实。',
      choices: [
        { text: '富国强兵（金钱+1200）', effect: { money: 1200, factionMorale: -5 } },
        { text: '怀柔三宝（民心+10）', effect: { factionMorale: 10 } }
      ]
    },
    {
      id: 'ywy_3', title: '亲征灭齐', minTurn: 26,
      trigger: (game, gen) => game.turn >= 26 && gen.faction === game.playerFaction,
      text: '周邕亲帅六军，北克晋阳，东下邺城，齐主成擒。北方复一。',
      choices: [
        { text: '一统北方（士气+20）', effect: { factionMorale: 20, garrisonBuff: true } }
      ],
      reward: { title: '北周武帝', attr: { command: 5, politics: 5 } }
    }
  ],

  // ---- 杨坚：隋公代周 ----
  yang_jian: [
    {
      id: 'yj_1', title: '外戚辅政', minTurn: 28,
      trigger: (game, gen) => game.turn >= 28 && gen.faction === game.playerFaction,
      text: '周宣帝崩，刘昉、郑译引杨坚入侍，辅幼主。人望既归，徐图禅代。',
      choices: [
        { text: '总揽朝政（政治+10）', effect: { generalPolitics: { id: 'yang_jian', amt: 10 } } },
        { text: '结纳功臣（招募一将）', effect: { recruitRandom: true } }
      ]
    },
    {
      id: 'yj_2', title: '三方平定', minTurn: 31,
      trigger: (game, gen) => game.turn >= 31 && gen.faction === game.playerFaction,
      text: '尉迟迥、王谦等举兵相抗，杨坚任韦孝宽等，前后讨平，海内归心。',
      choices: [
        { text: '运筹决胜（智力+10）', effect: { generalIntel: { id: 'yang_jian', amt: 10 } } }
      ]
    },
    {
      id: 'yj_3', title: '受禅建隋', minTurn: 34,
      trigger: (game, gen) => game.turn >= 34 && gen.faction === game.playerFaction,
      text: '周静帝禅位于隋王坚，改元开皇。江南未平，混一可期。',
      choices: [
        { text: '开皇之治（金钱+2000，民心+15）', effect: { money: 2000, factionMorale: 15 } }
      ],
      reward: { title: '隋文帝', attr: { command: 5, politics: 5 } }
    }
  ],

  // ---- 羊侃：死守台城 ----
  yang_kan: [
    {
      id: 'yk_1', title: '侯景围城', minTurn: 5,
      trigger: (game, gen) => game.turn >= 5 && gen.faction === game.playerFaction,
      text: '侯景渡采石，直指台城。城中猝无备，众推羊侃都督守城。',
      choices: [
        { text: '整备守备（守城buff两回合）', effect: { garrisonBuff: true } },
        { text: '激励将士（武力+6）', effect: { generalBuff: { id: 'yang_kan', amt: 6 } } }
      ]
    },
    {
      id: 'yk_2', title: '死守台城', minTurn: 8,
      trigger: (game, gen) => game.turn >= 8 && gen.faction === game.playerFaction,
      text: '羊侃昼夜巡逻，随机拒守。久之，城中粮尽，侃亦遘疾，薨于围中。',
      choices: [
        { text: '鞠躬尽瘁（忠诚+20，民心+10）', effect: { generalLoyalty: { id: 'yang_kan', amt: 20 }, factionMorale: 10 } }
      ],
      reward: { title: '台城忠魂' }
    }
  ],

  // ---- 陈庆之：千军万马避白袍 ----
  chen_qingzhi: [
    {
      id: 'cqz_1', title: '七千白袍', minTurn: 4,
      trigger: (game, gen) => game.turn >= 4 && gen.faction !== null,
      text: '陈庆之受命送元颢北归，七千白袍，所向无前。魏人歌曰：「名师大将莫自牢，千军万马避白袍。」',
      choices: [
        { text: '长驱洛阳（智力+10）', effect: { generalIntel: { id: 'chen_qingzhi', amt: 10 } } },
        { text: '善待降附（招募一将）', effect: { recruitRandom: true } }
      ],
      reward: { title: '白袍宗师' }
    }
  ]
};

// ---------- 剧情系统运行时 ----------
export class StorySystem {
  constructor() {
    // progress: { generalId: { currentNode:int, completedNodes:[], done:bool } }
    this.progress = {};
    this.pending = []; // [{generalId, node}]
  }

  // 取某武将的进度
  getProgress(generalId) {
    if (!this.progress[generalId]) {
      this.progress[generalId] = { currentNode: 0, completedNodes: [], done: false };
    }
    return this.progress[generalId];
  }

  // 某武将是否还有未完成的剧情节点
  hasMoreNodes(generalId) {
    const nodes = STORY_NODES[generalId];
    if (!nodes) return false;
    const p = this.getProgress(generalId);
    return p.currentNode < nodes.length;
  }

  // 列出某武将全部剧情事件（供 UI 展示进度）
  getStoryEvents(generalId) {
    const nodes = STORY_NODES[generalId] || [];
    const p = this.getProgress(generalId);
    return nodes.map((n, i) => ({
      ...n,
      index: i,
      state: i < p.currentNode ? 'done' : (i === p.currentNode ? 'current' : 'locked')
    }));
  }

  // 每回合扫描：找出所有满足触发条件的「当前节点」
  scanTriggers(game) {
    this.pending = [];
    for (const [genId, nodes] of Object.entries(STORY_NODES)) {
      const p = this.getProgress(genId);
      if (p.done) continue;
      if (p.currentNode >= nodes.length) { p.done = true; continue; }
      const node = nodes[p.currentNode];
      const gen = game.generals.get(genId);
      if (!gen) continue;
      try {
        if (typeof node.trigger === 'function' && node.trigger(game, gen)) {
          this.pending.push({ generalId: genId, nodeIndex: p.currentNode, node });
        }
      } catch (e) { /* 触发异常不中断 */ }
    }
    return this.pending;
  }

  // 应用某武将某节点的某选择
  // 由 game.triggerStoryEvent 调用；返回 {ok, msg}
  applyChoice(game, generalId, nodeIndex, choiceIdx) {
    const nodes = STORY_NODES[generalId];
    if (!nodes || nodeIndex >= nodes.length) return { ok: false, msg: '剧情节点不存在' };
    const node = nodes[nodeIndex];
    const p = this.getProgress(generalId);
    if (p.currentNode !== nodeIndex) return { ok: false, msg: '该节点已完成或未解锁' };
    const choice = (node.choices || [])[choiceIdx] || (node.choices || [])[0];
    if (!choice) return { ok: false, msg: '无选项' };

    // 复用 events 的效果执行器（由 game 提供统一函数）
    game._applyStoryEffect(choice.effect || {}, node, generalId);

    // 推进进度
    p.completedNodes.push(node.id);
    p.currentNode++;
    if (p.currentNode >= nodes.length) {
      p.done = true;
      // 剧情完成奖励
      if (node.reward) {
        const gen = game.generals.get(generalId);
        if (gen && node.reward.attr) {
          for (const [k, v] of Object.entries(node.reward.attr)) {
            gen[k] = (gen[k] || 0) + v;
          }
        }
        game.pushLog(`★ ${gen ? gen.name : ''} 完成个人剧情【${node.title}】，获称号「${node.reward.title || node.title}」`);
      }
    } else {
      game.pushLog(`剧情推进：${node.title} — ${choice.text}`);
    }
    // 从待触发队列移除
    this.pending = this.pending.filter(x => !(x.generalId === generalId && x.nodeIndex === nodeIndex));
    return { ok: true, node, choice };
  }

  serialize() { return { progress: this.progress }; }
  static deserialize(data) {
    const s = new StorySystem();
    if (data && data.progress) s.progress = data.progress;
    return s;
  }
}
