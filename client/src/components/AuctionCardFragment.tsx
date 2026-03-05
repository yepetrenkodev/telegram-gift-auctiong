import { memo, useCallback, forwardRef } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Clock, Users, Star, TrendingUp, Hash, Heart } from 'lucide-react'
import { Timer } from './Timer'
import { useWatchlist, useSounds } from '../hooks'

interface AuctionCardProps {
  auction: {
    id: string
    gift: {
      id: string
      name: string
      imageUrl?: string
      rarity: 'common' | 'rare' | 'epic' | 'legendary'
      collection?: string
      giftCollection?: string
      model?: string
      number?: number
      timesSold?: number
    }
    currentPrice: number
    startingPrice: number
    endTime: Date | string
    status: string
    totalBids: number
  }
  index?: number
  viewMode?: 'grid' | 'list'
}

const rarityColors = {
  common: { bg: 'from-gray-500/20 to-gray-600/20', border: 'border-gray-500/30', text: 'text-gray-400', glow: '' },
  rare: { bg: 'from-blue-500/20 to-blue-600/20', border: 'border-blue-500/30', text: 'text-blue-400', glow: 'shadow-blue-500/20' },
  epic: { bg: 'from-purple-500/20 to-purple-600/20', border: 'border-purple-500/30', text: 'text-purple-400', glow: 'shadow-purple-500/20' },
  legendary: { bg: 'from-yellow-500/20 to-orange-500/20', border: 'border-yellow-500/30', text: 'text-yellow-400', glow: 'shadow-yellow-500/30' },
}

const rarityGradients = {
  common: 'from-gray-400 to-gray-500',
  rare: 'from-blue-400 to-blue-600',
  epic: 'from-purple-400 to-purple-600',
  legendary: 'from-yellow-400 to-orange-500',
}

export const AuctionCardFragment = memo(forwardRef<HTMLDivElement, AuctionCardProps>(function AuctionCardFragment({ 
  auction, 
  index = 0,
  viewMode = 'grid'
}, ref) {
  const rarity = auction.gift.rarity || 'common'
  const colors = rarityColors[rarity]
  const isEnded = auction.status === 'completed'
  const priceIncrease = auction.currentPrice > auction.startingPrice

  // Watchlist
  const { isWatching, toggleWatchlist } = useWatchlist()
  const { play } = useSounds()
  const inWatchlist = isWatching(auction.id)

  const handleWatchlistToggle = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    toggleWatchlist(auction.id)
    play(inWatchlist ? 'click' : 'notification')
  }, [toggleWatchlist, auction.id, inWatchlist, play])

  if (viewMode === 'list') {
    return (
      <Link to={`/auction/${auction.id}`} ref={ref as React.Ref<HTMLAnchorElement>}>
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.03 }}
          whileHover={{ scale: 1.01 }}
          className={`
            glass-card p-3 flex items-center gap-4
            border ${colors.border} hover:border-purple-500/50 transition-all
          `}
        >
          {/* Image */}
          <div className={`
            relative w-16 h-16 rounded-xl overflow-hidden flex-shrink-0
            bg-gradient-to-br ${rarityGradients[rarity]}
          `}>
            {auction.gift.imageUrl ? (
              <img 
                src={auction.gift.imageUrl} 
                alt={auction.gift.name} 
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl">🎁</div>
            )}
            {auction.gift.number && (
              <div className="absolute bottom-0 right-0 bg-black/60 px-1.5 py-0.5 text-[10px] text-white rounded-tl">
                #{auction.gift.number}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-white truncate">{auction.gift.name}</h3>
              <span className={`
                px-1.5 py-0.5 rounded text-[10px] font-medium uppercase
                bg-gradient-to-r ${rarityGradients[rarity]} text-white
              `}>
                {rarity}
              </span>
            </div>
            {auction.gift.giftCollection && (
              <p className="text-gray-500 text-xs truncate">{auction.gift.giftCollection}</p>
            )}
            <div className="flex items-center gap-3 mt-1">
              <span className="text-gray-400 text-xs flex items-center gap-1">
                <Users className="w-3 h-3" />
                {auction.totalBids}
              </span>
              {auction.gift.timesSold !== undefined && auction.gift.timesSold > 0 && (
                <span className="text-gray-400 text-xs">
                  {auction.gift.timesSold} sold
                </span>
              )}
            </div>
          </div>

          {/* Price & Timer */}
          <div className="text-right flex-shrink-0">
            <div className="flex items-center gap-1 justify-end">
              <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
              <span className="font-bold text-white">{auction.currentPrice.toLocaleString()}</span>
            </div>
            {!isEnded ? (
              <div className="mt-1">
                <Timer auctionId={auction.id} endTime={new Date(auction.endTime)} size="sm" />
              </div>
            ) : (
              <span className="text-xs text-red-400">Ended</span>
            )}
          </div>

          {/* Watchlist Button (List View) */}
          <motion.button
            onClick={handleWatchlistToggle}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className={`
              p-2 rounded-xl transition-all flex-shrink-0
              ${inWatchlist 
                ? 'bg-red-500/20 border border-red-500/30' 
                : 'bg-white/5 border border-white/10'
              }
            `}
          >
            <Heart 
              className={`w-4 h-4 ${
                inWatchlist 
                  ? 'text-red-400 fill-red-400' 
                  : 'text-gray-500'
              }`} 
            />
          </motion.button>
        </motion.div>
      </Link>
    )
  }

  // Grid View
  return (
    <Link to={`/auction/${auction.id}`} ref={ref as React.Ref<HTMLAnchorElement>}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05 }}
        whileHover={{ scale: 1.02, y: -4 }}
        className={`
          glass-card overflow-hidden group cursor-pointer
          border ${colors.border} hover:border-purple-500/50 transition-all
          ${rarity === 'legendary' ? `shadow-lg ${colors.glow}` : ''}
        `}
      >
        {/* Image Container */}
        <div className={`relative aspect-square overflow-hidden bg-gradient-to-br ${colors.bg}`}>
          {/* Rarity Glow for Legendary */}
          {rarity === 'legendary' && (
            <motion.div
              animate={{ 
                opacity: [0.3, 0.6, 0.3],
                scale: [1, 1.05, 1]
              }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute inset-0 bg-gradient-to-br from-yellow-500/20 to-orange-500/20"
            />
          )}
          
          {/* Gift Image */}
          <div className="absolute inset-4 flex items-center justify-center">
            {auction.gift.imageUrl ? (
              <motion.img
                src={auction.gift.imageUrl}
                alt={auction.gift.name}
                className="w-full h-full object-contain drop-shadow-2xl"
                whileHover={{ scale: 1.1, rotate: [-2, 2, -2] }}
                transition={{ duration: 0.3 }}
              />
            ) : (
              <span className="text-7xl">🎁</span>
            )}
          </div>

          {/* Number Badge */}
          {auction.gift.number && (
            <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm px-2 py-1 rounded-lg flex items-center gap-1">
              <Hash className="w-3 h-3 text-gray-400" />
              <span className="text-white text-xs font-mono">{auction.gift.number}</span>
            </div>
          )}

          {/* Watchlist Button */}
          <motion.button
            onClick={handleWatchlistToggle}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className={`
              absolute top-2 right-2 p-2 rounded-xl backdrop-blur-sm transition-all z-10
              ${inWatchlist 
                ? 'bg-red-500/30 border border-red-500/50' 
                : 'bg-black/40 border border-white/10 opacity-0 group-hover:opacity-100'
              }
            `}
          >
            <Heart 
              className={`w-4 h-4 transition-colors ${
                inWatchlist 
                  ? 'text-red-400 fill-red-400' 
                  : 'text-white/70'
              }`} 
            />
          </motion.button>

          {/* Rarity Badge */}
          <div className={`
            absolute ${auction.gift.number ? 'top-10' : 'top-2'} left-2 px-2 py-1 rounded-lg text-xs font-bold uppercase
            bg-gradient-to-r ${rarityGradients[rarity]} text-white shadow-lg
          `}>
            {rarity}
          </div>

          {/* Status Overlay */}
          {isEnded && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
              <span className="text-white font-bold text-lg">SOLD</span>
            </div>
          )}

          {/* Price Indicator */}
          {priceIncrease && !isEnded && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="absolute bottom-2 left-2 flex items-center gap-1 bg-green-500/20 backdrop-blur-sm text-green-400 px-2 py-1 rounded-lg text-xs"
            >
              <TrendingUp className="w-3 h-3" />
              <span>+{Math.round(((auction.currentPrice - auction.startingPrice) / auction.startingPrice) * 100)}%</span>
            </motion.div>
          )}
        </div>

        {/* Info Section */}
        <div className="p-3 space-y-2">
          {/* Title */}
          <div>
            <h3 className="font-bold text-white truncate group-hover:text-purple-400 transition-colors">
              {auction.gift.name}
            </h3>
            {auction.gift.giftCollection && (
              <p className="text-gray-500 text-xs truncate">{auction.gift.giftCollection}</p>
            )}
          </div>

          {/* Price & Stats */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
              <motion.span 
                key={auction.currentPrice}
                initial={{ scale: 1.2 }}
                animate={{ scale: 1 }}
                className="font-bold text-white"
              >
                {auction.currentPrice.toLocaleString()}
              </motion.span>
            </div>
            <div className="flex items-center gap-1 text-gray-400 text-xs">
              <Users className="w-3 h-3" />
              <span>{auction.totalBids}</span>
            </div>
          </div>

          {/* Timer / Status */}
          <div className="pt-2 border-t border-white/10">
            {!isEnded ? (
              <div className="flex items-center justify-between">
                <span className="text-gray-500 text-xs flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Ends in
                </span>
                <Timer auctionId={auction.id} endTime={new Date(auction.endTime)} size="sm" />
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-gray-500 text-xs">Final Price</span>
                <span className="text-green-400 font-medium">{auction.currentPrice.toLocaleString()} ⭐</span>
              </div>
            )}
          </div>

          {/* Sold Counter */}
          {auction.gift.timesSold !== undefined && auction.gift.timesSold > 0 && (
            <div className="text-center text-xs text-gray-500">
              {auction.gift.timesSold} times sold
            </div>
          )}
        </div>
      </motion.div>
    </Link>
  )
}))

export default AuctionCardFragment

