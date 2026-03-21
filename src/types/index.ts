// ─── 用户相关类型 ────────────────────────────────────────────────────────
export interface User {
  id: string;
  email: string;
  username: string;
  displayName?: string;
  avatar?: string;
  bio?: string;
  createdAt: string;
}

// ─── 角色卡相关类型 ────────────────────────────────────────────────────────
export interface CharacterAttributes {
  // 基础属性
  strength: number;      // 力量
  dexterity: number;     // 敏捷
  constitution: number;  // 体质
  intelligence: number;  // 智力
  wisdom: number;        // 感知
  charisma: number;      // 魅力
  // 派生属性
  hp: number;            // 生命值
  maxHp: number;         // 最大生命值
  mp: number;            // 精神力
  maxMp: number;         // 最大精神力
  initiative: number;    // 先攻值
  // 其他属性
  [key: string]: number;
}

export interface CharacterSkill {
  name: string;
  level: number;
  description: string;
}

export interface CharacterEquipment {
  name: string;
  type: string;
  description: string;
  effects: string[];
}

export interface RiderData {
  riderSystem: string;       // 骑士系统名称
  transformationItem: string; // 变身道具
  finisherMoves: string[];   // 必杀技
  specialAbilities: string[]; // 特殊能力
}

export interface Character {
  id: string;
  userId: string;
  name: string;
  title?: string;
  age?: number;
  gender?: string;
  background?: string;
  attributes: CharacterAttributes;
  skills?: CharacterSkill[];
  equipment?: CharacterEquipment[];
  riderData?: RiderData;
  templateVersion: string;
  createdAt: string;
  updatedAt?: string;
}

// ─── 房间相关类型 ────────────────────────────────────────────────────────
export interface RoomSettings {
  difficulty: string;
  allowPvP: boolean;
  houseRules: string[];
}

export interface Scenario {
  name: string;
  description: string;
  chapter: number;
  progress: string;
}

export type RoomStatus = 'waiting' | 'playing' | 'finished';

export interface Room {
  id: string;
  name: string;
  description?: string;
  hostId: string;
  status: RoomStatus;
  maxPlayers: number;
  isPrivate: boolean;
  password?: string;
  currentScenario?: Scenario;
  settings?: RoomSettings;
  createdAt: string;
  updatedAt?: string;
  // 关联数据
  host?: User;
  members?: RoomMember[];
}

export type MemberStatus = 'ready' | 'playing' | 'spectator';

export interface RoomMember {
  id: string;
  roomId: string;
  userId: string;
  characterId?: string;
  status: MemberStatus;
  isOnline: boolean;
  joinedAt: string;
  leftAt?: string;
  // 关联数据
  user?: User;
  character?: Character;
}

// ─── 游戏会话相关类型 ────────────────────────────────────────────────────────
export interface GameEvent {
  timestamp: string;
  type: string;
  description: string;
}

export interface GameState {
  currentScene: string;
  npcs: Record<string, unknown>;
  events: GameEvent[];
  aiContext: string;
  [key: string]: unknown;
}

export interface DialogMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

export interface SessionParticipant {
  userId: string;
  characterId: string;
  characterName: string;
}

export type SessionStatus = 'active' | 'paused' | 'completed';

export interface GameSession {
  id: string;
  roomId: string;
  scenarioName: string;
  chapter: number;
  gameState: GameState;
  dialogHistory?: DialogMessage[];
  participants: SessionParticipant[];
  status: SessionStatus;
  startedAt: string;
  endedAt?: string;
  lastSavedAt: string;
}

export interface GameLog {
  id: string;
  sessionId: string;
  roomId: string;
  type: 'roll' | 'action' | 'dialog' | 'system' | 'combat' | 'narrative';
  content: string;
  metadata?: Record<string, unknown>;
  senderId?: string;
  senderName?: string;
  senderType: 'player' | 'dm' | 'system';
  createdAt: string;
}

// ─── WebSocket 消息类型 ────────────────────────────────────────────────────────
export interface WsMessage<T = unknown> {
  type: string;
  payload: T;
}

export type WsMessageType = 
  | 'room:join'
  | 'room:leave'
  | 'room:chat'
  | 'game:action'
  | 'game:roll'
  | 'game:narrative'
  | 'game:state_update'
  | 'user:typing'
  | 'ping'
  | 'pong';

// ─── AI 相关类型 ────────────────────────────────────────────────────────────────
export interface AICharacterCreationStep {
  step: number;
  question: string;
  field: string;
  options?: string[];
}

export interface AIScenarioSuggestion {
  name: string;
  description: string;
  difficulty: string;
  estimatedDuration: string;
  tags: string[];
}

export interface AIDiceRoll {
  dice: string;
  result: number;
  modifier: number;
  total: number;
  success: boolean;
  criticalHit?: boolean;
  criticalFail?: boolean;
}

// ─── API 响应类型 ────────────────────────────────────────────────────────
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}
