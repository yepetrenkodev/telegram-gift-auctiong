
import mongoose from 'mongoose';
import { Balance, IBalanceDocument, Transaction, ITransactionDocument } from '../models';
import { TransactionType } from '../types';
import logger from '../utils/logger';

/**
 * 💰 Balance Service
 * 
 * Manages user balances with a two-balance model:
 * - available: funds that can be spent
 * - locked: funds that are committed to active bids
 * 
 * This ensures:
 * - No overdraft
 * - No double spending
 * - Atomic operations
 * - Correct refunds
 */
export class BalanceService {
  /**
   * Add bonus to user (admin or system) - simplified version without transactions
   */
  async addBonus(userId: string, amount: number, reason?: string) {
    try {
      const BalanceModel = (await import('../models')).Balance;
      const TransactionModel = (await import('../models')).Transaction;
      
      let balance = await BalanceModel.findOne({ userId });
      if (!balance) {
        balance = await BalanceModel.create({ userId, available: 0, locked: 0 });
      }
      
      // Add funds directly
      balance.available += amount;
      await balance.save();
      
      const after = balance.available + balance.locked;
      
      // Create transaction record
      await TransactionModel.create({
        userId,
        type: 'bonus',
        amount,
        balanceAfter: after,
        meta: { reason },
      });
      
      return { success: true, balance };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Transfer funds between users (P2P)
   */
  async transferFunds(fromUserId: string, toUserId: string, amount: number, note?: string) {
    if (fromUserId === toUserId) return { success: false, error: 'Cannot transfer to self' };
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const BalanceModel = (await import('../models')).Balance;
      let from = await BalanceModel.findOne({ userId: fromUserId }).session(session);
      let to = await BalanceModel.findOne({ userId: toUserId }).session(session);
      if (!from || !to) {
        await session.abortTransaction();
        return { success: false, error: 'User balance not found' };
      }
      if (!from.canSpend(amount)) {
        await session.abortTransaction();
        return { success: false, error: 'Insufficient funds' };
      }
      // Списываем средства с from
      from.available -= amount;
      await from.save({ session });
      // Добавляем средства to
      await to.addFunds(amount, session);
      const TransactionModel = (await import('../models')).Transaction;
      await TransactionModel.create(
        [
          {
            userId: fromUserId,
            type: 'transfer',
            amount: -amount,
            balanceAfter: from.available + from.locked,
            meta: { toUserId, note },
          },
          {
            userId: toUserId,
            type: 'transfer',
            amount,
            balanceAfter: to.available + to.locked,
            meta: { fromUserId, note },
          },
        ],
        { session }
      );
      await session.commitTransaction();
      return { success: true };
    } catch (error) {
      await session.abortTransaction();
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    } finally {
      session.endSession();
    }
  }
    /**
     * Получить баланс пользователя или создать новый, если не существует
     */
    async getBalance(userId: string): Promise<IBalanceDocument> {
      let balance = await Balance.findOne({ userId });
      if (!balance) {
        const created = await Balance.create([{ userId, available: 0, locked: 0 }]);
        balance = created[0];
      }
      return balance;
    }
  /**
   * Get balance with full details
   */
  async getBalanceDetails(userId: string): Promise<{
    available: number;
    locked: number;
    total: number;
    recentTransactions: ITransactionDocument[];
  }> {
    const balance = await this.getBalance(userId);
    const recentTransactions = await Transaction.find({ userId })
      .sort({ createdAt: -1 })
      .limit(20);

    return {
      available: balance.available,
      locked: balance.locked,
      total: balance.available + balance.locked,
      recentTransactions,
    };
  }

  /**
   * Check if user can afford a bid
   */
  async canAfford(userId: string, amount: number): Promise<boolean> {
    const balance = await this.getBalance(userId);
    return balance.canSpend(amount);
  }

  /**
   * Lock funds for a bid (atomic operation)
   */
  async lockFunds(
    userId: string,
    amount: number,
    reference?: string
  ): Promise<{ success: boolean; balance?: IBalanceDocument; error?: string }> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const balance = await Balance.findOne({ userId }).session(session);

      if (!balance) {
        await session.abortTransaction();
        return { success: false, error: 'Balance not found' };
      }

      if (!balance.canSpend(amount)) {
        await session.abortTransaction();
        return {
          success: false,
          error: `Insufficient funds. Available: ${balance.available}, Required: ${amount}`,
        };
      }

      await balance.lock(amount, session);

      // Логируем транзакцию
      const after = balance.available + balance.locked;
      await (await import('../models')).Transaction.create([
        {
          userId,
          type: 'bid_lock',
          amount,
          balanceAfter: after,
          meta: { reference },
        },
      ], { session });

      await session.commitTransaction();
      logger.info(`Locked ${amount} for user ${userId}. Reference: ${reference}`);

      return { success: true, balance };
    } catch (error) {
      await session.abortTransaction();
      logger.error(`Failed to lock funds for user ${userId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    } finally {
      session.endSession();
    }
  }

  /**
   * Unlock funds (refund) when outbid or auction cancelled
   */
  async unlockFunds(
    userId: string,
    amount: number,
    reference?: string
  ): Promise<{ success: boolean; balance?: IBalanceDocument; error?: string }> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const balance = await Balance.findOne({ userId }).session(session);

      if (!balance) {
        await session.abortTransaction();
        return { success: false, error: 'Balance not found' };
      }

      if (balance.locked < amount) {
        await session.abortTransaction();
        return {
          success: false,
          error: `Insufficient locked funds. Locked: ${balance.locked}, Required: ${amount}`,
        };
      }

      await balance.unlock(amount, session);

      // Логируем транзакцию
      const after = balance.available + balance.locked;
      await (await import('../models')).Transaction.create([
        {
          userId,
          type: 'bid_unlock',
          amount,
          balanceAfter: after,
          meta: { reference },
        },
      ], { session });

      await session.commitTransaction();
      logger.info(`Unlocked ${amount} for user ${userId}. Reference: ${reference}`);

      return { success: true, balance };
    } catch (error) {
      await session.abortTransaction();
      logger.error(`Failed to unlock funds for user ${userId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    } finally {
      session.endSession();
    }
  }

  /**
   * Deduct locked funds when user wins (finalize payment)
   */
  async deductLockedFunds(
    userId: string,
    amount: number,
    reference?: string
  ): Promise<{ success: boolean; balance?: IBalanceDocument; error?: string }> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const balance = await Balance.findOne({ userId }).session(session);

      if (!balance) {
        await session.abortTransaction();
        return { success: false, error: 'Balance not found' };
      }

      if (balance.locked < amount) {
        await session.abortTransaction();
        return {
          success: false,
          error: `Insufficient locked funds for deduction. Locked: ${balance.locked}, Required: ${amount}`,
        };
      }

      await balance.deductLocked(amount, session);

      // Логируем транзакцию
      const after = balance.available + balance.locked;
      await (await import('../models')).Transaction.create([
        {
          userId,
          type: 'win_deduct',
          amount,
          balanceAfter: after,
          meta: { reference },
        },
      ], { session });

      await session.commitTransaction();
      logger.info(`Deducted ${amount} from user ${userId}. Reference: ${reference}`);

      return { success: true, balance };
    } catch (error) {
      await session.abortTransaction();
      logger.error(`Failed to deduct funds for user ${userId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    } finally {
      session.endSession();
    }
  }

  /**
   * Add funds to user's available balance
   */
  async addFunds(
    userId: string,
    amount: number,
    description?: string
  ): Promise<{ success: boolean; balance?: IBalanceDocument; error?: string }> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      let balance = await Balance.findOne({ userId }).session(session);

      if (!balance) {
        const created = await Balance.create([{ userId, available: 0, locked: 0 }], { session });
        balance = created[0];
      }

      await balance.addFunds(amount, session);

      // Логируем транзакцию
      const after = balance.available + balance.locked;
      await (await import('../models')).Transaction.create([
        {
          userId,
          type: 'deposit',
          amount,
          balanceAfter: after,
          meta: { description },
        },
      ], { session });

      await session.commitTransaction();
      logger.info(`Added ${amount} to user ${userId}. Description: ${description}`);

      return { success: true, balance };
    } catch (error) {
      await session.abortTransaction();
      logger.error(`Failed to add funds for user ${userId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    } finally {
      session.endSession();
    }
  }

  /**
   * Handle bid increase - lock additional amount
   */
  async increaseBidLock(
    userId: string,
    currentLockedAmount: number,
    newAmount: number,
    reference?: string
  ): Promise<{ success: boolean; balance?: IBalanceDocument; error?: string }> {
    const additionalAmount = newAmount - currentLockedAmount;

    if (additionalAmount <= 0) {
      return { success: true };
    }

    return this.lockFunds(userId, additionalAmount, reference);
  }

  /**
   * Refund and lock in one atomic operation (for bid updates)
   */
  async refundAndLock(
    userId: string,
    refundAmount: number,
    lockAmount: number,
    reference?: string
  ): Promise<{ success: boolean; balance?: IBalanceDocument; error?: string }> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const balance = await Balance.findOne({ userId }).session(session);

      if (!balance) {
        await session.abortTransaction();
        return { success: false, error: 'Balance not found' };
      }

      // Unlock the refund amount
      if (refundAmount > 0) {
        await balance.unlock(refundAmount, session);
      }

      // Lock the new amount
      if (lockAmount > 0) {
        const totalAvailable = balance.available;
        if (totalAvailable < lockAmount) {
          await session.abortTransaction();
          return {
            success: false,
            error: `Insufficient funds after refund. Available: ${totalAvailable}, Required: ${lockAmount}`,
          };
        }
        await balance.lock(lockAmount, session);
      }

      await session.commitTransaction();
      logger.info(
        `Refund and lock for user ${userId}: refunded ${refundAmount}, locked ${lockAmount}. Reference: ${reference}`
      );

      return { success: true, balance };
    } catch (error) {
      await session.abortTransaction();
      logger.error(`Failed refund and lock for user ${userId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    } finally {
      session.endSession();
    }
  }

  /**
   * Get transaction history for a user
   */
  async getTransactionHistory(
    userId: string,
    options: { limit?: number; offset?: number; type?: TransactionType } = {}
  ) {
    const { limit = 50, offset = 0, type } = options;

    const query: Record<string, unknown> = { userId };
    if (type) {
      query.type = type;
    }

    const [transactions, total] = await Promise.all([
      Transaction.find(query).sort({ createdAt: -1 }).skip(offset).limit(limit),
      Transaction.countDocuments(query),
    ]);

    return {
      transactions,
      total,
      limit,
      offset,
    };
  }
}

export const balanceService = new BalanceService();
export default balanceService;
