import { useEffect, useCallback, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Users, Star, Crown, Clock, Share2, Trophy, Heart, Zap, BarChart3 } from 'lucide-react'
import { useAuction, usePlaceBid, useSocket, useTelegram, useCompleteAuction, useAuctionWinner, useWatchlist, useSounds, useAuctionCelebration, useAutoBid } from '../hooks'
import { Timer, BidButton, AnimatedCountdown, FragmentSkeleton, AutoBidModal } from '../components'
import { BidHistoryChart } from '../components/BidHistoryChart'
import { useUserStore, useNotificationStore } from '../store'

const rarityColors = {
  common: 'from-gray-400 to-gray-500',
  rare: 'from-blue-400 to-blue-600',
  epic: 'from-purple-400 to-purple-600',
  legendary: 'from-yellow-400 to-orange-500',
}

export function AuctionPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: auction, isLoading, refetch } = useAuction(id)
  const { mutateAsync: placeBid, isPending: isBidding } = usePlaceBid()
  const { mutateAsync: completeAuction } = useCompleteAuction()
  const { joinAuction, leaveAuction } = useSocket()
  const { hapticFeedback, showBackButton, hideBackButton, showAlert } = useTelegram()
  const user = useUserStore((s) => s.user)
  const { addNotification } = useNotificationStore()

  const [auctionEnded, setAuctionEnded] = useState(false)
  const [showWinnerModal, setShowWinnerModal] = useState(false)
  const [showAutoBidModal, setShowAutoBidModal] = useState(false)
  const [showBidChart, setShowBidChart] = useState(false)

  // Sound & Confetti effects
  const { play } = useSounds()
  const { onWin, onBidSuccess, onOutbid } = useAuctionCelebration()

  // Watchlist
  const { isWatching, toggleWatchlist } = useWatchlist()
  const inWatchlist = id ? isWatching(id) : false

  // Auto-bid
  const { hasAutoBid, isActive: autoBidActive, status: autoBidStatus } = useAutoBid(id)

  // Track last price for sound effects
  const lastPriceRef = useRef<number>(0)

  // Fetch winner when auction completed
  const { data: winnerData } = useAuctionWinner(
    id || '',
    (auction?.status === 'completed' || auctionEnded)
  )

  // Join auction room on mount
  useEffect(() => {
    if (id) {
      joinAuction(id)
    }
    return () => {
      if (id) {
        leaveAuction(id)
      }
    }
  }, [id, joinAuction, leaveAuction])

  // Back button
  useEffect(() => {
    const cleanup = showBackButton(() => {
      navigate(-1)
    })
    return () => {
      cleanup?.()
      hideBackButton()
    }
  }, [showBackButton, hideBackButton, navigate])

  // Handle timer end - complete auction
  const handleTimerEnd = useCallback(async () => {
    if (!id || auctionEnded) return

    setAuctionEnded(true)

    try {
      const result = await completeAuction(id)

      if (result.winner) {
        setShowWinnerModal(true)
        hapticFeedback('notification', 'success')

        // Check if current user is the winner
        if (user && result.winner.username === user.username) {
          onWin() // Trigger confetti & sound
          addNotification({
            type: 'success',
            title: '🎉 Поздравляем!',
            message: `Вы выиграли "${auction?.gift.name}" за ${result.winner.winningBid} ⭐`
          })
        }
      }

      refetch()
    } catch (error) {
      // Auction might already be completed
      refetch()
    }
  }, [id, auctionEnded, completeAuction, hapticFeedback, user, addNotification, auction, refetch, onWin])

  // Show winner modal when data loaded
  useEffect(() => {
    if (winnerData?.winner && (auction?.status === 'completed' || auctionEnded)) {
      setShowWinnerModal(true)

      // Notify current user if they won
      if (winnerData.winner.isCurrentUser) {
        hapticFeedback('notification', 'success')
        onWin() // Trigger confetti
      }
    }
  }, [winnerData, auction?.status, auctionEnded, hapticFeedback, onWin])

  // Play sound when price changes (someone else bid)
  useEffect(() => {
    if (auction?.currentPrice && lastPriceRef.current > 0 && auction.currentPrice > lastPriceRef.current) {
      // Check if someone outbid us
      const lastBid = auction.bids[0]
      if (lastBid && user && lastBid.bidderName !== user.username && lastBid.bidderName !== user.firstName) {
        onOutbid()
      }
    }
    if (auction?.currentPrice) {
      lastPriceRef.current = auction.currentPrice
    }
  }, [auction?.currentPrice, auction?.bids, user, onOutbid])

  const handleBid = useCallback(async (amount: number) => {
    if (!id) return

    try {
      await placeBid({ auctionId: id, amount })
      onBidSuccess() // Play success sound
    } catch (error: any) {
      showAlert(error.message || 'Ошибка при ставке')
      throw error
    }
  }, [id, placeBid, showAlert, onBidSuccess])

  const handleShare = useCallback(() => {
    if (auction) {
      const text = `🎁 ${auction.gift.name}\n💰 Текущая цена: ${auction.currentPrice} ⭐\n\nУчаствуй в аукционе!`
      if (navigator.share) {
        navigator.share({ text })
      } else {
        navigator.clipboard.writeText(text)
        showAlert('Скопировано в буфер!')
      }
      play('click')
    }
  }, [auction, showAlert, play])

  const handleWatchlistToggle = useCallback(() => {
    if (id) {
      toggleWatchlist(id)
      play(inWatchlist ? 'click' : 'notification')
    }
  }, [id, toggleWatchlist, inWatchlist, play])

  if (isLoading) {
    return <AuctionPageSkeleton />
  }

  if (!auction) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="text-6xl mb-4">😔</div>
        <h2 className="text-xl font-bold text-white mb-2">Аукцион не найден</h2>
        <button
          onClick={() => navigate('/auctions')}
          className="text-purple-400 hover:text-purple-300"
        >
          Вернуться к списку
        </button>
      </div>
    )
  }

  const isWinner = (auction.status === 'completed' || auctionEnded) && winnerData?.winner?.isCurrentUser
  const isAuctionEnded = auction.status === 'completed' || auctionEnded

  return (
    <div className="space-y-6 pb-8">
      {/* Winner Modal */}
      <AnimatePresence>
        {showWinnerModal && winnerData?.winner && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80"
            onClick={() => setShowWinnerModal(false)}
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              className="glass-card p-8 max-w-sm w-full text-center relative overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Confetti background */}
              <div className="absolute inset-0 pointer-events-none">
                {[...Array(20)].map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{
                      y: -20,
                      x: Math.random() * 300 - 150,
                      opacity: 1,
                      rotate: 0
                    }}
                    animate={{
                      y: 400,
                      opacity: 0,
                      rotate: 360
                    }}
                    transition={{
                      duration: 3,
                      delay: i * 0.1,
                      repeat: Infinity,
                      ease: 'linear'
                    }}
                    className={`absolute text-2xl`}
                  >
                    {['🎉', '⭐', '🏆', '🎁', '✨'][i % 5]}
                  </motion.div>
                ))}
              </div>

              <motion.div
                animate={{
                  scale: [1, 1.2, 1],
                  rotate: [0, -10, 10, 0]
                }}
                transition={{ duration: 0.5, repeat: 3 }}
              >
                <Trophy className={`w-20 h-20 mx-auto mb-4 ${
                  winnerData.winner.isCurrentUser ? 'text-yellow-400' : 'text-purple-400'
                }`} />
              </motion.div>

              <h2 className="text-2xl font-bold text-white mb-2">
                {winnerData.winner.isCurrentUser ? '🎉 Вы победили!' : 'Аукцион завершён!'}
              </h2>

              <div className="bg-white/10 rounded-2xl p-4 mb-4">
                <div className="text-gray-400 text-sm mb-1">Победитель</div>
                <div className="text-xl font-bold text-white">
                  {winnerData.winner.isCurrentUser 
                    ? 'Вы!'
                    : (winnerData.winner.username || winnerData.winner.firstName || 'Победитель')
                  }
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-white/5 rounded-xl p-3">
                  <div className="text-yellow-400 text-2xl font-bold">
                    {(winnerData.finalPrice ?? 0).toLocaleString()} ⭐
                  </div>
                  <div className="text-gray-400 text-xs">Финальная цена</div>
                </div>
                <div className="bg-white/5 rounded-xl p-3">
                  <div className="text-purple-400 text-2xl font-bold">
                    {winnerData.totalBids ?? 0}
                  </div>
                  <div className="text-gray-400 text-xs">Всего ставок</div>
                </div>
              </div>

              <button
                onClick={() => setShowWinnerModal(false)}
                className="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl text-white font-bold"
              >
                {winnerData.winner.isCurrentUser ? 'Отлично!' : 'Закрыть'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-4"
      >
        <button
          onClick={() => navigate(-1)}
          className="p-2 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <h1 className="text-xl font-bold text-white flex-1 truncate">{auction.gift.name}</h1>
        
        {/* Watchlist Button */}
        <motion.button
          onClick={handleWatchlistToggle}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={`p-2 rounded-xl transition-colors ${
            inWatchlist
              ? 'bg-red-500/20 border border-red-500/30'
              : 'bg-white/5 hover:bg-white/10'
          }`}
        >
          <Heart className={`w-5 h-5 ${
            inWatchlist ? 'text-red-400 fill-red-400' : 'text-white'
          }`} />
        </motion.button>

        <button
          onClick={() => setShowBidChart(!showBidChart)}
          className={`p-2 rounded-xl transition-colors ${
            showBidChart 
              ? 'bg-purple-500/30 ring-2 ring-purple-500' 
              : 'bg-white/5 hover:bg-white/10'
          }`}
        >
          <BarChart3 className={`w-5 h-5 ${showBidChart ? 'text-purple-400' : 'text-white'}`} />
        </button>

        <button
          onClick={handleShare}
          className="p-2 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
        >
          <Share2 className="w-5 h-5 text-white" />
        </button>
      </motion.div>

      {/* Bid History Chart */}
      <AnimatePresence>
        {showBidChart && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <BidHistoryChart
              bids={(auction.bids || []).map(b => ({
                id: b.id,
                amount: b.amount,
                bidderName: b.bidderName,
                createdAt: b.createdAt instanceof Date ? b.createdAt.toISOString() : b.createdAt,
                isAutoBid: (b as any).isAutoBid
              }))}
              startingPrice={auction.startingPrice || 1}
              currentPrice={auction.currentPrice || 0}
              className="mt-4"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Gift Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative overflow-hidden rounded-3xl"
      >
        {/* Background gradient */}
        <div className={`absolute inset-0 bg-gradient-to-br ${rarityColors[auction.gift.rarity]} opacity-20`} />
        
        <div className="relative p-6">
          {/* Gift image */}
          <motion.div
            animate={auction.gift.rarity === 'legendary' ? {
              boxShadow: ['0 0 30px rgba(251, 191, 36, 0.3)', '0 0 60px rgba(251, 191, 36, 0.5)', '0 0 30px rgba(251, 191, 36, 0.3)']
            } : {}}
            transition={{ duration: 2, repeat: Infinity }}
            className={`
              w-40 h-40 mx-auto rounded-3xl overflow-hidden
              bg-gradient-to-br ${rarityColors[auction.gift.rarity]}
              flex items-center justify-center
              shadow-2xl
            `}
          >
            {auction.gift.imageUrl ? (
              <img src={auction.gift.imageUrl} alt={auction.gift.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-7xl">🎁</span>
            )}
          </motion.div>

          {/* Gift info */}
          <div className="text-center mt-6">
            <h2 className="text-2xl font-bold text-white">{auction.gift.name}</h2>
            {auction.gift.description && (
              <p className="text-gray-400 mt-2">{auction.gift.description}</p>
            )}
            <div className={`
              inline-block mt-3 px-3 py-1 rounded-full text-sm font-medium uppercase
              bg-gradient-to-r ${rarityColors[auction.gift.rarity]} text-white
            `}>
              {auction.gift.rarity}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Winner Banner */}
      <AnimatePresence>
        {isAuctionEnded && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`
              glass-card p-6 text-center cursor-pointer
              ${isWinner ? 'ring-2 ring-yellow-500 bg-yellow-500/10' : ''}
            `}
            onClick={() => winnerData?.winner && setShowWinnerModal(true)}
          >
            <Crown className={`w-12 h-12 mx-auto mb-3 ${isWinner ? 'text-yellow-400' : 'text-gray-400'}`} />
            <h3 className="text-xl font-bold text-white mb-1">
              {isWinner ? '🎉 Вы победили!' : 'Аукцион завершен'}
            </h3>
            <p className="text-gray-400">
              {isWinner
                ? `Вы выиграли этот подарок за ${winnerData?.finalPrice?.toLocaleString() || auction.currentPrice.toLocaleString()} ⭐`
                : winnerData?.winner
                  ? `Победитель: ${winnerData.winner.username || winnerData.winner.firstName || 'Определён'}`
                  : 'Победитель определяется...'
              }
            </p>
            {winnerData?.winner && (
              <button className="mt-3 text-sm text-purple-400 hover:text-purple-300">
                Нажмите для деталей
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Timer & Price */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-6"
      >
        <div className="grid grid-cols-2 gap-6">
          {/* Timer */}
          <div>
            <div className="flex items-center gap-2 text-gray-400 text-sm mb-3">
              <Clock className="w-4 h-4" />
              <span>Осталось времени</span>
            </div>
            <AnimatedCountdown
              endTime={auction.endTime}
              onComplete={handleTimerEnd}
              variant="default"
            />
          </div>

          {/* Current price */}
          <div>
            <div className="flex items-center gap-2 text-gray-400 text-sm mb-3">
              <Star className="w-4 h-4 text-yellow-400" />
              <span>{isAuctionEnded ? 'Финальная цена' : 'Текущая цена'}</span>
            </div>
            <motion.div
              key={auction.currentPrice}
              initial={{ scale: 1.2, color: '#22c55e' }}
              animate={{ scale: 1, color: '#facc15' }}
              className="text-3xl font-bold text-yellow-400"
            >
              {(winnerData?.finalPrice || auction.currentPrice).toLocaleString()} ⭐
            </motion.div>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center justify-between mt-6 pt-6 border-t border-white/10">
          <div className="flex items-center gap-2 text-gray-400">
            <Users className="w-4 h-4" />
            <span>{winnerData?.totalBids || auction.totalBids} ставок</span>
          </div>
          <div className="text-gray-400 text-sm">
            Шаг: +{auction.incrementAmount.toLocaleString()} ⭐
          </div>
        </div>
      </motion.div>

      {/* Bid Section */}
      {auction.status === 'active' && !auctionEnded && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-3"
        >
          <BidButton
            currentPrice={auction.currentPrice}
            minIncrement={auction.incrementAmount}
            onBid={handleBid}
            isLoading={isBidding}
            auctionStatus={auction.status}
          />
          
          {/* Auto-Bid Button */}
          <motion.button
            onClick={() => setShowAutoBidModal(true)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`
              w-full py-3 px-4 rounded-xl font-medium flex items-center justify-center gap-2 transition-all
              ${autoBidActive 
                ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/50 text-blue-400'
                : 'bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10'
              }
            `}
          >
            <span className="text-lg">{autoBidActive ? '🤖' : '⚡'}</span>
            {autoBidActive ? (
              <span>Auto-Bid активен (макс {autoBidStatus?.autoBid?.maxAmount} ⭐)</span>
            ) : (
              <span>Настроить Auto-Bid</span>
            )}
            {autoBidActive && (
              <span className="ml-auto w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            )}
          </motion.button>
        </motion.div>
      )}
      
      {/* Auto-Bid Modal */}
      <AutoBidModal
        isOpen={showAutoBidModal}
        onClose={() => setShowAutoBidModal(false)}
        auctionId={id || ''}
        auctionTitle={auction?.gift?.name || ''}
        currentPrice={auction?.currentPrice || 0}
        bidIncrement={auction?.incrementAmount || 1}
        userBalance={user?.balance || 0}
      />

      {/* Recent Bids */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h3 className="text-lg font-bold text-white mb-3">Последние ставки</h3>

        {auction.bids.length > 0 ? (
          <div className="space-y-2">
            {auction.bids.slice(0, 10).map((bid, index) => (
              <motion.div
                key={bid.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`
                  glass-card p-3 flex items-center gap-3
                  ${index === 0 ? 'ring-2 ring-purple-500/30' : ''}
                `}
              >
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold overflow-hidden">
                  {bid.bidderName?.charAt(0).toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-white truncate block">{bid.bidderName}</span>
                  <span className="text-xs text-gray-500">
                    {new Date(bid.createdAt).toLocaleTimeString()}
                  </span>
                </div>

                {/* Amount */}
                <div className="flex items-center gap-1 text-yellow-400 font-bold">
                  <Star className="w-4 h-4 fill-yellow-400" />
                  {bid.amount.toLocaleString()}
                </div>

                {/* Leading badge */}
                {index === 0 && (
                  <div className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded-full font-medium">
                    Лидер
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="glass-card p-6 text-center">
            <p className="text-gray-400">Пока нет ставок. Будьте первым!</p>
          </div>
        )}
      </motion.div>
    </div>
  )
}

function AuctionPageSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-white/10" />
        <div className="flex-1 h-6 bg-white/10 rounded" />
      </div>

      <div className="rounded-3xl bg-white/5 p-6">
        <div className="w-40 h-40 mx-auto rounded-3xl bg-white/10" />
        <div className="h-8 bg-white/10 rounded w-1/2 mx-auto mt-6" />
      </div>

      <div className="glass-card p-6">
        <div className="grid grid-cols-2 gap-6">
          <div className="h-16 bg-white/10 rounded" />
          <div className="h-16 bg-white/10 rounded" />
        </div>
      </div>

      <div className="h-40 bg-white/5 rounded-2xl" />
    </div>
  )
}






