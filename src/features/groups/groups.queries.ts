export const GET_USER_GROUPS = `
  SELECT 
    g.id,
    g.name,
    g.description,
    g.created_at,
    u.username as added_by,
    ug.added_at
  FROM ng.groups g
  INNER JOIN ng.user_groups ug ON g.id = ug.group_id
  INNER JOIN ng.users u ON ug.added_by = u.id
  WHERE ug.user_id = $1
  ORDER BY g.name;
`;

export const GET_GROUP_BY_NAME = `
  SELECT * FROM ng.groups 
  WHERE name = $1;
`;

export const GET_GROUP_BY_ID = `
  SELECT * FROM ng.groups 
  WHERE id = $1;
`;

export const CREATE_GROUP = `
  INSERT INTO ng.groups (
    name, description, created_by
  ) VALUES (
    $1, $2, $3
  ) RETURNING id, name, description, created_at;
`;

export const UPDATE_GROUP = `
  UPDATE ng.groups 
  SET 
    name = COALESCE($1, name),
    description = COALESCE($2, description),
    updated_at = CURRENT_TIMESTAMP
  WHERE id = $3
  RETURNING id, name, description, updated_at;
`;

// Listar grupos com métricas
export const LIST_GROUPS = `
  WITH group_metrics AS (
    SELECT 
      g.id,
      COUNT(DISTINCT ug.user_id) as member_count,
      COUNT(DISTINCT mgp.model_id) as model_permissions,
      COUNT(DISTINCT zgp.zone_id) as zone_permissions
    FROM ng.groups g
    LEFT JOIN ng.user_groups ug ON g.id = ug.group_id
    LEFT JOIN ng.model_group_permissions mgp ON g.id = mgp.group_id
    LEFT JOIN ng.zone_group_permissions zgp ON g.id = zgp.group_id
    GROUP BY g.id
  )
  SELECT 
    g.*,
    creator.username as created_by_name,
    gm.member_count,
    gm.model_permissions,
    gm.zone_permissions
  FROM ng.groups g
  JOIN ng.users creator ON g.created_by = creator.id
  JOIN group_metrics gm ON g.id = gm.id
  ORDER BY g.name
  LIMIT $1 OFFSET $2;
`;

export const GET_GROUP_DETAILS = `
  WITH group_metrics AS (
    SELECT 
      COUNT(DISTINCT ug.user_id) as member_count,
      COUNT(DISTINCT mgp.model_id) as model_permissions,
      COUNT(DISTINCT zgp.zone_id) as zone_permissions,
      json_agg(DISTINCT jsonb_build_object(
        'id', u.id,
        'username', u.username,
        'added_at', ug.added_at,
        'added_by', creator.username
      )) FILTER (WHERE u.id IS NOT NULL) as members
    FROM ng.groups g
    LEFT JOIN ng.user_groups ug ON g.id = ug.group_id
    LEFT JOIN ng.users u ON ug.user_id = u.id
    LEFT JOIN ng.users creator ON ug.added_by = creator.id
    LEFT JOIN ng.model_group_permissions mgp ON g.id = mgp.group_id
    LEFT JOIN ng.zone_group_permissions zgp ON g.id = zgp.group_id
    WHERE g.id = $1
    GROUP BY g.id
  )
  SELECT 
    g.*,
    creator.username as created_by_name,
    gm.member_count,
    gm.model_permissions,
    gm.zone_permissions,
    gm.members
  FROM ng.groups g
  JOIN ng.users creator ON g.created_by = creator.id
  JOIN group_metrics gm ON true
  WHERE g.id = $1;
`;

export const ADD_GROUP_MEMBERS = `
  INSERT INTO ng.user_groups (group_id, user_id, added_by)
  SELECT $1, unnest($2::uuid[]), $3
  ON CONFLICT (group_id, user_id) DO NOTHING
  RETURNING user_id;
`;
