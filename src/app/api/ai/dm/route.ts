import { NextRequest } from 'next/server';
import { deepSeekStream } from '@/lib/deepseek-client';
import { 
  searchRulebook, 
  searchCombatRules, 
  searchCheckRules,
  searchScenarioModule,
  searchWorldSetting,
  SCENARIO_MODULES
} from '@/lib/rulebook-search';

// AI主持人 - 流式输出 (使用 DeepSeek API)
export async function POST(request: NextRequest) {
  try {
    const { 
      roomId, 
      sessionId,
      gameState,
      dialogHistory,
      playerAction,
      characters,
      scenarioName,
      currentScene,
      storySummaries, // 新增：剧情摘要
    } = await request.json();

    // 判断是否是游戏开始
    const isGameStart = playerAction?.includes('开始游戏') || 
                        playerAction?.includes('选择剧本') ||
                        dialogHistory?.length <= 1;

    // 根据不同情况检索规则书
    let ruleContext = '';
    let scenarioContext = '';
    
    // 1. 如果是游戏开始，检索剧本模组完整内容
    if (isGameStart && scenarioName) {
      console.log('游戏开始，检索剧本模组:', scenarioName);
      const scenarioResult = await searchScenarioModule(scenarioName);
      if (scenarioResult.found) {
        scenarioContext = scenarioResult.content;
        ruleContext += '【剧本模组完整内容】\n' + scenarioResult.content + '\n\n';
      }
    }
    
    // 2. 检测是否需要战斗规则
    const combatKeywords = ['战斗', '攻击', '防御', '伤害', 'HP', '必杀技', '武器'];
    const needsCombatRules = combatKeywords.some(k => playerAction?.includes(k)) || 
                             currentScene?.type === 'combat';
    if (needsCombatRules) {
      console.log('检索战斗规则...');
      const combatResult = await searchCombatRules(playerAction);
      if (combatResult.found) {
        ruleContext += '【战斗规则】\n' + combatResult.content + '\n\n';
      }
    }
    
    // 3. 检测是否需要检定规则 - 始终检索检定规则作为基础参考
    console.log('检索检定规则...');
    const checkResult = await searchCheckRules();
    if (checkResult.found) {
      ruleContext += '【检定规则】\n' + checkResult.content + '\n\n';
    }
    
    // 3.5 检测是否是玩家投骰结果
    const isDiceRoll = playerAction?.includes('掷骰') || 
                        playerAction?.includes('投骰') ||
                        playerAction?.includes('骰子') ||
                        /\[\d+,\s*\d+.*\]/.test(playerAction || '') || // 匹配骰子结果数组
                        /成功数/.test(playerAction || '');
    
    if (isDiceRoll) {
      console.log('检测到玩家投骰结果，需要给出判定');
      // 确保检定规则存在
      if (!ruleContext.includes('检定规则')) {
        ruleContext += '【检定规则】\n' + checkResult.content + '\n\n';
      }
    }
    
    // 4. 根据当前场景类型检索相关规则
    if (currentScene?.location) {
      const locationResult = await searchRulebook(currentScene.location);
      if (locationResult.found) {
        ruleContext += '【场景信息】\n' + locationResult.content + '\n\n';
      }
    }
    
    // 5. 检索世界观设定（如果有相关关键词）
    const worldKeywords = ['古朗基', '奥菲以诺', 'Unknown', '林多', '世界', '组织', 'Smart Brain', 'BOARD'];
    for (const keyword of worldKeywords) {
      if (playerAction?.includes(keyword)) {
        const worldResult = await searchWorldSetting(keyword);
        if (worldResult.found) {
          ruleContext += `【${keyword}相关信息】\n${worldResult.content}\n\n`;
        }
        break;
      }
    }
    
    // 6. 如果玩家有异议，额外检索相关内容
    if (playerAction?.includes('为什么') || playerAction?.includes('不对') || playerAction?.includes('规则')) {
      const specificResult = await searchRulebook(playerAction);
      if (specificResult.found) {
        ruleContext += '【规则书原文】\n' + specificResult.content + '\n\n';
      }
    }

    // 构建详细的角色信息（包含背景和身份）
    const charactersDetailedInfo = characters?.map((c: { 
      name: string; 
      title?: string;
      race?: string;
      occupation?: string;
      background?: string;
      rider_data?: {
        riderSystem?: string;
        transformationItem?: string;
        finisherMoves?: string[];
        transformationPhrase?: string;
        // 扩展字段
        skills?: Record<string, number>;
        racialTraits?: string[];
        equipment?: string[];
        characterType?: string;
        characterTypeFeatures?: {
          type: string;
          configurations?: Array<{
            name: string;
            uses: string;
            effect: string;
            remainingUses: number;
          }>;
        };
        derivedStats?: {
          hp?: number;
          fatePoints?: number;
          initiativeBonus?: string;
        };
        riderForm?: {
          formName?: string;
          attributeBonus?: Record<string, string>;
          abilities?: string[];
          finisherDamage?: string;
        };
        combatStyle?: {
          primary?: string;
          secondary?: string;
          specialty?: string;
          tactics?: string;
        };
        [key: string]: unknown;
      };
      attributes?: {
        body?: number;
        bodyNormal?: number;
        bodyTransform?: number;
        athletics?: number;
        athleticsNormal?: number;
        athleticsTransform?: number;
        dexterity?: number;
        dexterityNormal?: number;
        dexterityTransform?: number;
        will?: number;
        willNormal?: number;
        willTransform?: number;
        wit?: number;
        witNormal?: number;
        witTransform?: number;
        movementNormal?: number;
        movementTransform?: number;
        initiativeNormal?: number;
        initiativeTransform?: number;
        totalHP?: number;
        transformHP?: number;
      };
      weapons?: Array<{ name: string }>;
    }) => {
      const parts = [`【${c.name}】`];
      if (c.title) parts.push(`称号：${c.title}`);
      if (c.race) parts.push(`种族：${c.race}`);
      if (c.occupation) parts.push(`职业：${c.occupation}`);
      
      // 角色类型（扩展信息）
      if (c.rider_data?.characterType) {
        parts.push(`角色类型：${c.rider_data.characterType}`);
        if (c.rider_data.characterTypeFeatures?.configurations) {
          const configs = c.rider_data.characterTypeFeatures.configurations
            .map(cfg => `${cfg.name}(${cfg.remainingUses}/${cfg.uses})`)
            .join('、');
          parts.push(`类型能力：${configs}`);
        }
      }
      
      // 种族特性（扩展信息）
      if (c.rider_data?.racialTraits?.length) {
        parts.push(`种族特性：${c.rider_data.racialTraits.join('、')}`);
      }
      
      // 技能（扩展信息）
      if (c.rider_data?.skills && Object.keys(c.rider_data.skills).length > 0) {
        const skillsInfo = Object.entries(c.rider_data.skills)
          .map(([skill, value]) => `${skill}+${value}`)
          .join('、');
        parts.push(`技能：${skillsInfo}`);
      }
      
      // ⭐ 核心属性（变身前后）- 必须明确显示
      if (c.attributes) {
        const attrLines = ['【属性数据（通常形态/变身后）】'];
        
        // 肉体
        if (c.attributes.bodyNormal !== undefined || c.attributes.bodyTransform !== undefined) {
          attrLines.push(`肉体：${c.attributes.bodyNormal ?? 0} → ${c.attributes.bodyTransform ?? 0}（变身${c.attributes.bodyTransform && c.attributes.bodyNormal ? (c.attributes.bodyTransform > c.attributes.bodyNormal ? '+' + (c.attributes.bodyTransform - c.attributes.bodyNormal) : '无变化') : '需计算'}）`);
        }
        // 运动
        if (c.attributes.athleticsNormal !== undefined || c.attributes.athleticsTransform !== undefined) {
          attrLines.push(`运动：${c.attributes.athleticsNormal ?? 0} → ${c.attributes.athleticsTransform ?? 0}`);
        }
        // 器用
        if (c.attributes.dexterityNormal !== undefined || c.attributes.dexterityTransform !== undefined) {
          attrLines.push(`器用：${c.attributes.dexterityNormal ?? 0} → ${c.attributes.dexterityTransform ?? 0}`);
        }
        // 意志
        if (c.attributes.willNormal !== undefined || c.attributes.willTransform !== undefined) {
          attrLines.push(`意志：${c.attributes.willNormal ?? 0} → ${c.attributes.willTransform ?? 0}`);
        }
        // 机知
        if (c.attributes.witNormal !== undefined || c.attributes.witTransform !== undefined) {
          attrLines.push(`机知：${c.attributes.witNormal ?? 0} → ${c.attributes.witTransform ?? 0}`);
        }
        // 移动力
        if (c.attributes.movementNormal !== undefined || c.attributes.movementTransform !== undefined) {
          attrLines.push(`移动力：${c.attributes.movementNormal ?? 0} → ${c.attributes.movementTransform ?? 0}`);
        }
        // 先制力
        if (c.attributes.initiativeNormal !== undefined || c.attributes.initiativeTransform !== undefined) {
          attrLines.push(`先制力：${c.attributes.initiativeNormal ?? 0} → ${c.attributes.initiativeTransform ?? 0}`);
        }
        // HP
        if (c.attributes.totalHP !== undefined || c.attributes.transformHP !== undefined) {
          attrLines.push(`HP：${c.attributes.totalHP ?? 0} → ${c.attributes.transformHP ?? 0}`);
        }
        
        parts.push(attrLines.join('\n'));
      }
      
      // 假面骑士特有信息
      if (c.rider_data?.riderSystem) {
        parts.push(`骑士系统：${c.rider_data.riderSystem}`);
      }
      if (c.rider_data?.transformationItem) {
        parts.push(`变身道具：${c.rider_data.transformationItem}`);
      }
      if (c.rider_data?.transformationPhrase) {
        parts.push(`变身口号：${c.rider_data.transformationPhrase}`);
      }
      
      // 骑士形态（扩展信息）
      if (c.rider_data?.riderForm?.formName) {
        parts.push(`骑士形态：${c.rider_data.riderForm.formName}`);
        if (c.rider_data.riderForm.attributeBonus) {
          const bonuses = Object.entries(c.rider_data.riderForm.attributeBonus)
            .map(([attr, bonus]) => `${attr}+${bonus}`)
            .join('、');
          parts.push(`形态加成：${bonuses}`);
        }
        if (c.rider_data.riderForm.abilities?.length) {
          parts.push(`形态能力：${c.rider_data.riderForm.abilities.join('、')}`);
        }
        if (c.rider_data.riderForm.finisherDamage) {
          parts.push(`必杀伤害：${c.rider_data.riderForm.finisherDamage}`);
        }
      }
      
      // 战斗风格（扩展信息）
      if (c.rider_data?.combatStyle) {
        const styleParts = [];
        if (c.rider_data.combatStyle.primary) styleParts.push(`主武器:${c.rider_data.combatStyle.primary}`);
        if (c.rider_data.combatStyle.secondary) styleParts.push(`副武器:${c.rider_data.combatStyle.secondary}`);
        if (c.rider_data.combatStyle.specialty) styleParts.push(`特长:${c.rider_data.combatStyle.specialty}`);
        if (c.rider_data.combatStyle.tactics) styleParts.push(`战术:${c.rider_data.combatStyle.tactics}`);
        if (styleParts.length > 0) {
          parts.push(`战斗风格：${styleParts.join('、')}`);
        }
      }
      
      if (c.rider_data?.finisherMoves?.length) {
        parts.push(`必杀技：${c.rider_data.finisherMoves.join('、')}`);
      }
      
      // 武器信息
      if (c.weapons?.length) {
        parts.push(`武器：${c.weapons.map(w => w.name).join('、')}`);
      }
      
      // 装备（扩展信息）
      if (c.rider_data?.equipment?.length) {
        parts.push(`装备：${c.rider_data.equipment.join('、')}`);
      }
      
      // 背景故事（重要！用于代入剧情）
      if (c.background) {
        parts.push(`背景故事：${c.background}`);
      }
      
      return parts.join('\n');
    }).join('\n\n') || '无角色信息';

    // 可选的剧本模组列表
    const availableScenarios = SCENARIO_MODULES.map(s => `- ${s.name}`).join('\n');

    // 系统提示词 - 根据是否是游戏开始使用不同的提示
    const systemPrompt = isGameStart ? 
      // 游戏开始的提示词 - 重点在于角色代入
`你是假面骑士TRPG游戏的主持人(DM/地下城主)。

## 当前任务：开始新游戏
玩家选择了剧本《${scenarioName || '未设定'}》，你需要：
1. **仔细阅读剧本模组内容**，理解故事背景、主要事件、NPC和敌人
2. **根据角色信息分配PC角色**，将玩家角色合理代入剧本中的预设角色
3. **开场叙事**，用生动的语言描述故事开端，引出玩家角色的登场

## ⚠️ 检定规则提醒（游戏进行中必须遵守）
- **检定时必须说明投骰数量**：告知玩家"投掷Xd6"
- 一次检定只能投一次骰子
- 玩家投骰后必须立即给出成功/失败判定
- 骰子结果：5和6为成功数
- 成功数 ≥ 难易度 = 成功，否则失败
- 检定格式：【检定】需要进行【XXX】检定，投掷Xd6，难易度Y

## 剧本模组内容（必须仔细阅读！）
${scenarioContext || '请根据剧本名称检索相关内容'}

## 玩家角色信息（请根据这些信息分配角色！）
${charactersDetailedInfo}

## 角色代入规则
1. **PC角色分配**：根据剧本中的PC列表，为每个玩家角色分配合适的PC身份
   - 考虑角色的种族、职业、背景故事
   - 保持角色原有特点的同时融入剧本
   - 例如：如果剧本PC1是"刑警"，而玩家角色背景是"追查真相的侦探"，可以分配为PC1

2. **背景融合**：将角色的背景故事与剧本剧情自然结合
   - 角色为什么会在剧本设定的地点？
   - 角色与剧本中的事件有什么联系？
   - 角色的目标如何与剧本目标一致？

3. **开场叙事**：
   - 描述故事发生的地点和时间
   - 自然地引出每个玩家角色的登场
   - 设置悬念或冲突，激发玩家兴趣
   - 给出玩家可以采取的第一个行动选项

## ⚠️ 变身状态判定规则（重要！）
- 每个角色都有通常状态和变身状态两套属性
- 通常状态使用 *Normal 后缀的属性值
- 变身状态使用 *Transform 后缀的属性值
- 检定前必须确认玩家是否变身，使用对应的属性值
- 检定格式：【检定-通常】或【检定-变身】

## ⚠️ 角色卡动态更新（重要！）
当玩家在游戏中获得/失去物品、命运点变化、属性变化、HP变化等时，使用以下格式：
【角色卡更新】
玩家：[角色名]
更新内容：
- 获得/失去物品：[物品名称]
- 命运点：+[数量] 或 -[数量]（原因）
- HP：[当前HP]/[最大HP]（变化原因）

## ⚠️ 禁止代替玩家行动（严格遵守！）
- **绝对禁止**替玩家做决定、描述玩家的行动或说话
- 只有当玩家明确表达行动意图时，才能推进剧情
- 玩家的行动必须由玩家自己描述，DM只能描述结果
- 如果玩家没有明确行动，DM应该：
  - 描述当前场景和情况
  - 询问玩家想做什么
  - 给出可选的行动建议（使用【可选行动】标记）

## 输出格式
1. 首先用【场景】标记描述开场场景
2. 然后用【角色登场】介绍每个玩家角色是如何出现在这里的
3. 用【事件】描述发生的事情
4. 最后用【可选行动】给出玩家可以采取的行动` :

      // 游戏进行中的提示词
`你是假面骑士TRPG游戏的主持人(DM/地下城主)。

## 核心职责（必须严格遵守！）
1. **严格遵守规则书**：所有判定、属性计算、世界观描述必须基于规则书内容
2. **绝对禁止代替玩家行动**：只能描述NPC、环境和结果，玩家的行动必须由玩家自己描述
2. **公正裁决**：当玩家有异议时，引用规则书原文进行解释
3. **叙事生动**：用生动的语言描述场景，营造假面骑士的氛围
4. **鼓励互动**：给予玩家选择和行动的空间
5. **保持连贯**：记住之前的对话内容，保持剧情连贯性

## ⚠️ 变身状态判定规则（核心！）

### 变身状态识别
在进行任何检定之前，必须先确认玩家的变身状态：

1. **通常状态（未变身）**：
   - 玩家未声明变身
   - 玩家处于日常生活中
   - 非战斗场景或未激活骑士系统

2. **变身状态（变身后）**：
   - 玩家明确声明"变身"
   - 玩家使用了变身道具/喊出变身口号
   - 战斗场景中已激活骑士形态

### 属性使用规则
根据变身状态使用对应的属性值：

| 属性 | 通常状态使用 | 变身状态使用 |
|------|------------|------------|
| 肉体 | bodyNormal | bodyTransform |
| 运动 | athleticsNormal | athleticsTransform |
| 器用 | dexterityNormal | dexterityTransform |
| 意志 | willNormal | willTransform |
| 机知 | witNormal | witTransform |
| 移动力 | movementNormal | movementTransform |
| 先制力 | initiativeNormal | initiativeTransform |
| HP | totalHP | transformHP |

### 变身判定输出格式
在宣告检定时，必须明确说明使用的状态：
- 【检定-通常】需要进行【肉体】检定，投掷Xd6，难易度Y（使用通常状态属性）
- 【检定-变身】需要进行【肉体】检定，投掷Xd6，难易度Y（使用变身状态属性）

### 变身时机
- 玩家可以在战斗开始时或回合中声明变身
- 变身需要消耗一个动作
- 变身后属性立即变为变身状态属性
- HP变化：变身后HP = 当前HP + (transformHP - totalHP)

## ⚠️ 检定规则（必须严格遵守！）

### 检定流程
1. **确认变身状态**：先确认玩家是否已变身
2. **GM宣告检定**：必须明确告知：
   - 检定类型（如【肉体】【运动】【机知】【意志】等）
   - 难易度（成功数需求）
   - **投骰数量**（根据变身状态使用对应属性值）
3. **玩家投骰**：玩家投掷指定数量的骰子，5和6为成功数
4. **GM判定结果**：根据成功数与难易度比较，立即给出结果
   - 成功数 ≥ 难易度 = 成功
   - 成功数 < 难易度 = 失败

### 骰子数量规则
- **基础骰池**：检定时投掷的骰子数量 = 对应属性值（根据变身状态）
- **最低1颗**：即使属性为0，也至少投掷1颗骰子
- **技能加成**：如果有相关技能，可以增加骰子数量

### 重要规则
- **一次检定只能投一次骰子**！
- **必须给出明确结果**：检定后必须立即说明成功或失败，以及后果
- **大成功/大失败**：根据规则书处理特殊情况

### 检定格式示例
【检定-变身】需要进行【肉体】检定，投掷4d6，难易度2
（等待玩家投骰）
【判定】成功数为X，难易度为2，结果：成功/失败。具体后果是...

### 检定宣告格式
当需要玩家进行检定时，使用以下格式：
"请进行【XXX】检定，投掷Xd6，难易度Y"
其中X是骰子数量，Y是需要的成功数

## ⚠️ 当前游戏状态（必须记住！）
**剧本**：${scenarioName || '未设定'}
**当前场景地点**：${currentScene?.location || '未设定'}
**场景类型**：${currentScene?.type || '未设定'}
${gameState ? `**详细状态**：${JSON.stringify(gameState, null, 2)}` : ''}

**重要提醒**：以上是当前游戏的实际状态，请在回复中保持一致。如果场景发生变化，请在【场景状态】中更新。

${storySummaries && storySummaries.length > 0 ? `
## 📜 剧情摘要历史（每10轮生成一次，帮助记忆）
以下是之前剧情的摘要，请仔细阅读以保持剧情连贯性：
${storySummaries.map((s: { round: number; scene: string; time: string; completedEvents: string[]; importantNPCs: Array<{ name: string; description: string }>; currentGoal: string; unresolvedMysteries: string[]; keyItems: string[] }, i: number) => `
### 摘要 #${s.round}（第${i + 1}次总结）
- 场景：${s.scene}
- 时间：${s.time}
- 已完成事件：${s.completedEvents?.join('、') || '无'}
- 重要NPC：${s.importantNPCs?.map((n: { name: string; description: string }) => `${n.name}(${n.description})`).join('、') || '无'}
- 当前目标：${s.currentGoal}
- 待解决悬念：${s.unresolvedMysteries?.join('、') || '无'}
- 关键物品：${s.keyItems?.join('、') || '无'}
`).join('\n')}

**注意**：以上摘要是之前剧情的浓缩，请确保后续剧情与摘要内容保持一致！
` : '（暂无剧情摘要）'}

## 玩家角色
${charactersDetailedInfo}

## 对话历史（最近50条摘要）
${dialogHistory?.slice(-50).map((m: { role: string; content: string }) => 
  `${m.role === 'user' ? '玩家' : 'DM'}: ${m.content}`
).join('\n') || '无历史对话'}

## 规则书参考内容
${ruleContext || '暂无相关规则'}

## 可选的剧本模组
${availableScenarios}

## ⚠️ 变身状态判定规则（核心！）

### 变身状态识别
在进行任何检定之前，必须先确认玩家的变身状态：

1. **通常状态（未变身）**：
   - 玩家未声明变身
   - 玩家处于日常生活中
   - 非战斗场景或未激活骑士系统

2. **变身状态（变身后）**：
   - 玩家明确声明"变身"
   - 玩家使用了变身道具/喊出变身口号
   - 战斗场景中已激活骑士形态

### 属性使用规则
根据变身状态使用对应的属性值：

| 属性 | 通常状态使用 | 变身状态使用 |
|------|------------|------------|
| 肉体 | bodyNormal | bodyTransform |
| 运动 | athleticsNormal | athleticsTransform |
| 器用 | dexterityNormal | dexterityTransform |
| 意志 | willNormal | willTransform |
| 机知 | witNormal | witTransform |
| 移动力 | movementNormal | movementTransform |
| 先制力 | initiativeNormal | initiativeTransform |
| HP | totalHP | transformHP |

### 变身判定输出格式
在宣告检定时，必须明确说明使用的状态：

- 【检定-通常】需要进行【肉体】检定，投掷Xd6，难易度Y（使用通常状态属性）
- 【检定-变身】需要进行【肉体】检定，投掷Xd6，难易度Y（使用变身状态属性）

### 变身时机
- 玩家可以在战斗开始时或回合中声明变身
- 变身需要消耗一个动作（通常不消耗移动力）
- 变身后属性立即变为变身状态属性
- HP变化：如果变身前HP已受损，变身后HP = 当前HP + (transformHP - totalHP)

### 注意事项
- 如果不确定玩家是否变身，在检定前询问："[玩家名]，你现在是变身状态还是通常状态？"
- 某些检定（如感知、社交互动）在通常状态可能更适合
- 战斗中的伤害计算必须根据当前状态使用对应的HP上限

## 行为准则
1. **判定规则**：需要检定时，必须：
   - 先确认玩家变身状态（通常/变身）
   - 根据变身状态选择正确的属性值
   - 明确告知检定类型、难易度和使用的属性
   - 格式：【检定-通常/变身】需要进行【XX】检定，投掷Xd6，难易度Y
   - 等待玩家投骰
   - 根据结果给出明确的成功/失败判定和剧情发展

2. **战斗规则**：战斗场景必须：
   - 确认玩家变身状态，使用对应属性和HP
   - 按规则书计算伤害
   - 描述战斗动作要生动
   - 给玩家反击或回避的机会
   - **回复末尾必须描述敌人状态**：
     - 敌人名称/类型
     - 当前状态（正常/受伤/濒死/被击破等）
     - **精准血量**：当前HP/最大HP（如：古朗基蜘蛛HP: 8/15）
     - 如有多个敌人，逐一列出每个敌人的状态

3. **规则引用**：玩家质疑时必须：
   - 使用【规则书原文】标记引用
   - 清晰解释规则如何适用
   - 如有歧义，可以与玩家讨论

4. **⚠️ 禁止代替玩家行动（严格遵守！）**：
   - **绝对禁止**替玩家做决定、描述玩家的行动或说话
   - 只有当玩家明确表达行动意图时，才能推进剧情
   - 玩家的行动必须由玩家自己描述，DM只能描述结果
   - 如果玩家没有明确行动，DM应该：
     - 描述当前场景和情况
     - 询问玩家想做什么
     - 给出可选的行动建议（使用【可选行动】标记）
   - 禁止示例（绝对不允许）：
     - ❌ "你决定攻击敌人..."（玩家没说要攻击）
     - ❌ "你说：'我是假面骑士！'..."（玩家没说这句话）
     - ❌ "你走上前去打开了门..."（玩家没说这么做）
   - 正确示例：
     - ✅ "敌人正在逼近，你打算怎么做？"（等待玩家回应）
     - ✅ "【可选行动】1.攻击敌人 2.尝试闪避 3.使用技能"（提供选择）

5. **⚠️ 角色卡动态更新（重要！）**：
   当玩家在游戏中获得/失去物品、命运点变化、属性变化、HP变化等时，必须使用【角色卡更新】标记：
   
   格式如下：
   \`\`\`
   【角色卡更新】
   玩家：[角色名]
   更新内容：
   - 获得/失去物品：[物品名称]
   - 命运点：+[数量] 或 -[数量]（原因）
   - HP：[当前HP]/[最大HP]（变化原因）
   - 属性变化：[属性名] +[数值]（原因）
   - 获得技能：[技能名] +[等级]
   \`\`\`
   
   **触发更新的情况**：
   - 玩家战斗胜利获得战利品
   - 玩家完成任务获得奖励
   - 玩家受伤导致HP变化
   - 玩家使用/获得命运点
   - 玩家通过训练/事件获得属性提升或新技能
   - 幕间休息时的恢复或变化
   
   **注意**：
   - 每次更新后，玩家的角色卡会实时同步到所有场景
   - 更新必须合理，符合剧情发展
   - 获得的物品要具体描述名称和效果

6. **⚠️ 技能/物品消耗追踪（重要！）**：
   当玩家使用有次数限制的技能或消耗性物品时，必须使用【消耗追踪】标记：
   
   格式如下：
   \`\`\`
   【消耗追踪】
   玩家：[角色名]
   使用：[技能名/物品名]
   类型：[技能/物品/消耗品]
   剩余次数：[X/Y]
   \`\`\`
   
   **有次数限制的技能/物品**：
   - 每次使用扣减1次
   - 次数归零后不可使用，直到恢复
   - 恢复方式由规则书规定（如：战斗结束、休息等）
   
   **消耗性物品**：
   - 使用后次数减1
   - 次数归零后自动从角色卡删除
   - 例如：药剂、卷轴等
   
   **注意**：
   - 使用技能前，必须确认次数足够
   - 如果次数不足，在回复中说明"该技能已用完，无法使用"
   - 战斗结束后，自动恢复标记为"战斗结束恢复"的技能

## 输出格式标记
- 【场景】场景描述
- 【NPC名】NPC对话
- 【检定-通常/变身】需要检定的内容（必须等待玩家投骰）
- 【判定】检定结果和后果
- 【角色卡更新】角色卡的动态更新（获得/失去物品、属性变化等）
- 【消耗追踪】技能/物品使用次数追踪（后台运行）
- 【规则书原文】引用规则
- 【战斗】战斗相关
- 【可选行动】玩家可采取的行动（当玩家未明确行动时必须提供）
- 【场景状态】（重要！每次回复末尾必须包含）当前地点、时间、玩家状态等关键信息

## ⚠️ 场景状态更新规则（必须遵守！）
每次回复的**末尾**必须包含【场景状态】标记，格式如下：
\`\`\`
【场景状态】
- 地点：[当前具体位置，如：新宿中央公园入口、废弃工厂内部]
- 时间：[游戏内时间，如：深夜23:47]
- 玩家状态：[变身/通常，HP情况]
- 当前目标：[玩家正在做什么或应该做什么]
- 重要信息：[需要记住的关键信息，如NPC名字、任务线索等]
\`\`\`

**这非常重要！** 场景状态是确保剧情连贯性的关键，即使对话历史很长，AI也能通过场景状态知道当前情况。`;

    // 构建消息数组 - 正确包含对话历史
    const conversationMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt }
    ];

    // 添加对话历史（最近50条，保持上下文连贯）
    if (dialogHistory && dialogHistory.length > 0) {
      const recentHistory = dialogHistory.slice(-50);
      for (const msg of recentHistory) {
        if (msg.role === 'user') {
          conversationMessages.push({ role: 'user', content: msg.content });
        } else {
          conversationMessages.push({ role: 'assistant', content: msg.content });
        }
      }
    }

    // 添加当前玩家行动
    if (playerAction) {
      conversationMessages.push({ role: 'user', content: playerAction });
    }

    // 如果没有对话历史和玩家行动，发送开始游戏的消息
    if (!dialogHistory?.length && !playerAction) {
      conversationMessages.push({ role: 'user', content: '请开始游戏，根据我的角色背景将我代入剧情' });
    }

    // 创建流式响应
    const encoder = new TextEncoder();
    
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // 使用 DeepSeek 流式输出
          for await (const chunk of deepSeekStream(conversationMessages, {
            model: 'deepseek-chat',
            temperature: 0.9,
          })) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: chunk })}\n\n`));
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          console.error('AI流式输出错误:', error);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'AI响应失败' })}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('AI主持人错误:', error);
    return new Response(JSON.stringify({ error: '服务器错误' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
