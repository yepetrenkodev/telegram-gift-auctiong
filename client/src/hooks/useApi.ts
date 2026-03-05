import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTelegram } from './useTelegram'
import { useUserStore, useAuctionStore, useNotificationStore, type Auction, type User } from '../store'

const API_URL = import.meta.env.VITE_API_URL || '/api'

interface ApiError {
  message: string
  status: number
}

async function fetcher<T>(
  endpoint: string,
  options: RequestInit = {},
  initData?: string
): Promise<T> {
  // Get dev user ID for development mode
  const devUserId = localStorage.getItem('dev_user_id')
  
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(initData && { 'X-Telegram-Init-Data': initData }),
      ...(devUserId && { 'X-Dev-User-Id': devUserId }),
      ...options.headers,
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }))
    throw { message: error.message || error.error || 'Request failed', status: response.status } as ApiError
  }

  return response.json()
}

// Auth Hook
export function useAuth() {
  const { initData, user: tgUser } = useTelegram()
  const { setUser } = useUserStore()
  const queryClient = useQueryClient()

  const authQuery = useQuery({
    queryKey: ['auth', tgUser?.id],
    queryFn: async () => {
      // Always try to fetch from server first for fresh data
      try {
        const data = await fetcher<{ user: User }>('/auth/telegram', {
          method: 'POST',
          body: JSON.stringify({ initData: initData || 'dev-mode' }),
        })
        setUser(data.user)
        // Save user ID for dev mode auth
        if (data.user.id) {
          localStorage.setItem('dev_user_id', data.user.id)
        }
        return data.user
      } catch (error) {
        // Fallback to mock user in dev mode
        if (!tgUser) {
          const mockUser: User = {
            id: 'mock-user-id',
            telegramId: 123456789,
            username: 'testuser',
            firstName: 'Test',
            lastName: 'User',
            photoUrl: undefined,
            balance: 5000,
            tonBalance: 25,
            totalSpent: 0,
            totalWins: 0
          }
          setUser(mockUser)
          // Save mock user ID for dev mode auth
          localStorage.setItem('dev_user_id', mockUser.id)
          return mockUser
        }
        throw error
      }
    },
    enabled: true,
    staleTime: 30 * 1000, // 30 seconds
    refetchOnMount: true,
  })

  const logout = () => {
    queryClient.clear()
    useUserStore.getState().logout()
  }

  const refetchUser = () => {
    queryClient.invalidateQueries({ queryKey: ['auth'] })
  }

  return {
    ...authQuery,
    logout,
    refetchUser
  }
}

// Extended Auctions Filter Interface (Fragment-style)
export interface AuctionFilters {
  status?: string
  giftId?: string
  collection?: string
  model?: string
  backdrop?: string
  symbol?: string
  rarity?: string
  sort?: 'ending' | 'price-high' | 'price-low' | 'popular' | 'newest'
  search?: string
  limit?: number
  offset?: number
}

export interface AuctionsPagination {
  total: number
  limit: number
  offset: number
  hasMore: boolean
}

export interface AuctionsResponse {
  auctions: Auction[]
  pagination: AuctionsPagination
}

// Auctions Hook with Fragment-style filters
export function useAuctions(filters?: AuctionFilters) {
  const { initData } = useTelegram()
  const { setAuctions, setLoading } = useAuctionStore()

  const query = new URLSearchParams()
  if (filters?.status) query.set('status', filters.status)
  if (filters?.giftId) query.set('giftId', filters.giftId)
  if (filters?.collection) query.set('collection', filters.collection)
  if (filters?.model) query.set('model', filters.model)
  if (filters?.backdrop) query.set('backdrop', filters.backdrop)
  if (filters?.symbol) query.set('symbol', filters.symbol)
  if (filters?.rarity) query.set('rarity', filters.rarity)
  if (filters?.sort) query.set('sort', filters.sort)
  if (filters?.search) query.set('search', filters.search)
  if (filters?.limit) query.set('limit', filters.limit.toString())
  if (filters?.offset) query.set('offset', filters.offset.toString())

  return useQuery({
    queryKey: ['auctions', filters],
    queryFn: async () => {
      setLoading(true)
      try {
        const data = await fetcher<AuctionsResponse>(
          `/auctions?${query.toString()}`,
          {},
          initData
        )
        setAuctions(data.auctions)
        return data
      } finally {
        setLoading(false)
      }
    },
    staleTime: 10 * 1000,
    refetchInterval: 15 * 1000,
  })
}

// Single Auction Hook
export function useAuction(auctionId: string | undefined) {
  const { initData } = useTelegram()
  const { setCurrentAuction } = useAuctionStore()

  return useQuery({
    queryKey: ['auction', auctionId],
    queryFn: async () => {
      if (!auctionId) return null

      const data = await fetcher<{ auction: Auction }>(
        `/auctions/${auctionId}`,
        {},
        initData
      )
      setCurrentAuction(data.auction)
      return data.auction
    },
    enabled: !!auctionId,
    staleTime: 5 * 1000, // 5 seconds
    refetchInterval: 10 * 1000, // Auto-refetch every 10 seconds for live updates
  })
}

// Place Bid Mutation
export function usePlaceBid() {
  const { initData, hapticFeedback } = useTelegram()
  const queryClient = useQueryClient()
  const { addBidToAuction, updateAuction } = useAuctionStore()
  const { user, updateBalance } = useUserStore()
  const { addNotification } = useNotificationStore()

  return useMutation({
    mutationFn: async ({ auctionId, amount }: { auctionId: string; amount: number }) => {
      return fetcher<{ bid: any; newPrice: number; newBalance: number }>(
        `/auctions/${auctionId}/bid`,
        {
          method: 'POST',
          body: JSON.stringify({ amount }),
        },
        initData
      )
    },
    onSuccess: (data, { auctionId, amount }) => {
      // Add bid to auction in store
      addBidToAuction(auctionId, {
        id: data.bid.id,
        bidderId: user?.id || '',
        bidderName: user?.firstName || 'You',
        amount: data.newPrice,
        createdAt: new Date()
      })

      // Update auction price
      updateAuction(auctionId, { currentPrice: data.newPrice })

      // Update user balance locally
      updateBalance(-amount, 'stars')

      // Show success notification
      addNotification({
        type: 'bid',
        title: 'Ставка принята! 🎉',
        message: `Вы сделали ставку ${amount} ⭐`
      })

      hapticFeedback('notification', 'success')

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['auction', auctionId] })
      queryClient.invalidateQueries({ queryKey: ['auctions'] })
      queryClient.invalidateQueries({ queryKey: ['user-bids'] })
      queryClient.invalidateQueries({ queryKey: ['auth'] })
    },
    onError: (error: ApiError) => {
      addNotification({
        type: 'error',
        title: 'Ошибка ставки',
        message: error.message || 'Не удалось сделать ставку'
      })
      hapticFeedback('notification', 'error')
    }
  })
}

// User Bids Hook
export function useUserBids() {
  const { initData } = useTelegram()
  const { user } = useUserStore()

  return useQuery({
    queryKey: ['user-bids', user?.id],
    queryFn: async () => {
      return fetcher<{ bids: any[] }>('/users/me/bids', {}, initData)
    },
    enabled: !!user,
    staleTime: 30 * 1000,
  })
}

// User Won Auctions Hook
export function useUserWins() {
  const { initData } = useTelegram()
  const { user } = useUserStore()

  return useQuery({
    queryKey: ['user-wins', user?.id],
    queryFn: async () => {
      return fetcher<{ auctions: Auction[] }>('/users/me/wins', {}, initData)
    },
    enabled: !!user,
    staleTime: 60 * 1000,
  })
}

// Leaderboard Hook
export function useLeaderboard(type: 'daily' | 'weekly' | 'alltime' = 'daily') {
  const { initData } = useTelegram()

  return useQuery({
    queryKey: ['leaderboard', type],
    queryFn: async () => {
      return fetcher<{ leaderboard: any[] }>(`/leaderboard/${type}`, {}, initData)
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000, // Refresh leaderboard every minute
  })
}

// Gifts Hook
export function useGifts() {
  const { initData } = useTelegram()

  return useQuery({
    queryKey: ['gifts'],
    queryFn: async () => {
      return fetcher<{ gifts: any[] }>('/gifts', {}, initData)
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

// Buy Stars Mutation
export function useBuyStars() {
  const { initData, hapticFeedback } = useTelegram()
  const queryClient = useQueryClient()
  const { addNotification } = useNotificationStore()

  return useMutation({
    mutationFn: async (amount: number) => {
      return fetcher<{ success: boolean; message: string; newBalance?: number }>(
        '/payments/stars',
        {
          method: 'POST',
          body: JSON.stringify({ amount }),
        },
        initData
      )
    },
    onSuccess: (data, amount) => {
      hapticFeedback('notification', 'success')
      addNotification({
        type: 'success',
        title: 'Оплата прошла успешно!',
        message: `+${amount} ⭐ добавлено на ваш баланс`
      })
      // Refresh user data to update balance
      queryClient.invalidateQueries({ queryKey: ['auth'] })
    },
    onError: (error: ApiError) => {
      addNotification({
        type: 'error',
        title: 'Ошибка оплаты',
        message: error.message
      })
    }
  })
}

// TON Payment Mutation
export function useTonPayment() {
  const { initData, hapticFeedback } = useTelegram()
  const queryClient = useQueryClient()
  const { addNotification } = useNotificationStore()

  return useMutation({
    mutationFn: async ({ amount, action }: { amount: number; action: 'deposit' | 'withdraw' }) => {
      return fetcher<{ address?: string; txHash?: string }>(
        '/payments/ton',
        {
          method: 'POST',
          body: JSON.stringify({ amount, action }),
        },
        initData
      )
    },
    onSuccess: (data, { action }) => {
      hapticFeedback('notification', 'success')
      addNotification({
        type: 'success',
        title: action === 'deposit' ? 'Пополнение TON' : 'Вывод TON',
        message: action === 'deposit' 
          ? `Отправьте TON на адрес: ${data.address?.slice(0, 10)}...` 
          : 'Транзакция отправлена'
      })
      queryClient.invalidateQueries({ queryKey: ['auth'] })
    },
    onError: (error: ApiError) => {
      addNotification({
        type: 'error',
        title: 'Ошибка TON',
        message: error.message
      })
    }
  })
}
// Check and Complete Auction Mutation
export function useCompleteAuction() {
  const { initData, hapticFeedback } = useTelegram()
  const queryClient = useQueryClient()
  const { addNotification } = useNotificationStore()

  return useMutation({
    mutationFn: async (auctionId: string) => {
      return fetcher<{ 
        completed: boolean
        winner?: { 
          id: string
          username: string
          firstName: string
          winningBid: number
        }
        message?: string
      }>(
        `/auctions/${auctionId}/complete`,
        { method: 'POST' },
        initData
      )
    },
    onSuccess: (data, auctionId) => {
      if (data.winner) {
        hapticFeedback('notification', 'success')
        addNotification({
          type: 'success',
          title: '🏆 Аукцион завершён!',
          message: `Победитель: ${data.winner.username || data.winner.firstName} с ставкой ${data.winner.winningBid} ⭐`
        })
      }
      queryClient.invalidateQueries({ queryKey: ['auction', auctionId] })
      queryClient.invalidateQueries({ queryKey: ['auctions'] })
      queryClient.invalidateQueries({ queryKey: ['auth'] })
    },
    onError: (error: ApiError) => {
      // Не показываем ошибку если аукцион уже завершен
      if (!error.message.includes('завершён')) {
        addNotification({
          type: 'error',
          title: 'Ошибка',
          message: error.message
        })
      }
    }
  })
}

// Get Auction Winner Hook
export function useAuctionWinner(auctionId: string, enabled: boolean = true) {
  const { initData } = useTelegram()

  return useQuery({
    queryKey: ['auction-winner', auctionId],
    queryFn: async () => {
      return fetcher<{
        winner: {
          id: string
          telegramId: number
          username: string
          firstName: string
          winningBid: number
          isCurrentUser: boolean
        } | null
        totalBids: number
        finalPrice: number
      }>(`/auctions/${auctionId}/winner`, {}, initData)
    },
    enabled: enabled && !!auctionId,
    staleTime: 30 * 1000, // 30 секунд
  })
}

// Fragment-style Filter Options Interface
export interface FilterOptionsResponse {
  collections: Array<{ value: string; label: string; count: number }>
  models: Array<{ value: string; label: string; count: number }>
  backdrops: Array<{ value: string; label: string; count: number }>
  symbols: Array<{ value: string; label: string; count: number }>
  rarities: Array<{ value: string; label: string; count: number }>
  sortOptions: Array<{ value: string; label: string }>
}

// Filter Options Hook (Fragment-style)
export function useFilterOptions() {
  const { initData } = useTelegram()

  return useQuery({
    queryKey: ['filter-options'],
    queryFn: async () => {
      return fetcher<FilterOptionsResponse>('/filters', {}, initData)
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - filters don't change often
  })
}

// Auction Stats Hook
export interface AuctionStatsResponse {
  activeAuctions: number
  completedAuctions: number
  totalBids: number
  totalVolume: number
}

export function useAuctionStats() {
  const { initData } = useTelegram()

  return useQuery({
    queryKey: ['auction-stats'],
    queryFn: async () => {
      return fetcher<AuctionStatsResponse>('/stats', {}, initData)
    },
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: 2 * 60 * 1000, // Refresh every 2 minutes
  })
}