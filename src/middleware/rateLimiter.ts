import { Request, Response, NextFunction } from 'express';
import { redisService } from '../services/RedisService';
import logger from '../utils/logger';

interface RateLimitConfig {
  maxAttempts: number;
  windowSeconds: number;
  message?: string;
}

// Default configurations for different actions
const RATE_LIMITS: Record<string, RateLimitConfig> = {
  bid: {
    maxAttempts: 30,      // 30 bids
    windowSeconds: 60,    // per minute
    message: 'Too many bids. Please wait before placing another bid.',
  },
  autobid: {
    maxAttempts: 10,      // 10 auto-bid configs
    windowSeconds: 60,    // per minute
    message: 'Too many auto-bid requests.',
  },
  login: {
    maxAttempts: 5,       // 5 login attempts
    windowSeconds: 300,   // per 5 minutes
    message: 'Too many login attempts. Please try again later.',
  },
  api: {
    maxAttempts: 100,     // 100 requests
    windowSeconds: 60,    // per minute
    message: 'Too many requests. Please slow down.',
  },
};

/**
 * Get user identifier from request
 */
function getUserId(req: Request): string {
  // Try to get authenticated user ID
  const authReq = req as Request & { user?: { id: string } };
  if (authReq.user?.id) {
    return `user:${authReq.user.id}`;
  }
  
  // Fall back to IP address
  const ip = req.headers['x-forwarded-for'] as string ||
             req.ip ||
             req.socket.remoteAddress ||
             'unknown';
  return `ip:${ip}`;
}

/**
 * Create rate limit middleware for a specific action
 */
export function createRateLimiter(action: keyof typeof RATE_LIMITS | RateLimitConfig) {
  const config = typeof action === 'string' ? RATE_LIMITS[action] : action;
  
  if (!config) {
    throw new Error(`Unknown rate limit action: ${action}`);
  }

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Skip rate limiting for stress tests
    if (req.headers['x-dev-user-id']) {
      return next();
    }

    const userId = getUserId(req);
    const actionKey = typeof action === 'string' ? action : 'custom';

    try {
      const result = await redisService.checkRateLimit(
        userId,
        actionKey,
        config.maxAttempts,
        config.windowSeconds
      );

      // Add rate limit headers
      res.setHeader('X-RateLimit-Limit', config.maxAttempts);
      res.setHeader('X-RateLimit-Remaining', result.remaining);
      res.setHeader('X-RateLimit-Reset', Math.ceil(Date.now() / 1000) + result.resetIn);

      if (!result.allowed) {
        logger.warn(`Rate limit exceeded: ${userId} on ${actionKey}`);
        
        res.status(429).json({
          success: false,
          error: config.message || 'Rate limit exceeded',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: result.resetIn,
        });
        return;
      }

      next();
    } catch (error) {
      // On error, allow the request (fail open)
      logger.error('Rate limiter error:', error);
      next();
    }
  };
}

// Pre-configured middleware instances
export const bidRateLimiter = createRateLimiter('bid');
export const autobidRateLimiter = createRateLimiter('autobid');
export const loginRateLimiter = createRateLimiter('login');
export const apiRateLimiter = createRateLimiter('api');

export default {
  createRateLimiter,
  bidRateLimiter,
  autobidRateLimiter,
  loginRateLimiter,
  apiRateLimiter,
};
