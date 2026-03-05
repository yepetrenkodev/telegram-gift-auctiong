import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { Gift, Star, Calendar, ExternalLink, ChevronRight, Package, Trophy, Sparkles } from 'lucide-react';
import { api } from '../api/client';
import { useTelegram } from '../hooks';

interface WonGift {
  id: string;
  auctionId: string;
  gift: {
    name: string;
    description?: string;
    imageUrl?: string;
    rarity: 'common' | 'rare' | 'epic' | 'legendary';
  };
  winningBid: number;
  wonAt: string;
  status: 'pending' | 'claimed' | 'transferred';
  transferDetails?: {
    recipientUsername?: string;
    transferredAt?: string;
  };
}

const rarityColors = {
  common: { bg: 'from-gray-400 to-gray-500', text: 'text-gray-400', border: 'border-gray-500/30' },
  rare: { bg: 'from-blue-400 to-blue-600', text: 'text-blue-400', border: 'border-blue-500/30' },
  epic: { bg: 'from-purple-400 to-purple-600', text: 'text-purple-400', border: 'border-purple-500/30' },
  legendary: { bg: 'from-yellow-400 to-orange-500', text: 'text-yellow-400', border: 'border-yellow-500/30' },
};

const statusConfig = {
  pending: { label: 'Ожидает', color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  claimed: { label: 'Получен', color: 'text-green-400', bg: 'bg-green-500/10' },
  transferred: { label: 'Передан', color: 'text-blue-400', bg: 'bg-blue-500/10' },
};

export function MyGiftsPage() {
  const navigate = useNavigate();
  const { haptic } = useTelegram();
  const [filter, setFilter] = useState<'all' | 'pending' | 'claimed' | 'transferred'>('all');

  // Fetch user's won gifts
  const { data, isLoading, error } = useQuery<{ gifts: WonGift[]; stats: { total: number; totalSpent: number; byRarity: Record<string, number> } }>({
    queryKey: ['myGifts'],
    queryFn: async () => {
      const response = await api.get('/user/gifts');
      return response.data;
    },
  });

  const gifts = data?.gifts || [];
  const stats = data?.stats;

  const filteredGifts = filter === 'all' 
    ? gifts 
    : gifts.filter(g => g.status === filter);

  const handleGiftClick = (gift: WonGift) => {
    haptic?.('selection');
    navigate(`/auction/${gift.auctionId}`);
  };

  if (isLoading) {
    return <MyGiftsPageSkeleton />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="text-6xl mb-4">😔</div>
        <h2 className="text-xl font-bold text-white mb-2">Ошибка загрузки</h2>
        <p className="text-gray-400">Не удалось загрузить ваши подарки</p>
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
          <Gift className="w-7 h-7 text-purple-400" />
          Мои подарки
        </h1>
        <p className="text-gray-400 mt-1">Подарки, выигранные на аукционах</p>
      </motion.div>

      {/* Stats */}
      {stats && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-3 gap-3"
        >
          <div className="glass-card p-4 text-center">
            <Trophy className="w-6 h-6 text-yellow-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-white">{stats.total}</div>
            <div className="text-xs text-gray-500">Всего побед</div>
          </div>
          <div className="glass-card p-4 text-center">
            <Star className="w-6 h-6 text-yellow-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-white">{stats.totalSpent.toLocaleString()}</div>
            <div className="text-xs text-gray-500">Потрачено ⭐</div>
          </div>
          <div className="glass-card p-4 text-center">
            <Sparkles className="w-6 h-6 text-purple-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-white">{stats.byRarity?.legendary || 0}</div>
            <div className="text-xs text-gray-500">Легендарных</div>
          </div>
        </motion.div>
      )}

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide"
      >
        {(['all', 'pending', 'claimed', 'transferred'] as const).map((f) => (
          <button
            key={f}
            onClick={() => {
              setFilter(f);
              haptic?.('selection');
            }}
            className={`
              px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all
              ${filter === f
                ? 'bg-purple-500 text-white'
                : 'bg-white/5 text-gray-400 hover:bg-white/10'
              }
            `}
          >
            {f === 'all' ? 'Все' : statusConfig[f].label}
            {f !== 'all' && (
              <span className="ml-1 opacity-60">
                ({gifts.filter(g => g.status === f).length})
              </span>
            )}
          </button>
        ))}
      </motion.div>

      {/* Gifts Grid */}
      {filteredGifts.length > 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="grid gap-4"
        >
          <AnimatePresence mode="popLayout">
            {filteredGifts.map((gift, index) => (
              <motion.div
                key={gift.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => handleGiftClick(gift)}
                className={`
                  glass-card p-4 cursor-pointer hover:bg-white/10 transition-all
                  border ${rarityColors[gift.gift.rarity].border}
                `}
              >
                <div className="flex items-center gap-4">
                  {/* Gift Image */}
                  <div className={`
                    w-16 h-16 rounded-xl overflow-hidden flex-shrink-0
                    bg-gradient-to-br ${rarityColors[gift.gift.rarity].bg}
                    flex items-center justify-center
                  `}>
                    {gift.gift.imageUrl ? (
                      <img 
                        src={gift.gift.imageUrl} 
                        alt={gift.gift.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-3xl">🎁</span>
                    )}
                  </div>

                  {/* Gift Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-white truncate">{gift.gift.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`
                        px-2 py-0.5 rounded text-xs font-medium uppercase
                        ${rarityColors[gift.gift.rarity].text} bg-white/5
                      `}>
                        {gift.gift.rarity}
                      </span>
                      <span className={`
                        px-2 py-0.5 rounded text-xs font-medium
                        ${statusConfig[gift.status].color} ${statusConfig[gift.status].bg}
                      `}>
                        {statusConfig[gift.status].label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-sm">
                      <span className="text-yellow-400 font-medium">
                        {gift.winningBid.toLocaleString()} ⭐
                      </span>
                      <span className="text-gray-500 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(gift.wonAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {/* Arrow */}
                  <ChevronRight className="w-5 h-5 text-gray-500 flex-shrink-0" />
                </div>

                {/* Transfer info */}
                {gift.status === 'transferred' && gift.transferDetails && (
                  <div className="mt-3 pt-3 border-t border-white/10 text-sm text-gray-400">
                    <span className="flex items-center gap-1">
                      <ExternalLink className="w-3 h-3" />
                      Передан @{gift.transferDetails.recipientUsername}
                    </span>
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card p-8 text-center"
        >
          <Package className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-white mb-2">
            {filter === 'all' ? 'Пока нет выигранных подарков' : 'Нет подарков с таким статусом'}
          </h3>
          <p className="text-gray-400 mb-4">
            {filter === 'all' 
              ? 'Участвуйте в аукционах, чтобы выиграть эксклюзивные подарки!'
              : 'Попробуйте выбрать другой фильтр'
            }
          </p>
          {filter === 'all' && (
            <button
              onClick={() => navigate('/auctions')}
              className="px-6 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-xl font-medium transition-colors"
            >
              Перейти к аукционам
            </button>
          )}
        </motion.div>
      )}

      {/* Rarity Distribution */}
      {stats && stats.total > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass-card p-4"
        >
          <h3 className="text-sm font-medium text-gray-400 mb-3">Распределение по редкости</h3>
          <div className="space-y-2">
            {(['legendary', 'epic', 'rare', 'common'] as const).map((rarity) => {
              const count = stats.byRarity?.[rarity] || 0;
              const percentage = stats.total > 0 ? (count / stats.total) * 100 : 0;
              return (
                <div key={rarity} className="flex items-center gap-3">
                  <span className={`text-xs font-medium w-20 ${rarityColors[rarity].text}`}>
                    {rarity.charAt(0).toUpperCase() + rarity.slice(1)}
                  </span>
                  <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${percentage}%` }}
                      transition={{ delay: 0.5, duration: 0.5 }}
                      className={`h-full bg-gradient-to-r ${rarityColors[rarity].bg}`}
                    />
                  </div>
                  <span className="text-xs text-gray-500 w-8 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}
    </div>
  );
}

function MyGiftsPageSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 bg-white/10 rounded w-1/2" />
      
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-white/5 rounded-xl" />
        ))}
      </div>
      
      <div className="flex gap-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-8 w-20 bg-white/5 rounded-full" />
        ))}
      </div>
      
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-white/5 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export default MyGiftsPage;

