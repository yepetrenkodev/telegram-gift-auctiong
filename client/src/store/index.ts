import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

// Types
export interface User {
  id: string
  telegramId: number
  username?: string
  firstName: string
  lastName?: string
  photoUrl?: string
  balance: number
  tonBalance: number
  totalSpent: number
  totalWins: number
}

export interface Gift {
  id: string
  name: string
  imageUrl: string
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
  description?: string
  // Fragment-style attributes
  model?: string
  backdrop?: string
  symbol?: string
  giftCollection?: string
  number?: number
  timesSold?: number
  floorPrice?: number
}

export interface Bid {
  id: string
  bidderId: string
  bidderName: string
  amount: number
  createdAt: Date
}

export interface Auction {
  id: string
  gift: Gift
  startingPrice: number
  currentPrice: number
  incrementAmount: number
  endTime: Date
  status: 'pending' | 'active' | 'completed' | 'cancelled'
  winnerName?: string
  bids: Bid[]
  totalBids: number
}

export interface LeaderboardEntry {
  rank: number
  id: string
  name: string
  photoUrl?: string
  score: number
  isCurrentUser: boolean
}

export interface Notification {
  id: string
  type: 'success' | 'error' | 'info' | 'warning' | 'bid' | 'win'
  title: string
  message: string
  timestamp: Date
  read: boolean
}

// Auction Store
interface AuctionState {
  auctions: Auction[]
  currentAuction: Auction | null
  isLoading: boolean
  error: string | null
  
  setAuctions: (auctions: Auction[]) => void
  setCurrentAuction: (auction: Auction | null) => void
  updateAuction: (id: string, updates: Partial<Auction>) => void
  addBidToAuction: (auctionId: string, bid: Bid) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}

export const useAuctionStore = create<AuctionState>()(
  devtools(
    (set, get) => ({
      auctions: [],
      currentAuction: null,
      isLoading: false,
      error: null,

      setAuctions: (auctions) => set({ auctions }),
      
      setCurrentAuction: (auction) => set({ currentAuction: auction }),
      
      updateAuction: (id, updates) => set((state) => ({
        auctions: state.auctions.map((a) => 
          a.id === id ? { ...a, ...updates } : a
        ),
        currentAuction: state.currentAuction?.id === id 
          ? { ...state.currentAuction, ...updates } 
          : state.currentAuction
      })),
      
      addBidToAuction: (auctionId, bid) => set((state) => {
        const updateAuction = (auction: Auction) => ({
          ...auction,
          currentPrice: bid.amount,
          bids: [bid, ...auction.bids.slice(0, 49)],
          totalBids: auction.totalBids + 1
        })
        
        return {
          auctions: state.auctions.map((a) => 
            a.id === auctionId ? updateAuction(a) : a
          ),
          currentAuction: state.currentAuction?.id === auctionId 
            ? updateAuction(state.currentAuction) 
            : state.currentAuction
        }
      }),
      
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error })
    }),
    { name: 'auction-store' }
  )
)

// User Store
interface UserState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  
  setUser: (user: User | null) => void
  updateBalance: (amount: number, type: 'stars' | 'ton') => void
  incrementWins: () => void
  logout: () => void
}

export const useUserStore = create<UserState>()(
  devtools(
    persist(
      (set) => ({
        user: null,
        isAuthenticated: false,
        isLoading: true,

        setUser: (user) => set({ 
          user, 
          isAuthenticated: !!user,
          isLoading: false 
        }),
        
        updateBalance: (amount, type) => set((state) => {
          if (!state.user) return state
          return {
            user: {
              ...state.user,
              [type === 'stars' ? 'balance' : 'tonBalance']: 
                state.user[type === 'stars' ? 'balance' : 'tonBalance'] + amount,
              totalSpent: amount < 0 ? state.user.totalSpent + Math.abs(amount) : state.user.totalSpent
            }
          }
        }),
        
        incrementWins: () => set((state) => {
          if (!state.user) return state
          return { user: { ...state.user, totalWins: state.user.totalWins + 1 } }
        }),
        
        logout: () => set({ user: null, isAuthenticated: false })
      }),
      { name: 'user-storage', partialize: (state) => ({ user: state.user }) }
    ),
    { name: 'user-store' }
  )
)

// Leaderboard Store
interface LeaderboardState {
  leaderboard: LeaderboardEntry[]
  userRank: number | null
  isLoading: boolean
  lastUpdate: Date | null
  
  setLeaderboard: (entries: LeaderboardEntry[]) => void
  setUserRank: (rank: number | null) => void
  setLoading: (loading: boolean) => void
}

export const useLeaderboardStore = create<LeaderboardState>()(
  devtools(
    (set) => ({
      leaderboard: [],
      userRank: null,
      isLoading: false,
      lastUpdate: null,

      setLeaderboard: (leaderboard) => set({ 
        leaderboard, 
        lastUpdate: new Date() 
      }),
      
      setUserRank: (userRank) => set({ userRank }),
      setLoading: (isLoading) => set({ isLoading })
    }),
    { name: 'leaderboard-store' }
  )
)

// Timer Store
interface TimerState {
  timers: Record<string, number> // auctionId -> seconds remaining
  
  setTimer: (auctionId: string, seconds: number) => void
  decrementTimer: (auctionId: string) => void
  removeTimer: (auctionId: string) => void
  clearTimers: () => void
}

export const useTimerStore = create<TimerState>()(
  devtools(
    (set) => ({
      timers: {},

      setTimer: (auctionId, seconds) => set((state) => ({
        timers: { ...state.timers, [auctionId]: Math.max(0, seconds) }
      })),
      
      decrementTimer: (auctionId) => set((state) => ({
        timers: { 
          ...state.timers, 
          [auctionId]: Math.max(0, (state.timers[auctionId] || 0) - 1) 
        }
      })),
      
      removeTimer: (auctionId) => set((state) => {
        const { [auctionId]: _, ...rest } = state.timers
        return { timers: rest }
      }),
      
      clearTimers: () => set({ timers: {} })
    }),
    { name: 'timer-store' }
  )
)

// Notification Store
interface NotificationState {
  notifications: Notification[]
  unreadCount: number
  
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  removeNotification: (id: string) => void
  clearNotifications: () => void
}

export const useNotificationStore = create<NotificationState>()(
  devtools(
    (set, get) => ({
      notifications: [],
      unreadCount: 0,

      addNotification: (notification) => set((state) => {
        const newNotification: Notification = {
          ...notification,
          id: Math.random().toString(36).slice(2),
          timestamp: new Date(),
          read: false
        }
        return {
          notifications: [newNotification, ...state.notifications.slice(0, 49)],
          unreadCount: state.unreadCount + 1
        }
      }),
      
      markAsRead: (id) => set((state) => ({
        notifications: state.notifications.map((n) =>
          n.id === id ? { ...n, read: true } : n
        ),
        unreadCount: Math.max(0, state.unreadCount - (
          state.notifications.find((n) => n.id === id && !n.read) ? 1 : 0
        ))
      })),
      
      markAllAsRead: () => set((state) => ({
        notifications: state.notifications.map((n) => ({ ...n, read: true })),
        unreadCount: 0
      })),
      
      removeNotification: (id) => set((state) => ({
        notifications: state.notifications.filter((n) => n.id !== id),
        unreadCount: state.unreadCount - (
          state.notifications.find((n) => n.id === id && !n.read) ? 1 : 0
        )
      })),
      
      clearNotifications: () => set({ notifications: [], unreadCount: 0 })
    }),
    { name: 'notification-store' }
  )
)

// UI Store
interface UIState {
  isSidebarOpen: boolean
  isModalOpen: boolean
  modalContent: React.ReactNode | null
  theme: 'light' | 'dark'
  
  toggleSidebar: () => void
  openModal: (content: React.ReactNode) => void
  closeModal: () => void
  setTheme: (theme: 'light' | 'dark') => void
}

export const useUIStore = create<UIState>()(
  devtools(
    (set) => ({
      isSidebarOpen: false,
      isModalOpen: false,
      modalContent: null,
      theme: 'dark',

      toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
      openModal: (content) => set({ isModalOpen: true, modalContent: content }),
      closeModal: () => set({ isModalOpen: false, modalContent: null }),
      setTheme: (theme) => set({ theme })
    }),
    { name: 'ui-store' }
  )
)
