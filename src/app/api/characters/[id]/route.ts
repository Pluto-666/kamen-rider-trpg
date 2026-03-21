import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 获取单个角色卡
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.substring(7);
    const supabase = getSupabaseClient(token);

    const { data: character, error } = await supabase
      .from('characters')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      return NextResponse.json({ error: '角色卡不存在' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: character });
  } catch (error) {
    console.error('获取角色卡错误:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// 更新角色卡
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

    // 验证角色卡所有权
    const { data: existingCharacter } = await supabase
      .from('characters')
      .select('user_id')
      .eq('id', id)
      .single();

    if (!existingCharacter || existingCharacter.user_id !== user.id) {
      return NextResponse.json({ error: '无权修改此角色卡' }, { status: 403 });
    }

    const updateData = await request.json();
    const { data: character, error } = await supabase
      .from('characters')
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('更新角色卡错误:', error);
      return NextResponse.json({ error: '更新角色卡失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: character });
  } catch (error) {
    console.error('更新角色卡错误:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// 删除角色卡
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

    // 验证角色卡所有权
    const { data: existingCharacter } = await supabase
      .from('characters')
      .select('user_id')
      .eq('id', id)
      .single();

    if (!existingCharacter || existingCharacter.user_id !== user.id) {
      return NextResponse.json({ error: '无权删除此角色卡' }, { status: 403 });
    }

    const { error } = await supabase
      .from('characters')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('删除角色卡错误:', error);
      return NextResponse.json({ error: '删除角色卡失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除角色卡错误:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
