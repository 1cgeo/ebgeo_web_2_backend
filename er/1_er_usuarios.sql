CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE SCHEMA IF NOT EXISTS ng;

CREATE TYPE ng.posto_graduacao AS ENUM (
    'Civ', 'PCTD', 'Sd EV', 'Sd EP', 'Cb', '3º Sgt', '2º Sgt', '1º Sgt',
    'ST', 'Asp', '2º Ten', '1º Ten', 'Cap', 'Maj', 'TC', 'Cel',
    'Gen Bda', 'Gen Div', 'Gen Ex'
);

CREATE TABLE ng.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    nome_completo VARCHAR(255),
    nome_guerra VARCHAR(50),
    organizacao_militar VARCHAR(255),
    posto_graduacao ng.posto_graduacao,
    role VARCHAR(20) NOT NULL,
    api_key UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
    api_key_created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES ng.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_role CHECK (role IN ('admin', 'user'))
);

CREATE INDEX idx_users_id_role ON ng.users(id, role);

CREATE TABLE ng.groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_by UUID REFERENCES ng.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_username ON ng.users(username);
CREATE INDEX idx_users_api_key ON ng.users(api_key);

CREATE TABLE ng.user_groups (
    user_id UUID REFERENCES ng.users(id) ON DELETE CASCADE,
    group_id UUID REFERENCES ng.groups(id) ON DELETE CASCADE,
    added_by UUID REFERENCES ng.users(id),
    added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, group_id)
);

CREATE INDEX idx_user_groups_user_id ON ng.user_groups(user_id);
CREATE INDEX idx_user_groups_group_id ON ng.user_groups(group_id);
CREATE INDEX idx_user_groups ON ng.user_groups(group_id, user_id);

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