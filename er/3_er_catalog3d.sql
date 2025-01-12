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
    data_carregamento TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    search_vector tsvector,
    style JSONB,
    access_level VARCHAR(20) DEFAULT 'public' NOT NULL,
    CONSTRAINT catalogo_3d_pk PRIMARY KEY (id),
    CONSTRAINT valid_access_level CHECK (access_level IN ('public', 'private'))
);

CREATE INDEX idx_catalogo_3d_data_criacao ON ng.catalogo_3d (data_criacao DESC);
CREATE INDEX idx_catalogo_3d_search_vector ON ng.catalogo_3d USING GIN (search_vector);
CREATE INDEX idx_catalogo_3d_access_level ON ng.catalogo_3d(id, access_level);

CREATE OR REPLACE FUNCTION ng.catalogo_3d_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('portuguese', COALESCE(NEW.name, '')), 'A') ||
    setweight(to_tsvector('portuguese', COALESCE(array_to_string(NEW.palavras_chave, ' '), '')), 'A');
    setweight(to_tsvector('portuguese', COALESCE(NEW.description, '')), 'B') ||
    setweight(to_tsvector('portuguese', COALESCE(NEW.municipio, '')), 'C') ||
    setweight(to_tsvector('portuguese', COALESCE(NEW.estado, '')), 'D')
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER catalogo_3d_search_vector_update
BEFORE INSERT OR UPDATE ON ng.catalogo_3d
FOR EACH ROW EXECUTE FUNCTION ng.catalogo_3d_search_vector_update();

CREATE TABLE IF NOT EXISTS ng.model_permissions (
  model_id UUID REFERENCES ng.catalogo_3d(id) ON DELETE CASCADE,
  user_id UUID REFERENCES ng.users(id) ON DELETE CASCADE,
  PRIMARY KEY (model_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_model_permissions_user ON ng.model_permissions(user_id);
CREATE INDEX idx_model_permissions ON ng.model_permissions(model_id, user_id);

CREATE TABLE IF NOT EXISTS ng.model_group_permissions (
  model_id UUID REFERENCES ng.catalogo_3d(id) ON DELETE CASCADE,
  group_id UUID REFERENCES ng.groups(id) ON DELETE CASCADE,
  PRIMARY KEY (model_id, group_id)
);

CREATE INDEX IF NOT EXISTS idx_model_group_permissions_group ON ng.model_group_permissions(group_id);
CREATE INDEX idx_model_group_permissions ON ng.model_group_permissions(model_id, group_id);
