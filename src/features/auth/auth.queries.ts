export const VALIDATE_LOGIN = `
  SELECT 
    id, 
    username,
    email,
    password,
    role,
    is_active
  FROM ng.users 
  WHERE username = $1 AND is_active = true;
`;

export const GET_API_KEY = `
  SELECT 
    api_key,
    api_key_created_at
  FROM ng.users 
  WHERE id = $1;
`;

export const UPDATE_USER_API_KEY = `
  WITH old_key AS (
    SELECT api_key, id
    FROM ng.users
    WHERE id = $1 AND is_active = true
  ),
  insert_history AS (
    INSERT INTO ng.api_key_history (
      user_id, 
      api_key, 
      revoked_at, 
      revoked_by
    )
    SELECT 
      $1, 
      api_key, 
      CURRENT_TIMESTAMP, 
      $3
    FROM old_key
  )
  UPDATE ng.users 
  SET 
    api_key = $2, 
    api_key_created_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
  WHERE id = $1 AND is_active = true
  RETURNING 
    api_key, 
    api_key_created_at;
`;

export const GET_API_KEY_HISTORY = `
  SELECT 
    api_key,
    created_at,
    revoked_at,
    revoked_at IS NULL as is_active
  FROM ng.api_key_history
  WHERE user_id = $1
  ORDER BY created_at DESC;
`;

export const VALIDATE_API_KEY = `
  SELECT 
    id, 
    username, 
    role, 
    is_active
  FROM ng.users 
  WHERE api_key = $1 AND is_active = true;
`;
