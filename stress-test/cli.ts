#!/usr/bin/env npx ts-node
/**
 * 🎮 Stress Test CLI
 * 
 * Interactive command-line interface for stress testing
 * 
 * Usage:
 *   npx ts-node stress-test/cli.ts [options]
 * 
 * Options:
 *   --bots N       Number of bots (default: 10)
 *   --auctions N   Number of auctions (default: 5)
 *   --duration N   Auction duration in seconds (default: 60-300)
 *   --verbose      Enable verbose logging
 *   --auto         Auto-start without prompts
 */

import * as readline from 'readline';
import { StressTestManager } from './StressTestManager';
import { StressTestConfig } from './config';

// Parse command line arguments
function parseArgs(): Partial<StressTestConfig> {
  const args = process.argv.slice(2);
  const config: Partial<StressTestConfig> = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--bots':
        config.bots = { count: parseInt(args[++i]) || 10 } as any;
        break;
      case '--auctions':
        config.auctions = { count: parseInt(args[++i]) || 5 } as any;
        break;
      case '--duration':
        const dur = parseInt(args[++i]) || 60;
        config.auctions = { 
          ...config.auctions,
          duration: { min: dur, max: dur } 
        } as any;
        break;
      case '--min-duration':
        config.auctions = {
          ...config.auctions,
          duration: { ...config.auctions?.duration, min: parseInt(args[++i]) || 60 }
        } as any;
        break;
      case '--max-duration':
        config.auctions = {
          ...config.auctions,
          duration: { ...config.auctions?.duration, max: parseInt(args[++i]) || 300 }
        } as any;
        break;
      case '--verbose':
        config.verbose = true;
        break;
      case '--quiet':
        config.verbose = false;
        break;
      case '--api':
        config.api = { baseUrl: args[++i] } as any;
        break;
      case '--help':
        printHelp();
        process.exit(0);
    }
  }

  return config;
}

function printHelp(): void {
  console.log(`
🤖 Telegram Gift Auction - Stress Test CLI

Usage:
  npx ts-node stress-test/cli.ts [options]

Options:
  --bots N          Number of trading bots (default: 10)
  --auctions N      Number of auctions to create (default: 5)
  --duration N      Fixed auction duration in seconds
  --min-duration N  Minimum auction duration (default: 60)
  --max-duration N  Maximum auction duration (default: 300)
  --verbose         Enable verbose logging
  --quiet           Disable verbose logging
  --api URL         API base URL (default: http://localhost:3000/api)
  --help            Show this help message

Interactive Commands (during test):
  status            Show current test status
  add N             Add N more auctions
  bots              Show bot statistics
  config            Show current configuration
  stop              Stop the test
  cleanup           Remove test auctions from database
  exit              Stop and exit

Examples:
  npx ts-node stress-test/cli.ts --bots 20 --auctions 10
  npx ts-node stress-test/cli.ts --duration 120 --verbose
`);
}

function printBanner(): void {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   🤖 TELEGRAM GIFT AUCTION - STRESS TEST                     ║
║                                                              ║
║   Simulate trading activity with multiple bots               ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`);
}

async function main(): Promise<void> {
  printBanner();

  const configOverrides = parseArgs();
  const manager = new StressTestManager(configOverrides);

  // Initialize
  await manager.initialize();

  // Create readline interface
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const prompt = () => rl.question('stress-test> ', handleCommand);

  async function handleCommand(input: string): Promise<void> {
    const [command, ...args] = input.trim().toLowerCase().split(/\s+/);

    switch (command) {
      case 'start':
        await manager.start();
        break;

      case 'stop':
        manager.stop();
        break;

      case 'status':
      case 's':
        manager.printStatus();
        break;

      case 'add':
        const count = parseInt(args[0]) || 1;
        await manager.addAuctions(count);
        break;

      case 'bots':
        const status = manager.getStatus();
        console.log('\n🤖 Bot Statistics:');
        for (const bot of status.bots) {
          console.log(`  ${bot.name}: ${bot.balance}⭐, ${bot.bidsPlaced} bids, ${bot.bidsWon} wins`);
        }
        console.log('');
        break;

      case 'config':
        console.log('\n📊 Current Configuration:');
        console.log(JSON.stringify(manager.getStatus(), null, 2));
        console.log('');
        break;

      case 'cleanup':
        await manager.cleanup();
        break;

      case 'exit':
      case 'quit':
      case 'q':
        manager.stop();
        await manager.cleanup();
        console.log('👋 Goodbye!');
        rl.close();
        process.exit(0);

      case 'help':
      case 'h':
      case '?':
        console.log(`
Available commands:
  start           Start the stress test
  stop            Stop the stress test
  status (s)      Show current status
  add N           Add N more auctions
  bots            Show bot statistics
  config          Show configuration
  cleanup         Remove test auctions
  exit (q)        Stop and exit
  help (h)        Show this help
`);
        break;

      case '':
        break;

      default:
        console.log(`Unknown command: ${command}. Type 'help' for available commands.`);
    }

    prompt();
  }

  // Handle Ctrl+C
  rl.on('close', () => {
    manager.stop();
    console.log('\n👋 Goodbye!');
    process.exit(0);
  });

  // Start prompt
  console.log("Type 'start' to begin the stress test, or 'help' for commands.\n");
  prompt();
}

// Run
main().catch(console.error);
