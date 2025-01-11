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
}
