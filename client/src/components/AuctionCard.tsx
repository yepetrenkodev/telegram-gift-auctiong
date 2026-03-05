import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Users, Clock, Star, Flame, TrendingUp, Crown } from 'lucide-react'
import { InlineTimer } from './Timer'
import type { Auction } from '../store'

interface AuctionCardProps {
  auction: Auction
  index?: number
}

const rarityColors = {
  common: 'from-gray-500 to-gray-600',
  rare: 'from-blue-500 to-blue-700',
  epic: 'from-purple-500 to-purple-700',
  legendary: 'from-yellow-500 to-orange-600',
}

const rarityBgColors = {
  common: 'rgba(156, 163, 175, 0.1)',
  rare: 'rgba(59, 130, 246, 0.1)',
  epic: 'rgba(139, 92, 246, 0.1)',
  legendary: 'rgba(245, 158, 11, 0.1)',
}

const rarityBorderColors = {
  common: 'rgba(156, 163, 175, 0.2)',
  rare: 'rgba(59, 130, 246, 0.3)',
  epic: 'rgba(139, 92, 246, 0.3)',
  legendary: 'rgba(245, 158, 11, 0.4)',
}

const rarityGlowColors = {
  common: 'none',
  rare: '0 0 30px rgba(59, 130, 246, 0.15)',
  epic: '0 0 30px rgba(139, 92, 246, 0.2)',
  legendary: '0 0 40px rgba(245, 158, 11, 0.25)',
}

const rarityLabels = {
  common: 'Common',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
}

export function AuctionCard({ auction, index = 0 }: AuctionCardProps) {
  const isHot = auction.totalBids > 10
  const isEnding = new Date(auction.endTime).getTime() - Date.now() < 5 * 60 * 1000
  const rarity = auction.gift.rarity || 'common'

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Link to={`/auction/${auction.id}`}>
        <motion.div
          whileHover={{ scale: 1.02, y: -4 }}
          whileTap={{ scale: 0.98 }}
          className="premium-card overflow-hidden relative group"
          style={{
            boxShadow: rarityGlowColors[rarity],
            borderColor: rarityBorderColors[rarity]
          }}
        >
          {/* Status badges */}
          <div className="absolute top-3 right-3 z-10 flex gap-2">
            {isHot && (
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full"
                style={{
                  background: 'linear-gradient(135deg, #f97316, #ef4444)',
                  boxShadow: '0 0 15px rgba(249, 115, 22, 0.4)'
                }}
              >
                <Flame className="w-3 h-3 text-white" />
                <span className="text-white text-xs font-bold">HOT</span>
              </motion.div>
            )}
            {isEnding && (
              <motion.div 
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 0.5, repeat: Infinity }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full"
                style={{
                  background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                  boxShadow: '0 0 15px rgba(239, 68, 68, 0.4)'
                }}
              >
                <Clock className="w-3 h-3 text-white" />
                <span className="text-white text-xs font-bold">ENDING</span>
              </motion.div>
            )}
          </div>

          {/* Rarity accent line */}
          <div 
            className="absolute top-0 left-0 right-0 h-[2px]"
            style={{ background: `linear-gradient(90deg, transparent, ${rarityBorderColors[rarity].replace('0.', '0.8').replace(')', '')}, transparent)` }}
          />
          
          {/* Content */}
          <div className="relative p-4">
            <div className="flex gap-4">
              {/* Gift image */}
              <div className="relative">
                <motion.div
                  animate={rarity === 'legendary' ? { 
                    boxShadow: ['0 0 20px rgba(245, 158, 11, 0.3)', '0 0 35px rgba(245, 158, 11, 0.5)', '0 0 20px rgba(245, 158, 11, 0.3)']
                  } : {}}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="w-20 h-20 rounded-2xl overflow-hidden flex items-center justify-center"
                  style={{
                    background: rarityBgColors[rarity],
                    border: `1px solid ${rarityBorderColors[rarity]}`
                  }}
                >
                  {auction.gift.imageUrl ? (
                    <img 
                      src={auction.gift.imageUrl} 
                      alt={auction.gift.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-4xl">🎁</span>
                  )}
                </motion.div>
                
                {/* Rarity badge */}
                <div 
                  className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider text-white whitespace-nowrap"
                  style={{
                    background: `linear-gradient(135deg, ${rarityColors[rarity].replace('from-', '').replace(' to-', ', ')})`.replace('gray-500', '#6b7280').replace('gray-600', '#4b5563').replace('blue-500', '#3b82f6').replace('blue-700', '#1d4ed8').replace('purple-500', '#8b5cf6').replace('purple-700', '#6d28d9').replace('yellow-500', '#eab308').replace('orange-600', '#ea580c'),
                    boxShadow: rarityGlowColors[rarity] !== 'none' ? rarityGlowColors[rarity] : undefined
                  }}
                >
                  {rarityLabels[rarity]}
                </div>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-white truncate group-hover:text-gradient-gold transition-colors text-base">
                  {auction.gift.name}
                </h3>
                
                {/* Current price */}
                <div className="mt-2 flex items-center gap-2">
                  <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                  <span className="text-xl font-bold text-gradient-gold">
                    {auction.currentPrice.toLocaleString()}
                  </span>
                </div>

                {/* Stats row */}
                <div className="mt-3 flex items-center gap-3">
                  <div className="flex items-center gap-1.5 text-xs text-gray-400 bg-white/5 px-2.5 py-1 rounded-lg">
                    <Users className="w-3.5 h-3.5" />
                    <span>{auction.totalBids}</span>
                  </div>
                  <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg ${isEnding ? 'bg-red-500/10 text-red-400' : 'bg-white/5 text-gray-400'}`}>
                    <Clock className="w-3.5 h-3.5" />
                    <InlineTimer auctionId={auction.id} endTime={auction.endTime} />
                  </div>
                </div>
              </div>
            </div>

            {/* Last bid info */}
            {auction.bids.length > 0 && (
              <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <TrendingUp className="w-3 h-3 text-green-500" />
                  <span>Последняя ставка:</span>
                  <span className="text-gray-400 font-medium">{auction.bids[0].bidderName}</span>
                </div>
                {auction.bids.length > 5 && (
                  <div className="flex items-center gap-1 text-xs text-yellow-500/70">
                    <Crown className="w-3 h-3" />
                    <span>Popular</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Hover gradient overlay */}
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-t from-yellow-500/5 via-purple-500/5 to-transparent pointer-events-none" />
        </motion.div>
      </Link>
    </motion.div>
  )
}

// Skeleton loading card - Premium style
export function AuctionCardSkeleton() {
  return (
    <div className="premium-card p-4">
      <div className="flex gap-4">
        <div className="w-20 h-20 rounded-2xl skeleton" />
        <div className="flex-1 space-y-3">
          <div className="h-5 skeleton rounded-lg w-3/4" />
          <div className="h-7 skeleton rounded-lg w-1/2" />
          <div className="flex gap-2">
            <div className="h-6 skeleton rounded-lg w-16" />
            <div className="h-6 skeleton rounded-lg w-20" />
          </div>
        </div>
      </div>
    </div>
  )
}
