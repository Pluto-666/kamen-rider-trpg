import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 获取单个角色卡详情
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    const supabase = getSupabaseClient(token || undefined);
    
    const { data: character, error } = await supabase
      .from('characters')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      console.error('获取角色卡详情错误:', error);
      return NextResponse.json({ error: '获取失败' }, { status: 500 });
    }
    
    if (!character) {
      return NextResponse.json({ error: '角色不存在' }, { status: 404 });
    }
    
    return NextResponse.json({ 
      success: true, 
      character 
    });
  } catch (error) {
    console.error('获取角色卡详情错误:', error);
    return NextResponse.json({ error: '获取失败' }, { status: 500 });
  }
}

// 更新角色卡
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    // 移除不应该更新的字段
    delete body.id;
    delete body.userId;
    delete body.user_id;
    delete body.createdAt;
    delete body.created_at;

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
    
    for (const [key, value] of Object.entries(body)) {
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
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    const supabase = getSupabaseClient(token || undefined);

    const { error } = await supabase
      .from('characters')
      .delete()
      .eq('id', id);

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
