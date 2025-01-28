export const LIST_GROUPS = `
  WITH group_metrics AS (
    SELECT 
      g.id,
      COUNT(DISTINCT ug.user_id) as member_count,
      COUNT(DISTINCT mgp.model_id) as model_permissions_count,
      COUNT(DISTINCT zgp.zone_id) as zone_permissions_count,
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
    gm.model_permissions_count,
    gm.zone_permissions_count,
    COALESCE(gm.members, '[]') as members
  FROM ng.groups g
  LEFT JOIN ng.users creator ON g.created_by = creator.id
  LEFT JOIN group_metrics gm ON g.id = gm.id
  WHERE (COALESCE($1, '') = '' OR 
    g.name ILIKE '%' || COALESCE($1, '') || '%' OR 
    g.description ILIKE '%' || COALESCE($1, '') || '%')
  ORDER BY 
    CASE WHEN $4 = 'name' THEN g.name
         WHEN $4 = 'created_at' THEN g.created_at::text
         WHEN $4 = 'updated_at' THEN g.updated_at::text
         WHEN $4 = 'member_count' THEN gm.member_count::text
         WHEN $4 = 'model_permissions_count' THEN gm.model_permissions_count::text
         WHEN $4 = 'zone_permissions_count' THEN gm.zone_permissions_count::text
         ELSE g.name
    END $5:raw
  LIMIT $2 OFFSET $3;
`;

export const COUNT_GROUPS = `
  SELECT COUNT(*)
  FROM ng.groups g
  WHERE (COALESCE($1, '') = '' OR 
    g.name ILIKE '%' || COALESCE($1, '') || '%' OR 
    g.description ILIKE '%' || COALESCE($1, '') || '%')
`;

export const GET_GROUP = `
  WITH model_perms AS (
    SELECT 
      mgp.group_id,
      (COALESCE(json_agg(
        json_build_object(
          'id', m.id,
          'name', m.name,
          'type', m.type,
          'access_level', m.access_level
        )
      ) FILTER (WHERE m.id IS NOT NULL), '[]')::text)::jsonb as models
    FROM ng.model_group_permissions mgp
    JOIN ng.catalogo_3d m ON mgp.model_id = m.id
    WHERE mgp.group_id = $1
    GROUP BY mgp.group_id
  ),
  zone_perms AS (
    SELECT 
      zgp.group_id,
      (COALESCE(json_agg(
        json_build_object(
          'id', z.id,
          'name', z.name,
          'area_km2', ROUND((ST_Area(z.geom::geography) / 1000000)::numeric, 2)
        )
      ) FILTER (WHERE z.id IS NOT NULL), '[]')::text)::jsonb as zones
    FROM ng.zone_group_permissions zgp
    JOIN ng.geographic_access_zones z ON zgp.zone_id = z.id
    WHERE zgp.group_id = $1
    GROUP BY zgp.group_id
  )
  SELECT 
    g.id,
    g.name,
    g.description,
    g.created_by,
    g.created_at,
    g.updated_at,
    creator.username as created_by_name,
    COUNT(DISTINCT ug.user_id) as member_count,
    (COALESCE(mp.models::text, '[]')::jsonb) as model_permissions,
    (COALESCE(zp.zones::text, '[]')::jsonb) as zone_permissions,
    (COALESCE(
      json_agg(
        json_build_object(
          'id', u.id,
          'username', u.username,
          'addedAt', ug.added_at,
          'addedBy', adder.username
        )
      ) FILTER (WHERE u.id IS NOT NULL),
      '[]'
    )::text)::jsonb as members
  FROM ng.groups g
  LEFT JOIN ng.user_groups ug ON g.id = ug.group_id
  LEFT JOIN ng.users u ON ug.user_id = u.id
  LEFT JOIN ng.users adder ON ug.added_by = adder.id
  LEFT JOIN ng.users creator ON g.created_by = creator.id
  LEFT JOIN model_perms mp ON g.id = mp.group_id
  LEFT JOIN zone_perms zp ON g.id = zp.group_id
  WHERE g.id = $1
  GROUP BY g.id, g.name, g.description, g.created_by, g.created_at, g.updated_at, creator.username, mp.models, zp.zones;
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
  WITH current_members AS (
    SELECT user_id 
    FROM ng.user_groups 
    WHERE group_id = $1
  ),
  members_to_remove AS (
    DELETE FROM ng.user_groups
    WHERE group_id = $1
    AND user_id NOT IN (SELECT unnest($2::uuid[]))
    RETURNING user_id
  ),
  members_to_add AS (
    SELECT unnest($2::uuid[]) as user_id
    EXCEPT
    SELECT user_id FROM current_members
  )
  INSERT INTO ng.user_groups (group_id, user_id, added_by)
  SELECT $1, user_id, $3
  FROM members_to_add
  WHERE EXISTS (SELECT 1 FROM members_to_add);
`;
