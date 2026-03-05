import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { User, Settings, Trophy, Gavel, History, LogOut, ChevronRight, Star, Gift } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTelegram, useUserBids, useUserWins, useAuth } from '../hooks'
import { useUserStore } from '../store'
import { AuctionCard } from '../components'

type TabType = 'wins' | 'bids' | 'settings'

export function ProfilePage() {
  const navigate = useNavigate()
  const { showConfirm, showAlert, close } = useTelegram()
  const user = useUserStore((s) => s.user)
  const { logout } = useAuth()
  const { data: userBids } = useUserBids()
  const { data: userWins } = useUserWins()
  const [activeTab, setActiveTab] = useState<TabType>('wins')

  const handleLogout = async () => {
    const confirmed = await showConfirm('Вы уверены, что хотите выйти?')
    if (confirmed) {
      logout()
      close()
    }
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <User className="w-16 h-16 text-gray-500 mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Войдите в аккаунт</h2>
        <p className="text-gray-400 text-center">
          Откройте приложение через Telegram
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Profile Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-purple-600/30 to-pink-600/30"
      >
        {/* Background decoration */}
        <div className="absolute inset-0">
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-purple-500/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-pink-500/20 rounded-full blur-3xl" />
        </div>

        <div className="relative p-6">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.1 }}
              className="relative"
            >
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-3xl font-bold overflow-hidden ring-4 ring-white/10">
                {user.photoUrl ? (
                  <img src={user.photoUrl} alt="" className="w-full h-full object-cover" />
                ) : user.firstName.charAt(0).toUpperCase()}
              </div>
              {user.totalWins > 0 && (
                <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center">
                  <Trophy className="w-4 h-4 text-white" />
                </div>
              )}
            </motion.div>

            {/* Info */}
            <div className="flex-1">
              <h1 className="text-xl font-bold text-white">
                {user.firstName} {user.lastName}
              </h1>
              {user.username && (
                <p className="text-purple-300">@{user.username}</p>
              )}
              <p className="text-gray-400 text-sm mt-1">ID: {user.telegramId}</p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-white">{user.totalWins}</div>
              <div className="text-gray-400 text-xs">Побед</div>
            </div>
            <div className="text-center border-x border-white/10">
              <div className="text-2xl font-bold text-yellow-400">{user.totalSpent.toLocaleString()}</div>
              <div className="text-gray-400 text-xs">Потрачено ⭐</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-white">{user.balance.toLocaleString()}</div>
              <div className="text-gray-400 text-xs">Баланс ⭐</div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex gap-2 bg-white/5 p-1 rounded-2xl"
      >
        <TabButton 
          active={activeTab === 'wins'} 
          onClick={() => setActiveTab('wins')}
          icon={Trophy}
          label="Выигрыши"
        />
        <TabButton 
          active={activeTab === 'bids'} 
          onClick={() => setActiveTab('bids')}
          icon={Gavel}
          label="Ставки"
        />
        <TabButton 
          active={activeTab === 'settings'} 
          onClick={() => setActiveTab('settings')}
          icon={Settings}
          label="Настройки"
        />
      </motion.div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'wins' && (
          <motion.div
            key="wins"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-3"
          >
            {userWins?.auctions && userWins.auctions.length > 0 ? (
              userWins.auctions.map((auction, index) => (
                <AuctionCard key={auction.id} auction={auction} index={index} />
              ))
            ) : (
              <EmptyState 
                icon={Trophy}
                title="Пока нет выигрышей"
                description="Участвуйте в аукционах и выигрывайте!"
              />
            )}
          </motion.div>
        )}

        {activeTab === 'bids' && (
          <motion.div
            key="bids"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-3"
          >
            {userBids?.bids && userBids.bids.length > 0 ? (
              userBids.bids.map((bid: any, index: number) => (
                <motion.div
                  key={bid.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="glass-card p-3 flex items-center gap-3"
                >
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-2xl">
                    🎁
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate">{bid.auctionName || 'Аукцион'}</p>
                    <p className="text-gray-500 text-xs">
                      {new Date(bid.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-yellow-400 font-bold">{bid.amount.toLocaleString()} ⭐</p>
                    <p className={`text-xs ${bid.isWinning ? 'text-green-400' : 'text-gray-500'}`}>
                      {bid.isWinning ? 'Лидирует' : 'Перебита'}
                    </p>
                  </div>
                </motion.div>
              ))
            ) : (
              <EmptyState 
                icon={Gavel}
                title="Нет ставок"
                description="Сделайте первую ставку на аукционе!"
              />
            )}
          </motion.div>
        )}

        {activeTab === 'settings' && (
          <motion.div
            key="settings"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-3"
          >
            <SettingsItem 
              icon={Star}
              label="Уведомления"
              description="Настройка push-уведомлений"
              onClick={() => showAlert('В разработке')}
            />
            <SettingsItem 
              icon={Gift}
              label="Мои подарки"
              description="Полученные подарки"
              onClick={() => navigate('/gifts')}
            />
            <SettingsItem 
              icon={History}
              label="История"
              description="История всех операций"
              onClick={() => navigate('/history')}
            />
            
            <div className="pt-4">
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleLogout}
                className="w-full py-3 rounded-2xl bg-red-500/10 text-red-400 font-medium flex items-center justify-center gap-2 hover:bg-red-500/20 transition-colors"
              >
                <LogOut className="w-5 h-5" />
                Выйти
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function TabButton({ active, onClick, icon: Icon, label }: { 
  active: boolean
  onClick: () => void
  icon: typeof Trophy
  label: string 
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`
        flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all
        ${active 
          ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg' 
          : 'text-gray-400 hover:text-white'}
      `}
    >
      <Icon className="w-4 h-4" />
      <span>{label}</span>
    </motion.button>
  )
}

function EmptyState({ icon: Icon, title, description }: { 
  icon: typeof Trophy
  title: string
  description: string 
}) {
  return (
    <div className="glass-card p-8 text-center">
      <Icon className="w-12 h-12 text-gray-500 mx-auto mb-3" />
      <h3 className="text-lg font-bold text-white mb-1">{title}</h3>
      <p className="text-gray-400 text-sm">{description}</p>
    </div>
  )
}

function SettingsItem({ icon: Icon, label, description, onClick }: {
  icon: typeof Star
  label: string
  description: string
  onClick: () => void
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="w-full glass-card p-4 flex items-center gap-4 text-left hover:ring-2 hover:ring-purple-500/30 transition-all"
    >
      <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
        <Icon className="w-5 h-5 text-gray-400" />
      </div>
      <div className="flex-1">
        <p className="text-white font-medium">{label}</p>
        <p className="text-gray-500 text-sm">{description}</p>
      </div>
      <ChevronRight className="w-5 h-5 text-gray-500" />
    </motion.button>
  )
}
