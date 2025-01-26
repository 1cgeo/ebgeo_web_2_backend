export interface Group {
  id: string;
  name: string;
  description?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface GroupDetails extends Group {
  memberCount: number;
  modelPermissionsCount: number;
  zonePermissionsCount: number;
  members: GroupMember[];
  modelPermissions?: {
    id: string;
    name: string;
    type: string;
    access_level: string;
  }[];
  zonePermissions?: {
    id: string;
    name: string;
    area_km2: number;
  }[];
}

export interface GroupMember {
  id: string;
  username: string;
  addedAt: Date;
  addedBy: string;
}

export interface CreateGroupDTO {
  name: string;
  description?: string;
  userIds?: string[];
}

export interface UpdateGroupDTO {
  name?: string;
  description?: string;
  userIds?: string[];
}

export interface GroupQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  sort?:
    | 'name'
    | 'created_at'
    | 'updated_at'
    | 'member_count'
    | 'model_permissions_count'
    | 'zone_permissions_count';
  order?: 'asc' | 'desc';
}
