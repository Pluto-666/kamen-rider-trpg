-- 游戏存档表
CREATE TABLE IF NOT EXISTS game_saves (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(36) NOT NULL,
  room_id VARCHAR(36) NOT NULL,
  save_name VARCHAR(200) NOT NULL,
  messages JSONB DEFAULT '[]',
  current_scene JSONB,
  character_states JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  room_snapshot JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS game_saves_user_id_idx ON game_saves(user_id);
CREATE INDEX IF NOT EXISTS game_saves_room_id_idx ON game_saves(room_id);
CREATE INDEX IF NOT EXISTS game_saves_created_at_idx ON game_saves(created_at);

-- RLS
ALTER TABLE game_saves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for game_saves" ON game_saves
  FOR ALL USING (true) WITH CHECK (true);
