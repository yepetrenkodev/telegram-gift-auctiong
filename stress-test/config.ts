/**
 * 🤖 Stress Test Configuration
 * 
 * All settings for bot behavior and auction generation
 */

export interface StressTestConfig {
  // Bot settings
  bots: {
    count: number;           // Number of trading bots
    minBalance: number;      // Min starting balance per bot
    maxBalance: number;      // Max starting balance per bot
    bidDelay: {
      min: number;           // Min delay between bids (ms)
      max: number;           // Max delay between bids (ms)
    };
    bidChance: number;       // Chance to bid when opportunity arises (0-1)
    maxBidMultiplier: number; // Max bid as multiplier of current price
  };

  // Auction settings
  auctions: {
    count: number;           // Number of auctions to create
    duration: {
      min: number;           // Min auction duration (seconds)
      max: number;           // Max auction duration (seconds)
    };
    startingPrice: {
      min: number;           // Min starting price
      max: number;           // Max starting price
    };
    bidIncrement: {
      min: number;           // Min bid increment
      max: number;           // Max bid increment
    };
  };

  // Gift templates
  gifts: {
    names: string[];
    rarities: ('common' | 'rare' | 'epic' | 'legendary')[];
    collections: string[];
  };

  // API settings
  api: {
    baseUrl: string;
    wsUrl: string;
  };

  // Logging
  verbose: boolean;
}

export const defaultConfig: StressTestConfig = {
  bots: {
    count: 10,
    minBalance: 1000,
    maxBalance: 10000,
    bidDelay: {
      min: 500,
      max: 3000,
    },
    bidChance: 0.7,
    maxBidMultiplier: 2.0,
  },

  auctions: {
    count: 5,
    duration: {
      min: 60,    // 1 minute
      max: 300,   // 5 minutes
    },
    startingPrice: {
      min: 10,
      max: 100,
    },
    bidIncrement: {
      min: 1,
      max: 10,
    },
  },

  gifts: {
    names: [
      'Golden Crown', 'Diamond Star', 'Ruby Heart', 'Emerald Phoenix',
      'Sapphire Moon', 'Crystal Rose', 'Platinum Dragon', 'Silver Wings',
      'Bronze Shield', 'Cosmic Gem', 'Rainbow Unicorn', 'Fire Spirit',
      'Ice Crystal', 'Thunder Bolt', 'Shadow Blade', 'Light Orb'
    ],
    rarities: ['common', 'rare', 'epic', 'legendary'],
    collections: ['Genesis', 'Cyber', 'Nature', 'Celebration', 'Cosmic'],
  },

  api: {
    baseUrl: 'http://localhost:3000/api',
    wsUrl: 'ws://localhost:3000',
  },

  verbose: true,
};

export function loadConfig(overrides: Partial<StressTestConfig> = {}): StressTestConfig {
  return {
    ...defaultConfig,
    ...overrides,
    bots: { ...defaultConfig.bots, ...overrides.bots },
    auctions: { ...defaultConfig.auctions, ...overrides.auctions },
    gifts: { ...defaultConfig.gifts, ...overrides.gifts },
    api: { ...defaultConfig.api, ...overrides.api },
  };
}
