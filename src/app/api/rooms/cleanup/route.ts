import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

/**
 * 清理没有真人玩家的空房间
 * 只允许管理员或系统调用此接口
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const supabase = getSupabaseClient(token);

    // 验证用户身份
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: '无效的令牌' }, { status: 401 });
    }

    // 获取所有房间
    const { data: allRooms, error: roomsError } = await supabase
      .from('rooms')
      .select('id, name, host_id, created_at, status');

    if (roomsError) {
      console.error('获取房间列表错误:', roomsError);
      return NextResponse.json({ error: '获取房间列表失败' }, { status: 500 });
    }

    if (!allRooms || allRooms.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: '没有需要清理的房间',
        deletedCount: 0 
      });
    }

    // 获取所有房间的成员信息
    const roomIds = allRooms.map(r => r.id);
    const { data: allMembers, error: membersError } = await supabase
      .from('room_members')
      .select('room_id, user_id')
      .in('room_id', roomIds);

    if (membersError) {
      console.error('获取成员列表错误:', membersError);
      return NextResponse.json({ error: '获取成员列表失败' }, { status: 500 });
    }

    // 统计每个房间的成员数量
    const roomMemberCount = new Map<string, number>();
    allMembers?.forEach(member => {
      const count = roomMemberCount.get(member.room_id) || 0;
      roomMemberCount.set(member.room_id, count + 1);
    });

    // 找出没有成员的空房间
    const emptyRoomIds: string[] = [];
    allRooms.forEach(room => {
      const memberCount = roomMemberCount.get(room.id) || 0;
      if (memberCount === 0) {
        emptyRoomIds.push(room.id);
      }
    });

    if (emptyRoomIds.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: '没有需要清理的空房间',
        deletedCount: 0 
      });
    }

    // 删除空房间相关的游戏日志
    const { error: logsError } = await supabase
      .from('game_logs')
      .delete()
      .in('room_id', emptyRoomIds);

    if (logsError) {
      console.error('删除游戏日志错误:', logsError);
      // 继续执行，不中断流程
    }

    // 删除空房间相关的游戏会话
    const { error: sessionsError } = await supabase
      .from('game_sessions')
      .delete()
      .in('room_id', emptyRoomIds);

    if (sessionsError) {
      console.error('删除游戏会话错误:', sessionsError);
      // 继续执行，不中断流程
    }

    // 删除空房间
    const { error: deleteError } = await supabase
      .from('rooms')
      .delete()
      .in('id', emptyRoomIds);

    if (deleteError) {
      console.error('删除房间错误:', deleteError);
      return NextResponse.json({ error: '删除房间失败' }, { status: 500 });
    }

    console.log(`已清理 ${emptyRoomIds.length} 个空房间`);

    return NextResponse.json({ 
      success: true, 
      message: `成功清理 ${emptyRoomIds.length} 个空房间`,
      deletedCount: emptyRoomIds.length,
      deletedRoomIds: emptyRoomIds
    });

  } catch (error) {
    console.error('清理空房间错误:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
