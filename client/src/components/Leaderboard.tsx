import { motion } from 'framer-motion'
import { Crown, Medal, Award, TrendingUp, Star, Sparkles } from 'lucide-react'
import type { LeaderboardEntry } from '../store'

interface LeaderboardProps {
  entries: LeaderboardEntry[]
  isLoading?: boolean
  type?: 'daily' | 'weekly' | 'alltime'
}

export function Leaderboard({ entries, isLoading = false, type = 'daily' }: LeaderboardProps) {
  if (isLoading) {
    return <LeaderboardSkeleton />
  }

  if (entries.length === 0) {
    return (
      <div className="premium-card p-10 text-center">
        <div 
          className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(139, 92, 246, 0.05) 100%)',
            border: '1px solid rgba(139, 92, 246, 0.3)'
          }}
        >
          <TrendingUp className="w-8 h-8 text-purple-400" />
        </div>
        <p className="text-gray-400 font-medium">Пока нет данных</p>
        <p className="text-gray-600 text-sm mt-1">Участвуйте в аукционах!</p>
      </div>
    )
  }

  // Split top 3 and rest
  const topThree = entries.slice(0, 3)
  const rest = entries.slice(3)

  return (
    <div className="space-y-5">
      {/* Premium Podium */}
      <div className="flex items-end justify-center gap-3 px-4 py-6">
        {/* 2nd place */}
        {topThree[1] && (
          <PodiumPlace entry={topThree[1]} position={2} />
        )}
        
        {/* 1st place */}
        {topThree[0] && (
          <PodiumPlace entry={topThree[0]} position={1} />
        )}
        
        {/* 3rd place */}
        {topThree[2] && (
          <PodiumPlace entry={topThree[2]} position={3} />
        )}
      </div>

      {/* Rest of list */}
      <div className="space-y-2">
        {rest.map((entry, index) => (
          <LeaderboardRow key={entry.id} entry={entry} position={index + 4} />
        ))}
      </div>
    </div>
  )
}

function PodiumPlace({ entry, position }: { entry: LeaderboardEntry; position: 1 | 2 | 3 }) {
  const icons = [Crown, Medal, Award]
  const Icon = icons[position - 1]
  const heights = ['h-28', 'h-22', 'h-18']
  const widths = ['w-28', 'w-24', 'w-24']
  const orders = ['order-2', 'order-1', 'order-3']
  
  const podiumStyles = [
    { bg: 'linear-gradient(180deg, rgba(212, 175, 55, 0.3) 0%, rgba(212, 175, 55, 0.1) 100%)', border: 'rgba(212, 175, 55, 0.4)', glow: 'rgba(212, 175, 55, 0.3)' },
    { bg: 'linear-gradient(180deg, rgba(192, 192, 192, 0.25) 0%, rgba(192, 192, 192, 0.08) 100%)', border: 'rgba(192, 192, 192, 0.3)', glow: 'rgba(192, 192, 192, 0.2)' },
    { bg: 'linear-gradient(180deg, rgba(205, 127, 50, 0.25) 0%, rgba(205, 127, 50, 0.08) 100%)', border: 'rgba(205, 127, 50, 0.3)', glow: 'rgba(205, 127, 50, 0.2)' },
  ]
  
  const avatarRingStyles = [
    { border: '3px solid #d4af37', shadow: '0 0 20px rgba(212, 175, 55, 0.4)' },
    { border: '2px solid #c0c0c0', shadow: '0 0 15px rgba(192, 192, 192, 0.3)' },
    { border: '2px solid #cd7f32', shadow: '0 0 15px rgba(205, 127, 50, 0.3)' },
  ]

  const style = podiumStyles[position - 1]
  const avatarStyle = avatarRingStyles[position - 1]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: position * 0.1 }}
      className={`flex flex-col items-center ${orders[position - 1]}`}
    >
      {/* Avatar */}
      <motion.div
        animate={position === 1 ? { 
          boxShadow: ['0 0 20px rgba(212, 175, 55, 0.3)', '0 0 35px rgba(212, 175, 55, 0.5)', '0 0 20px rgba(212, 175, 55, 0.3)']
        } : {}}
        transition={{ duration: 2, repeat: Infinity }}
        className="relative mb-3"
      >
        <div 
          className={`${position === 1 ? 'w-18 h-18' : 'w-14 h-14'} rounded-full overflow-hidden`}
          style={{ 
            ...avatarStyle,
            width: position === 1 ? '72px' : '56px',
            height: position === 1 ? '72px' : '56px',
          }}
        >
          {entry.photoUrl ? (
            <img src={entry.photoUrl} alt={entry.name} className="w-full h-full object-cover" />
          ) : (
            <div 
              className="w-full h-full flex items-center justify-center text-white font-bold text-xl"
              style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)' }}
            >
              {entry.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        
        {/* Rank icon badge */}
        <motion.div 
          animate={position === 1 ? { scale: [1, 1.1, 1] } : {}}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center"
          style={{
            background: position === 1 
              ? 'linear-gradient(135deg, #d4af37 0%, #f5d063 100%)' 
              : position === 2 
              ? 'linear-gradient(135deg, #c0c0c0 0%, #e8e8e8 100%)'
              : 'linear-gradient(135deg, #cd7f32 0%, #e6a44e 100%)',
            boxShadow: `0 0 10px ${style.glow}`
          }}
        >
          <Icon className={`w-4 h-4 ${position === 1 ? 'text-yellow-900' : position === 2 ? 'text-gray-700' : 'text-orange-900'}`} />
        </motion.div>

        {/* Crown decoration for 1st place */}
        {position === 1 && (
          <motion.div 
            animate={{ y: [0, -3, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute -top-3 left-1/2 -translate-x-1/2"
          >
            <Sparkles className="w-4 h-4 text-yellow-400" />
          </motion.div>
        )}
      </motion.div>

      {/* Name */}
      <span className={`text-sm font-semibold truncate max-w-full ${entry.isCurrentUser ? 'text-purple-400' : 'text-white'}`}>
        {entry.name}
      </span>

      {/* Score */}
      <div className="flex items-center gap-1 text-xs mt-1">
        <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
        <span className="text-yellow-400 font-bold">{entry.score.toLocaleString()}</span>
      </div>

      {/* Premium Podium */}
      <div 
        className={`${widths[position - 1]} mt-3 rounded-t-2xl flex items-center justify-center text-2xl font-bold`}
        style={{
          height: position === 1 ? '96px' : position === 2 ? '80px' : '64px',
          background: style.bg,
          border: `1px solid ${style.border}`,
          borderBottom: 'none',
          color: position === 1 ? '#d4af37' : position === 2 ? '#c0c0c0' : '#cd7f32',
          textShadow: `0 0 10px ${style.glow}`
        }}
      >
        #{position}
      </div>
    </motion.div>
  )
}

function LeaderboardRow({ entry, position }: { entry: LeaderboardEntry; position: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: position * 0.02 }}
      className="premium-card p-3.5 flex items-center gap-3"
      style={entry.isCurrentUser ? {
        borderColor: 'rgba(139, 92, 246, 0.3)',
        boxShadow: '0 0 20px rgba(139, 92, 246, 0.1)'
      } : {}}
    >
      {/* Position */}
      <div 
        className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold"
        style={{
          background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          color: '#9ca3af'
        }}
      >
        {position}
      </div>

      {/* Avatar */}
      <div 
        className="w-11 h-11 rounded-xl overflow-hidden"
        style={{ border: '1px solid rgba(255, 255, 255, 0.1)' }}
      >
        {entry.photoUrl ? (
          <img src={entry.photoUrl} alt={entry.name} className="w-full h-full object-cover" />
        ) : (
          <div 
            className="w-full h-full flex items-center justify-center text-white font-bold"
            style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)' }}
          >
            {entry.name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      {/* Name */}
      <div className="flex-1 min-w-0">
        <span className={`font-medium truncate block ${entry.isCurrentUser ? 'text-purple-400' : 'text-white'}`}>
          {entry.name}
          {entry.isCurrentUser && <span className="text-xs text-purple-400/70 ml-1.5">(вы)</span>}
        </span>
      </div>

      {/* Score */}
      <div 
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
        style={{
          background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.15) 0%, rgba(212, 175, 55, 0.05) 100%)',
          border: '1px solid rgba(212, 175, 55, 0.2)'
        }}
      >
        <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
        <span className="text-yellow-400 font-bold">{entry.score.toLocaleString()}</span>
      </div>
    </motion.div>
  )
}

function LeaderboardSkeleton() {
  return (
    <div className="space-y-5">
      {/* Podium skeleton */}
      <div className="flex items-end justify-center gap-3 px-4 py-6">
        <div className="flex flex-col items-center order-1">
          <div className="w-14 h-14 rounded-full skeleton" />
          <div className="w-24 h-20 mt-3 rounded-t-2xl skeleton" />
        </div>
        <div className="flex flex-col items-center order-2">
          <div className="w-18 h-18 rounded-full skeleton" style={{ width: '72px', height: '72px' }} />
          <div className="w-28 h-24 mt-3 rounded-t-2xl skeleton" />
        </div>
        <div className="flex flex-col items-center order-3">
          <div className="w-14 h-14 rounded-full skeleton" />
          <div className="w-24 h-16 mt-3 rounded-t-2xl skeleton" />
        </div>
      </div>

      {/* List skeleton */}
      {[...Array(5)].map((_, i) => (
        <div key={i} className="premium-card p-3.5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl skeleton" />
          <div className="w-11 h-11 rounded-xl skeleton" />
          <div className="flex-1 h-5 skeleton rounded-lg" />
          <div className="w-20 h-8 skeleton rounded-lg" />
        </div>
      ))}
    </div>
  )
}
