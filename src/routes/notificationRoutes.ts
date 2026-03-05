import { Router, Response } from 'express';
import { notificationService, NotificationType } from '../services/NotificationService';
import { authMiddleware, asyncHandler, AuthRequest } from '../middleware';

// Helper function
const createResponse = (data: unknown, error?: string) => ({
  success: !error,
  data,
  error,
  timestamp: new Date(),
});

/**
 * 🔔 Notification Routes
 * 
 * Управление уведомлениями пользователя
 */

const router = Router();

// Все роуты требуют авторизации
router.use(authMiddleware);

/**
 * GET /api/notifications
 * Получить уведомления пользователя
 */
router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    
    const {
      unreadOnly = 'false',
      type,
      page = '1',
      limit = '20',
    } = req.query;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    
    const result = await notificationService.getNotifications(userId, {
      limit: parseInt(limit as string),
      skip,
      unreadOnly: unreadOnly === 'true',
      type: type as NotificationType,
    });

    res.json(createResponse({
      notifications: result.notifications,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total: result.total,
        totalPages: Math.ceil(result.total / parseInt(limit as string)),
      },
      unreadCount: result.unread,
    }));
  })
);

/**
 * GET /api/notifications/unread/count
 * Получить количество непрочитанных
 */
router.get(
  '/unread/count',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    const count = await notificationService.getUnreadCount(userId);
    res.json(createResponse({ unread: count }));
  })
);

/**
 * POST /api/notifications/read
 * Пометить уведомления как прочитанные
 */
router.post(
  '/read',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    const { notificationIds } = req.body;

    if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
      return res.status(400).json(createResponse(null, 'notificationIds is required'));
    }

    const count = await notificationService.markAsRead(userId, notificationIds);
    const unread = await notificationService.getUnreadCount(userId);

    res.json(createResponse({
      markedAsRead: count,
      unreadCount: unread,
    }));
  })
);

/**
 * POST /api/notifications/read-all
 * Пометить все как прочитанные
 */
router.post(
  '/read-all',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    const count = await notificationService.markAllAsRead(userId);

    res.json(createResponse({
      markedAsRead: count,
      unreadCount: 0,
    }));
  })
);

/**
 * DELETE /api/notifications/:id
 * Удалить уведомление
 */
router.delete(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    const { id } = req.params;

    const deleted = await notificationService.delete(userId, id);
    
    if (!deleted) {
      return res.status(404).json(createResponse(null, 'Notification not found'));
    }

    res.json(createResponse({ deleted: true }));
  })
);

/**
 * GET /api/notifications/settings
 * Получить настройки уведомлений
 */
router.get(
  '/settings',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    const settings = await notificationService.getSettings(userId);
    res.json(createResponse(settings));
  })
);

/**
 * PUT /api/notifications/settings
 * Обновить настройки уведомлений
 */
router.put(
  '/settings',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    const updates = req.body;

    // Валидация
    const allowedFields = [
      'pushEnabled',
      'telegramEnabled',
      'emailEnabled',
      'bidOutbid',
      'bidWon',
      'auctionStarting',
      'auctionEnding',
      'watchlistUpdates',
      'autobidAlerts',
      'balanceAlerts',
      'systemAnnouncements',
      'dailySummary',
      'quietHoursEnabled',
      'quietHoursStart',
      'quietHoursEnd',
      'minIntervalSeconds',
    ];

    const filteredUpdates: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (key in updates) {
        filteredUpdates[key] = updates[key];
      }
    }

    const settings = await notificationService.updateSettings(userId, filteredUpdates);
    res.json(createResponse(settings));
  })
);

/**
 * POST /api/notifications/test
 * Отправить тестовое уведомление (для отладки)
 */
router.post(
  '/test',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    
    await notificationService.send(userId, {
      type: NotificationType.SYSTEM_ANNOUNCEMENT,
      title: 'Тестовое уведомление',
      message: 'Если вы видите это сообщение, уведомления работают! 🎉',
      icon: '🧪',
      priority: 'normal' as 'normal',
    });

    res.json(createResponse({ sent: true, message: 'Test notification sent' }));
  })
);

export default router;
