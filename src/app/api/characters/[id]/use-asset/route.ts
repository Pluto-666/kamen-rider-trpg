import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

/**
 * 技能/物品使用 API
 * 
 * 支持两种类型：
 * 1. 有次数限制的技能/物品（消耗次数，用完可恢复）
 * 2. 消耗性物品（用完删除）
 * 
 * 流程：
 * 1. 验证技能/物品是否存在
 * 2. 验证剩余次数 > 0
 * 3. 扣减次数
 * 4. 如果是消耗品且次数归零，从角色卡删除
 */

interface UseSkillRequest {
  skillName: string;
  characterName?: string; // 用于日志
}

interface UseItemRequest {
  itemName: string;
  characterName?: string;
}

// 消耗性物品/技能的数据结构
interface UsableAsset {
  name: string;
  type: 'skill' | 'equipment' | 'consumable';
  maxUses: number;
  currentUses: number;
  recoveryMethod?: string; // 恢复方式，如 "战斗结束"、"休息" 等
  isConsumable: boolean;   // 是否消耗品（用完删除）
  description?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: characterId } = await params;
    const body = await request.json();
    const { type, name, characterName } = body as { type: 'skill' | 'item'; name: string; characterName?: string };

    if (!name) {
      return NextResponse.json({ error: '缺少技能/物品名称' }, { status: 400 });
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

    // 获取或初始化 usableAssets
    const riderData = character.rider_data || {};
    const usableAssets: Record<string, UsableAsset> = (riderData as Record<string, unknown>).usableAssets as Record<string, UsableAsset> || {};

    // 查找对应的技能/物品
    const assetKey = name.toLowerCase().trim();
    let asset = usableAssets[assetKey];

    // 如果不存在，检查是否是configs中的技能
    if (!asset && type === 'skill') {
      const configs = character.configs || [];
      const configSkill = configs.find((c: { name: string }) => c.name.toLowerCase() === assetKey);
      
      if (configSkill) {
        // 从config创建可追踪的技能资产
        asset = {
          name: configSkill.name,
          type: 'skill',
          maxUses: 3, // 默认每次战斗可用3次
          currentUses: 3,
          recoveryMethod: '战斗结束',
          isConsumable: false,
        };
        usableAssets[assetKey] = asset;
      }
    }

    // 如果不存在，检查是否是riderData中的必杀技
    if (!asset && type === 'skill') {
      const finisherMoves = (riderData as Record<string, unknown>).finisherMoves as string[] || [];
      if (finisherMoves.some(m => m.toLowerCase().includes(assetKey))) {
        asset = {
          name: finisherMoves.find(m => m.toLowerCase().includes(assetKey)) || name,
          type: 'skill',
          maxUses: 1,
          currentUses: 1,
          recoveryMethod: '战斗结束',
          isConsumable: false,
        };
        usableAssets[assetKey] = asset;
      }
    }

    // 如果不存在，检查是否是equipment中的物品
    if (!asset && type === 'item') {
      const equipment = (riderData as Record<string, unknown>).equipment as string[] || [];
      if (equipment.some(e => e.toLowerCase().includes(assetKey))) {
        asset = {
          name: equipment.find(e => e.toLowerCase().includes(assetKey)) || name,
          type: 'consumable',
          maxUses: 1,
          currentUses: 1,
          isConsumable: true,
        };
        usableAssets[assetKey] = asset;
      }
    }

    // 如果仍然不存在，返回错误
    if (!asset) {
      return NextResponse.json({ 
        error: '技能/物品不存在或不可追踪',
        suggestion: `如果这是新技能/物品，请先通过【角色卡更新】添加到角色卡`
      }, { status: 404 });
    }

    // 验证剩余次数
    if (asset.currentUses <= 0) {
      return NextResponse.json({ 
        error: `${asset.name} 已用完`,
        remainingUses: 0,
        maxUses: asset.maxUses,
        recoveryMethod: asset.recoveryMethod,
        isConsumable: asset.isConsumable,
      }, { status: 400 });
    }

    // 扣减次数
    asset.currentUses -= 1;

    // 如果是消耗品且次数归零，从角色卡删除
    let removed = false;
    if (asset.isConsumable && asset.currentUses <= 0) {
      delete usableAssets[assetKey];
      removed = true;
      
      // 同时从equipment中删除
      if ((riderData as Record<string, unknown>).equipment) {
        const equipment = ((riderData as Record<string, unknown>).equipment as string[]) || [];
        (riderData as Record<string, unknown>).equipment = equipment.filter(e => !e.toLowerCase().includes(assetKey));
      }
    }

    // 更新角色卡
    (riderData as Record<string, unknown>).usableAssets = usableAssets;
    character.rider_data = riderData;

    // 更新日志
    const updateLog = character.update_log || [];
    updateLog.push({
      type: removed ? '消耗品用完' : '技能/物品使用',
      change: `${name} (${asset.currentUses}/${asset.maxUses})`,
      time: new Date().toISOString(),
    });

    // 保存到数据库
    const { data: result, error: updateError } = await supabase
      .from('characters')
      .update({
        rider_data: character.rider_data,
        update_log: updateLog,
        updated_at: new Date().toISOString(),
      })
      .eq('id', characterId)
      .select()
      .single();

    if (updateError) {
      console.error('更新角色卡错误:', updateError);
      return NextResponse.json({ error: '更新失败' }, { status: 500 });
    }

    console.log(`[消耗追踪] ${characterName || character.name} 使用了 ${name}，剩余 ${asset.currentUses}/${asset.maxUses}`);

    return NextResponse.json({
      success: true,
      assetName: asset.name,
      remainingUses: asset.currentUses,
      maxUses: asset.maxUses,
      removed,
      character: result,
    });
  } catch (error) {
    console.error('技能/物品使用错误:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

/**
 * 恢复技能/物品使用次数
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: characterId } = await params;
    const body = await request.json();
    const { recoveryType, skillName } = body as { recoveryType: 'battle_end' | 'rest' | 'full' | 'specific'; skillName?: string };

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

    const riderData = character.rider_data || {};
    const usableAssets: Record<string, UsableAsset> = (riderData as Record<string, unknown>).usableAssets as Record<string, UsableAsset> || {};

    const recoveredAssets: string[] = [];

    // 根据恢复类型恢复
    for (const [key, asset] of Object.entries(usableAssets)) {
      if (asset.isConsumable) continue; // 消耗品不恢复

      let shouldRecover = false;

      switch (recoveryType) {
        case 'battle_end':
          shouldRecover = asset.recoveryMethod === '战斗结束';
          break;
        case 'rest':
          shouldRecover = asset.recoveryMethod === '休息' || asset.recoveryMethod === '战斗结束';
          break;
        case 'full':
          shouldRecover = true;
          break;
        case 'specific':
          shouldRecover = skillName ? asset.name.toLowerCase().includes(skillName.toLowerCase()) : false;
          break;
      }

      if (shouldRecover && asset.currentUses < asset.maxUses) {
        asset.currentUses = asset.maxUses;
        recoveredAssets.push(asset.name);
      }
    }

    if (recoveredAssets.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: '没有需要恢复的技能/物品',
        recoveredAssets: [],
      });
    }

    // 更新角色卡
    (riderData as Record<string, unknown>).usableAssets = usableAssets;
    character.rider_data = riderData;

    // 更新日志
    const updateLog = character.update_log || [];
    updateLog.push({
      type: '技能恢复',
      change: recoveredAssets.join('、'),
      time: new Date().toISOString(),
    });

    // 保存到数据库
    const { error: updateError } = await supabase
      .from('characters')
      .update({
        rider_data: character.rider_data,
        update_log: updateLog,
        updated_at: new Date().toISOString(),
      })
      .eq('id', characterId);

    if (updateError) {
      console.error('更新角色卡错误:', updateError);
      return NextResponse.json({ error: '更新失败' }, { status: 500 });
    }

    console.log(`[消耗追踪] ${character.name} 恢复了: ${recoveredAssets.join('、')}`);

    return NextResponse.json({
      success: true,
      recoveredAssets,
      message: `已恢复: ${recoveredAssets.join('、')}`,
    });
  } catch (error) {
    console.error('恢复技能错误:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

/**
 * 获取角色所有可追踪的技能/物品状态
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: characterId } = await params;

    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const supabase = getSupabaseClient(token);

    const { data: character, error } = await supabase
      .from('characters')
      .select('rider_data, configs, name')
      .eq('id', characterId)
      .single();

    if (error || !character) {
      return NextResponse.json({ error: '角色不存在' }, { status: 404 });
    }

    const riderData = character.rider_data || {};
    const usableAssets: Record<string, UsableAsset> = (riderData as Record<string, unknown>).usableAssets as Record<string, UsableAsset> || {};

    // 格式化输出
    const assets = Object.values(usableAssets).map(asset => ({
      name: asset.name,
      type: asset.type,
      currentUses: asset.currentUses,
      maxUses: asset.maxUses,
      recoveryMethod: asset.recoveryMethod,
      isConsumable: asset.isConsumable,
      available: asset.currentUses > 0,
    }));

    return NextResponse.json({
      success: true,
      characterName: character.name,
      assets,
      count: assets.length,
    });
  } catch (error) {
    console.error('获取技能状态错误:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
