import { motion } from 'framer-motion'

interface FragmentSkeletonProps {
  viewMode?: 'grid' | 'list'
  count?: number
}

// Shimmer animation
const shimmer = {
  initial: { x: '-100%' },
  animate: { x: '100%' },
  transition: {
    repeat: Infinity,
    duration: 1.5,
    ease: 'linear',
  },
}

function SkeletonCard({ viewMode = 'grid' }: { viewMode: 'grid' | 'list' }) {
  if (viewMode === 'list') {
    return (
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="flex gap-4 p-3">
          {/* Image skeleton */}
          <div className="relative w-24 h-24 rounded-xl bg-white/5 overflow-hidden flex-shrink-0">
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
              {...shimmer}
            />
          </div>
          
          {/* Content skeleton */}
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative h-5 w-32 bg-white/10 rounded overflow-hidden">
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                  {...shimmer}
                />
              </div>
              <div className="relative h-4 w-12 bg-white/5 rounded overflow-hidden">
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                  {...shimmer}
                />
              </div>
            </div>
            <div className="relative h-3 w-20 bg-white/5 rounded overflow-hidden">
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                {...shimmer}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="relative h-6 w-24 bg-white/10 rounded overflow-hidden">
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                  {...shimmer}
                />
              </div>
              <div className="relative h-5 w-16 bg-white/5 rounded overflow-hidden">
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                  {...shimmer}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      {/* Image skeleton */}
      <div className="relative aspect-square bg-white/5 overflow-hidden">
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
          {...shimmer}
        />
        
        {/* Badge skeleton */}
        <div className="absolute top-2 left-2 h-5 w-14 bg-black/30 rounded-full" />
        <div className="absolute top-2 right-2 h-5 w-10 bg-black/30 rounded-full" />
      </div>
      
      {/* Content skeleton */}
      <div className="p-3 space-y-3">
        {/* Title row */}
        <div className="flex items-center gap-2">
          <div className="relative h-5 flex-1 bg-white/10 rounded overflow-hidden">
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
              {...shimmer}
            />
          </div>
          <div className="relative h-4 w-12 bg-white/5 rounded overflow-hidden">
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
              {...shimmer}
            />
          </div>
        </div>
        
        {/* Collection skeleton */}
        <div className="relative h-3 w-20 bg-white/5 rounded overflow-hidden">
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
            {...shimmer}
          />
        </div>
        
        {/* Price row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative h-6 w-6 bg-yellow-500/20 rounded-full overflow-hidden">
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                {...shimmer}
              />
            </div>
            <div className="relative h-6 w-16 bg-white/10 rounded overflow-hidden">
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                {...shimmer}
              />
            </div>
          </div>
          <div className="relative h-5 w-14 bg-white/5 rounded overflow-hidden">
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
              {...shimmer}
            />
          </div>
        </div>
        
        {/* Timer skeleton */}
        <div className="relative h-4 w-full bg-white/5 rounded overflow-hidden">
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
            {...shimmer}
          />
        </div>
      </div>
    </div>
  )
}

export function FragmentSkeleton({ viewMode = 'grid', count = 6 }: FragmentSkeletonProps) {
  return (
    <>
      {[...Array(count)].map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
        >
          <SkeletonCard viewMode={viewMode} />
        </motion.div>
      ))}
    </>
  )
}

// Stats skeleton
export function StatsSkeleton() {
  return (
    <div className="grid grid-cols-4 gap-2">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="glass-card p-3 text-center">
          <div className="relative h-4 w-4 mx-auto mb-1 bg-white/10 rounded overflow-hidden">
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
              {...shimmer}
            />
          </div>
          <div className="relative h-6 w-12 mx-auto mb-1 bg-white/10 rounded overflow-hidden">
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
              {...shimmer}
            />
          </div>
          <div className="relative h-3 w-16 mx-auto bg-white/5 rounded overflow-hidden">
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
              {...shimmer}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

export default FragmentSkeleton
