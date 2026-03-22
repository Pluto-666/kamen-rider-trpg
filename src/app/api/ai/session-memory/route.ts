import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';

// 游戏会话记忆检索API
// 用于解决长时间游玩后AI遗忘之前内容的问题

interface MemorySearchRequest {
  sessionId: string;
  query: string;
  limit?: number;
}

interface MemorySummaryRequest {
  sessionId: string;
  maxMessages?: number;
}

// 搜索游戏历史记录
export async function POST(request: NextRequest) {
  try {
    const { sessionId, query, limit = 10 }: MemorySearchRequest = await request.json();
    
    const supabase = getSupabaseClient();
    
    // 从session_logs表中检索相关记录
    const { data: logs, error } = await supabase
      .from('session_logs')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(100);
    
    if (error) {
      console.error('检索游戏日志错误:', error);
      return NextResponse.json({ error: '检索失败' }, { status: 500 });
    }
    
    if (!logs || logs.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          memories: [],
          message: '没有找到游戏记录'
        }
      });
    }
    
    // 使用AI筛选与查询相关的记忆
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const llmClient = new LLMClient(config, customHeaders);
    
    // 构建日志文本
    const logText = logs
      .slice(0, 50) // 取最近50条
      .map((log: { role: string; content: string; created_at: string }) => 
        `[${log.created_at}] ${log.role}: ${log.content}`
      )
      .join('\n\n');
    
    const systemPrompt = `你是游戏记忆检索助手。玩家正在询问关于之前游戏内容的问题。

## 玩家问题
${query}

## 游戏历史记录（按时间倒序）
${logText}

## 任务
1. 找出与玩家问题最相关的历史记录片段
2. 如果找到了，返回相关的对话内容
3. 如果没有找到，说明没有相关记录

请用JSON格式返回：
{
  "found": true/false,
  "relevantMemories": [
    {
      "timestamp": "时间",
      "role": "角色",
      "content": "相关内容",
      "relevance": "与问题的相关性说明"
    }
  ],
  "summary": "对相关记忆的简要总结"
}`;

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: query }
    ];

    const response = await llmClient.invoke(messages, {
      model: 'doubao-seed-1-8-251228',
      temperature: 0.3,
    });

    // 解析结果
    let memoryResult = { found: false, relevantMemories: [], summary: '' };
    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        memoryResult = JSON.parse(jsonMatch[0]);
      }
    } catch {
      console.error('解析记忆检索结果失败');
    }

    return NextResponse.json({
      success: true,
      data: memoryResult,
    });
  } catch (error) {
    console.error('记忆检索错误:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// 获取游戏历史摘要（用于上下文压缩）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const maxMessages = parseInt(searchParams.get('maxMessages') || '20');
    
    if (!sessionId) {
      return NextResponse.json({ error: '缺少sessionId' }, { status: 400 });
    }
    
    const supabase = getSupabaseClient();
    
    // 获取所有游戏日志
    const { data: logs, error } = await supabase
      .from('session_logs')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });
    
    if (error) {
      console.error('检索游戏日志错误:', error);
      return NextResponse.json({ error: '检索失败' }, { status: 500 });
    }
    
    if (!logs || logs.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          summary: '无游戏记录',
          keyEvents: [],
          recentMessages: []
        }
      });
    }
    
    // 最近的对话（保持完整）
    const recentMessages = logs.slice(-maxMessages);
    
    // 使用AI生成历史摘要
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const llmClient = new LLMClient(config, customHeaders);
    
    const allLogsText = logs
      .map((log: { role: string; content: string; created_at: string }) => 
        `[${log.created_at}] ${log.role}: ${log.content}`
      )
      .join('\n\n');
    
    const systemPrompt = `你是游戏记录摘要助手。请为以下游戏记录生成简洁的摘要。

## 游戏历史记录
${allLogsText}

## 任务
1. 总结游戏的主要情节发展
2. 提取关键事件和决策点
3. 记录重要的NPC互动
4. 跟踪角色的状态变化

请用JSON格式返回：
{
  "summary": "游戏整体摘要（2-3句话）",
  "keyEvents": [
    {
      "event": "事件描述",
      "outcome": "结果",
      "timestamp": "时间"
    }
  ],
  "importantNPCs": ["重要NPC列表"],
  "playerDecisions": ["玩家做出的重要决定"],
  "currentObjectives": ["当前目标"]
}`;

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: '请生成游戏摘要' }
    ];

    const response = await llmClient.invoke(messages, {
      model: 'doubao-seed-1-8-251228',
      temperature: 0.3,
    });

    // 解析结果
    let summaryResult = {
      summary: '',
      keyEvents: [],
      importantNPCs: [],
      playerDecisions: [],
      currentObjectives: []
    };
    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        summaryResult = JSON.parse(jsonMatch[0]);
      }
    } catch {
      console.error('解析摘要结果失败');
    }

    return NextResponse.json({
      success: true,
      data: {
        ...summaryResult,
        recentMessages: recentMessages.map((log: { role: string; content: string }) => ({
          role: log.role,
          content: log.content
        })),
        totalMessages: logs.length
      },
    });
  } catch (error) {
    console.error('摘要生成错误:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
