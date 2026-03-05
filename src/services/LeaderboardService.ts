import { Bid, User } from '../models';
import { socketService, LeaderboardPayload } from './SocketService';
import { redisService } from './RedisService';
import logger from '../utils/logger';

/**
 * 📊 Leaderboard Service
 * 
 * Real-time leaderboard management:
 * - Calculate and cache rankings
 * - Broadcast updates
 * - Track position changes
 */

export interface LeaderboardPosition {
  oduserId: string;
  odrank: number;
  userName: string;
  userRank: string;
  avatarUrl?: string;
  amount: number;
  bidCount: number;
  lastBidAt: Date;
  isWinning: boolean;
  previousRank?: number;
  rankChange?: 'up' | 'down' | 'same' | 'new';
}

class LeaderboardService {
  private leaderboardCache: Map<string, LeaderboardPosition[]> = new Map();

  /**
   * Get cache key for leaderboard
   */
  private getCacheKey(auctionId: string, roundNumber: number): string {
    return `${auctionId}:${roundNumber}`;
  }

  /**
   * Update leaderboard after a bid
   */
  async updateAfterBid(
    auctionId: string,
    roundNumber: number,
    winnersPerRound: number = 10
  ): Promise<LeaderboardPosition[]> {
    try {
      // Get current round bids aggregated by user
      const leaderboard = await this.calculateLeaderboard(auctionId, roundNumber, winnersPerRound);

      // Cache in memory
      const cacheKey = this.getCacheKey(auctionId, roundNumber);
      const previousLeaderboard = this.leaderboardCache.get(cacheKey) || [];
      
      // Calculate rank changes
      const leaderboardWithChanges = this.calculateRankChanges(leaderboard, previousLeaderboard);
      
      // Update cache
      this.leaderboardCache.set(cacheKey, leaderboardWithChanges);

      // Update Redis leaderboard
      for (const entry of leaderboardWithChanges) {
        await redisService.updateLeaderboard(
          auctionId,
          roundNumber,
          entry.oduserId,
          entry.amount
        );
      }

      // Broadcast to connected clients
      this.broadcastLeaderboard(auctionId, roundNumber, leaderboardWithChanges, winnersPerRound);

      return leaderboardWithChanges;
    } catch (error) {
      logger.error('Error updating leaderboard:', error);
      return [];
    }
  }

  /**
   * Calculate leaderboard from database
   */
  private async calculateLeaderboard(
    auctionId: string,
    roundNumber: number,
    limit: number = 50
  ): Promise<LeaderboardPosition[]> {
    // Aggregate bids by user, get max bid for each
    const aggregation = await Bid.aggregate([
      {
        $match: {
          auctionId: auctionId,
          roundNumber: roundNumber,
          status: 'active',
        },
      },
      {
        $group: {
          _id: '$userId',
          maxAmount: { $max: '$amount' },
          bidCount: { $sum: 1 },
          lastBidAt: { $max: '$createdAt' },
        },
      },
      {
        $sort: { maxAmount: -1, lastBidAt: 1 }, // Higher amount first, earlier bid wins ties
      },
      {
        $limit: limit,
      },
    ]);

    // Fetch user details
    const userIds = aggregation.map(a => a._id);
    const users = await User.find({ _id: { $in: userIds } }).lean();
    const userMap = new Map(users.map(u => [u._id.toString(), u]));

    // Build leaderboard
    const leaderboard: LeaderboardPosition[] = aggregation.map((entry, index) => {
      const user = userMap.get(entry._id.toString());
      return {
        oduserId: entry._id.toString(),
        odrank: index + 1,
        userName: user ? `${user.firstName} ${user.lastName || ''}`.trim() : 'Unknown',
        userRank: user?.rank || 'bronze',
        avatarUrl: user?.photoUrl,
        amount: entry.maxAmount,
        bidCount: entry.bidCount,
        lastBidAt: entry.lastBidAt,
        isWinning: index < 10, // Top 10 are winning
      };
    });

    return leaderboard;
  }

  /**
   * Calculate rank changes compared to previous leaderboard
   */
  private calculateRankChanges(
    current: LeaderboardPosition[],
    previous: LeaderboardPosition[]
  ): LeaderboardPosition[] {
    const previousRanks = new Map(previous.map(p => [p.oduserId, p.odrank]));

    return current.map(entry => {
      const prevRank = previousRanks.get(entry.oduserId);

      let rankChange: 'up' | 'down' | 'same' | 'new' = 'same';
      if (prevRank === undefined) {
        rankChange = 'new';
      } else if (entry.odrank < prevRank) {
        rankChange = 'up';
      } else if (entry.odrank > prevRank) {
        rankChange = 'down';
      }

      return {
        ...entry,
        previousRank: prevRank,
        rankChange,
      };
    });
  }

  /**
   * Broadcast leaderboard update
   */
  private broadcastLeaderboard(
    auctionId: string,
    roundNumber: number,
    leaderboard: LeaderboardPosition[],
    winnersPerRound: number
  ): void {
    const payload: LeaderboardPayload = {
      auctionId,
      roundNumber,
      topBidders: leaderboard.slice(0, winnersPerRound).map(entry => ({
        oduserId: entry.oduserId,
        odrank: entry.odrank,
        userName: entry.userName,
        userRank: entry.userRank,
        amount: entry.amount,
        bidCount: entry.bidCount,
        lastBidAt: entry.lastBidAt,
      })),
      totalBidders: leaderboard.length,
      totalBids: leaderboard.reduce((sum, e) => sum + e.bidCount, 0),
      timestamp: new Date(),
    };

    socketService.broadcastLeaderboard(payload);
  }

  /**
   * Get current leaderboard (from cache or calculate)
   */
  async getLeaderboard(
    auctionId: string,
    roundNumber: number,
    limit: number = 50
  ): Promise<LeaderboardPosition[]> {
    const cacheKey = this.getCacheKey(auctionId, roundNumber);

    // Try cache first
    const cached = this.leaderboardCache.get(cacheKey);
    if (cached && cached.length > 0) {
      return cached.slice(0, limit);
    }

    // Calculate fresh
    const leaderboard = await this.calculateLeaderboard(auctionId, roundNumber, limit);
    this.leaderboardCache.set(cacheKey, leaderboard);

    return leaderboard;
  }

  /**
   * Get user's position in leaderboard
   */
  async getUserPosition(
    auctionId: string,
    roundNumber: number,
    userId: string
  ): Promise<LeaderboardPosition | null> {
    const leaderboard = await this.getLeaderboard(auctionId, roundNumber, 100);
    return leaderboard.find(e => e.oduserId === userId) || null;
  }

  /**
   * Check if user is in winning positions
   */
  async isUserWinning(
    auctionId: string,
    roundNumber: number,
    userId: string,
    winnersPerRound: number = 10
  ): Promise<boolean> {
    const position = await this.getUserPosition(auctionId, roundNumber, userId);
    return position !== null && position.odrank <= winnersPerRound;
  }

  /**
   * Get users who were outbid
   */
  async getOutbidUsers(
    auctionId: string,
    roundNumber: number,
    newBidUserId: string,
    winnersPerRound: number = 10
  ): Promise<string[]> {
    const leaderboard = await this.getLeaderboard(auctionId, roundNumber, winnersPerRound + 5);

    // Find users who dropped out of top 10 due to new bid
    const outbidUsers: string[] = [];

    for (const entry of leaderboard) {
      if (entry.oduserId !== newBidUserId && 
          entry.previousRank !== undefined &&
          entry.previousRank <= winnersPerRound &&
          entry.odrank > winnersPerRound) {
        outbidUsers.push(entry.oduserId);
      }
    }

    return outbidUsers;
  }

  /**
   * Clear leaderboard cache for auction
   */
  clearCache(auctionId: string, roundNumber?: number): void {
    if (roundNumber !== undefined) {
      this.leaderboardCache.delete(this.getCacheKey(auctionId, roundNumber));
    } else {
      // Clear all rounds for this auction
      for (const key of this.leaderboardCache.keys()) {
        if (key.startsWith(auctionId)) {
          this.leaderboardCache.delete(key);
        }
      }
    }
  }

  /**
   * Get leaderboard stats
   */
  async getStats(auctionId: string, roundNumber: number): Promise<{
    totalBidders: number;
    totalBids: number;
    highestBid: number;
    averageBid: number;
  }> {
    const leaderboard = await this.getLeaderboard(auctionId, roundNumber, 1000);

    if (leaderboard.length === 0) {
      return { totalBidders: 0, totalBids: 0, highestBid: 0, averageBid: 0 };
    }

    const totalBids = leaderboard.reduce((sum, e) => sum + e.bidCount, 0);
    const totalAmount = leaderboard.reduce((sum, e) => sum + e.amount, 0);

    return {
      totalBidders: leaderboard.length,
      totalBids,
      highestBid: leaderboard[0]?.amount || 0,
      averageBid: leaderboard.length > 0 ? totalAmount / leaderboard.length : 0,
    };
  }
}

export const leaderboardService = new LeaderboardService();
export default leaderboardService;
