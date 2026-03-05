import { Router, Response } from 'express';
import { AuthRequest, optionalAuthMiddleware, authMiddleware, telegramAuthMiddleware } from '../middleware';
import { Auction, User, Bid, Round, Balance, Gift } from '../models';
import { socketService } from '../services/SocketService';

const router = Router();

/**
 * 🎨 Client API - Simplified endpoints for React frontend
 */

// Helper to get user with balance
async function getUserWithBalance(telegramId: string) {
  const user = await User.findOne({ telegramId }).lean() as any;
  if (!user) return null;
  
  const balance = await Balance.findOne({ userId: user._id.toString() }).lean() as any;
  return {
    ...user,
    balance: balance?.available || 0,
    lockedBalance: balance?.locked || 0,
    totalBalance: (balance?.available || 0) + (balance?.locked || 0)
  };
}

// Get auctions in client-friendly format with filtering and sorting
router.get('/auctions', optionalAuthMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { 
      status = 'active',
      collection,
      model,
      backdrop,
      symbol,
      rarity,
      sort = 'ending', // ending, price-high, price-low, popular, newest
      limit = '20',
      offset = '0'
    } = req.query;

    const query: any = {};
    
    // Status filter
    if (status === 'active') {
      query.status = 'active';
      // Also filter out auctions that have expired but not yet marked completed
      query.endsAt = { $gt: new Date() };
    } else if (status === 'scheduled') {
      query.status = 'scheduled';
    } else if (status === 'completed') {
      query.status = 'completed';
    }

    // Gift attribute filters (Fragment-style)
    if (collection) query['gift.giftCollection'] = collection;
    if (model) query['gift.model'] = model;
    if (backdrop) query['gift.backdrop'] = backdrop;
    if (symbol) query['gift.symbol'] = symbol;
    if (rarity) query['gift.rarity'] = rarity;

    // Sorting options
    let sortOption: any = { endsAt: 1 }; // default: ending soon first
    switch (sort) {
      case 'price-high':
        sortOption = { highestBid: -1 };
        break;
      case 'price-low':
        sortOption = { highestBid: 1 };
        break;
      case 'popular':
        sortOption = { totalBids: -1 };
        break;
      case 'newest':
        sortOption = { createdAt: -1 };
        break;
    }

    const auctions = await Auction.find(query)
      .sort(sortOption)
      .skip(parseInt(offset as string))
      .limit(parseInt(limit as string))
      .lean();

    // Get total count for pagination
    const totalCount = await Auction.countDocuments(query);

    // Get recent bids for each auction
    const auctionsWithDetails = await Promise.all(auctions.map(async (auction: any) => {
      const bids = await Bid.find({ auctionId: auction._id.toString() })
        .sort({ amount: -1, placedAt: 1 })
        .limit(10)
        .lean();

      // Get bidder info separately
      const bidsWithUsers = await Promise.all(bids.map(async (bid: any) => {
        const bidUser = await User.findById(bid.userId).lean() as any;
        return {
          id: bid._id.toString(),
          bidderId: bid.userId?.toString() || '',
          bidderName: bidUser?.firstName || 'Anonymous',
          amount: bid.amount,
          createdAt: bid.placedAt || bid.createdAt
        };
      }));

      return {
        id: auction._id.toString(),
        gift: {
          id: auction.gift?.id || auction._id.toString(),
          name: auction.gift?.name || auction.title || 'Gift',
          imageUrl: auction.gift?.imageUrl,
          rarity: auction.gift?.rarity || 'common',
          description: auction.gift?.description || auction.description,
          // Fragment-style attributes
          model: auction.gift?.model,
          backdrop: auction.gift?.backdrop,
          symbol: auction.gift?.symbol,
          giftCollection: auction.gift?.giftCollection,
          number: auction.gift?.number,
          timesSold: auction.gift?.timesSold || 0
        },
        startingPrice: auction.minBidAmount || 100,
        currentPrice: auction.highestBid || auction.minBidAmount || 100,
        incrementAmount: auction.bidIncrement || 10,
        endTime: auction.endsAt || new Date(Date.now() + 3600000),
        status: auction.status || 'active',
        totalBids: auction.totalBids || 0,
        bids: bidsWithUsers
      };
    }));

    res.json({ 
      auctions: auctionsWithDetails,
      pagination: {
        total: totalCount,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        hasMore: (parseInt(offset as string) + auctionsWithDetails.length) < totalCount
      }
    });
  } catch (error) {
    console.error('Error fetching auctions:', error);
    res.status(500).json({ error: 'Failed to fetch auctions' });
  }
});

// Get single auction
router.get('/auctions/:id', optionalAuthMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const auction = await Auction.findById(req.params.id).lean() as any;

    if (!auction) {
      res.status(404).json({ error: 'Auction not found' });
    }

    const bids = await Bid.find({ auctionId: auction._id.toString() })
      .sort({ amount: -1, placedAt: 1 })
      .limit(50)
      .lean();

    // Get bidder info
    const bidsWithUsers = await Promise.all(bids.map(async (bid: any) => {
      const bidUser = await User.findById(bid.userId).lean() as any;
      return {
        id: bid._id.toString(),
        bidderId: bid.userId?.toString() || '',
        bidderName: bidUser?.firstName || 'Anonymous',
        bidderPhoto: bidUser?.photoUrl,
        amount: bid.amount,
        createdAt: bid.placedAt || bid.createdAt
      };
    }));

    const result = {
      id: auction._id.toString(),
      gift: {
        id: auction.gift?.id || auction._id.toString(),
        name: auction.gift?.name || auction.title || 'Gift',
        imageUrl: auction.gift?.imageUrl,
        rarity: auction.gift?.rarity || 'common',
        description: auction.gift?.description || auction.description
      },
      startingPrice: auction.minBidAmount || 100,
      currentPrice: auction.highestBid || auction.minBidAmount || 100,
      incrementAmount: auction.bidIncrement || 10,
      endTime: auction.endsAt || new Date(Date.now() + 3600000),
      status: auction.status || 'active',
      totalBids: auction.totalBids || 0,
      bids: bidsWithUsers
    };

    res.json({ auction: result });
  } catch (error) {
    console.error('Error fetching auction:', error);
    res.status(500).json({ error: 'Failed to fetch auction' });
  }
});

// Get leaderboard
router.get('/leaderboard/:type', async (req: AuthRequest, res: Response) => {
  try {
    const { type } = req.params;

    // Get top users by totalSpent
    const users = await User.find({})
      .sort({ 'stats.totalSpent': -1 })
      .limit(100)
      .lean();

    const leaderboard = users.map((user: any, index: number) => ({
      id: user._id.toString(),
      rank: index + 1,
      name: user.firstName + (user.lastName ? ' ' + user.lastName : ''),
      photoUrl: user.photoUrl,
      score: user.stats?.totalSpent || 0,
      wins: user.stats?.totalWins || 0,
      isCurrentUser: user.telegramId === '123456789'
    }));

    res.json({ leaderboard });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// Auth endpoint - create/get user
router.post('/auth/telegram', async (req: AuthRequest, res: Response) => {
  try {
    const { initData } = req.body;

    // For development, get or create test user
    let user = await getUserWithBalance('123456789');

    if (!user) {
      // Create user
      const newUser = await User.create({
        telegramId: '123456789',
        firstName: 'Test',
        lastName: 'User',
        username: 'testuser',
        stats: {
          totalBids: 0,
          totalWins: 0,
          totalSpent: 0
        }
      });
      
      // Create balance
      await Balance.create({
        userId: newUser._id.toString(),
        available: 5000,
        locked: 0
      });

      user = await getUserWithBalance('123456789');
    }

    res.json({
      user: {
        id: user!._id.toString(),
        telegramId: user!.telegramId,
        username: user!.username,
        firstName: user!.firstName,
        lastName: user!.lastName,
        photoUrl: user!.photoUrl,
        balance: user!.balance,
        tonBalance: 25, // Mock TON balance
        totalSpent: user!.stats?.totalSpent || 0,
        totalWins: user!.stats?.totalWins || 0
      }
    });
  } catch (error) {
    console.error('Error in auth:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// Place bid
router.post('/auctions/:id/bid', optionalAuthMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { amount } = req.body;
    const auctionId = req.params.id;

    // Get auction
    const auction = await Auction.findById(auctionId) as any;
    if (!auction) {
      res.status(404).json({ error: 'Auction not found' });
      return;
    }

    // Check if auction has ended by time
    const now = new Date();
    const endsAt = auction.endsAt ? new Date(auction.endsAt) : null;
    
    if (endsAt && endsAt <= now) {
      // Auto-complete auction if time expired
      if (auction.status === 'active') {
        auction.status = 'completed';
        auction.completedAt = now;
        await auction.save();
      }
      return res.status(400).json({ error: 'Аукцион завершён. Время вышло!' });
    }

    // Check if bid is in the last second - not allowed!
    if (endsAt) {
      const timeLeftMs = endsAt.getTime() - now.getTime();
      if (timeLeftMs <= 1000) { // 1 second or less
        return res.status(400).json({ error: 'Нельзя ставить в последнюю секунду!' });
      }
    }

    if (auction.status !== 'active') {
      return res.status(400).json({ error: 'Аукцион не активен' });
    }

    // Get user - support both authenticated users, bots, and dev mode
    let user: any = null;
    
    // 1. Check if user is authenticated via middleware
    if (req.userId) {
      user = await User.findById(req.userId);
    }
    
    // 2. Check for X-Dev-User-Id header (for stress test bots)
    if (!user && req.headers['x-dev-user-id']) {
      user = await User.findById(req.headers['x-dev-user-id'] as string);
    }
    
    // 3. Fallback to test user for development
    if (!user) {
      user = await User.findOne({ telegramId: '123456789' });
    }
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Get or create balance for user
    let userBalance = await Balance.findOne({ userId: user._id.toString() }) as any;
    if (!userBalance) {
      // Create balance for bots/new users with default amount
      userBalance = await Balance.create({
        userId: user._id.toString(),
        available: 100000, // Default bot balance
        reserved: 0
      });
    }

    const currentPrice = auction.highestBid || auction.minBidAmount || 100;

    // Check balance
    if (userBalance.available < amount) {
      return res.status(400).json({ error: `Insufficient balance. You have ${userBalance.available} ⭐` });
    }

    // Check bid amount
    if (amount <= currentPrice) {
      return res.status(400).json({ error: `Bid must be higher than current price (${currentPrice} ⭐)` });
    }

    // Find or create round for this auction
    let round = await Round.findOne({ 
      auctionId: auction._id.toString(), 
      status: 'active' 
    }) as any;
    
    if (!round) {
      // Create a default round for the auction
      round = await Round.create({
        auctionId: auction._id.toString(),
        roundNumber: 1,
        status: 'active',
        giftsAvailable: auction.totalGifts || 1,
        startsAt: auction.scheduledStartAt || new Date(),
        endsAt: auction.endsAt || new Date(Date.now() + 3600000),
        originalEndsAt: auction.endsAt || new Date(Date.now() + 3600000)
      });
    }

    // Find THE SINGLE highest active bid in this round
    const highestBid = await Bid.findOne({ 
      roundId: round._id.toString(), 
      status: 'active' 
    }).sort({ amount: -1 });
    
    // Check if user is already the highest bidder
    if (highestBid && highestBid.userId.toString() === user._id.toString()) {
      return res.status(400).json({ 
        error: 'Вы уже лидер! Подождите пока вашу ставку перебьют.' 
      });
    }

    // If there's a current leader (highest bidder), refund them ONCE
    let outbidUserId: string | null = null;
    let outbidAmount: number = 0;
    
    if (highestBid) {
      outbidUserId = highestBid.userId.toString();
      outbidAmount = highestBid.amount;
      
      // Mark their bid as outbid
      highestBid.status = 'outbid';
      await highestBid.save();
      
      // Refund their balance - only the highest bid amount
      const outbidUserBalance = await Balance.findOne({ userId: outbidUserId });
      if (outbidUserBalance) {
        outbidUserBalance.available += outbidAmount;
        await outbidUserBalance.save();
        
        console.log(`Refunded ${outbidAmount} to user ${outbidUserId} (outbid)`);
      }
    }

    // Check user's balance
    const currentBalance = await Balance.findOne({ userId: user._id.toString() }) as any;
    if (currentBalance.available < amount) {
      return res.status(400).json({ error: `Недостаточно средств. У вас ${currentBalance.available} ⭐` });
    }

    // Create new bid
    const bid = await Bid.create({
      auctionId: auction._id.toString(),
      roundId: round._id.toString(),
      userId: user._id.toString(),
      amount,
      status: 'active',
      placedAt: new Date()
    });

    // Deduct from user balance
    currentBalance.available -= amount;
    await currentBalance.save();

    // Update round stats
    round.totalBids = (round.totalBids || 0) + 1;
    await round.save();

    // Update auction
    auction.highestBid = amount;
    auction.totalBids = (auction.totalBids || 0) + 1;
    await auction.save();

    // Update user stats
    user.stats = user.stats || {};
    user.stats.totalSpent = (user.stats.totalSpent || 0) + amount;
    user.stats.totalBids = (user.stats.totalBids || 0) + 1;
    await user.save();

    // Anti-sniping: extend auction if bid is placed in last 60 seconds
    let extended = false;
    let newEndsAt = auction.endsAt;
    const currentEndsAt = new Date(auction.endsAt);
    const bidTime = new Date();
    const timeLeftMs = currentEndsAt.getTime() - bidTime.getTime();
    
    if (timeLeftMs <= 60000 && timeLeftMs > 1000) { // Between 1 second and 60 seconds left
      // Add 30 seconds
      newEndsAt = new Date(currentEndsAt.getTime() + 30000);
      auction.endsAt = newEndsAt;
      await auction.save();
      
      // Also update round endsAt
      round.endsAt = newEndsAt;
      round.extensionCount = (round.extensionCount || 0) + 1;
      await round.save();
      
      extended = true;
      console.log(`Anti-snipe triggered! Extended auction to ${newEndsAt}`);
    }

    // Broadcast bid placed event via WebSocket (includes outbid info)
    socketService.broadcastBidPlaced({
      auctionId: auction._id.toString(),
      roundNumber: round.roundNumber || 1,
      bid: {
        id: bid._id.toString(),
        bidderId: user._id.toString(),
        bidderName: user.firstName || 'Anonymous',
        amount,
        createdAt: bid.placedAt.toISOString()
      },
      amount,
      bidderName: user.firstName || 'Anonymous',
      bidderId: user._id.toString(),
      newHighestBid: amount,
      totalBids: auction.totalBids,
      extended,
      newEndsAt: extended ? newEndsAt : undefined,
      // Info about who was outbid (so they can update their balance)
      outbidUserId: outbidUserId || undefined,
      outbidAmount: outbidAmount || undefined
    });

    res.json({
      success: true,
      bid: {
        id: bid._id.toString(),
        amount,
        createdAt: bid.placedAt
      },
      newPrice: amount,
      newBalance: currentBalance.available,
      extended,
      newEndsAt: extended ? newEndsAt : undefined
    });
  } catch (error) {
    console.error('Error placing bid:', error);
    res.status(500).json({ error: 'Failed to place bid' });
  }
});

// Get user bids
router.get('/users/me/bids', optionalAuthMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findOne({ telegramId: '123456789' });
    if (!user) {
      return res.json({ bids: [] });
    }

    const bids = await Bid.find({ userId: user._id.toString() })
      .sort({ placedAt: -1 })
      .limit(50)
      .lean();

    const bidsWithAuctions = await Promise.all(bids.map(async (bid: any) => {
      const auction = await Auction.findById(bid.auctionId).lean() as any;
      return {
        id: bid._id.toString(),
        amount: bid.amount,
        createdAt: bid.placedAt || bid.createdAt,
        auctionId: bid.auctionId,
        auctionName: auction?.gift?.name || auction?.title || 'Auction',
        isWinning: auction?.highestBid === bid.amount
      };
    }));

    res.json({ bids: bidsWithAuctions });
  } catch (error) {
    console.error('Error fetching user bids:', error);
    res.status(500).json({ error: 'Failed to fetch bids' });
  }
});

// Get user wins
router.get('/users/me/wins', optionalAuthMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findOne({ telegramId: '123456789' });
    if (!user) {
      return res.json({ auctions: [] });
    }

    // Find auctions where user has won (completed auctions where user has highest bid)
    const auctions = await Auction.find({
      status: 'completed'
    })
      .sort({ endsAt: -1 })
      .limit(20)
      .lean();

    // Filter to only auctions where this user won
    const winningAuctions = [];
    for (const auction of auctions as any[]) {
      const highestBid = await Bid.findOne({ auctionId: auction._id.toString() })
        .sort({ amount: -1 })
        .lean() as any;

      if (highestBid && highestBid.userId === user._id.toString()) {
        winningAuctions.push({
          id: auction._id.toString(),
          gift: {
            id: auction.gift?.id || auction._id.toString(),
            name: auction.gift?.name || auction.title || 'Gift',
            imageUrl: auction.gift?.imageUrl,
            rarity: auction.gift?.rarity || 'common'
          },
          currentPrice: auction.highestBid || highestBid.amount,
          endTime: auction.endsAt,
          status: 'completed',
          totalBids: auction.totalBids || 0,
          bids: []
        });
      }
    }

    res.json({ auctions: winningAuctions });
  } catch (error) {
    console.error('Error fetching user wins:', error);
    res.status(500).json({ error: 'Failed to fetch wins' });
  }
});

// Get gifts (return unique gifts from auctions)
router.get('/gifts', async (_req: AuthRequest, res: Response) => {
  try {
    const auctions = await Auction.find({}).lean();

    // Extract unique gifts from auctions
    const giftsMap = new Map();
    for (const auction of auctions as any[]) {
      if (auction.gift?.id) {
        giftsMap.set(auction.gift.id, {
          id: auction.gift.id,
          name: auction.gift.name,
          imageUrl: auction.gift.imageUrl,
          rarity: auction.gift.rarity,
          description: auction.gift.description,
          basePrice: auction.minBidAmount
        });
      }
    }

    res.json({ gifts: Array.from(giftsMap.values()) });
  } catch (error) {
    console.error('Error fetching gifts:', error);
    res.status(500).json({ error: 'Failed to fetch gifts' });
  }
});

// Payment endpoints (mock with fake delay to simulate real payment)
router.post('/payments/stars', async (req: AuthRequest, res: Response) => {
  try {
    const { amount } = req.body;
    
    // Get user ID from dev header or find test user
    let userId = req.headers['x-dev-user-id'] as string;
    
    if (!userId) {
      // Fallback to test user
      const testUser = await User.findOne({ telegramId: '123456789' });
      if (testUser) {
        userId = testUser._id.toString();
      }
    }

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!amount || amount <= 0) {
      res.status(400).json({ error: 'Invalid amount' });
      return;
    }

    // Simulate payment processing delay (1-2 seconds)
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));

    // Add stars to user balance directly (simplified - no transactions)
    let balance = await Balance.findOne({ userId });
    if (!balance) {
      balance = await Balance.create({ userId, available: 0, locked: 0 });
    }
    
    balance.available += amount;
    await balance.save();
    
    console.log(`Added ${amount} stars to user ${userId}. New balance: ${balance.available}`);

    res.json({ 
      success: true, 
      message: `Successfully added ${amount} stars`,
      newBalance: balance.available 
    });
  } catch (error) {
    console.error('Payment error:', error);
    res.status(500).json({ error: 'Payment failed' });
  }
});

router.post('/payments/ton', async (req: AuthRequest, res: Response) => {
  try {
    const { amount, action } = req.body;
    // In production, this would interact with TON wallet
    res.json({ address: 'EQD...TON_ADDRESS' });
  } catch (error) {
    res.status(500).json({ error: 'TON operation failed' });
  }
});

// Check and complete auction
router.post('/auctions/:id/complete', optionalAuthMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const auction = await Auction.findById(req.params.id) as any;
    if (!auction) {
      res.status(404).json({ error: 'Auction not found' });
    }

    const now = new Date();
    
    // Check if auction should be completed
    if (auction.status === 'active' && auction.endsAt && new Date(auction.endsAt) <= now) {
      // Find highest bid
      const winningBid = await Bid.findOne({ auctionId: auction._id.toString() })
        .sort({ amount: -1 })
        .lean() as any;

      // Complete auction
      auction.status = 'completed';
      auction.completedAt = now;
      await auction.save();

      // Get winner info if exists
      let winner = null;
      if (winningBid) {
        const winnerUser = await User.findById(winningBid.userId).lean() as any;
        if (winnerUser) {
          winner = {
            id: winnerUser._id.toString(),
            name: winnerUser.firstName + (winnerUser.lastName ? ' ' + winnerUser.lastName : ''),
            amount: winningBid.amount
          };

          // Update winner stats
          await User.findByIdAndUpdate(winnerUser._id, {
            $inc: { 'stats.totalWins': 1 }
          });

          // Broadcast auction ended event
          socketService.broadcastAuctionEnded({
            auctionId: auction._id.toString(),
            winnerId: winnerUser._id.toString(),
            winnerName: winnerUser.username || winnerUser.firstName,
            finalPrice: winningBid.amount,
            giftName: auction.gift?.name
          });
        }
      }

      return res.json({
        completed: true,
        winner,
        auction: {
          id: auction._id.toString(),
          gift: auction.gift,
          finalPrice: auction.highestBid,
          totalBids: auction.totalBids
        }
      });
    }

    res.json({ 
      completed: auction.status === 'completed',
      timeLeft: auction.endsAt ? Math.max(0, new Date(auction.endsAt).getTime() - now.getTime()) : 0
    });
  } catch (error) {
    console.error('Error completing auction:', error);
    res.status(500).json({ error: 'Failed to complete auction' });
  }
});

// Get auction winner
router.get('/auctions/:id/winner', async (req: AuthRequest, res: Response) => {
  try {
    const auction = await Auction.findById(req.params.id).lean() as any;
    if (!auction) {
      return res.status(404).json({ error: 'Auction not found' });
    }

    if (auction.status !== 'completed') {
      return res.json({ winner: null, status: auction.status });
    }

    // Find winning bid
    const winningBid = await Bid.findOne({ auctionId: auction._id.toString() })
      .sort({ amount: -1 })
      .lean() as any;

    if (!winningBid) {
      return res.json({ winner: null, status: 'completed', noWinner: true, finalPrice: 0, totalBids: 0 });
    }

    const winnerUser = await User.findById(winningBid.userId).lean() as any;
    const currentUserId = req.userId;

    // Response in format expected by frontend
    res.json({
      winner: {
        id: winnerUser?._id?.toString() || '',
        telegramId: winnerUser?.telegramId || 0,
        username: winnerUser?.username || '',
        firstName: winnerUser?.firstName || 'Unknown',
        winningBid: winningBid.amount,
        isCurrentUser: currentUserId ? winnerUser?._id?.toString() === currentUserId : false
      },
      totalBids: auction.totalBids || 0,
      finalPrice: winningBid.amount || auction.highestBid || 0
    });
  } catch (error) {
    console.error('Error getting winner:', error);
    res.status(500).json({ error: 'Failed to get winner' });
  }
});

// ==================== FILTER METADATA ENDPOINTS ====================

// Get available filter options
router.get('/filters', async (_req, res: Response) => {
  try {
    // Get unique values for each filter type from auctions (Fragment-style)
    const [collections, models, backdrops, symbols, rarities] = await Promise.all([
      Auction.distinct('gift.giftCollection'),
      Auction.distinct('gift.model'),
      Auction.distinct('gift.backdrop'),
      Auction.distinct('gift.symbol'),
      Auction.distinct('gift.rarity'),
    ]);

    // Get counts for each filter
    const collectionCounts = await Auction.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: '$gift.giftCollection', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    const rarityCounts = await Auction.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: '$gift.rarity', count: { $sum: 1 } } }
    ]);

    res.json({
      collections: collections.filter(Boolean).map(c => ({
        value: c,
        label: c,
        count: collectionCounts.find(cc => cc._id === c)?.count || 0
      })),
      models: models.filter(Boolean).map(m => ({
        value: m,
        label: m
      })),
      backdrops: backdrops.filter(Boolean).map(b => ({
        value: b,
        label: b
      })),
      symbols: symbols.filter(Boolean).map(s => ({
        value: s,
        label: s
      })),
      rarities: rarities.filter(Boolean).map(r => ({
        value: r,
        label: r.charAt(0).toUpperCase() + r.slice(1),
        count: rarityCounts.find(rc => rc._id === r)?.count || 0
      })),
      sortOptions: [
        { value: 'ending', label: 'Ending Soon' },
        { value: 'price-high', label: 'Price: High to Low' },
        { value: 'price-low', label: 'Price: Low to High' },
        { value: 'popular', label: 'Most Popular' },
        { value: 'newest', label: 'Newest' }
      ]
    });
  } catch (error) {
    console.error('Error fetching filters:', error);
    res.status(500).json({ error: 'Failed to fetch filters' });
  }
});

// Get auction statistics
router.get('/stats', async (_req, res: Response) => {
  try {
    const [totalActive, totalCompleted, totalBids, totalVolume] = await Promise.all([
      Auction.countDocuments({ status: 'active' }),
      Auction.countDocuments({ status: 'completed' }),
      Bid.countDocuments(),
      Auction.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$highestBid' } } }
      ])
    ]);

    res.json({
      activeAuctions: totalActive,
      completedAuctions: totalCompleted,
      totalBids,
      totalVolume: totalVolume[0]?.total || 0
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});


// ==================== USER GIFTS & HISTORY ====================

// Get user's won gifts
router.get('/user/gifts', telegramAuthMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
    }

    // Find all won bids by user
    const wonBids = await Bid.find({
      userId,
      status: 'won'
    }).sort({ createdAt: -1 }).lean() as any[];

    const gifts = await Promise.all(wonBids.map(async (bid) => {
      const auction = await Auction.findById(bid.auctionId).lean() as any;
      return {
        id: bid._id.toString(),
        auctionId: bid.auctionId.toString(),
        gift: {
          name: auction?.gift?.name || 'Unknown',
          description: auction?.gift?.description,
          imageUrl: auction?.gift?.imageUrl,
          rarity: auction?.gift?.rarity || 'common'
        },
        winningBid: bid.amount,
        wonAt: bid.createdAt,
        status: 'claimed' // Default status
      };
    }));

    // Calculate stats
    const stats = {
      total: gifts.length,
      totalSpent: gifts.reduce((sum, g) => sum + g.winningBid, 0),
      byRarity: gifts.reduce((acc, g) => {
        acc[g.gift.rarity] = (acc[g.gift.rarity] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };

    res.json({ gifts, stats });
  } catch (error) {
    console.error('Error fetching user gifts:', error);
    res.status(500).json({ error: 'Failed to fetch gifts' });
  }
});

// Get user's bid history
router.get('/user/bids/history', telegramAuthMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
    }

    // Get all user bids
    const userBids = await Bid.find({ userId })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean() as any[];

    const bids = await Promise.all(userBids.map(async (bid) => {
      const auction = await Auction.findById(bid.auctionId).lean() as any;
      return {
        id: bid._id.toString(),
        auctionId: bid.auctionId.toString(),
        auctionTitle: auction?.title || 'Unknown Auction',
        giftName: auction?.gift?.name || 'Unknown',
        giftRarity: auction?.gift?.rarity || 'common',
        giftImageUrl: auction?.gift?.imageUrl,
        amount: bid.amount,
        status: bid.status || 'active',
        isAutoBid: bid.isAutoBid || false,
        placedAt: bid.createdAt,
        finalPrice: auction?.highestBid
      };
    }));

    // Calculate stats
    const stats = {
      totalBids: bids.length,
      totalAmount: bids.reduce((sum, b) => sum + b.amount, 0),
      wins: bids.filter(b => b.status === 'won').length,
      winRate: bids.length > 0 ? (bids.filter(b => b.status === 'won').length / bids.length) * 100 : 0,
      avgBid: bids.length > 0 ? bids.reduce((sum, b) => sum + b.amount, 0) / bids.length : 0,
      autoBidCount: bids.filter(b => b.isAutoBid).length
    };

    res.json({ bids, stats });
  } catch (error) {
    console.error('Error fetching bid history:', error);
    res.status(500).json({ error: 'Failed to fetch bid history' });
  }
});


// ==================== ANALYTICS & SIMILAR AUCTIONS ====================

// Get similar auctions
router.get('/auctions/similar', async (req, res: Response) => {
  try {
    const { rarity, collection, exclude, limit = 4 } = req.query;
    
    const query: any = { status: 'active' };
    if (exclude) query._id = { $ne: exclude };
    
    // Build OR conditions for similarity
    const orConditions = [];
    if (rarity) orConditions.push({ 'gift.rarity': rarity });
    if (collection) orConditions.push({ 'gift.giftCollection': collection });
    
    if (orConditions.length > 0) {
      query.$or = orConditions;
    }
    
    const auctions = await Auction.find(query)
      .sort({ totalBids: -1, endTime: 1 })
      .limit(Number(limit))
      .lean() as any[];
    
    res.json({
      auctions: auctions.map(a => ({
        id: a._id.toString(),
        title: a.title,
        gift: {
          name: a.gift?.name,
          imageUrl: a.gift?.imageUrl,
          rarity: a.gift?.rarity || 'common',
          giftCollection: a.gift?.giftCollection
        },
        currentPrice: a.highestBid || a.startingPrice,
        endTime: a.endTime,
        totalBids: a.totalBids
      }))
    });
  } catch (error) {
    console.error('Error fetching similar auctions:', error);
    res.status(500).json({ error: 'Failed to fetch similar auctions' });
  }
});

// Get price analytics
router.get('/analytics/price', async (req, res: Response) => {
  try {
    const { rarity, collection } = req.query;
    
    const query: any = { status: 'completed' };
    if (rarity) query['gift.rarity'] = rarity;
    if (collection) query['gift.giftCollection'] = collection;
    
    // Get completed auctions for analytics
    const completedAuctions = await Auction.find(query)
      .sort({ completedAt: -1 })
      .limit(100)
      .lean() as any[];
    
    if (completedAuctions.length === 0) {
      return res.json({
        currentAvgPrice: 0,
        previousAvgPrice: 0,
        priceChange: 0,
        priceChangePercent: 0,
        history: [],
        marketTrend: 'stable',
        recommendation: 'Недостаточно данных для анализа',
        estimatedValue: { low: 10, high: 100, fair: 50 }
      });
    }
    
    // Calculate averages
    const prices = completedAuctions.map(a => a.highestBid || 0).filter(p => p > 0);
    const currentAvg = prices.slice(0, 10).reduce((a, b) => a + b, 0) / Math.min(prices.length, 10);
    const previousAvg = prices.slice(10, 20).reduce((a, b) => a + b, 0) / Math.max(1, Math.min(prices.length - 10, 10));
    
    const priceChange = currentAvg - previousAvg;
    const priceChangePercent = previousAvg > 0 ? (priceChange / previousAvg) * 100 : 0;
    
    // Calculate market trend
    let marketTrend: 'up' | 'down' | 'stable' = 'stable';
    if (priceChangePercent > 5) marketTrend = 'up';
    else if (priceChangePercent < -5) marketTrend = 'down';
    
    // Build price history (last 7 days)
    const history: any[] = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date();
      dayStart.setDate(dayStart.getDate() - i);
      dayStart.setHours(0, 0, 0, 0);
      
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      
      const dayAuctions = completedAuctions.filter(a => {
        const completedAt = new Date(a.completedAt || a.updatedAt);
        return completedAt >= dayStart && completedAt < dayEnd;
      });
      
      const dayPrices = dayAuctions.map(a => a.highestBid || 0).filter(p => p > 0);
      
      history.push({
        date: dayStart.toISOString().split('T')[0],
        avgPrice: dayPrices.length > 0 ? dayPrices.reduce((a, b) => a + b, 0) / dayPrices.length : currentAvg,
        minPrice: dayPrices.length > 0 ? Math.min(...dayPrices) : 0,
        maxPrice: dayPrices.length > 0 ? Math.max(...dayPrices) : 0,
        count: dayPrices.length
      });
    }
    
    // Calculate estimated value range
    const sortedPrices = [...prices].sort((a, b) => a - b);
    const estimatedValue = {
      low: sortedPrices[Math.floor(sortedPrices.length * 0.1)] || Math.round(currentAvg * 0.7),
      fair: Math.round(currentAvg),
      high: sortedPrices[Math.floor(sortedPrices.length * 0.9)] || Math.round(currentAvg * 1.5)
    };
    
    // Generate recommendation
    let recommendation = '';
    if (marketTrend === 'up') {
      recommendation = 'Цены растут. Хорошее время для продажи, но покупать стоит быстро!';
    } else if (marketTrend === 'down') {
      recommendation = 'Цены снижаются. Отличное время для покупки!';
    } else {
      recommendation = 'Рынок стабилен. Следите за редкими предложениями.';
    }
    
    res.json({
      currentAvgPrice: Math.round(currentAvg),
      previousAvgPrice: Math.round(previousAvg),
      priceChange: Math.round(priceChange),
      priceChangePercent: Math.round(priceChangePercent * 10) / 10,
      history,
      marketTrend,
      recommendation,
      estimatedValue
    });
  } catch (error) {
    console.error('Error fetching price analytics:', error);
    res.status(500).json({ error: 'Failed to fetch price analytics' });
  }
});

export default router;







