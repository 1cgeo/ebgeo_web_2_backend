export interface ErrorDetails {
  field?: string;
  value?: unknown;
  reason?: string;
  [key: string]: unknown;
}
