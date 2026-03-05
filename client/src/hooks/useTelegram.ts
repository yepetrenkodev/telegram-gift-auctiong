import { useEffect, useMemo, useCallback } from 'react'
import { useUIStore } from '../store'

interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
  photo_url?: string
}

// Minimum version that supports various features
const VERSIONS = {
  closingConfirmation: '6.2',
  showPopup: '6.2',
  showAlert: '6.2',
  showConfirm: '6.2',
  hapticFeedback: '6.1',
  backButton: '6.1',
  mainButton: '6.0',
}

function isVersionAtLeast(version: string, minVersion: string): boolean {
  const v1 = version.split('.').map(Number)
  const v2 = minVersion.split('.').map(Number)
  
  for (let i = 0; i < Math.max(v1.length, v2.length); i++) {
    const num1 = v1[i] || 0
    const num2 = v2[i] || 0
    if (num1 > num2) return true
    if (num1 < num2) return false
  }
  return true
}

export function useTelegram() {
  const setTheme = useUIStore((s) => s.setTheme)
  
  const tg = useMemo(() => {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      return window.Telegram.WebApp
    }
    return null
  }, [])

  const version = useMemo(() => tg?.version || '6.0', [tg])

  const user = useMemo((): TelegramUser | null => {
    return tg?.initDataUnsafe?.user || null
  }, [tg])

  const initData = useMemo(() => {
    return tg?.initData || ''
  }, [tg])

  const colorScheme = useMemo(() => {
    return tg?.colorScheme || 'dark'
  }, [tg])

  const themeParams = useMemo(() => {
    return tg?.themeParams || {}
  }, [tg])

  // Initialize Telegram WebApp
  useEffect(() => {
    if (tg) {
      tg.ready()
      tg.expand()
      
      // Only enable closing confirmation if version supports it
      if (isVersionAtLeast(version, VERSIONS.closingConfirmation)) {
        try {
          tg.enableClosingConfirmation()
        } catch (e) {
          console.warn('Closing confirmation not supported')
        }
      }
      
      // Sync theme with Telegram
      setTheme(tg.colorScheme || 'dark')
    }
  }, [tg, setTheme, version])

  // Haptic feedback
  const hapticFeedback = useCallback((type: 'impact' | 'notification' | 'selection', style?: string) => {
    if (!tg?.HapticFeedback || !isVersionAtLeast(version, VERSIONS.hapticFeedback)) return
    
    try {
      switch (type) {
        case 'impact':
          tg.HapticFeedback.impactOccurred((style as 'light' | 'medium' | 'heavy') || 'medium')
          break
        case 'notification':
          tg.HapticFeedback.notificationOccurred((style as 'success' | 'error' | 'warning') || 'success')
          break
        case 'selection':
          tg.HapticFeedback.selectionChanged()
          break
      }
    } catch (e) {
      // Silently fail if haptic feedback not supported
    }
  }, [tg, version])

  // Main Button
  const showMainButton = useCallback((text: string, onClick: () => void) => {
    if (!tg?.MainButton) return
    
    tg.MainButton.setText(text)
    tg.MainButton.onClick(onClick)
    tg.MainButton.show()
    
    return () => {
      tg.MainButton.offClick(onClick)
      tg.MainButton.hide()
    }
  }, [tg])

  const hideMainButton = useCallback(() => {
    tg?.MainButton?.hide()
  }, [tg])

  const setMainButtonLoading = useCallback((loading: boolean) => {
    if (!tg?.MainButton) return
    
    if (loading) {
      tg.MainButton.showProgress()
      tg.MainButton.setParams({ is_active: false })
    } else {
      tg.MainButton.hideProgress()
      tg.MainButton.setParams({ is_active: true })
    }
  }, [tg])

  // Back Button
  const showBackButton = useCallback((onClick: () => void) => {
    if (!tg?.BackButton || !isVersionAtLeast(version, VERSIONS.backButton)) {
      // Fallback - just return empty cleanup
      return () => {}
    }
    
    try {
      tg.BackButton.onClick(onClick)
      tg.BackButton.show()
      
      return () => {
        tg.BackButton.offClick(onClick)
        tg.BackButton.hide()
      }
    } catch (e) {
      return () => {}
    }
  }, [tg, version])

  const hideBackButton = useCallback(() => {
    if (tg?.BackButton && isVersionAtLeast(version, VERSIONS.backButton)) {
      try {
        tg.BackButton.hide()
      } catch (e) {
        // Silently fail
      }
    }
  }, [tg, version])

  // Alerts
  const showAlert = useCallback((message: string) => {
    if (tg?.showAlert && isVersionAtLeast(version, VERSIONS.showAlert)) {
      try {
        tg.showAlert(message)
      } catch (e) {
        alert(message)
      }
    } else {
      alert(message)
    }
  }, [tg, version])

  const showConfirm = useCallback((message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      if (tg?.showConfirm && isVersionAtLeast(version, VERSIONS.showConfirm)) {
        try {
          tg.showConfirm(message, resolve)
        } catch (e) {
          resolve(confirm(message))
        }
      } else {
        resolve(confirm(message))
      }
    })
  }, [tg, version])

  // Close app
  const close = useCallback(() => {
    tg?.close()
  }, [tg])

  return {
    tg,
    user,
    initData,
    colorScheme,
    themeParams,
    isInTelegram: !!tg,
    
    // Actions
    hapticFeedback,
    haptic: hapticFeedback, // Alias for convenience
    showMainButton,
    hideMainButton,
    setMainButtonLoading,
    showBackButton,
    hideBackButton,
    showAlert,
    showConfirm,
    close
  }
}

// Development mock for testing outside Telegram
export function useMockTelegramUser(): TelegramUser {
  return {
    id: 123456789,
    first_name: 'Test',
    last_name: 'User',
    username: 'testuser',
    language_code: 'en',
    photo_url: 'https://via.placeholder.com/100'
  }
}

