import { WebSocket, type WebSocketServer } from 'ws';
import type { IncomingMessage } from 'http';

// WebSocket 消息类型
export interface WsMessage<T = unknown> {
  type: string;
  payload: T;
}

// 房间连接管理
const roomConnections = new Map<string, Set<WebSocket>>();

// 获取或创建房间连接集合
function getRoomConnections(roomId: string): Set<WebSocket> {
  if (!roomConnections.has(roomId)) {
    roomConnections.set(roomId, new Set());
  }
  return roomConnections.get(roomId)!;
}

// 广播消息到房间
export function broadcastToRoom(roomId: string, message: WsMessage, exclude?: WebSocket) {
  const connections = roomConnections.get(roomId);
  if (!connections) return;

  const messageStr = JSON.stringify(message);
  connections.forEach((ws) => {
    if (ws !== exclude && ws.readyState === WebSocket.OPEN) {
      ws.send(messageStr);
    }
  });
}

// 发送消息给特定连接
export function sendToConnection(ws: WebSocket, message: WsMessage) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

// 设置游戏房间 WebSocket 处理器
export function setupGameRoomHandler(wss: WebSocketServer) {
  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    let currentRoomId: string | null = null;
    let userId: string | null = null;
    let characterName: string | null = null;

    // 心跳机制
    let isAlive = true;
    const heartbeatInterval = setInterval(() => {
      if (!isAlive) {
        ws.terminate();
        return;
      }
      isAlive = false;
      ws.ping();
    }, 30000);

    ws.on('pong', () => {
      isAlive = true;
    });

    ws.on('message', async (raw: Buffer) => {
      try {
        const msg: WsMessage = JSON.parse(raw.toString());

        // 处理心跳
        if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', payload: null }));
          return;
        }

        switch (msg.type) {
          case 'room:join': {
            const { roomId, userId: uid, characterName: charName } = msg.payload as { 
              roomId: string; 
              userId: string;
              characterName?: string;
            };
            currentRoomId = roomId;
            userId = uid;
            characterName = charName || null;

            // 添加到房间连接
            const connections = getRoomConnections(roomId);
            connections.add(ws);

            // 通知其他成员
            broadcastToRoom(roomId, {
              type: 'user:joined',
              payload: { 
                userId, 
                characterName: characterName || '玩家',
                timestamp: new Date().toISOString() 
              }
            }, ws);

            // 发送欢迎消息
            sendToConnection(ws, {
              type: 'room:joined',
              payload: { roomId, membersCount: connections.size }
            });
            break;
          }

          case 'room:leave': {
            if (currentRoomId) {
              const connections = roomConnections.get(currentRoomId);
              if (connections) {
                connections.delete(ws);
                
                // 通知其他成员
                broadcastToRoom(currentRoomId, {
                  type: 'user:left',
                  payload: { userId, timestamp: new Date().toISOString() }
                });
              }
            }
            break;
          }

          case 'room:chat': {
            if (currentRoomId) {
              const { content, characterName, characterId } = msg.payload as {
                content: string;
                characterName?: string;
                characterId?: string;
              };
              
              // 广播给房间内其他玩家（排除发送者）
              broadcastToRoom(currentRoomId, {
                type: 'room:chat',
                payload: {
                  userId,
                  characterId,
                  characterName,
                  content,
                  timestamp: new Date().toISOString()
                }
              }, ws); // 排除当前发送者的连接
            }
            break;
          }

          case 'game:action': {
            if (currentRoomId) {
              // 广播玩家行动
              broadcastToRoom(currentRoomId, {
                type: 'game:action',
                payload: {
                  userId,
                  ...(msg.payload as Record<string, unknown>),
                  timestamp: new Date().toISOString()
                }
              });
            }
            break;
          }

          case 'game:roll': {
            if (currentRoomId) {
              const { dice, attribute, difficulty } = msg.payload as {
                dice: string;
                attribute?: string;
                difficulty?: number;
              };

              // 执行骰子检定
              const result = performRoll(dice);
              
              broadcastToRoom(currentRoomId, {
                type: 'game:roll_result',
                payload: {
                  userId,
                  dice,
                  ...result,
                  attribute,
                  difficulty,
                  timestamp: new Date().toISOString()
                }
              });
            }
            break;
          }

          case 'game:narrative': {
            if (currentRoomId) {
              // AI叙事结果广播
              broadcastToRoom(currentRoomId, {
                type: 'game:narrative',
                payload: {
                  ...(msg.payload as Record<string, unknown>),
                  timestamp: new Date().toISOString()
                }
              });
            }
            break;
          }

          case 'user:typing': {
            if (currentRoomId) {
              broadcastToRoom(currentRoomId, {
                type: 'user:typing',
                payload: { userId, isTyping: msg.payload }
              }, ws);
            }
            break;
          }

          default:
            console.log('未知的消息类型:', msg.type);
        }
      } catch (error) {
        console.error('处理WebSocket消息错误:', error);
      }
    });

    ws.on('close', async () => {
      clearInterval(heartbeatInterval);
      
      if (currentRoomId && userId) {
        const connections = roomConnections.get(currentRoomId);
        if (connections) {
          connections.delete(ws);
          
          // 通知其他成员
          broadcastToRoom(currentRoomId, {
            type: 'user:left',
            payload: { 
              userId, 
              characterName: characterName || '玩家',
              timestamp: new Date().toISOString() 
            }
          });
        }
        
        // 调用内部API清理用户离开房间
        try {
          const internalKey = process.env.INTERNAL_API_KEY || 'kamen-rider-internal';
          const port = process.env.DEPLOY_RUN_PORT || '5000';
          
          await fetch(`http://localhost:${port}/api/rooms/cleanup?roomId=${currentRoomId}&userId=${userId}`, {
            method: 'DELETE',
            headers: {
              'x-internal-key': internalKey,
            },
          });
          
          console.log(`[WebSocket] 已清理用户 ${userId} 离开房间 ${currentRoomId} 的数据`);
        } catch (error) {
          console.error('[WebSocket] 清理用户离开数据失败:', error);
        }
      }
    });

    ws.on('error', (error: Error) => {
      console.error('WebSocket错误:', error);
    });
  });
}

// 骰子检定函数
function performRoll(dice: string): { result: number; rolls: number[] } {
  const match = dice.match(/^(\d+)d(\d+)$/i);
  if (!match) {
    throw new Error(`Invalid dice notation: ${dice}`);
  }

  const count = parseInt(match[1]);
  const sides = parseInt(match[2]);
  
  const rolls: number[] = [];
  for (let i = 0; i < count; i++) {
    rolls.push(Math.floor(Math.random() * sides) + 1);
  }

  const result = rolls.reduce((a, b) => a + b, 0);
  return { result, rolls };
}
