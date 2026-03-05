import { Server, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import config from '../config';
import logger from '../utils/logger';
import { redisService } from './RedisService';

// Channel names for pub/sub
const REDIS_CHANNELS = {
  BID_PLACED: 'auction:bid:placed',
};

/**
 * 🔌 Socket.IO Service
 * 
 * Real-time communication for:
 * - Live bid updates
 * - Leaderboard changes
 * - Countdown timers
 * - Notifications
 * - Online presence
 */

// Socket event types
export enum SocketEvents {
  // Connection
  CONNECT = 'connect',
  DISCONNECT = 'disconnect',
  ERROR = 'error',

  // Room management
  JOIN_AUCTION = 'auction:join',
  LEAVE_AUCTION = 'auction:leave',
  JOIN_ROUND = 'round:join',

  // Bid events
  BID_PLACED = 'bid:placed',
  BID_OUTBID = 'bid:outbid',
  BID_ERROR = 'bid:error',

  // Auction events
  AUCTION_UPDATE = 'auction:update',
  AUCTION_STARTED = 'auction:started',
  AUCTION_ENDED = 'auction:ended',
  AUCTION_CANCELLED = 'auction:cancelled',

  // Round events
  ROUND_UPDATE = 'round:update',
  ROUND_STARTED = 'round:started',
  ROUND_ENDING = 'round:ending',
  ROUND_ENDED = 'round:ended',
  ROUND_EXTENDED = 'round:extended',

  // Leaderboard
  LEADERBOARD_UPDATE = 'leaderboard:update',

  // Timer
  TIMER_SYNC = 'timer:sync',
  TIMER_TICK = 'timer:tick',

  // User events
  USER_JOINED = 'user:joined',
  USER_LEFT = 'user:left',
  VIEWERS_COUNT = 'viewers:count',

  // Notifications
  NOTIFICATION = 'notification',
  
  // Auto-bid events
  AUTOBID_TRIGGERED = 'autobid:triggered',
  AUTOBID_STOPPED = 'autobid:stopped',
}

// Payload types
export interface BidPlacedPayload {
  auctionId: string;
  roundNumber: number;
  bidId?: string;
  userId?: string;
  userName?: string;
  userRank?: string;
  amount: number;
  position?: number;
  totalBids?: number;
  timestamp?: Date;
  isTopTen?: boolean;
  // Additional fields for client compatibility
  bid?: {
    id: string;
    bidderId: string;
    bidderName: string;
    amount: number;
    createdAt: string;
  };
  bidderName?: string;
  bidderId?: string;
  newHighestBid?: number;
  // Anti-snipe extension info
  extended?: boolean;
  newEndsAt?: Date;
  // Outbid info - who was outbid and how much to refund
  outbidUserId?: string;
  outbidAmount?: number;
}

export interface LeaderboardEntry {
  oduserId: string;
  odrank: number;
  odavatarUrl?: string;
  userName: string;
  userRank: string;
  amount: number;
  bidCount: number;
  lastBidAt: Date;
}

export interface LeaderboardPayload {
  auctionId: string;
  roundNumber: number;
  topBidders: LeaderboardEntry[];
  totalBidders: number;
  totalBids: number;
  timestamp: Date;
}

export interface TimerPayload {
  auctionId: string;
  roundNumber: number;
  endsAt: Date;
  secondsLeft: number;
  extended: boolean;
  extensionCount: number;
}

export interface RoundEndedPayload {
  auctionId: string;
  roundNumber: number;
  winners: Array<{
    oduserId: string;
    userName: string;
    amount: number;
    position: number;
  }>;
  nextRound?: {
    number: number;
    startsAt: Date;
  };
}

// Extended socket with user data
interface AuthenticatedSocket extends Socket {
  userId?: string;
  telegramId?: string;
  currentAuction?: string;
}

class SocketService {
  private io: Server | null = null;
  private connections: Map<string, Set<string>> = new Map(); // oduserId -> Set<socketId>

  /**
   * Initialize Socket.IO server
   */
  initialize(httpServer: HttpServer): void {
    this.io = new Server(httpServer, {
      cors: {
        origin: config.isDev ? '*' : [
          'https://your-telegram-app.com',
          /\.telegram\.org$/,
        ],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    this.setupMiddleware();
    this.setupEventHandlers();
    this.setupRedisSubscriptions();

    logger.info('✅ Socket.IO initialized');
  }

  /**
   * Setup authentication middleware
   */
  private setupMiddleware(): void {
    if (!this.io) return;

    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.query.token;

        if (!token) {
          // Allow anonymous connections for viewing
          return next();
        }

        // Verify JWT token
        const decoded = jwt.verify(token as string, config.jwt.secret) as {
          userId: string;
          telegramId: string;
        };

        socket.userId = decoded.userId;
        socket.telegramId = decoded.telegramId;

        next();
      } catch (error) {
        // Allow connection but mark as unauthenticated
        next();
      }
    });
  }

  /**
   * Setup socket event handlers
   */
  private setupEventHandlers(): void {
    if (!this.io) return;

    this.io.on('connection', (socket: AuthenticatedSocket) => {
      this.handleConnection(socket);

      socket.on('disconnect', () => this.handleDisconnect(socket));
      socket.on(SocketEvents.JOIN_AUCTION, (data) => this.handleJoinAuction(socket, data));
      socket.on(SocketEvents.LEAVE_AUCTION, (data) => this.handleLeaveAuction(socket, data));
      socket.on('error', (error) => this.handleError(socket, error));
    });
  }

  /**
   * Setup Redis pub/sub subscriptions
   */
  private async setupRedisSubscriptions(): Promise<void> {
    // Подписка на события из других инстансов (для масштабирования)
    await redisService.subscribe(REDIS_CHANNELS.BID_PLACED, (data) => {
      this.broadcastBidPlaced(data as BidPlacedPayload);
    });
  }

  // ==================== CONNECTION HANDLERS ====================

  /**
   * Handle new connection
   */
  private handleConnection(socket: AuthenticatedSocket): void {
    logger.debug(`Socket connected: ${socket.id}, user: ${socket.userId || 'anonymous'}`);

    // Track user connections
    if (socket.userId) {
      if (!this.connections.has(socket.userId)) {
        this.connections.set(socket.userId, new Set());
      }
      this.connections.get(socket.userId)!.add(socket.id);

      // Mark user online
      redisService.setUserOnline(socket.userId);
    }

    // Send welcome message
    socket.emit('welcome', {
      message: 'Connected to Gift Auction',
      socketId: socket.id,
      authenticated: !!socket.userId,
      timestamp: new Date(),
    });
  }

  /**
   * Handle disconnect
   */
  private handleDisconnect(socket: AuthenticatedSocket): void {
    logger.debug(`Socket disconnected: ${socket.id}`);

    // Clean up user connections
    if (socket.userId) {
      const userSockets = this.connections.get(socket.userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          this.connections.delete(socket.userId);
          redisService.setUserOffline(socket.userId, socket.currentAuction);
        }
      }
    }

    // Update viewers count if was viewing auction
    if (socket.currentAuction) {
      this.broadcastViewersCount(socket.currentAuction);
    }
  }

  /**
   * Handle join auction room
   */
  private async handleJoinAuction(
    socket: AuthenticatedSocket,
    data: { auctionId: string }
  ): Promise<void> {
    const { auctionId } = data;

    // Leave previous auction room
    if (socket.currentAuction && socket.currentAuction !== auctionId) {
      socket.leave(`auction:${socket.currentAuction}`);
    }

    // Join new auction room
    socket.join(`auction:${auctionId}`);
    socket.currentAuction = auctionId;

    // Track viewer
    if (socket.userId) {
      await redisService.setUserOnline(socket.userId, auctionId);
    }

    // Broadcast updated viewers count
    this.broadcastViewersCount(auctionId);

    // Send current auction state
    socket.emit(SocketEvents.AUCTION_UPDATE, {
      auctionId,
      joined: true,
      timestamp: new Date(),
    });

    logger.debug(`Socket ${socket.id} joined auction ${auctionId}`);
  }

  /**
   * Handle leave auction room
   */
  private async handleLeaveAuction(
    socket: AuthenticatedSocket,
    data: { auctionId: string }
  ): Promise<void> {
    const { auctionId } = data;

    socket.leave(`auction:${auctionId}`);

    if (socket.currentAuction === auctionId) {
      socket.currentAuction = undefined;
    }

    if (socket.userId) {
      await redisService.setUserOffline(socket.userId, auctionId);
    }

    this.broadcastViewersCount(auctionId);

    logger.debug(`Socket ${socket.id} left auction ${auctionId}`);
  }

  /**
   * Handle socket error
   */
  private handleError(socket: AuthenticatedSocket, error: Error): void {
    logger.error(`Socket error for ${socket.id}:`, error);
  }

  // ==================== BROADCAST METHODS ====================

  /**
   * Broadcast bid placed event
   */
  broadcastBidPlaced(payload: BidPlacedPayload): void {
    if (!this.io) return;

    this.io.to(`auction:${payload.auctionId}`).emit(SocketEvents.BID_PLACED, payload);

    logger.debug(`Broadcast bid placed: auction=${payload.auctionId}, amount=${payload.amount}`);
  }

  /**
   * Broadcast outbid notification to specific user
   */
  broadcastOutbid(userId: string, payload: {
    auctionId: string;
    roundNumber: number;
    outbidBy: string;
    newAmount: number;
    yourAmount: number;
    newPosition: number;
  }): void {
    if (!this.io) return;

    const userSockets = this.connections.get(userId);
    if (userSockets) {
      userSockets.forEach(socketId => {
        this.io!.to(socketId).emit(SocketEvents.BID_OUTBID, payload);
      });
    }
  }

  /**
   * Broadcast leaderboard update
   */
  broadcastLeaderboard(payload: LeaderboardPayload): void {
    if (!this.io) return;

    this.io.to(`auction:${payload.auctionId}`).emit(SocketEvents.LEADERBOARD_UPDATE, payload);
  }

  /**
   * Broadcast timer sync
   */
  broadcastTimer(payload: TimerPayload): void {
    if (!this.io) return;

    this.io.to(`auction:${payload.auctionId}`).emit(SocketEvents.TIMER_SYNC, payload);
  }

  /**
   * Broadcast timer tick (every second)
   */
  broadcastTimerTick(auctionId: string, secondsLeft: number): void {
    if (!this.io) return;

    this.io.to(`auction:${auctionId}`).emit(SocketEvents.TIMER_TICK, {
      auctionId,
      secondsLeft,
      timestamp: new Date(),
    });
  }

  /**
   * Broadcast round extended (anti-snipe)
   */
  broadcastRoundExtended(payload: {
    auctionId: string;
    roundNumber: number;
    newEndsAt: Date;
    extensionCount: number;
    triggeredBy: string;
  }): void {
    if (!this.io) return;

    this.io.to(`auction:${payload.auctionId}`).emit(SocketEvents.ROUND_EXTENDED, payload);

    logger.info(`Round extended: auction=${payload.auctionId}, count=${payload.extensionCount}`);
  }

  /**
   * Broadcast round ending warning
   */
  broadcastRoundEnding(auctionId: string, secondsLeft: number): void {
    if (!this.io) return;

    this.io.to(`auction:${auctionId}`).emit(SocketEvents.ROUND_ENDING, {
      auctionId,
      secondsLeft,
      message: `Round ending in ${secondsLeft} seconds!`,
      timestamp: new Date(),
    });
  }

  /**
   * Broadcast round ended
   */
  broadcastRoundEnded(payload: RoundEndedPayload): void {
    if (!this.io) return;

    this.io.to(`auction:${payload.auctionId}`).emit(SocketEvents.ROUND_ENDED, payload);

    logger.info(`Round ended: auction=${payload.auctionId}, round=${payload.roundNumber}`);
  }
  /**
   * Broadcast auction ended
   */
  broadcastAuctionEnded(payload: {
    auctionId: string;
    winnerId: string;
    winnerName: string;
    finalPrice: number;
    giftName?: string;
  }): void {
    if (!this.io) return;

    // Broadcast to all auction viewers
    this.io.to(`auction:${payload.auctionId}`).emit(SocketEvents.AUCTION_ENDED, {
      auctionId: payload.auctionId,
      winnerId: payload.winnerId,
      winnerName: payload.winnerName,
      finalPrice: payload.finalPrice,
      timestamp: new Date(),
    });

    // Send special notification to winner
    this.sendNotification(payload.winnerId, {
      type: 'success',
      title: 'Поздравляем!',
      message: `Вы выиграли ${payload.giftName || 'подарок'} за ${payload.finalPrice} звезд`,
    });

    logger.info(`Auction ended: auction=${payload.auctionId}, winner=${payload.winnerName}, price=${payload.finalPrice}`);
  }
  /**
   * Broadcast viewers count
   */
  async broadcastViewersCount(auctionId: string): Promise<void> {
    if (!this.io) return;

    const count = await redisService.getOnlineCount(auctionId);
    const roomSize = this.io.sockets.adapter.rooms.get(`auction:${auctionId}`)?.size || 0;

    this.io.to(`auction:${auctionId}`).emit(SocketEvents.VIEWERS_COUNT, {
      auctionId,
      count: Math.max(count, roomSize),
      timestamp: new Date(),
    });
  }

  /**
   * Send notification to specific user
   */
  sendNotification(userId: string, notification: {
    type: 'info' | 'success' | 'warning' | 'error';
    title: string;
    message: string;
    data?: unknown;
  }): void {
    if (!this.io) return;

    const userSockets = this.connections.get(userId);
    if (userSockets) {
      userSockets.forEach(socketId => {
        this.io!.to(socketId).emit(SocketEvents.NOTIFICATION, {
          ...notification,
          timestamp: new Date(),
        });
      });
    }
  }

  /**
   * Broadcast to all connected clients
   */
  broadcastToAll(event: string, data: unknown): void {
    if (!this.io) return;
    this.io.emit(event, data);
  }

  /**
   * Broadcast auction cancelled to all viewers
   */
  broadcastAuctionCancelled(auctionId: string): void {
    if (!this.io) return;

    this.io.to(`auction:${auctionId}`).emit(SocketEvents.AUCTION_CANCELLED, {
      auctionId,
      timestamp: new Date(),
    });

    logger.info(`Broadcast auction cancelled: ${auctionId}`);
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Get connected users count
   */
  getConnectedCount(): number {
    return this.io?.sockets.sockets.size || 0;
  }

  /**
   * Get auction room size
   */
  getAuctionViewers(auctionId: string): number {
    return this.io?.sockets.adapter.rooms.get(`auction:${auctionId}`)?.size || 0;
  }

  /**
   * Check if user is connected
   */
  isUserConnected(userId: string): boolean {
    return this.connections.has(userId) && this.connections.get(userId)!.size > 0;
  }

  /**
   * Broadcast auto-bid triggered notification to specific user
   */
  broadcastAutoBidTriggered(userId: string, payload: {
    auctionId: string;
    roundNumber: number;
    amount: number;
    remainingMax: number;
    bidCount: number;
  }): void {
    if (!this.io) return;

    const userSockets = this.connections.get(userId);
    if (userSockets) {
      userSockets.forEach(socketId => {
        this.io!.to(socketId).emit(SocketEvents.AUTOBID_TRIGGERED, payload);
      });
    }
    
    logger.debug(`Auto-bid triggered: user=${userId}, amount=${payload.amount}`);
  }

  /**
   * Broadcast auto-bid stopped notification to specific user
   */
  broadcastAutoBidStopped(userId: string, payload: {
    auctionId: string;
    reason: 'manual' | 'max_reached' | 'outbid' | 'auction_ended' | 'insufficient_balance' | 'insufficient_funds' | string;
    maxAmount: number;
    totalBidsPlaced: number;
  }): void {
    if (!this.io) return;

    const userSockets = this.connections.get(userId);
    if (userSockets) {
      userSockets.forEach(socketId => {
        this.io!.to(socketId).emit(SocketEvents.AUTOBID_STOPPED, payload);
      });
    }
    
    logger.info(`Auto-bid stopped: user=${userId}, reason=${payload.reason}`);
  }

  /**
   * Broadcast auto-bid retrying notification to specific user
   */
  broadcastAutoBidRetrying(userId: string, payload: {
    auctionId: string;
    reason: string;
    retryIn: number;
    required: number;
    available: number;
  }): void {
    if (!this.io) return;

    const userSockets = this.connections.get(userId);
    if (userSockets) {
      userSockets.forEach(socketId => {
        this.io!.to(socketId).emit('autoBidRetrying', payload);
      });
    }
    
    logger.info(`Auto-bid retrying: user=${userId}, retryIn=${payload.retryIn}s`);
  }

  /**
   * Send event to specific user (all their connected sockets)
   * Generic method for custom events
   */
  sendToUser(userId: string, event: string, data: unknown): void {
    if (!this.io) return;

    const userSockets = this.connections.get(userId);
    if (userSockets && userSockets.size > 0) {
      userSockets.forEach(socketId => {
        this.io!.to(socketId).emit(event, data);
      });
      logger.debug(`Sent ${event} to user ${userId} (${userSockets.size} sockets)`);
    }
  }

  /**
   * Send event to multiple users
   */
  sendToUsers(userIds: string[], event: string, data: unknown): void {
    if (!this.io) return;

    userIds.forEach(userId => {
      this.sendToUser(userId, event, data);
    });
  }

  /**
   * Get Socket.IO server instance
   */
  getIO(): Server | null {
    return this.io;
  }
}

export const socketService = new SocketService();
export default socketService;
