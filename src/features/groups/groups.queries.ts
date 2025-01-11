export const GET_USER_GROUPS = `
  SELECT 
    g.id,
    g.name,
    g.description,
    g.created_at,
    u.username as added_by,
    ug.added_at
  FROM ng.groups g
  INNER JOIN ng.user_groups ug ON g.id = ug.group_id
  INNER JOIN ng.users u ON ug.added_by = u.id
  WHERE ug.user_id = $1
  ORDER BY g.name;
`;

export const GET_GROUP_BY_NAME = `
  SELECT * FROM ng.groups 
  WHERE name = $1;
`;

export const GET_GROUP_BY_ID = `
  SELECT * FROM ng.groups 
  WHERE id = $1;
`;

export const CREATE_GROUP = `
  INSERT INTO ng.groups (
    name, description, created_by
  ) VALUES (
    $1, $2, $3
  ) RETURNING id, name, description, created_at;
`;

export const UPDATE_GROUP = `
  UPDATE ng.groups 
  SET 
    name = COALESCE($1, name),
    description = COALESCE($2, description),
    updated_at = CURRENT_TIMESTAMP
  WHERE id = $3
  RETURNING id, name, description, updated_at;
`;
