import { ParamsDictionary } from 'express-serve-static-core';

export interface Group {
  id: string;
  name: string;
  description?: string;
  createdBy: string; // User ID
  createdAt: Date;
  updatedAt: Date;
}

export interface UserGroup {
  userId: string;
  groupId: string;
  addedBy: string; // User ID
  addedAt: Date;
}

export interface CreateGroupBody {
  name: string;
  description?: string;
}

export interface UpdateGroupParams extends ParamsDictionary {
  groupId: string;
}

export interface UpdateGroupBody {
  name?: string;
  description?: string;
}
