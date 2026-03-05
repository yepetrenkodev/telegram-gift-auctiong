import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Flame, Clock, Trophy, Star, ArrowRight, Sparkles, TrendingUp, Award, Crown, Zap, Gift, Wallet } from 'lucide-react'
import { useAuctions, useLeaderboard } from '../hooks'
import { AuctionCard, AuctionCardSkeleton } from '../components'
import { useUserStore } from '../store'

export function HomePage() {
  const { data: auctionsData, isLoading: auctionsLoading } = useAuctions({ status: 'active' })
  const { data: leaderboard } = useLeaderboard('daily')
  const user = useUserStore((s) => s.user)

  // Featured auction (highest bid activity)
  const featuredAuction = auctionsData?.auctions?.sort((a, b) => b.totalBids - a.totalBids)[0]
  const hotAuctions = auctionsData?.auctions?.filter(a => a.totalBids > 5).slice(0, 3) || []
  const endingSoon = auctionsData?.auctions?.filter(a => {
    const timeLeft = new Date(a.endTime).getTime() - Date.now()
    return timeLeft > 0 && timeLeft < 30 * 60 * 1000 // 30 minutes
  }).slice(0, 3) || []

  // Show all auctions if no hot or ending soon
  const displayAuctions = hotAuctions.length > 0 ? hotAuctions : (auctionsData?.auctions?.slice(0, 4) || [])

  return (
    <div className="space-y-6 pb-4">
      {/* Premium Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl p-6"
        style={{
          background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.1) 0%, rgba(139, 92, 246, 0.15) 50%, rgba(59, 130, 246, 0.1) 100%)',
          border: '1px solid rgba(212, 175, 55, 0.2)'
        }}
      >
        {/* Animated luxury background */}
        <div className="absolute inset-0 overflow-hidden">
          <motion.div
            animate={{ 
              rotate: 360,
              scale: [1, 1.1, 1]
            }}
            transition={{ 
              rotate: { duration: 30, repeat: Infinity, ease: 'linear' },
              scale: { duration: 4, repeat: Infinity, ease: 'easeInOut' }
            }}
            className="absolute -top-20 -right-20 w-60 h-60 rounded-full opacity-30"
            style={{ background: 'radial-gradient(circle, rgba(212, 175, 55, 0.3) 0%, transparent 70%)' }}
          />
          <motion.div
            animate={{ 
              rotate: -360,
              scale: [1, 1.2, 1]
            }}
            transition={{ 
              rotate: { duration: 25, repeat: Infinity, ease: 'linear' },
              scale: { duration: 5, repeat: Infinity, ease: 'easeInOut' }
            }}
            className="absolute -bottom-32 -left-32 w-80 h-80 rounded-full opacity-20"
            style={{ background: 'radial-gradient(circle, rgba(139, 92, 246, 0.4) 0%, transparent 70%)' }}
          />
          
          {/* Floating sparkles */}
          <motion.div
            animate={{ y: [0, -10, 0], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute top-4 right-8"
          >
            <Sparkles className="w-5 h-5 text-yellow-400/60" />
          </motion.div>
          <motion.div
            animate={{ y: [0, -8, 0], opacity: [0.3, 0.8, 0.3] }}
            transition={{ duration: 2.5, repeat: Infinity, delay: 0.5 }}
            className="absolute top-12 right-20"
          >
            <Crown className="w-4 h-4 text-yellow-500/40" />
          </motion.div>
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <Crown className="w-5 h-5 text-yellow-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-yellow-400/80">Premium Auctions</span>
          </div>
          
          <h1 className="text-2xl font-bold mb-2">
            <span className="text-gradient-gold">{user ? `Привет, ${user.firstName}!` : 'Добро пожаловать'}</span>
            <span className="ml-2">{user ? '👋' : '🎁'}</span>
          </h1>
          <p className="text-gray-400 text-sm mb-5">
            Выигрывай эксклюзивные подарки Telegram в честных аукционах
          </p>

          {user && (
            <div className="flex items-center gap-3 flex-wrap">
              <motion.div 
                whileHover={{ scale: 1.05 }}
                className="flex items-center gap-2 rounded-2xl px-4 py-2.5"
                style={{
                  background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.15) 0%, rgba(212, 175, 55, 0.05) 100%)',
                  border: '1px solid rgba(212, 175, 55, 0.3)'
                }}
              >
                <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                <span className="text-yellow-400 font-bold text-lg">{user.balance.toLocaleString()}</span>
              </motion.div>
              <motion.div 
                whileHover={{ scale: 1.05 }}
                className="flex items-center gap-2 rounded-2xl px-4 py-2.5"
                style={{
                  background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(59, 130, 246, 0.05) 100%)',
                  border: '1px solid rgba(59, 130, 246, 0.3)'
                }}
              >
                <span className="text-2xl">💎</span>
                <span className="text-blue-400 font-bold text-lg">{user.tonBalance?.toFixed(2) || '0'} TON</span>
              </motion.div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Premium Stats Cards */}
      {user && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="grid grid-cols-3 gap-3"
        >
          <motion.div 
            whileHover={{ scale: 1.03, y: -2 }}
            className="stat-card stat-card-gold"
          >
            <div className="flex items-center justify-center mb-2">
              <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
            </div>
            <motion.div 
              key={user.balance}
              initial={{ scale: 1.2 }}
              animate={{ scale: 1 }}
              className="text-xl font-bold text-yellow-400 text-center"
            >
              {user.balance.toLocaleString()}
            </motion.div>
            <div className="text-[10px] text-gray-500 mt-1 text-center uppercase tracking-wider">Баланс</div>
          </motion.div>
          
          <motion.div 
            whileHover={{ scale: 1.03, y: -2 }}
            className="stat-card stat-card-purple"
          >
            <div className="flex items-center justify-center mb-2">
              <Zap className="w-5 h-5 text-purple-400" />
            </div>
            <motion.div 
              key={user.totalSpent}
              initial={{ scale: 1.2 }}
              animate={{ scale: 1 }}
              className="text-xl font-bold text-purple-400 text-center"
            >
              {(user.totalSpent || 0).toLocaleString()}
            </motion.div>
            <div className="text-[10px] text-gray-500 mt-1 text-center uppercase tracking-wider">Потрачено</div>
          </motion.div>
          
          <motion.div 
            whileHover={{ scale: 1.03, y: -2 }}
            className="stat-card"
            style={{ '--gradient-color': '#10b981' } as React.CSSProperties}
          >
            <div className="flex items-center justify-center mb-2">
              <Trophy className="w-5 h-5 text-green-400" />
            </div>
            <div className="text-xl font-bold text-green-400 text-center">
              {user.totalWins || 0}
            </div>
            <div className="text-[10px] text-gray-500 mt-1 text-center uppercase tracking-wider">Побед</div>
          </motion.div>
        </motion.div>
      )}

      {/* Featured Auction - Premium Style */}
      {featuredAuction && (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
              <Flame className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-lg font-bold text-white">Главный аукцион</h2>
            <span className="badge-hot ml-auto">🔥 HOT</span>
          </div>

          <Link to={`/auction/${featuredAuction.id}`}>
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="premium-card p-5 shine shine-gold"
            >
              <div className="flex items-center gap-4">
                <motion.div 
                  animate={{ y: [0, -5, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                  className="w-24 h-24 rounded-2xl flex items-center justify-center text-4xl overflow-hidden"
                  style={{
                    background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.2) 0%, rgba(239, 68, 68, 0.2) 100%)',
                    border: '1px solid rgba(249, 115, 22, 0.3)'
                  }}
                >
                  {featuredAuction.gift.imageUrl ? (
                    <img src={featuredAuction.gift.imageUrl} alt="" className="w-full h-full object-cover rounded-2xl" />
                  ) : '🎁'}
                </motion.div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-white mb-1">{featuredAuction.gift.name}</h3>
                  <div className="flex items-center gap-2">
                    <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                    <span className="text-2xl font-bold text-gradient-gold">
                      {featuredAuction.currentPrice.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-gray-500 bg-white/5 px-2 py-1 rounded-lg">
                      {featuredAuction.totalBids} ставок
                    </span>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-500/20 to-orange-500/20 flex items-center justify-center">
                  <ArrowRight className="w-5 h-5 text-yellow-400" />
                </div>
              </div>
            </motion.div>
          </Link>
        </motion.section>
      )}

      {/* Auctions List - Premium */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Gift className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-lg font-bold text-white">
              {hotAuctions.length > 0 ? 'Горячие аукционы' : 'Активные аукционы'}
            </h2>
          </div>
          <Link to="/auctions" className="text-sm font-medium text-purple-400 hover:text-purple-300 flex items-center gap-1">
            Все <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="space-y-3">
          {auctionsLoading ? (
            [...Array(3)].map((_, i) => <AuctionCardSkeleton key={i} />)
          ) : displayAuctions.length > 0 ? (
            displayAuctions.map((auction, index) => (
              <AuctionCard key={auction.id} auction={auction} index={index} />
            ))
          ) : (
            <div className="premium-card p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-gray-800 mx-auto mb-4 flex items-center justify-center">
                <Gift className="w-8 h-8 text-gray-600" />
              </div>
              <p className="text-gray-400">Нет активных аукционов</p>
              <p className="text-gray-600 text-sm mt-1">Скоро появятся новые!</p>
            </div>
          )}
        </div>
      </motion.section>

      {/* Ending Soon - Premium */}
      {endingSoon.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center">
                <Clock className="w-4 h-4 text-white" />
              </div>
              <h2 className="text-lg font-bold text-white">Скоро завершатся</h2>
              <span className="badge-ending">⏰ ENDING</span>
            </div>
            <Link to="/auctions?sort=ending" className="text-sm font-medium text-purple-400 hover:text-purple-300 flex items-center gap-1">
              Все <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="space-y-3">
            {endingSoon.map((auction, index) => (
              <AuctionCard key={auction.id} auction={auction} index={index} />
            ))}
          </div>
        </motion.section>
      )}

      {/* Leaderboard Preview - Premium */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center">
              <Trophy className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-lg font-bold text-white">Топ игроков</h2>
          </div>
          <Link to="/leaderboard" className="text-sm font-medium text-purple-400 hover:text-purple-300 flex items-center gap-1">
            Полный топ <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="premium-card p-4 space-y-2">
          {leaderboard?.leaderboard?.slice(0, 3).map((entry, index) => (
            <motion.div 
              key={entry.id || index} 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`
                flex items-center gap-3 p-3 rounded-xl transition-all
                ${index === 0 ? 'position-1' : index === 1 ? 'position-2' : index === 2 ? 'position-3' : ''}
                ${entry.isCurrentUser ? 'ring-1 ring-purple-500/50' : ''}
              `}
            >
              <div className={`
                w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm
                ${index === 0 
                  ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-yellow-900 shadow-lg shadow-yellow-500/30' 
                  : index === 1 
                  ? 'bg-gradient-to-br from-gray-300 to-gray-500 text-gray-800' 
                  : 'bg-gradient-to-br from-orange-400 to-orange-600 text-orange-900'}
              `}>
                {index === 0 ? <Crown className="w-4 h-4" /> : index + 1}
              </div>
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold overflow-hidden ring-2 ring-white/10">
                {entry.photoUrl ? (
                  <img src={entry.photoUrl} alt="" className="w-full h-full object-cover" />
                ) : entry.name?.charAt(0).toUpperCase()}
              </div>
              <span className="flex-1 font-medium text-white truncate">
                {entry.name}
                {entry.isCurrentUser && <span className="text-purple-400 text-xs ml-2">(вы)</span>}
              </span>
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                <span className="text-yellow-400 font-bold">{(entry.score || 0).toLocaleString()}</span>
              </div>
            </motion.div>
          ))}

          {(!leaderboard?.leaderboard || leaderboard.leaderboard.length === 0) && (
            <div className="text-center py-6">
              <Trophy className="w-12 h-12 text-gray-700 mx-auto mb-2" />
              <p className="text-gray-500">Пока нет данных</p>
            </div>
          )}
        </div>
      </motion.section>

      {/* Quick Actions - Premium */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="grid grid-cols-2 gap-3"
      >
        <Link to="/auctions">
          <motion.div
            whileHover={{ scale: 1.03, y: -3 }}
            whileTap={{ scale: 0.98 }}
            className="premium-card p-5 text-center group"
          >
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 mx-auto flex items-center justify-center mb-3 group-hover:shadow-lg group-hover:shadow-purple-500/30 transition-shadow">
              <Gift className="w-7 h-7 text-white" />
            </div>
            <span className="text-white font-semibold">Все аукционы</span>
            <p className="text-gray-500 text-xs mt-1">Найди свой приз</p>
          </motion.div>
        </Link>

        <Link to="/wallet">
          <motion.div
            whileHover={{ scale: 1.03, y: -3 }}
            whileTap={{ scale: 0.98 }}
            className="premium-card p-5 text-center group"
          >
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-yellow-500 to-orange-500 mx-auto flex items-center justify-center mb-3 group-hover:shadow-lg group-hover:shadow-yellow-500/30 transition-shadow">
              <Wallet className="w-7 h-7 text-white" />
            </div>
            <span className="text-white font-semibold">Купить звезды</span>
            <p className="text-gray-500 text-xs mt-1">Пополни баланс</p>
          </motion.div>
        </Link>
      </motion.section>
    </div>
  )
}

