import { NextRequest } from 'next/server';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { 
  searchRulebook, 
  searchCombatRules, 
  searchCheckRules,
  searchScenarioModule,
  searchWorldSetting,
  SCENARIO_MODULES
} from '@/lib/rulebook-search';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// AI主持人 - 流式输出
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
    } = await request.json();
    
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const llmClient = new LLMClient(config, customHeaders);

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
    
    // 3. 检测是否需要检定规则
    const checkKeywords = ['检定', '判定', '骰子', '难度', '成功', '失败', '投掷'];
    const needsCheckRules = checkKeywords.some(k => playerAction?.includes(k));
    if (needsCheckRules) {
      console.log('检索检定规则...');
      const checkResult = await searchCheckRules();
      if (checkResult.found) {
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
      };
      attributes?: Record<string, number>;
      weapons?: Array<{ name: string }>;
    }) => {
      const parts = [`【${c.name}】`];
      if (c.title) parts.push(`称号：${c.title}`);
      if (c.race) parts.push(`种族：${c.race}`);
      if (c.occupation) parts.push(`职业：${c.occupation}`);
      
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
      if (c.rider_data?.finisherMoves?.length) {
        parts.push(`必杀技：${c.rider_data.finisherMoves.join('、')}`);
      }
      
      // 武器信息
      if (c.weapons?.length) {
        parts.push(`武器：${c.weapons.map(w => w.name).join('、')}`);
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

## 输出格式
1. 首先用【场景】标记描述开场场景
2. 然后用【角色登场】介绍每个玩家角色是如何出现在这里的
3. 用【事件】描述发生的事情
4. 最后用【可选行动】给出玩家可以采取的行动` :

      // 游戏进行中的提示词
`你是假面骑士TRPG游戏的主持人(DM/地下城主)。

## 核心职责（必须严格遵守！）
1. **严格遵守规则书**：所有判定、属性计算、世界观描述必须基于规则书内容
2. **公正裁决**：当玩家有异议时，引用规则书原文进行解释
3. **叙事生动**：用生动的语言描述场景，营造假面骑士的氛围
4. **鼓励互动**：给予玩家选择和行动的空间
5. **保持连贯**：记住之前的对话内容，保持剧情连贯性

## 当前游戏状态
剧本：${scenarioName || '未设定'}
场景：${currentScene?.location || '未设定'}
${gameState ? `详细状态：${JSON.stringify(gameState, null, 2)}` : ''}

## 玩家角色
${charactersDetailedInfo}

## 对话历史（最近10条）
${dialogHistory?.slice(-10).map((m: { role: string; content: string }) => 
  `${m.role === 'user' ? '玩家' : 'DM'}: ${m.content}`
).join('\n') || '无历史对话'}

## 规则书参考内容
${ruleContext || '暂无相关规则'}

## 可选的剧本模组
${availableScenarios}

## 行为准则
1. **判定规则**：需要检定时，必须：
   - 明确告知检定类型和难度
   - 格式：【检定】需要进行【XX】检定，难度X，请投掷X面骰
   - 根据结果给出合理的剧情发展

2. **战斗规则**：战斗场景必须：
   - 按规则书计算伤害和HP
   - 描述战斗动作要生动
   - 给玩家反击或回避的机会

3. **规则引用**：玩家质疑时必须：
   - 使用【规则书原文】标记引用
   - 清晰解释规则如何适用
   - 如有歧义，可以与玩家讨论

## 输出格式标记
- 【场景】场景描述
- 【NPC名】NPC对话
- 【检定】需要检定的内容
- 【规则书原文】引用规则
- 【战斗】战斗相关
- 【可选行动】玩家可采取的行动`;

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: playerAction || '请开始游戏，根据我的角色背景将我代入剧情' }
    ];

    // 创建流式响应
    const encoder = new TextEncoder();
    
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const llmStream = llmClient.stream(messages, {
            model: 'doubao-seed-1-8-251228',
            temperature: 0.9,
          });

          for await (const chunk of llmStream) {
            if (chunk.content) {
              const text = chunk.content.toString();
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: text })}\n\n`));
            }
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
