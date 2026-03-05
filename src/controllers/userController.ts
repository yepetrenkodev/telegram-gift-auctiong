import { Response } from 'express';
import { AuthRequest, asyncHandler, generateToken } from '../middleware';
import { balanceService } from '../services';
import { User, Balance } from '../models';
import logger from '../utils/logger';

/**
 * 👤 User Controller
 */
export const userController = {
      /**
       * Получить все ачивки пользователя
       */
      getUserAchievements: asyncHandler(async (req: AuthRequest, res: Response) => {
        const userId = req.userId;
        if (!userId) {
          res.status(401).json({ success: false, error: 'Authentication required', timestamp: new Date() });
          return;
        }
        const { achievementService } = await import('../services/AchievementService');
        const achievements = await achievementService.getUserAchievements(userId);
        res.json({ success: true, data: achievements, timestamp: new Date() });
      }),

      /**
       * Получить все доступные ачивки
       */
      getAllAchievements: asyncHandler(async (_req: AuthRequest, res: Response) => {
        const { achievementService } = await import('../services/AchievementService');
        const achievements = await achievementService.getAllAchievements();
        res.json({ success: true, data: achievements, timestamp: new Date() });
      }),
    /**
     * Add bonus to user (admin/system)
     */
    addBonus: asyncHandler(async (req: AuthRequest, res: Response) => {
      const { userId, amount, reason } = req.body;
      if (!userId || !amount) {
        res.status(400).json({ success: false, error: 'userId and amount required', timestamp: new Date() });
        return;
      }
      const result = await balanceService.addBonus(userId, amount, reason);
      if (!result.success) {
        res.status(400).json({ success: false, error: result.error, timestamp: new Date() });
        return;
      }
      res.json({ success: true, data: result.balance, message: 'Bonus added', timestamp: new Date() });
    }),

    /**
     * Transfer funds between users (P2P)
     */
    transferFunds: asyncHandler(async (req: AuthRequest, res: Response) => {
      const { toUserId, amount, note } = req.body;
      const fromUserId = req.userId;
      if (!fromUserId || !toUserId || !amount) {
        res.status(400).json({ success: false, error: 'toUserId and amount required', timestamp: new Date() });
        return;
      }
      const result = await balanceService.transferFunds(fromUserId, toUserId, amount, note);
      if (!result.success) {
        res.status(400).json({ success: false, error: result.error, timestamp: new Date() });
        return;
      }
      res.json({ success: true, message: 'Transfer successful', timestamp: new Date() });
    }),
  /**
   * Register or login user via Telegram
   */
  authTelegram: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { telegramId, firstName, lastName, username, photoUrl } = req.body;

    if (!telegramId || !firstName) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: telegramId, firstName',
        timestamp: new Date(),
      });
      return;
    }

    let user = await User.findByTelegramId(telegramId);

    if (!user) {
      // Create new user
      user = await User.create({
        telegramId,
        firstName,
        lastName,
        username,
        photoUrl,
      });

      // Create balance for new user
      await Balance.create({
        userId: user._id,
        available: 0,
        locked: 0,
      });

      logger.info(`New user registered: ${user._id} (${telegramId})`);
    } else {
      // Update user info
      user.firstName = firstName;
      if (lastName) user.lastName = lastName;
      if (username) user.username = username;
      if (photoUrl) user.photoUrl = photoUrl;
      await user.save();
    }

    // Generate token
    const token = generateToken(user._id.toString(), telegramId);

    res.json({
      success: true,
      data: {
        user,
        token,
      },
      timestamp: new Date(),
    });
  }),

  /**
   * Get current user profile
   */
  getProfile: asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        timestamp: new Date(),
      });
      return;
    }

    const user = await User.findById(userId);

    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found',
        timestamp: new Date(),
      });
      return;
    }

    const balance = await balanceService.getBalance(userId);

    res.json({
      success: true,
      data: {
        user,
        balance: {
          available: balance.available,
          locked: balance.locked,
          total: balance.available + balance.locked,
        },
      },
      timestamp: new Date(),
    });
  }),

  /**
   * Get user balance
   */
  getBalance: asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        timestamp: new Date(),
      });
      return;
    }

    const balanceDetails = await balanceService.getBalanceDetails(userId);

    res.json({
      success: true,
      data: balanceDetails,
      timestamp: new Date(),
    });
  }),

  /**
   * Add funds to balance (for testing/demo purposes)
   */
  addFunds: asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.userId;
    const { amount } = req.body;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        timestamp: new Date(),
      });
      return;
    }

    if (!amount || amount <= 0) {
      res.status(400).json({
        success: false,
        error: 'Amount must be positive',
        timestamp: new Date(),
      });
      return;
    }

    const result = await balanceService.addFunds(userId, amount, 'Manual deposit');

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: result.error,
        timestamp: new Date(),
      });
      return;
    }

    logger.info(`Added ${amount} to user ${userId} balance`);

    res.json({
      success: true,
      data: {
        available: result.balance?.available,
        locked: result.balance?.locked,
        total: (result.balance?.available || 0) + (result.balance?.locked || 0),
      },
      message: `Successfully added ${amount} to your balance`,
      timestamp: new Date(),
    });
  }),

  /**
   * Get transaction history
   */
  getTransactions: asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.userId;
    const { limit = 50, offset = 0, type } = req.query;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        timestamp: new Date(),
      });
      return;
    }

    const result = await balanceService.getTransactionHistory(userId, {
      limit: Number(limit),
      offset: Number(offset),
      type: type as never,
    });

    res.json({
      success: true,
      data: result.transactions,
      pagination: {
        total: result.total,
        limit: result.limit,
        offset: result.offset,
      },
      timestamp: new Date(),
    });
  }),

  /**
   * Get leaderboard
   */
  getLeaderboard: asyncHandler(async (req: AuthRequest, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 100;

    const users = await User.getLeaderboard(limit);

    const leaderboard = users.map((user, index) => ({
      rank: index + 1,
      user: {
        id: user._id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        photoUrl: user.photoUrl,
        rank: user.rank,
      },
      stats: user.stats,
    }));

    res.json({
      success: true,
      data: leaderboard,
      timestamp: new Date(),
    });
  }),

  /**
   * Get user by ID (public profile)
   */
  getUserById: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { userId } = req.params;

    const user = await User.findById(userId).select(
      'username firstName lastName photoUrl rank stats createdAt'
    );

    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found',
        timestamp: new Date(),
      });
      return;
    }

    res.json({
      success: true,
      data: user,
      timestamp: new Date(),
    });
  }),
};

export default userController;
