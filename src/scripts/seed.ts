import { User, Balance, Auction } from '../models';
import { AuctionStatus, UserRank } from '../types';
import { connectDatabase, disconnectDatabase } from '../utils/database';
import logger from '../utils/logger';

/**
 * 🌱 Seed Script
 * 
 * Creates test data for development:
 * - Test users with balances
 * - Sample auctions
 */

const seedUsers = async () => {
  logger.info('Creating test users...');

  const users = [
    {
      telegramId: '111111111',
      firstName: 'Алексей',
      lastName: 'Иванов',
      username: 'alexey_whale',
      rank: UserRank.WHALE,
      stats: {
        totalBids: 150,
        totalWins: 25,
        totalSpent: 15000,
        auctionsParticipated: 30,
        winRate: 16.67,
        currentStreak: 3,
        bestStreak: 7,
      },
    },
    {
      telegramId: '222222222',
      firstName: 'Мария',
      lastName: 'Петрова',
      username: 'maria_diamond',
      rank: UserRank.DIAMOND,
      stats: {
        totalBids: 80,
        totalWins: 12,
        totalSpent: 6000,
        auctionsParticipated: 20,
        winRate: 15,
        currentStreak: 1,
        bestStreak: 4,
      },
    },
    {
      telegramId: '333333333',
      firstName: 'Дмитрий',
      lastName: 'Сидоров',
      username: 'dmitry_gold',
      rank: UserRank.GOLD,
      stats: {
        totalBids: 40,
        totalWins: 5,
        totalSpent: 1500,
        auctionsParticipated: 10,
        winRate: 12.5,
        currentStreak: 0,
        bestStreak: 2,
      },
    },
    {
      telegramId: '444444444',
      firstName: 'Екатерина',
      lastName: 'Козлова',
      username: 'kate_silver',
      rank: UserRank.SILVER,
      stats: {
        totalBids: 15,
        totalWins: 2,
        totalSpent: 300,
        auctionsParticipated: 5,
        winRate: 13.33,
        currentStreak: 0,
        bestStreak: 1,
      },
    },
    {
      telegramId: '555555555',
      firstName: 'Новичок',
      lastName: 'Тестовый',
      username: 'newbie_test',
      rank: UserRank.BRONZE,
      stats: {
        totalBids: 0,
        totalWins: 0,
        totalSpent: 0,
        auctionsParticipated: 0,
        winRate: 0,
        currentStreak: 0,
        bestStreak: 0,
      },
    },
  ];

  const createdUsers = [];

  for (const userData of users) {
    const existingUser = await User.findByTelegramId(userData.telegramId);
    
    if (existingUser) {
      logger.info(`User ${userData.username} already exists, skipping...`);
      createdUsers.push(existingUser);
      continue;
    }

    const user = await User.create(userData);
    createdUsers.push(user);
    logger.info(`Created user: ${user.username} (${user.rank})`);
  }

  return createdUsers;
};

const seedBalances = async (users: typeof User.prototype[]) => {
  logger.info('Creating balances...');

  const balances = [
    { userId: users[0]._id.toString(), available: 50000, locked: 0 }, // Whale
    { userId: users[1]._id.toString(), available: 20000, locked: 0 }, // Diamond
    { userId: users[2]._id.toString(), available: 5000, locked: 0 },  // Gold
    { userId: users[3]._id.toString(), available: 1000, locked: 0 },  // Silver
    { userId: users[4]._id.toString(), available: 500, locked: 0 },   // Bronze
  ];

  for (const balanceData of balances) {
    const existing = await Balance.findByUserId(balanceData.userId);
    
    if (existing) {
      existing.available = balanceData.available;
      existing.locked = balanceData.locked;
      await existing.save();
      logger.info(`Updated balance for user ${balanceData.userId}`);
    } else {
      await Balance.create(balanceData);
      logger.info(`Created balance for user ${balanceData.userId}: ${balanceData.available}`);
    }
  }
};

const seedAuctions = async () => {
  logger.info('Creating sample auctions...');

  // Fragment-style attributes
  const collections = ['Genesis', 'Cyber', 'Nature', 'Celebration'];
  const models = ['Crown', 'Star', 'Heart', 'Diamond', 'Rose', 'Phoenix', 'Moon', 'Sun'];
  const backdrops = ['Cosmic', 'Ocean', 'Forest', 'Aurora', 'Sunset', 'Midnight', 'Crystal'];
  const symbols = ['⭐', '💎', '🌙', '🔥', '🌸', '💫', '✨', '🎭'];

  const auctions = [
    {
      title: '🎁 Редкий Праздничный Подарок',
      description: 'Эксклюзивный новогодний подарок с уникальным дизайном. Только 100 штук во всём Telegram!',
      gift: {
        id: 'gift_holiday_2024',
        name: 'Праздничный Подарок 2024',
        description: 'Эксклюзивный праздничный подарок',
        imageUrl: 'https://example.com/gifts/holiday_2024.png',
        rarity: 'legendary' as const,
        totalSupply: 100,
        // Fragment-style attributes
        model: 'Crown',
        backdrop: 'Cosmic',
        symbol: '⭐',
        collection: 'Celebration',
        number: 42,
        timesSold: 3,
        floorPrice: 2500,
        attributes: {
          season: 'winter',
          year: 2024,
          animated: true,
        },
      },
      totalGifts: 100,
      totalRounds: 10,
      giftsPerRound: 10,
      minBidAmount: 50,
      bidIncrement: 5,
      status: AuctionStatus.DRAFT,
    },
    {
      title: '💎 Алмазная Корона',
      description: 'Престижный подарок для настоящих коллекционеров. Лимитированная серия из 50 штук.',
      gift: {
        id: 'gift_diamond_crown',
        name: 'Алмазная Корона',
        description: 'Корона с бриллиантами',
        imageUrl: 'https://example.com/gifts/diamond_crown.png',
        rarity: 'epic' as const,
        totalSupply: 50,
        // Fragment-style attributes
        model: 'Diamond',
        backdrop: 'Crystal',
        symbol: '💎',
        collection: 'Genesis',
        number: 7,
        timesSold: 5,
        floorPrice: 1800,
        attributes: {
          type: 'crown',
          material: 'diamond',
        },
      },
      totalGifts: 50,
      totalRounds: 5,
      giftsPerRound: 10,
      minBidAmount: 100,
      bidIncrement: 10,
      status: AuctionStatus.DRAFT,
    },
    {
      title: '🌟 Звёздный Талисман',
      description: 'Красивый талисман для тех, кто верит в удачу!',
      gift: {
        id: 'gift_star_charm',
        name: 'Звёздный Талисман',
        description: 'Талисман удачи',
        imageUrl: 'https://example.com/gifts/star_charm.png',
        rarity: 'rare' as const,
        totalSupply: 200,
        // Fragment-style attributes
        model: 'Star',
        backdrop: 'Aurora',
        symbol: '💫',
        collection: 'Cyber',
        number: 128,
        timesSold: 12,
        floorPrice: 450,
        attributes: {
          type: 'charm',
          effect: 'luck',
        },
      },
      totalGifts: 200,
      totalRounds: 20,
      giftsPerRound: 10,
      minBidAmount: 20,
      bidIncrement: 2,
      status: AuctionStatus.DRAFT,
    },
    {
      title: '🌸 Розовый Феникс',
      description: 'Редкий феникс из коллекции Nature. Символ возрождения и красоты.',
      gift: {
        id: 'gift_phoenix_rose',
        name: 'Розовый Феникс',
        description: 'Феникс из лепестков роз',
        imageUrl: 'https://example.com/gifts/phoenix_rose.png',
        rarity: 'epic' as const,
        totalSupply: 75,
        // Fragment-style attributes
        model: 'Phoenix',
        backdrop: 'Sunset',
        symbol: '🌸',
        collection: 'Nature',
        number: 23,
        timesSold: 8,
        floorPrice: 1200,
        attributes: {
          type: 'mythical',
          element: 'fire',
          animated: true,
        },
      },
      totalGifts: 75,
      totalRounds: 7,
      giftsPerRound: 10,
      minBidAmount: 75,
      bidIncrement: 8,
      status: AuctionStatus.DRAFT,
    },
    {
      title: '🌙 Лунный Кристалл',
      description: 'Магический кристалл, созданный из лунного света. Коллекция Cyber.',
      gift: {
        id: 'gift_moon_crystal',
        name: 'Лунный Кристалл',
        description: 'Кристалл лунного света',
        imageUrl: 'https://example.com/gifts/moon_crystal.png',
        rarity: 'rare' as const,
        totalSupply: 150,
        // Fragment-style attributes
        model: 'Moon',
        backdrop: 'Midnight',
        symbol: '🌙',
        collection: 'Cyber',
        number: 89,
        timesSold: 15,
        floorPrice: 350,
        attributes: {
          type: 'crystal',
          element: 'lunar',
        },
      },
      totalGifts: 150,
      totalRounds: 15,
      giftsPerRound: 10,
      minBidAmount: 25,
      bidIncrement: 3,
      status: AuctionStatus.DRAFT,
    },
    {
      title: '❤️ Сердце Океана',
      description: 'Легендарное сердце из глубин океана. Исключительная редкость!',
      gift: {
        id: 'gift_ocean_heart',
        name: 'Сердце Океана',
        description: 'Драгоценное сердце',
        imageUrl: 'https://example.com/gifts/ocean_heart.png',
        rarity: 'legendary' as const,
        totalSupply: 25,
        // Fragment-style attributes
        model: 'Heart',
        backdrop: 'Ocean',
        symbol: '✨',
        collection: 'Genesis',
        number: 1,
        timesSold: 1,
        floorPrice: 5000,
        attributes: {
          type: 'jewelry',
          material: 'sapphire',
          animated: true,
        },
      },
      totalGifts: 25,
      totalRounds: 5,
      giftsPerRound: 5,
      minBidAmount: 200,
      bidIncrement: 25,
      status: AuctionStatus.DRAFT,
    },
  ];

  for (const auctionData of auctions) {
    const existing = await Auction.findOne({ 'gift.id': auctionData.gift.id });
    
    if (existing) {
      logger.info(`Auction "${auctionData.title}" already exists, skipping...`);
      continue;
    }

    const auction = await Auction.create(auctionData);
    logger.info(`Created auction: ${auction.title} (${auction._id})`);
  }
};

const seed = async () => {
  try {
    logger.info('🌱 Starting seed script...');

    await connectDatabase();

    const users = await seedUsers();
    await seedBalances(users);
    await seedAuctions();

    logger.info('✅ Seed completed successfully!');
    logger.info('');
    logger.info('Test users created:');
    logger.info('  - alexey_whale (Telegram ID: 111111111) - 50,000 coins');
    logger.info('  - maria_diamond (Telegram ID: 222222222) - 20,000 coins');
    logger.info('  - dmitry_gold (Telegram ID: 333333333) - 5,000 coins');
    logger.info('  - kate_silver (Telegram ID: 444444444) - 1,000 coins');
    logger.info('  - newbie_test (Telegram ID: 555555555) - 500 coins');
    logger.info('');
    logger.info('Sample auctions created (DRAFT status)');
    logger.info('Use POST /api/auctions/:id/start to start an auction');

  } catch (error) {
    logger.error('Seed failed:', error);
    process.exit(1);
  } finally {
    await disconnectDatabase();
    process.exit(0);
  }
};

// Run seed
seed();
