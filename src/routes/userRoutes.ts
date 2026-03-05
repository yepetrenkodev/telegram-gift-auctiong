import { Router } from 'express';
import { userController } from '../controllers';
import { authMiddleware, optionalAuthMiddleware } from '../middleware';

const router = Router();

// ==================== PUBLIC ROUTES ====================

// Telegram auth (register/login)
router.post('/auth/telegram', userController.authTelegram);

// Get leaderboard
router.get('/leaderboard', optionalAuthMiddleware, userController.getLeaderboard);

// Get user by ID (public profile)
router.get('/:userId', optionalAuthMiddleware, userController.getUserById);

// Получить все доступные ачивки
router.get('/achievements', userController.getAllAchievements);

// ==================== PROTECTED ROUTES ====================

// Get current user profile
router.get('/me/profile', authMiddleware, userController.getProfile);

// Get user balance
router.get('/me/balance', authMiddleware, userController.getBalance);

// Add funds (demo/testing)
router.post('/me/balance/add', authMiddleware, userController.addFunds);

// Add bonus (admin/system)
router.post('/bonus', authMiddleware, userController.addBonus);

// Transfer funds between users (P2P)
router.post('/me/transfer', authMiddleware, userController.transferFunds);

// Get transaction history
router.get('/me/transactions', authMiddleware, userController.getTransactions);

// Получить все ачивки пользователя
router.get('/me/achievements', authMiddleware, userController.getUserAchievements);

export default router;
