export interface GeographicName {
  id: string;
  nome: string;
  municipio?: string;
  estado?: string;
  tipo?: string;
  geom: any;
  longitude?: number;
  latitude?: number;
  name_similarity?: number;
  distance_to_center?: number;
  relevance_score?: number;
  access_level: 'public' | 'private';
}

export interface GeographicZone {
  id: string;
  name: string;
  description?: string;
  geom: any;
  created_at: Date;
  created_by: string;
}

export interface ZoneWithStats extends GeographicZone {
  user_count: number;
  group_count: number;
  area_km2: number;
}

export interface ZonePermissions {
  zone_id: string;
  zone_name: string;
  user_permissions: Array<{
    id: string;
    username: string;
  }>;
  group_permissions: Array<{
    id: string;
    name: string;
  }>;
}

export interface CreateZoneRequest {
  name: string;
  description?: string;
  geom: any; // GeoJSON geometry
  userIds?: string[];
  groupIds?: string[];
}

export interface UpdateZonePermissionsRequest {
  userIds?: string[];
  groupIds?: string[];
}

export interface ZoneQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  sort?: 'name' | 'created_at' | 'area' | 'user_count' | 'group_count';
  order?: 'asc' | 'desc';
}
