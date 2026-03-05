import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { Star, Clock, Sparkles } from 'lucide-react';
import { api } from '../api/client';
import { useTelegram } from '../hooks';

interface SimilarAuction {
  id: string;
  title: string;
  gift: {
    name: string;
    imageUrl?: string;
    rarity: 'common' | 'rare' | 'epic' | 'legendary';
    giftCollection?: string;
  };
  currentPrice: number;
  endTime: string;
  totalBids: number;
}

interface SimilarAuctionsProps {
  auctionId: string;
  giftRarity?: string;
  giftCollection?: string;
  maxResults?: number;
}

const rarityColors = {
  common: 'from-gray-400 to-gray-500',
  rare: 'from-blue-400 to-blue-600',
  epic: 'from-purple-400 to-purple-600',
  legendary: 'from-yellow-400 to-orange-500',
};

export function SimilarAuctions({ 
  auctionId, 
  giftRarity, 
  giftCollection,
  maxResults = 4 
}: SimilarAuctionsProps) {
  const navigate = useNavigate();
  const { haptic } = useTelegram();

  const { data: similarAuctions, isLoading } = useQuery<SimilarAuction[]>({
    queryKey: ['similarAuctions', auctionId, giftRarity, giftCollection],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (giftRarity) params.append('rarity', giftRarity);
      if (giftCollection) params.append('collection', giftCollection);
      params.append('exclude', auctionId);
      params.append('limit', String(maxResults));
      
      const response = await api.get(`/auctions/similar?${params.toString()}`);
      return response.data.auctions || [];
    },
    enabled: !!auctionId,
    staleTime: 30000,
  });

  const handleClick = (id: string) => {
    haptic?.('selection');
    navigate(`/auction/${id}`);
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-400" />
          Похожие аукционы
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-white/5 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!similarAuctions || similarAuctions.length === 0) {
    return null;
  }

  const getTimeLeft = (endTime: string) => {
    const diff = new Date(endTime).getTime() - Date.now();
    if (diff <= 0) return 'Завершен';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) {
      return `${Math.floor(hours / 24)}д`;
    }
    if (hours > 0) {
      return `${hours}ч ${minutes}м`;
    }
    return `${minutes}м`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="space-y-3"
    >
      <h3 className="text-lg font-bold text-white flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-purple-400" />
        Похожие аукционы
      </h3>
      
      <div className="grid grid-cols-2 gap-3">
        {similarAuctions.map((auction, index) => (
          <motion.div
            key={auction.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 + index * 0.05 }}
            onClick={() => handleClick(auction.id)}
            className="glass-card p-3 cursor-pointer hover:bg-white/10 transition-all active:scale-95"
          >
            {/* Gift Image */}
            <div className={`
              w-full aspect-square rounded-xl overflow-hidden mb-2
              bg-gradient-to-br ${rarityColors[auction.gift.rarity]}
              flex items-center justify-center
            `}>
              {auction.gift.imageUrl ? (
                <img 
                  src={auction.gift.imageUrl} 
                  alt={auction.gift.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-4xl">🎁</span>
              )}
            </div>

            {/* Info */}
            <h4 className="font-medium text-white text-sm truncate">
              {auction.gift.name}
            </h4>
            
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-yellow-400 font-bold text-sm flex items-center gap-0.5">
                <Star className="w-3 h-3 fill-yellow-400" />
                {auction.currentPrice.toLocaleString()}
              </span>
              <span className="text-gray-500 text-xs flex items-center gap-0.5">
                <Clock className="w-3 h-3" />
                {getTimeLeft(auction.endTime)}
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

export default SimilarAuctions;

