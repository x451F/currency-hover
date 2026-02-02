export type ConvertRequest = {
  type: 'CONVERT';
  payload: {
    amount: number;
    base: string;
    targets: string[];
    forceRefresh?: boolean;
  };
};

export type RefreshRatesRequest = {
  type: 'REFRESH_RATES';
  payload?: {
    base?: string;
  };
};

export type BackgroundRequest = ConvertRequest | RefreshRatesRequest;

export interface ConvertResponse {
  base: string;
  conversions: Record<string, number>;
  date?: string;
  fetchedAt?: number;
  error?: string;
  stale?: boolean;
}

export interface RefreshResponse {
  ok: boolean;
  error?: string;
}
