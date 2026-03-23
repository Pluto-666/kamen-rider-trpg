-- 清理残留的空房间
-- 步骤1: 查看当前情况
SELECT 
  r.id as room_id,
  r.name as room_name,
  r.status,
  r.created_at,
  COUNT(rm.id) as member_count
FROM rooms r
LEFT JOIN room_members rm ON r.id = rm.room_id
GROUP BY r.id, r.name, r.status, r.created_at
ORDER BY r.created_at DESC;

-- 步骤2: 删除没有成员的空房间（取消注释执行）
-- 注意：存档数据（game_saves）会保留

-- 先删除空房间相关的消息
DELETE FROM room_messages 
WHERE room_id IN (
  SELECT r.id FROM rooms r
  LEFT JOIN room_members rm ON r.id = rm.room_id
  WHERE rm.id IS NULL
);

-- 删除空房间相关的游戏会话
DELETE FROM game_sessions 
WHERE room_id IN (
  SELECT r.id FROM rooms r
  LEFT JOIN room_members rm ON r.id = rm.room_id
  WHERE rm.id IS NULL
);

-- 删除空房间相关的游戏日志
DELETE FROM game_logs 
WHERE room_id IN (
  SELECT r.id FROM rooms r
  LEFT JOIN room_members rm ON r.id = rm.room_id
  WHERE rm.id IS NULL
);

-- 最后删除空房间
DELETE FROM rooms 
WHERE id IN (
  SELECT r.id FROM rooms r
  LEFT JOIN room_members rm ON r.id = rm.room_id
  WHERE rm.id IS NULL
);

-- 步骤3: 验证清理结果
SELECT 
  r.id as room_id,
  r.name as room_name,
  r.status,
  COUNT(rm.id) as member_count
FROM rooms r
LEFT JOIN room_members rm ON r.id = rm.room_id
GROUP BY r.id, r.name, r.status
ORDER BY r.created_at DESC;
