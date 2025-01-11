export const SEARCH_GEOGRAPHIC_NAMES = `
  WITH ranked_features AS (
    SELECT 
      nome,
      ST_X(geom) AS longitude,
      ST_Y(geom) AS latitude,
      municipio,
      estado,
      tipo,
      similarity(nome_unaccent, unaccent(lower($1))) AS name_similarity,
      ST_Distance(
        geom::geography, 
        ST_SetSRID(ST_MakePoint($3, $2), 4674)::geography
      ) AS distance_to_center
    FROM ng.nomes_geograficos
    ORDER BY name_similarity DESC, distance_to_center ASC
    LIMIT 50
  )
  SELECT *,
    (name_similarity * 0.7 + (1 - LEAST(distance_to_center / 1000000, 1)) * 0.3) AS relevance_score
  FROM ranked_features
  ORDER BY relevance_score DESC
  LIMIT 5
`;
