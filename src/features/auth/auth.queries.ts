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

export const GET_USER_GROUPS = `
  SELECT g.* FROM ng.groups g
  INNER JOIN ng.user_groups ug ON g.id = ug.group_id
  WHERE ug.user_id = $1;
`;
