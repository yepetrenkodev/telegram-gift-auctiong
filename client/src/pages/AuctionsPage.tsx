import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useInView } from 'react-intersection-observer'
import { useAuctions, useFilterOptions, useAuctionStats, useSounds, type AuctionFilters as ApiFilters } from '../hooks'
import { AuctionCardFragment, AuctionFilters, StatsSkeleton, type FilterState } from '../components'
import { TrendingUp, Package, Gavel, DollarSign, ChevronDown, Loader2 } from 'lucide-react'

type ViewMode = 'grid' | 'list'

export function AuctionsPage() {
  // View mode state
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  
  // Filter state - initialize with required sort and optional search
  const [filters, setFilters] = useState<FilterState>({
    sort: 'ending',
    search: ''
  })
  
  // Pagination state for infinite scroll
  const [page, setPage] = useState(1)
  const [allAuctions, setAllAuctions] = useState<any[]>([])
  const [hasMore, setHasMore] = useState(true)
  const isLoadingMore = useRef(false)

  // Sounds
  const { play } = useSounds()

  // Convert FilterState to API filters
  const apiFilters: ApiFilters = useMemo(() => ({
    status: 'active',
    page,
    limit: 12,
    ...(filters.search && { search: filters.search }),
    ...(filters.collection && { collection: filters.collection }),
    ...(filters.model && { model: filters.model }),
    ...(filters.backdrop && { backdrop: filters.backdrop }),
    ...(filters.symbol && { symbol: filters.symbol }),
    ...(filters.rarity && { rarity: filters.rarity }),
    ...(filters.sort && { sort: filters.sort as ApiFilters['sort'] }),
  }), [filters, page])

  // Fetch data
  const { data: auctionsData, isLoading, isFetching } = useAuctions(apiFilters)
  const { data: filterOptions } = useFilterOptions()
  const { data: stats, isLoading: statsLoading } = useAuctionStats()

  // Infinite scroll observer
  const { ref: loadMoreRef, inView } = useInView({
    threshold: 0.1,
    triggerOnce: false
  })

  // Reset auctions when filters change
  useEffect(() => {
    setPage(1)
    setAllAuctions([])
    setHasMore(true)
  }, [filters])

  // Append new auctions when data arrives
  useEffect(() => {
    if (auctionsData?.auctions) {
      if (page === 1) {
        setAllAuctions(auctionsData.auctions)
      } else {
        setAllAuctions(prev => {
          const existingIds = new Set(prev.map(a => a.id))
          const newAuctions = auctionsData.auctions.filter(a => !existingIds.has(a.id))
          return [...prev, ...newAuctions]
        })
      }
      setHasMore(auctionsData.pagination?.hasMore ?? false)
      isLoadingMore.current = false
    }
  }, [auctionsData, page])

  // Load more when scrolling to bottom
  useEffect(() => {
    if (inView && hasMore && !isLoading && !isFetching && !isLoadingMore.current) {
      isLoadingMore.current = true
      setPage(p => p + 1)
    }
  }, [inView, hasMore, isLoading, isFetching])

  // Handle filter changes - accepts full FilterState
  const handleFiltersChange = useCallback((newFilters: FilterState) => {
    play('click')
    setFilters(newFilters)
  }, [play])

  // Extract auctions from response
  const totalResults = auctionsData?.pagination?.total || allAuctions.length

  return (
    <div className="space-y-4">
      {/* Header with Stats */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Аукционы</h1>
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/20 border border-green-500/30"
          >
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm font-medium text-green-400">Live</span>
          </motion.div>
        </div>

        {/* Stats Bar with Skeleton */}
        {statsLoading ? (
          <StatsSkeleton />
        ) : stats && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-4 gap-2"
          >
            <div className="glass-card p-3 text-center">
              <div className="flex items-center justify-center gap-1 text-purple-400 mb-1">
                <Package className="w-4 h-4" />
              </div>
              <div className="text-lg font-bold text-white">{stats.activeAuctions}</div>
              <div className="text-xs text-gray-500">Активные</div>
            </div>
            <div className="glass-card p-3 text-center">
              <div className="flex items-center justify-center gap-1 text-green-400 mb-1">
                <Gavel className="w-4 h-4" />
              </div>
              <div className="text-lg font-bold text-white">{stats.totalBids}</div>
              <div className="text-xs text-gray-500">Ставок</div>
            </div>
            <div className="glass-card p-3 text-center">
              <div className="flex items-center justify-center gap-1 text-yellow-400 mb-1">
                <DollarSign className="w-4 h-4" />
              </div>
              <div className="text-lg font-bold text-white">{(stats.totalVolume / 1000).toFixed(1)}K</div>
              <div className="text-xs text-gray-500">Оборот</div>
            </div>
            <div className="glass-card p-3 text-center">
              <div className="flex items-center justify-center gap-1 text-blue-400 mb-1">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div className="text-lg font-bold text-white">{stats.completedAuctions}</div>
              <div className="text-xs text-gray-500">Продано</div>
            </div>
          </motion.div>
        )}
      </motion.div>

      {/* Fragment-style Filters */}
      <AuctionFilters
        filters={filters}
        onFiltersChange={handleFiltersChange}
        filterOptions={filterOptions || {
          collections: [],
          models: [],
          backdrops: [],
          symbols: [],
          rarities: [],
          sortOptions: [
            { value: 'ending', label: 'Скоро конец' },
            { value: 'price-low', label: 'Сначала дешевые' },
            { value: 'price-high', label: 'Сначала дорогие' },
            { value: 'popular', label: 'Популярные' },
            { value: 'newest', label: 'Новые' },
          ],
        }}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        totalResults={totalResults}
      />

      {/* Auctions Grid/List */}
      <motion.div
        layout
        className={
          viewMode === 'grid' 
            ? 'grid grid-cols-2 gap-3' 
            : 'space-y-3'
        }
      >
        <AnimatePresence mode="popLayout">
          {isLoading && page === 1 ? (
            // Fragment-style loading skeletons
            [...Array(6)].map((_, i) => (
              <motion.div
                key={`skeleton-${i}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`glass-card rounded-2xl overflow-hidden ${viewMode === 'list' ? 'flex gap-4' : ''}`}
              >
                <div className={`${viewMode === 'grid' ? 'aspect-square' : 'w-24 h-24'} bg-gradient-to-br from-white/5 to-white/10 relative overflow-hidden`}>
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                    animate={{ x: ['-100%', '100%'] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                  />
                </div>
                <div className="p-3 space-y-2 flex-1">
                  <div className="h-4 bg-white/10 rounded w-3/4 relative overflow-hidden">
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                      animate={{ x: ['-100%', '100%'] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                    />
                  </div>
                  <div className="h-3 bg-white/5 rounded w-1/2" />
                  <div className="h-6 bg-white/10 rounded w-1/3" />
                </div>
              </motion.div>
            ))
          ) : allAuctions.length > 0 ? (
            // Auction cards
            allAuctions.map((auction, index) => (
              <AuctionCardFragment
                key={auction.id}
                auction={auction}
                index={index}
                viewMode={viewMode}
              />
            ))
          ) : (
            // Empty state
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`glass-card p-8 text-center ${viewMode === 'grid' ? 'col-span-2' : ''}`}
            >
              <div className="text-6xl mb-4">🔍</div>
              <h3 className="text-xl font-bold text-white mb-2">Ничего не найдено</h3>
              <p className="text-gray-400">
                {filters.search 
                  ? 'Попробуйте изменить поисковый запрос' 
                  : Object.values(filters).some(v => v && v !== 'ending')
                    ? 'Попробуйте изменить фильтры'
                    : 'Пока нет активных аукционов'}
              </p>
              {Object.values(filters).some(v => v && v !== 'ending') && (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setFilters({
                    sort: 'ending',
                    search: ''
                  })}
                  className="mt-4 px-4 py-2 bg-purple-500/20 text-purple-400 rounded-xl hover:bg-purple-500/30 transition-colors"
                >
                  Сбросить фильтры
                </motion.button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Infinite Scroll Loader */}
      {hasMore && allAuctions.length > 0 && (
        <div 
          ref={loadMoreRef}
          className="flex justify-center py-8"
        >
          {isFetching ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-3 text-gray-400"
            >
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Загружаем ещё...</span>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center gap-2 text-gray-500"
            >
              <ChevronDown className="w-5 h-5 animate-bounce" />
              <span className="text-sm">Прокрутите для загрузки</span>
            </motion.div>
          )}
        </div>
      )}

      {/* End of Results */}
      {!hasMore && allAuctions.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-6 text-gray-500"
        >
          <span className="text-sm">Вы просмотрели все {totalResults} аукционов</span>
        </motion.div>
      )}
    </div>
  )
}
