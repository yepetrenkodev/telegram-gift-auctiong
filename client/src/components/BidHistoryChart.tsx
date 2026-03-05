import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import { TrendingUp, Activity } from 'lucide-react';

interface ChartBid {
  id: string;
  amount: number;
  bidderName: string;
  createdAt: string | Date;
  isAutoBid?: boolean;
}

interface BidHistoryChartProps {
  bids: ChartBid[];
  startingPrice: number;
  currentPrice: number;
  className?: string;
}

export function BidHistoryChart({ bids, startingPrice, currentPrice, className = '' }: BidHistoryChartProps) {
  const chartData = useMemo(() => {
    if (!bids || bids.length === 0) {
      return [
        { time: 'Начало', amount: startingPrice, bidder: 'Стартовая цена' },
        { time: 'Сейчас', amount: currentPrice, bidder: 'Текущая цена' }
      ];
    }

    // Sort bids by time (oldest first)
    const sortedBids = [...bids].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    // Create chart data points
    const data: Array<{ time: string; amount: number; bidder: string; index: number; isAutoBid?: boolean }> = [
      { time: 'Начало', amount: startingPrice, bidder: 'Стартовая цена', index: 0 }
    ];

    sortedBids.forEach((bid, index) => {
      const time = new Date(bid.createdAt);
      data.push({
        time: time.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
        amount: bid.amount,
        bidder: bid.bidderName,
        index: index + 1,
        isAutoBid: bid.isAutoBid
      });
    });

    return data;
  }, [bids, startingPrice, currentPrice]);

  const priceIncrease = currentPrice - startingPrice;
  const priceIncreasePercent = startingPrice > 0 
    ? ((priceIncrease / startingPrice) * 100).toFixed(1)
    : 0;

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-gray-800/95 backdrop-blur-sm border border-gray-700 rounded-lg p-3 shadow-xl">
          <p className="text-white font-bold text-lg">{data.amount} ⭐</p>
          <p className="text-gray-400 text-sm">{data.bidder}</p>
          {data.isAutoBid && (
            <p className="text-blue-400 text-xs mt-1">🤖 Auto-Bid</p>
          )}
          <p className="text-gray-500 text-xs mt-1">{data.time}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className={`bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm rounded-2xl p-4 border border-gray-700/50 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-purple-400" />
          <span className="text-white font-semibold">История ставок</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <TrendingUp className="w-4 h-4 text-green-400" />
          <span className="text-green-400">+{priceIncrease} ⭐</span>
          <span className="text-gray-500">({priceIncreasePercent}%)</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-gray-800/50 rounded-xl p-2 text-center">
          <p className="text-gray-400 text-xs">Ставок</p>
          <p className="text-white font-bold">{bids.length}</p>
        </div>
        <div className="bg-gray-800/50 rounded-xl p-2 text-center">
          <p className="text-gray-400 text-xs">Старт</p>
          <p className="text-white font-bold">{startingPrice} ⭐</p>
        </div>
        <div className="bg-gray-800/50 rounded-xl p-2 text-center">
          <p className="text-gray-400 text-xs">Текущая</p>
          <p className="text-green-400 font-bold">{currentPrice} ⭐</p>
        </div>
      </div>

      {/* Chart */}
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
            <defs>
              <linearGradient id="bidGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis 
              dataKey="time" 
              stroke="#6b7280" 
              fontSize={10}
              tickLine={false}
              axisLine={false}
            />
            <YAxis 
              stroke="#6b7280" 
              fontSize={10}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `${value}`}
              domain={['dataMin - 5', 'dataMax + 5']}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine 
              y={startingPrice} 
              stroke="#6b7280" 
              strokeDasharray="3 3"
              label={{ value: 'Старт', fill: '#6b7280', fontSize: 10 }}
            />
            <Area
              type="monotone"
              dataKey="amount"
              stroke="#8b5cf6"
              strokeWidth={2}
              fill="url(#bidGradient)"
              dot={{ r: 3, fill: '#8b5cf6', strokeWidth: 2 }}
              activeDot={{ r: 5, fill: '#a78bfa', stroke: '#fff', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Recent bids list */}
      {bids.length > 0 && (
        <div className="mt-4 space-y-2 max-h-32 overflow-y-auto">
          <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">Последние ставки</p>
          {bids.slice(0, 5).map((bid, index) => (
            <div 
              key={bid.id} 
              className={`flex items-center justify-between py-1.5 px-2 rounded-lg ${
                index === 0 ? 'bg-purple-500/20 border border-purple-500/30' : 'bg-gray-800/30'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`text-xs ${index === 0 ? 'text-purple-400' : 'text-gray-500'}`}>
                  #{bids.length - index}
                </span>
                <span className={`text-sm ${index === 0 ? 'text-white font-medium' : 'text-gray-400'}`}>
                  {bid.bidderName}
                </span>
                {bid.isAutoBid && <span className="text-xs">🤖</span>}
              </div>
              <span className={`font-bold ${index === 0 ? 'text-purple-400' : 'text-gray-400'}`}>
                {bid.amount} ⭐
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default BidHistoryChart;
