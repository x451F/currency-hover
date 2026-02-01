export type ConvertRequest = {
  type: 'CONVERT';
  payload: {
    amount: number;
    base: string;
    targets: string[];
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
  error?: string;
  stale?: boolean;
}

export interface RefreshResponse {
  ok: boolean;
  error?: string;
}
