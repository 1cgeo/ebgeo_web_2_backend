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

export interface ModelPermissionInfo {
  model_id: string;
  model_name: string;
  access_level: ModelAccessLevel;
  user_permissions: Array<{
    id: string;
    username: string;
  }>;
  group_permissions: Array<{
    id: string;
    name: string;
  }>;
}

export interface UpdateModelPermissionsRequest {
  access_level?: ModelAccessLevel;
  userIds?: string[];
  groupIds?: string[];
}
