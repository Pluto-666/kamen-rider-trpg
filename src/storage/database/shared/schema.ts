import { pgTable, index, varchar, integer, text, jsonb, timestamp, serial, unique, boolean } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

// ─── 系统表（Supabase 内置）────────────────────────────────────────────
export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

// ─── 用户资料表（关联 Supabase Auth）────────────────────────────────────────
export const profiles = pgTable("profiles", {
	id: varchar({ length: 36 }).primaryKey().notNull(),
	username: varchar({ length: 50 }).notNull(),
	displayName: varchar("display_name", { length: 100 }),
	avatar: text(),
	bio: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("profiles_username_idx").using("btree", table.username.asc().nullsLast().op("text_ops")),
	unique("profiles_username_unique").on(table.username),
]);

// ─── 角色卡表（按照xlsx模板设计）────────────────────────────────────────────
export const characters = pgTable("characters", {
	id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
	userId: varchar("user_id", { length: 36 }).notNull(),
	
	// === 基础信息 ===
	name: varchar({ length: 100 }).notNull(),
	title: varchar({ length: 100 }),
	playerName: varchar("player_name", { length: 100 }),
	imageUrl: text("image_url"),
	
	// === 基本属性 ===
	race: varchar({ length: 50 }).default('人类'),
	occupation: varchar({ length: 100 }),
	age: integer(),
	gender: varchar({ length: 20 }),
	activePower: integer("active_power").default(5),
	
	// === 能力值（JSON格式存储所有属性）===
	attributes: jsonb().notNull().$type<{
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
	}>(),
	
	// === 命运点数 ===
	fatePoints: jsonb("fate_points").$type<{
		points: number;
		history: string[];
	}>(),
	
	// === 装备 ===
	weapons: jsonb().$type<Array<{
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
	}>>(),
	
	armors: jsonb().$type<Array<{
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
	}>>(),
	
	otherEquipment: text("other_equipment"),
	
	// === 车辆 ===
	vehicle: jsonb().$type<{
		name: string;
		movement: number;
		hp: number;
		passengers: number;
		dodge: number;
		parry: number;
		fatePoints: number;
	}>(),
	
	// === 配置（技能/能力） ===
	configs: jsonb().$type<Array<{
		category: string;
		name: string;
		level: number;
		reference: string;
	}>>(),
	
	// === 背景 ===
	background: text(),
	
	// === 假面骑士特有数据 ===
	riderData: jsonb("rider_data").$type<{
		riderSystem: string;
		transformationItem: string;
		finisherMoves: string[];
		specialAbilities: string[];
		transformationPhrase: string;
	}>(),
	
	// === 行动卡 ===
	actionCards: jsonb("action_cards").$type<Array<{
		type: string;
		category: string;
		name: string;
		cards: number;
		used: boolean;
		description: string;
	}>>(),
	
	// === 剧情记录 ===
	episodes: jsonb().$type<Array<{
		episode: number;
		title: string;
		summary: string;
	}>>(),
	
	// 兼容旧字段
	skills: jsonb(),
	equipment: jsonb(),
	templateVersion: varchar("template_version", { length: 20 }).default('2.0'),
	
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("characters_user_id_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	index("characters_name_idx").using("btree", table.name.asc().nullsLast().op("text_ops")),
]);

// ─── 游戏房间表 ───────────────────────────────────────────────────────────
export const rooms = pgTable("rooms", {
	id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
	name: varchar({ length: 100 }).notNull(),
	description: text(),
	hostId: varchar("host_id", { length: 36 }).notNull(),
	status: varchar({ length: 20 }).default('waiting').notNull(),
	maxPlayers: integer("max_players").default(6).notNull(),
	isPrivate: boolean("is_private").default(false).notNull(),
	password: varchar({ length: 100 }),
	currentScenario: jsonb("current_scenario"),
	settings: jsonb(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("rooms_host_id_idx").using("btree", table.hostId.asc().nullsLast().op("text_ops")),
	index("rooms_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
]);

// ─── 房间成员表 ───────────────────────────────────────────────────────────
export const roomMembers = pgTable("room_members", {
	id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
	roomId: varchar("room_id", { length: 36 }).notNull(),
	userId: varchar("user_id", { length: 36 }).notNull(),
	characterId: varchar("character_id", { length: 36 }),
	status: varchar({ length: 20 }).default('ready').notNull(),
	isOnline: boolean("is_online").default(true).notNull(),
	joinedAt: timestamp("joined_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	leftAt: timestamp("left_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("room_members_room_id_idx").using("btree", table.roomId.asc().nullsLast().op("text_ops")),
	index("room_members_user_id_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
]);

// ─── 游戏会话表（存储跑团记录）────────────────────────────────────────────
export const gameSessions = pgTable("game_sessions", {
	id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
	roomId: varchar("room_id", { length: 36 }).notNull(),
	scenarioName: varchar("scenario_name", { length: 100 }).notNull(),
	chapter: integer().default(1),
	gameState: jsonb("game_state").notNull(),
	dialogHistory: jsonb("dialog_history"),
	participants: jsonb().notNull(),
	status: varchar({ length: 20 }).default('active').notNull(),
	startedAt: timestamp("started_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	endedAt: timestamp("ended_at", { withTimezone: true, mode: 'string' }),
	lastSavedAt: timestamp("last_saved_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("game_sessions_room_id_idx").using("btree", table.roomId.asc().nullsLast().op("text_ops")),
	index("game_sessions_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
]);

// ─── 游戏日志表（详细记录每个动作）────────────────────────────────────────
export const gameLogs = pgTable("game_logs", {
	id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
	sessionId: varchar("session_id", { length: 36 }).notNull(),
	roomId: varchar("room_id", { length: 36 }).notNull(),
	type: varchar({ length: 30 }).notNull(),
	content: text().notNull(),
	metadata: jsonb(),
	senderId: varchar("sender_id", { length: 36 }),
	senderName: varchar("sender_name", { length: 100 }),
	senderType: varchar("sender_type", { length: 20 }).default('player'),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("game_logs_session_id_idx").using("btree", table.sessionId.asc().nullsLast().op("text_ops")),
	index("game_logs_room_id_idx").using("btree", table.roomId.asc().nullsLast().op("text_ops")),
	index("game_logs_created_at_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
]);
