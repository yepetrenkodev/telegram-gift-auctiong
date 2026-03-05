import mongoose from 'mongoose'
import dotenv from 'dotenv'
import { Auction, User, Bid, Balance, Round } from '../src/models'

dotenv.config()

async function seedTestData() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/telegram-gift-auction'
    await mongoose.connect(mongoUri)
    console.log('✅ Connected to MongoDB')

    // Clear existing data
    await Auction.deleteMany({})
    await Bid.deleteMany({})
    await User.deleteMany({})
    await Balance.deleteMany({})
    await Round.deleteMany({})
    console.log('🗑️  Cleared existing data')

    // Create test user
    const testUser = await User.create({
      telegramId: '123456789',
      username: 'testuser',
      firstName: 'Test',
      lastName: 'User',
      stats: {
        totalBids: 0,
        totalWins: 3,
        totalSpent: 1500,
        auctionsParticipated: 10,
        winRate: 30,
        currentStreak: 1,
        bestStreak: 3
      }
    })

    // Create balance for test user
    await Balance.create({
      userId: testUser._id.toString(),
      available: 5000,
      locked: 0
    })
    console.log('👤 Created test user:', testUser.firstName, 'with 5000 ⭐ balance')

    // Create more users for leaderboard
    const usersData = [
      { telegramId: '111111111', firstName: 'Alex', lastName: 'Winner', stats: { totalSpent: 5000, totalWins: 10, totalBids: 50 }, balance: 10000 },
      { telegramId: '222222222', firstName: 'Maria', lastName: 'Pro', stats: { totalSpent: 4000, totalWins: 8, totalBids: 40 }, balance: 8000 },
      { telegramId: '333333333', firstName: 'John', lastName: 'Bid', stats: { totalSpent: 3000, totalWins: 5, totalBids: 30 }, balance: 6000 },
      { telegramId: '444444444', firstName: 'Emma', lastName: 'Star', stats: { totalSpent: 2000, totalWins: 3, totalBids: 20 }, balance: 4000 },
      { telegramId: '555555555', firstName: 'Max', lastName: 'Gift', stats: { totalSpent: 1000, totalWins: 1, totalBids: 10 }, balance: 2000 },
    ]

    for (const userData of usersData) {
      const user = await User.create({
        telegramId: userData.telegramId,
        firstName: userData.firstName,
        lastName: userData.lastName,
        stats: userData.stats
      })
      await Balance.create({
        userId: user._id.toString(),
        available: userData.balance,
        locked: 0
      })
    }
    console.log('👥 Created 5 additional users with balances')

    const now = new Date()

    // Create auctions with embedded gift
    const auctionsData = [
      {
        title: 'Delicious Cake Auction',
        description: 'A super rare delicious cake! Perfect for celebrations.',
        gift: {
          id: 'cake-001',
          name: '🎂 Delicious Cake',
          description: 'A super rare delicious cake!',
          imageUrl: 'https://placehold.co/200x200/ffd700/fff?text=🎂',
          rarity: 'legendary',
          totalSupply: 100
        },
        status: 'active',
        totalGifts: 10,
        totalRounds: 1,
        giftsPerRound: 1,
        winnersPerRound: 1,
        minBidAmount: 500,
        bidIncrement: 50,
        highestBid: 1250,
        totalBids: 15,
        scheduledStartAt: new Date(now.getTime() - 60 * 60 * 1000),
        endsAt: new Date(now.getTime() + 30 * 60 * 1000)
      },
      {
        title: 'Magic Unicorn',
        description: 'A magical unicorn that brings luck!',
        gift: {
          id: 'unicorn-001',
          name: '🦄 Magic Unicorn',
          description: 'A magical unicorn that brings luck!',
          imageUrl: 'https://placehold.co/200x200/9b59b6/fff?text=🦄',
          rarity: 'epic',
          totalSupply: 500
        },
        status: 'active',
        totalGifts: 5,
        totalRounds: 1,
        giftsPerRound: 1,
        winnersPerRound: 1,
        minBidAmount: 200,
        bidIncrement: 25,
        highestBid: 450,
        totalBids: 10,
        scheduledStartAt: new Date(now.getTime() - 30 * 60 * 1000),
        endsAt: new Date(now.getTime() + 45 * 60 * 1000)
      },
      {
        title: 'Shooting Star',
        description: 'Make a wish on this shooting star!',
        gift: {
          id: 'star-001',
          name: '🌟 Shooting Star',
          description: 'Make a wish on this shooting star!',
          imageUrl: 'https://placehold.co/200x200/e74c3c/fff?text=🌟',
          rarity: 'epic',
          totalSupply: 300
        },
        status: 'active',
        totalGifts: 3,
        totalRounds: 1,
        giftsPerRound: 1,
        winnersPerRound: 1,
        minBidAmount: 150,
        bidIncrement: 20,
        highestBid: 300,
        totalBids: 8,
        scheduledStartAt: new Date(now.getTime() - 20 * 60 * 1000),
        endsAt: new Date(now.getTime() + 5 * 60 * 1000) // Ending soon!
      },
      {
        title: 'Mystery Box',
        description: 'What could be inside? Open to find out!',
        gift: {
          id: 'box-001',
          name: '🎁 Mystery Box',
          description: 'What could be inside? Open to find out!',
          imageUrl: 'https://placehold.co/200x200/3498db/fff?text=🎁',
          rarity: 'rare',
          totalSupply: 1000
        },
        status: 'active',
        totalGifts: 20,
        totalRounds: 1,
        giftsPerRound: 1,
        winnersPerRound: 1,
        minBidAmount: 100,
        bidIncrement: 15,
        highestBid: 180,
        totalBids: 6,
        scheduledStartAt: new Date(now.getTime() - 45 * 60 * 1000),
        endsAt: new Date(now.getTime() + 2 * 60 * 60 * 1000)
      },
      {
        title: 'Crystal Diamond',
        description: 'A sparkling diamond for your collection.',
        gift: {
          id: 'diamond-001',
          name: '💎 Crystal Diamond',
          description: 'A sparkling diamond for your collection.',
          imageUrl: 'https://placehold.co/200x200/1abc9c/fff?text=💎',
          rarity: 'rare',
          totalSupply: 800
        },
        status: 'active',
        totalGifts: 15,
        totalRounds: 1,
        giftsPerRound: 1,
        winnersPerRound: 1,
        minBidAmount: 100,
        bidIncrement: 15,
        highestBid: 100,
        totalBids: 0,
        scheduledStartAt: now,
        endsAt: new Date(now.getTime() + 3 * 60 * 60 * 1000)
      },
      {
        title: 'Rainbow',
        description: 'A beautiful rainbow to brighten your day.',
        gift: {
          id: 'rainbow-001',
          name: '🌈 Rainbow',
          description: 'A beautiful rainbow to brighten your day.',
          imageUrl: 'https://placehold.co/200x200/f39c12/fff?text=🌈',
          rarity: 'common',
          totalSupply: 5000
        },
        status: 'active',
        totalGifts: 50,
        totalRounds: 1,
        giftsPerRound: 1,
        winnersPerRound: 1,
        minBidAmount: 50,
        bidIncrement: 10,
        highestBid: 85,
        totalBids: 4,
        scheduledStartAt: new Date(now.getTime() - 15 * 60 * 1000),
        endsAt: new Date(now.getTime() + 90 * 60 * 1000)
      },
      {
        title: 'Party Balloon',
        description: 'Ready for any celebration!',
        gift: {
          id: 'balloon-001',
          name: '🎈 Party Balloon',
          description: 'Ready for any celebration!',
          imageUrl: 'https://placehold.co/200x200/e91e63/fff?text=🎈',
          rarity: 'common',
          totalSupply: 10000
        },
        status: 'active',
        totalGifts: 100,
        totalRounds: 1,
        giftsPerRound: 1,
        winnersPerRound: 1,
        minBidAmount: 25,
        bidIncrement: 5,
        highestBid: 45,
        totalBids: 4,
        scheduledStartAt: new Date(now.getTime() - 10 * 60 * 1000),
        endsAt: new Date(now.getTime() + 120 * 60 * 1000)
      }
    ]

    const auctions = await Auction.insertMany(auctionsData)
    console.log('🏆 Created', auctions.length, 'active auctions')

    // Create rounds for each auction
    for (const auction of auctions) {
      await Round.create({
        auctionId: auction._id.toString(),
        roundNumber: 1,
        status: 'active',
        giftsAvailable: auction.totalGifts,
        startsAt: auction.scheduledStartAt,
        endsAt: auction.endsAt,
        originalEndsAt: auction.endsAt
      })
    }
    console.log('🔄 Created rounds for all auctions')

    // Create a scheduled auction
    const scheduledAuction = await Auction.create({
      title: 'Teddy Bear',
      description: 'A cuddly friend for everyone.',
      gift: {
        id: 'bear-001',
        name: '🧸 Teddy Bear',
        description: 'A cuddly friend for everyone.',
        imageUrl: 'https://placehold.co/200x200/795548/fff?text=🧸',
        rarity: 'common',
        totalSupply: 3000
      },
      status: 'scheduled',
      totalGifts: 30,
      totalRounds: 1,
      giftsPerRound: 1,
      winnersPerRound: 1,
      minBidAmount: 30,
      bidIncrement: 5,
      highestBid: 30,
      totalBids: 0,
      scheduledStartAt: new Date(now.getTime() + 30 * 60 * 1000),
      endsAt: new Date(now.getTime() + 150 * 60 * 1000)
    })
    console.log('⏳ Created 1 scheduled auction')

    console.log('\n✨ Seeding completed successfully!')
    console.log('\nTest data summary:')
    console.log(`  - ${await User.countDocuments()} users`)
    console.log(`  - ${await Balance.countDocuments()} balances`)
    console.log(`  - ${await Auction.countDocuments({ status: 'active' })} active auctions`)
    console.log(`  - ${await Auction.countDocuments({ status: 'scheduled' })} scheduled auctions`)
    console.log(`  - ${await Round.countDocuments()} rounds`)
    
    console.log('\n💡 Test user credentials:')
    console.log('   Telegram ID: 123456789')
    console.log('   Balance: 5000 ⭐')
    console.log('\n🤖 Run stress-test to add bots that will compete with you!')

  } catch (error) {
    console.error('❌ Seeding failed:', error)
    process.exit(1)
  } finally {
    await mongoose.disconnect()
    console.log('\n🔌 Disconnected from MongoDB')
  }
}

seedTestData()
