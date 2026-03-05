import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { redisService } from '../services/RedisService';
import { socketService } from '../services/SocketService';
import { timerService } from '../services/TimerService';
import logger from '../utils/logger';

const router = Router();

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  uptime: number;
  version: string;
  services: {
    mongodb: ServiceHealth;
    redis: ServiceHealth;
    socketio: ServiceHealth;
    timers: ServiceHealth;
  };
  system: {
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    cpu: NodeJS.CpuUsage;
  };
}

interface ServiceHealth {
  status: 'up' | 'down' | 'degraded';
  latency?: number;
  details?: Record<string, unknown>;
}

const startTime = Date.now();

/**
 * GET /api/health
 * Basic health check - returns 200 if server is running
 */
router.get('/', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date(),
    uptime: Math.floor((Date.now() - startTime) / 1000),
  });
});

/**
 * GET /api/health/live
 * Kubernetes liveness probe - is the server alive?
 */
router.get('/live', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'alive' });
});

/**
 * GET /api/health/ready
 * Kubernetes readiness probe - is the server ready to accept traffic?
 */
router.get('/ready', async (_req: Request, res: Response) => {
  const mongoReady = mongoose.connection.readyState === 1;
  const redisReady = redisService.isAvailable();
  
  if (mongoReady) {
    res.status(200).json({ 
      status: 'ready',
      mongodb: mongoReady,
      redis: redisReady,
    });
  } else {
    res.status(503).json({ 
      status: 'not ready',
      mongodb: mongoReady,
      redis: redisReady,
    });
  }
});

/**
 * GET /api/health/detailed
 * Detailed health check with all services status
 */
router.get('/detailed', async (_req: Request, res: Response) => {
  const health: HealthStatus = {
    status: 'healthy',
    timestamp: new Date(),
    uptime: Math.floor((Date.now() - startTime) / 1000),
    version: '2.0.0',
    services: {
      mongodb: await checkMongoDB(),
      redis: await checkRedis(),
      socketio: checkSocketIO(),
      timers: checkTimers(),
    },
    system: {
      memory: getMemoryUsage(),
      cpu: process.cpuUsage(),
    },
  };

  // Determine overall status
  const serviceStatuses = Object.values(health.services);
  if (serviceStatuses.some(s => s.status === 'down')) {
    health.status = 'unhealthy';
  } else if (serviceStatuses.some(s => s.status === 'degraded')) {
    health.status = 'degraded';
  }

  const statusCode = health.status === 'healthy' ? 200 : 
                     health.status === 'degraded' ? 200 : 503;

  res.status(statusCode).json(health);
});

/**
 * Check MongoDB connection
 */
async function checkMongoDB(): Promise<ServiceHealth> {
  const start = Date.now();
  
  try {
    if (mongoose.connection.readyState !== 1) {
      return { status: 'down', details: { state: 'disconnected' } };
    }

    // Ping the database
    await mongoose.connection.db?.admin().ping();
    
    return {
      status: 'up',
      latency: Date.now() - start,
      details: {
        host: mongoose.connection.host,
        name: mongoose.connection.name,
      },
    };
  } catch (error) {
    logger.error('MongoDB health check failed:', error);
    return { 
      status: 'down', 
      latency: Date.now() - start,
      details: { error: error instanceof Error ? error.message : 'Unknown error' },
    };
  }
}

/**
 * Check Redis connection
 */
async function checkRedis(): Promise<ServiceHealth> {
  const start = Date.now();
  
  try {
    if (!redisService.isAvailable()) {
      return { status: 'degraded', details: { state: 'unavailable' } };
    }

    // Ping Redis
    await redisService.set('health:ping', Date.now(), 10);
    
    return {
      status: 'up',
      latency: Date.now() - start,
    };
  } catch (error) {
    logger.error('Redis health check failed:', error);
    return { 
      status: 'degraded', 
      latency: Date.now() - start,
      details: { error: error instanceof Error ? error.message : 'Unknown error' },
    };
  }
}

/**
 * Check Socket.IO status
 */
function checkSocketIO(): ServiceHealth {
  const io = socketService.getIO();
  
  if (!io) {
    return { status: 'down', details: { state: 'not initialized' } };
  }

  return {
    status: 'up',
    details: {
      connections: socketService.getConnectedCount(),
    },
  };
}

/**
 * Check Timer Service status
 */
function checkTimers(): ServiceHealth {
  const activeTimers = timerService.getActiveTimersCount();
  
  return {
    status: 'up',
    details: {
      activeTimers,
    },
  };
}

/**
 * Get memory usage
 */
function getMemoryUsage(): { used: number; total: number; percentage: number } {
  const usage = process.memoryUsage();
  const total = require('os').totalmem();
  const used = usage.heapUsed;
  
  return {
    used: Math.round(used / 1024 / 1024), // MB
    total: Math.round(total / 1024 / 1024), // MB
    percentage: Math.round((used / total) * 100),
  };
}

export default router;
