export enum ModelAccessLevel {
  PUBLIC = 'public',
  PRIVATE = 'private',
}
export interface Catalog3D {
  id: string;
  name: string;
  description?: string;
  thumbnail?: string;
  url: string;
  lon?: number;
  lat?: number;
  height?: number;
  heading?: number;
  pitch?: number;
  roll?: number;
  type: string;
  heightoffset?: number;
  maximumscreenspaceerror?: number;
  data_criacao: Date;
  data_carregamento: Date;
  municipio?: string;
  estado?: string;
  palavras_chave?: string[];
  style?: Record<string, any>;
  access_level: ModelAccessLevel;
}

export interface SearchResult {
  total: number;
  page: number;
  nr_records: number;
  data: Catalog3D[];
}

export interface UpdateModelPermissionsRequest {
  access_level?: ModelAccessLevel;
  userIds?: string[];
  groupIds?: string[];
}

export interface ModelPermissionsQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  sort?: 'name' | 'created_at' | 'access_level' | 'user_count' | 'group_count';
  order?: 'asc' | 'desc';
}

export interface ModelPermissionsSummary {
  model_id: string;
  model_name: string;
  model_type: string;
  access_level: 'public' | 'private';
  data_carregamento: Date;
  user_count: number;
  group_count: number;
  users: Array<{
    id: string;
    username: string;
  }>;
  groups: Array<{
    id: string;
    name: string;
  }>;
}
