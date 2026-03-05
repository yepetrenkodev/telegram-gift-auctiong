import { Request, Response, NextFunction } from 'express';
import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';
import logger from '../utils/logger';

// Create a new registry
const register = new Registry();

// Add default metrics (CPU, memory, etc.)
collectDefaultMetrics({ register });

// ==================== CUSTOM METRICS ====================

// HTTP request metrics
export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'path', 'status'],
  registers: [register],
});

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'path', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register],
});

// Bid metrics
export const bidsTotal = new Counter({
  name: 'auction_bids_total',
  help: 'Total number of bids placed',
  labelNames: ['auction_id', 'status'],
  registers: [register],
});

export const bidProcessingDuration = new Histogram({
  name: 'auction_bid_processing_seconds',
  help: 'Bid processing duration in seconds',
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1],
  registers: [register],
});

// Auction metrics
export const activeAuctions = new Gauge({
  name: 'auction_active_count',
  help: 'Number of currently active auctions',
  registers: [register],
});

export const activeRounds = new Gauge({
  name: 'auction_active_rounds_count',
  help: 'Number of currently active rounds',
  registers: [register],
});

// WebSocket metrics
export const websocketConnections = new Gauge({
  name: 'websocket_connections_total',
  help: 'Number of active WebSocket connections',
  registers: [register],
});

export const websocketMessages = new Counter({
  name: 'websocket_messages_total',
  help: 'Total WebSocket messages',
  labelNames: ['type', 'direction'],
  registers: [register],
});

// Balance metrics
export const balanceOperations = new Counter({
  name: 'balance_operations_total',
  help: 'Total balance operations',
  labelNames: ['type', 'status'],
  registers: [register],
});

// Redis metrics
export const redisOperations = new Counter({
  name: 'redis_operations_total',
  help: 'Total Redis operations',
  labelNames: ['operation', 'status'],
  registers: [register],
});

export const redisLatency = new Histogram({
  name: 'redis_operation_duration_seconds',
  help: 'Redis operation duration in seconds',
  labelNames: ['operation'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1],
  registers: [register],
});

// Error metrics
export const errorsTotal = new Counter({
  name: 'errors_total',
  help: 'Total number of errors',
  labelNames: ['type', 'code'],
  registers: [register],
});

// ==================== MIDDLEWARE ====================

/**
 * Express middleware to track HTTP metrics
 */
export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  // Track response
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const path = normalizePath(req.route?.path || req.path);
    const labels = {
      method: req.method,
      path,
      status: res.statusCode.toString(),
    };

    httpRequestsTotal.inc(labels);
    httpRequestDuration.observe(labels, duration);
  });

  next();
}

/**
 * Normalize path for metrics (remove IDs)
 */
function normalizePath(path: string): string {
  return path
    .replace(/\/[a-f0-9]{24}/g, '/:id') // MongoDB ObjectId
    .replace(/\/\d+/g, '/:id')           // Numeric IDs
    .replace(/\?.*$/, '');               // Query params
}

// ==================== METRICS ENDPOINT ====================

/**
 * Get metrics endpoint handler
 */
export async function getMetrics(_req: Request, res: Response): Promise<void> {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (error) {
    logger.error('Error generating metrics:', error);
    res.status(500).end();
  }
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Record bid metric
 */
export function recordBid(auctionId: string, status: 'success' | 'failed'): void {
  bidsTotal.inc({ auction_id: auctionId, status });
}

/**
 * Measure bid processing time
 */
export function measureBidProcessing(): () => void {
  const end = bidProcessingDuration.startTimer();
  return () => end();
}

/**
 * Update active auctions count
 */
export function setActiveAuctions(count: number): void {
  activeAuctions.set(count);
}

/**
 * Update active rounds count
 */
export function setActiveRounds(count: number): void {
  activeRounds.set(count);
}

/**
 * Update WebSocket connections count
 */
export function setWebsocketConnections(count: number): void {
  websocketConnections.set(count);
}

/**
 * Record WebSocket message
 */
export function recordWebsocketMessage(type: string, direction: 'in' | 'out'): void {
  websocketMessages.inc({ type, direction });
}

/**
 * Record balance operation
 */
export function recordBalanceOperation(type: string, status: 'success' | 'failed'): void {
  balanceOperations.inc({ type, status });
}

/**
 * Record Redis operation
 */
export function recordRedisOperation(operation: string, status: 'success' | 'failed'): void {
  redisOperations.inc({ operation, status });
}

/**
 * Measure Redis operation time
 */
export function measureRedisOperation(operation: string): () => void {
  const end = redisLatency.startTimer({ operation });
  return () => end();
}

/**
 * Record error
 */
export function recordError(type: string, code?: string): void {
  errorsTotal.inc({ type, code: code || 'unknown' });
}

export { register };
export default {
  metricsMiddleware,
  getMetrics,
  recordBid,
  measureBidProcessing,
  setActiveAuctions,
  setActiveRounds,
  setWebsocketConnections,
  recordWebsocketMessage,
  recordBalanceOperation,
  recordRedisOperation,
  measureRedisOperation,
  recordError,
};
