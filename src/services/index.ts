// Core services (Stage 1)
export { balanceService, BalanceService } from './BalanceService';
export { auctionService, AuctionService } from './AuctionService';
export { bidService, BidService } from './BidService';

// Real-time services (Stage 2)
export { socketService, SocketEvents } from './SocketService';
export type { BidPlacedPayload, LeaderboardPayload, TimerPayload, RoundEndedPayload } from './SocketService';
export { redisService } from './RedisService';
export { leaderboardService } from './LeaderboardService';
export type { LeaderboardPosition } from './LeaderboardService';

export { timerService } from './TimerService';

// Auto-bid service
export { autoBidService, AutoBidService } from './AutoBidService';

// Monitoring & Audit (Stage 3)
export { default as metricsService } from './MetricsService';
export { auditService, AuditEventType } from './AuditService';

// Auction UX services (Stage 4)
export { watchlistService } from './WatchlistService';
export { activityFeedService } from './ActivityFeedService';
export { auctionSearchService } from './AuctionSearchService';
