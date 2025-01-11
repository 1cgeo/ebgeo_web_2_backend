export const COUNT_CATALOG = `
  SELECT COUNT(*) 
  FROM ng.catalogo_3d
  WHERE ($1::text IS NULL OR search_vector @@ plainto_tsquery('portuguese', $1))
`;

export const SEARCH_CATALOG = `
  SELECT 
    id, name, description, thumbnail, url, 
    lon, lat, height, heading, pitch, roll, 
    type, heightoffset, maximumscreenspaceerror, 
    data_criacao, municipio, estado, palavras_chave, style,
    ts_rank(
      search_vector, 
      plainto_tsquery('portuguese', $1),
      2  -- Peso normalizado considerando a frequência dos termos
    ) * 
    CASE 
      WHEN name ILIKE '%' || $1 || '%' THEN 2.0  -- Boost se encontrar no nome
      WHEN $1 = ANY(palavras_chave) THEN 1.5     -- Boost se for palavra-chave exata
      ELSE 1.0 
    END as rank
  FROM ng.catalogo_3d
  WHERE ($1::text IS NULL OR search_vector @@ plainto_tsquery('portuguese', $1))
  ORDER BY 
    rank DESC,
    data_criacao DESC
  LIMIT $2 OFFSET $3
`;
