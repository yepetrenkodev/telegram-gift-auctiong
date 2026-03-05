import { Request, Response, NextFunction } from 'express';
import { redisService } from '../services/RedisService';
import logger from '../utils/logger';

const IDEMPOTENCY_TTL = 60; // 60 seconds
const PROCESSING_TTL = 10; // 10 seconds for in-progress requests

interface IdempotencyResult {
  status: number;
  body: unknown;
}

/**
 * Idempotency Middleware
 * 
 * Prevents double-submit by tracking request keys in Redis.
 * If the same idempotency key is used within TTL, returns cached response.
 * 
 * Usage:
 * - Client sends header: X-Idempotency-Key: <unique-key>
 * - Server caches response for IDEMPOTENCY_TTL seconds
 * - Subsequent requests with same key return cached response
 */
export const idempotencyMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const idempotencyKey = req.headers['x-idempotency-key'] as string;
  
  // Skip if no idempotency key provided
  if (!idempotencyKey) {
    return next();
  }

  const cacheKey = `idempotency:${idempotencyKey}`;
  const processingKey = `idempotency:processing:${idempotencyKey}`;

  try {
    // Check if we have a cached response
    const cachedResponse = await redisService.get<IdempotencyResult>(cacheKey);
    
    if (cachedResponse) {
      logger.debug(`Idempotency hit: ${idempotencyKey}`);
      res.status(cachedResponse.status).json(cachedResponse.body);
      return;
    }

    // Check if request is currently being processed
    const isProcessing = await redisService.get<string>(processingKey);
    
    if (isProcessing) {
      logger.debug(`Idempotency: request in progress: ${idempotencyKey}`);
      res.status(409).json({
        success: false,
        error: 'Request already in progress',
        code: 'DUPLICATE_REQUEST',
      });
      return;
    }

    // Mark request as processing
    await redisService.set(processingKey, 'processing', PROCESSING_TTL);

    // Store original json method
    const originalJson = res.json.bind(res);

    // Override json method to cache response
    res.json = ((body: unknown): Response => {
      // Cache the response
      const result: IdempotencyResult = {
        status: res.statusCode,
        body,
      };
      
      // Only cache successful responses (2xx)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        redisService.set(cacheKey, result, IDEMPOTENCY_TTL)
          .catch(err => logger.error('Failed to cache idempotency response:', err));
      }

      // Remove processing flag
      redisService.del(processingKey)
        .catch(err => logger.error('Failed to remove processing flag:', err));

      // Call original json
      return originalJson(body);
    }) as Response['json'];

    next();
  } catch (error) {
    logger.error('Idempotency middleware error:', error);
    // On error, just proceed without idempotency check
    next();
  }
};

export default idempotencyMiddleware;
