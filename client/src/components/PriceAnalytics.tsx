import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, Minus, BarChart3, Activity, Info } from 'lucide-react';
import { api } from '../api/client';

interface PriceHistory {
  date: string;
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  count: number;
}

interface PriceAnalyticsData {
  currentAvgPrice: number;
  previousAvgPrice: number;
  priceChange: number;
  priceChangePercent: number;
  history: PriceHistory[];
  marketTrend: 'up' | 'down' | 'stable';
  recommendation: string;
  estimatedValue: {
    low: number;
    high: number;
    fair: number;
  };
}

interface PriceAnalyticsProps {
  giftRarity: string;
  giftCollection?: string;
  currentPrice: number;
}

export function PriceAnalytics({ giftRarity, giftCollection, currentPrice }: PriceAnalyticsProps) {
  const { data: analytics, isLoading } = useQuery<PriceAnalyticsData>({
    queryKey: ['priceAnalytics', giftRarity, giftCollection],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('rarity', giftRarity);
      if (giftCollection) params.append('collection', giftCollection);
      
      const response = await api.get(`/analytics/price?${params.toString()}`);
      return response.data;
    },
    staleTime: 60000, // Cache for 1 minute
  });

  // Calculate if current price is good deal
  const priceAssessment = useMemo(() => {
    if (!analytics) return null;
    
    const { estimatedValue } = analytics;
    if (currentPrice < estimatedValue.low) {
      return { label: 'Отличная цена!', color: 'text-green-400', bg: 'bg-green-500/10' };
    }
    if (currentPrice <= estimatedValue.fair) {
      return { label: 'Хорошая цена', color: 'text-blue-400', bg: 'bg-blue-500/10' };
    }
    if (currentPrice <= estimatedValue.high) {
      return { label: 'Выше среднего', color: 'text-yellow-400', bg: 'bg-yellow-500/10' };
    }
    return { label: 'Высокая цена', color: 'text-red-400', bg: 'bg-red-500/10' };
  }, [analytics, currentPrice]);

  if (isLoading) {
    return (
      <div className="glass-card p-4 animate-pulse">
        <div className="h-5 bg-white/10 rounded w-1/3 mb-4" />
        <div className="h-24 bg-white/10 rounded mb-3" />
        <div className="h-16 bg-white/10 rounded" />
      </div>
    );
  }

  if (!analytics) {
    return null;
  }

  const TrendIcon = analytics.marketTrend === 'up' ? TrendingUp :
                    analytics.marketTrend === 'down' ? TrendingDown : Minus;
  const trendColor = analytics.marketTrend === 'up' ? 'text-green-400' :
                     analytics.marketTrend === 'down' ? 'text-red-400' : 'text-gray-400';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="glass-card p-4 space-y-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-white flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-blue-400" />
          Аналитика цен
        </h3>
        <div className="flex items-center gap-1 text-sm">
          <TrendIcon className={`w-4 h-4 ${trendColor}`} />
          <span className={trendColor}>
            {analytics.priceChangePercent > 0 ? '+' : ''}{analytics.priceChangePercent.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Price Assessment */}
      {priceAssessment && (
        <div className={`p-3 rounded-xl ${priceAssessment.bg}`}>
          <div className="flex items-center justify-between">
            <span className={`font-medium ${priceAssessment.color}`}>
              {priceAssessment.label}
            </span>
            <span className="text-gray-400 text-sm">
              Текущая: {currentPrice} ⭐
            </span>
          </div>
        </div>
      )}

      {/* Mini Chart */}
      {analytics.history.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <Activity className="w-3 h-3" />
            История цен (7 дней)
          </div>
          <div className="flex items-end justify-between h-16 gap-1">
            {analytics.history.slice(-7).map((point, i) => {
              const maxPrice = Math.max(...analytics.history.map(p => p.avgPrice));
              const height = maxPrice > 0 ? (point.avgPrice / maxPrice) * 100 : 0;
              
              return (
                <motion.div
                  key={i}
                  initial={{ height: 0 }}
                  animate={{ height: `${height}%` }}
                  transition={{ delay: 0.2 + i * 0.05, duration: 0.3 }}
                  className="flex-1 bg-gradient-to-t from-blue-500/50 to-blue-400 rounded-t"
                  title={`${point.avgPrice} ⭐`}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Estimated Value Range */}
      <div className="space-y-2">
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <Info className="w-3 h-3" />
          Оценочная стоимость
        </div>
        <div className="relative h-2 bg-white/5 rounded-full overflow-hidden">
          {/* Range bar */}
          <div 
            className="absolute h-full bg-gradient-to-r from-green-500 via-blue-500 to-red-500 rounded-full"
            style={{
              left: `${(analytics.estimatedValue.low / analytics.estimatedValue.high) * 100 * 0.2}%`,
              right: '0%'
            }}
          />
          {/* Current price indicator */}
          <div 
            className="absolute w-2 h-4 -top-1 bg-white rounded shadow-lg"
            style={{
              left: `${Math.min(100, (currentPrice / analytics.estimatedValue.high) * 100)}%`,
              transform: 'translateX(-50%)'
            }}
          />
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-green-400">{analytics.estimatedValue.low} ⭐</span>
          <span className="text-blue-400">~{analytics.estimatedValue.fair} ⭐</span>
          <span className="text-red-400">{analytics.estimatedValue.high} ⭐</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-2">
        <div className="text-center p-2 bg-white/5 rounded-lg">
          <div className="text-lg font-bold text-white">
            {analytics.currentAvgPrice.toLocaleString()}
          </div>
          <div className="text-xs text-gray-500">Сред. цена</div>
        </div>
        <div className="text-center p-2 bg-white/5 rounded-lg">
          <div className="text-lg font-bold text-white">
            {Math.round(analytics.previousAvgPrice).toLocaleString()}
          </div>
          <div className="text-xs text-gray-500">Прошлая</div>
        </div>
        <div className="text-center p-2 bg-white/5 rounded-lg">
          <div className={`text-lg font-bold ${trendColor}`}>
            {analytics.priceChange > 0 ? '+' : ''}{analytics.priceChange}
          </div>
          <div className="text-xs text-gray-500">Изменение</div>
        </div>
      </div>

      {/* Recommendation */}
      {analytics.recommendation && (
        <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl">
          <p className="text-sm text-purple-300">
            💡 {analytics.recommendation}
          </p>
        </div>
      )}
    </motion.div>
  );
}

export default PriceAnalytics;
