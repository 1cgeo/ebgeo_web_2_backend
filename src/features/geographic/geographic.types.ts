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

export interface ZonePermissions {
  zoneId: string;
  zoneName: string;
  userPermissions: Array<{
    id: string;
    username: string;
  }>;
  groupPermissions: Array<{
    id: string;
    name: string;
  }>;
}

export interface UpdateZonePermissionsRequest {
  userIds?: string[];
  groupIds?: string[];
}

export interface AddZonePermissionRequest {
  userId?: string;
  groupId?: string;
}
