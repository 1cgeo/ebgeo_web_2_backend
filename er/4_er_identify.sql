CREATE TABLE ng.identify (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    nome VARCHAR(255),
    municipio VARCHAR(255),
    estado VARCHAR(255),
    tipo VARCHAR(255),
    altitude_base numeric,
    altitude_topo numeric,
    geom GEOMETRY(POLYGON, 4326) NOT NULL,
    model_id UUID REFERENCES ng.catalogo_3d(id);
    CONSTRAINT identify_pk PRIMARY KEY (id),
    CONSTRAINT chk_altitude_base_topo CHECK (altitude_base <= altitude_topo)
);

CREATE INDEX idx_identify_geometry ON ng.identify USING GIST (geom);
CREATE INDEX idx_identify_altitude ON ng.identify (altitude_base, altitude_topo);
CREATE INDEX idx_identify_model_id ON ng.identify(model_id);
