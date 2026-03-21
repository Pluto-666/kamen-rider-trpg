import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 清理文本，限制长度
function cleanText(text: string | undefined | null, maxLength: number = 50): string | undefined {
  if (!text) return undefined;
  const cleaned = text.replace(/\|/g, '').replace(/\s+/g, ' ').trim();
  return cleaned.slice(0, maxLength) || undefined;
}

// 获取用户的角色卡列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    // 同时支持 userId 和 user_id 两种参数格式
    const userId = searchParams.get('userId') || searchParams.get('user_id');
    
    if (!userId) {
      return NextResponse.json({ error: '缺少用户ID' }, { status: 400 });
    }

    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    const supabase = getSupabaseClient(token || undefined);
    
    const { data: characterList, error } = await supabase
      .from('characters')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });
    
    if (error) {
      console.error('获取角色卡列表错误:', error);
      return NextResponse.json({ error: '获取失败' }, { status: 500 });
    }
    
    return NextResponse.json({ 
      success: true, 
      characters: characterList || [] 
    });
  } catch (error) {
    console.error('获取角色卡列表错误:', error);
    return NextResponse.json({ error: '获取失败' }, { status: 500 });
  }
}

// 创建新角色卡
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // 支持两种命名格式：camelCase 和 snake_case
    const { 
      userId,
      user_id,
      name,
      playerName,
      player_name,
      imageUrl,
      image_url,
      race = '人类',
      occupation,
      age,
      gender,
      activePower,
      active_power,
      attributes,
      fatePoints,
      fate_points,
      weapons,
      armors,
      otherEquipment,
      other_equipment,
      vehicle,
      configs,
      background,
      riderData,
      rider_data,
      actionCards,
      action_cards,
      episodes
    } = body;

    // 优先使用snake_case格式（与数据库一致）
    const finalUserId = user_id || userId;
    const finalName = name;
    
    if (!finalUserId || !finalName) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    // 默认属性值
    const defaultAttributes = {
      body: 4, bodyRace: 0, bodyJob: 0, bodyNormal: 4, bodyTransform: 9,
      athletics: 3, athleticsRace: 0, athleticsJob: 0, athleticsNormal: 3, athleticsTransform: 8,
      dexterity: 1, dexterityRace: 0, dexterityJob: 0, dexterityNormal: 1, dexterityTransform: 6,
      will: 1, willRace: 0, willJob: 0, willNormal: 1, willTransform: 6,
      wit: 1, witRace: 0, witJob: 0, witNormal: 1, witTransform: 6,
      movement: 6, movementRace: 0, movementJob: 0, movementNormal: 6, movementTransform: 11, movementBonus: 0,
      initiative: 1, initiativeRace: 0, initiativeJob: 0, initiativeNormal: 1, initiativeTransform: 6, initiativeBonus: 0,
      additionalHP: 0,
      bodyHP: 20,
      totalHP: 20,
      transformHP: 45,
    };

    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    const supabase = getSupabaseClient(token || undefined);

    const characterData = {
      id: crypto.randomUUID(),
      user_id: finalUserId,
      name: cleanText(finalName, 50) || '未命名角色',
      player_name: cleanText(player_name || playerName, 50) || '匿名玩家',
      image_url: cleanText(image_url || imageUrl, 500),
      race: cleanText(race, 50) || '人类',
      occupation: cleanText(occupation, 50),
      age: age ? parseInt(String(age)) : null,
      gender: cleanText(gender, 20),
      active_power: active_power || activePower || 5,
      attributes: attributes || defaultAttributes,
      fate_points: fate_points || fatePoints || { points: 0, history: [] },
      weapons: weapons || [],
      armors: armors || [],
      other_equipment: cleanText(other_equipment || otherEquipment, 1000),
      vehicle,
      configs: configs || [],
      background: cleanText(background, 1000),
      rider_data: rider_data || riderData,
      action_cards: action_cards || actionCards || [],
      episodes: episodes || [],
    };

    const { data: result, error } = await supabase
      .from('characters')
      .insert(characterData)
      .select()
      .single();

    if (error) {
      console.error('创建角色卡错误:', error);
      return NextResponse.json({ error: '创建失败' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      character: result 
    });
  } catch (error) {
    console.error('创建角色卡错误:', error);
    return NextResponse.json({ error: '创建失败' }, { status: 500 });
  }
}

// 更新角色卡
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: '缺少角色ID' }, { status: 400 });
    }

    // 移除不应该更新的字段
    delete updateData.id;
    delete updateData.userId;
    delete updateData.user_id;
    delete updateData.createdAt;
    delete updateData.created_at;

    // 转换字段名为snake_case
    const snakeCaseData: Record<string, unknown> = {};
    const fieldMap: Record<string, string> = {
      playerName: 'player_name',
      imageUrl: 'image_url',
      activePower: 'active_power',
      fatePoints: 'fate_points',
      otherEquipment: 'other_equipment',
      riderData: 'rider_data',
      actionCards: 'action_cards',
      updatedAt: 'updated_at',
    };
    
    for (const [key, value] of Object.entries(updateData)) {
      const snakeKey = fieldMap[key] || key;
      snakeCaseData[snakeKey] = value;
    }
    snakeCaseData.updated_at = new Date().toISOString();

    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    const supabase = getSupabaseClient(token || undefined);

    const { data: result, error } = await supabase
      .from('characters')
      .update(snakeCaseData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('更新角色卡错误:', error);
      return NextResponse.json({ error: '更新失败' }, { status: 500 });
    }

    if (!result) {
      return NextResponse.json({ error: '角色不存在' }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      character: result 
    });
  } catch (error) {
    console.error('更新角色卡错误:', error);
    return NextResponse.json({ error: '更新失败' }, { status: 500 });
  }
}

// 删除角色卡
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const userId = searchParams.get('userId');

    if (!id || !userId) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    const supabase = getSupabaseClient(token || undefined);

    const { error } = await supabase
      .from('characters')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      console.error('删除角色卡错误:', error);
      return NextResponse.json({ error: '删除失败' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true,
      message: '角色卡已删除' 
    });
  } catch (error) {
    console.error('删除角色卡错误:', error);
    return NextResponse.json({ error: '删除失败' }, { status: 500 });
  }
}
