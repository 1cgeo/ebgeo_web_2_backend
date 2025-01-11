CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE SCHEMA IF NOT EXISTS ng;

CREATE TABLE ng.nomes_geograficos (
	id uuid NOT NULL DEFAULT uuid_generate_v4(),
    nome VARCHAR(255) NOT NULL,
    nome_unaccent TEXT GENERATED ALWAYS AS (unaccent(lower(nome))) STORED,
    municipio VARCHAR(255),
    estado VARCHAR(255),
    tipo VARCHAR(255),
    geom GEOMETRY(POINT, 4674) NOT NULL,
	CONSTRAINT nomes_geograficos_pk PRIMARY KEY (id)
);

CREATE INDEX idx_geographic_features_geometry ON ng.nomes_geograficos USING GIST (geom);
CREATE INDEX idx_nomes_geograficos_nome_unaccent ON ng.nomes_geograficos USING GIN (nome_unaccent gin_trgm_ops);

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

CREATE TABLE ng.catalogo_3d (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    municipio VARCHAR(255),
    estado VARCHAR(255),
    thumbnail VARCHAR(255),
    palavras_chave TEXT[],
    url VARCHAR(255) NOT NULL,
    lon NUMERIC,
    lat NUMERIC,
    height NUMERIC,
    heading NUMERIC,
    pitch NUMERIC,
    roll NUMERIC,
    type VARCHAR(50) NOT NULL,
    heightoffset NUMERIC,
    maximumscreenspaceerror NUMERIC,
    data_criacao TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    search_vector tsvector,
    style JSONB,
    CONSTRAINT catalogo_3d_pk PRIMARY KEY (id)
);

CREATE INDEX idx_catalogo_3d_data_criacao ON ng.catalogo_3d (data_criacao DESC);
CREATE INDEX idx_catalogo_3d_search_vector ON ng.catalogo_3d USING GIN (search_vector);

CREATE OR REPLACE FUNCTION ng.catalogo_3d_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('portuguese', COALESCE(NEW.name, '')), 'A') ||
    setweight(to_tsvector('portuguese', COALESCE(array_to_string(NEW.palavras_chave, ' '), '')), 'A');
    setweight(to_tsvector('portuguese', COALESCE(NEW.description, '')), 'B') ||
    setweight(to_tsvector('portuguese', COALESCE(NEW.municipio, '')), 'C') ||
    setweight(to_tsvector('portuguese', COALESCE(NEW.estado, '')), 'D') ||
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER catalogo_3d_search_vector_update
BEFORE INSERT OR UPDATE ON ng.catalogo_3d
FOR EACH ROW EXECUTE FUNCTION ng.catalogo_3d_search_vector_update();

GRANT ALL PRIVILEGES ON DATABASE nomes_geograficos TO user_ebgeo2;
GRANT ALL ON SCHEMA ng TO user_ebgeo2;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA ng TO user_ebgeo2;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA ng TO user_ebgeo2;