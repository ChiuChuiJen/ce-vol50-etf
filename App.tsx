import React, { useEffect, useState, useRef, useMemo } from 'react';
import { fetchTop50Coins, connectBinanceWS } from './services/binanceService';
import CandleChart from './components/CandleChart';
import { Lang, Coin, EtfState, CandleData, TickerData } from './types';
import { TRANSLATIONS, BASE_INDEX_VALUE } from './constants';
import { Globe, ArrowUp, ArrowDown, Activity, Clock } from 'lucide-react';

// Helper to calculate ETF Price based on weighted sum of constituent changes
const calculateEtfPrice = (coins: Coin[], basePrice: number): number => {
  // Simplified Logic:
  // The ETF price moves according to the weighted average change of the top 50 coins.
  // Current Index = BasePrice * (1 + Sum(Weight_i * Change_i))
  
  if (coins.length === 0) return basePrice;
  
  let weightedChangeSum = 0;
  let totalWeight = 0;

  coins.forEach(c => {
    // Weight is 0-1 (e.g., 0.1 for 10%)
    weightedChangeSum += (c.change24h * c.weight);
    totalWeight += c.weight;
  });

  // Normalize if weights don't equal exactly 1 (they should)
  const avgChange = weightedChangeSum / (totalWeight || 1);
  
  // This calculates "Where is the index now relative to 24h ago"
  return basePrice * (1 + (avgChange / 100));
};

const App = () => {
  const [lang, setLang] = useState<Lang>(Lang.TW);
  const t = TRANSLATIONS[lang];
  
  const [coins, setCoins] = useState<Coin[]>([]);
  const [etfState, setEtfState] = useState<EtfState>({
    currentPrice: BASE_INDEX_VALUE,
    openPrice: BASE_INDEX_VALUE,
    highPrice: BASE_INDEX_VALUE,
    lowPrice: BASE_INDEX_VALUE,
    change24h: 0,
    changePercent: 0,
    lastUpdate: Date.now()
  });

  const [candleData, setCandleData] = useState<CandleData[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  
  // Refs for tracking data inside closures/intervals
  const coinsRef = useRef<Coin[]>([]);
  const etfHistoryRef = useRef<CandleData[]>([]);

  // 1. Initialize: Fetch Top 50 and Setup Structure
  useEffect(() => {
    const init = async () => {
      const top50 = await fetchTop50Coins();
      
      // Calculate Total Volume for Weighting
      const totalVol = top50.reduce((acc, curr) => acc + parseFloat(curr.quoteVolume), 0);

      const initialCoins: Coin[] = top50.map(t => ({
        symbol: t.symbol.replace('USDT', ''),
        pair: t.symbol,
        price: parseFloat(t.lastPrice),
        change24h: parseFloat(t.priceChangePercent),
        volume24h: parseFloat(t.quoteVolume),
        weight: parseFloat(t.quoteVolume) / totalVol // Weight by Volume
      }));

      setCoins(initialCoins);
      coinsRef.current = initialCoins;

      // Start Websocket
      const symbols = initialCoins.map(c => c.symbol + 'USDT'); // Ensure symbol format
      const ws = connectBinanceWS(symbols, handleWsMessage);
      
      ws.onopen = () => setIsConnected(true);
      ws.onclose = () => setIsConnected(false);

      return () => ws.close();
    };

    init();
    
    // Simulate Daily Rebalance Check (Polling every minute)
    const interval = setInterval(() => {
      const now = new Date();
      // UTC+8 00:00 is UTC 16:00
      if (now.getUTCHours() === 16 && now.getUTCMinutes() === 0) {
         init(); // Re-fetch and re-weight
      }
    }, 60000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. Handle Real-time Ticker Updates
  const handleWsMessage = (data: any) => {
    // Data format: { e: '24hrMiniTicker', s: 'BTCUSDT', c: '95000', o: '94000', ... }
    const symbol = data.s; // Pair name
    const price = parseFloat(data.c);
    
    // Binance miniTicker does NOT contain 'P' (percentage change). 
    // We must calculate it manually using 'c' (close) and 'o' (open).
    let percentChange = 0;
    
    if (data.P !== undefined) {
      // If full ticker stream is used (not current case, but safe fallback)
      percentChange = parseFloat(data.P);
    } else if (data.c && data.o) {
      const openPrice = parseFloat(data.o);
      const closePrice = parseFloat(data.c);
      if (openPrice !== 0) {
        percentChange = ((closePrice - openPrice) / openPrice) * 100;
      }
    }
    
    // Update the specific coin in the ref array
    const index = coinsRef.current.findIndex(c => c.pair === symbol);
    if (index !== -1) {
      const updatedCoins = [...coinsRef.current];
      // Check for validity before updating
      if (!isNaN(price) && !isNaN(percentChange)) {
        updatedCoins[index] = {
          ...updatedCoins[index],
          price: price,
          change24h: percentChange
        };
        coinsRef.current = updatedCoins;
      }
    }
  };

  // 3. ETF Calculation Loop (Every 1s)
  useEffect(() => {
    const calcInterval = setInterval(() => {
      const currentCoins = coinsRef.current;
      if (currentCoins.length === 0) return;

      // Calculate Synthetic Index Price
      const calculatedPrice = calculateEtfPrice(currentCoins, BASE_INDEX_VALUE);

      setEtfState(prev => {
        const newHigh = Math.max(prev.highPrice, calculatedPrice);
        const newLow = Math.min(prev.lowPrice, calculatedPrice);
        // Base is 1000. 
        const changeVal = calculatedPrice - BASE_INDEX_VALUE;
        const changePct = (changeVal / BASE_INDEX_VALUE) * 100;

        return {
          currentPrice: calculatedPrice,
          openPrice: BASE_INDEX_VALUE, // Reset daily in real app
          highPrice: newHigh,
          lowPrice: newLow,
          change24h: changeVal,
          changePercent: changePct,
          lastUpdate: Date.now()
        };
      });

      // Update Chart Data (Simulate 1-minute candles for the demo by sampling every second)
      updateCandleHistory(calculatedPrice);
      
      // Update Table UI
      setCoins([...currentCoins]);

    }, 1000);

    return () => clearInterval(calcInterval);
  }, []);

  const updateCandleHistory = (price: number) => {
    const now = Date.now();
    // Round down to nearest minute
    const timeBucket = Math.floor(now / 60000) * 60000; 

    let history = [...etfHistoryRef.current];
    const lastCandle = history[history.length - 1];

    if (lastCandle && lastCandle.time === timeBucket) {
      // Update current candle
      lastCandle.high = Math.max(lastCandle.high, price);
      lastCandle.low = Math.min(lastCandle.low, price);
      lastCandle.close = price;
      history[history.length - 1] = lastCandle;
    } else {
      // New Candle
      const newCandle: CandleData = {
        time: timeBucket,
        open: lastCandle ? lastCandle.close : price,
        high: price,
        low: price,
        close: price
      };
      history.push(newCandle);
      // Keep only last 100 candles for performance/display
      if (history.length > 100) history.shift();
    }

    etfHistoryRef.current = history;
    setCandleData(history);
  };

  // UI Components
  const isPositive = etfState.changePercent >= 0;
  const textColor = isPositive ? 'text-binance-green' : 'text-binance-red';
  const ArrowIcon = isPositive ? ArrowUp : ArrowDown;

  return (
    <div className="min-h-screen bg-binance-dark text-binance-light font-sans selection:bg-binance-yellow selection:text-black">
      {/* Header */}
      <header className="fixed top-0 w-full bg-binance-black border-b border-binance-gray/30 z-50 h-16 flex items-center justify-between px-4 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="bg-binance-yellow p-1.5 rounded-md">
            <Activity className="w-5 h-5 text-black" />
          </div>
          <h1 className="font-bold text-lg tracking-tight hidden sm:block">{t.title}</h1>
          <span className="text-xs font-mono bg-binance-gray/20 px-2 py-0.5 rounded text-binance-text">BETA</span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs text-binance-text hidden md:flex">
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-binance-green' : 'bg-red-500'} animate-pulse`}></span>
            {t.connectStatus}: {isConnected ? 'Online' : 'Reconnecting...'}
          </div>
          
          <button 
            onClick={() => setLang(l => l === Lang.EN ? Lang.TW : Lang.EN)}
            className="flex items-center gap-2 bg-binance-gray/20 hover:bg-binance-gray/40 px-3 py-1.5 rounded transition-colors text-sm font-medium"
          >
            <Globe className="w-4 h-4" />
            {lang}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-20 pb-8 px-4 max-w-7xl mx-auto space-y-6">
        
        {/* Dashboard Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* Main Price Card */}
          <div className="lg:col-span-1 bg-binance-black rounded-xl p-6 border border-binance-gray/20 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Activity className="w-24 h-24" />
            </div>
            <h2 className="text-binance-text text-sm font-medium mb-1">{t.subtitle}</h2>
            <div className={`text-4xl font-mono font-bold tracking-tighter my-2 ${textColor} transition-colors duration-300`}>
              {etfState.currentPrice.toFixed(2)}
            </div>
            <div className={`flex items-center gap-2 text-sm font-medium ${textColor}`}>
              <ArrowIcon className="w-4 h-4" />
              <span>{etfState.change24h > 0 ? '+' : ''}{etfState.change24h.toFixed(2)}</span>
              <span>({etfState.change24h > 0 ? '+' : ''}{etfState.changePercent.toFixed(2)}%)</span>
            </div>
            
            <div className="mt-6 pt-6 border-t border-binance-gray/20 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-binance-text">{t.high}</span>
                <span className="font-mono">{etfState.highPrice.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-binance-text">{t.low}</span>
                <span className="font-mono">{etfState.lowPrice.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-binance-text text-xs flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Updated
                </span>
                <span className="font-mono text-xs text-binance-text">
                  {new Date(etfState.lastUpdate).toLocaleTimeString()}
                </span>
              </div>
            </div>
          </div>

          {/* Chart Section */}
          <div className="lg:col-span-3 bg-binance-black rounded-xl border border-binance-gray/20 shadow-xl flex flex-col">
            <div className="p-4 border-b border-binance-gray/20 flex justify-between items-center">
              <h3 className="font-semibold text-binance-light flex items-center gap-2">
                {t.chart} <span className="text-xs font-normal text-binance-text">(1m interval)</span>
              </h3>
              <div className="text-xs text-binance-text">{t.rebalanceInfo}</div>
            </div>
            <div className="flex-1 p-2 min-h-[300px]">
              <CandleChart data={candleData} />
            </div>
          </div>
        </div>

        {/* Constituents Table */}
        <div className="bg-binance-black rounded-xl border border-binance-gray/20 shadow-xl overflow-hidden">
          <div className="p-4 border-b border-binance-gray/20">
            <h3 className="font-semibold text-lg">{t.composition}</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-binance-dark text-xs text-binance-text uppercase tracking-wider">
                  <th className="p-4 font-medium sticky left-0 bg-binance-dark z-10 border-r border-binance-gray/20 sm:border-none">#</th>
                  <th className="p-4 font-medium sticky left-8 sm:left-0 bg-binance-dark z-10">{t.symbol}</th>
                  <th className="p-4 font-medium text-right">{t.lastPrice}</th>
                  <th className="p-4 font-medium text-right">{t.change}</th>
                  <th className="p-4 font-medium text-right">{t.weight}</th>
                  <th className="p-4 font-medium text-right hidden md:table-cell">{t.volume}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-binance-gray/10 text-sm font-mono">
                {coins.map((coin, idx) => (
                  <tr key={coin.symbol} className="hover:bg-binance-light/5 transition-colors">
                    <td className="p-4 text-binance-text sticky left-0 bg-binance-black sm:bg-transparent z-10">{idx + 1}</td>
                    <td className="p-4 font-bold sticky left-8 sm:left-0 bg-binance-black sm:bg-transparent z-10">
                      <div className="flex items-center gap-2">
                        <img 
                          src={`https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/32/icon/${coin.symbol.toLowerCase()}.png`} 
                          alt={coin.symbol}
                          className="w-5 h-5 rounded-full bg-white/10"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} 
                        />
                        {coin.symbol}
                      </div>
                    </td>
                    <td className="p-4 text-right">${coin.price < 1 ? coin.price.toFixed(4) : coin.price.toFixed(2)}</td>
                    <td className={`p-4 text-right ${coin.change24h >= 0 ? 'text-binance-green' : 'text-binance-red'}`}>
                      {coin.change24h > 0 ? '+' : ''}{coin.change24h.toFixed(2)}%
                    </td>
                    <td className="p-4 text-right text-binance-yellow">{(coin.weight * 100).toFixed(2)}%</td>
                    <td className="p-4 text-right text-binance-text hidden md:table-cell">
                      {new Intl.NumberFormat('en-US', { notation: "compact", compactDisplay: "short" }).format(coin.volume24h)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      <footer className="py-6 text-center text-xs text-binance-text border-t border-binance-gray/20">
        <p>Crypto50 ETF &copy; 2025. Data provided by Binance Public API.</p>
        <p className="mt-1 opacity-50">Base Date: {new Date(2025, 1, 5, 12, 0).toLocaleString()}</p>
      </footer>
    </div>
  );
};

export default App;