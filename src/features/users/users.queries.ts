export const LIST_USERS = `
WITH user_metrics AS (
  SELECT 
    u.id,
    COUNT(DISTINCT ug.group_id) as group_count,
    json_agg(
      DISTINCT jsonb_build_object(
        'id', g.id,
        'name', g.name
      )
    ) FILTER (WHERE g.id IS NOT NULL) as groups
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
  COALESCE(um.group_count, 0) as group_count,
  COALESCE(um.groups, '[]') as groups
FROM ng.users u
LEFT JOIN user_metrics um ON u.id = um.id
WHERE 
  (COALESCE($1, '') = '' OR 
    u.username ILIKE '%' || COALESCE($1, '') || '%' OR 
    u.email ILIKE '%' || COALESCE($1, '') || '%'
  )
  AND (COALESCE($2, '') = '' OR u.role = $2)
  AND (COALESCE($3::boolean, NULL) IS NULL OR u.is_active = $3)
ORDER BY 
  CASE 
    WHEN $4 = 'username' AND $5 = 'ASC' THEN u.username END ASC,
  CASE 
    WHEN $4 = 'username' AND $5 = 'DESC' THEN u.username END DESC,
  CASE 
    WHEN $4 = 'email' AND $5 = 'ASC' THEN u.email END ASC,
  CASE 
    WHEN $4 = 'email' AND $5 = 'DESC' THEN u.email END DESC,
  CASE 
    WHEN $4 = 'role' AND $5 = 'ASC' THEN u.role END ASC,
  CASE 
    WHEN $4 = 'role' AND $5 = 'DESC' THEN u.role END DESC,
  CASE 
    WHEN $4 = 'created_at' AND $5 = 'ASC' THEN u.created_at END ASC,
  CASE 
    WHEN $4 = 'created_at' AND $5 = 'DESC' THEN u.created_at END DESC,
  CASE 
    WHEN $4 = 'last_login' AND $5 = 'ASC' THEN u.last_login END ASC,
  CASE 
    WHEN $4 = 'last_login' AND $5 = 'DESC' THEN u.last_login END DESC,
  CASE 
    WHEN $4 = 'group_count' AND $5 = 'ASC' THEN um.group_count END ASC,
  CASE 
    WHEN $4 = 'group_count' AND $5 = 'DESC' THEN um.group_count END DESC
LIMIT $6 OFFSET $7;
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

export const GET_USER_DETAILS = `
  WITH user_groups AS (
    SELECT 
      g.id,
      g.name,
      ug.added_at,
      creator.username as added_by
    FROM ng.user_groups ug
    JOIN ng.groups g ON g.id = ug.group_id
    LEFT JOIN ng.users creator ON ug.added_by = creator.id
    WHERE ug.user_id = $1
  ),
  model_permissions AS (
    SELECT 
      m.id,
      m.name,
      'direct'::text as access_type,
      NULL::uuid as group_id
    FROM ng.model_permissions mp
    JOIN ng.catalogo_3d m ON m.id = mp.model_id
    WHERE mp.user_id = $1
    UNION
    SELECT 
      m.id,
      m.name,
      'group'::text as access_type,
      g.id as group_id
    FROM ng.model_group_permissions mgp
    JOIN ng.catalogo_3d m ON m.id = mgp.model_id
    JOIN ng.groups g ON g.id = mgp.group_id
    JOIN ng.user_groups ug ON ug.group_id = g.id
    WHERE ug.user_id = $1
  ),
  zone_permissions AS (
    SELECT 
      z.id,
      z.name,
      'direct'::text as access_type,
      NULL::uuid as group_id
    FROM ng.zone_permissions zp
    JOIN ng.geographic_access_zones z ON z.id = zp.zone_id
    WHERE zp.user_id = $1
    UNION
    SELECT 
      z.id,
      z.name,
      'group'::text as access_type,
      g.id as group_id
    FROM ng.zone_group_permissions zgp
    JOIN ng.geographic_access_zones z ON z.id = zgp.zone_id
    JOIN ng.groups g ON g.id = zgp.group_id
    JOIN ng.user_groups ug ON ug.group_id = g.id
    WHERE ug.user_id = $1
  )
  SELECT 
    u.*,
    COALESCE(
      json_agg(
        json_build_object(
          'id', ug.id,
          'name', ug.name,
          'addedAt', ug.added_at,
          'addedBy', ug.added_by
        )
      ) FILTER (WHERE ug.id IS NOT NULL),
      '[]'
    ) as groups,
    json_build_object(
      'count', COUNT(DISTINCT mp.id),
      'items', COALESCE(
        json_agg(DISTINCT mp.*) FILTER (WHERE mp.id IS NOT NULL),
        '[]'
      )
    ) as model_permissions,
    json_build_object(
      'count', COUNT(DISTINCT zp.id),
      'items', COALESCE(
        json_agg(DISTINCT zp.*) FILTER (WHERE zp.id IS NOT NULL),
        '[]'
      )
    ) as zone_permissions
  FROM ng.users u
  LEFT JOIN user_groups ug ON true
  LEFT JOIN model_permissions mp ON true
  LEFT JOIN zone_permissions zp ON true
  WHERE u.id = $1
  GROUP BY u.id;
`;

export const CREATE_USER = `
  INSERT INTO ng.users (
    username, 
    email, 
    password, 
    role, 
    is_active,
    created_by,
    created_at, 
    updated_at
  ) VALUES (
    $1, $2, $3, $4, true, $5,
    CURRENT_TIMESTAMP, 
    CURRENT_TIMESTAMP
  ) RETURNING id;
`;

export const UPDATE_USER = `
  UPDATE ng.users 
  SET 
    email = COALESCE($2, email),
    role = COALESCE($3, role),
    is_active = COALESCE($4, is_active),
    updated_at = CURRENT_TIMESTAMP
  WHERE id = $1
  RETURNING id, username, email, role, is_active;
`;

export const UPDATE_PASSWORD = `
  UPDATE ng.users
  SET 
    password = $2,
    updated_at = CURRENT_TIMESTAMP
  WHERE id = $1
  RETURNING id;
`;

export const ADD_USER_TO_GROUPS = `
  INSERT INTO ng.user_groups (user_id, group_id, added_by)
  SELECT $1, unnest($2::uuid[]), $3
  ON CONFLICT (user_id, group_id) DO NOTHING;
`;
