import { pgTable, serial, timestamp, varchar, text, boolean, integer, jsonb, index } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { createSchemaFactory } from "drizzle-zod"
import { z } from "zod"

// ─── 系统表（Supabase 内置）────────────────────────────────────────────
export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

// ─── 用户资料表（关联 Supabase Auth）────────────────────────────────────
export const profiles = pgTable(
	"profiles",
	{
		id: varchar("id", { length: 36 }).primaryKey(), // 关联 auth.users.id
		username: varchar("username", { length: 50 }).notNull().unique(),
		displayName: varchar("display_name", { length: 100 }),
		avatar: text("avatar"),
		bio: text("bio"),
		createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	},
	(table) => [
		index("profiles_username_idx").on(table.username),
	]
);

// ─── 角色卡表 ───────────────────────────────────────────────────────────
export const characters = pgTable(
	"characters",
	{
		id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
		userId: varchar("user_id", { length: 36 }).notNull(),
		
		// 基础信息
		name: varchar("name", { length: 100 }).notNull(),
		title: varchar("title", { length: 100 }), // 假面骑士称号
		age: integer("age"),
		gender: varchar("gender", { length: 20 }),
		background: text("background"), // 背景故事
		
		// 属性数据（JSON格式存储）
		attributes: jsonb("attributes").notNull().$type<{
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
			// 其他
			[key: string]: number;
		}>(),
		
		// 技能数据
		skills: jsonb("skills").$type<{
			name: string;
			level: number;
			description: string;
		}[]>(),
		
		// 装备数据
		equipment: jsonb("equipment").$type<{
			name: string;
			type: string;
			description: string;
			effects: string[];
		}[]>(),
		
		// 假面骑士特有数据
		riderData: jsonb("rider_data").$type<{
			riderSystem: string;     // 骑士系统名称
			transformationItem: string; // 变身道具
			finisherMoves: string[]; // 必杀技
			specialAbilities: string[]; // 特殊能力
		}>(),
		
		// 角色卡模板版本
		templateVersion: varchar("template_version", { length: 20 }).default("1.0"),
		
		createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	},
	(table) => [
		index("characters_user_id_idx").on(table.userId),
		index("characters_name_idx").on(table.name),
	]
);

// ─── 游戏房间表 ───────────────────────────────────────────────────────────
export const rooms = pgTable(
	"rooms",
	{
		id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
		name: varchar("name", { length: 100 }).notNull(),
		description: text("description"),
		hostId: varchar("host_id", { length: 36 }).notNull(), // 房主ID
		
		// 房间状态
		status: varchar("status", { length: 20 }).default("waiting").notNull(), // waiting, playing, finished
		
		// 房间设置
		maxPlayers: integer("max_players").default(6).notNull(),
		isPrivate: boolean("is_private").default(false).notNull(),
		password: varchar("password", { length: 100 }), // 私人房间密码
		
		// 当前剧本信息
		currentScenario: jsonb("current_scenario").$type<{
			name: string;
			description: string;
			chapter: number;
			progress: string;
		}>(),
		
		// 游戏设置
		settings: jsonb("settings").$type<{
			difficulty: string;      // 难度
			allowPvP: boolean;       // 允许玩家对战
			houseRules: string[];    // 房规
		}>(),
		
		createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	},
	(table) => [
		index("rooms_host_id_idx").on(table.hostId),
		index("rooms_status_idx").on(table.status),
	]
);

// ─── 房间成员表 ───────────────────────────────────────────────────────────
export const roomMembers = pgTable(
	"room_members",
	{
		id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
		roomId: varchar("room_id", { length: 36 }).notNull(),
		userId: varchar("user_id", { length: 36 }).notNull(),
		characterId: varchar("character_id", { length: 36 }), // 选择的角色卡
		
		// 成员状态
		status: varchar("status", { length: 20 }).default("ready").notNull(), // ready, playing, spectator
		isOnline: boolean("is_online").default(true).notNull(),
		
		joinedAt: timestamp("joined_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
		leftAt: timestamp("left_at", { withTimezone: true, mode: 'string' }),
	},
	(table) => [
		index("room_members_room_id_idx").on(table.roomId),
		index("room_members_user_id_idx").on(table.userId),
	]
);

// ─── 游戏会话表（存储跑团记录）────────────────────────────────────────────
export const gameSessions = pgTable(
	"game_sessions",
	{
		id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
		roomId: varchar("room_id", { length: 36 }).notNull(),
		
		// 会话信息
		scenarioName: varchar("scenario_name", { length: 100 }).notNull(),
		chapter: integer("chapter").default(1),
		
		// 游戏状态（用于读取进度）
		gameState: jsonb("game_state").notNull().$type<{
			// 当前场景
			currentScene: string;
			// NPC状态
			npcs: Record<string, unknown>;
			// 事件记录
			events: Array<{
				timestamp: string;
				type: string;
				description: string;
			}>;
			// AI上下文
			aiContext: string;
			// 自定义数据
			[key: string]: unknown;
		}>(),
		
		// 对话历史（用于AI继续游戏）
		dialogHistory: jsonb("dialog_history").$type<Array<{
			role: "user" | "assistant" | "system";
			content: string;
			timestamp: string;
		}>>(),
		
		// 参与玩家
		participants: jsonb("participants").notNull().$type<Array<{
			userId: string;
			characterId: string;
			characterName: string;
		}>>(),
		
		// 会话状态
		status: varchar("status", { length: 20 }).default("active").notNull(), // active, paused, completed
		
		startedAt: timestamp("started_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
		endedAt: timestamp("ended_at", { withTimezone: true, mode: 'string' }),
		lastSavedAt: timestamp("last_saved_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	},
	(table) => [
		index("game_sessions_room_id_idx").on(table.roomId),
		index("game_sessions_status_idx").on(table.status),
	]
);

// ─── 游戏日志表（详细记录每个动作）────────────────────────────────────────
export const gameLogs = pgTable(
	"game_logs",
	{
		id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
		sessionId: varchar("session_id", { length: 36 }).notNull(),
		roomId: varchar("room_id", { length: 36 }).notNull(),
		
		// 日志类型
		type: varchar("type", { length: 30 }).notNull(), // roll, action, dialog, system, combat, etc.
		
		// 日志内容
		content: text("content").notNull(),
		metadata: jsonb("metadata"), // 额外数据（骰子结果、伤害值等）
		
		// 发送者
		senderId: varchar("sender_id", { length: 36 }),
		senderName: varchar("sender_name", { length: 100 }),
		senderType: varchar("sender_type", { length: 20 }).default("player"), // player, dm, system
		
		createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	},
	(table) => [
		index("game_logs_session_id_idx").on(table.sessionId),
		index("game_logs_room_id_idx").on(table.roomId),
		index("game_logs_created_at_idx").on(table.createdAt),
	]
);

// ─── Zod Schemas for validation ───────────────────────────────────────────
const { createInsertSchema: createCoercedInsertSchema } = createSchemaFactory({
	coerce: { date: true },
});

// Profile schemas
export const insertProfileSchema = createCoercedInsertSchema(profiles).pick({
	id: true,
	username: true,
	displayName: true,
	avatar: true,
	bio: true,
});

export const updateProfileSchema = createCoercedInsertSchema(profiles)
	.pick({
		username: true,
		displayName: true,
		avatar: true,
		bio: true,
	})
	.partial();

// Character schemas
export const insertCharacterSchema = createCoercedInsertSchema(characters).pick({
	userId: true,
	name: true,
	title: true,
	age: true,
	gender: true,
	background: true,
	attributes: true,
	skills: true,
	equipment: true,
	riderData: true,
	templateVersion: true,
});

export const updateCharacterSchema = createCoercedInsertSchema(characters)
	.pick({
		name: true,
		title: true,
		age: true,
		gender: true,
		background: true,
		attributes: true,
		skills: true,
		equipment: true,
		riderData: true,
	})
	.partial();

// Room schemas
export const insertRoomSchema = createCoercedInsertSchema(rooms).pick({
	name: true,
	description: true,
	hostId: true,
	maxPlayers: true,
	isPrivate: true,
	password: true,
	settings: true,
});

export const updateRoomSchema = createCoercedInsertSchema(rooms)
	.pick({
		name: true,
		description: true,
		status: true,
		currentScenario: true,
		settings: true,
	})
	.partial();

// ─── TypeScript Types ───────────────────────────────────────────────────
export type Profile = typeof profiles.$inferSelect;
export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type UpdateProfile = z.infer<typeof updateProfileSchema>;

export type Character = typeof characters.$inferSelect;
export type InsertCharacter = z.infer<typeof insertCharacterSchema>;
export type UpdateCharacter = z.infer<typeof updateCharacterSchema>;

export type Room = typeof rooms.$inferSelect;
export type InsertRoom = z.infer<typeof insertRoomSchema>;
export type UpdateRoom = z.infer<typeof updateRoomSchema>;

export type RoomMember = typeof roomMembers.$inferSelect;

export type GameSession = typeof gameSessions.$inferSelect;
export type GameLog = typeof gameLogs.$inferSelect;
