import TelegramBot from 'node-telegram-bot-api';
import config from '../config';
import logger from '../utils/logger';
import { User, Balance } from '../models';
import { UserRank } from '../types';

/**
 * 🤖 Telegram Bot Service
 * 
 * Handles:
 * - /start command
 * - User registration
 * - Notifications
 * - WebApp integration
 */
class TelegramBotService {
  private bot: TelegramBot | null = null;
  private isRunning = false;

  /**
   * Initialize and start the bot
   */
  async start(): Promise<void> {
    if (!config.telegram.botToken || config.telegram.botToken === 'your-telegram-bot-token') {
      logger.warn('⚠️ Telegram bot token not configured, bot disabled');
      return;
    }

    try {
      this.bot = new TelegramBot(config.telegram.botToken, { polling: true });
      this.setupHandlers();
      this.isRunning = true;
      
      const botInfo = await this.bot.getMe();
      logger.info(`🤖 Telegram Bot started: @${botInfo.username}`);
    } catch (error) {
      logger.error('Failed to start Telegram bot:', error);
    }
  }

  /**
   * Stop the bot
   */
  async stop(): Promise<void> {
    if (this.bot && this.isRunning) {
      await this.bot.stopPolling();
      this.isRunning = false;
      logger.info('🤖 Telegram Bot stopped');
    }
  }

  /**
   * Setup message handlers
   */
  private setupHandlers(): void {
    if (!this.bot) return;

    // /start command
    this.bot.onText(/\/start/, async (msg) => {
      await this.handleStart(msg);
    });

    // /balance command
    this.bot.onText(/\/balance/, async (msg) => {
      await this.handleBalance(msg);
    });

    // /auctions command
    this.bot.onText(/\/auctions/, async (msg) => {
      await this.handleAuctions(msg);
    });

    // /help command
    this.bot.onText(/\/help/, async (msg) => {
      await this.handleHelp(msg);
    });

    // /profile command
    this.bot.onText(/\/profile/, async (msg) => {
      await this.handleProfile(msg);
    });

    // Callback queries (button clicks)
    this.bot.on('callback_query', async (query) => {
      await this.handleCallbackQuery(query);
    });

    // Error handling
    this.bot.on('polling_error', (error) => {
      logger.error('Telegram polling error:', error);
    });
  }

  /**
   * Handle /start command
   */
  private async handleStart(msg: TelegramBot.Message): Promise<void> {
    if (!this.bot) return;

    const chatId = msg.chat.id;
    const telegramUser = msg.from;

    if (!telegramUser) return;

    try {
      // Find or create user
      let user = await User.findByTelegramId(telegramUser.id.toString());

      if (!user) {
        // Create new user
        user = await User.create({
          telegramId: telegramUser.id.toString(),
          firstName: telegramUser.first_name,
          lastName: telegramUser.last_name,
          username: telegramUser.username,
          rank: UserRank.BRONZE,
        });

        // Create balance
        await Balance.create({
          userId: user._id,
          available: 100, // Welcome bonus
          locked: 0,
        });

        logger.info(`New user registered via bot: ${telegramUser.id} (@${telegramUser.username})`);

        // Welcome message for new user
        await this.bot.sendMessage(chatId, 
          `🎉 *Добро пожаловать в Gift Auction!*\n\n` +
          `Привет, ${telegramUser.first_name}! 👋\n\n` +
          `Ты получаешь *100 монет* в качестве приветственного бонуса! 🎁\n\n` +
          `Здесь ты можешь участвовать в аукционах за эксклюзивные Telegram подарки.\n\n` +
          `🏆 Делай ставки\n` +
          `💎 Побеждай\n` +
          `🎁 Получай редкие подарки\n\n` +
          `Используй кнопку ниже, чтобы открыть аукционы:`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '🏆 Открыть аукционы', web_app: { url: this.getWebAppUrl() } }],
                [{ text: '💰 Мой баланс', callback_data: 'balance' }],
                [{ text: '📊 Мой профиль', callback_data: 'profile' }],
              ],
            },
          }
        );
      } else {
        // Returning user
        const balance = await Balance.findByUserId(user._id.toString());

        await this.bot.sendMessage(chatId,
          `👋 *С возвращением, ${user.firstName}!*\n\n` +
          `💰 Баланс: *${balance?.available || 0}* монет\n` +
          `🔒 Заблокировано: *${balance?.locked || 0}* монет\n` +
          `🏅 Ранг: *${this.getRankEmoji(user.rank)} ${user.rank.toUpperCase()}*\n\n` +
          `Готов к новым победам? 🚀`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '🏆 Открыть аукционы', web_app: { url: this.getWebAppUrl() } }],
                [{ text: '💰 Баланс', callback_data: 'balance' }, { text: '📊 Профиль', callback_data: 'profile' }],
                [{ text: '🎯 Активные аукционы', callback_data: 'auctions' }],
              ],
            },
          }
        );
      }
    } catch (error) {
      logger.error('Error handling /start:', error);
      await this.bot.sendMessage(chatId, '❌ Произошла ошибка. Попробуйте позже.');
    }
  }

  /**
   * Handle /balance command
   */
  private async handleBalance(msg: TelegramBot.Message): Promise<void> {
    if (!this.bot) return;

    const chatId = msg.chat.id;
    const telegramUser = msg.from;

    if (!telegramUser) return;

    try {
      const user = await User.findByTelegramId(telegramUser.id.toString());

      if (!user) {
        await this.bot.sendMessage(chatId, '❌ Сначала зарегистрируйся командой /start');
        return;
      }

      const balance = await Balance.findByUserId(user._id.toString());

      await this.bot.sendMessage(chatId,
        `💰 *Твой баланс*\n\n` +
        `├ Доступно: *${balance?.available || 0}* монет\n` +
        `├ Заблокировано: *${balance?.locked || 0}* монет\n` +
        `└ Всего: *${(balance?.available || 0) + (balance?.locked || 0)}* монет\n\n` +
        `_Заблокированные монеты участвуют в активных ставках_`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '➕ Пополнить', callback_data: 'deposit' }],
              [{ text: '🏆 К аукционам', web_app: { url: this.getWebAppUrl() } }],
            ],
          },
        }
      );
    } catch (error) {
      logger.error('Error handling /balance:', error);
      await this.bot.sendMessage(chatId, '❌ Произошла ошибка. Попробуйте позже.');
    }
  }

  /**
   * Handle /profile command
   */
  private async handleProfile(msg: TelegramBot.Message): Promise<void> {
    if (!this.bot) return;

    const chatId = msg.chat.id;
    const telegramUser = msg.from;

    if (!telegramUser) return;

    try {
      const user = await User.findByTelegramId(telegramUser.id.toString());

      if (!user) {
        await this.bot.sendMessage(chatId, '❌ Сначала зарегистрируйся командой /start');
        return;
      }

      await this.bot.sendMessage(chatId,
        `📊 *Твой профиль*\n\n` +
        `👤 ${user.firstName} ${user.lastName || ''}\n` +
        `${user.username ? `@${user.username}\n` : ''}` +
        `\n` +
        `🏅 Ранг: ${this.getRankEmoji(user.rank)} *${user.rank.toUpperCase()}*\n\n` +
        `📈 *Статистика:*\n` +
        `├ Ставок: *${user.stats.totalBids}*\n` +
        `├ Побед: *${user.stats.totalWins}* 🏆\n` +
        `├ Потрачено: *${user.stats.totalSpent}* монет\n` +
        `├ Win Rate: *${user.stats.winRate.toFixed(1)}%*\n` +
        `└ Лучшая серия: *${user.stats.bestStreak}* побед\n`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🏆 К аукционам', web_app: { url: this.getWebAppUrl() } }],
            ],
          },
        }
      );
    } catch (error) {
      logger.error('Error handling /profile:', error);
      await this.bot.sendMessage(chatId, '❌ Произошла ошибка. Попробуйте позже.');
    }
  }

  /**
   * Handle /auctions command
   */
  private async handleAuctions(msg: TelegramBot.Message): Promise<void> {
    if (!this.bot) return;

    const chatId = msg.chat.id;

    try {
      const { Auction } = await import('../models');
      const activeAuctions = await Auction.findActive();

      if (activeAuctions.length === 0) {
        await this.bot.sendMessage(chatId,
          `🎯 *Активные аукционы*\n\n` +
          `Сейчас нет активных аукционов.\n` +
          `Скоро начнутся новые! 🚀`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '🔔 Уведомить о новых', callback_data: 'notify_new' }],
              ],
            },
          }
        );
        return;
      }

      let message = `🎯 *Активные аукционы*\n\n`;

      for (const auction of activeAuctions.slice(0, 5)) {
        const timeLeft = auction.endsAt ? Math.max(0, auction.endsAt.getTime() - Date.now()) : 0;
        const minutes = Math.floor(timeLeft / 60000);

        message += `🎁 *${auction.title}*\n`;
        message += `├ Раунд: ${auction.currentRound}/${auction.totalRounds}\n`;
        message += `├ Мин. ставка: ${auction.minBidAmount} монет\n`;
        message += `└ До конца: ${minutes} мин\n\n`;
      }

      await this.bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🏆 Участвовать', web_app: { url: this.getWebAppUrl() } }],
          ],
        },
      });
    } catch (error) {
      logger.error('Error handling /auctions:', error);
      await this.bot.sendMessage(chatId, '❌ Произошла ошибка. Попробуйте позже.');
    }
  }

  /**
   * Handle /help command
   */
  private async handleHelp(msg: TelegramBot.Message): Promise<void> {
    if (!this.bot) return;

    const chatId = msg.chat.id;

    await this.bot.sendMessage(chatId,
      `❓ *Помощь*\n\n` +
      `*Команды:*\n` +
      `/start - Начать / Главное меню\n` +
      `/balance - Проверить баланс\n` +
      `/profile - Мой профиль\n` +
      `/auctions - Активные аукционы\n` +
      `/help - Эта справка\n\n` +
      `*Как работают аукционы:*\n` +
      `1️⃣ Выбери аукцион с понравившимся подарком\n` +
      `2️⃣ Сделай ставку выше текущей\n` +
      `3️⃣ Следи за конкурентами в реальном времени\n` +
      `4️⃣ Топ-10 ставок в раунде получают подарок!\n\n` +
      `*Anti-Snipe:* Ставка в последние 30 сек продлевает раунд ⏰\n\n` +
      `Удачи! 🍀`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🏆 Открыть аукционы', web_app: { url: this.getWebAppUrl() } }],
          ],
        },
      }
    );
  }

  /**
   * Handle callback queries (button clicks)
   */
  private async handleCallbackQuery(query: TelegramBot.CallbackQuery): Promise<void> {
    if (!this.bot || !query.message || !query.data) return;

    const chatId = query.message.chat.id;

    try {
      switch (query.data) {
        case 'balance':
          await this.handleBalance({ ...query.message, from: query.from } as TelegramBot.Message);
          break;
        case 'profile':
          await this.handleProfile({ ...query.message, from: query.from } as TelegramBot.Message);
          break;
        case 'auctions':
          await this.handleAuctions({ ...query.message, from: query.from } as TelegramBot.Message);
          break;
        case 'deposit':
          await this.bot.sendMessage(chatId,
            `💳 *Пополнение баланса*\n\n` +
            `Для пополнения используй WebApp:`,
            {
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [
                  [{ text: '💰 Пополнить в приложении', web_app: { url: this.getWebAppUrl() + '/deposit' } }],
                ],
              },
            }
          );
          break;
        case 'notify_new':
          await this.bot.sendMessage(chatId, '✅ Ты получишь уведомление о новых аукционах!');
          break;
      }

      // Answer callback to remove loading state
      await this.bot.answerCallbackQuery(query.id);
    } catch (error) {
      logger.error('Error handling callback query:', error);
      await this.bot.answerCallbackQuery(query.id, { text: 'Ошибка' });
    }
  }

  /**
   * Get WebApp URL
   */
  private getWebAppUrl(): string {
    // В продакшене здесь будет реальный URL WebApp
    return process.env.WEBAPP_URL || 'https://your-webapp-url.com';
  }

  /**
   * Get emoji for rank
   */
  private getRankEmoji(rank: UserRank): string {
    const emojis: Record<UserRank, string> = {
      [UserRank.BRONZE]: '🥉',
      [UserRank.SILVER]: '🥈',
      [UserRank.GOLD]: '🥇',
      [UserRank.DIAMOND]: '💎',
      [UserRank.WHALE]: '🐋',
      [UserRank.LEGEND]: '👑',
    };
    return emojis[rank] || '🏅';
  }

  // ==================== NOTIFICATION METHODS ====================

  /**
   * Send outbid notification
   */
  async sendOutbidNotification(
    telegramId: string,
    auctionTitle: string,
    newBidAmount: number,
    bidderName: string
  ): Promise<void> {
    if (!this.bot || !this.isRunning) return;

    try {
      await this.bot.sendMessage(telegramId,
        `⚠️ *Тебя перебили!*\n\n` +
        `🎁 Аукцион: *${auctionTitle}*\n` +
        `💰 Новая ставка: *${newBidAmount}* монет\n` +
        `👤 От: ${bidderName}\n\n` +
        `Сделай ставку выше, чтобы вернуться в игру! 🚀`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔥 Сделать ставку', web_app: { url: this.getWebAppUrl() } }],
            ],
          },
        }
      );
    } catch (error) {
      logger.error(`Failed to send outbid notification to ${telegramId}:`, error);
    }
  }

  /**
   * Send win notification
   */
  async sendWinNotification(
    telegramId: string,
    auctionTitle: string,
    giftName: string,
    amount: number
  ): Promise<void> {
    if (!this.bot || !this.isRunning) return;

    try {
      await this.bot.sendMessage(telegramId,
        `🎉 *ПОБЕДА!*\n\n` +
        `Поздравляем! Ты выиграл в аукционе!\n\n` +
        `🎁 Подарок: *${giftName}*\n` +
        `🏆 Аукцион: *${auctionTitle}*\n` +
        `💰 Твоя ставка: *${amount}* монет\n\n` +
        `Подарок уже в твоей коллекции! 🌟`,
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      logger.error(`Failed to send win notification to ${telegramId}:`, error);
    }
  }

  /**
   * Send round ending notification
   */
  async sendRoundEndingNotification(
    telegramId: string,
    auctionTitle: string,
    secondsLeft: number
  ): Promise<void> {
    if (!this.bot || !this.isRunning) return;

    try {
      await this.bot.sendMessage(telegramId,
        `⏰ *Раунд заканчивается!*\n\n` +
        `🎁 *${auctionTitle}*\n` +
        `⏱ Осталось: *${secondsLeft}* секунд\n\n` +
        `Успей сделать ставку!`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '⚡ Сделать ставку', web_app: { url: this.getWebAppUrl() } }],
            ],
          },
        }
      );
    } catch (error) {
      logger.error(`Failed to send round ending notification to ${telegramId}:`, error);
    }
  }

  /**
   * Get bot instance
   */
  getBot(): TelegramBot | null {
    return this.bot;
  }

  /**
   * Send message to user by telegram ID
   * General purpose method for custom notifications
   */
  async sendMessage(
    telegramId: string | number,
    message: string,
    options?: TelegramBot.SendMessageOptions
  ): Promise<void> {
    if (!this.bot || !this.isRunning) {
      logger.warn('Cannot send message: bot not running');
      return;
    }

    try {
      await this.bot.sendMessage(telegramId, message, {
        parse_mode: 'Markdown',
        ...options,
      });
    } catch (error) {
      logger.error(`Failed to send message to ${telegramId}:`, error);
    }
  }
}

export const telegramBotService = new TelegramBotService();
export default telegramBotService;
