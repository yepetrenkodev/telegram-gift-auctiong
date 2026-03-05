import { Router, Request, Response } from 'express';
import { watchlistService } from '../services/WatchlistService';
import { authMiddleware, asyncHandler, AuthRequest } from '../middleware';

const router = Router();

/**
 * GET /api/watchlist
 * Получить избранные аукционы пользователя
 */
router.get(
  '/',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.userId!;
    const { status, limit, skip } = req.query;

    const items = await watchlistService.getUserWatchlist(userId, {
      status: status as 'all' | 'active' | 'ended',
      limit: limit ? parseInt(limit as string) : undefined,
      skip: skip ? parseInt(skip as string) : undefined,
    });

    res.json({
      success: true,
      data: items,
      count: items.length,
    });
  })
);

/**
 * POST /api/watchlist/:auctionId
 * Добавить аукцион в избранное
 */
router.post(
  '/:auctionId',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.userId!;
    const { auctionId } = req.params;
    const { notifyOnStart, notifyOnEndingSoon, notifyOnOutbid, notes } = req.body;

    const result = await watchlistService.addToWatchlist(userId, auctionId, {
      notifyOnStart,
      notifyOnEndingSoon,
      notifyOnOutbid,
      notes,
    });

    if (!result.success) {
      res.status(400).json({ success: false, error: result.error });
      return;
    }

    res.json({
      success: true,
      message: 'Added to watchlist',
      data: result.item,
    });
  })
);

/**
 * DELETE /api/watchlist/:auctionId
 * Удалить из избранного
 */
router.delete(
  '/:auctionId',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.userId!;
    const { auctionId } = req.params;

    const result = await watchlistService.removeFromWatchlist(userId, auctionId);

    if (!result.success) {
      res.status(400).json({ success: false, error: result.error });
      return;
    }

    res.json({
      success: true,
      message: 'Removed from watchlist',
    });
  })
);

/**
 * GET /api/watchlist/:auctionId/status
 * Проверить, в избранном ли аукцион
 */
router.get(
  '/:auctionId/status',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.userId!;
    const { auctionId } = req.params;

    const isWatching = await watchlistService.isWatching(userId, auctionId);

    res.json({
      success: true,
      data: { isWatching },
    });
  })
);

/**
 * PATCH /api/watchlist/:auctionId/settings
 * Обновить настройки уведомлений
 */
router.patch(
  '/:auctionId/settings',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.userId!;
    const { auctionId } = req.params;
    const { notifyOnStart, notifyOnEndingSoon, notifyOnOutbid, notes } = req.body;

    const result = await watchlistService.updateNotificationSettings(
      userId,
      auctionId,
      { notifyOnStart, notifyOnEndingSoon, notifyOnOutbid, notes }
    );

    if (!result.success) {
      res.status(400).json({ success: false, error: result.error });
      return;
    }

    res.json({
      success: true,
      message: 'Settings updated',
    });
  })
);

/**
 * GET /api/watchlist/auction/:auctionId/count
 * Получить количество наблюдателей аукциона (публичный)
 */
router.get(
  '/auction/:auctionId/count',
  asyncHandler(async (req: Request, res: Response) => {
    const { auctionId } = req.params;

    const count = await watchlistService.getWatchersCount(auctionId);

    res.json({
      success: true,
      data: { watchersCount: count },
    });
  })
);

export default router;
