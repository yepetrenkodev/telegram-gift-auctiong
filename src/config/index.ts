import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  // Server
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isDev: process.env.NODE_ENV === 'development',
  isProd: process.env.NODE_ENV === 'production',

  // MongoDB
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/telegram-auction',

  // Redis
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'default-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  // Telegram
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
  },

  // Auction defaults
  auction: {
    antiSnipeThresholdSeconds: parseInt(process.env.ANTI_SNIPE_THRESHOLD_SECONDS || '60', 10), // 1 minute
    antiSnipeExtensionSeconds: parseInt(process.env.ANTI_SNIPE_EXTENSION_SECONDS || '30', 10), // 30 seconds
    maxAntiSnipeExtensions: parseInt(process.env.MAX_ANTI_SNIPE_EXTENSIONS || '999', 10), // unlimited
    defaultRoundDurationMinutes: parseInt(process.env.DEFAULT_ROUND_DURATION_MINUTES || '5', 10),
    defaultMinBid: 10,
    defaultBidIncrement: 1,
    minBidBufferSeconds: parseInt(process.env.MIN_BID_BUFFER_SECONDS || '3', 10), // Minimum seconds before round end to accept bids
  },

  // Rate limiting
  rateLimit: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: process.env.NODE_ENV === 'development' ? 1000 : 100, // Higher limit in dev for stress testing
  },
};

export default config;
