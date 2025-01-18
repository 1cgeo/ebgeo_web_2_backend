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
  modelPermissions: number;
  zonePermissions: number;
  members: GroupMember[];
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
}
