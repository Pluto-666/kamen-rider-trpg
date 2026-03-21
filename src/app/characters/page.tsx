'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface Character {
  id: string;
  name: string;
  title?: string;
  age?: number;
  gender?: string;
  background?: string;
  attributes: {
    strength: number;
    dexterity: number;
    constitution: number;
    intelligence: number;
    wisdom: number;
    charisma: number;
    hp: number;
    maxHp: number;
    mp: number;
    maxMp: number;
  };
  skills?: Array<{ name: string; level: number; description: string }>;
  riderData?: {
    riderSystem: string;
    transformationItem: string;
    finisherMoves: string[];
    specialAbilities: string[];
  };
  created_at: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export default function CharactersPage() {
  const router = useRouter();
  const { user, profile, logout, isAuthenticated, isLoading: authLoading, token } = useAuth();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [userInput, setUserInput] = useState('');
  const [characterData, setCharacterData] = useState<Partial<Character>>({});
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentResponse, setCurrentResponse] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/');
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated && token) {
      fetchCharacters();
    }
  }, [isAuthenticated, token]);

  useEffect(() => {
    // 自动滚动到底部
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatHistory, currentResponse]);

  const fetchCharacters = async () => {
    try {
      const response = await fetch('/api/characters', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setCharacters(data.data || []);
      }
    } catch (error) {
      console.error('获取角色卡失败:', error);
      toast.error('获取角色卡失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartCreation = () => {
    setCreateDialogOpen(true);
    setCharacterData({});
    setUserInput('');
    setChatHistory([]);
    setCurrentResponse('');
  };

  const handleSendMessage = async () => {
    if (!userInput.trim() || isStreaming) return;

    const userMessage = userInput.trim();
    setUserInput('');
    
    // 添加用户消息到历史
    const newUserHistory = [...chatHistory, { role: 'user' as const, content: userMessage }];
    setChatHistory(newUserHistory);
    setIsStreaming(true);
    setCurrentResponse('');

    try {
      const response = await fetch('/api/ai/create-character', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          characterData,
          dialogHistory: newUserHistory,
          userMessage,
        }),
      });

      if (!response.ok) {
        throw new Error('AI响应失败');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('Response body is null');
      }

      let fullResponse = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              break;
            }
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                fullResponse += parsed.content;
                setCurrentResponse(fullResponse);
              }
              if (parsed.error) {
                toast.error(parsed.error);
              }
            } catch {
              // 忽略解析错误
            }
          }
        }
      }

      // 添加AI回复到历史
      if (fullResponse) {
        setChatHistory(prev => [...prev, { role: 'assistant', content: fullResponse }]);
      }
      
      setCurrentResponse('');
    } catch (error) {
      console.error('AI角色创建失败:', error);
      toast.error('AI响应失败，请重试');
    } finally {
      setIsStreaming(false);
    }
  };

  // 保存角色卡
  const handleSaveCharacter = async () => {
    // 从对话中提取角色信息并保存
    try {
      // 这里可以解析对话历史来提取角色信息
      // 或者让用户手动填写
      const response = await fetch('/api/characters', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: characterData.name || '未命名角色',
          title: characterData.title,
          age: characterData.age,
          gender: characterData.gender,
          background: characterData.background,
          attributes: characterData.attributes || {
            strength: 10, dexterity: 10, constitution: 10,
            intelligence: 10, wisdom: 10, charisma: 10,
            hp: 10, maxHp: 10, mp: 10, maxMp: 10,
          },
        }),
      });

      if (response.ok) {
        toast.success('角色卡保存成功');
        setCreateDialogOpen(false);
        fetchCharacters();
      }
    } catch (error) {
      console.error('保存角色卡失败:', error);
      toast.error('保存角色卡失败');
    }
  };

  const handleDeleteCharacter = async (characterId: string) => {
    if (!confirm('确定要删除这个角色卡吗？')) return;

    try {
      const response = await fetch(`/api/characters/${characterId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        toast.success('角色卡已删除');
        fetchCharacters();
      } else {
        toast.error('删除失败');
      }
    } catch (error) {
      console.error('删除角色卡失败:', error);
      toast.error('删除失败');
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  const getAttributeName = (attr: string) => {
    const names: Record<string, string> = {
      strength: '力量',
      dexterity: '敏捷',
      constitution: '体质',
      intelligence: '智力',
      wisdom: '感知',
      charisma: '魅力',
      hp: '生命值',
      maxHp: '最大HP',
      mp: '精神力',
      maxMp: '最大MP',
    };
    return names[attr] || attr;
  };

  const getAttributeModifier = (value: number) => {
    const modifier = Math.floor((value - 10) / 2);
    return modifier >= 0 ? `+${modifier}` : `${modifier}`;
  };

  if (authLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/lobby">
            <h1 className="text-2xl font-bold hover:text-primary transition-colors cursor-pointer">
              假面骑士 TRPG
            </h1>
          </Link>

          <div className="flex items-center gap-4">
            <Link href="/lobby">
              <Button variant="outline">返回大厅</Button>
            </Link>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>
                      {profile?.username?.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <span>{profile?.username || profile?.display_name || '用户'}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>我的账户</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  退出登录
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-3xl font-bold">我的角色卡</h2>
            <p className="text-muted-foreground mt-1">管理你的假面骑士角色</p>
          </div>

          <Button onClick={handleStartCreation} size="lg">
            创建新角色
          </Button>
        </div>

        {/* Character List */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">加载角色卡...</p>
          </div>
        ) : characters.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <p className="text-muted-foreground mb-4">你还没有创建任何角色卡</p>
              <Button onClick={handleStartCreation}>创建第一个角色</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {characters.map((character) => (
              <Card key={character.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-xl">{character.name}</CardTitle>
                      {character.title && (
                        <CardDescription className="text-base">
                          {character.title}
                        </CardDescription>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">...</Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => handleDeleteCharacter(character.id)}>
                          删除角色
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Basic Info */}
                  <div className="flex gap-4 mb-4 text-sm text-muted-foreground">
                    {character.age && <span>年龄: {character.age}</span>}
                    {character.gender && <span>性别: {character.gender}</span>}
                  </div>

                  {/* Attributes */}
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    {['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'].map((attr) => (
                      <div key={attr} className="text-center p-2 bg-muted rounded">
                        <div className="text-xs text-muted-foreground">{getAttributeName(attr)}</div>
                        <div className="font-bold">
                          {character.attributes?.[attr as keyof typeof character.attributes] || 10}
                        </div>
                        <div className="text-xs text-primary">
                          {getAttributeModifier(character.attributes?.[attr as keyof typeof character.attributes] || 10)}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* HP/MP */}
                  <div className="flex gap-4 mb-4">
                    <div className="flex-1">
                      <div className="text-xs text-muted-foreground">HP</div>
                      <div className="font-medium">
                        {character.attributes?.hp || 0}/{character.attributes?.maxHp || 0}
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="text-xs text-muted-foreground">MP</div>
                      <div className="font-medium">
                        {character.attributes?.mp || 0}/{character.attributes?.maxMp || 0}
                      </div>
                    </div>
                  </div>

                  {/* Rider Data */}
                  {character.riderData && (
                    <>
                      <Separator className="my-3" />
                      <div className="text-sm">
                        <div className="font-medium mb-1">骑士系统</div>
                        <div className="text-muted-foreground">{character.riderData.riderSystem}</div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* AI Character Creation Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>🎭 AI角色创建助手</DialogTitle>
            <DialogDescription>
              和AI一起创建你的假面骑士角色，AI会记住你说的所有信息
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col h-[60vh]">
            {/* Chat History */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 bg-muted/30 rounded-lg mb-4 space-y-4">
              {chatHistory.length === 0 && !currentResponse && (
                <div className="text-center text-muted-foreground py-8">
                  <p className="text-lg mb-2">👋 欢迎来到角色创建！</p>
                  <p>请告诉我你想创建什么样的假面骑士角色？</p>
                  <p className="text-sm mt-2">例如：我想创建一个假面骑士，名字叫...</p>
                </div>
              )}
              
              {chatHistory.map((msg, index) => (
                <div
                  key={index}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] p-3 rounded-lg ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-card border'
                    }`}
                  >
                    {msg.role === 'assistant' && (
                      <div className="text-xs text-muted-foreground mb-1 font-medium">🎭 DM</div>
                    )}
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  </div>
                </div>
              ))}
              
              {/* 当前正在生成的回复 */}
              {currentResponse && (
                <div className="flex justify-start">
                  <div className="max-w-[80%] p-3 rounded-lg bg-card border">
                    <div className="text-xs text-muted-foreground mb-1 font-medium">🎭 DM</div>
                    <div className="whitespace-pre-wrap">
                      {currentResponse}
                      <span className="animate-pulse">▌</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Input Area */}
            <div className="space-y-3">
              <Textarea
                placeholder="输入你的想法...（按Enter发送，Shift+Enter换行）"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                disabled={isStreaming}
                className="min-h-[80px] resize-none"
              />
              <div className="flex justify-between items-center">
                <p className="text-xs text-muted-foreground">
                  提示：告诉AI你的角色名称、称号、背景、属性等信息
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                    取消
                  </Button>
                  <Button 
                    onClick={handleSendMessage} 
                    disabled={isStreaming || !userInput.trim()}
                  >
                    {isStreaming ? 'AI思考中...' : '发送'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
