-- Criação da tabela de auditoria
CREATE TABLE ng.audit_trail (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action VARCHAR(50) NOT NULL,
    actor_id UUID NOT NULL REFERENCES ng.users(id),
    target_type VARCHAR(20),
    target_id UUID,
    target_name VARCHAR(255),
    details JSONB,
    ip VARCHAR(45) NOT NULL,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_action CHECK (
        action IN (
            'USER_CREATE',
            'USER_UPDATE',
            'USER_DELETE',
            'USER_ROLE_CHANGE',
            'GROUP_CREATE',
            'GROUP_UPDATE',
            'GROUP_DELETE',
            'MODEL_PERMISSION_CHANGE',
            'ZONE_PERMISSION_CHANGE',
            'API_KEY_REGENERATE',
            'ADMIN_LOGIN',
            'ADMIN_ACTION'
        )
    ),
    CONSTRAINT valid_target_type CHECK (
        target_type IN ('USER', 'GROUP', 'MODEL', 'ZONE', 'SYSTEM')
    )
);

-- Índices para melhorar performance de consultas comuns
CREATE INDEX idx_audit_trail_actor ON ng.audit_trail(actor_id);
CREATE INDEX idx_audit_trail_target ON ng.audit_trail(target_type, target_id);
CREATE INDEX idx_audit_trail_action ON ng.audit_trail(action);
CREATE INDEX idx_audit_trail_created_at ON ng.audit_trail(created_at DESC);

-- Índice composto para pesquisas frequentes
CREATE INDEX idx_audit_trail_composite ON ng.audit_trail(created_at DESC, action, actor_id);

CREATE INDEX idx_audit_trail_created_at_action ON ng.audit_trail(created_at DESC, action);

-- Índice GIN para busca em details
CREATE INDEX idx_audit_trail_details ON ng.audit_trail USING GIN (details);

-- Função para criar entrada de auditoria automaticamente
CREATE OR REPLACE FUNCTION ng.create_audit_log(
    p_action VARCHAR(50),
    p_actor_id UUID,
    p_target_type VARCHAR(20),
    p_target_id UUID,
    p_target_name VARCHAR(255),
    p_details JSONB,
    p_ip VARCHAR(45),
    p_user_agent TEXT
) RETURNS UUID AS $$
DECLARE
    v_audit_id UUID;
BEGIN
    INSERT INTO ng.audit_trail (
        action,
        actor_id,
        target_type,
        target_id,
        target_name,
        details,
        ip,
        user_agent
    ) VALUES (
        p_action,
        p_actor_id,
        p_target_type,
        p_target_id,
        p_target_name,
        p_details,
        p_ip,
        p_user_agent
    )
    RETURNING id INTO v_audit_id;

    RETURN v_audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;