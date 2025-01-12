CREATE TABLE ng.nomes_geograficos (
	id uuid NOT NULL DEFAULT uuid_generate_v4(),
    nome VARCHAR(255) NOT NULL,
    nome_unaccent TEXT GENERATED ALWAYS AS (unaccent(lower(nome))) STORED,
    municipio VARCHAR(255),
    estado VARCHAR(255),
    tipo VARCHAR(255),
    access_level VARCHAR(20) NOT NULL DEFAULT 'public',
    geom GEOMETRY(POINT, 4674) NOT NULL,
	CONSTRAINT nomes_geograficos_pk PRIMARY KEY (id),
  CONSTRAINT valid_name_access_level CHECK (access_level IN ('public', 'private'));
);

CREATE INDEX idx_geographic_features_geometry ON ng.nomes_geograficos USING GIST (geom);
CREATE INDEX idx_nomes_geograficos_nome_unaccent ON ng.nomes_geograficos USING GIN (nome_unaccent gin_trgm_ops);
CREATE INDEX idx_nomes_geograficos_access_level ON ng.nomes_geograficos(access_level);
CREATE INDEX idx_nomes_geograficos_public ON ng.nomes_geograficos(access_level) 
WHERE access_level = 'public';

ALTER TABLE ng.nomes_geograficos ALTER COLUMN access_level SET STATISTICS 1000;

CREATE TABLE ng.geographic_access_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    geom GEOMETRY(POLYGON, 4674) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_geographic_access_zones_geom ON ng.geographic_access_zones USING GIST (geom);

CREATE TABLE ng.zone_permissions (
    zone_id UUID REFERENCES ng.geographic_access_zones(id) ON DELETE CASCADE,
    user_id UUID REFERENCES ng.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES ng.users(id),
    PRIMARY KEY (zone_id, user_id)
);

CREATE INDEX idx_zone_permissions ON ng.zone_permissions(zone_id, user_id);

CREATE TABLE ng.zone_group_permissions (
    zone_id UUID REFERENCES ng.geographic_access_zones(id) ON DELETE CASCADE,
    group_id UUID REFERENCES ng.groups(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES ng.users(id),
    PRIMARY KEY (zone_id, group_id)
);

CREATE INDEX idx_zone_group_permissions ON ng.zone_group_permissions(zone_id, group_id);

