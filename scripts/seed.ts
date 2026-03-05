import mongoose from 'mongoose'
import dotenv from 'dotenv'

dotenv.config()

// Gift model
const giftSchema = new mongoose.Schema({
  telegramGiftId: String,
  name: { type: String, required: true },
  imageUrl: String,
  lottieUrl: String,
  rarity: { type: String, enum: ['common', 'rare', 'epic', 'legendary'], default: 'common' },
  basePrice: { type: Number, default: 100 },
  totalInCirculation: Number,
  description: String,
  isActive: { type: Boolean, default: true }
}, { timestamps: true })

// Auction model
const auctionSchema = new mongoose.Schema({
  giftId: { type: mongoose.Schema.Types.ObjectId, ref: 'Gift', required: true },
  startingPrice: { type: Number, required: true },
  currentPrice: { type: Number, required: true },
  incrementAmount: { type: Number, default: 10 },
  startTime: { type: Date, default: Date.now },
  endTime: { type: Date, required: true },
  status: { type: String, enum: ['pending', 'active', 'completed', 'cancelled'], default: 'pending' },
  winnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  totalBids: { type: Number, default: 0 },
  currency: { type: String, enum: ['stars', 'ton'], default: 'stars' },
  antiSnipeEnabled: { type: Boolean, default: true },
  antiSnipeMinutes: { type: Number, default: 2 }
}, { timestamps: true })

// User model
const userSchema = new mongoose.Schema({
  telegramId: { type: Number, required: true, unique: true },
  username: String,
  firstName: { type: String, required: true },
  lastName: String,
  photoUrl: String,
  languageCode: String,
  balance: { type: Number, default: 1000 },
  tonBalance: { type: Number, default: 10 },
  totalSpent: { type: Number, default: 0 },
  totalWins: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  isPremium: { type: Boolean, default: false }
}, { timestamps: true })

const Gift = mongoose.model('Gift', giftSchema)
const Auction = mongoose.model('Auction', auctionSchema)
const User = mongoose.model('User', userSchema)

async function seed() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/telegram-gift-auction'
    await mongoose.connect(mongoUri)
    console.log('✅ Connected to MongoDB')

    // Clear existing data
    await Gift.deleteMany({})
    await Auction.deleteMany({})
    await User.deleteMany({})
    console.log('🗑️  Cleared existing data')

    // Create test user
    const testUser = await User.create({
      telegramId: 123456789,
      username: 'testuser',
      firstName: 'Test',
      lastName: 'User',
      balance: 5000,
      tonBalance: 25,
      totalSpent: 1500,
      totalWins: 3,
      isPremium: true
    })
    console.log('👤 Created test user:', testUser.firstName)

    // Create more users for leaderboard
    const users = await User.insertMany([
      { telegramId: 111111111, firstName: 'Alex', lastName: 'Winner', balance: 10000, totalSpent: 5000, totalWins: 10 },
      { telegramId: 222222222, firstName: 'Maria', lastName: 'Pro', balance: 8000, totalSpent: 4000, totalWins: 8 },
      { telegramId: 333333333, firstName: 'John', lastName: 'Bid', balance: 6000, totalSpent: 3000, totalWins: 5 },
      { telegramId: 444444444, firstName: 'Emma', lastName: 'Star', balance: 4000, totalSpent: 2000, totalWins: 3 },
      { telegramId: 555555555, firstName: 'Max', lastName: 'Gift', balance: 2000, totalSpent: 1000, totalWins: 1 },
    ])
    console.log('👥 Created', users.length, 'additional users')

    // Create gifts with different rarities
    const gifts = await Gift.insertMany([
      {
        name: '🎂 Delicious Cake',
        rarity: 'legendary',
        basePrice: 1000,
        description: 'A super rare delicious cake! Perfect for celebrations.',
        imageUrl: 'https://placehold.co/200x200/ffd700/fff?text=🎂'
      },
      {
        name: '🦄 Magic Unicorn',
        rarity: 'epic',
        basePrice: 500,
        description: 'A magical unicorn that brings luck!',
        imageUrl: 'https://placehold.co/200x200/9b59b6/fff?text=🦄'
      },
      {
        name: '🌟 Shooting Star',
        rarity: 'epic',
        basePrice: 400,
        description: 'Make a wish on this shooting star!',
        imageUrl: 'https://placehold.co/200x200/e74c3c/fff?text=🌟'
      },
      {
        name: '🎁 Mystery Box',
        rarity: 'rare',
        basePrice: 250,
        description: 'What could be inside? Open to find out!',
        imageUrl: 'https://placehold.co/200x200/3498db/fff?text=🎁'
      },
      {
        name: '💎 Crystal Diamond',
        rarity: 'rare',
        basePrice: 300,
        description: 'A sparkling diamond for your collection.',
        imageUrl: 'https://placehold.co/200x200/1abc9c/fff?text=💎'
      },
      {
        name: '🌈 Rainbow',
        rarity: 'common',
        basePrice: 100,
        description: 'A beautiful rainbow to brighten your day.',
        imageUrl: 'https://placehold.co/200x200/f39c12/fff?text=🌈'
      },
      {
        name: '🎈 Party Balloon',
        rarity: 'common',
        basePrice: 50,
        description: 'Ready for any celebration!',
        imageUrl: 'https://placehold.co/200x200/e91e63/fff?text=🎈'
      },
      {
        name: '🧸 Teddy Bear',
        rarity: 'common',
        basePrice: 75,
        description: 'A cuddly friend for everyone.',
        imageUrl: 'https://placehold.co/200x200/795548/fff?text=🧸'
      }
    ])
    console.log('🎁 Created', gifts.length, 'gifts')

    // Create active auctions
    const now = new Date()
    const auctions = await Auction.insertMany([
      {
        giftId: gifts[0]._id, // Legendary cake
        startingPrice: 500,
        currentPrice: 1250,
        incrementAmount: 50,
        startTime: new Date(now.getTime() - 60 * 60 * 1000), // Started 1 hour ago
        endTime: new Date(now.getTime() + 30 * 60 * 1000), // Ends in 30 min
        status: 'active',
        totalBids: 15,
        antiSnipeEnabled: true
      },
      {
        giftId: gifts[1]._id, // Epic unicorn
        startingPrice: 200,
        currentPrice: 450,
        incrementAmount: 25,
        startTime: new Date(now.getTime() - 30 * 60 * 1000),
        endTime: new Date(now.getTime() + 45 * 60 * 1000),
        status: 'active',
        totalBids: 10,
        antiSnipeEnabled: true
      },
      {
        giftId: gifts[2]._id, // Epic star
        startingPrice: 150,
        currentPrice: 300,
        incrementAmount: 20,
        startTime: new Date(now.getTime() - 20 * 60 * 1000),
        endTime: new Date(now.getTime() + 5 * 60 * 1000), // Ending soon!
        status: 'active',
        totalBids: 8,
        antiSnipeEnabled: true
      },
      {
        giftId: gifts[3]._id, // Rare mystery box
        startingPrice: 100,
        currentPrice: 180,
        incrementAmount: 15,
        startTime: new Date(now.getTime() - 45 * 60 * 1000),
        endTime: new Date(now.getTime() + 2 * 60 * 60 * 1000),
        status: 'active',
        totalBids: 6,
        antiSnipeEnabled: true
      },
      {
        giftId: gifts[4]._id, // Rare diamond
        startingPrice: 100,
        currentPrice: 100,
        incrementAmount: 15,
        startTime: now,
        endTime: new Date(now.getTime() + 3 * 60 * 60 * 1000),
        status: 'active',
        totalBids: 0,
        antiSnipeEnabled: true
      },
      {
        giftId: gifts[5]._id, // Common rainbow
        startingPrice: 50,
        currentPrice: 85,
        incrementAmount: 10,
        startTime: new Date(now.getTime() - 15 * 60 * 1000),
        endTime: new Date(now.getTime() + 90 * 60 * 1000),
        status: 'active',
        totalBids: 4,
        antiSnipeEnabled: true
      },
      {
        giftId: gifts[6]._id, // Common balloon
        startingPrice: 25,
        currentPrice: 45,
        incrementAmount: 5,
        startTime: new Date(now.getTime() - 10 * 60 * 1000),
        endTime: new Date(now.getTime() + 120 * 60 * 1000),
        status: 'active',
        totalBids: 4,
        antiSnipeEnabled: true
      }
    ])
    console.log('🏆 Created', auctions.length, 'active auctions')

    // Create a pending auction
    await Auction.create({
      giftId: gifts[7]._id, // Teddy bear
      startingPrice: 30,
      currentPrice: 30,
      incrementAmount: 5,
      startTime: new Date(now.getTime() + 30 * 60 * 1000), // Starts in 30 min
      endTime: new Date(now.getTime() + 150 * 60 * 1000),
      status: 'pending',
      totalBids: 0
    })
    console.log('⏳ Created 1 pending auction')

    console.log('\n✨ Seeding completed successfully!')
    console.log('\nTest data summary:')
    console.log(`  - ${await User.countDocuments()} users`)
    console.log(`  - ${await Gift.countDocuments()} gifts`)
    console.log(`  - ${await Auction.countDocuments({ status: 'active' })} active auctions`)
    console.log(`  - ${await Auction.countDocuments({ status: 'pending' })} pending auctions`)
    
    console.log('\n💡 Test user credentials:')
    console.log('   Telegram ID: 123456789')
    console.log('   Balance: 5000 ⭐')
    console.log('   TON: 25 💎')

  } catch (error) {
    console.error('❌ Seeding failed:', error)
    process.exit(1)
  } finally {
    await mongoose.disconnect()
    console.log('\n🔌 Disconnected from MongoDB')
  }
}

seed()
