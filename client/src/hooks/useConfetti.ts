import { useCallback, useRef } from 'react'
import confetti from 'canvas-confetti'

interface ConfettiOptions {
  particleCount?: number
  spread?: number
  origin?: { x: number; y: number }
  colors?: string[]
  duration?: number
}

export function useConfetti() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  // Basic confetti burst
  const fire = useCallback((options: ConfettiOptions = {}) => {
    const defaults = {
      particleCount: 100,
      spread: 70,
      origin: { x: 0.5, y: 0.6 },
      colors: ['#a855f7', '#ec4899', '#f97316', '#eab308', '#22c55e'],
      ...options,
    }

    confetti({
      ...defaults,
      disableForReducedMotion: true,
    })
  }, [])

  // Winner celebration - big burst with multiple waves
  const celebrate = useCallback(() => {
    const duration = 3000
    const animationEnd = Date.now() + duration
    const defaults = { 
      startVelocity: 30, 
      spread: 360, 
      ticks: 60, 
      zIndex: 9999,
      colors: ['#a855f7', '#ec4899', '#f97316', '#eab308', '#22c55e', '#3b82f6'],
    }

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min
    }

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now()

      if (timeLeft <= 0) {
        return clearInterval(interval)
      }

      const particleCount = 50 * (timeLeft / duration)

      // Burst from both sides
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
      })
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
      })
    }, 250)

    // Initial big burst from center
    confetti({
      particleCount: 150,
      spread: 100,
      origin: { x: 0.5, y: 0.5 },
      colors: ['#ffd700', '#ffec8b', '#fff8dc'],
      startVelocity: 45,
      gravity: 0.8,
      scalar: 1.2,
    })
  }, [])

  // Stars effect for legendary wins
  const starBurst = useCallback(() => {
    const defaults = {
      spread: 360,
      ticks: 100,
      gravity: 0,
      decay: 0.94,
      startVelocity: 30,
      colors: ['#ffd700', '#fff', '#ffd700'],
      shapes: ['circle'] as ('circle' | 'square')[],
      scalar: 1.5,
    }

    function shoot() {
      confetti({
        ...defaults,
        particleCount: 30,
        origin: { x: Math.random(), y: Math.random() * 0.5 },
      })
    }

    setTimeout(shoot, 0)
    setTimeout(shoot, 100)
    setTimeout(shoot, 200)
    setTimeout(shoot, 300)
  }, [])

  // Side cannons
  const sideCannons = useCallback(() => {
    const end = Date.now() + 1000

    const colors = ['#a855f7', '#ec4899', '#f97316']
    
    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.6 },
        colors,
      })
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.6 },
        colors,
      })

      if (Date.now() < end) {
        requestAnimationFrame(frame)
      }
    }

    frame()
  }, [])

  // Emoji rain (custom shapes simulation with emojis)
  const emojiRain = useCallback((emoji: string = '🎁') => {
    // Using standard confetti with custom styling
    const scalar = 2
    const defaults = {
      spread: 180,
      startVelocity: 25,
      decay: 0.92,
      gravity: 1.2,
      ticks: 150,
      origin: { x: 0.5, y: 0 },
      scalar,
    }

    // Multiple bursts
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        confetti({
          ...defaults,
          particleCount: 20 + i * 10,
          origin: { x: 0.2 + i * 0.3, y: 0 },
        })
      }, i * 200)
    }
  }, [])

  // Fireworks effect
  const fireworks = useCallback(() => {
    const duration = 5000
    const animationEnd = Date.now() + duration
    const colors = ['#a855f7', '#ec4899', '#f97316', '#22c55e', '#3b82f6', '#eab308']

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now()

      if (timeLeft <= 0) {
        return clearInterval(interval)
      }

      // Random position
      const x = Math.random()
      const y = Math.random() * 0.5

      confetti({
        particleCount: 50 + Math.random() * 50,
        spread: 60 + Math.random() * 60,
        origin: { x, y },
        colors: [colors[Math.floor(Math.random() * colors.length)]],
        startVelocity: 30 + Math.random() * 20,
        gravity: 0.8,
        scalar: 0.8 + Math.random() * 0.4,
      })
    }, 300)
  }, [])

  return {
    fire,
    celebrate,
    starBurst,
    sideCannons,
    emojiRain,
    fireworks,
    canvasRef,
  }
}

// Pre-made celebration for different events
export function useAuctionCelebration() {
  const { celebrate, starBurst, sideCannons, fireworks } = useConfetti()

  const onWin = useCallback((isLegendary: boolean = false) => {
    if (isLegendary) {
      // Epic celebration for legendary wins
      starBurst()
      setTimeout(() => celebrate(), 500)
      setTimeout(() => fireworks(), 1000)
    } else {
      // Standard win celebration
      celebrate()
      setTimeout(() => sideCannons(), 1500)
    }
  }, [celebrate, starBurst, sideCannons, fireworks])

  const onBidSuccess = useCallback(() => {
    // Small celebration for successful bid
    confetti({
      particleCount: 30,
      spread: 50,
      origin: { x: 0.5, y: 0.8 },
      colors: ['#a855f7', '#ec4899'],
      startVelocity: 20,
      gravity: 1.2,
    })
  }, [])

  const onOutbid = useCallback(() => {
    // Subtle effect when outbid (optional)
    confetti({
      particleCount: 10,
      spread: 30,
      origin: { x: 0.5, y: 0.5 },
      colors: ['#ef4444'],
      startVelocity: 10,
      gravity: 1.5,
      scalar: 0.5,
    })
  }, [])

  return {
    onWin,
    onBidSuccess,
    onOutbid,
  }
}

export default useConfetti
