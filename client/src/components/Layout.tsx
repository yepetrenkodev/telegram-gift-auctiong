import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Home, Gavel, Trophy, User, Wallet, Star, Crown } from 'lucide-react'
import { useTelegram } from '../hooks'
import { useNotificationStore, useUserStore } from '../store'
import { Notifications } from './Notifications'

const navItems = [
  { path: '/', icon: Home, label: 'Главная' },
  { path: '/auctions', icon: Gavel, label: 'Аукционы' },
  { path: '/leaderboard', icon: Trophy, label: 'Топ' },
  { path: '/wallet', icon: Wallet, label: 'Кошелек' },
  { path: '/profile', icon: User, label: 'Профиль' },
]

export function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { colorScheme } = useTelegram()
  const unreadCount = useNotificationStore((s) => s.unreadCount)
  const user = useUserStore((s) => s.user)

  return (
    <div className={`min-h-screen ${colorScheme}`} style={{ background: 'var(--bg-primary)' }}>
      {/* Premium animated background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {/* Gold accent glow */}
        <motion.div 
          animate={{ 
            opacity: [0.15, 0.25, 0.15],
            scale: [1, 1.1, 1]
          }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -top-40 -right-40 w-96 h-96 rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(212, 175, 55, 0.3) 0%, transparent 70%)' }}
        />
        {/* Purple accent glow */}
        <motion.div 
          animate={{ 
            opacity: [0.1, 0.2, 0.1],
            scale: [1, 1.15, 1]
          }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
          className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(139, 92, 246, 0.3) 0%, transparent 70%)' }}
        />
        {/* Center glow */}
        <motion.div 
          animate={{ 
            opacity: [0.05, 0.1, 0.05]
          }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, transparent 70%)' }}
        />
      </div>

      {/* Premium Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl border-b" style={{ background: 'rgba(7, 7, 10, 0.85)', borderColor: 'rgba(255, 255, 255, 0.06)' }}>
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2.5"
          >
            <div 
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ 
                background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.2) 0%, rgba(139, 92, 246, 0.2) 100%)',
                border: '1px solid rgba(212, 175, 55, 0.3)'
              }}
            >
              <span className="text-lg">🎁</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-white text-lg">Gift</span>
              <span className="font-bold text-lg text-gradient-gold">Auction</span>
            </div>
          </motion.div>

          {/* Premium Balance Button */}
          <motion.button
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/wallet')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl transition-all"
            style={{ 
              background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.15) 0%, rgba(212, 175, 55, 0.05) 100%)',
              border: '1px solid rgba(212, 175, 55, 0.3)',
              boxShadow: '0 0 20px rgba(212, 175, 55, 0.1)'
            }}
          >
            <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
            <motion.span 
              key={user?.balance}
              initial={{ scale: 1.3, color: '#fde047' }}
              animate={{ scale: 1, color: '#facc15' }}
              className="font-bold text-sm"
            >
              {user?.balance?.toLocaleString() || '0'}
            </motion.span>
          </motion.button>
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 max-w-lg mx-auto px-4 pb-24 pt-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Premium Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bottom-nav">
        <div className="max-w-lg mx-auto px-2">
          <div className="flex items-center justify-around py-2">
            {navItems.map(({ path, icon: Icon, label }) => (
              <NavLink
                key={path}
                to={path}
                className={({ isActive }) => `
                  nav-item relative flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all
                  ${isActive
                    ? 'text-yellow-400'
                    : 'text-gray-500 hover:text-gray-300'}
                `}
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <motion.div
                        layoutId="nav-indicator"
                        className="absolute inset-0 rounded-xl"
                        style={{
                          background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.15) 0%, rgba(139, 92, 246, 0.1) 100%)',
                          border: '1px solid rgba(212, 175, 55, 0.2)'
                        }}
                        transition={{ type: 'spring', duration: 0.5 }}
                      />
                    )}
                    <motion.div
                      animate={isActive ? { scale: [1, 1.1, 1] } : {}}
                      transition={{ duration: 0.3 }}
                    >
                      <Icon className="w-5 h-5 relative z-10" />
                    </motion.div>
                    <span className="text-[10px] font-medium relative z-10">{label}</span>
                    {isActive && (
                      <motion.div
                        layoutId="nav-dot"
                        className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-yellow-400"
                        style={{ boxShadow: '0 0 8px rgba(212, 175, 55, 0.6)' }}
                      />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </div>

        {/* Safe area for iOS */}
        <div className="h-safe-area-inset-bottom" style={{ background: 'rgba(7, 7, 10, 0.98)' }} />
      </nav>

      {/* Notifications Toast */}
      <Notifications />
    </div>
  )
}
