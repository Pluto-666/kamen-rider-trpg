import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 加入房间
export async function POST(
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

    const { characterId, password } = await request.json();

    // 获取房间信息
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', id)
      .single();

    if (roomError || !room) {
      return NextResponse.json({ error: '房间不存在' }, { status: 404 });
    }

    // 检查房间状态
    if (room.status !== 'waiting') {
      return NextResponse.json({ error: '房间已经开始游戏，无法加入' }, { status: 400 });
    }

    // 检查密码
    if (room.is_private && room.password !== password) {
      return NextResponse.json({ error: '房间密码错误' }, { status: 403 });
    }

    // 检查是否已经在房间中
    const { data: existingMember } = await supabase
      .from('room_members')
      .select('id')
      .eq('room_id', id)
      .eq('user_id', user.id)
      .single();

    if (existingMember) {
      return NextResponse.json({ error: '你已经在这个房间中' }, { status: 400 });
    }

    // 检查房间人数
    const { count } = await supabase
      .from('room_members')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', id);

    if (count && count >= room.max_players) {
      return NextResponse.json({ error: '房间已满' }, { status: 400 });
    }

    // 加入房间
    const { data: member, error } = await supabase
      .from('room_members')
      .insert({
        room_id: id,
        user_id: user.id,
        character_id: characterId,
        status: 'ready',
      })
      .select()
      .single();

    if (error) {
      console.error('加入房间错误:', error);
      return NextResponse.json({ error: '加入房间失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: member });
  } catch (error) {
    console.error('加入房间错误:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// 离开房间
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

    // 获取房间信息
    const { data: room } = await supabase
      .from('rooms')
      .select('host_id')
      .eq('id', id)
      .single();

    if (!room) {
      // 房间已经不存在，直接返回成功
      return NextResponse.json({ success: true, message: '房间已不存在' });
    }

    // 删除当前用户的成员记录
    const { error: deleteError } = await supabase
      .from('room_members')
      .delete()
      .eq('room_id', id)
      .eq('user_id', user.id);

    if (deleteError) {
      console.error('删除成员记录错误:', deleteError);
      return NextResponse.json({ error: '离开房间失败' }, { status: 500 });
    }

    console.log(`用户 ${user.id} 离开房间 ${id}`);

    // 检查房间是否还有成员
    const { data: remainingMembers } = await supabase
      .from('room_members')
      .select('id')
      .eq('room_id', id);

    console.log(`房间 ${id} 剩余成员数: ${remainingMembers?.length || 0}`);

    // 如果没有成员了，删除房间
    if (!remainingMembers || remainingMembers.length === 0) {
      // 先获取游戏会话，确保存档已保存
      const { data: sessions } = await supabase
        .from('game_sessions')
        .select('id')
        .eq('room_id', id);
      
      console.log(`房间 ${id} 有 ${sessions?.length || 0} 个游戏存档，保留存档`);

      // 删除房间（游戏会话通过 room_id 字段保留，房间删除不影响存档）
      const { error: roomDeleteError } = await supabase
        .from('rooms')
        .delete()
        .eq('id', id);

      if (roomDeleteError) {
        console.error('删除房间错误:', roomDeleteError);
      } else {
        console.log(`房间 ${id} 已自动解散（无成员）`);
      }
      
      return NextResponse.json({ success: true, message: '房间已自动解散' });
    }

    // 如果房主离开但还有其他成员，转移房主
    if (room.host_id === user.id && remainingMembers.length > 0) {
      const newHost = remainingMembers[0];
      // 这里需要通过 member 的 user_id 来更新房间
      const { data: newHostMember } = await supabase
        .from('room_members')
        .select('user_id')
        .eq('id', newHost.id)
        .single();
      
      if (newHostMember) {
        await supabase
          .from('rooms')
          .update({ host_id: newHostMember.user_id })
          .eq('id', id);
        console.log(`房间 ${id} 房主转移给 ${newHostMember.user_id}`);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('离开房间错误:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
