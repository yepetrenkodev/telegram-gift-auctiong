import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, CheckCircle, XCircle, Info, AlertTriangle, Gavel, Trophy, Star } from 'lucide-react'
import { useNotificationStore, type Notification } from '../store'

const icons = {
  success: CheckCircle,
  error: XCircle,
  info: Info,
  warning: AlertTriangle,
  bid: Gavel,
  win: Trophy,
}

const colorStyles = {
  success: { 
    gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    glow: 'rgba(16, 185, 129, 0.3)',
    border: 'rgba(16, 185, 129, 0.3)'
  },
  error: { 
    gradient: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
    glow: 'rgba(239, 68, 68, 0.3)',
    border: 'rgba(239, 68, 68, 0.3)'
  },
  info: { 
    gradient: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
    glow: 'rgba(59, 130, 246, 0.3)',
    border: 'rgba(59, 130, 246, 0.3)'
  },
  warning: { 
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    glow: 'rgba(245, 158, 11, 0.3)',
    border: 'rgba(245, 158, 11, 0.3)'
  },
  bid: { 
    gradient: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
    glow: 'rgba(139, 92, 246, 0.3)',
    border: 'rgba(139, 92, 246, 0.3)'
  },
  win: { 
    gradient: 'linear-gradient(135deg, #d4af37 0%, #f5d063 100%)',
    glow: 'rgba(212, 175, 55, 0.4)',
    border: 'rgba(212, 175, 55, 0.4)'
  },
}

function NotificationItem({ notification, onClose }: { notification: Notification; onClose: () => void }) {
  const Icon = icons[notification.type]
  const style = colorStyles[notification.type]

  useEffect(() => {
    const timer = setTimeout(() => {
      onClose()
    }, 5000)
    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 100, scale: 0.8 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.8 }}
      className="relative overflow-hidden rounded-2xl backdrop-blur-xl"
      style={{
        background: 'linear-gradient(135deg, rgba(22, 22, 29, 0.95) 0%, rgba(13, 13, 18, 0.95) 100%)',
        border: `1px solid ${style.border}`,
        boxShadow: `0 20px 40px rgba(0, 0, 0, 0.5), 0 0 30px ${style.glow}`
      }}
    >
      {/* Gradient accent line */}
      <div 
        className="absolute left-0 top-0 bottom-0 w-1"
        style={{ background: style.gradient }}
      />
      
      <div className="flex items-start gap-3 p-4 pl-5">
        <motion.div 
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', delay: 0.1 }}
          className="p-2.5 rounded-xl"
          style={{ 
            background: style.gradient,
            boxShadow: `0 0 20px ${style.glow}`
          }}
        >
          <Icon className={`w-5 h-5 ${notification.type === 'win' ? 'text-yellow-900' : 'text-white'}`} />
        </motion.div>
        
        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-white text-sm">{notification.title}</h4>
          <p className="text-gray-400 text-xs mt-1 line-clamp-2">{notification.message}</p>
        </div>
        
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
        >
          <X className="w-4 h-4 text-gray-500 hover:text-gray-300" />
        </button>
      </div>
      
      {/* Progress bar */}
      <motion.div 
        className="h-[2px]"
        style={{ background: style.gradient }}
        initial={{ width: '100%' }}
        animate={{ width: '0%' }}
        transition={{ duration: 5, ease: 'linear' }}
      />
    </motion.div>
  )
}

export function Notifications() {
  const { notifications, removeNotification } = useNotificationStore()
  
  const visibleNotifications = notifications.filter(n => !n.read).slice(0, 3)

  return (
    <div className="fixed top-20 right-4 z-[100] flex flex-col gap-3 max-w-[340px] pointer-events-none">
      <AnimatePresence mode="popLayout">
        {visibleNotifications.map((notification) => (
          <div key={notification.id} className="pointer-events-auto">
            <NotificationItem
              notification={notification}
              onClose={() => removeNotification(notification.id)}
            />
          </div>
        ))}
      </AnimatePresence>
    </div>
  )
}
