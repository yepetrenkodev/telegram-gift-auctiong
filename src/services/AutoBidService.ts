import { AutoBid, IAutoBidDocument, Auction, User, Round } from '../models';
import { balanceService } from './BalanceService';
import { socketService } from './SocketService';
import logger from '../utils/logger';

// Forward declaration to avoid circular dependency
let bidServiceInstance: any = null;
const getBidService = () => {
  if (!bidServiceInstance) {
    bidServiceInstance = require('./BidService').bidService;
  }
  return bidServiceInstance;
};

/**
 * AutoBid Service
 * Handles automatic bidding functionality
 * 
 * When user sets up auto-bid:
 * 1. If not currently winning, place initial bid
 * 2. When outbid, automatically counter-bid up to maxAmount
 * 3. If insufficient funds, retry after 5 seconds
 * 4. If still no funds, disable auto-bid
 */
export class AutoBidService {
  private retryTimers: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Create or update auto-bid configuration
   * Also places initial bid if user is not currently winning
   */
  async setupAutoBid(
    userId: string,
    auctionId: string,
    maxAmount: number
  ): Promise<{ success: boolean; autoBid?: IAutoBidDocument; error?: string; initialBidPlaced?: boolean }> {
    try {
      const auction = await Auction.findById(auctionId);
      if (!auction) {
        return { success: false, error: 'Auction not found' };
      }

      if (!auction.isActive()) {
        return { success: false, error: 'Auction is not active' };
      }

      const balance = await balanceService.getBalance(userId);
      const currentPrice = auction.highestBid || auction.minBidAmount;
      const minBidRequired = currentPrice + auction.bidIncrement;

      // Check if maxAmount is enough to place at least one bid
      if (maxAmount < minBidRequired) {
        return {
          success: false,
          error: `Max amount must be at least ${minBidRequired} stars (current: ${currentPrice} + increment: ${auction.bidIncrement})`,
        };
      }

      let autoBid = await AutoBid.findOne({ userId, auctionId });

      if (autoBid) {
        autoBid.maxAmount = maxAmount;
        autoBid.isActive = true;
        autoBid.stoppedReason = undefined;
        await autoBid.save();
      } else {
        autoBid = await AutoBid.create({
          auctionId,
          userId,
          maxAmount,
          currentBid: 0,
          isActive: true,
          bidCount: 0,
        });
      }

      logger.info(`AutoBid setup: user=${userId}, auction=${auctionId}, max=${maxAmount}`);

      // Check if user needs to place initial bid
      const round = await Round.findActiveRound(auctionId);
      if (!round) {
        return { success: true, autoBid };
      }

      // Check if user is already the highest bidder
      const { Bid } = await import('../models');
      const highestBid = await Bid.getHighestBidInRound(round._id.toString());
      
      if (highestBid && highestBid.userId.toString() === userId) {
        logger.info(`AutoBid: User ${userId} is already winning, no initial bid needed`);
        return { success: true, autoBid, initialBidPlaced: false };
      }

      // Place initial bid
      const bidAmount = Math.min(minBidRequired, maxAmount);
      
      if (balance.available < bidAmount) {
        return { 
          success: true, 
          autoBid, 
          initialBidPlaced: false,
          error: `Auto-bid configured but insufficient balance for initial bid (need ${bidAmount}, have ${balance.available})`
        };
      }

      const bidService = getBidService();
      const bidResult = await bidService.placeBid(
        userId,
        auctionId,
        round._id.toString(),
        bidAmount,
        true // isAutoBid
      );

      if (bidResult.success) {
        autoBid.currentBid = bidAmount;
        autoBid.bidCount += 1;
        await autoBid.save();
        
        logger.info(`AutoBid initial bid placed: user=${userId}, amount=${bidAmount}`);
        
        socketService.broadcastAutoBidTriggered(userId, {
          auctionId,
          roundNumber: round.roundNumber,
          amount: bidAmount,
          remainingMax: maxAmount - bidAmount,
          bidCount: autoBid.bidCount
        });

        return { success: true, autoBid, initialBidPlaced: true };
      }

      return { success: true, autoBid, initialBidPlaced: false };
    } catch (error) {
      logger.error('Error setting up auto-bid:', error);
      return { success: false, error: 'Failed to setup auto-bid' };
    }
  }

  async cancelAutoBid(
    userId: string,
    auctionId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const autoBid = await AutoBid.findOne({ userId, auctionId });
      if (!autoBid) {
        return { success: false, error: 'Auto-bid not found' };
      }

      // Clear any pending retry
      const retryKey = `${userId}:${auctionId}`;
      const timer = this.retryTimers.get(retryKey);
      if (timer) {
        clearTimeout(timer);
        this.retryTimers.delete(retryKey);
      }

      await autoBid.stop('manual');
      logger.info(`AutoBid cancelled: user=${userId}, auction=${auctionId}`);
      return { success: true };
    } catch (error) {
      logger.error('Error cancelling auto-bid:', error);
      return { success: false, error: 'Failed to cancel auto-bid' };
    }
  }

  async getAutoBid(userId: string, auctionId: string): Promise<IAutoBidDocument | null> {
    return AutoBid.findOne({ userId, auctionId });
  }

  async getActiveAutoBidsForAuction(auctionId: string): Promise<IAutoBidDocument[]> {
    return AutoBid.find({ auctionId, isActive: true }).sort({ maxAmount: -1 });
  }

  /**
   * Called after any bid is placed to trigger auto-bids from other users
   */
  async triggerAutoBidsAfterBid(
    auctionId: string,
    roundId: string,
    currentBidAmount: number,
    currentBidderId: string,
    bidIncrement: number
  ): Promise<void> {
    // Find all active auto-bids for this auction (excluding current bidder)
    const autoBids = await AutoBid.find({
      auctionId,
      isActive: true,
      userId: { $ne: currentBidderId },
    }).sort({ maxAmount: -1 });

    if (autoBids.length === 0) {
      return;
    }

    const requiredAmount = currentBidAmount + bidIncrement;
    logger.info(`Checking ${autoBids.length} auto-bids, required amount: ${requiredAmount}`);

    for (const autoBid of autoBids) {
      // Skip if max amount is less than required
      if (autoBid.maxAmount < requiredAmount) {
        await this.stopAutoBid(autoBid, 'outbid', auctionId);
        continue;
      }

      // Try to place counter-bid
      await this.tryPlaceAutoBid(autoBid, auctionId, roundId, requiredAmount, bidIncrement);
    }
  }

  /**
   * Try to place an auto-bid, with retry on insufficient funds
   */
  private async tryPlaceAutoBid(
    autoBid: IAutoBidDocument,
    auctionId: string,
    roundId: string,
    requiredAmount: number,
    bidIncrement: number,
    isRetry: boolean = false
  ): Promise<void> {
    const userId = autoBid.userId.toString();
    const retryKey = `${userId}:${auctionId}`;

    try {
      // Check balance
      const balance = await balanceService.getBalance(userId);
      
      if (balance.available < requiredAmount) {
        if (!isRetry) {
          // First attempt failed - schedule retry in 5 seconds
          logger.info(`AutoBid: Insufficient funds for user ${userId}, retrying in 5 seconds...`);
          
          socketService.broadcastAutoBidRetrying(userId, {
            auctionId,
            reason: 'insufficient_funds',
            retryIn: 5,
            required: requiredAmount,
            available: balance.available
          });

          const timer = setTimeout(async () => {
            this.retryTimers.delete(retryKey);
            
            // Refresh autoBid from DB
            const freshAutoBid = await AutoBid.findById(autoBid._id);
            if (freshAutoBid && freshAutoBid.isActive) {
              // Get fresh round data
              const round = await Round.findById(roundId);
              if (round && round.status === 'active') {
                // Get current highest bid
                const { Bid } = await import('../models');
                const highestBid = await Bid.getHighestBidInRound(roundId);
                const currentRequired = highestBid 
                  ? highestBid.amount + bidIncrement 
                  : requiredAmount;
                
                await this.tryPlaceAutoBid(freshAutoBid, auctionId, roundId, currentRequired, bidIncrement, true);
              }
            }
          }, 5000);

          this.retryTimers.set(retryKey, timer);
        } else {
          // Retry also failed - stop auto-bid
          logger.info(`AutoBid: Retry failed for user ${userId}, stopping auto-bid`);
          await this.stopAutoBid(autoBid, 'insufficient_funds', auctionId);
        }
        return;
      }

      // Calculate optimal bid amount
      const bidAmount = Math.min(requiredAmount, autoBid.maxAmount);

      // Place the bid
      const bidService = getBidService();
      const result = await bidService.placeBid(
        userId,
        auctionId,
        roundId,
        bidAmount,
        true // isAutoBid
      );

      if (result.success) {
        autoBid.currentBid = bidAmount;
        autoBid.bidCount += 1;
        await autoBid.save();

        logger.info(`AutoBid placed: user=${userId}, amount=${bidAmount}, total bids=${autoBid.bidCount}`);

        // Get round info for notification
        const round = await Round.findById(roundId);
        
        socketService.broadcastAutoBidTriggered(userId, {
          auctionId,
          roundNumber: round?.roundNumber || 1,
          amount: bidAmount,
          remainingMax: autoBid.maxAmount - bidAmount,
          bidCount: autoBid.bidCount
        });

        // Check if reached max
        if (bidAmount >= autoBid.maxAmount) {
          await this.stopAutoBid(autoBid, 'max_reached', auctionId);
        }
      } else {
        logger.warn(`AutoBid failed for user ${userId}: ${result.error}`);
      }
    } catch (error) {
      logger.error(`Error in tryPlaceAutoBid for user ${userId}:`, error);
    }
  }

  /**
   * Stop auto-bid and notify user
   */
  private async stopAutoBid(
    autoBid: IAutoBidDocument,
    reason: 'manual' | 'max_reached' | 'outbid' | 'auction_ended' | 'insufficient_funds',
    auctionId: string
  ): Promise<void> {
    const userId = autoBid.userId.toString();
    
    // Clear any pending retry
    const retryKey = `${userId}:${auctionId}`;
    const timer = this.retryTimers.get(retryKey);
    if (timer) {
      clearTimeout(timer);
      this.retryTimers.delete(retryKey);
    }

    await autoBid.stop(reason);
    
    socketService.broadcastAutoBidStopped(userId, {
      auctionId,
      reason,
      maxAmount: autoBid.maxAmount,
      totalBidsPlaced: autoBid.bidCount
    });

    logger.info(`AutoBid stopped: user=${userId}, reason=${reason}`);
  }

  async stopAllForAuction(auctionId: string): Promise<void> {
    try {
      const autoBids = await AutoBid.find({ auctionId, isActive: true });
      for (const autoBid of autoBids) {
        await this.stopAutoBid(autoBid, 'auction_ended', auctionId);
      }
      logger.info(`Stopped ${autoBids.length} auto-bids for auction ${auctionId}`);
    } catch (error) {
      logger.error('Error stopping auto-bids for auction:', error);
    }
  }

  async getUserAutoBidStats(userId: string): Promise<{
    active: number;
    totalBidsPlaced: number;
    totalSpentOnAutoBids: number;
  }> {
    const autoBids = await AutoBid.find({ userId });
    return {
      active: autoBids.filter(ab => ab.isActive).length,
      totalBidsPlaced: autoBids.reduce((sum, ab) => sum + ab.bidCount, 0),
      totalSpentOnAutoBids: autoBids.reduce((sum, ab) => sum + ab.currentBid, 0),
    };
  }
}

export const autoBidService = new AutoBidService();
export default autoBidService;
