// Métricas de Sistema
export const GET_USER_METRICS = `
  SELECT 
    COUNT(*) as total_users,
    COUNT(*) FILTER (WHERE is_active = true) as active_users,
    COUNT(*) FILTER (WHERE role = 'admin') as admin_users,
    COUNT(*) FILTER (WHERE last_login >= NOW() - INTERVAL '24 hours') as active_last_24h
  FROM ng.users;
`;

export const GET_GROUP_METRICS = `
  WITH group_stats AS (
    SELECT 
      COUNT(*) as total_groups,
      AVG(CAST((
        SELECT COUNT(*) 
        FROM ng.user_groups ug 
        WHERE ug.group_id = g.id
      ) AS FLOAT)) as avg_users_per_group
    FROM ng.groups g
  )
  SELECT 
    total_groups,
    ROUND(CAST(avg_users_per_group AS NUMERIC), 2) as avg_users_per_group
  FROM group_stats;
`;

export const GET_MODEL_METRICS = `
  SELECT 
    COUNT(*) as total_models,
    COUNT(*) FILTER (WHERE access_level = 'public') as public_models,
    COUNT(*) FILTER (WHERE access_level = 'private') as private_models,
    COUNT(DISTINCT type) as distinct_types
  FROM ng.catalogo_3d;
`;

export const GET_DB_STATUS = `
  SELECT 
    COUNT(*) as total_connections,
    COUNT(*) FILTER (WHERE state = 'active') as active_connections,
    COUNT(*) FILTER (WHERE state = 'idle') as idle_connections,
    MAX(EXTRACT(EPOCH FROM (NOW() - xact_start))) as longest_transaction_seconds,
    MAX(EXTRACT(EPOCH FROM (NOW() - query_start))) as longest_query_seconds
  FROM pg_stat_activity 
  WHERE datname = current_database();
`;

// Gerenciamento de Usuários
export const LIST_USERS = `
  WITH user_counts AS (
    SELECT 
      u.id,
      COUNT(DISTINCT g.id) as group_count
    FROM ng.users u
    LEFT JOIN ng.user_groups ug ON u.id = ug.user_id
    LEFT JOIN ng.groups g ON ug.group_id = g.id
    GROUP BY u.id
  )
  SELECT 
    u.id, 
    u.username, 
    u.email, 
    u.role, 
    u.is_active,
    u.last_login,
    u.created_at,
    u.updated_at,
    COALESCE(uc.group_count, 0) as group_count,
    EXISTS (
      SELECT 1 FROM ng.api_key_history 
      WHERE user_id = u.id AND revoked_at IS NULL
    ) as has_active_api_key
  FROM ng.users u
  LEFT JOIN user_counts uc ON u.id = uc.id
  WHERE 
    ($1::text IS NULL OR 
      u.username ILIKE '%' || $1 || '%' OR 
      u.email ILIKE '%' || $1 || '%'
    )
    AND ($2::text IS NULL OR u.role = $2)
    AND ($3::boolean IS NULL OR u.is_active = $3)
  ORDER BY 
    CASE 
      WHEN $4 = 'username_asc' THEN u.username
    END ASC,
    CASE 
      WHEN $4 = 'username_desc' THEN u.username
    END DESC,
    CASE 
      WHEN $4 = 'created_at_asc' THEN u.created_at
    END ASC,
    CASE 
      WHEN $4 = 'created_at_desc' OR $4 IS NULL THEN u.created_at
    END DESC
  LIMIT $5 OFFSET $6;
`;

export const COUNT_USERS = `
  SELECT COUNT(*)
  FROM ng.users u
  WHERE 
    ($1::text IS NULL OR 
      u.username ILIKE '%' || $1 || '%' OR 
      u.email ILIKE '%' || $1 || '%'
    )
    AND ($2::text IS NULL OR u.role = $2)
    AND ($3::boolean IS NULL OR u.is_active = $3);
`;

// Gerenciamento de Grupos
export const GET_GROUP_MEMBERS = `
  SELECT 
    u.id,
    u.username,
    u.email,
    u.role,
    u.is_active,
    ug.added_at,
    creator.username as added_by,
    COUNT(DISTINCT mug.group_id) as other_group_count
  FROM ng.user_groups ug
  JOIN ng.users u ON ug.user_id = u.id
  JOIN ng.users creator ON ug.added_by = creator.id
  LEFT JOIN ng.user_groups mug ON u.id = mug.user_id AND mug.group_id != $1
  WHERE ug.group_id = $1
  GROUP BY u.id, u.username, u.email, u.role, u.is_active, ug.added_at, creator.username
  ORDER BY ug.added_at DESC
  LIMIT $2 OFFSET $3;
`;

export const COUNT_GROUP_MEMBERS = `
  SELECT COUNT(DISTINCT user_id)
  FROM ng.user_groups
  WHERE group_id = $1;
`;
