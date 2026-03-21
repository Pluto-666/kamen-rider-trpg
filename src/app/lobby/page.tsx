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

export default function LobbyPage() {
  const router = useRouter();
  const { user, profile, logout, isAuthenticated, isLoading: authLoading, token } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  
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
          <h1 className="text-2xl font-bold">假面骑士 TRPG</h1>
          
          <div className="flex items-center gap-4">
            <Link href="/characters">
              <Button variant="outline">我的角色</Button>
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
            <h2 className="text-3xl font-bold">游戏大厅</h2>
            <p className="text-muted-foreground mt-1">选择一个房间加入，或创建新房间开始冒险</p>
          </div>

          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="lg">创建房间</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>创建新房间</DialogTitle>
                <DialogDescription>
                  创建一个新房间，邀请朋友一起跑团
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="room-name">房间名称 *</Label>
                  <Input
                    id="room-name"
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    placeholder="给你的房间起个名字"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="room-desc">房间描述</Label>
                  <Textarea
                    id="room-desc"
                    value={roomDescription}
                    onChange={(e) => setRoomDescription(e.target.value)}
                    placeholder="简单描述一下这个房间..."
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max-players">最大人数</Label>
                  <Input
                    id="max-players"
                    type="number"
                    min={2}
                    max={10}
                    value={maxPlayers}
                    onChange={(e) => setMaxPlayers(parseInt(e.target.value) || 6)}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="private-room"
                    checked={isPrivate}
                    onCheckedChange={setIsPrivate}
                  />
                  <Label htmlFor="private-room">私人房间（需要密码）</Label>
                </div>
                {isPrivate && (
                  <div className="space-y-2">
                    <Label htmlFor="room-password">房间密码</Label>
                    <Input
                      id="room-password"
                      type="password"
                      value={roomPassword}
                      onChange={(e) => setRoomPassword(e.target.value)}
                      placeholder="设置房间密码"
                    />
                  </div>
                )}
              </div>
              <DialogFooter className="mt-4">
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  取消
                </Button>
                <Button onClick={handleCreateRoom}>创建</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Room List */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">加载房间列表...</p>
          </div>
        ) : rooms.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <p className="text-muted-foreground mb-4">暂无可加入的房间</p>
              <Button onClick={() => setCreateDialogOpen(true)}>
                创建第一个房间
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {rooms.map((room) => (
              <Card key={room.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{room.name}</CardTitle>
                      <CardDescription className="mt-1">
                        房主: {room.profiles?.display_name || room.profiles?.username || '未知'}
                      </CardDescription>
                    </div>
                    <div className="flex gap-1">
                      {room.is_private && (
                        <Badge variant="secondary">私人</Badge>
                      )}
                      <Badge variant={room.status === 'waiting' ? 'default' : 'secondary'}>
                        {room.status === 'waiting' ? '等待中' : '游戏中'}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {room.description && (
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                      {room.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      人数: {room._memberCount || 0}/{room.max_players}
                    </span>
                    <Button
                      size="sm"
                      onClick={() => handleJoinRoom(room.id, room.is_private)}
                      disabled={room.status !== 'waiting'}
                    >
                      加入房间
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
