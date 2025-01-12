CREATE TABLE ng.edificacoes (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    nome VARCHAR(255),
    municipio VARCHAR(255),
    estado VARCHAR(255),
    tipo VARCHAR(255),
    altitude_base numeric,
    altitude_topo numeric,
    geom GEOMETRY(POLYGON, 4326) NOT NULL,
    CONSTRAINT edificacoes_pk PRIMARY KEY (id),
    CONSTRAINT chk_altitude_base_topo CHECK (altitude_base <= altitude_topo)
);

CREATE INDEX idx_edificacoes_geometry ON ng.edificacoes USING GIST (geom);
CREATE INDEX idx_edificacoes_altitude ON ng.edificacoes (altitude_base, altitude_topo);