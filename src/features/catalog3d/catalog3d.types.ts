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
  municipio?: string;
  estado?: string;
  palavras_chave?: string[];
  style?: Record<string, any>;
}

export interface SearchResult {
  total: number;
  page: number;
  nr_records: number;
  data: Catalog3D[];
}
