/**
 * 🎮 Stress Test Manager
 * 
 * Orchestrates bots and auctions for stress testing
 */

import { TradingBot, BotStats } from './TradingBot';
import { AuctionGenerator, GeneratedAuction } from './AuctionGenerator';
import { StressTestConfig, loadConfig } from './config';
import axios from 'axios';

export interface StressTestStatus {
  isRunning: boolean;
  startedAt: Date | null;
  duration: number;
  bots: BotStats[];
  auctions: GeneratedAuction[];
  totalBids: number;
  totalWins: number;
}

export class StressTestManager {
  private config: StressTestConfig;
  private bots: TradingBot[] = [];
  private auctionGenerator: AuctionGenerator;
  private isRunning: boolean = false;
  private startedAt: Date | null = null;
  private statusInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(configOverrides: Partial<StressTestConfig> = {}) {
    this.config = loadConfig(configOverrides);
    this.auctionGenerator = new AuctionGenerator(this.config);
  }

  async initialize(): Promise<void> {
    console.log('\n🚀 Initializing Stress Test Manager...\n');
    console.log(`📊 Configuration:`);
    console.log(`   - Bots: ${this.config.bots.count}`);
    console.log(`   - Auctions: ${this.config.auctions.count}`);
    console.log(`   - Duration: ${this.config.auctions.duration.min}-${this.config.auctions.duration.max}s`);
    console.log(`   - API: ${this.config.api.baseUrl}`);
    console.log('');

    // Create bots
    await this.createBots();
  }

  private async createBots(): Promise<void> {
    console.log(`🤖 Creating ${this.config.bots.count} trading bots...\n`);

    const botNames = [
      'Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon',
      'Zeta', 'Eta', 'Theta', 'Iota', 'Kappa',
      'Lambda', 'Mu', 'Nu', 'Xi', 'Omicron',
      'Pi', 'Rho', 'Sigma', 'Tau', 'Upsilon',
    ];

    for (let i = 0; i < this.config.bots.count; i++) {
      const name = botNames[i] || `Bot-${i + 1}`;
      const balance = this.randomBetween(
        this.config.bots.minBalance,
        this.config.bots.maxBalance
      );

      const bot = new TradingBot(`bot-${i + 1}`, name, balance, this.config);
      await bot.initialize();
      this.bots.push(bot);

      console.log(`   ✅ ${name} (${balance}⭐)`);
    }

    console.log(`\n✅ Created ${this.bots.length} bots\n`);
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ Stress test already running');
      return;
    }

    this.isRunning = true;
    this.startedAt = new Date();

    console.log('\n🏁 Starting Stress Test...\n');

    // Start all bots
    for (const bot of this.bots) {
      await bot.start();
    }

    // Generate auctions
    const auctions = await this.auctionGenerator.generateAuctions();

    // Assign bots to watch auctions
    for (const auction of auctions) {
      // Each bot watches all auctions
      for (const bot of this.bots) {
        await bot.watchAuction(auction.id);
      }
    }

    // Start status reporting
    this.statusInterval = setInterval(() => {
      this.printStatus();
    }, 10000);

    // Start cleanup interval - check for expired auctions every 30s
    this.cleanupInterval = setInterval(() => {
      this.checkAndRefreshAuctions();
    }, 30000);

    console.log('\n🎯 Stress test is now running!\n');
    console.log('Commands:');
    console.log('  status  - Show current status');
    console.log('  add N   - Add N more auctions');
    console.log('  stop    - Stop the test\n');
  }

  private async checkAndRefreshAuctions(): Promise<void> {
    try {
      // Cleanup expired auctions on server
      await axios.post(`${this.config.api.baseUrl}/stress-test/cleanup-expired`, {
        deleteCompleted: false
      });

      // Check how many auctions are still active
      const createdAuctions = this.auctionGenerator.getCreatedAuctions();
      const now = new Date();
      const activeCount = createdAuctions.filter(a => new Date(a.endsAt) > now).length;

      // If less than half are active, create new ones
      if (activeCount < this.config.auctions.count / 2) {
        const toCreate = this.config.auctions.count - activeCount;
        console.log(`\n🔄 Refreshing auctions: ${activeCount} active, creating ${toCreate} new...\n`);
        await this.addAuctions(toCreate);
      }
    } catch (error: any) {
      if (this.config.verbose) {
        console.log(`⚠️ Cleanup check failed: ${error.message}`);
      }
    }
  }

  async addAuctions(count: number): Promise<void> {
    if (!this.isRunning) {
      console.log('⚠️ Stress test not running. Start it first.');
      return;
    }

    const auctions = await this.auctionGenerator.generateAuctions(count);

    // Assign bots to watch new auctions
    for (const auction of auctions) {
      for (const bot of this.bots) {
        await bot.watchAuction(auction.id);
      }
    }
  }

  stop(): void {
    if (!this.isRunning) {
      console.log('⚠️ Stress test not running');
      return;
    }

    console.log('\n🛑 Stopping Stress Test...\n');

    // Stop status reporting
    if (this.statusInterval) {
      clearInterval(this.statusInterval);
      this.statusInterval = null;
    }

    // Stop cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Stop all bots
    for (const bot of this.bots) {
      bot.stop();
    }

    this.isRunning = false;

    // Print final status
    this.printFinalReport();
  }

  getStatus(): StressTestStatus {
    const botStats = this.bots.map(bot => bot.getStats());
    
    return {
      isRunning: this.isRunning,
      startedAt: this.startedAt,
      duration: this.startedAt ? (Date.now() - this.startedAt.getTime()) / 1000 : 0,
      bots: botStats,
      auctions: this.auctionGenerator.getCreatedAuctions(),
      totalBids: botStats.reduce((sum, b) => sum + b.bidsPlaced, 0),
      totalWins: botStats.reduce((sum, b) => sum + b.bidsWon, 0),
    };
  }

  printStatus(): void {
    const status = this.getStatus();
    
    console.log('\n' + '═'.repeat(50));
    console.log('📊 STRESS TEST STATUS');
    console.log('═'.repeat(50));
    console.log(`⏱️  Duration: ${Math.floor(status.duration)}s`);
    console.log(`🎯 Auctions: ${status.auctions.length}`);
    console.log(`🤖 Bots: ${status.bots.length}`);
    console.log(`📈 Total Bids: ${status.totalBids}`);
    console.log(`🏆 Total Wins: ${status.totalWins}`);
    console.log('─'.repeat(50));
    console.log('Bot Performance:');
    
    for (const bot of status.bots) {
      const winRate = bot.bidsPlaced > 0 
        ? ((bot.bidsWon / bot.bidsPlaced) * 100).toFixed(1) 
        : '0.0';
      console.log(`  ${bot.name}: ${bot.bidsPlaced} bids, ${bot.bidsWon} wins (${winRate}%), ${bot.balance}⭐ left`);
    }
    console.log('═'.repeat(50) + '\n');
  }

  private printFinalReport(): void {
    const status = this.getStatus();
    
    console.log('\n' + '═'.repeat(60));
    console.log('📋 FINAL STRESS TEST REPORT');
    console.log('═'.repeat(60));
    console.log(`⏱️  Total Duration: ${Math.floor(status.duration)}s`);
    console.log(`🎯 Auctions Created: ${status.auctions.length}`);
    console.log(`🤖 Bots Active: ${status.bots.length}`);
    console.log(`📈 Total Bids Placed: ${status.totalBids}`);
    console.log(`🏆 Total Auctions Won: ${status.totalWins}`);
    console.log(`📊 Avg Bids/Auction: ${(status.totalBids / Math.max(1, status.auctions.length)).toFixed(1)}`);
    console.log('─'.repeat(60));
    console.log('\n🏅 Bot Leaderboard:');
    
    const sortedBots = [...status.bots].sort((a, b) => b.bidsWon - a.bidsWon);
    
    sortedBots.forEach((bot, index) => {
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '  ';
      const winRate = bot.bidsPlaced > 0 
        ? ((bot.bidsWon / bot.bidsPlaced) * 100).toFixed(1) 
        : '0.0';
      console.log(`${medal} ${index + 1}. ${bot.name}`);
      console.log(`      Bids: ${bot.bidsPlaced} | Wins: ${bot.bidsWon} | Win Rate: ${winRate}%`);
      console.log(`      Spent: ${bot.totalSpent}⭐ | Remaining: ${bot.balance}⭐`);
    });
    
    console.log('\n' + '═'.repeat(60) + '\n');
  }

  async cleanup(): Promise<void> {
    await this.auctionGenerator.cleanupAuctions();
  }

  updateConfig(updates: Partial<StressTestConfig>): void {
    this.config = loadConfig({ ...this.config, ...updates });
    console.log('✅ Configuration updated');
  }

  private randomBetween(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}
