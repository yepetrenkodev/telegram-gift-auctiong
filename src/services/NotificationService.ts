import mongoose, { Schema, Document } from 'mongoose';
import { redisService } from './RedisService';
import { socketService } from './SocketService';
import { telegramBotService } from '../bot/TelegramBot';
import { User } from '../models';
import logger from '../utils/logger';

/**
 * 🔔 Notification Service
 * 
 * Управление уведомлениями пользователей:
 * - Push уведомления (WebSocket)
 * - Telegram уведомления
 * - История уведомлений
 * - Настройки уведомлений
 */

// ==================== TYPES ====================

export enum NotificationType {
  // Ставки
  BID_PLACED = 'bid_placed',
  BID_OUTBID = 'bid_outbid',
  BID_WON = 'bid_won',
  BID_LOST = 'bid_lost',
  
  // Аукционы
  AUCTION_STARTING = 'auction_starting',
  AUCTION_STARTED = 'auction_started',
  AUCTION_ENDING = 'auction_ending',
  AUCTION_ENDED = 'auction_ended',
  AUCTION_CANCELLED = 'auction_cancelled',
  
  // Watchlist
  WATCHLIST_AUCTION_STARTED = 'watchlist_auction_started',
  WATCHLIST_AUCTION_ENDING = 'watchlist_auction_ending',
  WATCHLIST_PRICE_DROP = 'watchlist_price_drop',
  
  // Авто-ставки
  AUTOBID_TRIGGERED = 'autobid_triggered',
  AUTOBID_MAX_REACHED = 'autobid_max_reached',
  AUTOBID_STOPPED = 'autobid_stopped',
  
  // Баланс
  BALANCE_LOW = 'balance_low',
  BALANCE_DEPOSIT = 'balance_deposit',
  
  // Система
  SYSTEM_ANNOUNCEMENT = 'system_announcement',
  ACHIEVEMENT_UNLOCKED = 'achievement_unlocked',
  DAILY_SUMMARY = 'daily_summary',
}

export enum NotificationPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}

export enum NotificationChannel {
  PUSH = 'push',       // WebSocket
  TELEGRAM = 'telegram',
  EMAIL = 'email',     // Для будущего
}

export interface NotificationPayload {
  type: NotificationType;
  title: string;
  message: string;
  icon?: string;
  imageUrl?: string;
  
  // Связанные данные
  auctionId?: string;
  auctionTitle?: string;
  giftName?: string;
  bidAmount?: number;
  
  // Действие
  actionUrl?: string;
  actionLabel?: string;
  
  // Мета
  priority?: NotificationPriority;
  expiresAt?: Date;
  data?: Record<string, unknown>;
}

export interface UserNotificationSettings {
  // Каналы
  pushEnabled: boolean;
  telegramEnabled: boolean;
  emailEnabled: boolean;
  
  // Типы уведомлений
  bidOutbid: boolean;
  bidWon: boolean;
  auctionStarting: boolean;
  auctionEnding: boolean;
  watchlistUpdates: boolean;
  autobidAlerts: boolean;
  balanceAlerts: boolean;
  systemAnnouncements: boolean;
  dailySummary: boolean;
  
  // Настройки
  quietHoursEnabled: boolean;
  quietHoursStart: number;  // 0-23
  quietHoursEnd: number;    // 0-23
  
  // Частота
  minIntervalSeconds: number; // Минимум между уведомлениями одного типа
}

// ==================== NOTIFICATION MODEL ====================

export interface INotificationDocument extends Document {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  icon?: string;
  imageUrl?: string;
  
  auctionId?: string;
  bidId?: string;
  
  priority: NotificationPriority;
  channels: NotificationChannel[];
  
  isRead: boolean;
  readAt?: Date;
  
  actionUrl?: string;
  actionLabel?: string;
  
  data?: Record<string, unknown>;
  
  sentVia: NotificationChannel[];
  sentAt: Date;
  expiresAt?: Date;
  
  createdAt: Date;
}

const NotificationSchema = new Schema<INotificationDocument>(
  {
    userId: { type: String, required: true, index: true },
    type: { type: String, enum: Object.values(NotificationType), required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    icon: String,
    imageUrl: String,
    
    auctionId: { type: String, index: true },
    bidId: String,
    
    priority: { 
      type: String, 
      enum: Object.values(NotificationPriority), 
      default: NotificationPriority.NORMAL 
    },
    channels: [{ type: String, enum: Object.values(NotificationChannel) }],
    
    isRead: { type: Boolean, default: false, index: true },
    readAt: Date,
    
    actionUrl: String,
    actionLabel: String,
    
    data: Schema.Types.Mixed,
    
    sentVia: [{ type: String, enum: Object.values(NotificationChannel) }],
    sentAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, index: true },
  },
  {
    timestamps: true,
  }
);

// TTL индекс - удаляем старые уведомления через 30 дней
NotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

// Составной индекс для запросов
NotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, type: 1, createdAt: -1 });

export const Notification = mongoose.model<INotificationDocument>('Notification', NotificationSchema);

// ==================== SETTINGS MODEL ====================

export interface INotificationSettingsDocument extends Document {
  userId: string;
  settings: UserNotificationSettings;
}

const NotificationSettingsSchema = new Schema<INotificationSettingsDocument>(
  {
    userId: { type: String, required: true, unique: true },
    settings: {
      pushEnabled: { type: Boolean, default: true },
      telegramEnabled: { type: Boolean, default: true },
      emailEnabled: { type: Boolean, default: false },
      
      bidOutbid: { type: Boolean, default: true },
      bidWon: { type: Boolean, default: true },
      auctionStarting: { type: Boolean, default: true },
      auctionEnding: { type: Boolean, default: true },
      watchlistUpdates: { type: Boolean, default: true },
      autobidAlerts: { type: Boolean, default: true },
      balanceAlerts: { type: Boolean, default: true },
      systemAnnouncements: { type: Boolean, default: true },
      dailySummary: { type: Boolean, default: false },
      
      quietHoursEnabled: { type: Boolean, default: false },
      quietHoursStart: { type: Number, default: 23 },
      quietHoursEnd: { type: Number, default: 7 },
      
      minIntervalSeconds: { type: Number, default: 30 },
    },
  },
  {
    timestamps: true,
  }
);

export const NotificationSettings = mongoose.model<INotificationSettingsDocument>(
  'NotificationSettings',
  NotificationSettingsSchema
);

// ==================== SERVICE ====================

class NotificationService {
  private readonly RATE_LIMIT_PREFIX = 'notif:rate:';
  private readonly UNREAD_COUNT_PREFIX = 'notif:unread:';
  
  // Дефолтные настройки
  private readonly DEFAULT_SETTINGS: UserNotificationSettings = {
    pushEnabled: true,
    telegramEnabled: true,
    emailEnabled: false,
    bidOutbid: true,
    bidWon: true,
    auctionStarting: true,
    auctionEnding: true,
    watchlistUpdates: true,
    autobidAlerts: true,
    balanceAlerts: true,
    systemAnnouncements: true,
    dailySummary: false,
    quietHoursEnabled: false,
    quietHoursStart: 23,
    quietHoursEnd: 7,
    minIntervalSeconds: 30,
  };

  /**
   * Отправить уведомление пользователю
   */
  async send(userId: string, payload: NotificationPayload): Promise<void> {
    try {
      const settings = await this.getSettings(userId);
      
      // Проверяем настройки
      if (!this.shouldSend(payload.type, settings)) {
        logger.debug(`Notification ${payload.type} disabled for user ${userId}`);
        return;
      }

      // Проверяем quiet hours
      if (this.isQuietHours(settings)) {
        logger.debug(`Quiet hours for user ${userId}, skipping notification`);
        return;
      }

      // Проверяем rate limit
      const rateLimitKey = `${this.RATE_LIMIT_PREFIX}${userId}:${payload.type}`;
      const isRateLimited = await redisService.get(rateLimitKey);
      if (isRateLimited && payload.priority !== NotificationPriority.URGENT) {
        logger.debug(`Rate limited notification ${payload.type} for user ${userId}`);
        return;
      }

      // Определяем каналы
      const channels: NotificationChannel[] = [];
      if (settings.pushEnabled) channels.push(NotificationChannel.PUSH);
      if (settings.telegramEnabled) channels.push(NotificationChannel.TELEGRAM);

      // Сохраняем уведомление
      const notification = await Notification.create({
        userId,
        ...payload,
        priority: payload.priority || NotificationPriority.NORMAL,
        channels,
        sentVia: [],
        isRead: false,
      });

      // Отправляем по каналам
      const sentVia: NotificationChannel[] = [];

      // WebSocket (Push)
      if (channels.includes(NotificationChannel.PUSH)) {
        this.sendPush(userId, notification);
        sentVia.push(NotificationChannel.PUSH);
      }

      // Telegram
      if (channels.includes(NotificationChannel.TELEGRAM)) {
        await this.sendTelegram(userId, notification);
        sentVia.push(NotificationChannel.TELEGRAM);
      }

      // Обновляем запись
      notification.sentVia = sentVia;
      await notification.save();

      // Устанавливаем rate limit
      await redisService.set(rateLimitKey, '1', settings.minIntervalSeconds);

      // Обновляем счётчик непрочитанных
      await this.incrementUnreadCount(userId);

      logger.debug(`Notification sent: ${payload.type} to user ${userId} via ${sentVia.join(', ')}`);
    } catch (error) {
      logger.error('Failed to send notification:', error);
    }
  }

  /**
   * Отправить Push уведомление (WebSocket)
   */
  private sendPush(userId: string, notification: INotificationDocument): void {
    socketService.sendToUser(userId, 'notification', {
      id: notification._id.toString(),
      type: notification.type,
      title: notification.title,
      message: notification.message,
      icon: notification.icon,
      imageUrl: notification.imageUrl,
      actionUrl: notification.actionUrl,
      actionLabel: notification.actionLabel,
      priority: notification.priority,
      data: notification.data,
      createdAt: notification.createdAt,
    });
  }

  /**
   * Отправить Telegram уведомление
   */
  private async sendTelegram(userId: string, notification: INotificationDocument): Promise<void> {
    try {
      const user = await User.findById(userId).lean();
      if (!user?.telegramId) return;

      const emoji = this.getNotificationEmoji(notification.type);
      let message = `${emoji} *${notification.title}*\n\n${notification.message}`;

      if (notification.auctionId) {
        message += `\n\n[Открыть аукцион](https://t.me/yourbot/app?startapp=auction_${notification.auctionId})`;
      }

      await telegramBotService.sendMessage(user.telegramId, message);
    } catch (error) {
      logger.error(`Failed to send Telegram notification to ${userId}:`, error);
    }
  }

  /**
   * Получить emoji для типа уведомления
   */
  private getNotificationEmoji(type: NotificationType): string {
    const emojis: Record<NotificationType, string> = {
      [NotificationType.BID_PLACED]: '💰',
      [NotificationType.BID_OUTBID]: '😱',
      [NotificationType.BID_WON]: '🎉',
      [NotificationType.BID_LOST]: '😢',
      [NotificationType.AUCTION_STARTING]: '🚀',
      [NotificationType.AUCTION_STARTED]: '🔔',
      [NotificationType.AUCTION_ENDING]: '⏰',
      [NotificationType.AUCTION_ENDED]: '🏁',
      [NotificationType.AUCTION_CANCELLED]: '❌',
      [NotificationType.WATCHLIST_AUCTION_STARTED]: '👀',
      [NotificationType.WATCHLIST_AUCTION_ENDING]: '⏰',
      [NotificationType.WATCHLIST_PRICE_DROP]: '📉',
      [NotificationType.AUTOBID_TRIGGERED]: '🤖',
      [NotificationType.AUTOBID_MAX_REACHED]: '⚠️',
      [NotificationType.AUTOBID_STOPPED]: '🛑',
      [NotificationType.BALANCE_LOW]: '💸',
      [NotificationType.BALANCE_DEPOSIT]: '💵',
      [NotificationType.SYSTEM_ANNOUNCEMENT]: '📢',
      [NotificationType.ACHIEVEMENT_UNLOCKED]: '🏆',
      [NotificationType.DAILY_SUMMARY]: '📊',
    };
    return emojis[type] || '🔔';
  }

  /**
   * Проверить нужно ли отправлять уведомление
   */
  private shouldSend(type: NotificationType, settings: UserNotificationSettings): boolean {
    switch (type) {
      case NotificationType.BID_OUTBID:
        return settings.bidOutbid;
      case NotificationType.BID_WON:
      case NotificationType.BID_LOST:
        return settings.bidWon;
      case NotificationType.AUCTION_STARTING:
      case NotificationType.AUCTION_STARTED:
        return settings.auctionStarting;
      case NotificationType.AUCTION_ENDING:
      case NotificationType.AUCTION_ENDED:
        return settings.auctionEnding;
      case NotificationType.WATCHLIST_AUCTION_STARTED:
      case NotificationType.WATCHLIST_AUCTION_ENDING:
      case NotificationType.WATCHLIST_PRICE_DROP:
        return settings.watchlistUpdates;
      case NotificationType.AUTOBID_TRIGGERED:
      case NotificationType.AUTOBID_MAX_REACHED:
      case NotificationType.AUTOBID_STOPPED:
        return settings.autobidAlerts;
      case NotificationType.BALANCE_LOW:
      case NotificationType.BALANCE_DEPOSIT:
        return settings.balanceAlerts;
      case NotificationType.SYSTEM_ANNOUNCEMENT:
        return settings.systemAnnouncements;
      case NotificationType.DAILY_SUMMARY:
        return settings.dailySummary;
      default:
        return true;
    }
  }

  /**
   * Проверить quiet hours
   */
  private isQuietHours(settings: UserNotificationSettings): boolean {
    if (!settings.quietHoursEnabled) return false;

    const now = new Date();
    const hour = now.getHours();
    
    const { quietHoursStart, quietHoursEnd } = settings;
    
    if (quietHoursStart <= quietHoursEnd) {
      // Простой случай: 23:00 - 07:00 где start > end
      return hour >= quietHoursStart || hour < quietHoursEnd;
    } else {
      // Переход через полночь
      return hour >= quietHoursStart && hour < quietHoursEnd;
    }
  }

  /**
   * Получить настройки пользователя
   */
  async getSettings(userId: string): Promise<UserNotificationSettings> {
    const doc = await NotificationSettings.findOne({ userId }).lean();
    return doc?.settings || this.DEFAULT_SETTINGS;
  }

  /**
   * Обновить настройки
   */
  async updateSettings(userId: string, updates: Partial<UserNotificationSettings>): Promise<UserNotificationSettings> {
    const doc = await NotificationSettings.findOneAndUpdate(
      { userId },
      { $set: { settings: { ...this.DEFAULT_SETTINGS, ...updates } } },
      { upsert: true, new: true }
    );
    return doc.settings;
  }

  /**
   * Получить уведомления пользователя
   */
  async getNotifications(
    userId: string,
    options: { limit?: number; skip?: number; unreadOnly?: boolean; type?: NotificationType } = {}
  ): Promise<{ notifications: INotificationDocument[]; total: number; unread: number }> {
    const { limit = 20, skip = 0, unreadOnly = false, type } = options;

    const query: Record<string, unknown> = { userId };
    if (unreadOnly) query.isRead = false;
    if (type) query.type = type;

    const [notifications, total, unread] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Notification.countDocuments(query),
      Notification.countDocuments({ userId, isRead: false }),
    ]);

    return { notifications: notifications as INotificationDocument[], total, unread };
  }

  /**
   * Пометить как прочитанное
   */
  async markAsRead(userId: string, notificationIds: string[]): Promise<number> {
    const result = await Notification.updateMany(
      { _id: { $in: notificationIds }, userId, isRead: false },
      { $set: { isRead: true, readAt: new Date() } }
    );
    
    // Обновляем счётчик
    await this.recalculateUnreadCount(userId);
    
    return result.modifiedCount;
  }

  /**
   * Пометить все как прочитанные
   */
  async markAllAsRead(userId: string): Promise<number> {
    const result = await Notification.updateMany(
      { userId, isRead: false },
      { $set: { isRead: true, readAt: new Date() } }
    );
    
    await redisService.set(`${this.UNREAD_COUNT_PREFIX}${userId}`, '0');
    
    return result.modifiedCount;
  }

  /**
   * Получить количество непрочитанных
   */
  async getUnreadCount(userId: string): Promise<number> {
    const cached = await redisService.get(`${this.UNREAD_COUNT_PREFIX}${userId}`);
    if (cached !== null) {
      return parseInt(cached, 10);
    }

    const count = await Notification.countDocuments({ userId, isRead: false });
    await redisService.set(`${this.UNREAD_COUNT_PREFIX}${userId}`, count.toString(), 300);
    
    return count;
  }

  /**
   * Увеличить счётчик непрочитанных
   */
  private async incrementUnreadCount(userId: string): Promise<void> {
    await redisService.incr(`${this.UNREAD_COUNT_PREFIX}${userId}`);
  }

  /**
   * Пересчитать счётчик
   */
  private async recalculateUnreadCount(userId: string): Promise<void> {
    const count = await Notification.countDocuments({ userId, isRead: false });
    await redisService.set(`${this.UNREAD_COUNT_PREFIX}${userId}`, count.toString(), 300);
  }

  /**
   * Удалить уведомление
   */
  async delete(userId: string, notificationId: string): Promise<boolean> {
    const result = await Notification.deleteOne({ _id: notificationId, userId });
    if (result.deletedCount > 0) {
      await this.recalculateUnreadCount(userId);
      return true;
    }
    return false;
  }

  /**
   * Очистить старые уведомления
   */
  async cleanup(daysToKeep = 30): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysToKeep);

    const result = await Notification.deleteMany({
      createdAt: { $lt: cutoff },
      isRead: true,
    });

    logger.info(`Cleaned up ${result.deletedCount} old notifications`);
    return result.deletedCount;
  }

  // ==================== QUICK SEND METHODS ====================

  /**
   * Уведомление о перебитой ставке
   */
  async sendOutbidNotification(
    userId: string,
    auctionId: string,
    auctionTitle: string,
    newAmount: number,
    outbidBy: string
  ): Promise<void> {
    await this.send(userId, {
      type: NotificationType.BID_OUTBID,
      title: 'Вашу ставку перебили!',
      message: `${outbidBy} поставил ${newAmount}⭐ в аукционе "${auctionTitle}"`,
      icon: '😱',
      auctionId,
      auctionTitle,
      bidAmount: newAmount,
      priority: NotificationPriority.HIGH,
      actionUrl: `/auction/${auctionId}`,
      actionLabel: 'Повысить ставку',
    });
  }

  /**
   * Уведомление о победе
   */
  async sendWinNotification(
    userId: string,
    auctionId: string,
    auctionTitle: string,
    giftName: string,
    amount: number
  ): Promise<void> {
    await this.send(userId, {
      type: NotificationType.BID_WON,
      title: 'Поздравляем! Вы выиграли! 🎉',
      message: `Вы выиграли "${giftName}" за ${amount}⭐ в аукционе "${auctionTitle}"`,
      icon: '🎉',
      auctionId,
      auctionTitle,
      giftName,
      bidAmount: amount,
      priority: NotificationPriority.HIGH,
      actionUrl: `/my-gifts`,
      actionLabel: 'Мои подарки',
    });
  }

  /**
   * Уведомление о скором окончании аукциона
   */
  async sendAuctionEndingNotification(
    userId: string,
    auctionId: string,
    auctionTitle: string,
    minutesLeft: number
  ): Promise<void> {
    await this.send(userId, {
      type: NotificationType.AUCTION_ENDING,
      title: 'Аукцион скоро закончится!',
      message: `Аукцион "${auctionTitle}" закончится через ${minutesLeft} минут`,
      icon: '⏰',
      auctionId,
      auctionTitle,
      priority: NotificationPriority.HIGH,
      actionUrl: `/auction/${auctionId}`,
      actionLabel: 'Сделать ставку',
    });
  }

  /**
   * Уведомление о низком балансе
   */
  async sendLowBalanceNotification(userId: string, balance: number): Promise<void> {
    await this.send(userId, {
      type: NotificationType.BALANCE_LOW,
      title: 'Низкий баланс',
      message: `Ваш баланс: ${balance}⭐. Пополните для участия в аукционах.`,
      icon: '💸',
      priority: NotificationPriority.NORMAL,
      actionUrl: `/balance`,
      actionLabel: 'Пополнить',
    });
  }
}

export const notificationService = new NotificationService();
export default notificationService;
