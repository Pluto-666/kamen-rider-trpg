import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 获取单个存档详情
export async function GET(
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

    // 获取当前用户
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: '用户未登录' }, { status: 401 });
    }

    const { data: save, error } = await supabase
      .from('game_saves')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (error || !save) {
      return NextResponse.json({ error: '存档不存在' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: save });
  } catch (error) {
    console.error('获取存档错误:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// 删除存档
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

    // 获取当前用户
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: '用户未登录' }, { status: 401 });
    }

    const { error } = await supabase
      .from('game_saves')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('删除存档错误:', error);
      return NextResponse.json({ error: '删除存档失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除存档错误:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
