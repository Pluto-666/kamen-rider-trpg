import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export async function POST(request: NextRequest) {
  try {
    const { email, password, username } = await request.json();

    if (!email || !password || !username) {
      return NextResponse.json(
        { error: '请填写所有必填字段' },
        { status: 400 }
      );
    }

    // 验证用户名格式
    if (!/^[a-zA-Z0-9_\u4e00-\u9fa5]{2,20}$/.test(username)) {
      return NextResponse.json(
        { error: '用户名必须是2-20个字符，只能包含字母、数字、下划线和中文' },
        { status: 400 }
      );
    }

    // 验证密码长度
    if (password.length < 6) {
      return NextResponse.json(
        { error: '密码至少需要6个字符' },
        { status: 400 }
      );
    }

    let supabase;
    try {
      supabase = getSupabaseClient();
    } catch (envError) {
      console.error('Supabase 环境变量错误:', envError);
      return NextResponse.json(
        { error: '服务器配置错误，请联系管理员' },
        { status: 500 }
      );
    }

    // 检查用户名是否已存在
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', username)
      .single();

    if (existingProfile) {
      return NextResponse.json(
        { error: '用户名已被使用' },
        { status: 400 }
      );
    }

    // 注册用户
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username },
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || process.env.COZE_PROJECT_DOMAIN_DEFAULT || 'http://localhost:5000'}/auth/callback`,
      },
    });

    if (authError) {
      // 处理常见错误
      if (authError.message.includes('already registered')) {
        return NextResponse.json(
          { error: '该邮箱已被注册，请直接登录或使用其他邮箱' },
          { status: 400 }
        );
      }
      if (authError.message.includes('Password')) {
        return NextResponse.json(
          { error: '密码不符合要求，请使用至少6个字符的密码' },
          { status: 400 }
        );
      }
      if (authError.message.includes('Invalid email')) {
        return NextResponse.json(
          { error: '邮箱格式不正确，请检查后重试' },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      );
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: '注册失败，请重试' },
        { status: 500 }
      );
    }

    // 检查是否需要邮箱验证
    const needsEmailConfirmation = !authData.session && authData.user.identities?.length === 0;
    
    if (needsEmailConfirmation) {
      // 邮箱已注册但未验证，提示用户检查邮箱
      return NextResponse.json({
        success: true,
        needsEmailConfirmation: true,
        message: '该邮箱已注册但未验证，请检查邮箱完成验证后登录',
        data: {
          user: { id: authData.user.id, email: authData.user.email },
        },
      });
    }

    // 如果注册成功但没有 session，说明需要邮箱验证
    if (!authData.session) {
      return NextResponse.json({
        success: true,
        needsEmailConfirmation: true,
        message: '注册成功！请检查邮箱完成验证后登录',
        data: {
          user: { id: authData.user.id, email: authData.user.email },
        },
      });
    }

    // 创建用户资料
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: authData.user.id,
        username,
        display_name: username,
      });

    if (profileError) {
      console.error('创建用户资料失败:', profileError);
    }

    return NextResponse.json({
      success: true,
      data: {
        user: authData.user,
        session: authData.session,
      },
    });
  } catch (error) {
    console.error('注册错误:', error);
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    );
  }
}
