import Redis from 'ioredis';
import config from '../config';
import logger from '../utils/logger';

/**
 * 🔴 Redis Service
 * 
 * Handles:
 * - Connection management
 * - Pub/Sub for real-time events
 * - Caching
 * - Rate limiting
 * - Session storage
 */
class RedisService {
  private client: Redis | null = null;
  private subscriber: Redis | null = null;
  private publisher: Redis | null = null;
  private isConnected = false;

  // Pub/Sub channels
  static readonly CHANNELS = {
    BID_PLACED: 'auction:bid:placed',
    BID_OUTBID: 'auction:bid:outbid',
    ROUND_UPDATE: 'auction:round:update',
    ROUND_ENDING: 'auction:round:ending',
    ROUND_ENDED: 'auction:round:ended',
    LEADERBOARD_UPDATE: 'auction:leaderboard:update',
    AUCTION_UPDATE: 'auction:update',
    USER_NOTIFICATION: 'user:notification',
  };

  // Cache keys
  static readonly KEYS = {
    AUCTION: (id: string) => `auction:${id}`,
    ROUND: (auctionId: string, round: number) => `auction:${auctionId}:round:${round}`,
    LEADERBOARD: (auctionId: string, round: number) => `leaderboard:${auctionId}:${round}`,
    USER_BALANCE: (userId: string) => `user:${userId}:balance`,
    ACTIVE_AUCTIONS: 'auctions:active',
    ONLINE_USERS: 'users:online',
    RATE_LIMIT: (userId: string, action: string) => `ratelimit:${userId}:${action}`,
    // Distributed locks
    BID_LOCK: (auctionId: string) => `lock:bid:${auctionId}`,
    AUTOBID_LOCK: (auctionId: string) => `lock:autobid:${auctionId}`,
  };

  // Cache TTLs (in seconds)
  static readonly TTL = {
    AUCTION: 60,
    LEADERBOARD: 5,
    BALANCE: 30,
    RATE_LIMIT: 60,
    LOCK: 10, // Lock timeout - 10 seconds max
  };

  /**
   * Connect to Redis
   */
  async connect(): Promise<void> {
    try {
      const redisUrl = config.redisUrl;

      // Main client for general operations
      this.client = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      });

      // Separate clients for pub/sub
      this.subscriber = new Redis(redisUrl, { lazyConnect: true });
      this.publisher = new Redis(redisUrl, { lazyConnect: true });

      // Connect all clients
      await Promise.all([
        this.client.connect(),
        this.subscriber.connect(),
        this.publisher.connect(),
      ]);

      this.isConnected = true;
      logger.info('✅ Redis connected');

      // Setup event handlers
      this.setupEventHandlers();
    } catch (error) {
      logger.warn('⚠️ Redis connection failed, running without cache:', error);
      this.isConnected = false;
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    try {
      if (this.subscriber) {
        this.subscriber.disconnect();
      }
      if (this.publisher) {
        this.publisher.disconnect();
      }
      if (this.client) {
        this.client.disconnect();
      }
      this.isConnected = false;
      logger.info('Redis disconnected');
    } catch (error) {
      logger.error('Error disconnecting Redis:', error);
    }
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    if (!this.client) return;

    this.client.on('error', (error) => {
      logger.error('Redis error:', error);
    });

    this.client.on('reconnecting', () => {
      logger.info('Redis reconnecting...');
    });
  }

  /**
   * Check if Redis is available
   */
  isAvailable(): boolean {
    return this.isConnected && this.client !== null;
  }

  // ==================== CACHING ====================

  /**
   * Get cached value
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.isAvailable()) return null;

    try {
      const value = await this.client!.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error(`Redis GET error for ${key}:`, error);
      return null;
    }
  }

  /**
   * Set cached value
   */
  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    if (!this.isAvailable()) return;

    try {
      const serialized = JSON.stringify(value);
      if (ttlSeconds) {
        await this.client!.setex(key, ttlSeconds, serialized);
      } else {
        await this.client!.set(key, serialized);
      }
    } catch (error) {
      logger.error(`Redis SET error for ${key}:`, error);
    }
  }

  /**
   * Delete cached value
   */
  async del(key: string): Promise<void> {
    if (!this.isAvailable()) return;

    try {
      await this.client!.del(key);
    } catch (error) {
      logger.error(`Redis DEL error for ${key}:`, error);
    }
  }

  /**
   * Delete by pattern
   */
  async delPattern(pattern: string): Promise<void> {
    if (!this.isAvailable()) return;

    try {
      const keys = await this.client!.keys(pattern);
      if (keys.length > 0) {
        await this.client!.del(...keys);
      }
    } catch (error) {
      logger.error(`Redis DEL pattern error for ${pattern}:`, error);
    }
  }

  // ==================== PUB/SUB ====================

  /**
   * Publish message to channel
   */
  async publish(channel: string, data: unknown): Promise<void> {
    if (!this.publisher) {
      // Если Redis недоступен, просто логируем
      logger.debug(`Would publish to ${channel}:`, data);
      return;
    }

    try {
      await this.publisher.publish(channel, JSON.stringify(data));
    } catch (error) {
      logger.error(`Redis PUBLISH error for ${channel}:`, error);
    }
  }

  /**
   * Subscribe to channel
   */
  async subscribe(channel: string, handler: (data: unknown) => void): Promise<void> {
    if (!this.subscriber) return;

    try {
      await this.subscriber.subscribe(channel);
      this.subscriber.on('message', (ch, message) => {
        if (ch === channel) {
          try {
            const data = JSON.parse(message);
            handler(data);
          } catch (error) {
            logger.error(`Error parsing message from ${channel}:`, error);
          }
        }
      });
    } catch (error) {
      logger.error(`Redis SUBSCRIBE error for ${channel}:`, error);
    }
  }

  // ==================== LEADERBOARD ====================

  /**
   * Update leaderboard score
   */
  async updateLeaderboard(
    auctionId: string,
    roundNumber: number,
    memberId: string,
    score: number
  ): Promise<void> {
    if (!this.isAvailable()) return;

    try {
      const key = RedisService.KEYS.LEADERBOARD(auctionId, roundNumber);
      await this.client!.zadd(key, score, memberId);
      await this.client!.expire(key, 3600); // 1 hour TTL
    } catch (error) {
      logger.error('Error updating leaderboard:', error);
    }
  }

  /**
   * Get leaderboard (top N)
   */
  async getLeaderboard(
    auctionId: string,
    roundNumber: number,
    limit: number = 10
  ): Promise<Array<{ oduserId: string; score: number; rank: number }>> {
    if (!this.isAvailable()) return [];

    try {
      const key = RedisService.KEYS.LEADERBOARD(auctionId, roundNumber);
      const results = await this.client!.zrevrange(key, 0, limit - 1, 'WITHSCORES');

      const leaderboard: Array<{ oduserId: string; score: number; rank: number }> = [];
      for (let i = 0; i < results.length; i += 2) {
        leaderboard.push({
          oduserId: results[i],
          score: parseFloat(results[i + 1]),
          rank: Math.floor(i / 2) + 1,
        });
      }

      return leaderboard;
    } catch (error) {
      logger.error('Error getting leaderboard:', error);
      return [];
    }
  }

  /**
   * Get user rank in leaderboard
   */
  async getUserRank(
    auctionId: string,
    roundNumber: number,
    oduserId: string
  ): Promise<number | null> {
    if (!this.isAvailable()) return null;

    try {
      const key = RedisService.KEYS.LEADERBOARD(auctionId, roundNumber);
      const rank = await this.client!.zrevrank(key, oduserId);
      return rank !== null ? rank + 1 : null;
    } catch (error) {
      logger.error('Error getting user rank:', error);
      return null;
    }
  }

  /**
   * Remove from leaderboard
   */
  async removeFromLeaderboard(
    auctionId: string,
    roundNumber: number,
    oduserId: string
  ): Promise<void> {
    if (!this.isAvailable()) return;

    try {
      const key = RedisService.KEYS.LEADERBOARD(auctionId, roundNumber);
      await this.client!.zrem(key, oduserId);
    } catch (error) {
      logger.error('Error removing from leaderboard:', error);
    }
  }

  // ==================== RATE LIMITING ====================

  /**
   * Check rate limit
   */
  async checkRateLimit(
    userId: string,
    action: string,
    maxAttempts: number,
    windowSeconds: number
  ): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
    if (!this.isAvailable()) {
      return { allowed: true, remaining: maxAttempts, resetIn: 0 };
    }

    try {
      const key = RedisService.KEYS.RATE_LIMIT(userId, action);
      const current = await this.client!.incr(key);

      if (current === 1) {
        await this.client!.expire(key, windowSeconds);
      }

      const ttl = await this.client!.ttl(key);
      const remaining = Math.max(0, maxAttempts - current);

      return {
        allowed: current <= maxAttempts,
        remaining,
        resetIn: ttl > 0 ? ttl : 0,
      };
    } catch (error) {
      logger.error('Error checking rate limit:', error);
      return { allowed: true, remaining: maxAttempts, resetIn: 0 };
    }
  }

  // ==================== ONLINE USERS ====================

  /**
   * Add user to online set
   */
  async setUserOnline(userId: string, auctionId?: string): Promise<void> {
    if (!this.isAvailable()) return;

    try {
      const now = Date.now();
      await this.client!.zadd(RedisService.KEYS.ONLINE_USERS, now, userId);

      if (auctionId) {
        await this.client!.zadd(`auction:${auctionId}:viewers`, now, userId);
      }
    } catch (error) {
      logger.error('Error setting user online:', error);
    }
  }

  /**
   * Remove user from online set
   */
  async setUserOffline(userId: string, auctionId?: string): Promise<void> {
    if (!this.isAvailable()) return;

    try {
      await this.client!.zrem(RedisService.KEYS.ONLINE_USERS, userId);

      if (auctionId) {
        await this.client!.zrem(`auction:${auctionId}:viewers`, userId);
      }
    } catch (error) {
      logger.error('Error setting user offline:', error);
    }
  }

  /**
   * Get online users count
   */
  async getOnlineCount(auctionId?: string): Promise<number> {
    if (!this.isAvailable()) return 0;

    try {
      const key = auctionId
        ? `auction:${auctionId}:viewers`
        : RedisService.KEYS.ONLINE_USERS;

      // Count users active in last 5 minutes
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      return await this.client!.zcount(key, fiveMinutesAgo, '+inf');
    } catch (error) {
      logger.error('Error getting online count:', error);
      return 0;
    }
  }

  // ==================== DISTRIBUTED LOCKS ====================

  /**
   * Acquire a distributed lock
   * Uses SET NX EX pattern for atomic lock acquisition
   * @param key Lock key
   * @param ttlSeconds Lock timeout in seconds
   * @param maxRetries Number of retry attempts
   * @param retryDelayMs Delay between retries in ms
   * @returns lockId if acquired, null if failed
   */
  async acquireLock(
    key: string,
    ttlSeconds: number = RedisService.TTL.LOCK,
    maxRetries: number = 3,
    retryDelayMs: number = 100
  ): Promise<string | null> {
    if (!this.isConnected || !this.client) {
      logger.warn('Redis not connected, skipping lock');
      return `local-${Date.now()}`; // Fallback for local dev
    }

    const lockId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // SET key value NX EX ttl - atomic lock
        const result = await this.client.set(key, lockId, 'EX', ttlSeconds, 'NX');
        
        if (result === 'OK') {
          logger.debug(`Lock acquired: ${key} (id: ${lockId})`);
          return lockId;
        }

        // Wait before retry
        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, retryDelayMs));
        }
      } catch (error) {
        logger.error(`Error acquiring lock ${key}:`, error);
      }
    }

    logger.warn(`Failed to acquire lock after ${maxRetries} attempts: ${key}`);
    return null;
  }

  /**
   * Release a distributed lock
   * Only releases if the lockId matches (prevents releasing someone else's lock)
   * @param key Lock key
   * @param lockId The lock ID returned from acquireLock
   */
  async releaseLock(key: string, lockId: string): Promise<boolean> {
    if (!this.isConnected || !this.client) {
      return true; // Fallback for local dev
    }

    // Local fallback lock
    if (lockId.startsWith('local-')) {
      return true;
    }

    try {
      // Lua script to ensure we only delete our own lock
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;

      const result = await this.client.eval(script, 1, key, lockId);
      
      if (result === 1) {
        logger.debug(`Lock released: ${key}`);
        return true;
      } else {
        logger.warn(`Lock not released (not owner or expired): ${key}`);
        return false;
      }
    } catch (error) {
      logger.error(`Error releasing lock ${key}:`, error);
      return false;
    }
  }

  /**
   * Acquire bid lock for an auction
   * Prevents race conditions when multiple users bid simultaneously
   */
  async acquireBidLock(auctionId: string): Promise<string | null> {
    return this.acquireLock(RedisService.KEYS.BID_LOCK(auctionId), 5, 5, 50);
  }

  /**
   * Release bid lock for an auction
   */
  async releaseBidLock(auctionId: string, lockId: string): Promise<boolean> {
    return this.releaseLock(RedisService.KEYS.BID_LOCK(auctionId), lockId);
  }

  /**
   * Acquire auto-bid lock for an auction
   * Prevents race conditions when auto-bids trigger simultaneously
   */
  async acquireAutoBidLock(auctionId: string): Promise<string | null> {
    return this.acquireLock(RedisService.KEYS.AUTOBID_LOCK(auctionId), 10, 3, 100);
  }

  /**
   * Release auto-bid lock for an auction
   */
  async releaseAutoBidLock(auctionId: string, lockId: string): Promise<boolean> {
    return this.releaseLock(RedisService.KEYS.AUTOBID_LOCK(auctionId), lockId);
  }

  /**
   * Execute operation with lock
   * Helper method that acquires lock, executes operation, and releases lock
   */
  async withLock<T>(
    key: string,
    operation: () => Promise<T>,
    ttlSeconds: number = RedisService.TTL.LOCK
  ): Promise<{ success: boolean; result?: T; error?: string }> {
    const lockId = await this.acquireLock(key, ttlSeconds);
    
    if (!lockId) {
      return { success: false, error: 'Could not acquire lock' };
    }

    try {
      const result = await operation();
      return { success: true, result };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    } finally {
      await this.releaseLock(key, lockId);
    }
  }

  /**
   * Get Redis client (for advanced operations)
   */
  getClient(): Redis | null {
    return this.client;
  }
}

export const redisService = new RedisService();
export { RedisService };
export default redisService;
