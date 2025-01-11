export const COUNT_CATALOG = `
  WITH user_permissions AS (
    SELECT DISTINCT c.id
    FROM ng.catalogo_3d c
    WHERE c.access_level = 'public'
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
  SELECT COUNT(*)
  FROM user_permissions up
  JOIN ng.catalogo_3d c ON c.id = up.id
  WHERE ($1::text IS NULL OR search_vector @@ plainto_tsquery('portuguese', $1));
`;

export const SEARCH_CATALOG = `
  WITH user_permissions AS (
    SELECT DISTINCT c.id
    FROM ng.catalogo_3d c
    WHERE c.access_level = 'public'
       OR ($4::UUID IS NOT NULL AND (
            -- É admin
            EXISTS (SELECT 1 FROM ng.users u WHERE u.id = $4 AND u.role = 'admin')
            -- Tem permissão direta
            OR EXISTS (SELECT 1 FROM ng.model_permissions mp WHERE mp.model_id = c.id AND mp.user_id = $4)
            -- Tem permissão via grupo
            OR EXISTS (
                SELECT 1 
                FROM ng.model_group_permissions mgp
                JOIN ng.user_groups ug ON mgp.group_id = ug.group_id
                WHERE mgp.model_id = c.id AND ug.user_id = $4
            )
       ))
  )
  SELECT 
    c.id, c.name, c.description, c.thumbnail, c.url, 
    c.lon, c.lat, c.height, c.heading, c.pitch, c.roll, 
    c.type, c.heightoffset, c.maximumscreenspaceerror, 
    c.data_carregamento, c.municipio, c.estado, c.palavras_chave, c.style,
    c.access_level
  FROM user_permissions up
  JOIN ng.catalogo_3d c ON c.id = up.id
  WHERE ($1::text IS NULL OR search_vector @@ plainto_tsquery('portuguese', $1))
  ORDER BY 
    CASE 
      WHEN $1 IS NOT NULL THEN ts_rank(search_vector, plainto_tsquery('portuguese', $1))
      ELSE 0 
    END DESC,
    c.data_carregamento DESC
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
