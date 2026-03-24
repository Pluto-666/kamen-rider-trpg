import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

/**
 * 角色卡增量更新 API
 * 用于游戏中实时更新角色卡数据
 * 
 * 支持的更新类型：
 * - addItem: 添加物品/装备
 * - removeItem: 移除物品/装备
 * - addFatePoint: 增加命运点
 * - useFatePoint: 消耗命运点
 * - modifyHP: 修改HP
 * - modifyAttribute: 修改属性
 * - addExperience: 增加经验
 * - addGold: 增加/减少金钱
 * - setNote: 添加备注
 */

interface UpdateRequest {
  updates: Array<{
    type: 'addItem' | 'removeItem' | 'addFatePoint' | 'useFatePoint' | 'modifyHP' | 'modifyAttribute' | 'addEquipment' | 'removeEquipment' | 'addSkill' | 'setNote' | 'addExperience';
    data: Record<string, unknown>;
    reason?: string; // 更新原因（用于日志）
  }>;
  sessionId?: string; // 游戏会话ID（可选，用于追踪）
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: characterId } = await params;
    const body: UpdateRequest = await request.json();
    const { updates, sessionId } = body;

    if (!updates || updates.length === 0) {
      return NextResponse.json({ error: '没有更新内容' }, { status: 400 });
    }

    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const supabase = getSupabaseClient(token);

    // 获取当前角色卡数据
    const { data: character, error: fetchError } = await supabase
      .from('characters')
      .select('*')
      .eq('id', characterId)
      .single();

    if (fetchError || !character) {
      return NextResponse.json({ error: '角色不存在' }, { status: 404 });
    }

    // 更新日志
    const updateLog: Array<{ type: string; change: string; time: string }> = [];

    // 处理每个更新
    for (const update of updates) {
      switch (update.type) {
        case 'addItem':
        case 'addEquipment': {
          const item = update.data as { name: string; description?: string; type?: string };
          const currentItems = character.other_equipment || '';
          const newItem = item.description ? `${item.name}(${item.description})` : item.name;
          character.other_equipment = currentItems ? `${currentItems}\n${newItem}` : newItem;
          updateLog.push({ type: '获得物品', change: newItem, time: new Date().toISOString() });
          break;
        }

        case 'removeItem':
        case 'removeEquipment': {
          const item = update.data as { name: string };
          const currentItems = character.other_equipment || '';
          character.other_equipment = currentItems.replace(new RegExp(item.name + '(\\([^)]*\\))?', 'g'), '').replace(/\n+/g, '\n').trim();
          updateLog.push({ type: '失去物品', change: item.name, time: new Date().toISOString() });
          break;
        }

        case 'addFatePoint': {
          const data = update.data as { amount: number; reason?: string };
          const currentFP = character.fate_points || { points: 0, history: [] };
          currentFP.points = (currentFP.points || 0) + data.amount;
          currentFP.history = [
            ...(currentFP.history || []),
            { change: data.amount, reason: data.reason || '获得命运点', time: new Date().toISOString() }
          ];
          character.fate_points = currentFP;
          updateLog.push({ type: '命运点', change: `+${data.amount}`, time: new Date().toISOString() });
          break;
        }

        case 'useFatePoint': {
          const data = update.data as { amount: number; reason?: string };
          const currentFP = character.fate_points || { points: 0, history: [] };
          currentFP.points = Math.max(0, (currentFP.points || 0) - data.amount);
          currentFP.history = [
            ...(currentFP.history || []),
            { change: -data.amount, reason: data.reason || '使用命运点', time: new Date().toISOString() }
          ];
          character.fate_points = currentFP;
          updateLog.push({ type: '命运点', change: `-${data.amount}`, time: new Date().toISOString() });
          break;
        }

        case 'modifyHP': {
          const data = update.data as { change: number; currentHP?: number; maxHP?: number };
          const currentAttrs = character.attributes || {};
          if (data.currentHP !== undefined) {
            currentAttrs.currentHP = data.currentHP;
          } else if (data.change !== undefined) {
            currentAttrs.currentHP = Math.max(0, (currentAttrs.currentHP || currentAttrs.totalHP || 20) + data.change);
          }
          character.attributes = currentAttrs;
          updateLog.push({ type: 'HP变化', change: String(data.change || data.currentHP), time: new Date().toISOString() });
          break;
        }

        case 'modifyAttribute': {
          const data = update.data as { attribute: string; change: number };
          const currentAttrs = character.attributes || {};
          const attrName = data.attribute;
          if (currentAttrs[attrName] !== undefined) {
            currentAttrs[attrName] = (currentAttrs[attrName] || 0) + data.change;
            // 同时更新对应的Normal值
            const normalAttr = attrName + 'Normal';
            if (currentAttrs[normalAttr] !== undefined) {
              currentAttrs[normalAttr] = (currentAttrs[normalAttr] || 0) + data.change;
            }
          }
          character.attributes = currentAttrs;
          updateLog.push({ type: '属性变化', change: `${attrName} ${data.change >= 0 ? '+' : ''}${data.change}`, time: new Date().toISOString() });
          break;
        }

        case 'addSkill': {
          const data = update.data as { name: string; level: number };
          const riderData = character.rider_data || {};
          riderData.skills = {
            ...(riderData.skills || {}),
            [data.name]: data.level
          };
          character.rider_data = riderData;
          updateLog.push({ type: '获得技能', change: `${data.name} +${data.level}`, time: new Date().toISOString() });
          break;
        }

        case 'setNote': {
          const data = update.data as { content: string };
          const currentNotes = character.notes || '';
          character.notes = currentNotes ? `${currentNotes}\n[${new Date().toLocaleString('zh-CN')}] ${data.content}` : `[${new Date().toLocaleString('zh-CN')}] ${data.content}`;
          updateLog.push({ type: '添加备注', change: data.content, time: new Date().toISOString() });
          break;
        }

        case 'addExperience': {
          const data = update.data as { amount: number };
          character.experience = (character.experience || 0) + data.amount;
          updateLog.push({ type: '获得经验', change: `+${data.amount}`, time: new Date().toISOString() });
          break;
        }
      }
    }

    // 更新更新日志
    character.update_log = [...(character.update_log || []), ...updateLog];
    character.updated_at = new Date().toISOString();

    // 保存到数据库
    const { data: result, error: updateError } = await supabase
      .from('characters')
      .update({
        attributes: character.attributes,
        fate_points: character.fate_points,
        other_equipment: character.other_equipment,
        rider_data: character.rider_data,
        notes: character.notes,
        experience: character.experience,
        update_log: character.update_log,
        updated_at: character.updated_at,
      })
      .eq('id', characterId)
      .select()
      .single();

    if (updateError) {
      console.error('更新角色卡错误:', updateError);
      return NextResponse.json({ error: '更新失败' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      character: result,
      updateLog,
    });
  } catch (error) {
    console.error('角色卡增量更新错误:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
