CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

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
    access_level VARCHAR(20) DEFAULT 'public' NOT NULL,
    CONSTRAINT catalogo_3d_pk PRIMARY KEY (id),
    CONSTRAINT valid_access_level CHECK (access_level IN ('public', 'private'))
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


CREATE TABLE ng.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(20) NOT NULL,
    api_key UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
    api_key_created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_role CHECK (role IN ('admin', 'user'))
);

CREATE TABLE ng.groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_by UUID NOT NULL REFERENCES ng.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_username ON ng.users(username);
CREATE INDEX idx_users_api_key ON ng.users(api_key);

CREATE TABLE ng.user_groups (
    user_id UUID REFERENCES ng.users(id) ON DELETE CASCADE,
    group_id UUID REFERENCES ng.groups(id) ON DELETE CASCADE,
    added_by UUID NOT NULL REFERENCES ng.users(id),
    added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, group_id)
);

CREATE INDEX idx_user_groups_user_id ON ng.user_groups(user_id);
CREATE INDEX idx_user_groups_group_id ON ng.user_groups(group_id);

CREATE TABLE ng.model_shares (
    model_id UUID REFERENCES ng.catalogo_3d(id) ON DELETE CASCADE,
    access_level VARCHAR(20) NOT NULL,
    shared_with JSONB,
    created_by UUID NOT NULL REFERENCES ng.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (model_id),
    CONSTRAINT valid_share_access_level CHECK (access_level IN ('public', 'private'))
);

CREATE INDEX idx_model_shares_access ON ng.model_shares(access_level);

-- Função para atualizar timestamp de updated_at
CREATE OR REPLACE FUNCTION ng.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para atualizar updated_at
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON ng.users
    FOR EACH ROW
    EXECUTE FUNCTION ng.update_updated_at_column();

CREATE TRIGGER update_groups_updated_at
    BEFORE UPDATE ON ng.groups
    FOR EACH ROW
    EXECUTE FUNCTION ng.update_updated_at_column();

CREATE TRIGGER update_model_shares_updated_at
    BEFORE UPDATE ON ng.model_shares
    FOR EACH ROW
    EXECUTE FUNCTION ng.update_updated_at_column();

-- Função auxiliar para verificar permissões de acesso
CREATE OR REPLACE FUNCTION ng.check_model_access(p_user_id UUID, p_model_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_access_level VARCHAR;
    v_shared_with JSONB;
    v_user_groups UUID[];
BEGIN
    -- Obter nível de acesso e configurações de compartilhamento
    SELECT ms.access_level, ms.shared_with
    INTO v_access_level, v_shared_with
    FROM ng.model_shares ms
    WHERE ms.model_id = p_model_id;

    -- Se não encontrou configuração de compartilhamento, não tem acesso
    IF v_access_level IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Se é público, permite acesso
    IF v_access_level = 'public' THEN
        RETURN TRUE;
    END IF;

    -- Verifica compartilhamento direto com usuário
    IF v_shared_with->>'userIds' IS NOT NULL 
       AND p_user_id::TEXT = ANY(ARRAY(SELECT jsonb_array_elements_text(v_shared_with->'userIds')))
    THEN
        RETURN TRUE;
    END IF;

    -- Verifica compartilhamento via grupo
    SELECT ARRAY_AGG(group_id)
    INTO v_user_groups
    FROM ng.user_groups
    WHERE user_id = p_user_id;

    IF v_shared_with->>'groupIds' IS NOT NULL 
       AND v_user_groups && ARRAY(SELECT jsonb_array_elements_text(v_shared_with->'groupIds')::UUID)
    THEN
        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Tabela de histórico de API keys
CREATE TABLE ng.api_key_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES ng.users(id),
    api_key UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP WITH TIME ZONE,
    revoked_by UUID REFERENCES ng.users(id),
    CONSTRAINT unique_active_api_key UNIQUE (user_id, api_key)
);

CREATE INDEX idx_api_key_history_user ON ng.api_key_history(user_id);
CREATE INDEX idx_api_key_history_key ON ng.api_key_history(api_key);

-- Criar usuário admin inicial
INSERT INTO ng.users (
    username, 
    password, 
    email, 
    role
) VALUES (
    'admin',
    crypt('change-this-password', gen_salt('bf')),
    'admin@example.com',
    'admin'
) ON CONFLICT DO NOTHING;