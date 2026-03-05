import { Gift, IGiftDocument } from '../models/Gift';
import { Auction } from '../models';
import { AuctionStatus } from '../types';
import { redisService } from './RedisService';
import logger from '../utils/logger';

/**
 * 🎁 Gift Filter Service
 * 
 * Фильтры как на Fragment:
 * - Collection (коллекции подарков)
 * - Backdrop (фон)
 * - Symbol (символ)
 * - Rarity (редкость)
 */

// Типы фильтров
export interface GiftFilters {
  // Основные фильтры как на Fragment
  collection?: string | string[];    // Коллекция
  backdrop?: string | string[];      // Фон
  symbol?: string | string[];        // Символ
  rarity?: string | string[];        // common, rare, epic, legendary
  
  // Дополнительные фильтры
  model?: string | string[];         // Модель
  minNumber?: number;                // Мин. номер
  maxNumber?: number;                // Макс. номер
  
  // Ценовые
  minFloorPrice?: number;
  maxFloorPrice?: number;
  
  // Текстовый поиск
  search?: string;
}

export interface GiftSortOptions {
  sortBy?: 'ending_soon' | 'recently_listed' | 'price_low' | 'price_high' | 'number_low' | 'number_high' | 'rarity';
  limit?: number;
  skip?: number;
}

export interface FilterOption {
  value: string;
  label: string;
  count: number;
  icon?: string;
  color?: string;
}

export interface AvailableFilters {
  collections: FilterOption[];
  backdrops: FilterOption[];
  symbols: FilterOption[];
  rarities: FilterOption[];
  models: FilterOption[];
}

// Цвета редкости
const RARITY_COLORS: Record<string, string> = {
  common: '#9ca3af',
  rare: '#3b82f6',
  epic: '#a855f7',
  legendary: '#f59e0b',
};

// Иконки редкости
const RARITY_ICONS: Record<string, string> = {
  common: '⚪',
  rare: '🔵',
  epic: '🟣',
  legendary: '🟡',
};

class GiftFilterService {
  private readonly CACHE_PREFIX = 'gift:filters:';
  private readonly CACHE_TTL = 300; // 5 минут

  /**
   * Получить все доступные фильтры с количеством
   */
  async getAvailableFilters(): Promise<AvailableFilters> {
    const cacheKey = `${this.CACHE_PREFIX}available`;
    
    // Пробуем кэш
    const cached = await redisService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Агрегация для получения уникальных значений с количеством
    const [collections, backdrops, symbols, rarities, models] = await Promise.all([
      this.aggregateField('giftCollection'),
      this.aggregateField('backdrop'),
      this.aggregateField('symbol'),
      this.aggregateField('rarity'),
      this.aggregateField('giftModel'),
    ]);

    const result: AvailableFilters = {
      collections: collections.map(c => ({
        value: c._id,
        label: c._id,
        count: c.count,
      })),
      backdrops: backdrops.map(b => ({
        value: b._id,
        label: this.formatBackdropLabel(b._id),
        count: b.count,
      })),
      symbols: symbols.map(s => ({
        value: s._id,
        label: s._id,
        count: s.count,
        icon: s._id, // emoji
      })),
      rarities: [
        { value: 'legendary', label: 'Legendary', count: 0, color: RARITY_COLORS.legendary, icon: RARITY_ICONS.legendary },
        { value: 'epic', label: 'Epic', count: 0, color: RARITY_COLORS.epic, icon: RARITY_ICONS.epic },
        { value: 'rare', label: 'Rare', count: 0, color: RARITY_COLORS.rare, icon: RARITY_ICONS.rare },
        { value: 'common', label: 'Common', count: 0, color: RARITY_COLORS.common, icon: RARITY_ICONS.common },
      ].map(r => {
        const found = rarities.find(x => x._id === r.value);
        return { ...r, count: found?.count || 0 };
      }),
      models: models.map(m => ({
        value: m._id,
        label: m._id,
        count: m.count,
      })),
    };

    // Кэшируем
    await redisService.set(cacheKey, JSON.stringify(result), this.CACHE_TTL);

    return result;
  }

  /**
   * Агрегация по полю
   */
  private async aggregateField(field: string): Promise<{ _id: string; count: number }[]> {
    return Gift.aggregate([
      { $match: { [field]: { $exists: true, $ne: null, $ne: '' } } },
      { $group: { _id: `$${field}`, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
  }

  /**
   * Форматирование backdrop
   */
  private formatBackdropLabel(backdrop: string): string {
    if (!backdrop) return 'Unknown';
    return backdrop
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  /**
   * Поиск подарков с фильтрами
   */
  async searchGifts(
    filters: GiftFilters = {},
    options: GiftSortOptions = {}
  ): Promise<{ gifts: IGiftDocument[]; total: number; hasMore: boolean }> {
    const { sortBy = 'number_low', limit = 20, skip = 0 } = options;

    // Строим запрос
    const query = this.buildGiftQuery(filters);

    // Сортировка
    const sort = this.buildGiftSort(sortBy);

    // Выполняем запрос
    const [gifts, total] = await Promise.all([
      Gift.find(query).sort(sort).skip(skip).limit(limit).lean(),
      Gift.countDocuments(query),
    ]);

    return {
      gifts: gifts as IGiftDocument[],
      total,
      hasMore: skip + gifts.length < total,
    };
  }

  /**
   * Построение запроса
   */
  private buildGiftQuery(filters: GiftFilters): Record<string, unknown> {
    const query: Record<string, unknown> = {};

    // Collection
    if (filters.collection) {
      query.giftCollection = Array.isArray(filters.collection)
        ? { $in: filters.collection }
        : filters.collection;
    }

    // Backdrop
    if (filters.backdrop) {
      query.backdrop = Array.isArray(filters.backdrop)
        ? { $in: filters.backdrop }
        : filters.backdrop;
    }

    // Symbol
    if (filters.symbol) {
      query.symbol = Array.isArray(filters.symbol)
        ? { $in: filters.symbol }
        : filters.symbol;
    }

    // Rarity
    if (filters.rarity) {
      query.rarity = Array.isArray(filters.rarity)
        ? { $in: filters.rarity }
        : filters.rarity;
    }

    // Model
    if (filters.model) {
      query.giftModel = Array.isArray(filters.model)
        ? { $in: filters.model }
        : filters.model;
    }

    // Number range
    if (filters.minNumber !== undefined || filters.maxNumber !== undefined) {
      query.number = {};
      if (filters.minNumber !== undefined) {
        (query.number as Record<string, number>).$gte = filters.minNumber;
      }
      if (filters.maxNumber !== undefined) {
        (query.number as Record<string, number>).$lte = filters.maxNumber;
      }
    }

    // Floor price range
    if (filters.minFloorPrice !== undefined || filters.maxFloorPrice !== undefined) {
      query.floorPrice = {};
      if (filters.minFloorPrice !== undefined) {
        (query.floorPrice as Record<string, number>).$gte = filters.minFloorPrice;
      }
      if (filters.maxFloorPrice !== undefined) {
        (query.floorPrice as Record<string, number>).$lte = filters.maxFloorPrice;
      }
    }

    // Text search
    if (filters.search) {
      query.$or = [
        { name: { $regex: filters.search, $options: 'i' } },
        { description: { $regex: filters.search, $options: 'i' } },
        { giftCollection: { $regex: filters.search, $options: 'i' } },
      ];
    }

    return query;
  }

  /**
   * Построение сортировки
   */
  private buildGiftSort(sortBy: string): Record<string, 1 | -1> {
    switch (sortBy) {
      case 'price_low':
        return { floorPrice: 1, number: 1 };
      case 'price_high':
        return { floorPrice: -1, number: 1 };
      case 'number_low':
        return { number: 1 };
      case 'number_high':
        return { number: -1 };
      case 'rarity':
        // legendary > epic > rare > common
        return { rarity: -1, number: 1 };
      case 'recently_listed':
        return { createdAt: -1 };
      default:
        return { number: 1 };
    }
  }

  /**
   * Получить фильтры для аукционов по подаркам
   * (связь Gift -> Auction)
   */
  async getAuctionFiltersFromGifts(): Promise<AvailableFilters> {
    const cacheKey = `${this.CACHE_PREFIX}auction_gifts`;
    
    const cached = await redisService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Получаем ID подарков, которые в активных аукционах
    const activeAuctions = await Auction.find({
      status: { $in: [AuctionStatus.ACTIVE, AuctionStatus.SCHEDULED] },
    }).select('gift').lean();

    const giftIds = activeAuctions
      .map(a => (a.gift as any)?.id)
      .filter(Boolean);

    if (giftIds.length === 0) {
      return {
        collections: [],
        backdrops: [],
        symbols: [],
        rarities: [],
        models: [],
      };
    }

    // Агрегация по подаркам в аукционах
    const [collections, backdrops, symbols, rarities] = await Promise.all([
      this.aggregateAuctionGiftField('gift.giftCollection'),
      this.aggregateAuctionGiftField('gift.backdrop'),
      this.aggregateAuctionGiftField('gift.symbol'),
      this.aggregateAuctionGiftField('gift.rarity'),
    ]);

    const result: AvailableFilters = {
      collections: collections.map(c => ({
        value: c._id,
        label: c._id || 'Unknown',
        count: c.count,
      })),
      backdrops: backdrops.map(b => ({
        value: b._id,
        label: this.formatBackdropLabel(b._id),
        count: b.count,
      })),
      symbols: symbols.map(s => ({
        value: s._id,
        label: s._id || '?',
        count: s.count,
        icon: s._id,
      })),
      rarities: [
        { value: 'legendary', label: 'Legendary', count: 0, color: RARITY_COLORS.legendary, icon: RARITY_ICONS.legendary },
        { value: 'epic', label: 'Epic', count: 0, color: RARITY_COLORS.epic, icon: RARITY_ICONS.epic },
        { value: 'rare', label: 'Rare', count: 0, color: RARITY_COLORS.rare, icon: RARITY_ICONS.rare },
        { value: 'common', label: 'Common', count: 0, color: RARITY_COLORS.common, icon: RARITY_ICONS.common },
      ].map(r => {
        const found = rarities.find(x => x._id === r.value);
        return { ...r, count: found?.count || 0 };
      }),
      models: [],
    };

    await redisService.set(cacheKey, JSON.stringify(result), 60); // 1 минута кэш

    return result;
  }

  /**
   * Агрегация по полю подарка в аукционах
   */
  private async aggregateAuctionGiftField(field: string): Promise<{ _id: string; count: number }[]> {
    return Auction.aggregate([
      {
        $match: {
          status: { $in: [AuctionStatus.ACTIVE, AuctionStatus.SCHEDULED] },
          [field]: { $exists: true, $ne: null, $ne: '' },
        },
      },
      { $group: { _id: `$${field}`, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
  }

  /**
   * Получить статистику фильтров
   */
  async getFilterStats(): Promise<{
    totalGifts: number;
    totalCollections: number;
    totalBackdrops: number;
    totalSymbols: number;
    rarityDistribution: Record<string, number>;
  }> {
    const [
      totalGifts,
      collections,
      backdrops,
      symbols,
      rarities,
    ] = await Promise.all([
      Gift.countDocuments(),
      Gift.distinct('giftCollection'),
      Gift.distinct('backdrop'),
      Gift.distinct('symbol'),
      Gift.aggregate([
        { $group: { _id: '$rarity', count: { $sum: 1 } } },
      ]),
    ]);

    const rarityDistribution: Record<string, number> = {};
    rarities.forEach(r => {
      rarityDistribution[r._id] = r.count;
    });

    return {
      totalGifts,
      totalCollections: collections.length,
      totalBackdrops: backdrops.length,
      totalSymbols: symbols.length,
      rarityDistribution,
    };
  }

  /**
   * Получить подарок по ID
   */
  async getGiftById(giftId: string): Promise<IGiftDocument | null> {
    return Gift.findById(giftId).lean();
  }

  /**
   * Получить метаданные редкости
   */
  getRarityMeta(rarity: string): { color: string; icon: string; order: number } {
    const meta: Record<string, { color: string; icon: string; order: number }> = {
      common: { color: '#9CA3AF', icon: '⚪', order: 1 },
      rare: { color: '#3B82F6', icon: '🔵', order: 2 },
      epic: { color: '#8B5CF6', icon: '🟣', order: 3 },
      legendary: { color: '#F59E0B', icon: '🟡', order: 4 },
    };
    return meta[rarity] || meta.common;
  }
}

export const giftFilterService = new GiftFilterService();
export default giftFilterService;
