import { Activity, IActivityDocument, ActivityType } from '../models/Activity';
import { socketService } from './SocketService';
import { redisService } from './RedisService';
import logger from '../utils/logger';

interface ActivityFeedItem {
  id: string;
  type: ActivityType;
  auctionId: string;
  userId?: string;
  data: {
    userName?: string;
    userAvatar?: string;
    auctionTitle?: string;
    amount?: number;
    position?: number;
    giftName?: string;
    giftEmoji?: string;
    roundNumber?: number;
    message?: string;
  };
  timestamp: Date;
}

/**
 * 📊 Activity Feed Service
 * 
 * Лента активности в реальном времени
 * - Все ставки
 * - Победы
 * - Старты аукционов
 * - Milestone события
 */
class ActivityFeedService {
  private readonly CACHE_KEY = 'activity:feed:global';
  private readonly CACHE_SIZE = 100; // Храним последние 100 событий в Redis
  private readonly CACHE_TTL = 3600; // 1 час

  /**
   * Добавить событие в ленту
   */
  async addActivity(
    type: ActivityType,
    auctionId: string,
    data: IActivityDocument['data'],
    userId?: string,
    isPublic = true
  ): Promise<void> {
    try {
      // Сохраняем в MongoDB
      const activity = await Activity.create({
        type,
        auctionId,
        userId,
        data,
        timestamp: new Date(),
        isPublic,
      });

      // Если публичное событие - транслируем
      if (isPublic) {
        const feedItem: ActivityFeedItem = {
          id: activity._id.toString(),
          type,
          auctionId,
          userId,
          data,
          timestamp: activity.timestamp,
        };

        // Добавляем в Redis кэш
        await this.addToCache(feedItem);

        // Транслируем через WebSocket
        socketService.broadcastToAll('activity:new', feedItem);
      }
    } catch (error) {
      logger.error('Failed to add activity:', error);
    }
  }

  /**
   * Быстрые методы для разных типов событий
   */
  async bidPlaced(
    auctionId: string,
    userId: string,
    data: {
      userName: string;
      auctionTitle: string;
      amount: number;
      position: number;
      giftEmoji?: string;
    }
  ): Promise<void> {
    await this.addActivity(
      ActivityType.BID_PLACED,
      auctionId,
      data,
      userId
    );
  }

  async auctionWon(
    auctionId: string,
    userId: string,
    data: {
      userName: string;
      auctionTitle: string;
      amount: number;
      giftName: string;
      giftEmoji: string;
    }
  ): Promise<void> {
    await this.addActivity(
      ActivityType.AUCTION_WON,
      auctionId,
      data,
      userId
    );
  }

  async auctionStarted(
    auctionId: string,
    data: {
      auctionTitle: string;
      giftName: string;
      giftEmoji: string;
    }
  ): Promise<void> {
    await this.addActivity(
      ActivityType.AUCTION_STARTED,
      auctionId,
      data
    );
  }

  async auctionEnding(
    auctionId: string,
    data: {
      auctionTitle: string;
      minutesLeft: number;
    }
  ): Promise<void> {
    await this.addActivity(
      ActivityType.AUCTION_ENDING,
      auctionId,
      { ...data, message: `Ending in ${data.minutesLeft} minutes!` }
    );
  }

  async priceMilestone(
    auctionId: string,
    data: {
      auctionTitle: string;
      amount: number;
      milestone: number;
    }
  ): Promise<void> {
    await this.addActivity(
      ActivityType.PRICE_MILESTONE,
      auctionId,
      { ...data, message: `Price reached ${data.milestone}⭐!` }
    );
  }

  /**
   * Получить глобальную ленту
   */
  async getGlobalFeed(limit = 50, before?: Date): Promise<ActivityFeedItem[]> {
    // Сначала пробуем из кэша
    if (!before) {
      const cached = await this.getFromCache(limit);
      if (cached.length > 0) {
        return cached;
      }
    }

    // Из MongoDB
    const query: Record<string, unknown> = { isPublic: true };
    if (before) {
      query.timestamp = { $lt: before };
    }

    const activities = await Activity.find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    return activities.map(a => ({
      id: a._id.toString(),
      type: a.type,
      auctionId: a.auctionId.toString(),
      userId: a.userId?.toString(),
      data: a.data,
      timestamp: a.timestamp,
    }));
  }

  /**
   * Получить ленту для конкретного аукциона
   */
  async getAuctionFeed(
    auctionId: string,
    limit = 50,
    before?: Date
  ): Promise<ActivityFeedItem[]> {
    const query: Record<string, unknown> = { auctionId };
    if (before) {
      query.timestamp = { $lt: before };
    }

    const activities = await Activity.find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    return activities.map(a => ({
      id: a._id.toString(),
      type: a.type,
      auctionId: a.auctionId.toString(),
      userId: a.userId?.toString(),
      data: a.data,
      timestamp: a.timestamp,
    }));
  }

  /**
   * Получить ленту пользователя
   */
  async getUserFeed(
    userId: string,
    limit = 50,
    before?: Date
  ): Promise<ActivityFeedItem[]> {
    const query: Record<string, unknown> = { userId };
    if (before) {
      query.timestamp = { $lt: before };
    }

    const activities = await Activity.find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    return activities.map(a => ({
      id: a._id.toString(),
      type: a.type,
      auctionId: a.auctionId.toString(),
      userId: a.userId?.toString(),
      data: a.data,
      timestamp: a.timestamp,
    }));
  }

  /**
   * Добавить в Redis кэш
   */
  private async addToCache(item: ActivityFeedItem): Promise<void> {
    try {
      // Получаем текущий кэш
      const cached = await redisService.get<ActivityFeedItem[]>(this.CACHE_KEY) || [];
      
      // Добавляем новый элемент в начало
      cached.unshift(item);
      
      // Обрезаем до максимального размера
      const trimmed = cached.slice(0, this.CACHE_SIZE);
      
      // Сохраняем
      await redisService.set(this.CACHE_KEY, trimmed, this.CACHE_TTL);
    } catch (error) {
      logger.error('Failed to add activity to cache:', error);
    }
  }

  /**
   * Получить из Redis кэша
   */
  private async getFromCache(limit: number): Promise<ActivityFeedItem[]> {
    try {
      const cached = await redisService.get<ActivityFeedItem[]>(this.CACHE_KEY);
      if (!cached) return [];
      
      return cached.slice(0, limit);
    } catch (error) {
      logger.error('Failed to get activity from cache:', error);
      return [];
    }
  }

  /**
   * Статистика активности
   */
  async getStats(hours = 24): Promise<{
    totalBids: number;
    totalWins: number;
    activeAuctions: number;
    topAuction?: { id: string; title: string; bids: number };
  }> {
    const since = new Date();
    since.setHours(since.getHours() - hours);

    const [bids, wins, auctionStats] = await Promise.all([
      Activity.countDocuments({
        type: ActivityType.BID_PLACED,
        timestamp: { $gte: since },
      }),
      Activity.countDocuments({
        type: ActivityType.AUCTION_WON,
        timestamp: { $gte: since },
      }),
      Activity.aggregate([
        {
          $match: {
            type: ActivityType.BID_PLACED,
            timestamp: { $gte: since },
          },
        },
        {
          $group: {
            _id: '$auctionId',
            count: { $sum: 1 },
            title: { $first: '$data.auctionTitle' },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 1 },
      ]),
    ]);

    return {
      totalBids: bids,
      totalWins: wins,
      activeAuctions: auctionStats.length,
      topAuction: auctionStats[0]
        ? {
            id: auctionStats[0]._id.toString(),
            title: auctionStats[0].title,
            bids: auctionStats[0].count,
          }
        : undefined,
    };
  }
}

export const activityFeedService = new ActivityFeedService();
export { ActivityType };
export default activityFeedService;
