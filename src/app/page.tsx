'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Swords, Sparkles, Users, Bot, Shield, Zap } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { login, register, isLoading, isAuthenticated } = useAuth();
  
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerUsername, setRegisterUsername] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 如果已登录，跳转到大厅
  if (isAuthenticated) {
    router.push('/lobby');
    return null;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await login(loginEmail, loginPassword);
      router.push('/lobby');
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (registerPassword !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    setIsSubmitting(true);

    try {
      await register(registerEmail, registerPassword, registerUsername);
      router.push('/lobby');
    } catch (err) {
      setError(err instanceof Error ? err.message : '注册失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f] relative overflow-hidden">
        {/* 背景图 */}
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-30"
          style={{ backgroundImage: 'url(/kamen-rider-bg-1.jpeg)' }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a0f] via-[#0a0a0f]/80 to-[#1a1a25]" />
        
        <div className="text-center relative z-10">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#c41e3a] mx-auto"></div>
          <p className="mt-4 text-[#8a8a9a]">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#0a0a0f] relative overflow-hidden">
      {/* 背景图 */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-25"
        style={{ backgroundImage: 'url(/kamen-rider-bg-1.jpeg)' }}
      />
      
      {/* 渐变遮罩 */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a0f] via-transparent to-[#0a0a0f]" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0f] via-transparent to-[#0a0a0f]/50" />
      
      {/* 能量线条动画 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-px h-full bg-gradient-to-b from-transparent via-[#c41e3a]/20 to-transparent animate-pulse" />
        <div className="absolute top-0 right-1/3 w-px h-full bg-gradient-to-b from-transparent via-[#00d4ff]/20 to-transparent animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-0 left-1/2 w-px h-full bg-gradient-to-b from-transparent via-[#c41e3a]/10 to-transparent animate-pulse" style={{ animationDelay: '2s' }} />
      </div>
      
      <div className="w-full max-w-md relative z-10">
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-[#c41e3a] to-[#8b0000] mb-4 shadow-lg shadow-[#c41e3a]/30">
            <Swords className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-5xl font-bold font-display tracking-wider">
            <span className="text-gradient-rider">假面骑士</span>
          </h1>
          <h2 className="text-2xl font-display tracking-widest text-[#00d4ff] mt-1">TRPG</h2>
          <p className="text-[#8a8a9a] mt-3 text-sm tracking-wide">在线跑团平台</p>
        </div>

        <Card className="kamen-card backdrop-blur-sm bg-[#12121a]/90 border-[#c41e3a]/20">
          <Tabs defaultValue="login" className="w-full">
            <CardHeader className="pb-2">
              <TabsList className="grid w-full grid-cols-2 bg-[#1a1a25]/80">
                <TabsTrigger 
                  value="login"
                  className="data-[state=active]:bg-[#c41e3a]/20 data-[state=active]:text-[#e8e8f0] text-[#8a8a9a]"
                >
                  登录
                </TabsTrigger>
                <TabsTrigger 
                  value="register"
                  className="data-[state=active]:bg-[#c41e3a]/20 data-[state=active]:text-[#e8e8f0] text-[#8a8a9a]"
                >
                  注册
                </TabsTrigger>
              </TabsList>
            </CardHeader>

            <CardContent className="pt-4">
              {error && (
                <Alert variant="destructive" className="mb-4 bg-[#dc2626]/10 border-[#dc2626]/30">
                  <AlertDescription className="text-[#ff6b6b]">{error}</AlertDescription>
                </Alert>
              )}

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email" className="text-[#c0c0c8]">邮箱</Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="your@email.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      required
                      className="bg-[#0a0a0f]/80 border-[#c0c0c8]/20 text-[#e8e8f0] placeholder:text-[#6a6a7a] focus:border-[#c41e3a] focus:ring-[#c41e3a]/30"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password" className="text-[#c0c0c8]">密码</Label>
                    <Input
                      id="login-password"
                      type="password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      required
                      className="bg-[#0a0a0f]/80 border-[#c0c0c8]/20 text-[#e8e8f0] placeholder:text-[#6a6a7a] focus:border-[#c41e3a] focus:ring-[#c41e3a]/30"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full kamen-btn-primary" 
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? '登录中...' : '🚀 登录'}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="register">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="register-username" className="text-[#c0c0c8]">用户名</Label>
                    <Input
                      id="register-username"
                      type="text"
                      placeholder="你的名字"
                      value={registerUsername}
                      onChange={(e) => setRegisterUsername(e.target.value)}
                      required
                      minLength={2}
                      maxLength={20}
                      className="bg-[#0a0a0f]/80 border-[#c0c0c8]/20 text-[#e8e8f0] placeholder:text-[#6a6a7a] focus:border-[#c41e3a] focus:ring-[#c41e3a]/30"
                    />
                    <p className="text-xs text-[#6a6a7a]">
                      2-20个字符，支持中文、英文、数字和下划线
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-email" className="text-[#c0c0c8]">邮箱</Label>
                    <Input
                      id="register-email"
                      type="email"
                      placeholder="your@email.com"
                      value={registerEmail}
                      onChange={(e) => setRegisterEmail(e.target.value)}
                      required
                      className="bg-[#0a0a0f]/80 border-[#c0c0c8]/20 text-[#e8e8f0] placeholder:text-[#6a6a7a] focus:border-[#c41e3a] focus:ring-[#c41e3a]/30"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-password" className="text-[#c0c0c8]">密码</Label>
                    <Input
                      id="register-password"
                      type="password"
                      value={registerPassword}
                      onChange={(e) => setRegisterPassword(e.target.value)}
                      required
                      minLength={6}
                      className="bg-[#0a0a0f]/80 border-[#c0c0c8]/20 text-[#e8e8f0] placeholder:text-[#6a6a7a] focus:border-[#c41e3a] focus:ring-[#c41e3a]/30"
                    />
                    <p className="text-xs text-[#6a6a7a]">
                      至少6个字符
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password" className="text-[#c0c0c8]">确认密码</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      className="bg-[#0a0a0f]/80 border-[#c0c0c8]/20 text-[#e8e8f0] placeholder:text-[#6a6a7a] focus:border-[#c41e3a] focus:ring-[#c41e3a]/30"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full kamen-btn-primary" 
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? '注册中...' : '⚔️ 注册'}
                  </Button>
                </form>
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>

        {/* Feature Highlights */}
        <div className="mt-8 grid grid-cols-3 gap-4 text-center text-sm">
          <div className="p-4 rounded-lg bg-[#12121a]/80 backdrop-blur-sm border border-[#c41e3a]/10 hover:border-[#c41e3a]/30 transition-colors group">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[#c41e3a]/20 mb-2 group-hover:bg-[#c41e3a]/30 transition-colors">
              <Shield className="w-5 h-5 text-[#c41e3a]" />
            </div>
            <div className="text-[#e8e8f0] font-medium">创建角色</div>
            <div className="text-[#6a6a7a] text-xs mt-1">打造专属骑士</div>
          </div>
          <div className="p-4 rounded-lg bg-[#12121a]/80 backdrop-blur-sm border border-[#00d4ff]/10 hover:border-[#00d4ff]/30 transition-colors group">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[#00d4ff]/20 mb-2 group-hover:bg-[#00d4ff]/30 transition-colors">
              <Users className="w-5 h-5 text-[#00d4ff]" />
            </div>
            <div className="text-[#e8e8f0] font-medium">多人房间</div>
            <div className="text-[#6a6a7a] text-xs mt-1">在线跑团</div>
          </div>
          <div className="p-4 rounded-lg bg-[#12121a]/80 backdrop-blur-sm border border-[#ffd700]/10 hover:border-[#ffd700]/30 transition-colors group">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[#ffd700]/20 mb-2 group-hover:bg-[#ffd700]/30 transition-colors">
              <Bot className="w-5 h-5 text-[#ffd700]" />
            </div>
            <div className="text-[#e8e8f0] font-medium">AI主持</div>
            <div className="text-[#6a6a7a] text-xs mt-1">智能DM</div>
          </div>
        </div>
      </div>
    </div>
  );
}
