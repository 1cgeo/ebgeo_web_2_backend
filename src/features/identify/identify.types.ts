export interface Feature {
  id: string;
  nome?: string;
  municipio?: string;
  estado?: string;
  tipo?: string;
  altitude_base: number;
  altitude_topo: number;
  model_id: string;
  model_name?: string;
  model_description?: string;
  geom: any;
  z_distance: number;
  xy_distance: number;
}
