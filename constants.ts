import { Lang, Translation } from './types';

export const BASE_DATE_TIMESTAMP = new Date('2025-02-05T12:00:00').getTime();
export const BASE_INDEX_VALUE = 1000; // Starting value of ETF on Base Date

export const TRANSLATIONS: Record<Lang, Translation> = {
  [Lang.EN]: {
    title: "Crypto50 ETF Index",
    subtitle: "Top 50 Volume Weighted Index",
    price: "Index Price",
    change: "24h Change",
    high: "24h High",
    low: "24h Low",
    volume: "24h Vol (USDT)",
    composition: "Index Constituents (Top 50)",
    symbol: "Symbol",
    weight: "Weight",
    lastPrice: "Price",
    connectStatus: "System Status",
    rebalanceInfo: "Daily Rebalance: 00:00 UTC+8",
    chart: "Real-time Chart"
  },
  [Lang.TW]: {
    title: "加密貨幣50大 ETF 指數",
    subtitle: "幣安交易量前50大加權指數",
    price: "指數價格",
    change: "24h 漲跌",
    high: "24h 最高",
    low: "24h 最低",
    volume: "24h 成交量 (USDT)",
    composition: "成分股權重 (前50大)",
    symbol: "幣種",
    weight: "權重",
    lastPrice: "最新價",
    connectStatus: "系統狀態",
    rebalanceInfo: "每日調倉: 00:00 UTC+8",
    chart: "即時K線"
  }
};