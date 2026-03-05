import { useState } from 'react'
import { motion } from 'framer-motion'
import { Trophy, Calendar, TrendingUp, Crown, Star, Gem, Medal, Zap } from 'lucide-react'
import { useLeaderboard } from '../hooks'
import { Leaderboard } from '../components'
import { useUserStore } from '../store'

type TabType = 'daily' | 'weekly' | 'alltime'

const tabs: { value: TabType; label: string; icon: typeof Calendar }[] = [
  { value: 'daily', label: 'Сегодня', icon: Calendar },
  { value: 'weekly', label: 'Неделя', icon: TrendingUp },
  { value: 'alltime', label: 'Все время', icon: Trophy },
]

export function LeaderboardPage() {
  const [activeTab, setActiveTab] = useState<TabType>('daily')
  const { data, isLoading } = useLeaderboard(activeTab)
  const user = useUserStore((s) => s.user)

  // Mark current user in leaderboard
  const entries = data?.leaderboard?.map((entry, index) => ({
    ...entry,
    rank: index + 1,
    isCurrentUser: user ? entry.id === user.id : false
  })) || []

  const userEntry = entries.find(e => e.isCurrentUser)

  return (
    <div className="space-y-6">
      {/* Premium Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-4 mb-5">
          <div 
            className="p-3.5 rounded-2xl"
            style={{
              background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.2) 0%, rgba(245, 158, 11, 0.2) 100%)',
              border: '1px solid rgba(212, 175, 55, 0.3)',
              boxShadow: '0 0 30px rgba(212, 175, 55, 0.15)'
            }}
          >
            <Trophy className="w-7 h-7 text-yellow-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gradient-gold">Лидеры</h1>
            <p className="text-gray-500 text-sm">Топ участников аукционов</p>
          </div>
        </div>
      </motion.div>

      {/* Premium Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex gap-2 p-1.5 rounded-2xl"
        style={{ background: 'var(--bg-tertiary)' }}
      >
        {tabs.map(({ value, label, icon: Icon }) => (
          <motion.button
            key={value}
            whileTap={{ scale: 0.98 }}
            onClick={() => setActiveTab(value)}
            className={`
              flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all
              ${activeTab === value 
                ? 'text-yellow-400' 
                : 'text-gray-500 hover:text-gray-300'}
            `}
            style={activeTab === value ? {
              background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.15) 0%, rgba(139, 92, 246, 0.1) 100%)',
              border: '1px solid rgba(212, 175, 55, 0.2)'
            } : {}}
          >
            <Icon className="w-4 h-4" />
            <span>{label}</span>
          </motion.button>
        ))}
      </motion.div>

      {/* Premium User's rank card */}
      {user && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="premium-card p-5 relative overflow-hidden"
          style={{
            borderColor: 'rgba(139, 92, 246, 0.3)',
            boxShadow: '0 0 30px rgba(139, 92, 246, 0.1)'
          }}
        >
          {/* Decorative glow */}
          <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full blur-3xl opacity-20"
               style={{ background: 'radial-gradient(circle, rgba(139, 92, 246, 0.6) 0%, transparent 70%)' }} />
          
          <div className="relative flex items-center gap-4">
            <div 
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-xl font-bold overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
                boxShadow: '0 0 20px rgba(139, 92, 246, 0.3)'
              }}
            >
              {user.photoUrl ? (
                <img src={user.photoUrl} alt="" className="w-full h-full object-cover" />
              ) : user.firstName.charAt(0).toUpperCase()}
            </div>
            
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-bold text-white text-lg">{user.firstName} {user.lastName}</p>
                <Crown className="w-4 h-4 text-yellow-400" />
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Medal className="w-4 h-4 text-gray-500" />
                <p className="text-gray-400 text-sm">
                  {userEntry ? `${userEntry.rank} место` : 'Не в рейтинге'}
                </p>
              </div>
            </div>

            <div 
              className="px-4 py-2 rounded-xl text-right"
              style={{
                background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.15) 0%, rgba(212, 175, 55, 0.05) 100%)',
                border: '1px solid rgba(212, 175, 55, 0.2)'
              }}
            >
              <p className="text-yellow-400 font-bold text-xl flex items-center gap-1 justify-end">
                {user.totalSpent.toLocaleString()}
                <Star className="w-4 h-4 fill-yellow-400" />
              </p>
              <p className="text-gray-600 text-xs">потрачено</p>
            </div>
          </div>

          {/* User stats */}
          <div className="grid grid-cols-3 gap-3 mt-5 pt-5 border-t border-white/5">
            <motion.div 
              whileHover={{ scale: 1.02 }}
              className="text-center p-3 rounded-xl"
              style={{
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(16, 185, 129, 0.03) 100%)',
                border: '1px solid rgba(16, 185, 129, 0.2)'
              }}
            >
              <div className="flex items-center justify-center gap-1 mb-1">
                <Trophy className="w-4 h-4 text-green-400" />
                <p className="text-white font-bold text-lg">{user.totalWins}</p>
              </div>
              <p className="text-gray-600 text-xs">Побед</p>
            </motion.div>
            <motion.div 
              whileHover={{ scale: 1.02 }}
              className="text-center p-3 rounded-xl"
              style={{
                background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.1) 0%, rgba(212, 175, 55, 0.03) 100%)',
                border: '1px solid rgba(212, 175, 55, 0.2)'
              }}
            >
              <div className="flex items-center justify-center gap-1 mb-1">
                <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                <p className="text-white font-bold text-lg">{user.balance.toLocaleString()}</p>
              </div>
              <p className="text-gray-600 text-xs">Баланс</p>
            </motion.div>
            <motion.div 
              whileHover={{ scale: 1.02 }}
              className="text-center p-3 rounded-xl"
              style={{
                background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(59, 130, 246, 0.03) 100%)',
                border: '1px solid rgba(59, 130, 246, 0.2)'
              }}
            >
              <div className="flex items-center justify-center gap-1 mb-1">
                <Gem className="w-4 h-4 text-blue-400" />
                <p className="text-white font-bold text-lg">{user.tonBalance.toFixed(2)}</p>
              </div>
              <p className="text-gray-600 text-xs">TON</p>
            </motion.div>
          </div>
        </motion.div>
      )}

      {/* Leaderboard */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Leaderboard 
          entries={entries} 
          isLoading={isLoading}
          type={activeTab}
        />
      </motion.div>

      {/* Info */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex items-center justify-center gap-2 text-center text-xs text-gray-600 py-4"
      >
        <Zap className="w-3 h-3 text-purple-500" />
        <p>Рейтинг обновляется в реальном времени</p>
      </motion.div>
    </div>
  )
}
