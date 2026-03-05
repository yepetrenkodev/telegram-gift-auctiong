// React entry point
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Layout } from './components'
import {
  HomePage,
  AuctionsPage,
  AuctionPage,
  LeaderboardPage,
  WalletPage,
  ProfilePage,
  MyGiftsPage,
  BidHistoryPage
} from './pages'
import { useAuth, useSocket } from './hooks'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 10000,
    },
  },
})

function AppRoutes() {
  // Initialize auth
  const { isLoading } = useAuth()

  // Initialize socket connection
  useSocket()

  if (isLoading) {
    return <LoadingScreen />
  }

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="auctions" element={<AuctionsPage />} />
        <Route path="auction/:id" element={<AuctionPage />} />
        <Route path="leaderboard" element={<LeaderboardPage />} />
        <Route path="wallet" element={<WalletPage />} />
        <Route path="profile" element={<ProfilePage />} />
        {/* New pages */}
        <Route path="gifts" element={<MyGiftsPage />} />
        <Route path="history" element={<BidHistoryPage />} />
        {/* Catch all - redirect to home */}
        <Route path="*" element={<HomePage />} />
      </Route>
    </Routes>
  )
}

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-purple-900/20 to-gray-900 flex items-center justify-center">
      <div className="text-center">
        <div className="relative">
          {/* Animated logo */}
          <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center animate-pulse">
            <span className="text-4xl">🎁</span>
          </div>

          {/* Spinning ring */}
          <div className="absolute inset-0 -m-2">
            <div className="w-24 h-24 mx-auto border-4 border-transparent border-t-purple-500 rounded-full animate-spin" />
          </div>
        </div>

        <h1 className="text-xl font-bold text-white mt-6">Gift Auction</h1>
        <p className="text-gray-400 text-sm mt-2">Загрузка...</p>
      </div>
    </div>
  )
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
