import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Filter, X, ChevronDown, Grid, List, Search, SlidersHorizontal } from 'lucide-react'

export interface FilterOption {
  value: string
  label: string
  count?: number
  imageUrl?: string
}

export interface FilterState {
  collection?: string
  model?: string
  backdrop?: string
  symbol?: string
  rarity?: string
  sort: string
  search?: string
}

interface AuctionFiltersProps {
  filters: FilterState
  onFiltersChange: (filters: FilterState) => void
  filterOptions: {
    collections: FilterOption[]
    models: FilterOption[]
    backdrops: FilterOption[]
    symbols: FilterOption[]
    rarities: FilterOption[]
    sortOptions: FilterOption[]
  }
  viewMode: 'grid' | 'list'
  onViewModeChange: (mode: 'grid' | 'list') => void
  totalResults?: number
}

export function AuctionFilters({
  filters,
  onFiltersChange,
  filterOptions,
  viewMode,
  onViewModeChange,
  totalResults
}: AuctionFiltersProps) {
  const [showFilters, setShowFilters] = useState(false)
  const [searchValue, setSearchValue] = useState(filters.search || '')
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)

  const activeFiltersCount = [
    filters.collection,
    filters.model,
    filters.backdrop,
    filters.symbol,
    filters.rarity
  ].filter(Boolean).length

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchValue !== filters.search) {
        onFiltersChange({ ...filters, search: searchValue })
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchValue])

  const handleFilterChange = (key: keyof FilterState, value: string | undefined) => {
    onFiltersChange({ ...filters, [key]: value })
    setActiveDropdown(null)
  }

  const clearAllFilters = () => {
    onFiltersChange({
      sort: 'ending',
      search: ''
    })
    setSearchValue('')
  }

  const renderDropdown = (
    key: keyof FilterState,
    label: string,
    options: FilterOption[]
  ) => {
    const currentValue = filters[key]
    const selectedOption = options.find(o => o.value === currentValue)
    const isOpen = activeDropdown === key

    return (
      <div className="relative">
        <button
          onClick={() => setActiveDropdown(isOpen ? null : key)}
          className={`
            flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all
            ${currentValue 
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' 
              : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
            }
          `}
        >
          <span>{selectedOption?.label || label}</span>
          <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-full left-0 mt-2 w-56 max-h-64 overflow-y-auto bg-gray-900 border border-white/10 rounded-xl shadow-xl z-50"
            >
              <button
                onClick={() => handleFilterChange(key, undefined)}
                className={`
                  w-full px-4 py-2.5 text-left text-sm transition-colors
                  ${!currentValue ? 'bg-purple-500/20 text-purple-300' : 'text-gray-400 hover:bg-white/5'}
                `}
              >
                All {label}s
              </button>
              {options.map(option => (
                <button
                  key={option.value}
                  onClick={() => handleFilterChange(key, option.value)}
                  className={`
                    w-full px-4 py-2.5 text-left text-sm flex items-center justify-between transition-colors
                    ${currentValue === option.value 
                      ? 'bg-purple-500/20 text-purple-300' 
                      : 'text-gray-300 hover:bg-white/5'
                    }
                  `}
                >
                  <span className="flex items-center gap-2">
                    {option.imageUrl && (
                      <img src={option.imageUrl} alt="" className="w-6 h-6 rounded" />
                    )}
                    {option.label}
                  </span>
                  {option.count !== undefined && (
                    <span className="text-gray-500 text-xs">{option.count}</span>
                  )}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-3">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="Search gifts..."
            className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 transition-colors"
          />
        </div>

        {/* Filter Toggle */}
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowFilters(!showFilters)}
          className={`
            flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all
            ${showFilters || activeFiltersCount > 0
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
              : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
            }
          `}
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span className="hidden sm:inline">Filters</span>
          {activeFiltersCount > 0 && (
            <span className="w-5 h-5 flex items-center justify-center bg-purple-500 text-white text-xs rounded-full">
              {activeFiltersCount}
            </span>
          )}
        </motion.button>

        {/* View Toggle */}
        <div className="flex bg-white/5 rounded-xl p-1">
          <button
            onClick={() => onViewModeChange('grid')}
            className={`p-2 rounded-lg transition-colors ${
              viewMode === 'grid' ? 'bg-purple-500 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Grid className="w-4 h-4" />
          </button>
          <button
            onClick={() => onViewModeChange('list')}
            className={`p-2 rounded-lg transition-colors ${
              viewMode === 'list' ? 'bg-purple-500 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Expanded Filters */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="glass-card p-4 space-y-4">
              {/* Filter Dropdowns */}
              <div className="flex flex-wrap gap-2">
                {filterOptions.collections.length > 0 && 
                  renderDropdown('collection', 'Collection', filterOptions.collections)
                }
                {filterOptions.models.length > 0 && 
                  renderDropdown('model', 'Model', filterOptions.models)
                }
                {filterOptions.backdrops.length > 0 && 
                  renderDropdown('backdrop', 'Backdrop', filterOptions.backdrops)
                }
                {filterOptions.symbols.length > 0 && 
                  renderDropdown('symbol', 'Symbol', filterOptions.symbols)
                }
                {filterOptions.rarities.length > 0 && 
                  renderDropdown('rarity', 'Rarity', filterOptions.rarities)
                }
              </div>

              {/* Sort & Clear */}
              <div className="flex items-center justify-between pt-2 border-t border-white/10">
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 text-sm">Sort by:</span>
                  {renderDropdown('sort', 'Sort', filterOptions.sortOptions)}
                </div>

                {activeFiltersCount > 0 && (
                  <button
                    onClick={clearAllFilters}
                    className="flex items-center gap-1 text-sm text-red-400 hover:text-red-300 transition-colors"
                  >
                    <X className="w-4 h-4" />
                    Clear all
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results Count & Active Filters */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-400">
          {totalResults !== undefined && (
            <span>{totalResults.toLocaleString()} {totalResults === 1 ? 'item' : 'items'}</span>
          )}
        </div>

        {/* Active Filter Pills */}
        {activeFiltersCount > 0 && (
          <div className="flex flex-wrap gap-2">
            {filters.collection && (
              <FilterPill
                label={filters.collection}
                onRemove={() => handleFilterChange('collection', undefined)}
              />
            )}
            {filters.model && (
              <FilterPill
                label={filters.model}
                onRemove={() => handleFilterChange('model', undefined)}
              />
            )}
            {filters.rarity && (
              <FilterPill
                label={filters.rarity}
                onRemove={() => handleFilterChange('rarity', undefined)}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function FilterPill({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      onClick={onRemove}
      className="flex items-center gap-1 px-2 py-1 bg-purple-500/20 text-purple-300 rounded-lg text-xs hover:bg-purple-500/30 transition-colors"
    >
      <span>{label}</span>
      <X className="w-3 h-3" />
    </motion.button>
  )
}
