import { useCallback, useRef, useState } from 'react'

// Sound URLs - using free sound effects
const SOUNDS = {
  bid: '/sounds/bid.mp3',
  bidSuccess: '/sounds/bid-success.mp3',
  outbid: '/sounds/outbid.mp3',
  win: '/sounds/win.mp3',
  countdown: '/sounds/countdown.mp3',
  click: '/sounds/click.mp3',
  notification: '/sounds/notification.mp3',
}

type SoundType = keyof typeof SOUNDS

// Simple Audio Manager
class AudioManager {
  private audioCache: Map<string, HTMLAudioElement> = new Map()
  private enabled: boolean = true
  private volume: number = 0.5

  constructor() {
    // Check localStorage for preferences
    if (typeof window !== 'undefined') {
      const savedEnabled = localStorage.getItem('sounds_enabled')
      const savedVolume = localStorage.getItem('sounds_volume')
      
      this.enabled = savedEnabled !== 'false'
      this.volume = savedVolume ? parseFloat(savedVolume) : 0.5
    }
  }

  private getAudio(url: string): HTMLAudioElement {
    if (!this.audioCache.has(url)) {
      const audio = new Audio(url)
      audio.preload = 'auto'
      this.audioCache.set(url, audio)
    }
    return this.audioCache.get(url)!
  }

  play(type: SoundType) {
    if (!this.enabled) return

    try {
      const url = SOUNDS[type]
      const audio = this.getAudio(url)
      audio.volume = this.volume
      audio.currentTime = 0
      audio.play().catch(() => {
        // Ignore autoplay errors
      })
    } catch (e) {
      console.warn('Could not play sound:', e)
    }
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled
    localStorage.setItem('sounds_enabled', String(enabled))
  }

  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume))
    localStorage.setItem('sounds_volume', String(this.volume))
  }

  isEnabled() {
    return this.enabled
  }

  getVolume() {
    return this.volume
  }

  // Preload all sounds
  preload() {
    Object.values(SOUNDS).forEach(url => {
      this.getAudio(url)
    })
  }
}

// Singleton instance
let audioManager: AudioManager | null = null

function getAudioManager(): AudioManager {
  if (!audioManager) {
    audioManager = new AudioManager()
  }
  return audioManager
}

// React hook
export function useSounds() {
  const manager = useRef(getAudioManager())
  const [enabled, setEnabledState] = useState(manager.current.isEnabled())
  const [volume, setVolumeState] = useState(manager.current.getVolume())

  const play = useCallback((type: SoundType) => {
    manager.current.play(type)
  }, [])

  const setEnabled = useCallback((value: boolean) => {
    manager.current.setEnabled(value)
    setEnabledState(value)
  }, [])

  const setVolume = useCallback((value: number) => {
    manager.current.setVolume(value)
    setVolumeState(value)
  }, [])

  const toggle = useCallback(() => {
    const newValue = !manager.current.isEnabled()
    setEnabled(newValue)
    return newValue
  }, [setEnabled])

  // Preload sounds on mount
  const preload = useCallback(() => {
    manager.current.preload()
  }, [])

  // Specific sound helpers
  const playBid = useCallback(() => play('bid'), [play])
  const playBidSuccess = useCallback(() => play('bidSuccess'), [play])
  const playOutbid = useCallback(() => play('outbid'), [play])
  const playWin = useCallback(() => play('win'), [play])
  const playCountdown = useCallback(() => play('countdown'), [play])
  const playClick = useCallback(() => play('click'), [play])
  const playNotification = useCallback(() => play('notification'), [play])

  return {
    play,
    enabled,
    setEnabled,
    volume,
    setVolume,
    toggle,
    preload,
    // Shortcuts
    playBid,
    playBidSuccess,
    playOutbid,
    playWin,
    playCountdown,
    playClick,
    playNotification,
  }
}

// Generate placeholder sounds (Web Audio API fallback)
export function generateSound(type: 'success' | 'error' | 'click' | 'notification') {
  if (typeof window === 'undefined' || !window.AudioContext) return

  try {
    const ctx = new AudioContext()
    const oscillator = ctx.createOscillator()
    const gainNode = ctx.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(ctx.destination)

    const now = ctx.currentTime

    switch (type) {
      case 'success':
        oscillator.frequency.setValueAtTime(523.25, now) // C5
        oscillator.frequency.setValueAtTime(659.25, now + 0.1) // E5
        oscillator.frequency.setValueAtTime(783.99, now + 0.2) // G5
        gainNode.gain.setValueAtTime(0.3, now)
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.4)
        oscillator.start(now)
        oscillator.stop(now + 0.4)
        break

      case 'error':
        oscillator.frequency.setValueAtTime(200, now)
        oscillator.frequency.setValueAtTime(150, now + 0.1)
        gainNode.gain.setValueAtTime(0.3, now)
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2)
        oscillator.start(now)
        oscillator.stop(now + 0.2)
        break

      case 'click':
        oscillator.frequency.setValueAtTime(800, now)
        gainNode.gain.setValueAtTime(0.1, now)
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.05)
        oscillator.start(now)
        oscillator.stop(now + 0.05)
        break

      case 'notification':
        oscillator.frequency.setValueAtTime(880, now) // A5
        oscillator.frequency.setValueAtTime(1108.73, now + 0.15) // C#6
        gainNode.gain.setValueAtTime(0.2, now)
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3)
        oscillator.start(now)
        oscillator.stop(now + 0.3)
        break
    }
  } catch (e) {
    // Audio not supported
  }
}

export default useSounds
