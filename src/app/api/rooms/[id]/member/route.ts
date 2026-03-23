import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 更新房间成员信息（选择角色）
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const supabase = getSupabaseClient(token);

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: '无效的令牌' }, { status: 401 });
    }

    const { characterId } = await request.json();

    // 更新成员的角色选择
    const { error } = await supabase
      .from('room_members')
      .update({ character_id: characterId })
      .eq('room_id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('更新成员角色错误:', error);
      return NextResponse.json({ error: '更新失败' }, { status: 500 });
    }

    // 获取更新后的角色信息（完整数据）
    let character = null;
    if (characterId) {
      const { data: charData } = await supabase
        .from('characters')
        .select('*')  // 获取完整的角色数据，确保AI主持人能读取所有扩展信息
        .eq('id', characterId)
        .single();
      character = charData;
    }

    return NextResponse.json({ 
      success: true, 
      data: { characterId, character } 
    });
  } catch (error) {
    console.error('更新成员角色错误:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
