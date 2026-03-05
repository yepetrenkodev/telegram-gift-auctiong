import { Auction, Round } from '../models';
import { Category, Tag, SYSTEM_TAGS, ICategoryDocument, ITagDocument } from '../models/Category';
import { AuctionStatus, RoundStatus } from '../types';
import { redisService } from './RedisService';
import logger from '../utils/logger';

interface AuctionSearchFilters {
  // Базовые фильтры
  status?: AuctionStatus | AuctionStatus[];
  category?: string;           // slug категории
  tags?: string[];             // slug'и тегов
  
  // Ценовые фильтры
  minPrice?: number;
  maxPrice?: number;
  minBid?: number;
  maxBid?: number;
  
  // Временные фильтры
  endingWithin?: number;       // минут до окончания
  startingWithin?: number;     // минут до начала
  startsAfter?: Date;
  startsBefore?: Date;
  
  // Фильтры активности
  minParticipants?: number;
  maxParticipants?: number;
  minBids?: number;
  
  // Текстовый поиск
  search?: string;
  
  // Подарки
  giftRarity?: string[];
}

interface AuctionSearchOptions {
  sort?: 'newest' | 'ending_soon' | 'popular' | 'price_low' | 'price_high' | 'most_bids';
  limit?: number;
  skip?: number;
  includeWatchCount?: boolean;
}

interface SearchResult {
  auctions: AuctionListItem[];
  total: number;
  hasMore: boolean;
}

interface AuctionListItem {
  id: string;
  title: string;
  status: string;
  category?: { name: string; slug: string; icon: string };
  tags: { name: string; slug: string; color: string }[];
  gift?: {
    name: string;
    emoji: string;
    rarity: string;
  };
  currentRound: number;
  totalRounds: number;
  currentBid: number;
  minBidAmount: number;
  participantsCount: number;
  bidsCount: number;
  watchersCount?: number;
  startsAt?: Date;
  endsAt?: Date;
  timeLeft?: number; // секунд
  isHot: boolean;
  isNew: boolean;
  isEndingSoon: boolean;
}

/**
 * 🔍 Auction Search Service
 * 
 * Умный поиск и фильтрация аукционов
 */
class AuctionSearchService {
  private readonly CACHE_PREFIX = 'search:';
  private readonly CACHE_TTL = 30; // 30 секунд

  /**
   * Поиск аукционов с фильтрами
   */
  async search(
    filters: AuctionSearchFilters = {},
    options: AuctionSearchOptions = {}
  ): Promise<SearchResult> {
    const {
      sort = 'newest',
      limit = 20,
      skip = 0,
      includeWatchCount = false,
    } = options;

    // Строим запрос
    const query = this.buildQuery(filters);
    const sortQuery = this.buildSort(sort);

    // Выполняем запрос
    const [auctions, total] = await Promise.all([
      Auction.find(query)
        .populate('gifts', 'name emoji rarity')
        .populate('categoryId', 'name slug icon')
        .sort(sortQuery)
        .skip(skip)
        .limit(limit)
        .lean(),
      Auction.countDocuments(query),
    ]);

    // Преобразуем результаты
    const now = new Date();
    const items: AuctionListItem[] = await Promise.all(
      auctions.map(async (auction) => {
        const item = this.mapAuctionToListItem(auction, now);
        
        if (includeWatchCount) {
          const { Watchlist } = await import('../models/Watchlist');
          item.watchersCount = await Watchlist.countDocuments({ auctionId: auction._id });
        }
        
        return item;
      })
    );

    return {
      auctions: items,
      total,
      hasMore: skip + auctions.length < total,
    };
  }

  /**
   * Получить аукционы по категориям
   */
  async getByCategory(categorySlug: string, options: AuctionSearchOptions = {}): Promise<SearchResult> {
    return this.search({ category: categorySlug, status: AuctionStatus.ACTIVE }, options);
  }

  /**
   * Получить аукционы по тегу
   */
  async getByTag(tagSlug: string, options: AuctionSearchOptions = {}): Promise<SearchResult> {
    return this.search({ tags: [tagSlug], status: AuctionStatus.ACTIVE }, options);
  }

  /**
   * Получить "горячие" аукционы (много активности)
   */
  async getHot(limit = 10): Promise<AuctionListItem[]> {
    const cacheKey = `${this.CACHE_PREFIX}hot`;
    
    // Проверяем кэш
    const cached = await redisService.get<AuctionListItem[]>(cacheKey);
    if (cached) return cached;

    // Находим аукционы с наибольшей активностью за последний час
    const hourAgo = new Date();
    hourAgo.setHours(hourAgo.getHours() - 1);

    const result = await this.search(
      { status: AuctionStatus.ACTIVE, minBids: 5 },
      { sort: 'most_bids', limit }
    );

    // Кэшируем
    await redisService.set(cacheKey, result.auctions, this.CACHE_TTL);

    return result.auctions;
  }

  /**
   * Получить заканчивающиеся аукционы
   */
  async getEndingSoon(minutes = 30, limit = 10): Promise<AuctionListItem[]> {
    const cacheKey = `${this.CACHE_PREFIX}ending:${minutes}`;
    
    const cached = await redisService.get<AuctionListItem[]>(cacheKey);
    if (cached) return cached;

    const result = await this.search(
      { status: AuctionStatus.ACTIVE, endingWithin: minutes },
      { sort: 'ending_soon', limit }
    );

    await redisService.set(cacheKey, result.auctions, this.CACHE_TTL);

    return result.auctions;
  }

  /**
   * Получить новые аукционы
   */
  async getNew(hours = 24, limit = 10): Promise<AuctionListItem[]> {
    const since = new Date();
    since.setHours(since.getHours() - hours);

    const result = await this.search(
      { status: AuctionStatus.ACTIVE, startsAfter: since },
      { sort: 'newest', limit }
    );

    return result.auctions;
  }

  /**
   * Получить предстоящие аукционы (календарь)
   */
  async getUpcoming(days = 7, limit = 50): Promise<AuctionListItem[]> {
    const until = new Date();
    until.setDate(until.getDate() + days);

    const result = await this.search(
      { status: AuctionStatus.SCHEDULED, startsBefore: until },
      { sort: 'newest', limit }
    );

    return result.auctions;
  }

  /**
   * Быстрый поиск (autocomplete)
   */
  async quickSearch(query: string, limit = 5): Promise<{ id: string; title: string; emoji: string }[]> {
    if (!query || query.length < 2) return [];

    const auctions = await Auction.find({
      title: { $regex: query, $options: 'i' },
      status: { $in: [AuctionStatus.ACTIVE, AuctionStatus.SCHEDULED] },
    })
      .select('title gift')
      .populate('gift', 'emoji')
      .limit(limit)
      .lean();

    return auctions.map(a => ({
      id: String(a._id),
      title: a.title,
      emoji: (a.gift as { emoji?: string })?.emoji || '🎁',
    }));
  }

  /**
   * Получить все категории
   */
  async getCategories() {
    return Category.find({ isActive: true }).sort({ sortOrder: 1 }).lean();
  }

  /**
   * Получить все теги
   */
  async getTags() {
    return Tag.find().sort({ usageCount: -1 }).lean();
  }

  /**
   * Инициализация системных тегов
   */
  async initSystemTags(): Promise<void> {
    for (const tag of SYSTEM_TAGS) {
      await Tag.findOneAndUpdate(
        { slug: tag.slug },
        tag,
        { upsert: true }
      );
    }
    logger.info('System tags initialized');
  }

  // ==================== PRIVATE METHODS ====================

  /**
   * Построить MongoDB запрос из фильтров
   */
  private buildQuery(filters: AuctionSearchFilters): Record<string, unknown> {
    const query: Record<string, unknown> = {};

    // Статус
    if (filters.status) {
      query.status = Array.isArray(filters.status) 
        ? { $in: filters.status } 
        : filters.status;
    }

    // Категория
    if (filters.category) {
      query['categorySlug'] = filters.category;
    }

    // Теги
    if (filters.tags && filters.tags.length > 0) {
      query['tags'] = { $in: filters.tags };
    }

    // Цена
    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
      query.highestBid = {};
      if (filters.minPrice !== undefined) (query.highestBid as Record<string, number>).$gte = filters.minPrice;
      if (filters.maxPrice !== undefined) (query.highestBid as Record<string, number>).$lte = filters.maxPrice;
    }

    // Минимальная ставка
    if (filters.minBid !== undefined || filters.maxBid !== undefined) {
      query.minBidAmount = {};
      if (filters.minBid !== undefined) (query.minBidAmount as Record<string, number>).$gte = filters.minBid;
      if (filters.maxBid !== undefined) (query.minBidAmount as Record<string, number>).$lte = filters.maxBid;
    }

    // Участники
    if (filters.minParticipants !== undefined) {
      query.totalParticipants = { $gte: filters.minParticipants };
    }

    // Количество ставок
    if (filters.minBids !== undefined) {
      query.totalBids = { $gte: filters.minBids };
    }

    // Время окончания
    if (filters.endingWithin !== undefined) {
      const endTime = new Date();
      endTime.setMinutes(endTime.getMinutes() + filters.endingWithin);
      // Нужно проверять через Round
    }

    // Время начала
    if (filters.startsAfter || filters.startsBefore) {
      query.scheduledStartAt = {};
      if (filters.startsAfter) (query.scheduledStartAt as Record<string, Date>).$gte = filters.startsAfter;
      if (filters.startsBefore) (query.scheduledStartAt as Record<string, Date>).$lte = filters.startsBefore;
    }

    // Текстовый поиск
    if (filters.search) {
      query.title = { $regex: filters.search, $options: 'i' };
    }

    return query;
  }

  /**
   * Построить сортировку
   */
  private buildSort(sort: string): Record<string, 1 | -1> {
    switch (sort) {
      case 'newest':
        return { createdAt: -1 };
      case 'ending_soon':
        return { 'currentRoundEndsAt': 1 };
      case 'popular':
        return { totalParticipants: -1 };
      case 'price_low':
        return { highestBid: 1 };
      case 'price_high':
        return { highestBid: -1 };
      case 'most_bids':
        return { totalBids: -1 };
      default:
        return { createdAt: -1 };
    }
  }

  /**
   * Преобразовать аукцион в элемент списка
   */
  private mapAuctionToListItem(auction: Record<string, unknown>, now: Date): AuctionListItem {
    const gifts = auction.gifts as Array<{ name: string; emoji: string; rarity: string }> | undefined;
    const category = auction.categoryId as { name: string; slug: string; icon: string } | undefined;
    
    const createdAt = auction.createdAt as Date;
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    return {
      id: String(auction._id),
      title: auction.title as string,
      status: auction.status as string,
      category: category ? {
        name: category.name,
        slug: category.slug,
        icon: category.icon,
      } : undefined,
      tags: (auction.tags as Array<{ name: string; slug: string; color: string }>) || [],
      gift: gifts?.[0] ? {
        name: gifts[0].name,
        emoji: gifts[0].emoji,
        rarity: gifts[0].rarity,
      } : undefined,
      currentRound: auction.currentRound as number || 1,
      totalRounds: auction.totalRounds as number || 1,
      currentBid: auction.highestBid as number || 0,
      minBidAmount: auction.minBidAmount as number || 10,
      participantsCount: auction.totalParticipants as number || 0,
      bidsCount: auction.totalBids as number || 0,
      startsAt: auction.scheduledStartAt as Date,
      endsAt: auction.currentRoundEndsAt as Date,
      isHot: (auction.totalBids as number || 0) > 10,
      isNew: createdAt > hourAgo,
      isEndingSoon: false, // Вычисляется отдельно
    };
  }
}

export const auctionSearchService = new AuctionSearchService();
export default auctionSearchService;
