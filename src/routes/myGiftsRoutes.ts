import { Router, Response } from 'express';
import { myGiftsService } from '../services/MyGiftsService';
import { authMiddleware, asyncHandler, AuthRequest } from '../middleware';

// Helper function
const createResponse = (data: unknown, error?: string) => ({
  success: !error,
  data,
  error,
  timestamp: new Date(),
});

/**
 * 🎁 My Gifts Routes
 * 
 * Выигранные подарки пользователя
 */

const router = Router();

// Все роуты требуют авторизации
router.use(authMiddleware);

/**
 * GET /api/my/gifts
 * Получить выигранные подарки
 */
router.get(
  '/gifts',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    
    const {
      // Фильтры
      collection,
      rarity,
      search,
      
      // Пагинация
      page = '1',
      limit = '20',
      
      // Сортировка
      sort = 'won_newest',
    } = req.query;

    const options = {
      filters: {
        collection: collection as string,
        rarity: rarity as string,
        search: search as string,
      },
      page: Math.max(1, parseInt(page as string)),
      limit: Math.min(100, Math.max(1, parseInt(limit as string))),
      sort: sort as 'won_newest' | 'won_oldest' | 'price_asc' | 'price_desc' | 'rarity',
    };

    const result = await myGiftsService.getWonGifts(userId, options);

    res.json(createResponse({
      gifts: result.gifts,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
        hasNext: result.page < result.totalPages,
        hasPrev: result.page > 1,
      },
    }));
  })
);

/**
 * GET /api/my/gifts/stats
 * Статистика подарков пользователя
 */
router.get(
  '/gifts/stats',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    const stats = await myGiftsService.getGiftStats(userId);
    res.json(createResponse(stats));
  })
);

/**
 * GET /api/my/gifts/recent
 * Недавние выигрыши (для профиля)
 */
router.get(
  '/gifts/recent',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    const { limit = '5' } = req.query;
    
    const gifts = await myGiftsService.getRecentWins(userId, parseInt(limit as string));
    res.json(createResponse(gifts));
  })
);

/**
 * GET /api/my/participations
 * Активные участия в аукционах
 */
router.get(
  '/participations',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    const participations = await myGiftsService.getActiveParticipations(userId);
    
    res.json(createResponse({
      participations,
      count: participations.length,
    }));
  })
);

/**
 * GET /api/my/participations/history
 * История участия в аукционах
 */
router.get(
  '/participations/history',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    
    const {
      status,  // won, lost, all
      page = '1',
      limit = '20',
    } = req.query;

    const options = {
      status: status as 'won' | 'lost' | 'all',
      page: Math.max(1, parseInt(page as string)),
      limit: Math.min(100, Math.max(1, parseInt(limit as string))),
    };

    const result = await myGiftsService.getParticipationHistory(userId, options);

    res.json(createResponse({
      history: result.history,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
      summary: {
        wins: result.wins,
        losses: result.losses,
        winRate: result.total > 0 ? (result.wins / result.total * 100).toFixed(1) + '%' : '0%',
      },
    }));
  })
);

/**
 * GET /api/my/bids
 * История ставок пользователя
 */
router.get(
  '/bids',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    
    const {
      auctionId,
      page = '1',
      limit = '50',
    } = req.query;

    const result = await myGiftsService.getBidHistory(userId, {
      auctionId: auctionId as string,
      page: parseInt(page as string),
      limit: parseInt(limit as string),
    });

    res.json(createResponse({
      bids: result.bids,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
      stats: {
        totalBids: result.totalBids,
        totalAmount: result.totalAmount,
        averageBid: result.averageBid,
      },
    }));
  })
);

/**
 * GET /api/my/spending
 * Статистика расходов
 */
router.get(
  '/spending',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    
    const { period = '30' } = req.query; // Дни
    const days = Math.min(365, Math.max(1, parseInt(period as string)));
    
    const spending = await myGiftsService.getSpendingStats(userId, days);
    
    res.json(createResponse(spending));
  })
);

export default router;
