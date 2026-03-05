import { Response } from 'express';
import { AuthRequest, asyncHandler } from '../middleware';
import { bidService } from '../services';
import logger from '../utils/logger';

/**
 * 💸 Bid Controller
 */
export const bidController = {
  /**
   * Place a new bid
   */
  placeBid: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { auctionId, roundId, amount } = req.body;
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        timestamp: new Date(),
      });
      return;
    }

    if (!auctionId || !roundId || !amount) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: auctionId, roundId, amount',
        timestamp: new Date(),
      });
      return;
    }

    if (amount <= 0) {
      res.status(400).json({
        success: false,
        error: 'Bid amount must be positive',
        timestamp: new Date(),
      });
      return;
    }

    const result = await bidService.placeBid(
      userId,
      auctionId,
      roundId,
      amount,
      false // not auto-bid
    );

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: result.error,
        timestamp: new Date(),
      });
      return;
    }

    logger.info(`Bid placed by user ${userId} for ${amount}`);

    res.status(201).json({
      success: true,
      data: {
        bid: result.bid,
        triggeredExtension: result.triggeredExtension,
        newEndsAt: result.newEndsAt,
      },
      message: result.triggeredExtension
        ? 'Bid placed successfully! Anti-snipe extension triggered.'
        : 'Bid placed successfully!',
      timestamp: new Date(),
    });
  }),

  /**
   * Get top bids for a round
   */
  getTopBids: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { roundId } = req.params;
    const limit = parseInt(req.query.limit as string) || 10;

    const bids = await bidService.getTopBids(roundId, limit);

    // Enrich with user info
    const { User } = await import('../models');
    const userIds = [...new Set(bids.map((b) => b.userId))];
    const users = await User.find({ _id: { $in: userIds } }).select(
      'firstName lastName username rank photoUrl'
    );

    const userMap = new Map(users.map((u) => [u._id.toString(), u]));

    const enrichedBids = bids.map((bid) => ({
      ...bid.toJSON(),
      user: userMap.get(bid.userId) || null,
    }));

    res.json({
      success: true,
      data: enrichedBids,
      timestamp: new Date(),
    });
  }),

  /**
   * Refund all non-winning bids in a round (admin/manual)
   */
  refundRoundBids: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { roundId } = req.params;

    try {
      await bidService.processRoundRefunds(roundId);
      res.json({
        success: true,
        message: 'Refunds processed for non-winning bids',
        timestamp: new Date(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
      });
    }
  }),

  /**
   * Get user's current bid in a round
   */
  getUserBidInRound: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { roundId } = req.params;
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        timestamp: new Date(),
      });
      return;
    }

    const bid = await bidService.getUserBidInRound(userId, roundId);

    res.json({
      success: true,
      data: bid,
      timestamp: new Date(),
    });
  }),

  /**
   * Get user's bid history
   */
  getUserBidHistory: asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.userId;
    const limit = parseInt(req.query.limit as string) || 50;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        timestamp: new Date(),
      });
      return;
    }

    const bids = await bidService.getUserBids(userId, limit);

    res.json({
      success: true,
      data: bids,
      timestamp: new Date(),
    });
  }),

  /**
   * Check if user is currently winning
   */
  checkWinningStatus: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { roundId } = req.params;
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        timestamp: new Date(),
      });
      return;
    }

    const status = await bidService.isUserWinning(userId, roundId);

    res.json({
      success: true,
      data: status,
      timestamp: new Date(),
    });
  }),

  /**
   * Get minimum bid amount for a round
   */
  getMinimumBid: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { roundId } = req.params;

    const minBid = await bidService.getMinimumBidAmount(roundId);

    res.json({
      success: true,
      data: { minimumBid: minBid },
      timestamp: new Date(),
    });
  }),

  /**
   * Get round statistics
   */
  getRoundStats: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { roundId } = req.params;

    const stats = await bidService.getRoundStats(roundId);

    res.json({
      success: true,
      data: stats,
      timestamp: new Date(),
    });
  }),

  /**
   * Get all bids in a round (admin only)
   */
  getAllRoundBids: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { roundId } = req.params;

    const bids = await bidService.getRoundBids(roundId);

    res.json({
      success: true,
      data: bids,
      timestamp: new Date(),
    });
  }),

  /**
   * Quick bid with predefined options
   */
  quickBid: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { auctionId, roundId } = req.params;
    const { type, presetAmount } = req.body;
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        timestamp: new Date(),
      });
      return;
    }

    // Get current minimum bid
    const minBid = await bidService.getMinimumBidAmount(roundId);
    
    let amount: number;
    
    switch (type) {
      case 'min':
        amount = minBid;
        break;
      case 'percent_10':
        amount = Math.ceil(minBid * 1.1);
        break;
      case 'percent_50':
        amount = Math.ceil(minBid * 1.5);
        break;
      case 'percent_100':
        amount = minBid * 2;
        break;
      case 'preset':
        if (!presetAmount || presetAmount < minBid) {
          res.status(400).json({
            success: false,
            error: 'Preset amount must be >= minimum bid',
            timestamp: new Date(),
          });
          return;
        }
        amount = presetAmount;
        break;
      default:
        res.status(400).json({
          success: false,
          error: 'Invalid quick bid type',
          timestamp: new Date(),
        });
        return;
    }

    const result = await bidService.placeBid(
      userId,
      auctionId,
      roundId,
      amount,
      false
    );

    res.json({
      success: true,
      data: {
        ...result,
        quickBidType: type,
        calculatedAmount: amount,
      },
      timestamp: new Date(),
    });
  }),

  /**
   * Get quick bid options for UI buttons
   */
  getQuickBidOptions: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { roundId } = req.params;

    const minBid = await bidService.getMinimumBidAmount(roundId);

    const options = [
      { type: 'min', label: 'Min', amount: minBid },
      { type: 'percent_10', label: '+10%', amount: Math.ceil(minBid * 1.1) },
      { type: 'percent_50', label: '+50%', amount: Math.ceil(minBid * 1.5) },
      { type: 'percent_100', label: 'x2', amount: minBid * 2 },
    ];

    res.json({
      success: true,
      data: {
        minimumBid: minBid,
        options,
      },
      timestamp: new Date(),
    });
  }),
};

export default bidController;
