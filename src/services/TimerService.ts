import { Auction, Round } from '../models';
import { socketService } from './SocketService';
import { leaderboardService } from './LeaderboardService';
import { auctionService } from './AuctionService';
import logger from '../utils/logger';

/**
 * ⏱️ Timer Service
 * 
 * Manages auction round timers:
 * - Countdown broadcasts
 * - Round end detection
 * - Anti-snipe extensions
 * - Timer synchronization
 */

interface ActiveTimer {
  auctionId: string;
  roundNumber: number;
  endsAt: Date;
  intervalId: NodeJS.Timeout;
  lastBroadcast: number;
}

class TimerService {
  private timers: Map<string, ActiveTimer> = new Map();
  private tickInterval: NodeJS.Timeout | null = null;

  /**
   * Get timer key
   */
  private getKey(auctionId: string, roundNumber: number): string {
    return `${auctionId}:${roundNumber}`;
  }

  /**
   * Initialize global tick interval
   */
  initialize(): void {
    // Global tick every second for all active timers
    this.tickInterval = setInterval(() => {
      this.tick();
    }, 1000);

    logger.info('✅ Timer service initialized');
  }

  /**
   * Stop timer service
   */
  shutdown(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }

    // Clear all active timers
    for (const timer of this.timers.values()) {
      clearInterval(timer.intervalId);
    }
    this.timers.clear();

    logger.info('Timer service stopped');
  }

  /**
   * Global tick - process all active timers
   */
  private async tick(): Promise<void> {
    const now = Date.now();

    for (const [key, timer] of this.timers.entries()) {
      const secondsLeft = Math.max(0, Math.floor((timer.endsAt.getTime() - now) / 1000));

      // Broadcast tick every second
      socketService.broadcastTimerTick(timer.auctionId, secondsLeft);

      // Warning at 60, 30, 10 seconds
      if ([60, 30, 10].includes(secondsLeft)) {
        socketService.broadcastRoundEnding(timer.auctionId, secondsLeft);
      }

      // Round ended
      if (secondsLeft <= 0) {
        await this.handleRoundEnd(timer);
        this.timers.delete(key);
      }
    }
  }

  /**
   * Start timer for a round
   */
  async startTimer(auctionId: string, roundNumber: number, endsAt: Date): Promise<void> {
    const key = this.getKey(auctionId, roundNumber);

    // Clear existing timer if any
    const existing = this.timers.get(key);
    if (existing) {
      clearInterval(existing.intervalId);
    }

    // Create new timer
    const timer: ActiveTimer = {
      auctionId,
      roundNumber,
      endsAt,
      intervalId: setInterval(() => {}, 1000), // Placeholder, actual work done in global tick
      lastBroadcast: Date.now(),
    };

    this.timers.set(key, timer);

    // Broadcast initial sync
    const secondsLeft = Math.max(0, Math.floor((endsAt.getTime() - Date.now()) / 1000));
    socketService.broadcastTimer({
      auctionId,
      roundNumber,
      endsAt,
      secondsLeft,
      extended: false,
      extensionCount: 0,
    });

    logger.info(`Timer started: auction=${auctionId}, round=${roundNumber}, ends in ${secondsLeft}s`);
  }

  /**
   * Extend timer (anti-snipe)
   */
  async extendTimer(
    auctionId: string,
    roundNumber: number,
    newEndsAt: Date,
    extensionCount: number,
    triggeredBy: string
  ): Promise<void> {
    const key = this.getKey(auctionId, roundNumber);
    const timer = this.timers.get(key);

    if (timer) {
      timer.endsAt = newEndsAt;

      const secondsLeft = Math.max(0, Math.floor((newEndsAt.getTime() - Date.now()) / 1000));

      // Broadcast extension
      socketService.broadcastRoundExtended({
        auctionId,
        roundNumber,
        newEndsAt,
        extensionCount,
        triggeredBy,
      });

      socketService.broadcastTimer({
        auctionId,
        roundNumber,
        endsAt: newEndsAt,
        secondsLeft,
        extended: true,
        extensionCount,
      });

      logger.info(`Timer extended: auction=${auctionId}, ext #${extensionCount}, new end in ${secondsLeft}s`);
    }
  }

  /**
   * Stop timer for a round
   */
  stopTimer(auctionId: string, roundNumber: number): void {
    const key = this.getKey(auctionId, roundNumber);
    const timer = this.timers.get(key);

    if (timer) {
      clearInterval(timer.intervalId);
      this.timers.delete(key);
      logger.info(`Timer stopped: auction=${auctionId}, round=${roundNumber}`);
    }
  }

  /**
   * Handle round end
   */
  private async handleRoundEnd(timer: ActiveTimer): Promise<void> {
    const { auctionId, roundNumber } = timer;

    try {
      logger.info(`Round ending: auction=${auctionId}, round=${roundNumber}`);

      // End the round via auction service
      const result = await auctionService.endRound(auctionId, roundNumber);

      if (result) {
        // Broadcast round ended with winners
        socketService.broadcastRoundEnded({
          auctionId,
          roundNumber,
          winners: result.winners.map((w: { oduserId: string; userName: string; amount: number }, i: number) => ({
            oduserId: w.oduserId,
            userName: w.userName,
            amount: w.amount,
            position: i + 1,
          })),
          nextRound: result.nextRound ? {
            number: result.nextRound.number,
            startsAt: result.nextRound.startsAt,
          } : undefined,
        });

        // Clear leaderboard cache
        leaderboardService.clearCache(auctionId, roundNumber);

        // Start timer for next round if exists
        if (result.nextRound) {
          // Add delay before next round (e.g., 30 seconds)
          const nextRoundDelay = 30 * 1000;
          const nextRound = result.nextRound; // Capture for closure
          const nextRoundEndsAt = new Date(Date.now() + nextRoundDelay + nextRound.duration);

          setTimeout(() => {
            this.startTimer(auctionId, nextRound.number, nextRoundEndsAt);
          }, nextRoundDelay);
        }
      }
    } catch (error) {
      logger.error(`Error handling round end for auction=${auctionId}, round=${roundNumber}:`, error);
    }
  }

  /**
   * Sync timer with database (for recovery)
   */
  async syncFromDatabase(): Promise<void> {
    try {
      // Find all active auctions with running rounds
      const activeAuctions = await Auction.findActive();

      for (const auction of activeAuctions) {
        const currentRound = await Round.findOne({
          auctionId: auction._id,
          roundNumber: auction.currentRound,
          status: 'active',
        });

        if (currentRound && currentRound.endsAt) {
          const endsAt = new Date(currentRound.endsAt);
          const now = Date.now();

          if (endsAt.getTime() > now) {
            // Round still active, start timer
            await this.startTimer(
              auction._id.toString(),
              currentRound.roundNumber,
              endsAt
            );
          } else {
            // Round should have ended, trigger end
            await this.handleRoundEnd({
              auctionId: auction._id.toString(),
              roundNumber: currentRound.roundNumber,
              endsAt,
              intervalId: setInterval(() => {}, 1000),
              lastBroadcast: Date.now(),
            });
          }
        }
      }

      logger.info(`Synced ${activeAuctions.length} auction timers from database`);
    } catch (error) {
      logger.error('Error syncing timers from database:', error);
    }
  }

  /**
   * Get active timers info
   */
  getActiveTimers(): Array<{
    auctionId: string;
    roundNumber: number;
    secondsLeft: number;
  }> {
    const now = Date.now();
    return Array.from(this.timers.values()).map(timer => ({
      auctionId: timer.auctionId,
      roundNumber: timer.roundNumber,
      secondsLeft: Math.max(0, Math.floor((timer.endsAt.getTime() - now) / 1000)),
    }));
  }

  /**
   * Get count of active timers
   */
  getActiveTimersCount(): number {
    return this.timers.size;
  }

  /**
   * Check if timer is active for round
   */
  isTimerActive(auctionId: string, roundNumber: number): boolean {
    return this.timers.has(this.getKey(auctionId, roundNumber));
  }

  /**
   * Get seconds left for round
   */
  getSecondsLeft(auctionId: string, roundNumber: number): number {
    const timer = this.timers.get(this.getKey(auctionId, roundNumber));
    if (!timer) return 0;

    return Math.max(0, Math.floor((timer.endsAt.getTime() - Date.now()) / 1000));
  }
}

export const timerService = new TimerService();
export default timerService;
