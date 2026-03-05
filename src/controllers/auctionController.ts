import { Response } from 'express';
import { AuthRequest, asyncHandler } from '../middleware';
import { auctionService } from '../services';
import { AuctionStatus } from '../types';
import logger from '../utils/logger';

/**
 * 🎯 Auction Controller
 */
export const auctionController = {
  /**
   * Get all active auctions
   */
  getActiveAuctions: asyncHandler(async (_req: AuthRequest, res: Response) => {
    const auctions = await auctionService.getActiveAuctions();

    res.json({
      success: true,
      data: auctions,
      timestamp: new Date(),
    });
  }),

  /**
   * Get upcoming auctions
   */
  getUpcomingAuctions: asyncHandler(async (_req: AuthRequest, res: Response) => {
    const auctions = await auctionService.getUpcomingAuctions();

    res.json({
      success: true,
      data: auctions,
      timestamp: new Date(),
    });
  }),

  /**
   * Get auction by ID with current round
   */
  getAuction: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { auctionId } = req.params;

    const result = await auctionService.getAuctionWithCurrentRound(auctionId);

    if (!result) {
      res.status(404).json({
        success: false,
        error: 'Auction not found',
        timestamp: new Date(),
      });
      return;
    }

    res.json({
      success: true,
      data: result,
      timestamp: new Date(),
    });
  }),

  /**
   * Create a new auction (admin only)
   */
  createAuction: asyncHandler(async (req: AuthRequest, res: Response) => {
    const {
      title,
      description,
      gift,
      totalGifts,
      totalRounds,
      giftsPerRound,
      minBidAmount,
      bidIncrement,
      scheduledStartAt,
      antiSnipeThresholdSeconds,
      antiSnipeExtensionSeconds,
      maxAntiSnipeExtensions,
    } = req.body;

    // Validate required fields
    if (!title || !description || !gift || !totalGifts || !totalRounds || !giftsPerRound) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields',
        timestamp: new Date(),
      });
      return;
    }

    const auction = await auctionService.createAuction({
      title,
      description,
      gift,
      totalGifts,
      totalRounds,
      giftsPerRound,
      minBidAmount,
      bidIncrement,
      scheduledStartAt: scheduledStartAt ? new Date(scheduledStartAt) : undefined,
      antiSnipeThresholdSeconds,
      antiSnipeExtensionSeconds,
      maxAntiSnipeExtensions,
    });

    logger.info(`Auction created: ${auction._id} by user ${req.userId}`);

    res.status(201).json({
      success: true,
      data: auction,
      timestamp: new Date(),
    });
  }),

  /**
   * Start an auction (admin only)
   */
  startAuction: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { auctionId } = req.params;

    const auction = await auctionService.startAuction(auctionId);

    logger.info(`Auction started: ${auctionId} by user ${req.userId}`);

    res.json({
      success: true,
      data: auction,
      message: 'Auction started successfully',
      timestamp: new Date(),
    });
  }),

  /**
   * Pause an auction (admin only)
   */
  pauseAuction: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { auctionId } = req.params;

    const auction = await auctionService.pauseAuction(auctionId);

    logger.info(`Auction paused: ${auctionId} by user ${req.userId}`);

    res.json({
      success: true,
      data: auction,
      message: 'Auction paused',
      timestamp: new Date(),
    });
  }),

  /**
   * Cancel an auction (admin only)
   */
  cancelAuction: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { auctionId } = req.params;

    const auction = await auctionService.cancelAuction(auctionId);

    logger.info(`Auction cancelled: ${auctionId} by user ${req.userId}`);

    res.json({
      success: true,
      data: auction,
      message: 'Auction cancelled',
      timestamp: new Date(),
    });
  }),

  /**
   * Get auction leaderboard
   */
  getLeaderboard: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { auctionId } = req.params;
    const limit = parseInt(req.query.limit as string) || 100;

    const leaderboard = await auctionService.getAuctionLeaderboard(auctionId, limit);

    res.json({
      success: true,
      data: leaderboard,
      timestamp: new Date(),
    });
  }),

  /**
   * Get all auctions with filtering
   */
  getAllAuctions: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { status, page = 1, limit = 20 } = req.query;

    const query: Record<string, unknown> = {};
    if (status) {
      query.status = status as AuctionStatus;
    }

    const { Auction } = await import('../models');
    const skip = (Number(page) - 1) * Number(limit);

    const [auctions, total] = await Promise.all([
      Auction.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Auction.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: auctions,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
      timestamp: new Date(),
    });
  }),

  /**
   * Get current round for an auction
   */
  getCurrentRound: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { auctionId } = req.params;

    const round = await auctionService.getCurrentRound(auctionId);

    if (!round) {
      res.status(404).json({
        success: false,
        error: 'No active round found',
        timestamp: new Date(),
      });
      return;
    }

    res.json({
      success: true,
      data: round,
      timestamp: new Date(),
    });
  }),
};

export default auctionController;
