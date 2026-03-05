import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';

import config from './config';
import routes from './routes';
import { errorHandler, notFoundHandler } from './middleware';
import { connectDatabase } from './utils/database';
import logger from './utils/logger';
import { telegramBotService } from './bot/TelegramBot';
import { socketService } from './services/SocketService';
import { redisService } from './services/RedisService';
import { timerService } from './services/TimerService';
import { metricsMiddleware } from './services/MetricsService';
import { auditService } from './services/AuditService';

/**
 * 🚀 Telegram Gift Auction Server
 * 
 * Stage 1: Core Auction Engine ✅
 * Stage 2: Real-Time Infrastructure ✅
 * - REST API
 * - MongoDB Models
 * - Balance System
 * - Auction Logic
 * - Anti-Sniping
 * - Socket.IO Real-time
 * - Redis Caching & Pub/Sub
 * - Live Leaderboard
 * - Countdown Timers
 */

// Create Express app
const app: Express = express();
const httpServer = createServer(app);

// ==================== MIDDLEWARE ====================

// Security
app.use(helmet());

// CORS
app.use(cors({
  origin: config.isDev ? '*' : [
    'https://your-telegram-app.com',
    /\.telegram\.org$/,
  ],
  credentials: true,
}));

// Rate limiting - skip for stress test routes and bot requests
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: {
    success: false,
    error: 'Too many requests, please try again later',
    timestamp: new Date(),
  },
  skip: (req) => {
    // Skip rate limiting for stress test routes
    if (req.path.includes('/stress-test')) return true;
    // Skip for bot requests (identified by X-Dev-User-Id header)
    if (req.headers['x-dev-user-id']) return true;
    return false;
  },
  keyGenerator: (req) => {
    // Use user ID or IP for rate limiting key
    return req.headers['x-forwarded-for'] as string || 
           req.ip || 
           req.socket.remoteAddress || 
           'unknown';
  },
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, _res, next) => {
  logger.http(`${req.method} ${req.path}`);
  next();
});

// Prometheus metrics
app.use(metricsMiddleware);

// ==================== ROUTES ====================

// API routes
app.use('/api', routes);

// Root endpoint
app.get('/', (_req, res) => {
  res.json({
    name: 'Telegram Gift Auction API',
    version: '1.0.0',
    stage: 'Stage 1 - Core Auction Engine',
    status: 'running',
    timestamp: new Date(),
    endpoints: {
      health: '/api/health',
      auctions: '/api/auctions',
      bids: '/api/bids',
      users: '/api/users',
    },
  });
});

// ==================== ERROR HANDLING ====================

app.use(notFoundHandler);
app.use(errorHandler);

// ==================== SERVER STARTUP ====================

const startServer = async (): Promise<void> => {
  try {
    // Connect to MongoDB
    await connectDatabase();

    // Connect to Redis
    await redisService.connect();

    // Initialize Socket.IO
    socketService.initialize(httpServer);

    // Initialize Timer Service
    timerService.initialize();

    // Sync timers from database (recover any active rounds)
    await timerService.syncFromDatabase();

    // Start Telegram Bot
    await telegramBotService.start();

    // Start HTTP server
    httpServer.listen(config.port, () => {
      logger.info(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   🏆 Telegram Gift Auction Server                          ║
║                                                            ║
║   Stage 2: Real-Time Infrastructure                        ║
║                                                            ║
║   ✅ Server running on port ${config.port}                        ║
║   ✅ MongoDB connected                                     ║
║   ✅ Redis ${redisService.isAvailable() ? 'connected     ' : 'disconnected  '}                             ║
║   ✅ Socket.IO ready                                       ║
║   ✅ Timer service active                                  ║
║   ✅ Telegram Bot active                                   ║
║   ✅ Environment: ${config.nodeEnv.padEnd(12)}                        ║
║                                                            ║
║   API: http://localhost:${config.port}/api                        ║
║   WebSocket: ws://localhost:${config.port}                        ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
      `);
    });

    // Graceful shutdown
    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

const gracefulShutdown = async (): Promise<void> => {
  logger.info('Shutting down gracefully...');

  // Stop Timer service
  timerService.shutdown();

  // Stop Telegram bot
  await telegramBotService.stop();

  // Disconnect Redis
  await redisService.disconnect();

  httpServer.close(async () => {
    logger.info('HTTP server closed');

    const { disconnectDatabase } = await import('./utils/database');
    await disconnectDatabase();

    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error('Forced shutdown');
    process.exit(1);
  }, 10000);
};

// Start the server
startServer();

export { app, httpServer };
