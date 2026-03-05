import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import config from '../config';
import { User } from '../models';
import logger from '../utils/logger';

export interface AuthRequest extends Request {
  userId?: string;
  telegramId?: string;
}

/**
 * Auth Middleware
 * Verifies JWT token and attaches user info to request
 */
export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'Authorization header missing or invalid',
        timestamp: new Date(),
      });
      return;
    }

    const token = authHeader.substring(7);

    try {
      const decoded = jwt.verify(token, config.jwt.secret) as {
        userId: string;
        telegramId: string;
      };

      req.userId = decoded.userId;
      req.telegramId = decoded.telegramId;

      next();
    } catch (jwtError) {
      res.status(401).json({
        success: false,
        error: 'Invalid or expired token',
        timestamp: new Date(),
      });
      return;
    }
  } catch (error) {
    logger.error('Auth middleware error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date(),
    });
  }
};

/**
 * Optional Auth Middleware
 * Attaches user info if token present, but doesn't require it
 */
export const optionalAuthMiddleware = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);

      try {
        const decoded = jwt.verify(token, config.jwt.secret) as {
          userId: string;
          telegramId: string;
        };

        req.userId = decoded.userId;
        req.telegramId = decoded.telegramId;
      } catch {
        // Token invalid, but that's okay for optional auth
      }
    }

    next();
  } catch (error) {
    next();
  }
};

/**
 * Generate JWT token for a user
 */
export const generateToken = (userId: string, telegramId: string): string => {
  return jwt.sign(
    { userId, telegramId },
    config.jwt.secret,
    { expiresIn: '7d' }
  );
};

/**
 * Telegram WebApp Auth
 * Validates Telegram WebApp init data
 */
export const telegramAuthMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // In development, allow mock auth
    if (config.isDev && req.headers['x-dev-user-id']) {
      const devUserId = req.headers['x-dev-user-id'] as string;
      const user = await User.findById(devUserId);
      
      if (user) {
        req.userId = user._id.toString();
        req.telegramId = user.telegramId;
        next();
        return;
      }
    }

    // Check for init data from Telegram WebApp
    const initData = req.headers['x-telegram-init-data'] as string;

    if (!initData) {
      // Fall back to JWT auth
      return authMiddleware(req, res, next);
    }

    // TODO: Validate Telegram init data signature
    // For now, parse the init data directly
    try {
      const params = new URLSearchParams(initData);
      const userParam = params.get('user');

      if (!userParam) {
        res.status(401).json({
          success: false,
          error: 'Invalid Telegram init data',
          timestamp: new Date(),
        });
        return;
      }

      const telegramUser = JSON.parse(userParam);
      const telegramId = telegramUser.id.toString();

      // Find or create user
      let user = await User.findByTelegramId(telegramId);

      if (!user) {
        user = await User.create({
          telegramId,
          firstName: telegramUser.first_name,
          lastName: telegramUser.last_name,
          username: telegramUser.username,
          photoUrl: telegramUser.photo_url,
        });
        logger.info(`Created new user from Telegram: ${telegramId}`);
      }

      req.userId = user._id.toString();
      req.telegramId = telegramId;

      next();
    } catch (parseError) {
      res.status(401).json({
        success: false,
        error: 'Failed to parse Telegram init data',
        timestamp: new Date(),
      });
      return;
    }
  } catch (error) {
    logger.error('Telegram auth middleware error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date(),
    });
  }
};
