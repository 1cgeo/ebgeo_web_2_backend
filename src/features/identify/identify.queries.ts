export const FIND_NEAREST_FEATURE = `
WITH user_role AS (
  SELECT EXISTS (
    SELECT 1 
    FROM ng.users u 
    WHERE u.id = $4 AND u.role = 'admin'
  ) as is_admin
),
user_model_permissions AS (
  SELECT DISTINCT model_id
  FROM (
    -- Permissões diretas
    SELECT model_id FROM ng.model_permissions WHERE user_id = $4
    UNION
    -- Permissões via grupo
    SELECT mgp.model_id
    FROM ng.model_group_permissions mgp
    JOIN ng.user_groups ug ON mgp.group_id = ug.group_id
    WHERE ug.user_id = $4
  ) perms
),
click_point AS (
  SELECT ST_SetSRID(ST_MakePoint($1, $2), 4674) AS geom
),
buffered_point AS (
  SELECT ST_Buffer(geom::geography, 3)::geometry AS geom FROM click_point
),
filtered_identify AS (
  SELECT e.*, c.name as model_name, c.description as model_description
  FROM ng.identify e
  JOIN ng.catalogo_3d c ON c.id = e.model_id
  CROSS JOIN user_role ur
  LEFT JOIN user_model_permissions ump ON ump.model_id = e.model_id
  WHERE 
    -- Modelo é público
    c.access_level = 'public'
    -- Ou usuário tem permissão
    OR ($4::UUID IS NOT NULL AND (
      ur.is_admin 
      OR ump.model_id IS NOT NULL
    ))
),
nearest_feature AS (
  SELECT 
    e.*,
    CASE 
      WHEN $3 < e.altitude_base THEN e.altitude_base - $3
      WHEN $3 > e.altitude_topo THEN $3 - e.altitude_topo
      ELSE 0
    END AS z_distance,
    ST_Distance(e.geom, c.geom) AS xy_distance
  FROM filtered_identify e
  CROSS JOIN click_point c
  WHERE ST_DWithin(
    e.geom::geography, 
    c.geom::geography, 
    300
  )
  ORDER BY 
    CASE 
      WHEN $3 < e.altitude_base THEN e.altitude_base - $3
      WHEN $3 > e.altitude_topo THEN $3 - e.altitude_topo
      ELSE 0
    END ASC,
    ST_Distance(e.geom, c.geom) ASC
  LIMIT 1
)
SELECT * FROM nearest_feature;
`;
