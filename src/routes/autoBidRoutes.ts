import { Router, Response } from 'express';
import { AuthRequest, telegramAuthMiddleware } from '../middleware';
import { autoBidService } from '../services';
import { Auction } from '../models';

const router = Router();

/**
 * 🤖 Auto-Bid API
 */

// Setup or update auto-bid
router.post('/setup', telegramAuthMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { auctionId, maxAmount } = req.body;

    if (!auctionId || !maxAmount) {
      res.status(400).json({ error: 'auctionId and maxAmount are required' });
      return;
    }

    if (maxAmount <= 0) {
      res.status(400).json({ error: 'maxAmount must be positive' });
      return;
    }

    const result = await autoBidService.setupAutoBid(userId, auctionId, maxAmount);

    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }

    res.json({
      success: true,
      autoBid: {
        auctionId: result.autoBid!.auctionId,
        maxAmount: result.autoBid!.maxAmount,
        currentBid: result.autoBid!.currentBid,
        isActive: result.autoBid!.isActive,
        bidCount: result.autoBid!.bidCount,
      },
    });
  } catch (error) {
    console.error('Error setting up auto-bid:', error);
    res.status(500).json({ error: 'Failed to setup auto-bid' });
  }
});

// Cancel auto-bid
router.post('/cancel', telegramAuthMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { auctionId } = req.body;

    if (!auctionId) {
      res.status(400).json({ error: 'auctionId is required' });
      return;
    }

    const result = await autoBidService.cancelAutoBid(userId, auctionId);

    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error cancelling auto-bid:', error);
    res.status(500).json({ error: 'Failed to cancel auto-bid' });
  }
});

// Get auto-bid status for auction
router.get('/status/:auctionId', telegramAuthMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { auctionId } = req.params;

    const autoBid = await autoBidService.getAutoBid(userId, auctionId);
    const auction = await Auction.findById(auctionId).lean() as any;

    res.json({
      hasAutoBid: !!autoBid,
      autoBid: autoBid ? {
        maxAmount: autoBid.maxAmount,
        currentBid: autoBid.currentBid,
        isActive: autoBid.isActive,
        bidCount: autoBid.bidCount,
        stoppedReason: autoBid.stoppedReason,
        createdAt: autoBid.createdAt,
        lastBidAt: autoBid.lastBidAt,
      } : null,
      currentPrice: auction?.highestBid || auction?.startingPrice || 0,
      bidIncrement: auction?.bidIncrement || 1,
    });
  } catch (error) {
    console.error('Error getting auto-bid status:', error);
    res.status(500).json({ error: 'Failed to get auto-bid status' });
  }
});

// Get user's auto-bid stats
router.get('/stats', telegramAuthMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const stats = await autoBidService.getUserAutoBidStats(userId);

    res.json(stats);
  } catch (error) {
    console.error('Error getting auto-bid stats:', error);
    res.status(500).json({ error: 'Failed to get auto-bid stats' });
  }
});

// Get all user's active auto-bids
router.get('/active', telegramAuthMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { AutoBid } = await import('../models/AutoBid');
    const autoBids = await AutoBid.find({ userId, isActive: true })
      .populate('auctionId', 'title gift currentPrice endTime status')
      .lean();

    res.json({
      autoBids: autoBids.map((ab: any) => ({
        id: ab._id,
        auction: ab.auctionId,
        maxAmount: ab.maxAmount,
        currentBid: ab.currentBid,
        bidCount: ab.bidCount,
        createdAt: ab.createdAt,
      })),
    });
  } catch (error) {
    console.error('Error getting active auto-bids:', error);
    res.status(500).json({ error: 'Failed to get active auto-bids' });
  }
});

export default router;
