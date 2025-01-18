// Métricas de Sistema
export const GET_DB_METRICS = `
  SELECT 
    COUNT(*) as total_connections,
    COUNT(*) FILTER (WHERE state = 'active') as active_connections,
    COUNT(*) FILTER (WHERE state = 'idle') as idle_connections,
    MAX(EXTRACT(EPOCH FROM (NOW() - xact_start))) as longest_transaction_seconds,
    MAX(EXTRACT(EPOCH FROM (NOW() - query_start))) as longest_query_seconds
  FROM pg_stat_activity 
  WHERE datname = current_database();
`;

export const GET_USER_METRICS = `
  SELECT 
    COUNT(*) as total_users,
    COUNT(*) FILTER (WHERE is_active = true) as active_users,
    COUNT(*) FILTER (WHERE role = 'admin') as admin_users,
    COUNT(*) FILTER (WHERE last_login >= NOW() - INTERVAL '24 hours') as active_last_24h
  FROM ng.users;
`;

export const GET_MODEL_METRICS = `
  SELECT 
    COUNT(*) as total_models,
    COUNT(*) FILTER (WHERE access_level = 'public') as public_models,
    COUNT(*) FILTER (WHERE access_level = 'private') as private_models
  FROM ng.catalogo_3d;
`;

export const GET_GROUP_METRICS = `
  SELECT 
    COUNT(*) as total_groups,
    AVG(members) as avg_members_per_group
  FROM (
    SELECT g.id, COUNT(ug.user_id) as members
    FROM ng.groups g
    LEFT JOIN ng.user_groups ug ON g.id = ug.group_id
    GROUP BY g.id
  ) group_stats;
`;

// Health Check
export const CHECK_DB_HEALTH = `
  SELECT NOW() as timestamp;
`;

// Audit Trail
export const CREATE_AUDIT_ENTRY = `
  INSERT INTO ng.audit_trail (
    action, 
    actor_id,
    target_type,
    target_id,
    target_name,
    details,
    ip,
    user_agent
  ) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8
  ) RETURNING *;
`;

export const GET_AUDIT_ENTRIES = `
  WITH filtered_entries AS (
    SELECT 
      at.*,
      u.username as actor_username
    FROM ng.audit_trail at
    LEFT JOIN ng.users u ON at.actor_id = u.id
    WHERE
      ($1::timestamptz IS NULL OR at.created_at >= $1) AND
      ($2::timestamptz IS NULL OR at.created_at <= $2) AND
      ($3::text IS NULL OR at.action = $3) AND
      ($4::uuid IS NULL OR at.actor_id = $4) AND
      ($5::uuid IS NULL OR at.target_id = $5) AND
      ($6::text IS NULL OR 
        to_tsvector('portuguese', 
          COALESCE(at.target_name, '') || ' ' || 
          COALESCE(at.details::text, '')
        ) @@ plainto_tsquery('portuguese', $6)
      )
  )
  SELECT 
    *,
    COUNT(*) OVER() as total_count
  FROM filtered_entries
  ORDER BY created_at DESC
  LIMIT $7
  OFFSET $8;
`;
