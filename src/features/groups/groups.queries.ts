export const LIST_GROUPS = `
  WITH group_metrics AS (
    SELECT 
      g.id,
      COUNT(DISTINCT ug.user_id) as member_count,
      COUNT(DISTINCT mgp.model_id) as model_permissions,
      COUNT(DISTINCT zgp.zone_id) as zone_permissions,
      json_agg(
        json_build_object(
          'id', u.id,
          'username', u.username,
          'addedAt', ug.added_at,
          'addedBy', creator.username
        ) ORDER BY ug.added_at DESC
      ) FILTER (WHERE u.id IS NOT NULL) as members
    FROM ng.groups g
    LEFT JOIN ng.user_groups ug ON g.id = ug.group_id
    LEFT JOIN ng.users u ON ug.user_id = u.id
    LEFT JOIN ng.users creator ON ug.added_by = creator.id
    LEFT JOIN ng.model_group_permissions mgp ON g.id = mgp.group_id
    LEFT JOIN ng.zone_group_permissions zgp ON g.id = zgp.group_id
    GROUP BY g.id
  )
  SELECT 
    g.*,
    creator.username as created_by_name,
    gm.member_count,
    gm.model_permissions,
    gm.zone_permissions,
    COALESCE(gm.members, '[]') as members
  FROM ng.groups g
  JOIN ng.users creator ON g.created_by = creator.id
  LEFT JOIN group_metrics gm ON g.id = gm.id
  WHERE (COALESCE($1, '') = '' OR 
    LOWER(g.name) ILIKE '%' || COALESCE($1, '') || '%' OR 
    LOWER(g.description) ILIKE '%' || COALESCE($1, '') || '%')
  ORDER BY g.name
  LIMIT $2 OFFSET $3;
`;

export const COUNT_GROUPS = `
  SELECT COUNT(*)
  FROM ng.groups u
  WHERE (COALESCE($1, '') = '' OR 
    LOWER(name) ILIKE '%' || COALESCE($1, '') || '%' OR 
    LOWER(description) ILIKE '%' || COALESCE($1, '') || '%')
`;

export const GET_GROUP = `
  WITH group_metrics AS (
    SELECT 
      COUNT(DISTINCT ug.user_id) as member_count,
      COUNT(DISTINCT mgp.model_id) as model_permissions,
      COUNT(DISTINCT zgp.zone_id) as zone_permissions,
      json_agg(
        json_build_object(
          'id', u.id,
          'username', u.username,
          'addedAt', ug.added_at,
          'addedBy', creator.username
        ) ORDER BY ug.added_at DESC
      ) FILTER (WHERE u.id IS NOT NULL) as members
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
    COALESCE(gm.members, '[]') as members
  FROM ng.groups g
  JOIN ng.users creator ON g.created_by = creator.id
  LEFT JOIN group_metrics gm ON true
  WHERE g.id = $1;
`;

export const CREATE_GROUP = `
  INSERT INTO ng.groups (
    name, description, created_by
  ) VALUES (
    $1, $2, $3
  ) RETURNING id;
`;

export const UPDATE_GROUP = `
  UPDATE ng.groups 
  SET 
    name = COALESCE($1, name),
    description = COALESCE($2, description),
    updated_at = CURRENT_TIMESTAMP
  WHERE id = $3
  RETURNING id;
`;

export const UPDATE_GROUP_MEMBERS = `
  WITH deleted_members AS (
    DELETE FROM ng.user_groups
    WHERE group_id = $1
    RETURNING user_id
  )
  INSERT INTO ng.user_groups (group_id, user_id, added_by)
  SELECT $1, unnest($2::uuid[]), $3
  WHERE array_length($2::uuid[], 1) > 0;
`;
