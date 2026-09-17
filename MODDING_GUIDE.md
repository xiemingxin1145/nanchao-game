# 南北朝 V4.0 模组开发指南

## 简介

V4.0 引入了数据驱动模组系统，允许创作者通过 JSON 文件添加/修改游戏内容，无需修改源代码。

## 模组文件位置

将模组 JSON 文件放入 `src/mods/` 目录，并在 `src/mods/manifest.json` 中登记文件名：

```json
{
  "mods": ["example_mod.json", "my_custom_mod.json"]
}
```

## 模组格式

每个模组为一个 JSON 文件，格式如下：

```json
{
  "id": "unique_mod_id",
  "name": "模组名称",
  "version": "1.0.0",
  "author": "作者名",
  "description": "模组描述",
  "data": {
    // 可修改的数据模块
  }
}
```

## 可修改的数据模块

### 1. factions（势力）

按势力 ID 为 key，覆盖或新增势力定义：

```json
{
  "data": {
    "factions": {
      "sui": {
        "id": "sui",
        "name": "隋",
        "color": "#B8860B",
        "colorLight": "#DAA520",
        "capital": "daxing",
        "description": "杨坚受周禅建隋。",
        "bonus": "全兵种+10%",
        "startCities": ["daxing", "tongguan"]
      }
    }
  }
}
```

### 2. cities（城市）

按数组形式，按 `id` 匹配进行合并或新增：

```json
{
  "data": {
    "cities": [
      {
        "id": "daxing",
        "name": "大兴城",
        "isoX": 6, "isoY": 4,
        "terrain": "plain",
        "size": 4,
        "capital": true,
        "pop": 75000,
        "agri": 70, "comm": 80, "defense": 70,
        "prosperity": 80, "taxRate": 30
      }
    ]
  }
}
```

### 3. cityLinks（城市邻接）

为新城市添加行军路径：

```json
{
  "data": {
    "cityLinks": {
      "daxing": ["tongguan", "changan"],
      "tongguan": ["daxing", "hongnong"]
    }
  }
}
```

### 4. generals（武将）

按 `id` 匹配进行合并或新增：

```json
{
  "data": {
    "generals": [
      {
        "id": "yang_su",
        "name": "杨素",
        "faction": "sui",
        "role": "名将",
        "command": 86, "force": 82, "intel": 80, "politics": 70,
        "loyalty": 85,
        "portrait": "yang_su"
      }
    ],
    "generalSkills": {
      "yang_su": ["mouliao_baichu"]
    }
  }
}
```

### 5. skills（技能）

按技能 ID 为 key 覆盖或新增：

```json
{
  "data": {
    "skills": {
      "new_skill": {
        "id": "new_skill",
        "name": "新技能",
        "type": "passive",
        "cooldown": 0,
        "description": "效果描述",
        "effect": { "cavalryMult": 0.20 }
      }
    }
  }
}
```

### 6. techs（科技）

按数组形式，按 `id` 匹配进行合并或新增：

```json
{
  "data": {
    "techs": [
      {
        "id": "m7", "line": "military", "name": "新军事科技", "pos": 7,
        "description": "描述", "requires": ["m6"],
        "effect": { "allUnitMult": 0.10 }
      }
    ]
  }
}
```

### 7. equipment（装备）

按装备 ID 为 key 覆盖或新增：

```json
{
  "data": {
    "equipment": {
      "new_weapon": {
        "id": "new_weapon",
        "name": "新武器",
        "slot": "weapon",
        "rarity": "epic",
        "stats": { "force": 10 },
        "description": "描述"
      }
    }
  }
}
```

### 8. formations（阵型）

按阵型 ID 为 key 覆盖或新增。

### 9. buildings（建筑）

按建筑 ID 为 key 覆盖或新增。

### 10. events / historicalEvents（事件）

- `events`：随机事件数组，直接追加
- `historicalEvents`：历史事件数组，按 `id` 匹配合并

### 11. unitTypes / passes / barbarians

分别覆盖/新增兵种、关隘、蛮族部落。

## 加载优先级与冲突

1. 基础数据首先加载
2. 模组按文件名排序依次加载
3. 后加载的模组覆盖先加载的模组的同名数据
4. 在主菜单 → 模组管理 中可启用/禁用模组

## 数值平衡建议

- 武将四维属性总和：名将 400+，普通将 300~350
- 兵种加成：单件不超过 +30%，同类总和经 clampBonus 封顶 +100%
- 传说装备：四维加成不超过基础值的 30%
- 科技加成：单线总加成不超过基础值的 100%
- 战斗总倍率：硬封顶 3.0（300%）

## 测试你的模组

1. 将模组文件放入 `src/mods/`
2. 更新 `src/mods/manifest.json`
3. 启动游戏，在主菜单 → 模组管理 中确认模组已加载
4. 启用模组，开始新游戏验证效果
5. 运行冒烟测试：`npm test`
