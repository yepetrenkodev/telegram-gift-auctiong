import mongoose from 'mongoose';
import { Bid, User, Auction, Round } from '../models';
import { BidStatus, AuctionStatus } from '../types';
import { redisService } from './RedisService';
import logger from '../utils/logger';

/**
 * 🎁 My Gifts Service
 * 
 * Управление выигранными подарками пользователя:
 * - Список выигранных подарков
 * - История участия в аукционах
 * - Статистика побед
 * - Claim/transfer подарков
 */

export interface WonGift {
  id: string;
  auctionId: string;
  auctionTitle: string;
  roundNumber: number;
  
  gift: {
    id: string;
    name: string;
    description: string;
    imageUrl: string;
    rarity: string;
    collection?: string;
    backdrop?: string;
    symbol?: string;
    number?: number;
  };
  
  bidAmount: number;
  wonAt: Date;
  
  // Статус подарка
  status: 'pending' | 'claimed' | 'transferred' | 'on_sale';
  claimedAt?: Date;
  transferredTo?: string;
  transferredAt?: Date;
}

export interface AuctionParticipation {
  auctionId: string;
  auctionTitle: string;
  giftName: string;
  giftImageUrl: string;
  
  status: 'active' | 'won' | 'lost' | 'outbid';
  
  myHighestBid: number;
  currentHighestBid: number;
  myPosition: number;
  totalParticipants: number;
  
  roundNumber: number;
  totalRounds: number;
  
  endsAt?: Date;
  timeLeft?: number;
  
  createdAt: Date;
}

export interface UserGiftStats {
  totalWon: number;
  totalSpent: number;
  totalAuctionsParticipated: number;
  winRate: number;
  
  byRarity: {
    common: number;
    rare: number;
    epic: number;
    legendary: number;
  };
  
  byCollection: Record<string, number>;
  
  biggestWin: {
    giftName: string;
    amount: number;
    date: Date;
  } | null;
  
  streak: {
    current: number;
    best: number;
  };
}

class MyGiftsService {
  private readonly CACHE_PREFIX = 'my_gifts:';
  private readonly CACHE_TTL = 60;

  /**
   * Получить все выигранные подарки пользователя
   */
  async getWonGifts(
    userId: string,
    options: {
      limit?: number;
      skip?: number;
      status?: 'pending' | 'claimed' | 'transferred' | 'on_sale' | 'all';
      sortBy?: 'newest' | 'oldest' | 'price_high' | 'price_low' | 'rarity';
    } = {}
  ): Promise<{ gifts: WonGift[]; total: number; hasMore: boolean }> {
    const { limit = 20, skip = 0, status = 'all', sortBy = 'newest' } = options;

    // Находим все выигранные ставки
    const query: Record<string, unknown> = {
      userId,
      status: BidStatus.WON,
    };

    // Сортировка
    let sort: Record<string, 1 | -1> = { placedAt: -1 };
    switch (sortBy) {
      case 'oldest':
        sort = { placedAt: 1 };
        break;
      case 'price_high':
        sort = { amount: -1 };
        break;
      case 'price_low':
        sort = { amount: 1 };
        break;
    }

    const [wonBids, total] = await Promise.all([
      Bid.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      Bid.countDocuments(query),
    ]);

    // Получаем данные аукционов
    const auctionIds = [...new Set(wonBids.map(b => b.auctionId))];
    const auctions = await Auction.find({ _id: { $in: auctionIds } }).lean();
    const auctionMap = new Map(auctions.map(a => [a._id.toString(), a]));

    // Получаем данные раундов
    const roundIds = wonBids.map(b => b.roundId);
    const rounds = await Round.find({ _id: { $in: roundIds } }).lean();
    const roundMap = new Map(rounds.map(r => [r._id.toString(), r]));

    // Формируем результат
    const gifts: WonGift[] = wonBids.map(bid => {
      const auction = auctionMap.get(bid.auctionId);
      const round = roundMap.get(bid.roundId);
      const gift = auction?.gift as any;

      return {
        id: bid._id.toString(),
        auctionId: bid.auctionId,
        auctionTitle: auction?.title || 'Unknown Auction',
        roundNumber: round?.roundNumber || 1,
        
        gift: {
          id: gift?.id || '',
          name: gift?.name || 'Unknown Gift',
          description: gift?.description || '',
          imageUrl: gift?.imageUrl || '',
          rarity: gift?.rarity || 'common',
          collection: gift?.giftCollection,
          backdrop: gift?.backdrop,
          symbol: gift?.symbol,
          number: gift?.number,
        },
        
        bidAmount: bid.amount,
        wonAt: bid.processedAt || bid.placedAt,
        
        // TODO: Добавить реальный статус из отдельной коллекции
        status: 'claimed' as const,
        claimedAt: bid.processedAt,
      };
    });

    // Фильтрация по rarity если sortBy = rarity
    if (sortBy === 'rarity') {
      const rarityOrder = { legendary: 0, epic: 1, rare: 2, common: 3 };
      gifts.sort((a, b) => 
        (rarityOrder[a.gift.rarity as keyof typeof rarityOrder] || 4) - 
        (rarityOrder[b.gift.rarity as keyof typeof rarityOrder] || 4)
      );
    }

    return {
      gifts,
      total,
      hasMore: skip + gifts.length < total,
    };
  }

  /**
   * Получить активные участия в аукционах
   */
  async getActiveParticipations(userId: string): Promise<AuctionParticipation[]> {
    // Находим активные ставки пользователя
    const activeBids = await Bid.find({
      userId,
      status: BidStatus.ACTIVE,
    }).lean();

    if (activeBids.length === 0) return [];

    const auctionIds = [...new Set(activeBids.map(b => b.auctionId))];
    
    // Получаем аукционы
    const auctions = await Auction.find({
      _id: { $in: auctionIds },
      status: AuctionStatus.ACTIVE,
    }).lean();

    // Получаем раунды
    const roundIds = activeBids.map(b => b.roundId);
    const rounds = await Round.find({ _id: { $in: roundIds } }).lean();
    const roundMap = new Map(rounds.map(r => [r._id.toString(), r]));

    const participations: AuctionParticipation[] = [];

    for (const auction of auctions) {
      const userBid = activeBids.find(b => b.auctionId === auction._id.toString());
      if (!userBid) continue;

      const round = roundMap.get(userBid.roundId);
      const gift = auction.gift as any;

      // Получаем позицию пользователя
      const higherBids = await Bid.countDocuments({
        roundId: userBid.roundId,
        status: BidStatus.ACTIVE,
        amount: { $gt: userBid.amount },
      });

      // Текущая максимальная ставка
      const topBid = await Bid.findOne({
        roundId: userBid.roundId,
        status: BidStatus.ACTIVE,
      }).sort({ amount: -1 }).lean();

      // Всего участников
      const totalParticipants = await Bid.distinct('userId', {
        roundId: userBid.roundId,
        status: BidStatus.ACTIVE,
      }).then(arr => arr.length);

      const now = new Date();
      const endsAt = round?.endsAt;
      const timeLeft = endsAt ? Math.max(0, Math.floor((new Date(endsAt).getTime() - now.getTime()) / 1000)) : 0;

      participations.push({
        auctionId: auction._id.toString(),
        auctionTitle: auction.title,
        giftName: gift?.name || 'Unknown',
        giftImageUrl: gift?.imageUrl || '',
        
        status: higherBids < auction.winnersPerRound ? 'active' : 'outbid',
        
        myHighestBid: userBid.amount,
        currentHighestBid: topBid?.amount || userBid.amount,
        myPosition: higherBids + 1,
        totalParticipants,
        
        roundNumber: round?.roundNumber || 1,
        totalRounds: auction.totalRounds,
        
        endsAt,
        timeLeft,
        
        createdAt: userBid.placedAt,
      });
    }

    // Сортируем по времени окончания
    participations.sort((a, b) => (a.timeLeft || 0) - (b.timeLeft || 0));

    return participations;
  }

  /**
   * Получить историю участия (выигрыши + проигрыши)
   */
  async getParticipationHistory(
    userId: string,
    options: { limit?: number; skip?: number } = {}
  ): Promise<{ history: AuctionParticipation[]; total: number }> {
    const { limit = 20, skip = 0 } = options;

    // Все ставки пользователя (кроме активных)
    const bids = await Bid.find({
      userId,
      status: { $in: [BidStatus.WON, BidStatus.OUTBID, BidStatus.REFUNDED] },
    })
      .sort({ placedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Bid.countDocuments({
      userId,
      status: { $in: [BidStatus.WON, BidStatus.OUTBID, BidStatus.REFUNDED] },
    });

    // Уникальные аукционы
    const auctionIds = [...new Set(bids.map(b => b.auctionId))];
    const auctions = await Auction.find({ _id: { $in: auctionIds } }).lean();
    const auctionMap = new Map(auctions.map(a => [a._id.toString(), a]));

    const history: AuctionParticipation[] = bids.map(bid => {
      const auction = auctionMap.get(bid.auctionId);
      const gift = auction?.gift as any;

      return {
        auctionId: bid.auctionId,
        auctionTitle: auction?.title || 'Unknown',
        giftName: gift?.name || 'Unknown',
        giftImageUrl: gift?.imageUrl || '',
        
        status: bid.status === BidStatus.WON ? 'won' : 'lost',
        
        myHighestBid: bid.amount,
        currentHighestBid: auction?.highestBid || bid.amount,
        myPosition: 0, // Неизвестно для истории
        totalParticipants: auction?.totalParticipants || 0,
        
        roundNumber: 1,
        totalRounds: auction?.totalRounds || 1,
        
        createdAt: bid.placedAt,
      };
    });

    return { history, total };
  }

  /**
   * Получить статистику подарков пользователя
   */
  async getGiftStats(userId: string): Promise<UserGiftStats> {
    const cacheKey = `${this.CACHE_PREFIX}${userId}:stats`;
    
    const cached = await redisService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Все выигранные ставки
    const wonBids = await Bid.find({
      userId,
      status: BidStatus.WON,
    }).lean();

    // Все аукционы с участием
    const allBids = await Bid.find({ userId }).lean();
    const participatedAuctions = new Set(allBids.map(b => b.auctionId));

    // Данные аукционов для подарков
    const auctionIds = wonBids.map(b => b.auctionId);
    const auctions = await Auction.find({ _id: { $in: auctionIds } }).lean();
    const auctionMap = new Map(auctions.map(a => [a._id.toString(), a]));

    // Подсчёт по редкости и коллекциям
    const byRarity = { common: 0, rare: 0, epic: 0, legendary: 0 };
    const byCollection: Record<string, number> = {};
    let biggestWin: UserGiftStats['biggestWin'] = null;

    for (const bid of wonBids) {
      const auction = auctionMap.get(bid.auctionId);
      const gift = auction?.gift as any;
      
      if (gift) {
        // По редкости
        const rarity = gift.rarity as keyof typeof byRarity;
        if (byRarity[rarity] !== undefined) {
          byRarity[rarity]++;
        }

        // По коллекции
        const collection = gift.giftCollection || 'Other';
        byCollection[collection] = (byCollection[collection] || 0) + 1;

        // Самый большой выигрыш
        if (!biggestWin || bid.amount > biggestWin.amount) {
          biggestWin = {
            giftName: gift.name,
            amount: bid.amount,
            date: bid.processedAt || bid.placedAt,
          };
        }
      }
    }

    // Получаем user stats
    const user = await User.findById(userId).lean();
    const userStats = user?.stats || { currentStreak: 0, bestStreak: 0 };

    const totalSpent = wonBids.reduce((sum, b) => sum + b.amount, 0);
    const winRate = participatedAuctions.size > 0
      ? (wonBids.length / participatedAuctions.size) * 100
      : 0;

    const stats: UserGiftStats = {
      totalWon: wonBids.length,
      totalSpent,
      totalAuctionsParticipated: participatedAuctions.size,
      winRate: Math.round(winRate * 10) / 10,
      byRarity,
      byCollection,
      biggestWin,
      streak: {
        current: userStats.currentStreak || 0,
        best: userStats.bestStreak || 0,
      },
    };

    // Кэшируем на 1 минуту
    await redisService.set(cacheKey, JSON.stringify(stats), 60);

    return stats;
  }

  /**
   * Получить последние выигрыши (для профиля)
   */
  async getRecentWins(userId: string, limit = 5): Promise<WonGift[]> {
    const result = await this.getWonGifts(userId, { limit, sortBy: 'newest' });
    return result.gifts;
  }

  /**
   * Проверить есть ли активные участия
   */
  async hasActiveParticipations(userId: string): Promise<boolean> {
    const count = await Bid.countDocuments({
      userId,
      status: BidStatus.ACTIVE,
    });
    return count > 0;
  }

  /**
   * Получить количество выигранных подарков
   */
  async getWonCount(userId: string): Promise<number> {
    return Bid.countDocuments({
      userId,
      status: BidStatus.WON,
    });
  }

  /**
   * Получить историю ставок пользователя
   */
  async getBidHistory(
    userId: string,
    options: { auctionId?: string; page?: number; limit?: number } = {}
  ): Promise<{
    bids: Array<{
      id: string;
      auctionId: string;
      auctionTitle: string;
      amount: number;
      status: string;
      placedAt: Date;
      processedAt?: Date;
    }>;
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    totalBids: number;
    totalAmount: number;
    averageBid: number;
  }> {
    const { auctionId, page = 1, limit = 50 } = options;
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = { userId };
    if (auctionId) query.auctionId = auctionId;

    const [bids, total, aggregation] = await Promise.all([
      Bid.find(query)
        .sort({ placedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Bid.countDocuments(query),
      Bid.aggregate([
        { $match: { userId } },
        {
          $group: {
            _id: null,
            totalBids: { $sum: 1 },
            totalAmount: { $sum: '$amount' },
            avgBid: { $avg: '$amount' },
          },
        },
      ]),
    ]);

    // Получаем названия аукционов
    const auctionIds = [...new Set(bids.map(b => b.auctionId))];
    const auctions = await Auction.find({ _id: { $in: auctionIds } }).lean();
    const auctionMap = new Map(auctions.map(a => [a._id.toString(), a]));

    const stats = aggregation[0] || { totalBids: 0, totalAmount: 0, avgBid: 0 };

    return {
      bids: bids.map(bid => ({
        id: bid._id.toString(),
        auctionId: bid.auctionId,
        auctionTitle: auctionMap.get(bid.auctionId)?.title || 'Unknown',
        amount: bid.amount,
        status: bid.status,
        placedAt: bid.placedAt,
        processedAt: bid.processedAt,
      })),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      totalBids: stats.totalBids,
      totalAmount: stats.totalAmount,
      averageBid: Math.round(stats.avgBid || 0),
    };
  }

  /**
   * Получить статистику расходов за период
   */
  async getSpendingStats(
    userId: string,
    days: number
  ): Promise<{
    totalSpent: number;
    wonAuctions: number;
    lostAuctions: number;
    refundedAmount: number;
    byDay: Array<{ date: string; spent: number; won: number }>;
    byCollection: Record<string, number>;
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // Выигранные ставки за период
    const wonBids = await Bid.find({
      userId,
      status: BidStatus.WON,
      processedAt: { $gte: startDate },
    }).lean();

    // Проигранные/возвращённые
    const lostBids = await Bid.find({
      userId,
      status: { $in: [BidStatus.OUTBID, BidStatus.REFUNDED] },
      processedAt: { $gte: startDate },
    }).lean();

    // Расчёты
    const totalSpent = wonBids.reduce((sum, b) => sum + b.amount, 0);
    const refundedAmount = lostBids
      .filter(b => b.status === BidStatus.REFUNDED)
      .reduce((sum, b) => sum + b.amount, 0);

    // Группировка по дням
    const byDayMap = new Map<string, { spent: number; won: number }>();
    for (const bid of wonBids) {
      const date = (bid.processedAt || bid.placedAt).toISOString().split('T')[0];
      const entry = byDayMap.get(date) || { spent: 0, won: 0 };
      entry.spent += bid.amount;
      entry.won += 1;
      byDayMap.set(date, entry);
    }

    // Заполняем пустые дни
    const byDay: Array<{ date: string; spent: number; won: number }> = [];
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      const entry = byDayMap.get(dateStr) || { spent: 0, won: 0 };
      byDay.push({ date: dateStr, ...entry });
    }

    // По коллекциям
    const auctionIds = wonBids.map(b => b.auctionId);
    const auctions = await Auction.find({ _id: { $in: auctionIds } }).lean();
    const auctionMap = new Map(auctions.map(a => [a._id.toString(), a]));

    const byCollection: Record<string, number> = {};
    for (const bid of wonBids) {
      const auction = auctionMap.get(bid.auctionId);
      const gift = auction?.gift as any;
      const collection = gift?.giftCollection || 'Other';
      byCollection[collection] = (byCollection[collection] || 0) + bid.amount;
    }

    return {
      totalSpent,
      wonAuctions: wonBids.length,
      lostAuctions: lostBids.filter(b => b.status === BidStatus.OUTBID).length,
      refundedAmount,
      byDay,
      byCollection,
    };
  }

  /**
   * Инвалидировать кэш пользователя
   */
  async invalidateCache(userId: string): Promise<void> {
    await redisService.del(`${this.CACHE_PREFIX}${userId}:stats`);
  }
}

export const myGiftsService = new MyGiftsService();
export default myGiftsService;
