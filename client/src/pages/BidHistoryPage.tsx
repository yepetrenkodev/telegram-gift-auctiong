import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { History, Star, Calendar, TrendingUp, TrendingDown, Clock, ChevronRight, Filter, Zap } from 'lucide-react';
import { api } from '../api/client';
import { useTelegram } from '../hooks';

interface BidHistoryItem {
  id: string;
  auctionId: string;
  auctionTitle: string;
  giftName: string;
  giftRarity: 'common' | 'rare' | 'epic' | 'legendary';
  giftImageUrl?: string;
  amount: number;
  status: 'active' | 'outbid' | 'won' | 'refunded';
  isAutoBid: boolean;
  placedAt: string;
  finalPrice?: number;
}

interface BidStats {
  totalBids: number;
  totalAmount: number;
  wins: number;
  winRate: number;
  avgBid: number;
  autoBidCount: number;
}

const rarityColors = {
  common: 'from-gray-400 to-gray-500',
  rare: 'from-blue-400 to-blue-600',
  epic: 'from-purple-400 to-purple-600',
  legendary: 'from-yellow-400 to-orange-500',
};

const statusConfig = {
  active: { label: 'Активна', color: 'text-green-400', icon: TrendingUp },
  outbid: { label: 'Перебита', color: 'text-orange-400', icon: TrendingDown },
  won: { label: 'Победа', color: 'text-yellow-400', icon: Star },
  refunded: { label: 'Возврат', color: 'text-gray-400', icon: Clock },
};

export function BidHistoryPage() {
  const navigate = useNavigate();
  const { haptic } = useTelegram();
  const [filter, setFilter] = useState<'all' | 'active' | 'outbid' | 'won' | 'refunded'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'amount'>('date');

  // Fetch bid history
  const { data, isLoading, error } = useQuery<{ bids: BidHistoryItem[]; stats: BidStats }>({
    queryKey: ['bidHistory'],
    queryFn: async () => {
      const response = await api.get('/user/bids/history');
      return response.data;
    },
  });

  const bids = data?.bids || [];
  const stats = data?.stats;

  const filteredBids = filter === 'all' 
    ? bids 
    : bids.filter(b => b.status === filter);

  const sortedBids = [...filteredBids].sort((a, b) => {
    if (sortBy === 'date') {
      return new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime();
    }
    return b.amount - a.amount;
  });

  const handleBidClick = (bid: BidHistoryItem) => {
    haptic?.('selection');
    navigate(`/auction/${bid.auctionId}`);
  };

  if (isLoading) {
    return <BidHistoryPageSkeleton />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="text-6xl mb-4">😔</div>
        <h2 className="text-xl font-bold text-white mb-2">Ошибка загрузки</h2>
        <p className="text-gray-400">Не удалось загрузить историю ставок</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <History className="w-7 h-7 text-blue-400" />
          История ставок
        </h1>
        <p className="text-gray-400 mt-1">Все ваши ставки на аукционах</p>
      </motion.div>

      {/* Stats */}
      {stats && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 gap-3"
        >
          <div className="glass-card p-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-400 text-sm">Всего ставок</span>
              <span className="text-2xl font-bold text-white">{stats.totalBids}</span>
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-gray-400 text-sm">Авто-ставок</span>
              <span className="text-blue-400 font-medium flex items-center gap-1">
                <Zap className="w-3 h-3" />
                {stats.autoBidCount}
              </span>
            </div>
          </div>
          <div className="glass-card p-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-400 text-sm">Win Rate</span>
              <span className="text-2xl font-bold text-green-400">{stats.winRate.toFixed(1)}%</span>
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-gray-400 text-sm">Побед</span>
              <span className="text-yellow-400 font-medium">{stats.wins}</span>
            </div>
          </div>
          <div className="glass-card p-4 col-span-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-gray-400 text-sm block">Общая сумма ставок</span>
                <span className="text-xl font-bold text-yellow-400">
                  {stats.totalAmount.toLocaleString()} ⭐
                </span>
              </div>
              <div className="text-right">
                <span className="text-gray-400 text-sm block">Средняя ставка</span>
                <span className="text-lg font-bold text-white">
                  {stats.avgBid.toLocaleString()} ⭐
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Filters & Sort */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="space-y-3"
      >
        {/* Status filters */}
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
          {(['all', 'active', 'won', 'outbid', 'refunded'] as const).map((f) => (
            <button
              key={f}
              onClick={() => {
                setFilter(f);
                haptic?.('selection');
              }}
              className={`
                px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all
                ${filter === f
                  ? 'bg-blue-500 text-white'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10'
                }
              `}
            >
              {f === 'all' ? 'Все' : statusConfig[f].label}
            </button>
          ))}
        </div>

        {/* Sort */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <span className="text-sm text-gray-400">Сортировка:</span>
          <button
            onClick={() => {
              setSortBy(sortBy === 'date' ? 'amount' : 'date');
              haptic?.('selection');
            }}
            className="text-sm text-blue-400 hover:text-blue-300"
          >
            {sortBy === 'date' ? 'по дате' : 'по сумме'}
          </button>
        </div>
      </motion.div>

      {/* Bids List */}
      {sortedBids.length > 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="space-y-3"
        >
          <AnimatePresence mode="popLayout">
            {sortedBids.map((bid, index) => {
              const StatusIcon = statusConfig[bid.status].icon;
              return (
                <motion.div
                  key={bid.id}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: index * 0.03 }}
                  onClick={() => handleBidClick(bid)}
                  className="glass-card p-3 cursor-pointer hover:bg-white/10 transition-all"
                >
                  <div className="flex items-center gap-3">
                    {/* Gift Image */}
                    <div className={`
                      w-12 h-12 rounded-lg overflow-hidden flex-shrink-0
                      bg-gradient-to-br ${rarityColors[bid.giftRarity]}
                      flex items-center justify-center
                    `}>
                      {bid.giftImageUrl ? (
                        <img 
                          src={bid.giftImageUrl} 
                          alt={bid.giftName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-2xl">🎁</span>
                      )}
                    </div>

                    {/* Bid Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-white truncate text-sm">
                          {bid.giftName}
                        </h3>
                        {bid.isAutoBid && (
                          <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded flex items-center gap-0.5">
                            <Zap className="w-3 h-3" />
                            Auto
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-xs ${statusConfig[bid.status].color} flex items-center gap-1`}>
                          <StatusIcon className="w-3 h-3" />
                          {statusConfig[bid.status].label}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(bid.placedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    {/* Amount */}
                    <div className="text-right flex-shrink-0">
                      <div className="text-yellow-400 font-bold">
                        {bid.amount.toLocaleString()} ⭐
                      </div>
                      {bid.status === 'won' && bid.finalPrice && (
                        <div className="text-xs text-gray-500">
                          Финал: {bid.finalPrice.toLocaleString()}
                        </div>
                      )}
                    </div>

                    <ChevronRight className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card p-8 text-center"
        >
          <History className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-white mb-2">
            {filter === 'all' ? 'Нет истории ставок' : 'Нет ставок с таким статусом'}
          </h3>
          <p className="text-gray-400 mb-4">
            {filter === 'all' 
              ? 'Сделайте свою первую ставку на аукционе!'
              : 'Попробуйте выбрать другой фильтр'
            }
          </p>
          {filter === 'all' && (
            <button
              onClick={() => navigate('/auctions')}
              className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium transition-colors"
            >
              Перейти к аукционам
            </button>
          )}
        </motion.div>
      )}

      {/* Bid Activity Chart Placeholder */}
      {stats && stats.totalBids > 5 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass-card p-4"
        >
          <h3 className="text-sm font-medium text-gray-400 mb-3">Активность ставок (последние 7 дней)</h3>
          <div className="flex items-end justify-between h-20 gap-1">
            {/* Simple bar chart visualization */}
            {[65, 40, 80, 30, 95, 55, 70].map((height, i) => (
              <motion.div
                key={i}
                initial={{ height: 0 }}
                animate={{ height: `${height}%` }}
                transition={{ delay: 0.5 + i * 0.1, duration: 0.3 }}
                className="flex-1 bg-gradient-to-t from-blue-500/50 to-blue-400 rounded-t"
              />
            ))}
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-500">
            <span>Пн</span>
            <span>Вт</span>
            <span>Ср</span>
            <span>Чт</span>
            <span>Пт</span>
            <span>Сб</span>
            <span>Вс</span>
          </div>
        </motion.div>
      )}
    </div>
  );
}

function BidHistoryPageSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 bg-white/10 rounded w-1/2" />
      
      <div className="grid grid-cols-2 gap-3">
        {[1, 2].map((i) => (
          <div key={i} className="h-20 bg-white/5 rounded-xl" />
        ))}
        <div className="h-20 bg-white/5 rounded-xl col-span-2" />
      </div>
      
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-8 w-16 bg-white/5 rounded-full" />
        ))}
      </div>
      
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-16 bg-white/5 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export default BidHistoryPage;

