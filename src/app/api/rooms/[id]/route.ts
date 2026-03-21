import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 获取房间详情
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.substring(7);
    const supabase = getSupabaseClient(token);

    // 获取房间信息
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', id)
      .single();

    if (roomError || !room) {
      return NextResponse.json({ error: '房间不存在' }, { status: 404 });
    }

    // 获取房主信息
    const { data: hostProfile } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar')
      .eq('id', room.host_id)
      .single();

    // 获取房间成员
    const { data: members } = await supabase
      .from('room_members')
      .select('*')
      .eq('room_id', id);

    // 获取成员的用户信息和角色卡
    const memberUserIds = members?.map(m => m.user_id) || [];
    const memberCharacterIds = members?.map(m => m.character_id).filter(Boolean) || [];

    const { data: memberProfiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar')
      .in('id', memberUserIds);

    const { data: memberCharacters } = memberCharacterIds.length > 0 
      ? await supabase
          .from('characters')
          .select('id, name, title, attributes')
          .in('id', memberCharacterIds)
      : { data: [] };

    const profileMap = new Map(memberProfiles?.map(p => [p.id, p]));
    const characterMap = new Map(memberCharacters?.map(c => [c.id, c]));

    const membersWithDetails = members?.map(m => ({
      ...m,
      profiles: profileMap.get(m.user_id),
      characters: m.character_id ? characterMap.get(m.character_id) : null,
    }));

    return NextResponse.json({
      success: true,
      data: {
        ...room,
        profiles: hostProfile,
        members: membersWithDetails || [],
      },
    });
  } catch (error) {
    console.error('获取房间详情错误:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// 更新房间
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

    // 验证房间所有权
    const { data: room } = await supabase
      .from('rooms')
      .select('host_id')
      .eq('id', id)
      .single();

    if (!room || room.host_id !== user.id) {
      return NextResponse.json({ error: '无权修改此房间' }, { status: 403 });
    }

    const updateData = await request.json();
    const { data: updatedRoom, error } = await supabase
      .from('rooms')
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('更新房间错误:', error);
      return NextResponse.json({ error: '更新房间失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: updatedRoom });
  } catch (error) {
    console.error('更新房间错误:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// 删除房间
export async function DELETE(
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

    // 验证房间所有权
    const { data: room } = await supabase
      .from('rooms')
      .select('host_id')
      .eq('id', id)
      .single();

    if (!room || room.host_id !== user.id) {
      return NextResponse.json({ error: '无权删除此房间' }, { status: 403 });
    }

    // 删除房间成员
    await supabase.from('room_members').delete().eq('room_id', id);
    
    // 删除房间
    await supabase.from('rooms').delete().eq('id', id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除房间错误:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
