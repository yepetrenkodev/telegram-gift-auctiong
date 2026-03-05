import { Watchlist, IWatchlistDocument } from '../models/Watchlist';
import { Auction } from '../models';
import { socketService } from './SocketService';
import { telegramBotService } from '../bot/TelegramBot';
import logger from '../utils/logger';

interface WatchlistItem {
  auctionId: string;
  auction: {
    id: string;
    title: string;
    status: string;
    currentRound?: number;
    endsAt?: Date;
    highestBid?: number;
    participantsCount?: number;
    gift?: {
      name: string;
      emoji: string;
    };
  };
  addedAt: Date;
  notifyOnStart: boolean;
  notifyOnEndingSoon: boolean;
  notifyOnOutbid: boolean;
  notes?: string;
}

/**
 * 📋 Watchlist Service
 * 
 * Управляет избранными аукционами пользователей
 */
class WatchlistService {
  /**
   * Добавить аукцион в избранное
   */
  async addToWatchlist(
    userId: string,
    auctionId: string,
    options: {
      notifyOnStart?: boolean;
      notifyOnEndingSoon?: boolean;
      notifyOnOutbid?: boolean;
      notes?: string;
    } = {}
  ): Promise<{ success: boolean; error?: string; item?: IWatchlistDocument }> {
    try {
      // Проверяем существование аукциона
      const auction = await Auction.findById(auctionId);
      if (!auction) {
        return { success: false, error: 'Auction not found' };
      }

      // Создаём или обновляем
      const item = await Watchlist.findOneAndUpdate(
        { userId, auctionId },
        {
          userId,
          auctionId,
          notifyOnStart: options.notifyOnStart ?? true,
          notifyOnEndingSoon: options.notifyOnEndingSoon ?? true,
          notifyOnOutbid: options.notifyOnOutbid ?? true,
          notes: options.notes,
        },
        { upsert: true, new: true }
      );

      logger.info(`User ${userId} added auction ${auctionId} to watchlist`);
      
      return { success: true, item };
    } catch (error) {
      logger.error('Failed to add to watchlist:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Удалить из избранного
   */
  async removeFromWatchlist(
    userId: string,
    auctionId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await Watchlist.deleteOne({ userId, auctionId });
      
      if (result.deletedCount === 0) {
        return { success: false, error: 'Item not found in watchlist' };
      }

      logger.info(`User ${userId} removed auction ${auctionId} from watchlist`);
      return { success: true };
    } catch (error) {
      logger.error('Failed to remove from watchlist:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Получить избранные аукционы пользователя
   */
  async getUserWatchlist(
    userId: string,
    options: {
      status?: 'all' | 'active' | 'ended';
      limit?: number;
      skip?: number;
    } = {}
  ): Promise<WatchlistItem[]> {
    const query = Watchlist.find({ userId })
      .populate({
        path: 'auctionId',
        populate: {
          path: 'gifts',
          select: 'name emoji',
        },
      })
      .sort({ addedAt: -1 });

    if (options.limit) query.limit(options.limit);
    if (options.skip) query.skip(options.skip);

    const items = await query.lean();

    // Преобразуем в удобный формат
    return items
      .filter(item => item.auctionId) // Убираем удалённые аукционы
      .map(item => {
        const auction = item.auctionId as unknown as Record<string, unknown>;
        return {
          auctionId: String(auction._id),
          auction: {
            id: String(auction._id),
            title: auction.title as string,
            status: auction.status as string,
            currentRound: auction.currentRound as number,
            endsAt: auction.endsAt as Date,
            highestBid: auction.highestBid as number,
            participantsCount: auction.totalParticipants as number,
            gift: (auction.gifts as Array<{ name: string; emoji: string }>)?.[0],
          },
          addedAt: item.addedAt,
          notifyOnStart: item.notifyOnStart,
          notifyOnEndingSoon: item.notifyOnEndingSoon,
          notifyOnOutbid: item.notifyOnOutbid,
          notes: item.notes,
        };
      });
  }

  /**
   * Проверить, в избранном ли аукцион
   */
  async isWatching(userId: string, auctionId: string): Promise<boolean> {
    return Watchlist.isWatching(userId, auctionId);
  }

  /**
   * Получить количество наблюдателей аукциона
   */
  async getWatchersCount(auctionId: string): Promise<number> {
    return Watchlist.getWatchersCount(auctionId);
  }

  /**
   * Обновить настройки уведомлений
   */
  async updateNotificationSettings(
    userId: string,
    auctionId: string,
    settings: {
      notifyOnStart?: boolean;
      notifyOnEndingSoon?: boolean;
      notifyOnOutbid?: boolean;
      notes?: string;
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await Watchlist.updateOne(
        { userId, auctionId },
        { $set: settings }
      );

      if (result.matchedCount === 0) {
        return { success: false, error: 'Item not found in watchlist' };
      }

      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Уведомить наблюдателей о событии аукциона
   */
  async notifyWatchers(
    auctionId: string,
    event: 'start' | 'ending_soon' | 'outbid' | 'ended',
    data?: Record<string, unknown>
  ): Promise<void> {
    try {
      // Определяем какое поле проверять
      const notifyField = {
        start: 'notifyOnStart',
        ending_soon: 'notifyOnEndingSoon',
        outbid: 'notifyOnOutbid',
        ended: 'notifyOnStart', // Используем start для ended
      }[event];

      const watchers = await Watchlist.find({
        auctionId,
        [notifyField]: true,
      }).populate('userId', 'telegramId firstName');

      const auction = await Auction.findById(auctionId);
      if (!auction) return;

      for (const watcher of watchers) {
        const user = watcher.userId as unknown as { telegramId: number; firstName: string };
        if (!user?.telegramId) continue;

        // Отправляем через WebSocket
        socketService.sendToUser(String(watcher.userId), 'watchlist:notification', {
          event,
          auctionId,
          auctionTitle: auction.title,
          ...data,
        });

        // Отправляем через Telegram
        const messages = {
          start: `🎬 Аукцион "${auction.title}" начался!`,
          ending_soon: `⏰ Аукцион "${auction.title}" заканчивается через 5 минут!`,
          outbid: `😱 Вашу ставку перебили в аукционе "${auction.title}"!`,
          ended: `🏁 Аукцион "${auction.title}" завершён!`,
        };

        await telegramBotService.sendMessage(user.telegramId, messages[event]);
      }

      logger.debug(`Notified ${watchers.length} watchers about ${event} for auction ${auctionId}`);
    } catch (error) {
      logger.error('Failed to notify watchers:', error);
    }
  }

  /**
   * Очистить устаревшие записи (для завершённых аукционов)
   */
  async cleanup(daysToKeep = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    // Находим завершённые аукционы старше cutoffDate
    const oldAuctions = await Auction.find({
      status: { $in: ['completed', 'cancelled'] },
      updatedAt: { $lt: cutoffDate },
    }).select('_id');

    const auctionIds = oldAuctions.map(a => a._id);

    const result = await Watchlist.deleteMany({
      auctionId: { $in: auctionIds },
    });

    logger.info(`Cleaned up ${result.deletedCount} old watchlist items`);
    return result.deletedCount;
  }
}

export const watchlistService = new WatchlistService();
export default watchlistService;
