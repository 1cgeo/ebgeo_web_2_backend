export const CREATE_USER = `
  INSERT INTO ng.users (
    username, password, email, role, api_key, is_active, 
    created_at, updated_at
  ) VALUES (
    $1, $2, $3, $4, $5, true, 
    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  ) RETURNING id, username, email, role, api_key, is_active;
`;

export const GET_USER_BY_USERNAME = `
  SELECT * FROM ng.users WHERE username = $1 AND is_active = true;
`;

export const GET_USER_BY_API_KEY = `
  SELECT * FROM ng.users WHERE api_key = $1 AND is_active = true;
`;

export const GET_USER_API_KEY_HISTORY = `
  SELECT 
    api_key,
    created_at,
    revoked_at
  FROM ng.api_key_history
  WHERE user_id = $1
  ORDER BY created_at DESC;
`;

export const UPDATE_USER_API_KEY = `
  WITH old_key AS (
    SELECT api_key, id
    FROM ng.users
    WHERE id = $1 AND is_active = true
  ),
  insert_history AS (
    INSERT INTO ng.api_key_history (user_id, api_key, revoked_at, revoked_by)
    SELECT $1, api_key, CURRENT_TIMESTAMP, $3
    FROM old_key
  )
  UPDATE ng.users 
  SET api_key = $2, 
      api_key_created_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = $1 AND is_active = true
  RETURNING api_key, api_key_created_at;
`;

export const UPDATE_USER_LAST_LOGIN = `
  UPDATE ng.users 
  SET last_login = CURRENT_TIMESTAMP 
  WHERE id = $1;
`;

export const GET_MODEL_ACCESS = `
  WITH user_groups AS (
    SELECT group_id FROM ng.user_groups WHERE user_id = $1
  )
  SELECT m.* FROM ng.model_shares m
  WHERE m.model_id = $2
    AND (
      m.access_level = 'public'
      OR (
        m.shared_with->>'userIds' IS NOT NULL 
        AND $1::text = ANY(ARRAY(SELECT jsonb_array_elements_text(m.shared_with->'userIds')))
      )
      OR (
        m.shared_with->>'groupIds' IS NOT NULL 
        AND EXISTS (
          SELECT 1 FROM user_groups ug
          WHERE ug.group_id = ANY(ARRAY(SELECT jsonb_array_elements_text(m.shared_with->'groupIds')))
        )
      )
    );
`;

export const GET_USER_GROUPS = `
  SELECT g.* FROM ng.groups g
  INNER JOIN ng.user_groups ug ON g.id = ug.group_id
  WHERE ug.user_id = $1;
`;

export const SHARE_MODEL = `
  INSERT INTO ng.model_shares (
    model_id, access_level, shared_with, created_by, 
    created_at, updated_at
  ) VALUES (
    $1, $2, $3, $4,
    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  ) ON CONFLICT (model_id) 
  DO UPDATE SET 
    access_level = EXCLUDED.access_level,
    shared_with = EXCLUDED.shared_with,
    updated_at = CURRENT_TIMESTAMP
  RETURNING *;
`;
