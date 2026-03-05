import { Router, Request, Response } from 'express';
import { activityFeedService, ActivityType } from '../services/ActivityFeedService';
import { asyncHandler, optionalAuthMiddleware, AuthRequest } from '../middleware';

const router = Router();

/**
 * GET /api/activity/feed
 * Получить глобальную ленту активности
 */
router.get(
  '/feed',
  optionalAuthMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const { limit, before } = req.query;

    const feed = await activityFeedService.getGlobalFeed(
      limit ? parseInt(limit as string) : 50,
      before ? new Date(before as string) : undefined
    );

    res.json({
      success: true,
      data: feed,
      count: feed.length,
    });
  })
);

/**
 * GET /api/activity/auction/:auctionId
 * Получить ленту активности для аукциона
 */
router.get(
  '/auction/:auctionId',
  optionalAuthMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const { auctionId } = req.params;
    const { limit, before } = req.query;

    const feed = await activityFeedService.getAuctionFeed(
      auctionId,
      limit ? parseInt(limit as string) : 50,
      before ? new Date(before as string) : undefined
    );

    res.json({
      success: true,
      data: feed,
      count: feed.length,
    });
  })
);

/**
 * GET /api/activity/user/:userId
 * Получить ленту активности пользователя
 */
router.get(
  '/user/:userId',
  optionalAuthMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.params;
    const { limit, before } = req.query;

    const feed = await activityFeedService.getUserFeed(
      userId,
      limit ? parseInt(limit as string) : 50,
      before ? new Date(before as string) : undefined
    );

    res.json({
      success: true,
      data: feed,
      count: feed.length,
    });
  })
);

/**
 * GET /api/activity/my
 * Получить свою ленту активности
 */
router.get(
  '/my',
  optionalAuthMiddleware,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { limit, before } = req.query;

    const feed = await activityFeedService.getUserFeed(
      req.userId,
      limit ? parseInt(limit as string) : 50,
      before ? new Date(before as string) : undefined
    );

    res.json({
      success: true,
      data: feed,
      count: feed.length,
    });
  })
);

/**
 * GET /api/activity/stats
 * Получить статистику активности
 */
router.get(
  '/stats',
  asyncHandler(async (req: Request, res: Response) => {
    const { hours } = req.query;

    const stats = await activityFeedService.getStats(
      hours ? parseInt(hours as string) : 24
    );

    res.json({
      success: true,
      data: stats,
    });
  })
);

/**
 * GET /api/activity/types
 * Получить список типов активности
 */
router.get(
  '/types',
  (_req: Request, res: Response) => {
    res.json({
      success: true,
      data: Object.values(ActivityType),
    });
  }
);

export default router;
