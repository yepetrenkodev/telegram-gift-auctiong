import { Router, Request, Response } from 'express';
import { socketService, redisService, timerService, leaderboardService } from '../services';
import logger from '../utils/logger';

const router = Router();

/**
 * 📊 Real-Time API Routes
 * 
 * Endpoints for real-time status and debugging
 */

/**
 * GET /realtime/status
 * Get real-time services status
 */
router.get('/status', async (_req: Request, res: Response) => {
  try {
    const status = {
      socket: {
        connected: socketService.getConnectedCount(),
      },
      redis: {
        available: redisService.isAvailable(),
      },
      timers: {
        active: timerService.getActiveTimers(),
      },
      timestamp: new Date(),
    };

    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    logger.error('Error getting realtime status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get realtime status',
    });
  }
});

/**
 * GET /realtime/leaderboard/:auctionId/:roundNumber
 * Get leaderboard for specific auction round
 */
router.get('/leaderboard/:auctionId/:roundNumber', async (req: Request, res: Response) => {
  try {
    const { auctionId, roundNumber } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;

    const leaderboard = await leaderboardService.getLeaderboard(
      auctionId,
      parseInt(roundNumber),
      limit
    );

    const stats = await leaderboardService.getStats(auctionId, parseInt(roundNumber));

    res.json({
      success: true,
      data: {
        leaderboard,
        stats,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    logger.error('Error getting leaderboard:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get leaderboard',
    });
  }
});

/**
 * GET /realtime/viewers/:auctionId
 * Get viewers count for auction
 */
router.get('/viewers/:auctionId', async (req: Request, res: Response) => {
  try {
    const { auctionId } = req.params;

    const socketViewers = socketService.getAuctionViewers(auctionId);
    const redisViewers = await redisService.getOnlineCount(auctionId);

    res.json({
      success: true,
      data: {
        auctionId,
        viewers: Math.max(socketViewers, redisViewers),
        socketViewers,
        redisViewers,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    logger.error('Error getting viewers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get viewers count',
    });
  }
});

/**
 * GET /realtime/timer/:auctionId/:roundNumber
 * Get timer info for auction round
 */
router.get('/timer/:auctionId/:roundNumber', async (req: Request, res: Response) => {
  try {
    const { auctionId, roundNumber } = req.params;
    const roundNum = parseInt(roundNumber);

    const isActive = timerService.isTimerActive(auctionId, roundNum);
    const secondsLeft = timerService.getSecondsLeft(auctionId, roundNum);

    res.json({
      success: true,
      data: {
        auctionId,
        roundNumber: roundNum,
        isActive,
        secondsLeft,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    logger.error('Error getting timer:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get timer info',
    });
  }
});

/**
 * POST /realtime/test/broadcast
 * Test broadcast (development only)
 */
router.post('/test/broadcast', async (req: Request, res: Response) => {
  if (process.env.NODE_ENV !== 'development') {
    res.status(403).json({
      success: false,
      error: 'Only available in development',
    });
    return;
  }

  try {
    const { event, data, auctionId } = req.body;

    if (auctionId) {
      socketService.getIO()?.to(`auction:${auctionId}`).emit(event, data);
    } else {
      socketService.broadcastToAll(event, data);
    }

    res.json({
      success: true,
      message: `Broadcasted ${event}`,
    });
  } catch (error) {
    logger.error('Error broadcasting:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to broadcast',
    });
  }
});

export default router;
