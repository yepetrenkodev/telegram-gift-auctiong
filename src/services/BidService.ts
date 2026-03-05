import { achievementService } from './AchievementService';
import mongoose from 'mongoose';
import { Bid, Round, Auction, User, IBidDocument, IUserDocument } from '../models';
import { BidStatus, PlaceBidResult, UserRank, IUserStats } from '../types';
import { balanceService } from './BalanceService';
import { auctionService } from './AuctionService';
import { socketService, BidPlacedPayload } from './SocketService';
import { leaderboardService } from './LeaderboardService';
import { timerService } from './TimerService';
import { telegramBotService } from '../bot/TelegramBot';
import logger from '../utils/logger';
import { redisService } from './RedisService';


// Helper function to calculate user rank
function calculateUserRank(stats: IUserStats): UserRank {
  const { totalWins, totalSpent, winRate } = stats;

  if (totalWins >= 50 && winRate >= 30) return UserRank.LEGEND;
  if (totalSpent >= 10000 || totalWins >= 30) return UserRank.WHALE;
  if (totalSpent >= 5000 || totalWins >= 15) return UserRank.DIAMOND;
  if (totalSpent >= 1000 || totalWins >= 5) return UserRank.GOLD;
  if (totalSpent >= 100 || totalWins >= 1) return UserRank.SILVER;
  return UserRank.BRONZE;
}

/**
 * 💸 Bid Service
 * 
 * Handles all bid operations:
 * - Place new bids
 * - Update existing bids
 * - Process outbid scenarios
 * - Handle anti-sniping triggers
 */
export class BidService {
  /**
   * Place a new bid
   * 
   * This is the core bidding logic that handles:
   * 1. Validation (auction active, round active, minimum bid)
   * 2. Balance locking
   * 3. Outbid processing
   * 4. Anti-snipe extension
   */
  async placeBid(
    userId: string,
    auctionId: string,
    roundId: string,
    amount: number,
    isAutoBid = false,
    autoBidConfigId?: string
  ): Promise<PlaceBidResult> {
    // Acquire distributed lock to prevent race conditions
    const lockId = await redisService.acquireBidLock(auctionId);
    if (!lockId) {
      logger.warn(`Failed to acquire bid lock for auction ${auctionId}, user ${userId}`);
      return { success: false, error: 'Server busy, please try again' };
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1. Validate auction and round
      const [auction, round] = await Promise.all([
        Auction.findById(auctionId).session(session),
        Round.findById(roundId).session(session),
      ]);

      if (!auction) {
        await session.abortTransaction();
        return { success: false, error: 'Auction not found' };
      }

      if (!auction.isActive()) {
        await session.abortTransaction();
        return { success: false, error: 'Auction is not active' };
      }

      if (!round) {
        await session.abortTransaction();
        return { success: false, error: 'Round not found' };
      }

      if (!round.canAcceptBids()) {
        await session.abortTransaction();
        const remainingMs = round.getRemainingTime();
        if (remainingMs <= 3000 && remainingMs > 0) {
          return { success: false, error: 'Раунд заканчивается. Ставки больше не принимаются.' };
        }
        return { success: false, error: 'Round is not accepting bids' };
      }

      // 2. Validate bid amount
      if (amount < auction.minBidAmount) {
        await session.abortTransaction();
        return {
          success: false,
          error: `Minimum bid is ${auction.minBidAmount}`,
        };
      }

      // Check against current highest bid
      const highestBid = await Bid.getHighestBidInRound(roundId);
      
      // DEBUG: Log highest bid info
      logger.info(`Highest bid check: userId=${userId}, highestBid=${highestBid ? `id=${highestBid._id}, bidUserId=${highestBid.userId}, amount=${highestBid.amount}` : 'none'}`);
      
      // 3. Check if user is already the highest bidder (cannot outbid yourself)
      if (highestBid && highestBid.userId.toString() === userId) {
        await session.abortTransaction();
        logger.info(`Blocked self-outbid for user ${userId}`);
        return {
          success: false,
          error: 'Вы уже лидер! Подождите пока вашу ставку перебьют.',
        };
      }
      
      if (highestBid && amount <= highestBid.amount) {
        await session.abortTransaction();
        return {
          success: false,
          error: `Bid must be higher than current highest bid: ${highestBid.amount}`,
        };
      }

      // Check bid increment
      if (highestBid) {
        const minRequired = highestBid.amount + auction.bidIncrement;
        if (amount < minRequired) {
          await session.abortTransaction();
          return {
            success: false,
            error: `Minimum bid is ${minRequired} (current: ${highestBid.amount} + increment: ${auction.bidIncrement})`,
          };
        }
      }

      // 4. Check if user has existing bid in this round (but not the highest - they've been outbid)
      const existingBid = await Bid.findUserBidInRound(roundId, userId);
      let amountToLock = amount;

      if (existingBid) {
        // User was outbid and is now placing a new higher bid
        amountToLock = amount - existingBid.amount;

        if (amountToLock <= 0) {
          await session.abortTransaction();
          return {
            success: false,
            error: `New bid must be higher than your current bid: ${existingBid.amount}`,
          };
        }

        // Mark old bid as outbid (self-outbid)
        existingBid.status = BidStatus.OUTBID;
        existingBid.processedAt = new Date();
        await existingBid.save({ session });
      }

      // 4. Lock funds
      const lockResult = await balanceService.lockFunds(
        userId,
        amountToLock,
        `bid:${auctionId}:${roundId}`
      );

      if (!lockResult.success) {
        await session.abortTransaction();
        return { success: false, error: lockResult.error };
      }

      // 5. Check for anti-snipe trigger BEFORE creating bid
      const shouldExtend = await auctionService.shouldTriggerAntiSnipe(roundId);
      let triggeredExtension = false;
      let newEndsAt: Date | undefined;

      // 6. Create the bid
      const now = new Date();
      const bid = new Bid({
        auctionId,
        roundId,
        userId,
        amount,
        status: BidStatus.ACTIVE,
        isAutoBid,
        autoBidConfigId,
        placedAt: now,
        triggeredExtension: false, // Will update after extension check
      });

      await bid.save({ session });

      // 7. Handle anti-snipe extension
      if (shouldExtend) {
        const extensionResult = await auctionService.extendRound(roundId);
        if (extensionResult.extended && extensionResult.round) {
          triggeredExtension = true;
          newEndsAt = extensionResult.round.endsAt;
          bid.triggeredExtension = true;
          await bid.save({ session });
        }
      }

      // 8. Process outbids for other users
      const outbidUserIds = await this.processOutbids(roundId, bid._id.toString(), userId, session);

      // 9. Update round stats
      round.totalBids += 1;
      await round.save({ session });

      // 10. Update user stats
      const user = await User.findByIdAndUpdate(
        userId,
        { $inc: { 'stats.totalBids': 1 } },
        { session, new: true }
      );

      await session.commitTransaction();

      // ==================== REAL-TIME UPDATES ====================
      
      // Get user position in leaderboard
      const leaderboard = await leaderboardService.updateAfterBid(
        auctionId,
        round.roundNumber,
        auction.winnersPerRound
      );
      const userPosition = leaderboard.find(e => e.oduserId === userId);

      // Broadcast bid placed
      const bidPayload: BidPlacedPayload = {
        auctionId,
        roundNumber: round.roundNumber,
        bidId: bid._id.toString(),
        userId,
        userName: user ? `${user.firstName} ${user.lastName || ''}`.trim() : 'Anonymous',
        userRank: user?.rank || 'bronze',
        amount,
        position: userPosition?.odrank || 0,
        totalBids: round.totalBids,
        timestamp: new Date(),
        isTopTen: userPosition ? userPosition.odrank <= auction.winnersPerRound : false,
      };
      socketService.broadcastBidPlaced(bidPayload);

      // Notify outbid users via socket and Telegram
      for (const outbidUserId of outbidUserIds) {
        const outbidUserPosition = leaderboard.find(e => e.oduserId === outbidUserId);
        
        socketService.broadcastOutbid(outbidUserId, {
          auctionId,
          roundNumber: round.roundNumber,
          outbidBy: bidPayload.userName || 'Anonymous',
          newAmount: amount,
          yourAmount: outbidUserPosition?.amount || 0,
          newPosition: outbidUserPosition?.odrank || 99,
        });

        // Send Telegram notification
        const outbidUser = await User.findById(outbidUserId);
        if (outbidUser) {
          await telegramBotService.sendOutbidNotification(
            outbidUser.telegramId,
            auction.title,
            amount,
            bidPayload.userName || 'Anonymous'
          );
        }
      }

      // Broadcast timer extension if triggered
      if (triggeredExtension && newEndsAt) {
        await timerService.extendTimer(
          auctionId,
          round.roundNumber,
          newEndsAt,
          round.extensionCount,
          userId
        );
      }

      logger.info(
        `Bid placed: ${bid._id} by user ${userId} for ${amount} in round ${roundId}. Anti-snipe: ${triggeredExtension}`
      );

      // Trigger auto-bids from other users (only for manual bids to prevent infinite loop)
      if (!isAutoBid) {
        // Import here to avoid circular dependency
        const { autoBidService } = await import('./AutoBidService');
        // Run async to not block the response
        autoBidService.triggerAutoBidsAfterBid(
          auctionId,
          roundId,
          amount,
          userId,
          auction.bidIncrement
        ).catch(err => logger.error('Error triggering auto-bids:', err));
      }

      return {
        success: true,
        bid: bid.toJSON() as unknown as IBidDocument,
        triggeredExtension,
        newEndsAt,
      };
    } catch (error) {
      await session.abortTransaction();
      logger.error(`Failed to place bid:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    } finally {
      session.endSession();
      // Always release the distributed lock
      if (lockId) {
        await redisService.releaseBidLock(auctionId, lockId);
      }
    }
  }

  /**
   * Process outbids - mark lower bids as outbid and unlock their funds
   * Returns array of user IDs who were outbid
   */
  private async processOutbids(
    roundId: string,
    currentBidId: string,
    currentUserId: string,
    session: mongoose.ClientSession
  ): Promise<string[]> {
    // Find all active bids in this round that are not the current bid
    const outbidBids = await Bid.find({
      roundId,
      _id: { $ne: currentBidId },
      userId: { $ne: currentUserId },
      status: BidStatus.ACTIVE,
    }).session(session);

    const outbidUserIds: string[] = [];

    for (const bid of outbidBids) {
      bid.status = BidStatus.OUTBID;
      bid.processedAt = new Date();
      await bid.save({ session });

      // Unlock their funds
      await balanceService.unlockFunds(
        bid.userId,
        bid.amount,
        `outbid:${bid._id}`
      );

      outbidUserIds.push(bid.userId);
      logger.info(`User ${bid.userId} outbid. Refunded: ${bid.amount}`);
    }

    return outbidUserIds;
  }

  /**
   * Get user's current bid in a round
   */
  async getUserBidInRound(userId: string, roundId: string): Promise<IBidDocument | null> {
    return Bid.findUserBidInRound(roundId, userId);
  }

  /**
   * Get top bids in a round
   */
  async getTopBids(roundId: string, limit = 10): Promise<IBidDocument[]> {
    return Bid.findTopBids(roundId, limit);
  }

  /**
   * Get all bids in a round
   */
  async getRoundBids(roundId: string): Promise<IBidDocument[]> {
    return Bid.findByRound(roundId);
  }

  /**
   * Get user's bid history
   */
  async getUserBids(userId: string, limit = 50): Promise<IBidDocument[]> {
    return Bid.findUserBids(userId, limit);
  }

  /**
   * Get bid by ID
   */
  async getBid(bidId: string): Promise<IBidDocument | null> {
    return Bid.findById(bidId);
  }

  /**
   * Get the minimum valid bid amount for a round
   */
  async getMinimumBidAmount(roundId: string): Promise<number> {
    const round = await Round.findById(roundId);
    if (!round) throw new Error('Round not found');

    const auction = await Auction.findById(round.auctionId);
    if (!auction) throw new Error('Auction not found');

    const highestBid = await Bid.getHighestBidInRound(roundId);

    if (highestBid) {
      return highestBid.amount + auction.bidIncrement;
    }

    return auction.minBidAmount;
  }

  /**
   * Check if user is currently winning in a round
   */
  async isUserWinning(userId: string, roundId: string): Promise<{
    isWinning: boolean;
    position: number;
    totalWinners: number;
  }> {
    const round = await Round.findById(roundId);
    if (!round) {
      return { isWinning: false, position: -1, totalWinners: 0 };
    }

    const topBids = await Bid.findTopBids(roundId, round.giftsAvailable);
    const position = topBids.findIndex((bid) => bid.userId === userId);

    return {
      isWinning: position !== -1,
      position: position === -1 ? -1 : position + 1,
      totalWinners: round.giftsAvailable,
    };
  }

  /**
   * Process winning bids - deduct locked funds
   */
  async processWinningBids(
    winners: Array<{ userId: string; bidId: string; amount: number }>
  ): Promise<void> {
    for (const winner of winners) {
      try {
        // Deduct locked funds (the user has already locked this amount)
        await balanceService.deductLockedFunds(
          winner.userId,
          winner.amount,
          `win:${winner.bidId}`
        );

        // Update user stats
        await User.findByIdAndUpdate(winner.userId, {
          $inc: {
            'stats.totalWins': 1,
            'stats.totalSpent': winner.amount,
            'stats.currentStreak': 1,
          },
        });

        // Update user rank
        const user = await User.findById(winner.userId) as IUserDocument | null;
        if (user) {
          if (user.stats.totalBids > 0) {
            user.stats.winRate = (user.stats.totalWins / user.stats.totalBids) * 100;
          }
          const newRank = calculateUserRank(user.stats);
          if (user.rank !== newRank) {
            user.rank = newRank;
            logger.info(`User ${winner.userId} promoted to ${newRank}`);
          }
          await user.save();

          // Achievement: первый выигрыш
          if (user.stats.totalWins === 1) {
            await achievementService.unlock(user._id.toString(), 'first_win');
          }
          // Achievement: 5 побед подряд
          if (user.stats.currentStreak === 5) {
            await achievementService.unlock(user._id.toString(), 'five_wins');
          }
          // Achievement: участие в 10 аукционах
          const uniqueAuctions = await Bid.distinct('auctionId', { userId: user._id });
          if (uniqueAuctions.length >= 10) {
            await achievementService.unlock(user._id.toString(), 'ten_auctions');
          }
        }

        // Achievement: крупная ставка
        if (winner.amount >= 1000) {
          await achievementService.unlock(winner.userId, 'big_bid', { amount: winner.amount });
        }

        logger.info(`Processed winning bid ${winner.bidId} for user ${winner.userId}: ${winner.amount}`);
      } catch (error) {
        logger.error(`Failed to process winning bid ${winner.bidId}:`, error);
        // Continue processing other winners
      }
    }
  }

  /**
   * Process refunds for non-winning bids in a completed round
   */
  async processRoundRefunds(roundId: string): Promise<void> {
    const round = await Round.findById(roundId);
    if (!round) {
      throw new Error('Round not found');
    }

    // Find all non-winning active/outbid bids
    const refundBids = await Bid.find({
      roundId,
      status: { $in: [BidStatus.ACTIVE, BidStatus.OUTBID] },
      _id: { $nin: round.winningBids },
    });

    for (const bid of refundBids) {
      try {
        await balanceService.unlockFunds(
          bid.userId,
          bid.amount,
          `refund:round:${roundId}`
        );

        bid.status = BidStatus.REFUNDED;
        bid.processedAt = new Date();
        await bid.save();

        logger.info(`Refunded bid ${bid._id} for user ${bid.userId}: ${bid.amount}`);
      } catch (error) {
        logger.error(`Failed to refund bid ${bid._id}:`, error);
      }
    }
  }

  /**
   * Get bid statistics for a round
   */
  async getRoundStats(roundId: string): Promise<{
    totalBids: number;
    uniqueBidders: number;
    highestBid: number;
    lowestBid: number;
    averageBid: number;
  }> {
    const bids = await Bid.find({ roundId, status: BidStatus.ACTIVE });

    if (bids.length === 0) {
      return {
        totalBids: 0,
        uniqueBidders: 0,
        highestBid: 0,
        lowestBid: 0,
        averageBid: 0,
      };
    }

    const amounts = bids.map((b) => b.amount);
    const uniqueBidders = new Set(bids.map((b) => b.userId)).size;

    return {
      totalBids: bids.length,
      uniqueBidders,
      highestBid: Math.max(...amounts),
      lowestBid: Math.min(...amounts),
      averageBid: amounts.reduce((a, b) => a + b, 0) / amounts.length,
    };
  }
}

export const bidService = new BidService();
export default bidService;
