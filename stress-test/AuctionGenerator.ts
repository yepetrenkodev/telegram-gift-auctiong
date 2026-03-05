/**
 * 🎁 Auction Generator
 * 
 * Creates test auctions with random gifts
 */

import axios, { AxiosInstance } from 'axios';
import { StressTestConfig } from './config';

export interface GeneratedAuction {
  id: string;
  title: string;
  gift: {
    name: string;
    rarity: string;
    collection: string;
  };
  startingPrice: number;
  duration: number;
  endsAt: Date;
}

export class AuctionGenerator {
  private config: StressTestConfig;
  private api: AxiosInstance;
  private createdAuctions: GeneratedAuction[] = [];

  constructor(config: StressTestConfig) {
    this.config = config;
    this.api = axios.create({
      baseURL: config.api.baseUrl,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async generateAuctions(count?: number): Promise<GeneratedAuction[]> {
    const numAuctions = count || this.config.auctions.count;
    const auctions: GeneratedAuction[] = [];

    console.log(`\n🎁 Generating ${numAuctions} auctions...\n`);

    for (let i = 0; i < numAuctions; i++) {
      try {
        const auction = await this.createAuction(i + 1);
        if (auction) {
          auctions.push(auction);
          this.createdAuctions.push(auction);
        }
      } catch (error: any) {
        console.error(`Failed to create auction ${i + 1}: ${error.message}`);
      }
    }

    console.log(`\n✅ Created ${auctions.length} auctions\n`);
    return auctions;
  }

  private async createAuction(index: number): Promise<GeneratedAuction | null> {
    const gift = this.generateGift();
    const duration = this.randomBetween(
      this.config.auctions.duration.min,
      this.config.auctions.duration.max
    );
    const startingPrice = this.randomBetween(
      this.config.auctions.startingPrice.min,
      this.config.auctions.startingPrice.max
    );
    const bidIncrement = this.randomBetween(
      this.config.auctions.bidIncrement.min,
      this.config.auctions.bidIncrement.max
    );

    const endsAt = new Date(Date.now() + duration * 1000);

    const auctionData = {
      title: `${gift.name} #${index}`,
      description: `Stress test auction for ${gift.name}. Rarity: ${gift.rarity}. Collection: ${gift.collection}.`,
      gift: {
        id: `stress-gift-${Date.now()}-${index}`,
        name: gift.name,
        description: `A beautiful ${gift.rarity} ${gift.name} from the ${gift.collection} collection.`,
        imageUrl: this.getGiftImage(gift.rarity),
        rarity: gift.rarity,
        totalSupply: this.randomBetween(100, 10000),
        giftModel: gift.name.split(' ')[0],
        backdrop: gift.collection,
        symbol: this.getSymbol(gift.rarity),
        giftCollection: gift.collection,
        number: this.randomBetween(1, 50000),
      },
      totalGifts: 1,
      totalRounds: 1,
      giftsPerRound: 1,
      winnersPerRound: 1,
      minBidAmount: startingPrice,
      bidIncrement: bidIncrement,
      scheduledStartAt: new Date(), // Start immediately
      endsAt: endsAt,
      status: 'active',
    };

    try {
      // Use the stress-test specific endpoint
      const response = await this.api.post('/stress-test/auctions', auctionData);
      
      const auction: GeneratedAuction = {
        id: response.data.auction?.id || response.data.id,
        title: auctionData.title,
        gift: {
          name: gift.name,
          rarity: gift.rarity,
          collection: gift.collection,
        },
        startingPrice,
        duration,
        endsAt,
      };

      console.log(`  ✅ Created: ${auction.title} (${duration}s, ${startingPrice}⭐)`);
      return auction;
    } catch (error: any) {
      console.error(`  ❌ Failed to create auction: ${error.response?.data?.error || error.message}`);
      return null;
    }
  }

  private generateGift(): { name: string; rarity: string; collection: string } {
    const names = this.config.gifts.names;
    const rarities = this.config.gifts.rarities;
    const collections = this.config.gifts.collections;

    // Weight rarities
    const rarityWeights = {
      common: 0.5,
      rare: 0.3,
      epic: 0.15,
      legendary: 0.05,
    };

    const rand = Math.random();
    let cumulative = 0;
    let selectedRarity = 'common';
    
    for (const [rarity, weight] of Object.entries(rarityWeights)) {
      cumulative += weight;
      if (rand <= cumulative) {
        selectedRarity = rarity;
        break;
      }
    }

    return {
      name: names[Math.floor(Math.random() * names.length)],
      rarity: selectedRarity,
      collection: collections[Math.floor(Math.random() * collections.length)],
    };
  }

  private getGiftImage(rarity: string): string {
    const images: Record<string, string> = {
      common: 'https://placehold.co/400x400/3b82f6/ffffff?text=Common',
      rare: 'https://placehold.co/400x400/8b5cf6/ffffff?text=Rare',
      epic: 'https://placehold.co/400x400/ec4899/ffffff?text=Epic',
      legendary: 'https://placehold.co/400x400/f59e0b/ffffff?text=Legendary',
    };
    return images[rarity] || images.common;
  }

  private getSymbol(rarity: string): string {
    const symbols: Record<string, string> = {
      common: '⭐',
      rare: '💎',
      epic: '🔥',
      legendary: '👑',
    };
    return symbols[rarity] || '⭐';
  }

  private randomBetween(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  getCreatedAuctions(): GeneratedAuction[] {
    return this.createdAuctions;
  }

  async cleanupAuctions(): Promise<void> {
    console.log('\n🧹 Cleaning up stress test auctions...');
    
    for (const auction of this.createdAuctions) {
      try {
        await this.api.delete(`/stress-test/auctions/${auction.id}`);
        console.log(`  ✅ Deleted: ${auction.title}`);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    
    this.createdAuctions = [];
    console.log('✅ Cleanup complete\n');
  }
}
