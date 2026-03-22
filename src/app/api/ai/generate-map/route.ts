import { NextRequest, NextResponse } from 'next/server';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { searchRulebook } from '@/lib/rulebook-search';

interface MapGenerationRequest {
  sceneType: 'battle' | 'exploration' | 'event';
  location: string;
  enemies?: Array<{ name: string; position?: string }>;
  players?: Array<{ name: string }>;
  description?: string;
  mapStyle?: '2d' | '3d';
}

// 地图生成API
export async function POST(request: NextRequest) {
  try {
    const { 
      sceneType,
      location,
      enemies = [],
      players = [],
      description,
      mapStyle = '2d'
    }: MapGenerationRequest = await request.json();
    
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const llmClient = new LLMClient(config, customHeaders);

    // 检索相关场景的规则书内容
    const locationResult = await searchRulebook(`${location} 场景 环境`);
    const combatResult = sceneType === 'battle' 
      ? await searchRulebook('战斗 地图 位置') 
      : null;

    const systemPrompt = `你是假面骑士TRPG游戏的地图生成助手。

## 任务
根据场景信息生成一个游戏地图描述。

## 场景信息
- 类型：${sceneType === 'battle' ? '战斗场景' : sceneType === 'exploration' ? '探索场景' : '事件场景'}
- 地点：${location}
- 描述：${description || '无额外描述'}
- 敌人：${enemies.length > 0 ? enemies.map(e => e.name).join('、') : '无'}
- 玩家：${players.length > 0 ? players.map(p => p.name).join('、') : '无'}

## 规则书参考
${locationResult.found ? locationResult.content : ''}
${combatResult?.found ? combatResult.content : ''}

## 地图要求
${mapStyle === '2d' ? `
生成一个ASCII风格的2D地图：
- 使用字符表示不同元素（墙、门、玩家、敌人等）
- 每个格子用2个字符宽度
- 图例说明各符号含义
` : `
生成一个立体地图的文字描述：
- 描述空间的高度层次
- 描述各区域之间的连接关系
- 描述重要物品和NPC的位置
`}

## 输出格式（JSON）
{
  "mapData": {
    "ascii": "ASCII地图字符串（如果是2D）",
    "spatial": "立体空间描述（如果是3D）",
    "legend": {
      "符号": "含义"
    },
    "dimensions": {
      "width": 宽度,
      "height": 高度
    },
    "zones": [
      {
        "name": "区域名称",
        "description": "区域描述",
        "connections": ["连接的其他区域"],
        "features": ["特殊特征"]
      }
    ],
    "enemyPlacements": [
      {
        "enemy": "敌人名称",
        "position": "位置描述"
      }
    ],
    "playerStartPositions": [
      {
        "player": "玩家名称",
        "suggestedPosition": "建议起始位置"
      }
    ]
  },
  "narrativeDescription": "场景的叙事描述"
}`;

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: `请生成${location}的${sceneType === 'battle' ? '战斗' : ''}地图` }
    ];

    const response = await llmClient.invoke(messages, {
      model: 'doubao-seed-1-8-251228',
      temperature: 0.7,
    });

    // 解析JSON
    let mapData = null;
    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        mapData = JSON.parse(jsonMatch[0]);
      }
    } catch {
      console.error('解析地图JSON失败');
    }

    return NextResponse.json({
      success: true,
      data: {
        mapData,
        rawResponse: response.content,
      },
    });
  } catch (error) {
    console.error('地图生成错误:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
