import { pgTable, serial, timestamp, varchar, text, boolean, integer, jsonb, index } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { createSchemaFactory } from "drizzle-zod"
import { z } from "zod"

// ─── 系统表（Supabase 内置）────────────────────────────────────────────
export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

// ─── 用户资料表（关联 Supabase Auth）────────────────────────────────────────
export const profiles = pgTable(
	"profiles",
	{
		id: varchar("id", { length: 36 }).primaryKey(),
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

// ─── 角色卡表（按照xlsx模板设计）────────────────────────────────────────────
export const characters = pgTable(
	"characters",
	{
		id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
		userId: varchar("user_id", { length: 36 }).notNull(),
		
		// === 基础信息 ===
		name: varchar("name", { length: 100 }).notNull(),              // 角色名字
		playerName: varchar("player_name", { length: 100 }),           // 玩家名
		imageUrl: text("image_url"),                                     // 人物形象图片
		
		// === 基本属性 ===
		race: varchar("race", { length: 50 }).default("人类"),          // 种族
		occupation: varchar("occupation", { length: 100 }),             // 职业
		age: integer("age"),                                             // 年龄
		gender: varchar("gender", { length: 20 }),                      // 性别
		activePower: integer("active_power").default(5),               // 活跃力
		
		// === 能力值 ===
		attributes: jsonb("attributes").notNull().$type<{
			// 主能力值
			body: number;        // 肉体
			bodyRace: number;    // 肉体种族加值
			bodyJob: number;     // 肉体职业加值
			bodyNormal: number;  // 肉体通常状态
			bodyTransform: number; // 肉体变身状态
			
			athletics: number;     // 运动
			athleticsRace: number;
			athleticsJob: number;
			athleticsNormal: number;
			athleticsTransform: number;
			
			dexterity: number;     // 器用
			dexterityRace: number;
			dexterityJob: number;
			dexterityNormal: number;
			dexterityTransform: number;
			
			will: number;          // 意志
			willRace: number;
			willJob: number;
			willNormal: number;
			willTransform: number;
			
			wit: number;           // 机知
			witRace: number;
			witJob: number;
			witNormal: number;
			witTransform: number;
			
			// 副能力值
			movement: number;      // 移动力
			movementRace: number;
			movementJob: number;
			movementNormal: number;
			movementTransform: number;
			movementBonus: number;
			
			initiative: number;    // 先制力
			initiativeRace: number;
			initiativeJob: number;
			initiativeNormal: number;
			initiativeTransform: number;
			initiativeBonus: number;
			
			// HP相关
			additionalHP: number;  // 追加HP
			bodyHP: number;        // 肉体HP
			totalHP: number;       // 总HP
			transformHP: number;   // 变身HP
		}>(),
		
		// === 命运点数 ===
		fatePoints: jsonb("fate_points").$type<{
			points: number;        // 当前命运点数
			history: string[];     // 命运历史记录
		}>(),
		
		// === 装备 ===
		weapons: jsonb("weapons").$type<Array<{
			name: string;          // 武器名称
			range: string;         // 射程
			hit: number;           // 武器命中
			hitBonus: number;      // 命中修正
			hitTotal: number;      // 总命中
			dp: number;            // 武器DP
			dpBonus: number;       // DP修正
			dpTotal: number;       // 总DP
			attribute: string;     // 属性
			uses: number;          // 次数
			note: string;          // 备注
		}>>(),
		
		armors: jsonb("armors").$type<Array<{
			name: string;          // 防具名称
			dodge: number;         // 防具迴避(闪躲)
			dodgeBonus: number;
			dodgeTotal: number;
			parry: number;         // 防具迴避(招架)
			parryBonus: number;
			parryTotal: number;
			additionalHP: number;  // 追加HP
			fixed: boolean;        // 可固定
			note: string;          // 备注
		}>>(),
		
		otherEquipment: text("other_equipment"),  // 其他装备描述
		
		// === 车辆 ===
		vehicle: jsonb("vehicle").$type<{
			name: string;          // 车辆名称
			movement: number;      // 移动力
			hp: number;            // 车辆HP
			passengers: number;    // 乘员
			dodge: number;         // 闪躲
			parry: number;         // 招架
			fatePoints: number;    // 车辆命运
		}>(),
		
		// === 配置（技能/能力） ===
		configs: jsonb("configs").$type<Array<{
			category: string;      // 类别 (人类系/种族/职业/命运等)
			name: string;          // 名称
			level: number;         // 等级 (●●● 形式)
			reference: string;     // 参照
		}>>(),
		
		// === 背景 ===
		background: text("background"),  // 人物背景故事
		
		// === 假面骑士特有数据 ===
		riderData: jsonb("rider_data").$type<{
			riderSystem: string;       // 骑士系统名称
			transformationItem: string; // 变身道具
			finisherMoves: string[];   // 必杀技
			specialAbilities: string[]; // 特殊能力
			transformationPhrase: string; // 变身口号
		}>(),
		
		// === 行动卡 ===
		actionCards: jsonb("action_cards").$type<Array<{
			type: string;          // BA/SA/DA/共通
			category: string;      // 类形 (战斗系/探索系/会话系/热情系)
			name: string;          // 名称
			cards: number;         // 张数
			used: boolean;         // 是否已使用
			description: string;   // 描述
		}>>(),
		
		// === 剧情记录 ===
		episodes: jsonb("episodes").$type<Array<{
			episode: number;       // 第几话
			title: string;         // 标题
			summary: string;       // 剧情
		}>>(),
		
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
		hostId: varchar("host_id", { length: 36 }).notNull(),
		status: varchar("status", { length: 20 }).default("waiting").notNull(),
		maxPlayers: integer("max_players").default(6).notNull(),
		isPrivate: boolean("is_private").default(false).notNull(),
		password: varchar("password", { length: 100 }),
		currentScenario: jsonb("current_scenario").$type<{
			name: string;
			description: string;
			chapter: number;
			progress: string;
		}>(),
		settings: jsonb("settings").$type<{
			difficulty: string;
			allowPvP: boolean;
			houseRules: string[];
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
		characterId: varchar("character_id", { length: 36 }),
		status: varchar("status", { length: 20 }).default("ready").notNull(),
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
		scenarioName: varchar("scenario_name", { length: 100 }).notNull(),
		chapter: integer("chapter").default(1),
		gameState: jsonb("game_state").notNull().$type<{
			currentScene: string;
			npcs: Record<string, unknown>;
			events: Array<{ timestamp: string; type: string; description: string; }>;
			aiContext: string;
			[key: string]: unknown;
		}>(),
		dialogHistory: jsonb("dialog_history").$type<Array<{
			role: "user" | "assistant" | "system";
			content: string;
			timestamp: string;
		}>>(),
		participants: jsonb("participants").notNull().$type<Array<{
			userId: string;
			characterId: string;
			characterName: string;
		}>>(),
		status: varchar("status", { length: 20 }).default("active").notNull(),
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
		type: varchar("type", { length: 30 }).notNull(),
		content: text("content").notNull(),
		metadata: jsonb("metadata"),
		senderId: varchar("sender_id", { length: 36 }),
		senderName: varchar("sender_name", { length: 100 }),
		senderType: varchar("sender_type", { length: 20 }).default("player"),
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

export const insertProfileSchema = createCoercedInsertSchema(profiles).pick({
	id: true,
	username: true,
	displayName: true,
	avatar: true,
	bio: true,
});

export const insertCharacterSchema = createCoercedInsertSchema(characters).pick({
	userId: true,
	name: true,
	playerName: true,
	imageUrl: true,
	race: true,
	occupation: true,
	age: true,
	gender: true,
	activePower: true,
	attributes: true,
	fatePoints: true,
	weapons: true,
	armors: true,
	otherEquipment: true,
	vehicle: true,
	configs: true,
	background: true,
	riderData: true,
	actionCards: true,
	episodes: true,
});

export const insertRoomSchema = createCoercedInsertSchema(rooms).pick({
	name: true,
	description: true,
	hostId: true,
	maxPlayers: true,
	isPrivate: true,
	password: true,
	settings: true,
});

// ─── TypeScript Types ───────────────────────────────────────────────────
export type Profile = typeof profiles.$inferSelect;
export type InsertProfile = z.infer<typeof insertProfileSchema>;

export type Character = typeof characters.$inferSelect;
export type InsertCharacter = z.infer<typeof insertCharacterSchema>;

export type Room = typeof rooms.$inferSelect;
export type InsertRoom = z.infer<typeof insertRoomSchema>;

export type RoomMember = typeof roomMembers.$inferSelect;

export type GameSession = typeof gameSessions.$inferSelect;
export type GameLog = typeof gameLogs.$inferSelect;
