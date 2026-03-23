-- 房间消息表
CREATE TABLE IF NOT EXISTS room_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  type VARCHAR(20) DEFAULT 'chat', -- chat, narrative, roll, system
  content TEXT NOT NULL,
  character_name VARCHAR(100),
  character_id UUID REFERENCES characters(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_room_messages_room_id ON room_messages(room_id);
CREATE INDEX IF NOT EXISTS idx_room_messages_created_at ON room_messages(created_at);

-- RLS 策略
ALTER TABLE room_messages ENABLE ROW LEVEL SECURITY;

-- 允许所有认证用户读取消息
CREATE POLICY "允许读取房间消息" ON room_messages
  FOR SELECT USING (auth.role() = 'authenticated');

-- 允许认证用户插入消息
CREATE POLICY "允许插入消息" ON room_messages
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
