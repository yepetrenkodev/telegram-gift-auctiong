import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Minus, Zap, Loader2 } from 'lucide-react'
import { useTelegram, useSounds } from '../hooks'
import { useUserStore } from '../store'

interface BidButtonProps {
  currentPrice: number
  minIncrement: number
  onBid: (amount: number) => Promise<void>
  disabled?: boolean
  isLoading?: boolean
  auctionStatus?: string
}

export function BidButton({ 
  currentPrice, 
  minIncrement, 
  onBid, 
  disabled = false,
  isLoading = false,
  auctionStatus = 'active'
}: BidButtonProps) {
  const { hapticFeedback } = useTelegram()
  const { play } = useSounds()
  const user = useUserStore((s) => s.user)
  
  const [multiplier, setMultiplier] = useState(1)
  const [isProcessing, setIsProcessing] = useState(false)

  const bidAmount = currentPrice + (minIncrement * multiplier)
  const canAfford = user ? user.balance >= bidAmount : false
  const isActive = auctionStatus === 'active'

  const handleIncrement = useCallback(() => {
    if (multiplier < 10) {
      setMultiplier((m) => m + 1)
      hapticFeedback('selection')
      play('click')
    }
  }, [multiplier, hapticFeedback, play])

  const handleDecrement = useCallback(() => {
    if (multiplier > 1) {
      setMultiplier((m) => m - 1)
      hapticFeedback('selection')
      play('click')
    }
  }, [multiplier, hapticFeedback, play])

  const handleBid = useCallback(async () => {
    if (!canAfford || !isActive || isLoading || isProcessing) return
    
    setIsProcessing(true)
    hapticFeedback('impact', 'heavy')
    play('bid')
    
    try {
      await onBid(bidAmount)
      setMultiplier(1)
      hapticFeedback('notification', 'success')
      play('bidSuccess')
    } catch (error) {
      hapticFeedback('notification', 'error')
    } finally {
      setIsProcessing(false)
    }
  }, [bidAmount, canAfford, isActive, isLoading, isProcessing, onBid, hapticFeedback, play])

  const quickBidOptions = [1, 2, 5, 10]

  if (!isActive) {
    return (
      <div className="glass-card p-4 text-center">
        <span className="text-gray-400">
          {auctionStatus === 'pending' ? 'Аукцион скоро начнется' : 'Аукцион завершен'}
        </span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Quick multiplier selection */}
      <div className="flex gap-2">
        {quickBidOptions.map((opt) => (
          <motion.button
            key={opt}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              setMultiplier(opt)
              hapticFeedback('selection')
              play('click')
            }}
            className={`
              flex-1 py-2 rounded-xl text-sm font-medium transition-all
              ${multiplier === opt 
                ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30' 
                : 'bg-white/5 text-gray-400 hover:bg-white/10'}
            `}
          >
            x{opt}
          </motion.button>
        ))}
      </div>

      {/* Bid amount display */}
      <div className="glass-card p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-gray-400 text-sm">Ваша ставка:</span>
          <div className="flex items-center gap-2">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={handleDecrement}
              disabled={multiplier <= 1}
              className="p-2 bg-white/5 rounded-lg hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <Minus className="w-4 h-4 text-gray-400" />
            </motion.button>
            
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={handleIncrement}
              disabled={multiplier >= 10}
              className="p-2 bg-white/5 rounded-lg hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <Plus className="w-4 h-4 text-gray-400" />
            </motion.button>
          </div>
        </div>

        <motion.div
          key={bidAmount}
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center"
        >
          <span className="text-3xl font-bold bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
            {bidAmount.toLocaleString()} ⭐
          </span>
          <div className="text-xs text-gray-500 mt-1">
            +{(minIncrement * multiplier).toLocaleString()} к текущей цене
          </div>
        </motion.div>
      </div>

      {/* Balance warning */}
      <AnimatePresence>
        {!canAfford && user && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="text-red-400 text-sm text-center bg-red-500/10 rounded-xl p-3"
          >
            Недостаточно звезд. Нужно ещё {(bidAmount - user.balance).toLocaleString()} ⭐
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main bid button */}
      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={handleBid}
        disabled={disabled || !canAfford || isProcessing}
        className={`
          relative w-full py-4 rounded-2xl font-bold text-lg
          flex items-center justify-center gap-2
          overflow-hidden transition-all
          ${canAfford && !disabled
            ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/30 hover:shadow-xl hover:shadow-purple-500/40'
            : 'bg-gray-800 text-gray-500 cursor-not-allowed'}
        `}
      >
        {/* Animated background */}
        {canAfford && !disabled && (
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-purple-400 to-pink-400 opacity-0"
            animate={{ opacity: [0, 0.3, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        )}
        
        {isProcessing ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Отправка...</span>
          </>
        ) : (
          <>
            <Zap className="w-5 h-5" />
            <span>Сделать ставку</span>
          </>
        )}
      </motion.button>

      {/* User balance */}
      {user && (
        <div className="text-center text-sm text-gray-500">
          Ваш баланс: <span className="text-yellow-400 font-semibold">{user.balance.toLocaleString()} ⭐</span>
        </div>
      )}
    </div>
  )
}
