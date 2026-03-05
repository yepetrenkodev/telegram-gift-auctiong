import mongoose from 'mongoose';
import { Auction, Round, Bid, IAuctionDocument, IRoundDocument, User } from '../models';
import { AuctionStatus, RoundStatus, IGift, BidStatus } from '../types';
import config from '../config';
import logger from '../utils/logger';
import { telegramBotService } from '../bot/TelegramBot';
import { balanceService } from './BalanceService';
import { socketService } from './SocketService';

/**
 * 🎯 Auction Service
 * 
 * Manages auction lifecycle:
 * - Create auctions
 * - Start/stop auctions
 * - Manage rounds
 * - Handle anti-sniping
 */
export class AuctionService {
  /**
   * Create a new auction
   */
  async createAuction(data: {
    title: string;
    description: string;
    gift: IGift;
    totalGifts: number;
    totalRounds: number;
    giftsPerRound: number;
    minBidAmount?: number;
    bidIncrement?: number;
    scheduledStartAt?: Date;
    antiSnipeThresholdSeconds?: number;
    antiSnipeExtensionSeconds?: number;
    maxAntiSnipeExtensions?: number;
  }): Promise<IAuctionDocument> {
    // Validate configuration
    if (data.totalGifts !== data.totalRounds * data.giftsPerRound) {
      throw new Error(
        `Invalid configuration: totalGifts (${data.totalGifts}) must equal totalRounds (${data.totalRounds}) * giftsPerRound (${data.giftsPerRound})`
      );
    }

    const auction = new Auction({
      title: data.title,
      description: data.description,
      gift: data.gift,
      totalGifts: data.totalGifts,
      totalRounds: data.totalRounds,
      giftsPerRound: data.giftsPerRound,
      minBidAmount: data.minBidAmount || config.auction.defaultMinBid,
      bidIncrement: data.bidIncrement || config.auction.defaultBidIncrement,
      scheduledStartAt: data.scheduledStartAt,
      antiSnipeThresholdSeconds: data.antiSnipeThresholdSeconds || config.auction.antiSnipeThresholdSeconds,
      antiSnipeExtensionSeconds: data.antiSnipeExtensionSeconds || config.auction.antiSnipeExtensionSeconds,
      maxAntiSnipeExtensions: data.maxAntiSnipeExtensions || config.auction.maxAntiSnipeExtensions,
      status: data.scheduledStartAt ? AuctionStatus.SCHEDULED : AuctionStatus.DRAFT,
    });

    await auction.save();
    logger.info(`Created auction: ${auction._id} - ${auction.title}`);

    return auction;
  }

  /**
   * Get auction by ID
   */
  async getAuction(auctionId: string): Promise<IAuctionDocument | null> {
    return Auction.findById(auctionId);
  }

  /**
   * Get auction with current round
   */
  async getAuctionWithCurrentRound(auctionId: string): Promise<{
    auction: IAuctionDocument;
    currentRound: IRoundDocument | null;
  } | null> {
    const auction = await this.getAuction(auctionId);
    if (!auction) return null;

    const currentRound = await Round.findActiveRound(auctionId);

    return { auction, currentRound };
  }

  /**
   * Start an auction
   */
  async startAuction(auctionId: string): Promise<IAuctionDocument> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const auction = await Auction.findById(auctionId).session(session);

      if (!auction) {
        throw new Error('Auction not found');
      }

      if (auction.status !== AuctionStatus.DRAFT && auction.status !== AuctionStatus.SCHEDULED) {
        throw new Error(`Cannot start auction in ${auction.status} status`);
      }

      const now = new Date();
      const roundDuration = config.auction.defaultRoundDurationMinutes * 60 * 1000;
      const roundEndsAt = new Date(now.getTime() + roundDuration);

      // Create first round
      const firstRound = new Round({
        auctionId: auction._id,
        roundNumber: 1,
        status: RoundStatus.ACTIVE,
        giftsAvailable: auction.giftsPerRound,
        startsAt: now,
        endsAt: roundEndsAt,
        originalEndsAt: roundEndsAt,
      });

      await firstRound.save({ session });

      // Update auction
      auction.status = AuctionStatus.ACTIVE;
      auction.startedAt = now;
      auction.currentRound = 1;
      auction.endsAt = roundEndsAt;

      await auction.save({ session });

      await session.commitTransaction();
      logger.info(`Started auction: ${auctionId}, Round 1 ends at: ${roundEndsAt}`);

      return auction;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Get current active round for an auction
   */
  async getCurrentRound(auctionId: string): Promise<IRoundDocument | null> {
    return Round.findActiveRound(auctionId);
  }

  /**
   * Extend round due to anti-sniping
   */
  async extendRound(
    roundId: string,
    extensionSeconds?: number
  ): Promise<{ extended: boolean; round?: IRoundDocument; reason?: string }> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const round = await Round.findById(roundId).session(session);

      if (!round) {
        await session.abortTransaction();
        return { extended: false, reason: 'Round not found' };
      }

      if (round.status !== RoundStatus.ACTIVE) {
        await session.abortTransaction();
        return { extended: false, reason: 'Round is not active' };
      }

      const auction = await Auction.findById(round.auctionId).session(session);

      if (!auction) {
        await session.abortTransaction();
        return { extended: false, reason: 'Auction not found' };
      }

      // Check if we can extend
      if (round.extensionCount >= auction.maxAntiSnipeExtensions) {
        await session.abortTransaction();
        return {
          extended: false,
          reason: `Maximum extensions (${auction.maxAntiSnipeExtensions}) reached`,
        };
      }

      // Extend the round
      const extension = extensionSeconds || auction.antiSnipeExtensionSeconds;
      const newEndsAt = new Date(round.endsAt.getTime() + extension * 1000);

      round.endsAt = newEndsAt;
      round.extensionCount += 1;

      await round.save({ session });

      // Update auction endsAt if this is the last round
      auction.endsAt = newEndsAt;
      await auction.save({ session });

      await session.commitTransaction();
      logger.info(
        `Extended round ${roundId} by ${extension}s. New end: ${newEndsAt}. Extensions: ${round.extensionCount}`
      );

      return { extended: true, round };
    } catch (error) {
      await session.abortTransaction();
      logger.error(`Failed to extend round ${roundId}:`, error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Check if bid should trigger anti-snipe extension
   */
  async shouldTriggerAntiSnipe(roundId: string): Promise<boolean> {
    const round = await Round.findById(roundId);
    if (!round || round.status !== RoundStatus.ACTIVE) return false;

    const auction = await Auction.findById(round.auctionId);
    if (!auction) return false;

    const now = Date.now();
    const endsAt = round.endsAt.getTime();
    const threshold = auction.antiSnipeThresholdSeconds * 1000;

    return endsAt - now <= threshold;
  }

  /**
   * Process end of round - determine winners, start next round
   * Note: Runs without transactions for standalone MongoDB compatibility
   */
  async processRoundEnd(roundId: string): Promise<{
    winners: Array<{ userId: string; bidId: string; amount: number }>;
    nextRound: IRoundDocument | null;
  }> {
    try {
      const round = await Round.findById(roundId);

      if (!round) {
        throw new Error('Round not found');
      }

      if (round.status !== RoundStatus.ACTIVE) {
        throw new Error(`Round is not active, status: ${round.status}`);
      }

      // Mark as processing
      round.status = RoundStatus.PROCESSING;
      await round.save();

      const auction = await Auction.findById(round.auctionId);

      if (!auction) {
        throw new Error('Auction not found');
      }

      // Get top bids
      const topBids = await Bid.findTopBids(roundId, round.giftsAvailable);

      const winners: Array<{ userId: string; bidId: string; amount: number }> = [];

      // Process winners
      for (const bid of topBids) {
        bid.status = BidStatus.WON;
        bid.processedAt = new Date();
        await bid.save();

        winners.push({
          userId: bid.userId,
          bidId: bid._id.toString(),
          amount: bid.amount,
        });

        round.winningBids.push(bid._id.toString());
      }

      // Mark round as completed
      round.status = RoundStatus.COMPLETED;
      await round.save();

      // Send win notifications to all winners (async, don't block)
      this.sendWinNotifications(winners, auction).catch(err => 
        logger.error('Error sending win notifications:', err)
      );

      // Check if auction is complete
      let nextRound: IRoundDocument | null = null;

      if (round.roundNumber >= auction.totalRounds) {
        // Auction complete
        auction.status = AuctionStatus.COMPLETED;
        auction.completedAt = new Date();
        await auction.save();
        logger.info(`Auction ${auction._id} completed!`);
      } else {
        // Start next round
        const now = new Date();
        const roundDuration = config.auction.defaultRoundDurationMinutes * 60 * 1000;
        const roundEndsAt = new Date(now.getTime() + roundDuration);

        nextRound = new Round({
          auctionId: auction._id,
          roundNumber: round.roundNumber + 1,
          status: RoundStatus.ACTIVE,
          giftsAvailable: auction.giftsPerRound,
          startsAt: now,
          endsAt: roundEndsAt,
          originalEndsAt: roundEndsAt,
        });

        await nextRound.save();

        auction.currentRound = nextRound.roundNumber;
        auction.endsAt = roundEndsAt;
        await auction.save();

        logger.info(`Started round ${nextRound.roundNumber} for auction ${auction._id}`);
      }

      return { winners, nextRound };
    } catch (error) {
      logger.error(`Failed to process round end ${roundId}:`, error);
      throw error;
    }
  }

  /**
   * Send win notifications to winners (helper method)
   */
  private async sendWinNotifications(
    winners: Array<{ userId: string; bidId: string; amount: number }>,
    auction: IAuctionDocument
  ): Promise<void> {
    for (const winner of winners) {
      try {
        const winnerUser = await User.findById(winner.userId);
        if (winnerUser && winnerUser.telegramId) {
          await telegramBotService.sendWinNotification(
            winnerUser.telegramId,
            auction.title,
            auction.gift.name,
            winner.amount
          );
        }
      } catch (notifyError) {
        logger.error(`Failed to send win notification to ${winner.userId}:`, notifyError);
      }
    }
  }

  /**
   * Get all active auctions
   */
  async getActiveAuctions(): Promise<IAuctionDocument[]> {
    return Auction.findActive();
  }

  /**
   * Get upcoming auctions
   */
  async getUpcomingAuctions(): Promise<IAuctionDocument[]> {
    return Auction.findUpcoming();
  }

  /**
   * Get auction leaderboard (top bidders in an auction)
   */
  async getAuctionLeaderboard(auctionId: string, limit = 100): Promise<
    Array<{
      rank: number;
      oderId: string;
      totalBids: number;
      totalAmount: number;
      wins: number;
    }>
  > {
    const result = await Bid.aggregate([
      { $match: { auctionId } },
      {
        $group: {
          _id: '$userId',
          totalBids: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          wins: {
            $sum: { $cond: [{ $eq: ['$status', 'won'] }, 1, 0] },
          },
        },
      },
      { $sort: { wins: -1, totalAmount: -1 } },
      { $limit: limit },
    ]);

    return result.map((r, index) => ({
      rank: index + 1,
      oderId: r._id,
      totalBids: r.totalBids,
      totalAmount: r.totalAmount,
      wins: r.wins,
    }));
  }

  /**
   * Pause an auction
   */
  async pauseAuction(auctionId: string): Promise<IAuctionDocument> {
    const auction = await Auction.findById(auctionId);

    if (!auction) {
      throw new Error('Auction not found');
    }

    if (auction.status !== AuctionStatus.ACTIVE) {
      throw new Error('Can only pause active auctions');
    }

    auction.status = AuctionStatus.PAUSED;
    await auction.save();

    // Also pause current round
    const currentRound = await Round.findActiveRound(auctionId);
    if (currentRound) {
      currentRound.status = RoundStatus.PENDING;
      await currentRound.save();
    }

    logger.info(`Paused auction: ${auctionId}`);
    return auction;
  }

  /**
   * Cancel an auction
   */
  async cancelAuction(auctionId: string): Promise<IAuctionDocument> {
    const auction = await Auction.findById(auctionId);

    if (!auction) {
      throw new Error('Auction not found');
    }

    if (auction.status === AuctionStatus.COMPLETED) {
      throw new Error('Cannot cancel completed auctions');
    }

    // Find all active bids in this auction and refund them
    const activeBids = await Bid.find({
      auctionId,
      status: BidStatus.ACTIVE,
    });

    logger.info(`Cancelling auction ${auctionId}: Found ${activeBids.length} active bids to refund`);

    // Refund each active bid
    for (const bid of activeBids) {
      try {
        const unlockResult = await balanceService.unlockFunds(
          bid.userId.toString(),
          bid.amount,
          `cancel:${auctionId}`
        );

        if (unlockResult.success) {
          bid.status = BidStatus.REFUNDED;
          bid.processedAt = new Date();
          await bid.save();
          logger.info(`Refunded bid ${bid._id}: ${bid.amount} to user ${bid.userId}`);
        } else {
          logger.error(`Failed to refund bid ${bid._id}: ${unlockResult.error}`);
        }
      } catch (error) {
        logger.error(`Error refunding bid ${bid._id}:`, error);
      }
    }

    auction.status = AuctionStatus.CANCELLED;
    await auction.save();

    // Notify all participants
    socketService.broadcastAuctionCancelled(auctionId);

    logger.info(`Cancelled auction: ${auctionId}, refunded ${activeBids.length} bids`);
    return auction;
  }

  /**
   * Update auction statistics
   */
  async updateAuctionStats(auctionId: string): Promise<void> {
    const [totalBids, participants, highestBid] = await Promise.all([
      Bid.countDocuments({ auctionId }),
      Bid.getUniqueParticipants(auctionId),
      Bid.findOne({ auctionId }).sort({ amount: -1 }),
    ]);

    await Auction.findByIdAndUpdate(auctionId, {
      totalBids,
      totalParticipants: participants.length,
      highestBid: highestBid?.amount || 0,
    });
  }

  /**
   * End a round by auction ID and round number
   * This is called by TimerService when countdown reaches zero
   */
  async endRound(auctionId: string, roundNumber: number): Promise<{
    winners: Array<{ oduserId: string; userName: string; amount: number }>;
    nextRound?: { number: number; startsAt: Date; duration: number };
  } | null> {
    try {
      // Find the round
      const round = await Round.findOne({
        auctionId,
        roundNumber,
        status: RoundStatus.ACTIVE,
      });

      if (!round) {
        logger.warn(`Round ${roundNumber} not found or not active for auction ${auctionId}`);
        return null;
      }

      // Process the round end
      const result = await this.processRoundEnd(round._id.toString());

      if (!result) return null;

      // Get winner details
      const { User } = await import('../models');
      const userIds = result.winners.map(w => w.userId);
      const users = await User.find({ _id: { $in: userIds } }).lean();
      const userMap = new Map(users.map(u => [u._id.toString(), u]));

      return {
        winners: result.winners.map(w => {
          const user = userMap.get(w.userId);
          return {
            oduserId: w.userId,
            userName: user ? `${user.firstName} ${user.lastName || ''}`.trim() : 'Unknown',
            amount: w.amount,
          };
        }),
        nextRound: result.nextRound ? {
          number: result.nextRound.roundNumber,
          startsAt: result.nextRound.startsAt,
          duration: config.auction.defaultRoundDurationMinutes * 60 * 1000,
        } : undefined,
      };
    } catch (error) {
      logger.error(`Error ending round ${roundNumber} for auction ${auctionId}:`, error);
      return null;
    }
  }
}

export const auctionService = new AuctionService();
export default auctionService;
