'use client';

import { useEffect, useState } from 'react';
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Swords, Users, Bot, Plus, DoorOpen, Gamepad2, Save, Shield, Sparkles, Lock, Unlock, Play, Clock } from 'lucide-react';

interface Room {
  id: string;
  name: string;
  description?: string;
  status: string;
  max_players: number;
  is_private: boolean;
  created_at: string;
  profiles?: {
    id: string;
    username: string;
    display_name?: string;
    avatar?: string;
  };
  _memberCount?: number;
}

interface SavedGame {
  id: string;
  scenarioName: string;
  chapter: number;
  status: string;
  lastSavedAt: string;
  startedAt: string;
  myCharacterName: string;
  gameState: Record<string, unknown>;
  roomId: string;
}

export default function LobbyPage() {
  const router = useRouter();
  const { user, profile, logout, isAuthenticated, isLoading: authLoading, token } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [savedGames, setSavedGames] = useState<SavedGame[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingSaves, setIsLoadingSaves] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('rooms');
  
  // 创建房间表单
  const [roomName, setRoomName] = useState('');
  const [roomDescription, setRoomDescription] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(6);
  const [isPrivate, setIsPrivate] = useState(false);
  const [roomPassword, setRoomPassword] = useState('');

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/');
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated && token) {
      fetchRooms();
      fetchSavedGames();
    }
  }, [isAuthenticated, token]);

  const fetchRooms = async () => {
    try {
      const response = await fetch('/api/rooms?status=waiting', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setRooms(data.data || []);
      }
    } catch (error) {
      console.error('获取房间列表失败:', error);
      toast.error('获取房间列表失败');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSavedGames = async () => {
    setIsLoadingSaves(true);
    try {
      // 从 game_saves 表获取存档列表
      const response = await fetch('/api/saves', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        // 处理存档数据格式
        const savedGames = (data.data || []).map((save: any) => ({
          id: save.id,
          scenarioName: save.current_scene?.scenarioName || save.room_snapshot?.name || '未知剧本',
          chapter: save.current_scene?.chapter || 1,
          status: 'active',
          lastSavedAt: save.created_at,
          startedAt: save.created_at,
          myCharacterName: save.metadata?.characterName || '未知角色',
          gameState: save.current_scene?.gameState || {},
          roomId: save.room_id,
        }));
        setSavedGames(savedGames);
      }
    } catch (error) {
      console.error('获取存档列表失败:', error);
    } finally {
      setIsLoadingSaves(false);
    }
  };

  const handleRestoreGame = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}/restore`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        toast.success('存档恢复成功');
        router.push(`/room/${data.data.roomId}`);
      } else {
        const error = await response.json();
        toast.error(error.error || '恢复存档失败');
      }
    } catch (error) {
      console.error('恢复存档失败:', error);
      toast.error('恢复存档失败');
    }
  };

  const handleDeleteSave = async (saveId: string, saveName: string) => {
    if (!confirm(`确定要删除存档「${saveName}」吗？此操作不可撤销。`)) {
      return;
    }

    try {
      const response = await fetch(`/api/saves/${saveId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        setSavedGames(prev => prev.filter(s => s.id !== saveId));
        toast.success('存档已删除');
      } else {
        const error = await response.json();
        toast.error(error.error || '删除存档失败');
      }
    } catch (error) {
      console.error('删除存档失败:', error);
      toast.error('删除存档失败');
    }
  };

  const handleCreateRoom = async () => {
    if (!roomName.trim()) {
      toast.error('请输入房间名称');
      return;
    }

    try {
      const response = await fetch('/api/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: roomName,
          description: roomDescription,
          max_players: maxPlayers,
          is_private: isPrivate,
          password: isPrivate ? roomPassword : null,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success('房间创建成功');
        setCreateDialogOpen(false);
        router.push(`/room/${data.data.id}`);
      } else {
        const error = await response.json();
        toast.error(error.error || '创建房间失败');
      }
    } catch (error) {
      console.error('创建房间失败:', error);
      toast.error('创建房间失败');
    }
  };

  const handleJoinRoom = async (roomId: string, isPrivate: boolean) => {
    let password = null;
    if (isPrivate) {
      password = prompt('请输入房间密码');
      if (!password) return;
    }

    try {
      const response = await fetch(`/api/rooms/${roomId}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ password }),
      });

      if (response.ok) {
        toast.success('成功加入房间');
        router.push(`/room/${roomId}`);
      } else {
        const error = await response.json();
        toast.error(error.error || '加入房间失败');
      }
    } catch (error) {
      console.error('加入房间失败:', error);
      toast.error('加入房间失败');
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  if (authLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f] relative overflow-hidden">
        {/* 背景图 */}
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-20"
          style={{ backgroundImage: 'url(/kamen-rider-bg-1.jpeg)' }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a0f] via-[#0a0a0f]/90 to-[#1a1a25]" />
        
        <div className="text-center relative z-10">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#c41e3a] mx-auto"></div>
          <p className="mt-4 text-[#8a8a9a]">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] relative overflow-hidden">
      {/* 背景图 */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-15"
        style={{ backgroundImage: 'url(/kamen-rider-bg-1.jpeg)' }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0f] via-transparent to-[#0a0a0f]" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0f] via-transparent to-[#0a0a0f]" />
      
      {/* 能量线条 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/3 w-px h-full bg-gradient-to-b from-transparent via-[#c41e3a]/15 to-transparent" />
        <div className="absolute top-0 right-1/4 w-px h-full bg-gradient-to-b from-transparent via-[#00d4ff]/15 to-transparent" />
      </div>
      
      {/* Header */}
      <header className="border-b border-[#c41e3a]/20 bg-[#1e1e28]/95 backdrop-blur-sm sticky top-0 z-40">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#c41e3a]/50 to-transparent" />
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#c41e3a] to-[#8b0000] flex items-center justify-center shadow-lg shadow-[#c41e3a]/20">
              <Swords className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold font-display tracking-wide text-[#e8e8f0]">
                假面骑士 <span className="text-[#00d4ff]">TRPG</span>
              </h1>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <Link href="/characters">
              <Button variant="outline" className="border-[#c41e3a]/30 text-[#c0c0c8] hover:border-[#c41e3a] hover:text-[#e8e8f0] hover:bg-[#c41e3a]/10">
                <Shield className="w-4 h-4 mr-2" />
                我的角色
              </Button>
            </Link>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 hover:bg-[#c41e3a]/10">
                  <Avatar className="h-8 w-8 border-2 border-[#c41e3a]/30">
                    <AvatarFallback className="bg-[#c41e3a]/20 text-[#c41e3a]">
                      {profile?.username?.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-[#c0c0c8]">{profile?.username || profile?.display_name || '用户'}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-[#12121a] border-[#c41e3a]/20">
                <DropdownMenuLabel className="text-[#c0c0c8]">我的账户</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-[#c41e3a]/10" />
                <DropdownMenuItem onClick={handleLogout} className="text-[#c0c0c8] hover:text-[#e8e8f0] hover:bg-[#c41e3a]/10 focus:bg-[#c41e3a]/10">
                  退出登录
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 relative z-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold font-display tracking-wide text-[#e8e8f0] flex items-center gap-3">
              <Gamepad2 className="w-8 h-8 text-[#c41e3a]" />
              游戏大厅
            </h2>
            <p className="text-[#8a8a9a] mt-2 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#00d4ff]" />
              选择一个房间加入，或创建新房间开始冒险
            </p>
          </div>

          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="kamen-btn-primary">
                <Plus className="w-4 h-4 mr-2" />
                创建房间
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md kamen-dialog bg-[#1e1e28]/95 backdrop-blur-sm border-[#c41e3a]/35">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-[#e8e8f0]">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#c41e3a] to-[#8b0000] flex items-center justify-center">
                    <Plus className="w-4 h-4 text-white" />
                  </div>
                  创建新房间
                </DialogTitle>
                <DialogDescription className="text-[#8a8a9a]">
                  创建一个新房间，邀请朋友一起跑团
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="room-name" className="text-[#c0c0c8]">房间名称 *</Label>
                  <Input
                    id="room-name"
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    placeholder="给你的房间起个名字"
                    className="bg-[#0a0a0f]/80 border-[#c41e3a]/20 text-[#e8e8f0] placeholder:text-[#6a6a7a] focus:border-[#c41e3a] focus:ring-[#c41e3a]/30"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="room-desc" className="text-[#c0c0c8]">房间描述</Label>
                  <Textarea
                    id="room-desc"
                    value={roomDescription}
                    onChange={(e) => setRoomDescription(e.target.value)}
                    placeholder="简单描述一下这个房间..."
                    rows={3}
                    className="bg-[#0a0a0f]/80 border-[#c41e3a]/20 text-[#e8e8f0] placeholder:text-[#6a6a7a] focus:border-[#c41e3a] focus:ring-[#c41e3a]/30"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max-players" className="text-[#c0c0c8]">最大人数</Label>
                  <Input
                    id="max-players"
                    type="number"
                    min={2}
                    max={10}
                    value={maxPlayers}
                    onChange={(e) => setMaxPlayers(parseInt(e.target.value) || 6)}
                    className="bg-[#0a0a0f]/80 border-[#c41e3a]/20 text-[#e8e8f0] focus:border-[#c41e3a] focus:ring-[#c41e3a]/30"
                  />
                </div>
                <div className="flex items-center space-x-2 p-3 bg-[#0a0a0f]/50 rounded-lg border border-[#c41e3a]/10">
                  <Switch
                    id="private-room"
                    checked={isPrivate}
                    onCheckedChange={setIsPrivate}
                  />
                  <Label htmlFor="private-room" className="text-[#c0c0c8] flex items-center gap-2">
                    {isPrivate ? <Lock className="w-4 h-4 text-[#ffd700]" /> : <Unlock className="w-4 h-4 text-[#6a6a7a]" />}
                    私人房间（需要密码）
                  </Label>
                </div>
                {isPrivate && (
                  <div className="space-y-2">
                    <Label htmlFor="room-password" className="text-[#c0c0c8]">房间密码</Label>
                    <Input
                      id="room-password"
                      type="password"
                      value={roomPassword}
                      onChange={(e) => setRoomPassword(e.target.value)}
                      placeholder="设置房间密码"
                      className="bg-[#0a0a0f]/80 border-[#ffd700]/20 text-[#e8e8f0] placeholder:text-[#6a6a7a] focus:border-[#ffd700] focus:ring-[#ffd700]/30"
                    />
                  </div>
                )}
              </div>
              <DialogFooter className="mt-4 gap-2">
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)} className="border-[#c41e3a]/30 text-[#c0c0c8] hover:border-[#c41e3a] hover:text-[#e8e8f0]">
                  取消
                </Button>
                <Button onClick={handleCreateRoom} className="kamen-btn-primary">创建房间</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <Card className="kamen-card bg-[#1e1e28]/95 backdrop-blur-sm border-[#c41e3a]/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-[#c41e3a]/25 flex items-center justify-center">
                  <Users className="w-6 h-6 text-[#c41e3a]" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-[#e8e8f0]">{rooms.length}</div>
                  <div className="text-sm text-[#9a9aaa]">可用房间</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="kamen-card bg-[#1e1e28]/95 backdrop-blur-sm border-[#00d4ff]/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-[#00d4ff]/25 flex items-center justify-center">
                  <Bot className="w-6 h-6 text-[#00d4ff]" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-[#e8e8f0]">AI主持</div>
                  <div className="text-sm text-[#9a9aaa]">智能DM</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="kamen-card bg-[#1e1e28]/95 backdrop-blur-sm border-[#ffd700]/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-[#ffd700]/25 flex items-center justify-center">
                  <Save className="w-6 h-6 text-[#ffd700]" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-[#e8e8f0]">{savedGames.length}</div>
                  <div className="text-sm text-[#9a9aaa]">游戏存档</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs: Room List & Saved Games */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
          <TabsList className="bg-[#1e1e28]/95 border border-[#c41e3a]/20">
            <TabsTrigger 
              value="rooms"
              className="data-[state=active]:bg-[#c41e3a]/25 data-[state=active]:text-[#e8e8f0] text-[#9a9aaa]"
            >
              <DoorOpen className="w-4 h-4 mr-2" />
              房间列表
            </TabsTrigger>
            <TabsTrigger 
              value="saves"
              className="data-[state=active]:bg-[#c41e3a]/25 data-[state=active]:text-[#e8e8f0] text-[#9a9aaa]"
            >
              <Save className="w-4 h-4 mr-2" />
              我的存档 ({savedGames.length})
            </TabsTrigger>
          </TabsList>

          {/* Room List Tab */}
          <TabsContent value="rooms">
            {isLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#c41e3a] mx-auto"></div>
                <p className="mt-4 text-[#8a8a9a]">加载房间列表...</p>
              </div>
            ) : rooms.length === 0 ? (
              <Card className="text-center py-12 kamen-card bg-[#1e1e28]/95 backdrop-blur-sm">
                <CardContent className="flex flex-col items-center">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#c41e3a]/25 to-[#00d4ff]/15 flex items-center justify-center mb-4">
                    <DoorOpen className="w-10 h-10 text-[#c41e3a]" />
                  </div>
                  <p className="text-[#c0c0c8] mb-2 text-lg">暂无可加入的房间</p>
                  <p className="text-[#6a6a7a] text-sm mb-6">创建第一个房间，开始你的冒险之旅</p>
                  <Button onClick={() => setCreateDialogOpen(true)} className="kamen-btn-primary">
                    <Plus className="w-4 h-4 mr-2" />
                    创建第一个房间
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {rooms.map((room) => (
                  <Card 
                    key={room.id} 
                    className="kamen-card bg-[#1e1e28]/95 backdrop-blur-sm hover:shadow-[0_0_30px_rgba(196,30,58,0.2)] transition-all border-[#c41e3a]/15 hover:border-[#c41e3a]/35 group"
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg text-[#e8e8f0] group-hover:text-[#c41e3a] transition-colors">{room.name}</CardTitle>
                          <CardDescription className="mt-1 text-[#8a8a9a]">
                            房主: {room.profiles?.display_name || room.profiles?.username || '未知'}
                          </CardDescription>
                        </div>
                        <div className="flex gap-1">
                          {room.is_private && (
                            <Badge className="bg-[#ffd700]/20 text-[#ffd700] border-[#ffd700]/30 text-xs">
                              <Lock className="w-3 h-3 mr-1" />
                              私人
                            </Badge>
                          )}
                          <Badge className={room.status === 'waiting' 
                            ? "bg-[#00ff88]/20 text-[#00ff88] border-[#00ff88]/30 text-xs" 
                            : "bg-[#6a6a7a]/20 text-[#c0c0c8] border-[#6a6a7a]/30 text-xs"
                          }>
                            {room.status === 'waiting' ? '等待中' : '游戏中'}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {room.description && (
                        <p className="text-sm text-[#8a8a9a] mb-4 line-clamp-2">
                          {room.description}
                        </p>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-[#c0c0c8] flex items-center gap-1">
                          <Users className="w-4 h-4 text-[#00d4ff]" />
                          人数: <span className="text-[#00d4ff] font-bold">{room._memberCount || 0}</span>/{room.max_players}
                        </span>
                        <Button
                          size="sm"
                          onClick={() => handleJoinRoom(room.id, room.is_private)}
                          disabled={room.status !== 'waiting'}
                          className="kamen-btn-primary"
                        >
                          <Play className="w-3 h-3 mr-1" />
                          加入房间
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Saved Games Tab */}
          <TabsContent value="saves">
            {isLoadingSaves ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#ffd700] mx-auto"></div>
                <p className="mt-4 text-[#8a8a9a]">加载存档列表...</p>
              </div>
            ) : savedGames.length === 0 ? (
              <Card className="text-center py-12 kamen-card bg-[#1e1e28]/95 backdrop-blur-sm">
                <CardContent className="flex flex-col items-center">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#ffd700]/25 to-[#c41e3a]/15 flex items-center justify-center mb-4">
                    <Save className="w-10 h-10 text-[#ffd700]" />
                  </div>
                  <p className="text-[#c0c0c8] mb-2 text-lg">暂无存档记录</p>
                  <p className="text-[#6a6a7a] text-sm">开始新游戏后，游戏进度会自动保存</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {savedGames.map((save) => (
                  <Card 
                    key={save.id} 
                    className="kamen-card bg-[#1e1e28]/95 backdrop-blur-sm hover:shadow-[0_0_30px_rgba(255,215,0,0.2)] transition-all border-[#ffd700]/15 hover:border-[#ffd700]/35 group"
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg text-[#e8e8f0] group-hover:text-[#ffd700] transition-colors">{save.scenarioName}</CardTitle>
                          <CardDescription className="mt-1 text-[#8a8a9a]">
                            角色: <span className="text-[#c41e3a]">{save.myCharacterName}</span>
                          </CardDescription>
                        </div>
                        <Badge className={save.status === 'active' 
                          ? "bg-[#00ff88]/20 text-[#00ff88] border-[#00ff88]/30 text-xs" 
                          : "bg-[#6a6a7a]/20 text-[#c0c0c8] border-[#6a6a7a]/30 text-xs"
                        }>
                          {save.status === 'active' ? '进行中' : '已结束'}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm text-[#8a8a9a] mb-4 space-y-2">
                        <div className="flex items-center gap-2">
                          <Play className="w-4 h-4 text-[#00d4ff]" />
                          <span>章节: <span className="text-[#00d4ff]">{save.chapter}</span></span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-[#6a6a7a]" />
                          <span>最后保存: {new Date(save.lastSavedAt).toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="flex-1 bg-gradient-to-r from-[#ffd700] to-[#cc9900] text-[#0a0a0f] hover:from-[#ffe066] hover:to-[#ffd700] font-bold"
                          onClick={() => handleRestoreGame(save.id)}
                        >
                          <Play className="w-4 h-4 mr-2" />
                          继续游戏
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="px-3 border-[#c41e3a]/30 text-[#c41e3a] hover:bg-[#c41e3a]/10 hover:border-[#c41e3a]/50"
                          onClick={() => handleDeleteSave(save.id, save.scenarioName)}
                        >
                          🗑️
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
