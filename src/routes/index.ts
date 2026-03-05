import { Router } from 'express';
import auctionRoutes from './auctionRoutes';
import bidRoutes from './bidRoutes';
import userRoutes from './userRoutes';
import realtimeRoutes from './realtimeRoutes';
import clientRoutes from './clientRoutes';
import autoBidRoutes from './autoBidRoutes';
import stressTestRoutes from './stressTestRoutes';
import watchlistRoutes from './watchlistRoutes';
import activityRoutes from './activityRoutes';
import searchRoutes from './searchRoutes';
import healthRoutes from './healthRoutes';
import filterRoutes from './filterRoutes';
import myGiftsRoutes from './myGiftsRoutes';
import notificationRoutes from './notificationRoutes';
import { getMetrics } from '../services/MetricsService';

const router = Router();

// Health check routes
router.use('/health', healthRoutes);

// Prometheus metrics endpoint
router.get('/metrics', getMetrics);

// Client API routes (for React frontend)
router.use('/', clientRoutes);

// Mount routes
router.use('/auctions', auctionRoutes);
router.use('/bids', bidRoutes);
router.use('/users', userRoutes);
router.use('/realtime', realtimeRoutes);
router.use('/autobid', autoBidRoutes);
router.use('/stress-test', stressTestRoutes);
router.use('/watchlist', watchlistRoutes);
router.use('/activity', activityRoutes);
router.use('/search', searchRoutes);

// 🆕 New routes
router.use('/filters', filterRoutes);        // Fragment-style filters
router.use('/my', myGiftsRoutes);            // My gifts & participations
router.use('/notifications', notificationRoutes);  // Notifications

export default router;
