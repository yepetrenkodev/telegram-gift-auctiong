// ============================================
// 🎯 Type Definitions for Telegram Gift Auction
// ============================================

// ==================== ENUMS ====================

export enum AuctionStatus {
  DRAFT = 'draft',
  SCHEDULED = 'scheduled',
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

export enum RoundStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  PROCESSING = 'processing',
  COMPLETED = 'completed'
}

export enum BidStatus {
  ACTIVE = 'active',
  OUTBID = 'outbid',
  WON = 'won',
  REFUNDED = 'refunded'
}

export enum UserRank {
  BRONZE = 'bronze',
  SILVER = 'silver',
  GOLD = 'gold',
  DIAMOND = 'diamond',
  WHALE = 'whale',
  LEGEND = 'legend'
}

export enum TransactionType {
  DEPOSIT = 'deposit',
  WITHDRAWAL = 'withdrawal',
  BID_LOCK = 'bid_lock',
  BID_UNLOCK = 'bid_unlock',
  WIN_DEDUCT = 'win_deduct',
  REFUND = 'refund',
  BONUS = 'bonus',
  TRANSFER = 'transfer'
}

// ==================== USER ====================

export interface IUser {
  _id: string;
  telegramId: string;
  username?: string;
  firstName: string;
  lastName?: string;
  photoUrl?: string;
  rank: UserRank;
  stats: IUserStats;
  isBot?: boolean; // Bot marker for stress testing
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserStats {
  totalBids: number;
  totalWins: number;
  totalSpent: number;
  auctionsParticipated: number;
  winRate: number;
  currentStreak: number;
  bestStreak: number;
}

// ==================== BALANCE ====================

export interface IBalance {
  _id: string;
  userId: string;
  available: number;
  locked: number;
  total: number;
  updatedAt: Date;
}

export interface ITransaction {
  _id: string;
  balanceId: string;
  userId: string;
  type: TransactionType;
  amount: number;
  reference?: string;
  referenceId?: string;
  balanceBefore: number;
  balanceAfter: number;
  lockedBefore: number;
  lockedAfter: number;
  description?: string;
  createdAt: Date;
}

// ==================== AUCTION ====================

export interface IGift {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  totalSupply: number;
  // Fragment-style attributes
  model?: string;
  backdrop?: string;
  symbol?: string;
  giftCollection?: string;
  number?: number;
  timesSold?: number;
  floorPrice?: number;
  attributes?: Record<string, unknown>;
}

export interface IAuction {
  _id: string;
  title: string;
  description: string;
  gift: IGift;
  status: AuctionStatus;
  
  // Configuration
  totalGifts: number;
  totalRounds: number;
  giftsPerRound: number;
  winnersPerRound: number;
  minBidAmount: number;
  bidIncrement: number;
  
  // Anti-sniping
  antiSnipeThresholdSeconds: number;
  antiSnipeExtensionSeconds: number;
  maxAntiSnipeExtensions: number;
  
  // Timing
  scheduledStartAt?: Date;
  startedAt?: Date;
  endsAt?: Date;
  completedAt?: Date;
  
  // Stats
  currentRound: number;
  totalBids: number;
  totalParticipants: number;
  highestBid: number;
  
  // Test flags
  isStressTest?: boolean;
  
  createdAt: Date;
  updatedAt: Date;
}

// ==================== ROUND ====================

export interface IRound {
  _id: string;
  auctionId: string;
  roundNumber: number;
  status: RoundStatus;
  
  giftsAvailable: number;
  
  // Timing
  startsAt: Date;
  endsAt: Date;
  originalEndsAt: Date;
  extensionCount: number;
  
  // Results
  winningBids: string[];
  totalBids: number;
  
  createdAt: Date;
  updatedAt: Date;
}

// ==================== BID ====================

export interface IBid {
  _id: string;
  auctionId: string;
  roundId: string;
  userId: string;
  
  amount: number;
  status: BidStatus;
  
  // Auto-bid reference
  isAutoBid: boolean;
  autoBidConfigId?: string;
  
  // Timing
  placedAt: Date;
  processedAt?: Date;
  
  // Anti-snipe tracking
  triggeredExtension: boolean;
  
  createdAt: Date;
}

// ==================== AUTO-BID ====================

export interface IAutoBidConfig {
  _id: string;
  userId: string;
  auctionId: string;
  
  isActive: boolean;
  maxBidAmount: number;
  currentBidAmount: number;
  incrementAmount: number;
  maxTotalSpend: number;
  totalSpent: number;
  
  createdAt: Date;
  updatedAt: Date;
}

// ==================== API ====================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: Date;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ==================== SOCKET EVENTS ====================

export interface SocketEvents {
  // Client -> Server
  'auction:join': { auctionId: string };
  'auction:leave': { auctionId: string };
  'bid:place': { auctionId: string; roundId: string; amount: number };
  
  // Server -> Client
  'auction:update': IAuction;
  'round:update': IRound;
  'bid:new': IBid & { user: Partial<IUser> };
  'bid:outbid': { bidId: string; newBid: IBid };
  'round:ending': { roundId: string; secondsLeft: number };
  'round:extended': { roundId: string; newEndsAt: Date; extensionCount: number };
  'round:completed': { roundId: string; winners: Array<{ userId: string; bidId: string; amount: number }> };
  'auction:completed': { auctionId: string };
  'participants:update': { auctionId: string; count: number };
  'error': { message: string; code: string };
}

// ==================== SERVICE RESULTS ====================

export interface PlaceBidResult {
  success: boolean;
  bid?: unknown;
  error?: string;
  triggeredExtension?: boolean;
  newEndsAt?: Date;
}

export interface RoundProcessResult {
  roundId: string;
  winners: Array<{
    userId: string;
    bidId: string;
    amount: number;
  }>;
  refundedBids: string[];
  nextRound?: IRound;
}
