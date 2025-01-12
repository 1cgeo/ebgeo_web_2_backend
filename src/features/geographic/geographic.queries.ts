export const GET_ZONE_PERMISSIONS = `
  SELECT 
    z.id as zone_id,
    z.name as zone_name,
    COALESCE(
      (
        SELECT json_agg(json_build_object('id', u.id, 'username', u.username))
        FROM ng.zone_permissions zp
        JOIN ng.users u ON zp.user_id = u.id
        WHERE zp.zone_id = z.id
      ),
      '[]'
    ) as user_permissions,
    COALESCE(
      (
        SELECT json_agg(json_build_object('id', g.id, 'name', g.name))
        FROM ng.zone_group_permissions zgp
        JOIN ng.groups g ON zgp.group_id = g.id
        WHERE zgp.zone_id = z.id
      ),
      '[]'
    ) as group_permissions
  FROM ng.geographic_access_zones z
  WHERE z.id = $1;
`;

export const SEARCH_GEOGRAPHIC_NAMES = `
WITH user_role AS (
  SELECT EXISTS (
    SELECT 1 
    FROM ng.users u 
    WHERE u.id = $4 AND u.role = 'admin'
  ) as is_admin
),
user_zones AS (
  SELECT DISTINCT z.id, z.geom
  FROM ng.geographic_access_zones z
  WHERE $4 IS NOT NULL 
  AND (
    EXISTS (
      SELECT 1 
      FROM ng.zone_permissions 
      WHERE zone_id = z.id AND user_id = $4
    )
    OR EXISTS (
      SELECT 1 
      FROM ng.zone_group_permissions zgp
      JOIN ng.user_groups ug ON zgp.group_id = ug.group_id
      WHERE zgp.zone_id = z.id AND ug.user_id = $4
    )
  )
),
ranked_features AS (
  SELECT 
    n.*,
    similarity(nome_unaccent, unaccent(lower($1))) AS name_similarity,
    ST_Distance(
      n.geom::geography, 
      ST_SetSRID(ST_MakePoint($3, $2), 4674)::geography
    ) AS distance_to_center
  FROM ng.nomes_geograficos n
  CROSS JOIN user_role ur
  LEFT JOIN user_zones uz ON ST_Contains(uz.geom, n.geom)
  WHERE 
    n.access_level = 'public'
    OR ur.is_admin 
    OR uz.id IS NOT NULL
  ORDER BY 
    similarity(nome_unaccent, unaccent(lower($1))) DESC,
    ST_Distance(
      n.geom::geography, 
      ST_SetSRID(ST_MakePoint($3, $2), 4674)::geography
    ) ASC
  LIMIT 50
)
SELECT 
  nome,
  ST_X(geom) AS longitude,
  ST_Y(geom) AS latitude,
  municipio,
  estado,
  tipo,
  name_similarity,
  distance_to_center,
  (name_similarity * 0.7 + (1 - LEAST(distance_to_center / 1000000, 1)) * 0.3) AS relevance_score,
  access_level
FROM ranked_features
ORDER BY relevance_score DESC
LIMIT 5;
`;
