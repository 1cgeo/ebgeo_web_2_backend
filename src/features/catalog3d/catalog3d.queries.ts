export const COUNT_CATALOG = `
  WITH user_role AS (
  SELECT EXISTS (
    SELECT 1 
    FROM ng.users u 
    WHERE u.id = $2 AND u.role = 'admin'
  ) as is_admin
),
allowed_models AS (
  SELECT c.id
  FROM ng.catalogo_3d c
  CROSS JOIN user_role ur
  LEFT JOIN (
    -- União de permissões diretas e via grupo
    SELECT DISTINCT model_id
    FROM (
      -- Permissões diretas
      SELECT model_id 
      FROM ng.model_permissions 
      WHERE user_id = $2
      UNION
      -- Permissões via grupo
      SELECT mgp.model_id
      FROM ng.model_group_permissions mgp
      JOIN ng.user_groups ug ON mgp.group_id = ug.group_id
      WHERE ug.user_id = $2
    ) all_permissions
  ) user_perms ON user_perms.model_id = c.id
  WHERE 
    c.access_level = 'public'
    OR ($2::UUID IS NOT NULL AND (
      ur.is_admin OR user_perms.model_id IS NOT NULL
    ))
)
SELECT COUNT(*)
FROM ng.catalogo_3d c
JOIN allowed_models am ON c.id = am.id
WHERE ($1::text IS NULL OR search_vector @@ plainto_tsquery('portuguese', $1));
`;

export const SEARCH_CATALOG = `
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
    SELECT model_id 
    FROM ng.model_permissions 
    WHERE user_id = $4
    UNION
    -- Permissões via grupo
    SELECT mgp.model_id
    FROM ng.model_group_permissions mgp
    JOIN ng.user_groups ug ON mgp.group_id = ug.group_id
    WHERE ug.user_id = $4
  ) perms
),
ranked_models AS (
  SELECT 
    c.*,
    CASE 
      WHEN $1 IS NOT NULL THEN ts_rank(search_vector, plainto_tsquery('portuguese', $1))
      ELSE 0 
    END as rank_score
  FROM ng.catalogo_3d c
  CROSS JOIN user_role ur
  LEFT JOIN user_model_permissions ump ON ump.model_id = c.id
  WHERE (
    c.access_level = 'public'
    OR ($4::UUID IS NOT NULL AND (ur.is_admin OR ump.model_id IS NOT NULL))
  )
  AND ($1::text IS NULL OR search_vector @@ plainto_tsquery('portuguese', $1))
)
SELECT 
  id, name, description, thumbnail, url, 
  lon, lat, height, heading, pitch, roll, 
  type, heightoffset, maximumscreenspaceerror, 
  data_carregamento, municipio, estado, palavras_chave, style,
  access_level
FROM ranked_models
ORDER BY rank_score DESC, data_carregamento DESC
LIMIT $2 OFFSET $3;
`;

// Query para verificar se um usuário tem acesso a um modelo específico
export const CHECK_MODEL_ACCESS = `
  SELECT EXISTS (
    SELECT 1
    FROM ng.catalogo_3d c
    WHERE c.id = $1
    AND (
      c.access_level = 'public'
      OR ($2::UUID IS NOT NULL AND (
          -- É admin
          EXISTS (SELECT 1 FROM ng.users u WHERE u.id = $2 AND u.role = 'admin')
          -- Tem permissão direta
          OR EXISTS (SELECT 1 FROM ng.model_permissions mp WHERE mp.model_id = c.id AND mp.user_id = $2)
          -- Tem permissão via grupo
          OR EXISTS (
              SELECT 1 
              FROM ng.model_group_permissions mgp
              JOIN ng.user_groups ug ON mgp.group_id = ug.group_id
              WHERE mgp.model_id = c.id AND ug.user_id = $2
          )
      ))
    )
  ) as has_access;
`;

// Query para listar permissões de um modelo
export const LIST_MODEL_PERMISSIONS = `
  SELECT 
    c.id as model_id,
    c.name as model_name,
    c.access_level,
    ARRAY(
      SELECT json_build_object('id', u.id, 'username', u.username)
      FROM ng.model_permissions mp
      JOIN ng.users u ON mp.user_id = u.id
      WHERE mp.model_id = c.id
    ) as user_permissions,
    ARRAY(
      SELECT json_build_object('id', g.id, 'name', g.name)
      FROM ng.model_group_permissions mgp
      JOIN ng.groups g ON mgp.group_id = g.id
      WHERE mgp.model_id = c.id
    ) as group_permissions
  FROM ng.catalogo_3d c
  WHERE c.id = $1;
`;
