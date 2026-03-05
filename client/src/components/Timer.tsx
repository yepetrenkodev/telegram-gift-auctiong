import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTimerStore } from '../store'

interface TimerProps {
  auctionId: string
  endTime: Date
  onEnd?: () => void
  size?: 'sm' | 'md' | 'lg'
  showMilliseconds?: boolean
}

export function Timer({ auctionId, endTime, onEnd, size = 'md', showMilliseconds = false }: TimerProps) {
  const storedTime = useTimerStore((s) => s.timers[auctionId])
  const setTimer = useTimerStore((s) => s.setTimer)
  const [localTime, setLocalTime] = useState(() => {
    const diff = new Date(endTime).getTime() - Date.now()
    return Math.max(0, Math.floor(diff / 1000))
  })

  // Use server time if available, otherwise local
  const timeRemaining = storedTime ?? localTime

  // Local countdown
  useEffect(() => {
    if (storedTime !== undefined) return // Use server time

    const timer = setInterval(() => {
      const diff = new Date(endTime).getTime() - Date.now()
      const seconds = Math.max(0, Math.floor(diff / 1000))
      setLocalTime(seconds)
      
      if (seconds === 0) {
        onEnd?.()
        clearInterval(timer)
      }
    }, 100)

    return () => clearInterval(timer)
  }, [endTime, storedTime, onEnd])

  // Format time
  const { hours, minutes, seconds, isUrgent, isEnded } = useMemo(() => {
    const h = Math.floor(timeRemaining / 3600)
    const m = Math.floor((timeRemaining % 3600) / 60)
    const s = timeRemaining % 60
    
    return {
      hours: h,
      minutes: m,
      seconds: s,
      isUrgent: timeRemaining > 0 && timeRemaining <= 60,
      isEnded: timeRemaining === 0
    }
  }, [timeRemaining])

  const sizeClasses = {
    sm: 'text-sm gap-1',
    md: 'text-xl gap-2',
    lg: 'text-3xl gap-3',
  }

  const digitSizeClasses = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-12 h-12 text-xl',
    lg: 'w-16 h-16 text-3xl',
  }

  if (isEnded) {
    return (
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="text-red-500 font-bold text-center"
      >
        <span className={sizeClasses[size]}>ЗАВЕРШЕН</span>
      </motion.div>
    )
  }

  return (
    <div className={`flex items-center justify-center ${sizeClasses[size]}`}>
      {hours > 0 && (
        <>
          <TimerDigit value={hours} size={size} isUrgent={isUrgent} />
          <span className="text-gray-500 font-bold">:</span>
        </>
      )}
      <TimerDigit value={minutes} size={size} isUrgent={isUrgent} />
      <span className={`font-bold ${isUrgent ? 'text-red-500 animate-pulse' : 'text-gray-500'}`}>:</span>
      <TimerDigit value={seconds} size={size} isUrgent={isUrgent} />
    </div>
  )
}

function TimerDigit({ value, size, isUrgent }: { value: number; size: 'sm' | 'md' | 'lg'; isUrgent: boolean }) {
  const digitSizeClasses = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-12 h-12 text-lg',
    lg: 'w-16 h-16 text-2xl',
  }

  return (
    <motion.div
      key={value}
      initial={{ y: -10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className={`
        ${digitSizeClasses[size]}
        flex items-center justify-center
        rounded-xl font-mono font-bold
        ${isUrgent 
          ? 'bg-red-500/20 text-red-400 ring-2 ring-red-500/50' 
          : 'bg-white/5 text-white'}
        backdrop-blur-sm
        transition-colors duration-300
      `}
    >
      {value.toString().padStart(2, '0')}
    </motion.div>
  )
}

// Compact inline timer
export function InlineTimer({ auctionId, endTime }: { auctionId: string; endTime: Date }) {
  const storedTime = useTimerStore((s) => s.timers[auctionId])
  const [localTime, setLocalTime] = useState(() => {
    const diff = new Date(endTime).getTime() - Date.now()
    return Math.max(0, Math.floor(diff / 1000))
  })

  const timeRemaining = storedTime ?? localTime

  useEffect(() => {
    if (storedTime !== undefined) return

    const timer = setInterval(() => {
      const diff = new Date(endTime).getTime() - Date.now()
      setLocalTime(Math.max(0, Math.floor(diff / 1000)))
    }, 1000)

    return () => clearInterval(timer)
  }, [endTime, storedTime])

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60

    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    }
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const isUrgent = timeRemaining > 0 && timeRemaining <= 60

  if (timeRemaining === 0) {
    return <span className="text-red-500 font-medium">Завершен</span>
  }

  return (
    <span className={`font-mono font-semibold ${isUrgent ? 'text-red-400 animate-pulse' : 'text-white'}`}>
      {formatTime(timeRemaining)}
    </span>
  )
}
