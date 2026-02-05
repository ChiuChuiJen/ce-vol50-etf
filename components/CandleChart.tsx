import React, { useMemo } from 'react';
import { 
  ComposedChart, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  Bar, 
  CartesianGrid,
  ReferenceLine
} from 'recharts';
import { CandleData } from '../types';

interface CandleChartProps {
  data: CandleData[];
  width?: number | string;
  height?: number | string;
}

const CandleStickShape = (props: any) => {
  const { x, y, width, height, payload } = props;
  const { open, close, high, low } = payload;

  const isUp = close >= open;
  const color = isUp ? '#0ECB81' : '#F6465D'; // Binance Green/Red

  // The Bar component with dataKey={[low, high]} calculates the overall height 
  // corresponding to the High-Low range.
  // y: The y-coordinate of the top of the bar (High value).
  // height: The height of the bar (High - Low in pixels).

  // Prevent division by zero if high === low
  const range = high - low;
  const ratio = range === 0 ? 0 : height / range;

  // Calculate y-coordinates for open and close
  // Since Y increases downwards in SVG:
  // Pixel_Value = Pixel_High + (Value_High - Value) * ratio
  // Pixel_High is 'y'
  const yOpen = y + (high - open) * ratio;
  const yClose = y + (high - close) * ratio;

  const bodyTop = Math.min(yOpen, yClose);
  const bodyHeight = Math.max(1, Math.abs(yOpen - yClose)); // Minimum 1px body

  // Draw wicks from High(y) to Low(y+height)
  // Center the candle body within the available slot width
  // Limit max width for that professional "thin" look even if data is sparse
  const candleWidth = Math.min(width - 2, 12); 
  const xBody = x + (width - candleWidth) / 2;
  const cx = x + width / 2;

  return (
    <g stroke={color} fill={color} strokeWidth={1}>
      {/* Wick */}
      <line x1={cx} y1={y} x2={cx} y2={y + height} />
      {/* Body */}
      <rect x={xBody} y={bodyTop} width={candleWidth} height={bodyHeight} fill={color} stroke="none" />
    </g>
  );
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-binance-black border border-binance-gray p-2 rounded shadow-lg text-xs font-mono z-50">
        <p className="text-binance-text">{new Date(data.time).toLocaleTimeString()}</p>
        <p className="text-binance-text">O: <span className={data.open < data.close ? "text-binance-green" : "text-binance-red"}>{data.open.toFixed(2)}</span></p>
        <p className="text-binance-text">H: <span className={data.open < data.close ? "text-binance-green" : "text-binance-red"}>{data.high.toFixed(2)}</span></p>
        <p className="text-binance-text">L: <span className={data.open < data.close ? "text-binance-green" : "text-binance-red"}>{data.low.toFixed(2)}</span></p>
        <p className="text-binance-text">C: <span className={data.open < data.close ? "text-binance-green" : "text-binance-red"}>{data.close.toFixed(2)}</span></p>
      </div>
    );
  }
  return null;
};

const CandleChart: React.FC<CandleChartProps> = ({ data, width = "100%", height = 400 }) => {
  // Pre-process data to include the full range [low, high] for the Bar component
  const chartData = useMemo(() => {
    return data.map(d => ({
      ...d,
      candleRange: [d.low, d.high]
    }));
  }, [data]);

  const yDomain = useMemo(() => {
    if (data.length === 0) return ['auto', 'auto'];
    const min = Math.min(...data.map(d => d.low));
    const max = Math.max(...data.map(d => d.high));
    // Add padding to domain so candles aren't cut off
    const padding = (max - min) * 0.1; 
    // Handle flat line case
    if (padding === 0) return [min * 0.99, max * 1.01];
    return [min - padding, max + padding];
  }, [data]);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-binance-text text-sm">
        Waiting for market data...
      </div>
    );
  }

  return (
    <ResponsiveContainer width={width as any} height={height as any}>
      <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#2B3139" strokeDasharray="3 3" vertical={false} />
        <XAxis 
          dataKey="time" 
          tickFormatter={(time) => new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          stroke="#848E9C"
          fontSize={11}
          tickMargin={10}
          axisLine={false}
          tickLine={false}
          minTickGap={30}
        />
        <YAxis 
          domain={yDomain} 
          orientation="right" 
          stroke="#848E9C"
          fontSize={11}
          tickFormatter={(val) => val.toFixed(2)}
          axisLine={false}
          tickLine={false}
          width={60}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#848E9C', strokeDasharray: '3 3' }} />
        
        {/* maxBarSize ensures even if we only have 1 data point, it doesn't fill the whole screen */}
        <Bar 
          dataKey="candleRange" 
          shape={<CandleStickShape />} 
          isAnimationActive={false} 
          maxBarSize={15} 
        />
        
        {/* Current Price Line */}
        {data.length > 0 && (
          <ReferenceLine 
            y={data[data.length - 1].close} 
            stroke="#FCD535" 
            strokeDasharray="3 3" 
            label={{ 
              position: 'right', 
              fill: '#FCD535', 
              fontSize: 10, 
              value: data[data.length - 1].close.toFixed(2),
              dy: -10 
            }} 
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
};

export default CandleChart;