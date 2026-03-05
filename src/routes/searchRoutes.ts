import { Router, Request, Response } from 'express';
import { auctionSearchService } from '../services/AuctionSearchService';
import { asyncHandler, optionalAuthMiddleware } from '../middleware';
import { AuctionStatus } from '../types';

const router = Router();

/**
 * GET /api/search/auctions
 * Поиск аукционов с фильтрами
 */
router.get(
  '/auctions',
  optionalAuthMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const {
      // Базовые фильтры
      status,
      category,
      tags,
      
      // Ценовые фильтры
      minPrice,
      maxPrice,
      minBid,
      maxBid,
      
      // Временные фильтры
      endingWithin,
      startingWithin,
      
      // Фильтры активности
      minParticipants,
      minBids,
      
      // Текстовый поиск
      q,
      
      // Опции
      sort,
      limit,
      skip,
      includeWatchCount,
    } = req.query;

    const result = await auctionSearchService.search(
      {
        status: status as AuctionStatus | undefined,
        category: category as string | undefined,
        tags: tags ? (tags as string).split(',') : undefined,
        minPrice: minPrice ? parseFloat(minPrice as string) : undefined,
        maxPrice: maxPrice ? parseFloat(maxPrice as string) : undefined,
        minBid: minBid ? parseFloat(minBid as string) : undefined,
        maxBid: maxBid ? parseFloat(maxBid as string) : undefined,
        endingWithin: endingWithin ? parseInt(endingWithin as string) : undefined,
        startingWithin: startingWithin ? parseInt(startingWithin as string) : undefined,
        minParticipants: minParticipants ? parseInt(minParticipants as string) : undefined,
        minBids: minBids ? parseInt(minBids as string) : undefined,
        search: q as string | undefined,
      },
      {
        sort: sort as 'newest' | 'ending_soon' | 'popular' | 'price_low' | 'price_high' | 'most_bids',
        limit: limit ? parseInt(limit as string) : 20,
        skip: skip ? parseInt(skip as string) : 0,
        includeWatchCount: includeWatchCount === 'true',
      }
    );

    res.json({
      success: true,
      data: result.auctions,
      meta: {
        total: result.total,
        hasMore: result.hasMore,
        limit: limit ? parseInt(limit as string) : 20,
        skip: skip ? parseInt(skip as string) : 0,
      },
    });
  })
);

/**
 * GET /api/search/quick
 * Быстрый поиск (autocomplete)
 */
router.get(
  '/quick',
  asyncHandler(async (req: Request, res: Response) => {
    const { q, limit } = req.query;

    if (!q || (q as string).length < 2) {
      res.json({ success: true, data: [] });
      return;
    }

    const results = await auctionSearchService.quickSearch(
      q as string,
      limit ? parseInt(limit as string) : 5
    );

    res.json({
      success: true,
      data: results,
    });
  })
);

/**
 * GET /api/search/hot
 * Горячие аукционы
 */
router.get(
  '/hot',
  asyncHandler(async (req: Request, res: Response) => {
    const { limit } = req.query;

    const auctions = await auctionSearchService.getHot(
      limit ? parseInt(limit as string) : 10
    );

    res.json({
      success: true,
      data: auctions,
    });
  })
);

/**
 * GET /api/search/ending-soon
 * Заканчивающиеся аукционы
 */
router.get(
  '/ending-soon',
  asyncHandler(async (req: Request, res: Response) => {
    const { minutes, limit } = req.query;

    const auctions = await auctionSearchService.getEndingSoon(
      minutes ? parseInt(minutes as string) : 30,
      limit ? parseInt(limit as string) : 10
    );

    res.json({
      success: true,
      data: auctions,
    });
  })
);

/**
 * GET /api/search/new
 * Новые аукционы
 */
router.get(
  '/new',
  asyncHandler(async (req: Request, res: Response) => {
    const { hours, limit } = req.query;

    const auctions = await auctionSearchService.getNew(
      hours ? parseInt(hours as string) : 24,
      limit ? parseInt(limit as string) : 10
    );

    res.json({
      success: true,
      data: auctions,
    });
  })
);

/**
 * GET /api/search/upcoming
 * Предстоящие аукционы (календарь)
 */
router.get(
  '/upcoming',
  asyncHandler(async (req: Request, res: Response) => {
    const { days, limit } = req.query;

    const auctions = await auctionSearchService.getUpcoming(
      days ? parseInt(days as string) : 7,
      limit ? parseInt(limit as string) : 50
    );

    res.json({
      success: true,
      data: auctions,
    });
  })
);

/**
 * GET /api/search/category/:slug
 * Аукционы по категории
 */
router.get(
  '/category/:slug',
  asyncHandler(async (req: Request, res: Response) => {
    const { slug } = req.params;
    const { limit, skip, sort } = req.query;

    const result = await auctionSearchService.getByCategory(slug, {
      limit: limit ? parseInt(limit as string) : 20,
      skip: skip ? parseInt(skip as string) : 0,
      sort: sort as 'newest' | 'ending_soon' | 'popular' | 'price_low' | 'price_high' | 'most_bids',
    });

    res.json({
      success: true,
      data: result.auctions,
      meta: {
        total: result.total,
        hasMore: result.hasMore,
      },
    });
  })
);

/**
 * GET /api/search/tag/:slug
 * Аукционы по тегу
 */
router.get(
  '/tag/:slug',
  asyncHandler(async (req: Request, res: Response) => {
    const { slug } = req.params;
    const { limit, skip, sort } = req.query;

    const result = await auctionSearchService.getByTag(slug, {
      limit: limit ? parseInt(limit as string) : 20,
      skip: skip ? parseInt(skip as string) : 0,
      sort: sort as 'newest' | 'ending_soon' | 'popular' | 'price_low' | 'price_high' | 'most_bids',
    });

    res.json({
      success: true,
      data: result.auctions,
      meta: {
        total: result.total,
        hasMore: result.hasMore,
      },
    });
  })
);

/**
 * GET /api/search/categories
 * Список категорий
 */
router.get(
  '/categories',
  asyncHandler(async (_req: Request, res: Response) => {
    const categories = await auctionSearchService.getCategories();

    res.json({
      success: true,
      data: categories,
    });
  })
);

/**
 * GET /api/search/tags
 * Список тегов
 */
router.get(
  '/tags',
  asyncHandler(async (_req: Request, res: Response) => {
    const tags = await auctionSearchService.getTags();

    res.json({
      success: true,
      data: tags,
    });
  })
);

export default router;
