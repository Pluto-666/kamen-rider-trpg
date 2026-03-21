'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Download, 
  Trash2, 
  MoreVertical, 
  Save, 
  User, 
  Swords, 
  Shield,
  Heart,
  Sparkles,
} from 'lucide-react';

// 角色卡类型定义（与数据库返回字段一致，使用snake_case）
interface Character {
  id: string;
  user_id: string;
  name: string;
  title?: string;
  player_name?: string;
  image_url?: string;
  race: string;
  occupation?: string;
  age?: number;
  gender?: string;
  active_power: number;
  attributes: {
    // 主能力值
    body: number;
    bodyRace: number;
    bodyJob: number;
    bodyNormal: number;
    bodyTransform: number;
    athletics: number;
    athleticsRace: number;
    athleticsJob: number;
    athleticsNormal: number;
    athleticsTransform: number;
    dexterity: number;
    dexterityRace: number;
    dexterityJob: number;
    dexterityNormal: number;
    dexterityTransform: number;
    will: number;
    willRace: number;
    willJob: number;
    willNormal: number;
    willTransform: number;
    wit: number;
    witRace: number;
    witJob: number;
    witNormal: number;
    witTransform: number;
    // 副能力值
    movement: number;
    movementRace: number;
    movementJob: number;
    movementNormal: number;
    movementTransform: number;
    movementBonus: number;
    initiative: number;
    initiativeRace: number;
    initiativeJob: number;
    initiativeNormal: number;
    initiativeTransform: number;
    initiativeBonus: number;
    // HP
    additionalHP: number;
    bodyHP: number;
    totalHP: number;
    transformHP: number;
  };
  fate_points?: {
    points: number;
    history: string[];
  };
  weapons?: Array<{
    name: string;
    range: string;
    hit: number;
    hitBonus: number;
    hitTotal: number;
    dp: number;
    dpBonus: number;
    dpTotal: number;
    attribute: string;
    uses: number;
    note: string;
  }>;
  armors?: Array<{
    name: string;
    dodge: number;
    dodgeBonus: number;
    dodgeTotal: number;
    parry: number;
    parryBonus: number;
    parryTotal: number;
    additionalHP: number;
    fixed: boolean;
    note: string;
  }>;
  other_equipment?: string;
  vehicle?: {
    name: string;
    movement: number;
    hp: number;
    passengers: number;
    dodge: number;
    parry: number;
    fate_points: number;
  };
  configs?: Array<{
    category: string;
    name: string;
    level: number;
    reference: string;
  }>;
  background?: string;
  rider_data?: {
    riderSystem: string;
    transformationItem: string;
    finisherMoves: string[];
    specialAbilities: string[];
    transformationPhrase?: string;
  };
  action_cards?: Array<{
    type: string;
    category: string;
    name: string;
    cards: number;
    used: boolean;
    description: string;
  }>;
  episodes?: Array<{
    episode: number;
    title: string;
    summary: string;
  }>;
  created_at: string;
  updated_at: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// 从对话中提取角色数据
function extractCharacterFromChat(chatHistory: ChatMessage[]): Partial<Character> {
  const allText = chatHistory.map(m => m.content).join('\n');
  
  const character: Partial<Character> = {};
  
  // 提取角色名 - 更宽松的匹配
  const namePatterns = [
    /(?:角色名[：:]?\s*|名字[：:]?\s*|名称[：:]?\s*|我叫[：:]?\s*|名字是[：:]?\s*)([^\n，。！？]+)/,
    /【已记录】[^】]*?[姓名][：:]\s*([^\n，。！？【】]+)/,
    /好的[，,]?\s*(?:我记住了|记住)[：:]?\s*([^\n，。！？的]+?)(?:的|名字)/,
    /(?:姓名|名称)[：:]\s*([^\n，。！？]+)/,
  ];
  for (const pattern of namePatterns) {
    const match = allText.match(pattern);
    if (match && match[1].trim().length > 0 && match[1].trim().length < 20) {
      character.name = match[1].trim();
      break;
    }
  }
  
  // 提取玩家名
  const playerMatch = allText.match(/(?:玩家名[：:]?\s*|玩家[：:]?\s*)([^\n，。！？]+)/);
  if (playerMatch) character.player_name = playerMatch[1].trim();
  
  // 提取年龄
  const ageMatch = allText.match(/(?:年龄[：:]?\s*|岁[：:]?\s*|今年[：:]?\s*)(\d+)/);
  if (ageMatch) character.age = parseInt(ageMatch[1]);
  
  // 提取性别
  const genderMatch = allText.match(/(?:性别[：:]?\s*)(男|女|其他)/);
  if (genderMatch) character.gender = genderMatch[1];
  
  // 提取种族
  const raceMatch = allText.match(/(?:种族[：:]?\s*)([^\n，。！？]+)/);
  if (raceMatch) character.race = raceMatch[1].trim();
  
  // 提取职业
  const jobMatch = allText.match(/(?:职业[：:]?\s*|工作[：:]?\s*)([^\n，。！？]+)/);
  if (jobMatch) character.occupation = jobMatch[1].trim();
  
  // 提取背景故事
  const bgMatch = allText.match(/(?:背景[：:]?\s*|故事[：:]?\s*|背景故事[：:]?\s*)([^\n]+(?:\n[^\n]+)*)/);
  if (bgMatch) character.background = bgMatch[1].trim();
  
  // 提取骑士系统
  const riderMatch = allText.match(/(?:骑士系统[：:]?\s*|变身道具[：:]?\s*|骑士称号[：:]?\s*)([^\n，。！？]+)/);
  if (riderMatch) {
    character.rider_data = {
      riderSystem: riderMatch[1].trim(),
      transformationItem: '',
      finisherMoves: [],
      specialAbilities: [],
    };
  }
  
  // 提取必杀技
  const finisherMatch = allText.match(/(?:必杀技[：:]?\s*)([^\n，。！？]+)/);
  if (finisherMatch && character.rider_data) {
    character.rider_data.finisherMoves = [finisherMatch[1].trim()];
  }
  
  return character;
}

export default function CharactersPage() {
  const router = useRouter();
  const { user, profile, logout, isAuthenticated, isLoading: authLoading, token } = useAuth();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [userInput, setUserInput] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentResponse, setCurrentResponse] = useState('');
  const [currentCharacterData, setCurrentCharacterData] = useState<Partial<Character>>({});
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);
  const [pendingCharacterData, setPendingCharacterData] = useState<Partial<Character>>({});
  const [editingName, setEditingName] = useState('');
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
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatHistory, currentResponse]);

  const fetchCharacters = async () => {
    try {
      const response = await fetch(`/api/characters?user_id=${user?.id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setCharacters(data.characters || []);
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
    setCurrentCharacterData({});
    setUserInput('');
    setChatHistory([]);
    setCurrentResponse('');
  };

  const handleSendMessage = async () => {
    if (!userInput.trim() || isStreaming) return;

    const userMessage = userInput.trim();
    setUserInput('');
    
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
          characterData: currentCharacterData,
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
              if (parsed.type === 'character_data') {
                setCurrentCharacterData(parsed.data);
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

  // 打开保存确认对话框
  const openSaveConfirm = () => {
    const extractedData = extractCharacterFromChat(chatHistory);
    
    const characterToSave = {
      ...currentCharacterData,
      ...extractedData,
      user_id: user?.id,
    };
    
    setPendingCharacterData(characterToSave);
    setEditingName(characterToSave.name || '');
    setConfirmSaveOpen(true);
  };

  // 确认保存角色卡
  const confirmSaveCharacter = async () => {
    if (!editingName.trim()) {
      toast.error('请输入角色名称');
      return;
    }
    
    const characterToSave = {
      ...pendingCharacterData,
      name: editingName.trim(),
    };

    try {
      const response = await fetch('/api/characters', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(characterToSave),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success('角色卡保存成功！');
        setConfirmSaveOpen(false);
        setCreateDialogOpen(false);
        fetchCharacters();
      } else {
        const error = await response.json();
        toast.error(error.error || '保存失败');
      }
    } catch (error) {
      console.error('保存角色卡失败:', error);
      toast.error('保存角色卡失败');
    }
  };

  const handleDeleteCharacter = async (characterId: string) => {
    if (!confirm('确定要删除这个角色卡吗？')) return;

    try {
      const response = await fetch(`/api/characters/${characterId}?user_id=${user?.id}`, {
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

  // 导出角色卡为xlsx
  const handleExportCharacter = async (characterId: string) => {
    try {
      const response = await fetch(`/api/characters/${characterId}/export`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('导出失败');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `character_sheet.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success('角色卡导出成功！');
    } catch (error) {
      console.error('导出角色卡失败:', error);
      toast.error('导出失败');
    }
  };

  const handleViewCharacter = (character: Character) => {
    setSelectedCharacter(character);
    setDetailDialogOpen(true);
  };

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  const getAttributeDisplay = (value: number) => {
    const modifier = Math.floor((value - 10) / 2);
    return `${value} (${modifier >= 0 ? '+' : ''}${modifier})`;
  };

  if (authLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
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
      <header className="border-b bg-card sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/lobby" className="flex items-center gap-2">
            <Swords className="h-6 w-6 text-primary" />
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
                    <AvatarImage src={profile?.avatar} />
                    <AvatarFallback>
                      {profile?.username?.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:inline">{profile?.username || profile?.display_name || '用户'}</span>
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
            <User className="mr-2 h-4 w-4" />
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
              <User className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">你还没有创建任何角色卡</p>
              <Button onClick={handleStartCreation}>创建第一个角色</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {characters.map((character) => (
              <Card 
                key={character.id} 
                className="hover:shadow-lg transition-all cursor-pointer group"
                onClick={() => handleViewCharacter(character)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={character.image_url} />
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {character.name?.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <CardTitle className="text-xl">{character.name}</CardTitle>
                        {character.player_name && (
                          <CardDescription className="text-sm">
                            玩家: {character.player_name}
                          </CardDescription>
                        )}
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          handleExportCharacter(character.id);
                        }}>
                          <Download className="mr-2 h-4 w-4" />
                          导出xlsx
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCharacter(character.id);
                          }}
                          className="text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          删除角色
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Basic Info */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {character.race && (
                      <Badge variant="secondary">{character.race}</Badge>
                    )}
                    {character.occupation && (
                      <Badge variant="outline">{character.occupation}</Badge>
                    )}
                    {character.age && (
                      <Badge variant="outline">{character.age}岁</Badge>
                    )}
                    {character.gender && (
                      <Badge variant="outline">{character.gender}</Badge>
                    )}
                  </div>

                  {/* Attributes Summary */}
                  <div className="grid grid-cols-5 gap-1 mb-4 text-xs">
                    {[
                      { name: '肉体', value: character.attributes?.bodyNormal || 0 },
                      { name: '运动', value: character.attributes?.athleticsNormal || 0 },
                      { name: '器用', value: character.attributes?.dexterityNormal || 0 },
                      { name: '意志', value: character.attributes?.willNormal || 0 },
                      { name: '机知', value: character.attributes?.witNormal || 0 },
                    ].map((attr) => (
                      <div key={attr.name} className="text-center p-1.5 bg-muted rounded">
                        <div className="text-muted-foreground">{attr.name}</div>
                        <div className="font-bold text-sm">{attr.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* HP */}
                  <div className="flex items-center gap-2 text-sm">
                    <Heart className="h-4 w-4 text-red-500" />
                    <span>HP: {character.attributes?.totalHP || 0}</span>
                    {character.active_power && (
                      <>
                        <Separator orientation="vertical" className="h-4" />
                        <Sparkles className="h-4 w-4 text-yellow-500" />
                        <span>活跃力: {character.active_power}</span>
                      </>
                    )}
                  </div>

                  {/* Rider System */}
                  {character.rider_data?.riderSystem && (
                    <div className="mt-3 text-sm text-muted-foreground">
                      <Swords className="h-4 w-4 inline mr-1" />
                      {character.rider_data.riderSystem}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* AI Character Creation Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-3xl h-[85vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI角色创建助手
            </DialogTitle>
            <DialogDescription>
              和AI一起创建你的假面骑士角色，AI会记住你说的所有信息
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {/* Chat History */}
            <ScrollArea className="flex-1 min-h-0 max-h-[50vh] p-4 bg-muted/30 rounded-lg mb-3" ref={scrollRef}>
              <div className="space-y-4">
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
                        <div className="text-xs text-muted-foreground mb-1 font-medium flex items-center gap-1">
                          <Sparkles className="h-3 w-3" />
                          DM
                        </div>
                      )}
                      <div className="whitespace-pre-wrap text-sm">{msg.content}</div>
                    </div>
                  </div>
                ))}
                
                {currentResponse && (
                  <div className="flex justify-start">
                    <div className="max-w-[80%] p-3 rounded-lg bg-card border">
                      <div className="text-xs text-muted-foreground mb-1 font-medium flex items-center gap-1">
                        <Sparkles className="h-3 w-3" />
                        DM
                      </div>
                      <div className="whitespace-pre-wrap text-sm">
                        {currentResponse}
                        <span className="animate-pulse">▌</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Current Character Data - Compact */}
            {Object.keys(currentCharacterData).length > 0 && (
              <div className="flex-shrink-0 mb-3 p-2 bg-primary/5 rounded-lg border">
                <div className="text-xs font-medium text-muted-foreground mb-1">已记录信息</div>
                <div className="flex flex-wrap gap-1">
                  {currentCharacterData.name && (
                    <Badge variant="secondary" className="text-xs">姓名: {currentCharacterData.name}</Badge>
                  )}
                  {currentCharacterData.age && (
                    <Badge variant="outline" className="text-xs">{currentCharacterData.age}岁</Badge>
                  )}
                  {currentCharacterData.gender && (
                    <Badge variant="outline" className="text-xs">{currentCharacterData.gender}</Badge>
                  )}
                  {currentCharacterData.race && (
                    <Badge variant="outline" className="text-xs">{currentCharacterData.race}</Badge>
                  )}
                  {currentCharacterData.occupation && (
                    <Badge variant="outline" className="text-xs">{currentCharacterData.occupation}</Badge>
                  )}
                </div>
              </div>
            )}

            {/* Input Area */}
            <div className="flex-shrink-0 space-y-2">
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
                className="min-h-[60px] max-h-[120px] resize-none text-sm"
              />
              <div className="flex justify-between items-center pt-1">
                <p className="text-xs text-muted-foreground hidden sm:block">
                  告诉AI角色名称、年龄、性别、背景等
                </p>
                <div className="flex gap-2 ml-auto">
                  <Button variant="ghost" size="sm" onClick={() => setCreateDialogOpen(false)}>
                    取消
                  </Button>
                  <Button 
                    variant="secondary"
                    size="sm"
                    onClick={openSaveConfirm}
                    disabled={isStreaming || chatHistory.length < 2}
                  >
                    <Save className="mr-1 h-3 w-3" />
                    保存
                  </Button>
                  <Button 
                    size="sm"
                    onClick={handleSendMessage} 
                    disabled={isStreaming || !userInput.trim()}
                  >
                    {isStreaming ? '思考中...' : '发送'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Character Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="sm:max-w-2xl h-[85vh] flex flex-col">
          {selectedCharacter && (
            <>
              <DialogHeader className="flex-shrink-0">
                <DialogTitle className="flex items-center gap-2">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={selectedCharacter.image_url} />
                    <AvatarFallback>{selectedCharacter.name?.charAt(0)}</AvatarFallback>
                  </Avatar>
                  {selectedCharacter.name}
                </DialogTitle>
                <DialogDescription>
                  {selectedCharacter.player_name && `玩家: ${selectedCharacter.player_name}`}
                </DialogDescription>
              </DialogHeader>

              <ScrollArea className="flex-1 min-h-0">
                <div className="space-y-4 pr-4">
                  {/* Basic Info */}
                  <div>
                    <h4 className="font-semibold mb-2 flex items-center gap-2 text-sm">
                      <User className="h-4 w-4" />
                      基本信息
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedCharacter.race && (
                        <Badge variant="secondary" className="text-xs">种族: {selectedCharacter.race}</Badge>
                      )}
                      {selectedCharacter.occupation && (
                        <Badge variant="outline" className="text-xs">职业: {selectedCharacter.occupation}</Badge>
                      )}
                      {selectedCharacter.age && (
                        <Badge variant="outline" className="text-xs">{selectedCharacter.age}岁</Badge>
                      )}
                      {selectedCharacter.gender && (
                        <Badge variant="outline" className="text-xs">{selectedCharacter.gender}</Badge>
                      )}
                      {selectedCharacter.active_power && (
                        <Badge className="text-xs">活跃力: {selectedCharacter.active_power}</Badge>
                      )}
                    </div>
                  </div>

                  {/* Attributes */}
                  <div>
                    <h4 className="font-semibold mb-2 text-sm">能力值（通常 / 变身后）</h4>
                    <div className="grid grid-cols-5 gap-2 text-center text-xs">
                      {[
                        { name: '肉体', normal: selectedCharacter.attributes?.bodyNormal, transform: selectedCharacter.attributes?.bodyTransform },
                        { name: '运动', normal: selectedCharacter.attributes?.athleticsNormal, transform: selectedCharacter.attributes?.athleticsTransform },
                        { name: '器用', normal: selectedCharacter.attributes?.dexterityNormal, transform: selectedCharacter.attributes?.dexterityTransform },
                        { name: '意志', normal: selectedCharacter.attributes?.willNormal, transform: selectedCharacter.attributes?.willTransform },
                        { name: '机知', normal: selectedCharacter.attributes?.witNormal, transform: selectedCharacter.attributes?.witTransform },
                      ].map((attr) => (
                        <div key={attr.name} className="p-2 bg-muted rounded">
                          <div className="text-muted-foreground">{attr.name}</div>
                          <div className="font-bold">{attr.normal || 0}</div>
                          <div className="text-primary">变身: {attr.transform || 0}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Secondary Attributes */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-semibold mb-1 text-sm">移动力</h4>
                      <div className="text-xs">
                        通常: {selectedCharacter.attributes?.movementNormal || 0} / 
                        变身: {selectedCharacter.attributes?.movementTransform || 0}
                      </div>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-1 text-sm">先制力</h4>
                      <div className="text-xs">
                        通常: {selectedCharacter.attributes?.initiativeNormal || 0} / 
                        变身: {selectedCharacter.attributes?.initiativeTransform || 0}
                      </div>
                    </div>
                  </div>

                  {/* HP */}
                  <div>
                    <h4 className="font-semibold mb-1 flex items-center gap-2 text-sm">
                      <Heart className="h-4 w-4 text-red-500" />
                      HP
                    </h4>
                    <div className="text-xs">
                      通常: {selectedCharacter.attributes?.totalHP || 0} / 
                      变身: {selectedCharacter.attributes?.transformHP || 0}
                    </div>
                  </div>

                  {/* Rider Data */}
                  {selectedCharacter.rider_data && (
                    <div>
                      <h4 className="font-semibold mb-1 flex items-center gap-2 text-sm">
                        <Swords className="h-4 w-4" />
                        骑士系统
                      </h4>
                      <div className="space-y-1 text-xs">
                        {selectedCharacter.rider_data.riderSystem && (
                          <div>系统: {selectedCharacter.rider_data.riderSystem}</div>
                        )}
                        {selectedCharacter.rider_data.transformationItem && (
                          <div>变身道具: {selectedCharacter.rider_data.transformationItem}</div>
                        )}
                        {selectedCharacter.rider_data.transformationPhrase && (
                          <div>变身口号: {selectedCharacter.rider_data.transformationPhrase}</div>
                        )}
                        {selectedCharacter.rider_data.finisherMoves && selectedCharacter.rider_data.finisherMoves.length > 0 && (
                          <div>必杀技: {selectedCharacter.rider_data.finisherMoves.join(', ')}</div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Background */}
                  {selectedCharacter.background && (
                    <div>
                      <h4 className="font-semibold mb-1 text-sm">背景故事</h4>
                      <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                        {selectedCharacter.background}
                      </p>
                    </div>
                  )}

                  {/* Weapons */}
                  {selectedCharacter.weapons && selectedCharacter.weapons.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-1 flex items-center gap-2 text-sm">
                        <Swords className="h-4 w-4" />
                        武器
                      </h4>
                      <div className="space-y-1">
                        {selectedCharacter.weapons.map((weapon, idx) => (
                          <div key={idx} className="p-2 bg-muted rounded text-xs">
                            <div className="font-medium">{weapon.name}</div>
                            <div className="text-muted-foreground">
                              射程: {weapon.range} | 命中: {weapon.hitTotal} | DP: {weapon.dpTotal}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Equipment */}
                  {selectedCharacter.other_equipment && (
                    <div>
                      <h4 className="font-semibold mb-1 flex items-center gap-2 text-sm">
                        <Shield className="h-4 w-4" />
                        其他装备
                      </h4>
                      <p className="text-xs text-muted-foreground">{selectedCharacter.other_equipment}</p>
                    </div>
                  )}
                </div>
              </ScrollArea>

              <DialogFooter className="flex-shrink-0">
                <Button variant="outline" size="sm" onClick={() => setDetailDialogOpen(false)}>
                  关闭
                </Button>
                <Button size="sm" onClick={() => {
                  handleExportCharacter(selectedCharacter.id);
                  setDetailDialogOpen(false);
                }}>
                  <Download className="mr-1 h-3 w-3" />
                  导出xlsx
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* 保存确认对话框 */}
      <Dialog open={confirmSaveOpen} onOpenChange={setConfirmSaveOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>保存角色卡</DialogTitle>
            <DialogDescription>
              确认角色信息并保存
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">角色名称 *</label>
              <Input
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                placeholder="输入角色名称"
              />
            </div>
            
            {pendingCharacterData.race && (
              <div className="text-sm">
                <span className="text-muted-foreground">种族:</span> {pendingCharacterData.race}
              </div>
            )}
            
            {pendingCharacterData.age && (
              <div className="text-sm">
                <span className="text-muted-foreground">年龄:</span> {pendingCharacterData.age}
              </div>
            )}
            
            {pendingCharacterData.gender && (
              <div className="text-sm">
                <span className="text-muted-foreground">性别:</span> {pendingCharacterData.gender}
              </div>
            )}
            
            {pendingCharacterData.occupation && (
              <div className="text-sm">
                <span className="text-muted-foreground">职业:</span> {pendingCharacterData.occupation}
              </div>
            )}
            
            {pendingCharacterData.background && (
              <div className="text-sm">
                <span className="text-muted-foreground">背景:</span> {pendingCharacterData.background}
              </div>
            )}
            
            {pendingCharacterData.rider_data?.riderSystem && (
              <div className="text-sm">
                <span className="text-muted-foreground">骑士系统:</span> {pendingCharacterData.rider_data.riderSystem}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmSaveOpen(false)}>
              取消
            </Button>
            <Button onClick={confirmSaveCharacter}>
              <Save className="mr-1 h-3 w-3" />
              确认保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
