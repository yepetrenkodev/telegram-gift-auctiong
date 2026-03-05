import { useState, useEffect, useCallback } from 'react'
import { useUserStore } from '../store'

const WATCHLIST_KEY = 'auction_watchlist'

export interface WatchlistItem {
  auctionId: string
  addedAt: Date
  notifyOnEnd: boolean
  notifyOnOutbid: boolean
}

export function useWatchlist() {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([])
  const user = useUserStore((s) => s.user)

  // Load watchlist from localStorage
  useEffect(() => {
    const key = user ? `${WATCHLIST_KEY}_${user.id}` : WATCHLIST_KEY
    const saved = localStorage.getItem(key)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setWatchlist(parsed.map((item: any) => ({
          ...item,
          addedAt: new Date(item.addedAt)
        })))
      } catch (e) {
        console.error('Failed to parse watchlist:', e)
      }
    }
  }, [user])

  // Save watchlist to localStorage
  const saveWatchlist = useCallback((items: WatchlistItem[]) => {
    const key = user ? `${WATCHLIST_KEY}_${user.id}` : WATCHLIST_KEY
    localStorage.setItem(key, JSON.stringify(items))
  }, [user])

  // Check if auction is in watchlist
  const isWatching = useCallback((auctionId: string) => {
    return watchlist.some(item => item.auctionId === auctionId)
  }, [watchlist])

  // Add to watchlist
  const addToWatchlist = useCallback((auctionId: string, options?: { notifyOnEnd?: boolean; notifyOnOutbid?: boolean }) => {
    if (isWatching(auctionId)) return

    const newItem: WatchlistItem = {
      auctionId,
      addedAt: new Date(),
      notifyOnEnd: options?.notifyOnEnd ?? true,
      notifyOnOutbid: options?.notifyOnOutbid ?? true,
    }

    const newWatchlist = [...watchlist, newItem]
    setWatchlist(newWatchlist)
    saveWatchlist(newWatchlist)
  }, [watchlist, isWatching, saveWatchlist])

  // Remove from watchlist
  const removeFromWatchlist = useCallback((auctionId: string) => {
    const newWatchlist = watchlist.filter(item => item.auctionId !== auctionId)
    setWatchlist(newWatchlist)
    saveWatchlist(newWatchlist)
  }, [watchlist, saveWatchlist])

  // Toggle watchlist
  const toggleWatchlist = useCallback((auctionId: string) => {
    if (isWatching(auctionId)) {
      removeFromWatchlist(auctionId)
      return false
    } else {
      addToWatchlist(auctionId)
      return true
    }
  }, [isWatching, addToWatchlist, removeFromWatchlist])

  // Update notification settings
  const updateNotifications = useCallback((auctionId: string, settings: { notifyOnEnd?: boolean; notifyOnOutbid?: boolean }) => {
    const newWatchlist = watchlist.map(item => {
      if (item.auctionId === auctionId) {
        return {
          ...item,
          ...(settings.notifyOnEnd !== undefined && { notifyOnEnd: settings.notifyOnEnd }),
          ...(settings.notifyOnOutbid !== undefined && { notifyOnOutbid: settings.notifyOnOutbid }),
        }
      }
      return item
    })
    setWatchlist(newWatchlist)
    saveWatchlist(newWatchlist)
  }, [watchlist, saveWatchlist])

  // Get watchlist item
  const getWatchlistItem = useCallback((auctionId: string) => {
    return watchlist.find(item => item.auctionId === auctionId)
  }, [watchlist])

  // Clear watchlist
  const clearWatchlist = useCallback(() => {
    setWatchlist([])
    const key = user ? `${WATCHLIST_KEY}_${user.id}` : WATCHLIST_KEY
    localStorage.removeItem(key)
  }, [user])

  return {
    watchlist,
    isWatching,
    addToWatchlist,
    removeFromWatchlist,
    toggleWatchlist,
    updateNotifications,
    getWatchlistItem,
    clearWatchlist,
    count: watchlist.length,
  }
}

export default useWatchlist
