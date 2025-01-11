export const FIND_NEAREST_BUILDING = `
  WITH click_point AS (
    SELECT ST_SetSRID(ST_MakePoint($1, $2), 4326) AS geom
  ),
  buffered_point AS (
    SELECT ST_Buffer(geom::geography, 3)::geometry AS geom FROM click_point
  ),
  intersecting_edificacoes AS (
    SELECT 
      e.id,
      e.nome,
      e.municipio,
      e.estado,
      e.tipo,
      e.altitude_base,
      e.altitude_topo,
      CASE 
        WHEN $3 < e.altitude_base THEN e.altitude_base - $3
        WHEN $3 > e.altitude_topo THEN $3 - e.altitude_topo
        ELSE 0
      END AS z_distance,
      ST_Distance(e.geom, c.geom) AS xy_distance
    FROM ng.edificacoes e
    INNER JOIN buffered_point bp ON bp.geom && e.geom
    INNER JOIN click_point c ON c.geom && bp.geom
    WHERE ST_Intersects(e.geom, bp.geom) AND ST_Intersects(c.geom, bp.geom)
  )
  SELECT *
  FROM intersecting_edificacoes
  ORDER BY z_distance ASC, xy_distance ASC
  LIMIT 1
`;
