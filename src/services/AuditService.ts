import { v4 as uuidv4 } from 'uuid';
import { AuditLog, IAuditLogDocument, AuditEventType } from '../models/AuditLog';
import logger from '../utils/logger';

interface AuditContext {
  actorType: 'user' | 'system' | 'admin' | 'bot';
  actorId?: string;
  actorIp?: string;
  requestId?: string;
  userAgent?: string;
}

interface AuditEventData {
  targetType: 'auction' | 'bid' | 'balance' | 'user' | 'round';
  targetId: string;
  action: string;
  description: string;
  previousState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
  amount?: number;
  balanceBefore?: number;
  balanceAfter?: number;
  metadata?: Record<string, unknown>;
}

/**
 * 📝 Audit Service
 * 
 * Records all important operations for compliance and debugging.
 * Uses fire-and-forget pattern - never blocks main operations.
 */
class AuditService {
  private buffer: Partial<IAuditLogDocument>[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private readonly BUFFER_SIZE = 100;
  private readonly FLUSH_INTERVAL_MS = 5000;

  constructor() {
    this.startAutoFlush();
  }

  /**
   * Log an audit event
   */
  async log(
    eventType: AuditEventType,
    context: AuditContext,
    data: AuditEventData
  ): Promise<void> {
    const entry: Partial<IAuditLogDocument> = {
      eventType,
      eventId: uuidv4(),
      timestamp: new Date(),
      ...context,
      ...data,
    };

    // Add to buffer for batch insert
    this.buffer.push(entry);

    // Flush if buffer is full
    if (this.buffer.length >= this.BUFFER_SIZE) {
      await this.flush();
    }
  }

  /**
   * Log balance operation
   */
  async logBalanceOperation(
    eventType: AuditEventType,
    userId: string,
    amount: number,
    balanceBefore: number,
    balanceAfter: number,
    context: Partial<AuditContext> = {},
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await this.log(
      eventType,
      {
        actorType: context.actorType || 'system',
        actorId: context.actorId || userId,
        actorIp: context.actorIp,
        requestId: context.requestId,
      },
      {
        targetType: 'balance',
        targetId: userId,
        action: eventType.split('.')[1],
        description: `Balance ${eventType.split('.')[1]}: ${amount} stars`,
        amount,
        balanceBefore,
        balanceAfter,
        metadata,
      }
    );
  }

  /**
   * Log bid operation
   */
  async logBidOperation(
    eventType: AuditEventType,
    bidId: string,
    userId: string,
    auctionId: string,
    amount: number,
    context: Partial<AuditContext> = {},
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await this.log(
      eventType,
      {
        actorType: context.actorType || 'user',
        actorId: userId,
        actorIp: context.actorIp,
        requestId: context.requestId,
      },
      {
        targetType: 'bid',
        targetId: bidId,
        action: eventType.split('.')[1],
        description: `Bid ${eventType.split('.')[1]}: ${amount} stars on auction ${auctionId}`,
        amount,
        metadata: { ...metadata, auctionId, userId },
      }
    );
  }

  /**
   * Log auction operation
   */
  async logAuctionOperation(
    eventType: AuditEventType,
    auctionId: string,
    context: Partial<AuditContext> = {},
    previousState?: Record<string, unknown>,
    newState?: Record<string, unknown>,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await this.log(
      eventType,
      {
        actorType: context.actorType || 'system',
        actorId: context.actorId,
        actorIp: context.actorIp,
        requestId: context.requestId,
      },
      {
        targetType: 'auction',
        targetId: auctionId,
        action: eventType.split('.')[1],
        description: `Auction ${eventType.split('.')[1]}`,
        previousState,
        newState,
        metadata,
      }
    );
  }

  /**
   * Log round operation
   */
  async logRoundOperation(
    eventType: AuditEventType,
    roundId: string,
    auctionId: string,
    context: Partial<AuditContext> = {},
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await this.log(
      eventType,
      {
        actorType: context.actorType || 'system',
        actorId: context.actorId,
      },
      {
        targetType: 'round',
        targetId: roundId,
        action: eventType.split('.')[1],
        description: `Round ${eventType.split('.')[1]}`,
        metadata: { ...metadata, auctionId },
      }
    );
  }

  /**
   * Query audit logs
   */
  async query(
    filters: {
      eventType?: AuditEventType | AuditEventType[];
      actorId?: string;
      targetId?: string;
      targetType?: string;
      startDate?: Date;
      endDate?: Date;
    },
    options: {
      limit?: number;
      skip?: number;
      sort?: 'asc' | 'desc';
    } = {}
  ): Promise<unknown[]> {
    const query: Record<string, unknown> = {};

    if (filters.eventType) {
      query.eventType = Array.isArray(filters.eventType) 
        ? { $in: filters.eventType } 
        : filters.eventType;
    }
    if (filters.actorId) query.actorId = filters.actorId;
    if (filters.targetId) query.targetId = filters.targetId;
    if (filters.targetType) query.targetType = filters.targetType;
    
    if (filters.startDate || filters.endDate) {
      query.timestamp = {};
      if (filters.startDate) (query.timestamp as Record<string, Date>).$gte = filters.startDate;
      if (filters.endDate) (query.timestamp as Record<string, Date>).$lte = filters.endDate;
    }

    return AuditLog.find(query)
      .sort({ timestamp: options.sort === 'asc' ? 1 : -1 })
      .skip(options.skip || 0)
      .limit(options.limit || 100)
      .lean();
  }

  /**
   * Get user activity summary
   */
  async getUserActivity(userId: string, days = 30): Promise<{
    totalBids: number;
    totalDeposits: number;
    totalWins: number;
    totalSpent: number;
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const logs = await AuditLog.find({
      actorId: userId,
      timestamp: { $gte: startDate },
    }).lean();

    return {
      totalBids: logs.filter(l => l.eventType === AuditEventType.BID_PLACED).length,
      totalDeposits: logs
        .filter(l => l.eventType === AuditEventType.BALANCE_DEPOSIT)
        .reduce((sum, l) => sum + (l.amount || 0), 0),
      totalWins: logs.filter(l => l.eventType === AuditEventType.BID_WON).length,
      totalSpent: logs
        .filter(l => l.eventType === AuditEventType.BID_WON)
        .reduce((sum, l) => sum + (l.amount || 0), 0),
    };
  }

  /**
   * Start auto-flush timer
   */
  private startAutoFlush(): void {
    this.flushInterval = setInterval(() => {
      if (this.buffer.length > 0) {
        this.flush().catch(err => logger.error('Audit flush error:', err));
      }
    }, this.FLUSH_INTERVAL_MS);
  }

  /**
   * Flush buffer to database
   */
  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const entries = [...this.buffer];
    this.buffer = [];

    try {
      await AuditLog.insertMany(entries, { ordered: false });
      logger.debug(`Flushed ${entries.length} audit log entries`);
    } catch (error) {
      logger.error('Failed to flush audit logs:', error);
      // Don't re-add to buffer to prevent memory issues
    }
  }

  /**
   * Shutdown - flush remaining entries
   */
  async shutdown(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    await this.flush();
  }
}

export const auditService = new AuditService();
export { AuditEventType };
export default auditService;
