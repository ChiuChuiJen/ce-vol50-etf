import { TickerData } from '../types';

const BASE_API = 'https://api.binance.com/api/v3';

// Fetch Top 50 pairs by Quote Volume (USDT)
export const fetchTop50Coins = async (): Promise<TickerData[]> => {
  try {
    const response = await fetch(`${BASE_API}/ticker/24hr`);
    if (!response.ok) throw new Error('Network response was not ok');
    
    const data: TickerData[] = await response.json();
    
    // Filter for USDT pairs only, exclude leveraged tokens (UP/DOWN/BULL/BEAR)
    const usdtPairs = data.filter(ticker => 
      ticker.symbol.endsWith('USDT') && 
      !ticker.symbol.includes('UP') && 
      !ticker.symbol.includes('DOWN') &&
      !ticker.symbol.includes('BULL') &&
      !ticker.symbol.includes('BEAR') &&
      !ticker.symbol.includes('USDC') && // Avoid stablecoin pairs overlap if needed
      !ticker.symbol.includes('FDUSD')
    );

    // Sort by 24h Quote Volume (volume in USDT) descending
    const sorted = usdtPairs.sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume));
    
    return sorted.slice(0, 50);
  } catch (error) {
    console.error("Failed to fetch top coins:", error);
    return [];
  }
};

// WebSocket connection helper
export const connectBinanceWS = (
  symbols: string[], 
  onMessage: (data: any) => void
): WebSocket => {
  // Binance stream limit is usually 1024 streams per connection. 50 is fine.
  // Stream name format: <symbol>@miniTicker
  const streams = symbols.map(s => `${s.toLowerCase()}@miniTicker`).join('/');
  const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${streams}`);

  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    onMessage(message);
  };

  ws.onerror = (err) => {
    console.error("WS Error:", err);
  };

  return ws;
};