import { Router, Request, Response } from 'express';
import { giftFilterService } from '../services/GiftFilterService';
import { asyncHandler } from '../middleware';
import logger from '../utils/logger';

// Helper function
const createResponse = (data: unknown, error?: string) => ({
  success: !error,
  data,
  error,
  timestamp: new Date(),
});

/**
 * 🔍 Gift Filter Routes
 * 
 * Fragment-style фильтры для подарков и аукционов
 */

const router = Router();

/**
 * GET /api/filters
 * Получить все доступные фильтры с количеством
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const filters = await giftFilterService.getAvailableFilters();
    res.json(createResponse(filters));
  })
);

/**
 * GET /api/filters/auction
 * Получить фильтры для активных аукционов
 */
router.get(
  '/auction',
  asyncHandler(async (req: Request, res: Response) => {
    const filters = await giftFilterService.getAuctionFiltersFromGifts();
    res.json(createResponse(filters));
  })
);

/**
 * GET /api/filters/collections
 * Получить список коллекций
 */
router.get(
  '/collections',
  asyncHandler(async (req: Request, res: Response) => {
    const filters = await giftFilterService.getAvailableFilters();
    res.json(createResponse({
      collections: filters.collections,
      total: filters.collections.length,
    }));
  })
);

/**
 * GET /api/filters/backdrops
 * Получить список фонов
 */
router.get(
  '/backdrops',
  asyncHandler(async (req: Request, res: Response) => {
    const filters = await giftFilterService.getAvailableFilters();
    res.json(createResponse({
      backdrops: filters.backdrops,
      total: filters.backdrops.length,
    }));
  })
);

/**
 * GET /api/filters/symbols
 * Получить список символов
 */
router.get(
  '/symbols',
  asyncHandler(async (req: Request, res: Response) => {
    const filters = await giftFilterService.getAvailableFilters();
    res.json(createResponse({
      symbols: filters.symbols,
      total: filters.symbols.length,
    }));
  })
);

/**
 * GET /api/filters/rarities
 * Получить список редкостей
 */
router.get(
  '/rarities',
  asyncHandler(async (req: Request, res: Response) => {
    const filters = await giftFilterService.getAvailableFilters();
    res.json(createResponse({
      rarities: filters.rarities,
      total: filters.rarities.length,
    }));
  })
);

/**
 * GET /api/gifts
 * Поиск подарков с фильтрами Fragment-style
 */
router.get(
  '/gifts',
  asyncHandler(async (req: Request, res: Response) => {
    const {
      // Fragment-style фильтры
      collection,
      backdrop,
      symbol,
      rarity,
      model,
      
      // Поиск
      search,
      minNumber,
      maxNumber,
      
      // Цена
      minPrice,
      maxPrice,
      
      // Пагинация
      page = '1',
      limit = '20',
      
      // Сортировка
      sort = 'newest',
    } = req.query;

    // Парсим фильтры
    const filters = {
      collections: collection ? (Array.isArray(collection) ? collection : [collection]) as string[] : undefined,
      backdrops: backdrop ? (Array.isArray(backdrop) ? backdrop : [backdrop]) as string[] : undefined,
      symbols: symbol ? (Array.isArray(symbol) ? symbol : [symbol]) as string[] : undefined,
      rarities: rarity ? (Array.isArray(rarity) ? rarity : [rarity]) as string[] : undefined,
      models: model ? (Array.isArray(model) ? model : [model]) as string[] : undefined,
      search: search as string,
      minNumber: minNumber ? parseInt(minNumber as string) : undefined,
      maxNumber: maxNumber ? parseInt(maxNumber as string) : undefined,
      minPrice: minPrice ? parseInt(minPrice as string) : undefined,
      maxPrice: maxPrice ? parseInt(maxPrice as string) : undefined,
    };

    // Опции пагинации
    const options = {
      page: Math.max(1, parseInt(page as string)),
      limit: Math.min(100, Math.max(1, parseInt(limit as string))),
      sort: sort as 'newest' | 'oldest' | 'price_asc' | 'price_desc' | 'number_asc' | 'number_desc' | 'rarity',
    };

    logger.debug(`Gift search with filters: ${JSON.stringify(filters)}`);

    const result = await giftFilterService.searchGifts(filters, options);

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
      appliedFilters: filters,
    }));
  })
);

/**
 * GET /api/gifts/:id
 * Получить подарок по ID
 */
router.get(
  '/gifts/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    
    const gift = await giftFilterService.getGiftById(id);
    
    if (!gift) {
      return res.status(404).json(createResponse(null, 'Gift not found'));
    }
    
    res.json(createResponse(gift));
  })
);

/**
 * GET /api/gifts/collection/:name
 * Получить подарки по коллекции
 */
router.get(
  '/gifts/collection/:name',
  asyncHandler(async (req: Request, res: Response) => {
    const { name } = req.params;
    const { page = '1', limit = '20', sort = 'newest' } = req.query;

    const result = await giftFilterService.searchGifts(
      { collections: [name] },
      {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        sort: sort as 'newest' | 'oldest' | 'price_asc' | 'price_desc' | 'number_asc' | 'number_desc' | 'rarity',
      }
    );

    res.json(createResponse({
      collection: name,
      gifts: result.gifts,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    }));
  })
);

/**
 * GET /api/gifts/rarity/:rarity
 * Получить подарки по редкости
 */
router.get(
  '/gifts/rarity/:rarity',
  asyncHandler(async (req: Request, res: Response) => {
    const { rarity } = req.params;
    const { page = '1', limit = '20', sort = 'newest' } = req.query;

    const result = await giftFilterService.searchGifts(
      { rarities: [rarity] },
      {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        sort: sort as 'newest' | 'oldest' | 'price_asc' | 'price_desc' | 'number_asc' | 'number_desc' | 'rarity',
      }
    );

    // Получаем метаданные редкости
    const rarityMeta = giftFilterService.getRarityMeta(rarity);

    res.json(createResponse({
      rarity: {
        name: rarity,
        ...rarityMeta,
      },
      gifts: result.gifts,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    }));
  })
);

export default router;
