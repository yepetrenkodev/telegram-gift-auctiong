import { useEffect, useRef, useCallback, useState } from 'react'
import { useInView } from 'react-intersection-observer'

interface UseInfiniteScrollOptions {
  threshold?: number
  rootMargin?: string
  enabled?: boolean
  onLoadMore: () => void | Promise<void>
  hasMore: boolean
  isLoading: boolean
}

export function useInfiniteScroll({
  threshold = 0.1,
  rootMargin = '100px',
  enabled = true,
  onLoadMore,
  hasMore,
  isLoading,
}: UseInfiniteScrollOptions) {
  const loadingRef = useRef(false)
  const [loadMoreError, setLoadMoreError] = useState<Error | null>(null)

  const { ref, inView } = useInView({
    threshold,
    rootMargin,
    skip: !enabled || !hasMore || isLoading,
  })

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore || isLoading) return

    loadingRef.current = true
    setLoadMoreError(null)

    try {
      await onLoadMore()
    } catch (error) {
      setLoadMoreError(error as Error)
      console.error('Failed to load more:', error)
    } finally {
      loadingRef.current = false
    }
  }, [onLoadMore, hasMore, isLoading])

  useEffect(() => {
    if (inView && enabled && hasMore && !isLoading) {
      loadMore()
    }
  }, [inView, enabled, hasMore, isLoading, loadMore])

  return {
    ref,
    inView,
    loadMore,
    error: loadMoreError,
    isLoadingMore: loadingRef.current,
  }
}

// Simple scroll position restoration
export function useScrollRestoration(key: string) {
  const scrollPositionRef = useRef(0)

  useEffect(() => {
    // Restore scroll position
    const savedPosition = sessionStorage.getItem(`scroll_${key}`)
    if (savedPosition) {
      window.scrollTo(0, parseInt(savedPosition, 10))
    }

    // Save scroll position on unmount
    return () => {
      sessionStorage.setItem(`scroll_${key}`, String(window.scrollY))
    }
  }, [key])

  const saveScrollPosition = useCallback(() => {
    scrollPositionRef.current = window.scrollY
    sessionStorage.setItem(`scroll_${key}`, String(window.scrollY))
  }, [key])

  return { saveScrollPosition }
}

// Pull to refresh hook
export function usePullToRefresh(onRefresh: () => Promise<void>) {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const touchStartY = useRef(0)
  const isAtTop = useRef(true)

  const threshold = 80

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      touchStartY.current = e.touches[0].clientY
      isAtTop.current = window.scrollY <= 0
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (!isAtTop.current || isRefreshing) return

      const touchY = e.touches[0].clientY
      const diff = touchY - touchStartY.current

      if (diff > 0) {
        setPullDistance(Math.min(diff * 0.5, threshold * 1.5))
      }
    }

    const handleTouchEnd = async () => {
      if (pullDistance >= threshold && !isRefreshing) {
        setIsRefreshing(true)
        try {
          await onRefresh()
        } finally {
          setIsRefreshing(false)
        }
      }
      setPullDistance(0)
    }

    document.addEventListener('touchstart', handleTouchStart, { passive: true })
    document.addEventListener('touchmove', handleTouchMove, { passive: true })
    document.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleTouchEnd)
    }
  }, [onRefresh, pullDistance, isRefreshing, threshold])

  return {
    isRefreshing,
    pullDistance,
    threshold,
    progress: Math.min(pullDistance / threshold, 1),
  }
}

export default useInfiniteScroll
