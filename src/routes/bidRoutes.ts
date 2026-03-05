import { Router } from 'express';
import { bidController } from '../controllers';
import { authMiddleware, optionalAuthMiddleware, idempotencyMiddleware, bidRateLimiter } from '../middleware';

const router = Router();

// ==================== PUBLIC ROUTES ====================

// Get top bids in a round
router.get('/round/:roundId/top', optionalAuthMiddleware, bidController.getTopBids);

// Get minimum bid amount
router.get('/round/:roundId/minimum', optionalAuthMiddleware, bidController.getMinimumBid);

// Get round statistics
router.get('/round/:roundId/stats', optionalAuthMiddleware, bidController.getRoundStats);

// Get all bids in a round
router.get('/round/:roundId', optionalAuthMiddleware, bidController.getAllRoundBids);

// ==================== PROTECTED ROUTES ====================

// Place a bid
router.post('/', authMiddleware, bidRateLimiter, idempotencyMiddleware, bidController.placeBid);

// Refund non-winning bids in a round (admin/manual)
router.post('/round/:roundId/refund', authMiddleware, bidController.refundRoundBids);

// Get user's current bid in a round
router.get('/round/:roundId/my-bid', authMiddleware, bidController.getUserBidInRound);

// Check winning status
router.get('/round/:roundId/winning-status', authMiddleware, bidController.checkWinningStatus);

// Get user's bid history
router.get('/history', authMiddleware, bidController.getUserBidHistory);

// ==================== QUICK BID ====================

// Quick bid - быстрые ставки
router.post('/quick', authMiddleware, bidRateLimiter, idempotencyMiddleware, bidController.quickBid);

// Get quick bid options
router.get('/round/:roundId/quick-options', optionalAuthMiddleware, bidController.getQuickBidOptions);

export default router;
