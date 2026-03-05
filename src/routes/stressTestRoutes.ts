/**
 * 🧪 Stress Test Routes
 * 
 * API endpoints for stress testing - create/delete test auctions
 * These routes should be disabled in production!
 */

import { Router, Request, Response } from 'express';
import { Auction, User, Balance, Bid } from '../models';
import config from '../config';
import logger from '../utils/logger';

const router = Router();

// Only enable in development
if (!config.isDev) {
  router.use((_req: Request, res: Response) => {
    res.status(403).json({ error: 'Stress test routes disabled in production' });
  });
}

/**
 * Create a test auction
 */
router.post('/auctions', async (req: Request, res: Response) => {
  try {
    const {
      title,
      description,
      gift,
      totalGifts = 1,
      totalRounds = 1,
      giftsPerRound = 1,
      winnersPerRound = 1,
      minBidAmount = 10,
      bidIncrement = 1,
      scheduledStartAt,
      endsAt,
    } = req.body;

    // Calculate end time
    const endTime = endsAt ? new Date(endsAt) : new Date(Date.now() + 5 * 60 * 1000);

    const auction = await Auction.create({
      title: title || 'Stress Test Auction',
      description: description || 'Auto-generated for stress testing',
      gift: {
        id: gift?.id || `stress-${Date.now()}`,
        name: gift?.name || 'Test Gift',
        description: gift?.description || 'Test gift description',
        imageUrl: gift?.imageUrl || 'https://placehold.co/400x400/8b5cf6/ffffff?text=Test',
        rarity: gift?.rarity || 'common',
        totalSupply: gift?.totalSupply || 1000,
        giftModel: gift?.giftModel,
        backdrop: gift?.backdrop,
        symbol: gift?.symbol || '⭐',
        giftCollection: gift?.giftCollection || 'Test',
        number: gift?.number,
      },
      status: 'active',
      totalGifts,
      totalRounds,
      giftsPerRound,
      winnersPerRound,
      minBidAmount,
      bidIncrement,
      scheduledStartAt: scheduledStartAt ? new Date(scheduledStartAt) : new Date(),
      startedAt: new Date(),
      endsAt: endTime,
      currentRound: 1,
      totalBids: 0,
      totalParticipants: 0,
      highestBid: 0,
      isStressTest: true, // Mark as stress test
    });

    logger.info(`Stress test auction created: ${auction._id}`);

    res.json({
      success: true,
      id: auction._id.toString(),
      auction: {
        id: auction._id.toString(),
        title: auction.title,
        endsAt: auction.endsAt,
        minBidAmount: auction.minBidAmount,
      },
    });
  } catch (error: any) {
    logger.error('Failed to create stress test auction:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Delete a test auction
 */
router.delete('/auctions/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Delete associated bids
    await Bid.deleteMany({ auctionId: id });

    // Delete the auction
    const result = await Auction.findByIdAndDelete(id);

    if (!result) {
      return res.status(404).json({ error: 'Auction not found' });
    }

    logger.info(`Stress test auction deleted: ${id}`);
    res.json({ success: true });
  } catch (error: any) {
    logger.error('Failed to delete stress test auction:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Delete all stress test auctions
 */
router.delete('/auctions', async (_req: Request, res: Response) => {
  try {
    // Find all stress test auctions
    const auctions = await Auction.find({ isStressTest: true });
    
    // Delete bids for each
    for (const auction of auctions) {
      await Bid.deleteMany({ auctionId: auction._id });
    }

    // Delete all stress test auctions
    const result = await Auction.deleteMany({ isStressTest: true });

    logger.info(`Deleted ${result.deletedCount} stress test auctions`);
    res.json({ success: true, deleted: result.deletedCount });
  } catch (error: any) {
    logger.error('Failed to delete stress test auctions:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Create a test bot user
 */
router.post('/bots', async (req: Request, res: Response) => {
  try {
    const { name, balance = 5000 } = req.body;

    const telegramId = `bot_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    const user = await User.create({
      telegramId,
      firstName: name || 'Test Bot',
      username: `bot_${telegramId}`,
      isBot: true,
      stats: {
        totalBids: 0,
        totalWins: 0,
        totalSpent: 0,
      },
    });

    await Balance.create({
      userId: user._id.toString(),
      available: balance,
      locked: 0,
    });

    logger.info(`Stress test bot created: ${user._id}`);

    res.json({
      success: true,
      id: user._id.toString(),
      telegramId,
    });
  } catch (error: any) {
    logger.error('Failed to create stress test bot:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Delete all test bots
 */
router.delete('/bots', async (_req: Request, res: Response) => {
  try {
    // Find bot users
    const bots = await User.find({ isBot: true });

    // Delete balances
    for (const bot of bots) {
      await Balance.deleteMany({ userId: bot._id.toString() });
    }

    // Delete bots
    const result = await User.deleteMany({ isBot: true });

    logger.info(`Deleted ${result.deletedCount} stress test bots`);
    res.json({ success: true, deleted: result.deletedCount });
  } catch (error: any) {
    logger.error('Failed to delete stress test bots:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get stress test stats
 */
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const auctions = await Auction.countDocuments({ isStressTest: true });
    const bots = await User.countDocuments({ isBot: true });
    const activeAuctions = await Auction.countDocuments({ 
      isStressTest: true, 
      status: 'active' 
    });

    res.json({
      auctions,
      activeAuctions,
      bots,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Cleanup expired auctions - mark as completed and optionally delete
 */
router.post('/cleanup-expired', async (req: Request, res: Response) => {
  try {
    const { deleteCompleted = false } = req.body;
    const now = new Date();

    // Mark expired auctions as completed
    const updateResult = await Auction.updateMany(
      { 
        isStressTest: true, 
        status: 'active',
        endsAt: { $lte: now }
      },
      { 
        $set: { 
          status: 'completed',
          completedAt: now
        }
      }
    );

    let deletedCount = 0;
    if (deleteCompleted) {
      // Delete completed stress test auctions
      const deleteResult = await Auction.deleteMany({
        isStressTest: true,
        status: 'completed'
      });
      deletedCount = deleteResult.deletedCount;
    }

    logger.info(`Cleanup: marked ${updateResult.modifiedCount} as completed, deleted ${deletedCount}`);
    
    res.json({
      success: true,
      markedCompleted: updateResult.modifiedCount,
      deleted: deletedCount
    });
  } catch (error: any) {
    logger.error('Failed to cleanup expired auctions:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
