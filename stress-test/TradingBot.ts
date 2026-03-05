/**
 * 🤖 Trading Bot
 * 
 * Simulates a user placing bids on auctions
 */

import { io, Socket } from 'socket.io-client';
import axios, { AxiosInstance } from 'axios';
import { StressTestConfig } from './config';

export interface BotStats {
  id: string;
  name: string;
  balance: number;
  bidsPlaced: number;
  bidsWon: number;
  totalSpent: number;
  activeBids: Map<string, number>;
}

export class TradingBot {
  public id: string;
  public name: string;
  public balance: number;
  public telegramId: string;
  
  private config: StressTestConfig;
  private api: AxiosInstance;
  private socket: Socket | null = null;
  private isRunning: boolean = false;
  private stats: BotStats;
  private watchedAuctions: Set<string> = new Set();
  private bidTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    id: string,
    name: string,
    balance: number,
    config: StressTestConfig
  ) {
    this.id = id;
    this.name = name;
    this.balance = balance;
    this.telegramId = `bot_${id}_${Date.now()}`;
    this.config = config;
    
    this.api = axios.create({
      baseURL: config.api.baseUrl,
      headers: {
        'Content-Type': 'application/json',
        'X-Dev-User-Id': this.id,
      },
    });

    this.stats = {
      id: this.id,
      name: this.name,
      balance: this.balance,
      bidsPlaced: 0,
      bidsWon: 0,
      totalSpent: 0,
      activeBids: new Map(),
    };
  }

  async initialize(): Promise<void> {
    try {
      // Create bot user via stress-test endpoint
      const response = await this.api.post('/stress-test/bots', {
        name: this.name,
        balance: this.balance,
      });

      if (response.data.id) {
        this.id = response.data.id;
        this.telegramId = response.data.telegramId;
        this.api.defaults.headers['X-Dev-User-Id'] = this.id;
        this.log(`Initialized with user ID: ${this.id}`);
      }
    } catch (error: any) {
      this.log(`Failed to initialize: ${error.message}`, 'error');
      throw error;
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    
    // Connect to WebSocket
    this.socket = io(this.config.api.wsUrl, {
      transports: ['websocket'],
      auth: { token: `bot_${this.id}` },
    });

    this.socket.on('connect', () => {
      this.log('Connected to WebSocket');
    });

    this.socket.on('bidPlaced', (data: any) => {
      this.handleBidPlaced(data);
    });

    this.socket.on('auctionEnded', (data: any) => {
      this.handleAuctionEnded(data);
    });

    this.socket.on('outbid', (data: any) => {
      this.handleOutbid(data);
    });

    this.log('Bot started');
  }

  stop(): void {
    this.isRunning = false;
    
    // Clear all timers
    for (const timer of this.bidTimers.values()) {
      clearTimeout(timer);
    }
    this.bidTimers.clear();

    // Disconnect socket
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.log('Bot stopped');
  }

  async watchAuction(auctionId: string): Promise<void> {
    if (this.watchedAuctions.has(auctionId)) return;
    
    this.watchedAuctions.add(auctionId);
    
    if (this.socket) {
      this.socket.emit('joinAuction', { auctionId });
    }

    // Schedule first bid attempt
    this.scheduleBidAttempt(auctionId);
    this.log(`Watching auction: ${auctionId}`);
  }

  unwatchAuction(auctionId: string): void {
    this.watchedAuctions.delete(auctionId);
    
    const timer = this.bidTimers.get(auctionId);
    if (timer) {
      clearTimeout(timer);
      this.bidTimers.delete(auctionId);
    }

    if (this.socket) {
      this.socket.emit('leaveAuction', { auctionId });
    }
  }

  private scheduleBidAttempt(auctionId: string): void {
    if (!this.isRunning || !this.watchedAuctions.has(auctionId)) return;

    const delay = this.randomBetween(
      this.config.bots.bidDelay.min,
      this.config.bots.bidDelay.max
    );

    const timer = setTimeout(async () => {
      await this.attemptBid(auctionId);
      this.scheduleBidAttempt(auctionId); // Schedule next attempt
    }, delay);

    this.bidTimers.set(auctionId, timer);
  }

  private async attemptBid(auctionId: string): Promise<void> {
    if (!this.isRunning) return;

    // Random chance to skip this bid
    if (Math.random() > this.config.bots.bidChance) {
      return;
    }

    try {
      // Get current auction state
      const auctionResponse = await this.api.get(`/auctions/${auctionId}`);
      const auction = auctionResponse.data.auction || auctionResponse.data;

      if (auction.status !== 'active') {
        this.unwatchAuction(auctionId);
        return;
      }

      const currentPrice = auction.currentPrice || auction.highestBid || auction.startingPrice || 10;
      const bidIncrement = auction.incrementAmount || auction.bidIncrement || 1;
      const minBid = currentPrice + bidIncrement;
      const maxBid = Math.min(
        currentPrice * this.config.bots.maxBidMultiplier,
        this.balance * 0.5 // Don't bid more than 50% of balance
      );

      if (minBid > this.balance) {
        this.log(`Insufficient balance for auction ${auctionId}`);
        return;
      }

      // Calculate bid amount
      const bidAmount = Math.floor(this.randomBetween(minBid, Math.max(minBid, maxBid)));

      // Place bid
      const bidResponse = await this.api.post(`/auctions/${auctionId}/bid`, {
        amount: bidAmount,
      });

      if (bidResponse.data.bid || bidResponse.data.newPrice) {
        this.stats.bidsPlaced++;
        this.stats.activeBids.set(auctionId, bidAmount);
        this.balance = bidResponse.data.newBalance || (this.balance - bidAmount);
        this.log(`✅ Placed bid ${bidAmount}⭐ on auction ${auctionId}`);
      }
    } catch (error: any) {
      // Silently ignore bid errors (outbid, etc.)
      if (this.config.verbose && error.response?.status !== 400) {
        this.log(`Bid failed: ${error.message}`, 'error');
      }
    }
  }

  private handleBidPlaced(data: any): void {
    // If someone else outbid us, maybe respond
    if (data.userId !== this.id && this.watchedAuctions.has(data.auctionId)) {
      // Immediate response chance
      if (Math.random() < 0.3) {
        setTimeout(() => {
          this.attemptBid(data.auctionId);
        }, this.randomBetween(100, 500));
      }
    }
  }

  private handleOutbid(data: any): void {
    if (this.watchedAuctions.has(data.auctionId)) {
      this.log(`Outbid on auction ${data.auctionId}`);
      // Quick response to being outbid
      if (Math.random() < 0.5) {
        setTimeout(() => {
          this.attemptBid(data.auctionId);
        }, this.randomBetween(200, 1000));
      }
    }
  }

  private handleAuctionEnded(data: any): void {
    this.unwatchAuction(data.auctionId);
    
    if (data.winnerId === this.id) {
      this.stats.bidsWon++;
      const spent = this.stats.activeBids.get(data.auctionId) || 0;
      this.stats.totalSpent += spent;
      this.balance -= spent;
      this.log(`Won auction ${data.auctionId}!`);
    }
    
    this.stats.activeBids.delete(data.auctionId);
  }

  private randomBetween(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private log(message: string, level: 'info' | 'error' = 'info'): void {
    if (!this.config.verbose && level === 'info') return;
    
    const prefix = `[Bot ${this.name}]`;
    if (level === 'error') {
      console.error(`${prefix} ❌ ${message}`);
    } else {
      console.log(`${prefix} ${message}`);
    }
  }

  getStats(): BotStats {
    return {
      ...this.stats,
      balance: this.balance,
    };
  }
}
