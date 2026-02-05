export interface TickerData {
  symbol: string;
  priceChangePercent: string;
  lastPrice: string;
  quoteVolume: string; // 24h Volume in USDT
}

export interface Coin {
  symbol: string; // e.g., BTC
  pair: string;   // e.g., BTCUSDT
  price: number;
  change24h: number;
  volume24h: number;
  weight: number; // Calculated weight in the ETF
}

export interface EtfState {
  currentPrice: number;
  openPrice: number;
  highPrice: number;
  lowPrice: number;
  change24h: number;
  changePercent: number;
  lastUpdate: number;
}

export interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export enum Lang {
  EN = 'EN',
  TW = 'TW'
}

export interface Translation {
  title: string;
  subtitle: string;
  price: string;
  change: string;
  high: string;
  low: string;
  volume: string;
  composition: string;
  symbol: string;
  weight: string;
  lastPrice: string;
  connectStatus: string;
  rebalanceInfo: string;
  chart: string;
}