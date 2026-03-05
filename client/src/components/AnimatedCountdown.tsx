import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Clock, Zap, AlertTriangle } from 'lucide-react'

interface AnimatedCountdownProps {
  endTime: Date | string
  onComplete?: () => void
  size?: 'sm' | 'md' | 'lg'
  showIcon?: boolean
  variant?: 'default' | 'urgent' | 'minimal'
}

interface TimeLeft {
  days: number
  hours: number
  minutes: number
  seconds: number
  total: number
}

function calculateTimeLeft(endTime: Date | string): TimeLeft {
  const end = new Date(endTime).getTime()
  const now = Date.now()
  const total = Math.max(0, end - now)
  
  return {
    days: Math.floor(total / (1000 * 60 * 60 * 24)),
    hours: Math.floor((total % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    minutes: Math.floor((total % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((total % (1000 * 60)) / 1000),
    total,
  }
}

function FlipDigit({ value, prevValue }: { value: number; prevValue: number }) {
  const hasChanged = value !== prevValue

  return (
    <div className="relative overflow-hidden w-7 h-8 bg-black/30 rounded">
      <AnimatePresence mode="popLayout">
        <motion.span
          key={value}
          initial={hasChanged ? { y: -30, opacity: 0 } : false}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 30, opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="absolute inset-0 flex items-center justify-center font-mono font-bold text-white"
        >
          {value.toString().padStart(2, '0')}
        </motion.span>
      </AnimatePresence>
    </div>
  )
}

export function AnimatedCountdown({
  endTime,
  onComplete,
  size = 'md',
  showIcon = true,
  variant = 'default',
}: AnimatedCountdownProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(() => calculateTimeLeft(endTime))
  const prevTimeRef = useRef<TimeLeft>(timeLeft)
  const completedRef = useRef(false)

  useEffect(() => {
    const timer = setInterval(() => {
      const newTimeLeft = calculateTimeLeft(endTime)
      prevTimeRef.current = timeLeft
      setTimeLeft(newTimeLeft)

      if (newTimeLeft.total <= 0 && !completedRef.current) {
        completedRef.current = true
        onComplete?.()
        clearInterval(timer)
      }
    }, 1000)

    return () => clearInterval(timer)
  }, [endTime, onComplete, timeLeft])

  const isUrgent = timeLeft.total < 5 * 60 * 1000 // Less than 5 minutes
  const isCritical = timeLeft.total < 60 * 1000 // Less than 1 minute
  const isEnded = timeLeft.total <= 0

  // Size classes
  const sizeClasses = {
    sm: 'text-xs gap-1',
    md: 'text-sm gap-1.5',
    lg: 'text-base gap-2',
  }

  // Variant styles
  const getVariantStyles = () => {
    if (isEnded) return 'text-gray-500'
    if (isCritical) return 'text-red-400'
    if (isUrgent) return 'text-orange-400'
    return variant === 'urgent' ? 'text-orange-400' : 'text-gray-400'
  }

  if (variant === 'minimal') {
    return (
      <motion.div
        className={`flex items-center ${sizeClasses[size]} ${getVariantStyles()}`}
        animate={isCritical ? { scale: [1, 1.05, 1] } : {}}
        transition={{ repeat: Infinity, duration: 0.5 }}
      >
        {showIcon && (
          <motion.div animate={isUrgent ? { rotate: [0, -10, 10, 0] } : {}} transition={{ repeat: Infinity, duration: 0.5 }}>
            {isCritical ? <AlertTriangle className="w-3 h-3" /> : isUrgent ? <Zap className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
          </motion.div>
        )}
        <span className="font-mono">
          {isEnded ? 'Завершён' : timeLeft.days > 0
            ? `${timeLeft.days}д ${timeLeft.hours}ч`
            : timeLeft.hours > 0
              ? `${timeLeft.hours}:${timeLeft.minutes.toString().padStart(2, '0')}:${timeLeft.seconds.toString().padStart(2, '0')}`
              : `${timeLeft.minutes}:${timeLeft.seconds.toString().padStart(2, '0')}`
          }
        </span>
      </motion.div>
    )
  }

  if (isEnded) {
    return (
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gray-500/20 text-gray-400"
      >
        <Clock className="w-4 h-4" />
        <span className="font-medium">Аукцион завершён</span>
      </motion.div>
    )
  }

  return (
    <motion.div
      className={`
        flex items-center ${sizeClasses[size]} px-3 py-2 rounded-xl
        ${isCritical 
          ? 'bg-red-500/20 border border-red-500/30' 
          : isUrgent 
            ? 'bg-orange-500/20 border border-orange-500/30' 
            : 'bg-white/5 border border-white/10'
        }
      `}
      animate={isCritical ? { 
        boxShadow: ['0 0 0 0 rgba(239,68,68,0)', '0 0 0 4px rgba(239,68,68,0.3)', '0 0 0 0 rgba(239,68,68,0)']
      } : {}}
      transition={{ repeat: Infinity, duration: 1 }}
    >
      {showIcon && (
        <motion.div
          animate={isUrgent ? { rotate: [0, -15, 15, 0] } : {}}
          transition={{ repeat: Infinity, duration: 0.4 }}
          className={isCritical ? 'text-red-400' : isUrgent ? 'text-orange-400' : 'text-gray-400'}
        >
          {isCritical ? <AlertTriangle className="w-4 h-4" /> : isUrgent ? <Zap className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
        </motion.div>
      )}
      
      <div className="flex items-center gap-1">
        {timeLeft.days > 0 && (
          <>
            <FlipDigit value={timeLeft.days} prevValue={prevTimeRef.current.days} />
            <span className={getVariantStyles()}>д</span>
          </>
        )}
        
        <FlipDigit value={timeLeft.hours} prevValue={prevTimeRef.current.hours} />
        <span className={`${getVariantStyles()} font-bold`}>:</span>
        <FlipDigit value={timeLeft.minutes} prevValue={prevTimeRef.current.minutes} />
        <span className={`${getVariantStyles()} font-bold`}>:</span>
        <FlipDigit value={timeLeft.seconds} prevValue={prevTimeRef.current.seconds} />
      </div>

      {isCritical && (
        <motion.span
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="text-red-400 text-xs font-medium ml-1"
        >
          Скоро конец!
        </motion.span>
      )}
    </motion.div>
  )
}

// Simple inline countdown for cards
export function InlineCountdown({ endTime, className = '' }: { endTime: Date | string; className?: string }) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(() => calculateTimeLeft(endTime))

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft(endTime))
    }, 1000)
    return () => clearInterval(timer)
  }, [endTime])

  const isUrgent = timeLeft.total < 5 * 60 * 1000
  const isCritical = timeLeft.total < 60 * 1000
  const isEnded = timeLeft.total <= 0

  const formatTime = () => {
    if (isEnded) return 'Завершён'
    if (timeLeft.days > 0) return `${timeLeft.days}д ${timeLeft.hours}ч`
    if (timeLeft.hours > 0) return `${timeLeft.hours}:${timeLeft.minutes.toString().padStart(2, '0')}:${timeLeft.seconds.toString().padStart(2, '0')}`
    return `${timeLeft.minutes}:${timeLeft.seconds.toString().padStart(2, '0')}`
  }

  return (
    <motion.span
      className={`
        font-mono
        ${isEnded ? 'text-gray-500' : isCritical ? 'text-red-400' : isUrgent ? 'text-orange-400' : 'text-gray-400'}
        ${className}
      `}
      animate={isCritical ? { opacity: [1, 0.5, 1] } : {}}
      transition={{ repeat: Infinity, duration: 0.5 }}
    >
      {formatTime()}
    </motion.span>
  )
}

export default AnimatedCountdown
