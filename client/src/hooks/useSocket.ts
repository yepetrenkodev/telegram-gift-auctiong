import { useEffect, useRef, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { useQueryClient } from '@tanstack/react-query'
import { 
  useAuctionStore, 
  useTimerStore, 
  useLeaderboardStore,
  useNotificationStore,
  useUserStore,
  type Bid,
  type Auction,
  type LeaderboardEntry
} from '../store'
import { useTelegram } from './useTelegram'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || ''

interface ServerToClientEvents {
  'bid:placed': (data: { auctionId: string; bid: Bid; amount: number; bidderName: string; bidderId: string }) => void
  'bid:outbid': (data: { auctionId: string; roundNumber: number; outbidBy: string; newAmount: number; yourAmount: number; newPosition: number }) => void
  'auction:bid': (data: { auctionId: string; bid: Bid }) => void  // Legacy event
  'auction:timer': (data: { auctionId: string; timeRemaining: number }) => void
  'auction:started': (data: { auctionId: string }) => void
  'auction:ended': (data: { auctionId: string; winnerId: string; winnerName: string; finalPrice: number }) => void
  'auction:update': (data: { auctionId: string; updates: Record<string, unknown> }) => void
  'round:extended': (data: { auctionId: string; roundNumber: number; newEndsAt: string; extensionCount: number; triggeredBy: string }) => void
  'timer:sync': (data: { auctionId: string; roundNumber: number; endsAt: string; secondsLeft: number; extended?: boolean; extensionCount?: number }) => void
  'leaderboard:update': (data: { type: string; entries: LeaderboardEntry[] }) => void
  'user:balance': (data: { balance: number; tonBalance: number }) => void
  'notification': (data: { type: string; title: string; message: string }) => void
  'error': (data: { message: string }) => void
  // Auto-bid events
  'autobid:triggered': (data: { auctionId: string; roundNumber: number; amount: number; remainingMax: number; bidCount: number }) => void
  'autobid:stopped': (data: { auctionId: string; reason: string; maxAmount: number; totalBidsPlaced: number }) => void
}

interface ClientToServerEvents {
  'auction:join': (data: { auctionId: string }) => void
  'auction:leave': (data: { auctionId: string }) => void
  'auction:bid': (data: { auctionId: string; amount: number }) => void
  'leaderboard:subscribe': (type: string) => void
  'leaderboard:unsubscribe': (type: string) => void
}

let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null

export function useSocket() {
  const { initData, hapticFeedback } = useTelegram()
  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null)
  const queryClient = useQueryClient()
  
  const { addBidToAuction, updateAuction, setCurrentAuction } = useAuctionStore()
  const { setTimer } = useTimerStore()
  const { setLeaderboard } = useLeaderboardStore()
  const { addNotification } = useNotificationStore()
  const { user, updateBalance } = useUserStore()

  // Initialize socket connection
  useEffect(() => {
    if (socket) {
      socketRef.current = socket
      return
    }

    socket = io(SOCKET_URL, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      auth: {
        initData,
        userId: user?.id
      }
    })

    socketRef.current = socket

    // Connection events
    socket.on('connect', () => {
      console.log('🔌 Socket connected')
    })

    socket.on('disconnect', (reason) => {
      console.log('🔌 Socket disconnected:', reason)
    })

    socket.on('connect_error', (error) => {
      console.error('🔌 Socket connection error:', error)
    })

    // Helper function to handle bid updates
    const handleBidUpdate = (auctionId: string, bid: Bid) => {
      // Update Zustand store
      addBidToAuction(auctionId, bid)
      
      // Update React Query cache directly for instant UI update
      queryClient.setQueryData(['auction', auctionId], (oldData: any) => {
        if (!oldData) return oldData
        return {
          ...oldData,
          currentPrice: bid.amount,
          bids: [bid, ...(oldData.bids || []).slice(0, 49)],
          totalBids: (oldData.totalBids || 0) + 1
        }
      })
      
      // Also invalidate auctions list to reflect new prices
      queryClient.invalidateQueries({ queryKey: ['auctions'] })
      
      hapticFeedback('impact', 'light')
      
      // Check if current user was outbid
      if (user && bid.bidderId !== user.id) {
        addNotification({
          type: 'bid',
          title: 'Новая ставка',
          message: `${bid.bidderName} сделал ставку ${bid.amount} ⭐`
        })
      }
    }

    // Main bid event from server (bid:placed)
    socket.on('bid:placed', (data: any) => {
      const { auctionId, amount, bidderName, bidderId, outbidUserId, outbidAmount } = data
      
      const bid: Bid = {
        id: `bid-${Date.now()}`,
        bidderId,
        bidderName,
        amount,
        createdAt: new Date()
      }
      handleBidUpdate(auctionId, bid)
      
      // Check if CURRENT USER was outbid and refund their balance
      if (outbidUserId && outbidAmount && user && outbidUserId === user.id) {
        // User was outbid - return their money
        updateBalance(outbidAmount, 'stars')
        addNotification({
          type: 'warning',
          title: '⚠️ Вас перебили!',
          message: `${bidderName} сделал ставку ${amount} ⭐. Вам возвращено ${outbidAmount} ⭐`
        })
        hapticFeedback('notification', 'warning')
      }
    })

    // Legacy auction:bid event (for backwards compatibility)
    socket.on('auction:bid', ({ auctionId, bid }) => {
      handleBidUpdate(auctionId, bid)
    })

    // Outbid notification - when someone outbids current user
    socket.on('bid:outbid', ({ auctionId, outbidBy, newAmount, yourAmount, newPosition }) => {
      addNotification({
        type: 'warning',
        title: '⚠️ Вас перебили!',
        message: `${outbidBy} сделал ставку ${newAmount} ⭐. Вам возвращено ${yourAmount} ⭐`
      })
      hapticFeedback('notification', 'warning')
      
      // Return the bid amount to user's balance (it was refunded on server)
      updateBalance(yourAmount, 'stars')
      
      // Invalidate auto-bid status to refresh UI
      queryClient.invalidateQueries({ queryKey: ['autoBid', auctionId] })
    })

    // Round extended (anti-snipe protection)
    socket.on('round:extended', ({ auctionId, newEndsAt, extensionCount }) => {
      addNotification({
        type: 'info',
        title: '⏰ Время продлено!',
        message: `Аукцион продлён (расширение #${extensionCount})`
      })
      hapticFeedback('impact', 'medium')
      
      // Update auction data with new end time
      queryClient.setQueryData(['auction', auctionId], (oldData: any) => {
        if (!oldData) return oldData
        return { ...oldData, endsAt: newEndsAt }
      })
    })

    // Timer sync from server
    socket.on('timer:sync', ({ auctionId, secondsLeft, extended }) => {
      setTimer(auctionId, secondsLeft)
      if (extended) {
        // Flash effect on timer when extended
        hapticFeedback('impact', 'light')
      }
    })

    socket.on('auction:timer', ({ auctionId, timeRemaining }) => {
      setTimer(auctionId, timeRemaining)
    })

    socket.on('auction:started', ({ auctionId }) => {
      addNotification({
        type: 'info',
        title: 'Аукцион начался!',
        message: 'Время делать ставки'
      })
      hapticFeedback('notification', 'success')
    })

    socket.on('auction:ended', ({ auctionId, winnerId, winnerName, finalPrice }) => {
      const updates: Partial<Auction> = { 
        status: 'completed' as const,
        winnerName,
        currentPrice: finalPrice
      }
      
      // Update store
      updateAuction(auctionId, updates)
      
      // Update React Query cache
      queryClient.setQueryData(['auction', auctionId], (oldData: any) => {
        if (!oldData) return oldData
        return { ...oldData, ...updates }
      })
      queryClient.invalidateQueries({ queryKey: ['auctions'] })
      queryClient.invalidateQueries({ queryKey: ['auction-winner', auctionId] })
      
      if (user && winnerId === user.id) {
        addNotification({
          type: 'win',
          title: '🎉 Поздравляем!',
          message: `Вы выиграли аукцион за ${finalPrice} ⭐`
        })
        hapticFeedback('notification', 'success')
      } else {
        addNotification({
          type: 'info',
          title: 'Аукцион завершен',
          message: `Победитель: ${winnerName} (${finalPrice} ⭐)`
        })
      }
    })

    socket.on('auction:update', ({ auctionId, updates }) => {
      // Update store
      updateAuction(auctionId, updates)
      
      // Update React Query cache
      queryClient.setQueryData(['auction', auctionId], (oldData: any) => {
        if (!oldData) return oldData
        return { ...oldData, ...updates }
      })
    })

    // Leaderboard events
    socket.on('leaderboard:update', ({ entries }) => {
      setLeaderboard(entries)
    })

    // User events
    socket.on('user:balance', ({ balance, tonBalance }) => {
      if (user) {
        updateBalance(balance - user.balance, 'stars')
        updateBalance(tonBalance - user.tonBalance, 'ton')
      }
    })

    // Notification events
    socket.on('notification', ({ type, title, message }) => {
      addNotification({
        type: type as 'success' | 'error' | 'info' | 'warning',
        title,
        message
      })
    })

    // Auto-bid triggered - when your auto-bid places a bid
    socket.on('autobid:triggered', ({ auctionId, amount, remainingMax, bidCount }) => {
      addNotification({
        type: 'success',
        title: '🤖 Auto-Bid сработал!',
        message: `Ставка ${amount} ⭐ (#${bidCount}). Осталось: ${remainingMax} ⭐`
      })
      hapticFeedback('notification', 'success')
      
      // Refresh auto-bid status and auction data
      queryClient.invalidateQueries({ queryKey: ['autoBid', auctionId] })
      queryClient.invalidateQueries({ queryKey: ['auction', auctionId] })
    })

    // Auto-bid stopped - when your auto-bid is disabled
    socket.on('autobid:stopped', ({ auctionId, reason, maxAmount, totalBidsPlaced }) => {
      const reasonMessages: Record<string, string> = {
        'max_reached': `Достигнут максимум ${maxAmount} ⭐`,
        'outbid': `Вас перебили выше ${maxAmount} ⭐`,
        'auction_ended': 'Аукцион завершён',
        'insufficient_balance': 'Недостаточно средств',
        'manual': 'Отменён вручную'
      }
      
      addNotification({
        type: reason === 'max_reached' || reason === 'outbid' ? 'warning' : 'info',
        title: '🤖 Auto-Bid остановлен',
        message: `${reasonMessages[reason] || reason}. Всего ставок: ${totalBidsPlaced}`
      })
      hapticFeedback('notification', 'warning')
      
      // Refresh auto-bid status
      queryClient.invalidateQueries({ queryKey: ['autoBid', auctionId] })
      queryClient.invalidateQueries({ queryKey: ['activeAutoBids'] })
    })

    // Error events
    socket.on('error', ({ message }) => {
      addNotification({
        type: 'error',
        title: 'Ошибка',
        message
      })
      hapticFeedback('notification', 'error')
    })

    return () => {
      // Don't disconnect on unmount to keep connection alive
    }
  }, [initData, user?.id])

  // Join auction room
  const joinAuction = useCallback((auctionId: string) => {
    socketRef.current?.emit('auction:join', { auctionId })
  }, [])

  // Leave auction room
  const leaveAuction = useCallback((auctionId: string) => {
    socketRef.current?.emit('auction:leave', { auctionId })
  }, [])

  // Place bid via socket
  const placeBid = useCallback((auctionId: string, amount: number) => {
    socketRef.current?.emit('auction:bid', { auctionId, amount })
    hapticFeedback('impact', 'heavy')
  }, [hapticFeedback])

  // Subscribe to leaderboard
  const subscribeLeaderboard = useCallback((type: string = 'daily') => {
    socketRef.current?.emit('leaderboard:subscribe', type)
  }, [])

  // Unsubscribe from leaderboard
  const unsubscribeLeaderboard = useCallback((type: string = 'daily') => {
    socketRef.current?.emit('leaderboard:unsubscribe', type)
  }, [])

  return {
    socket: socketRef.current,
    isConnected: socketRef.current?.connected ?? false,
    joinAuction,
    leaveAuction,
    placeBid,
    subscribeLeaderboard,
    unsubscribeLeaderboard
  }
}

// Disconnect socket (call on app unmount)
export function disconnectSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}
