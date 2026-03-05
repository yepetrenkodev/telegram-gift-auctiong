import { Router } from 'express';
import { auctionController } from '../controllers';
import { authMiddleware, optionalAuthMiddleware } from '../middleware';

const router = Router();

// ==================== PUBLIC ROUTES ====================

// Get active auctions
router.get('/active', optionalAuthMiddleware, auctionController.getActiveAuctions);

// Get upcoming auctions
router.get('/upcoming', optionalAuthMiddleware, auctionController.getUpcomingAuctions);

// Get all auctions with filtering
router.get('/', optionalAuthMiddleware, auctionController.getAllAuctions);

// Get auction by ID
router.get('/:auctionId', optionalAuthMiddleware, auctionController.getAuction);

// Get current round for an auction
router.get('/:auctionId/round', optionalAuthMiddleware, auctionController.getCurrentRound);

// Get auction leaderboard
router.get('/:auctionId/leaderboard', optionalAuthMiddleware, auctionController.getLeaderboard);

// ==================== PROTECTED ROUTES ====================

// Create auction (admin)
router.post('/', authMiddleware, auctionController.createAuction);

// Start auction (admin)
router.post('/:auctionId/start', authMiddleware, auctionController.startAuction);

// Pause auction (admin)
router.post('/:auctionId/pause', authMiddleware, auctionController.pauseAuction);

// Cancel auction (admin)
router.post('/:auctionId/cancel', authMiddleware, auctionController.cancelAuction);

export default router;
