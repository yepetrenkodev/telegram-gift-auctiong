import mongoose, { Schema, Document, Model } from 'mongoose';
import { IRound, RoundStatus } from '../types';

// ==================== INTERFACE ====================

export interface IRoundDocument extends Omit<IRound, '_id'>, Document {
  isActive(): boolean;
  canAcceptBids(): boolean;
  getRemainingTime(): number;
  getRemainingBiddingTime(): number;
  canExtend(): boolean;
}

// ==================== SCHEMA ====================

const RoundSchema = new Schema<IRoundDocument>(
  {
    auctionId: {
      type: String,
      required: true,
      ref: 'Auction',
      index: true,
    },
    roundNumber: {
      type: Number,
      required: true,
      min: 1,
    },
    status: {
      type: String,
      enum: Object.values(RoundStatus),
      default: RoundStatus.PENDING,
      index: true,
    },

    giftsAvailable: {
      type: Number,
      required: true,
      min: 1,
    },

    // Timing
    startsAt: {
      type: Date,
      required: true,
    },
    endsAt: {
      type: Date,
      required: true,
    },
    originalEndsAt: {
      type: Date,
      required: true,
    },
    extensionCount: {
      type: Number,
      default: 0,
    },

    // Results
    winningBids: [{
      type: String,
      ref: 'Bid',
    }],
    totalBids: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// ==================== INDEXES ====================

RoundSchema.index({ auctionId: 1, roundNumber: 1 }, { unique: true });
RoundSchema.index({ status: 1, endsAt: 1 });

// ==================== METHODS ====================

RoundSchema.methods.isActive = function (): boolean {
  return this.status === RoundStatus.ACTIVE;
};

// Minimum buffer time before round end to accept bids (prevents last-second exploit)
const MIN_BID_BUFFER_MS = 3000; // 3 seconds

RoundSchema.methods.canAcceptBids = function (): boolean {
  if (this.status !== RoundStatus.ACTIVE) return false;
  // Add buffer before round end to prevent last-second bids
  // that can't trigger anti-snipe extension in time
  const now = Date.now();
  const endsAt = this.endsAt.getTime();
  return now < endsAt - MIN_BID_BUFFER_MS;
};

RoundSchema.methods.getRemainingTime = function (): number {
  const remaining = this.endsAt.getTime() - Date.now();
  return Math.max(0, remaining);
};

RoundSchema.methods.getRemainingBiddingTime = function (): number {
  // Returns remaining time for bidding (accounts for buffer)
  const remaining = this.endsAt.getTime() - Date.now() - MIN_BID_BUFFER_MS;
  return Math.max(0, remaining);
};

RoundSchema.methods.canExtend = function (): boolean {
  // Will be checked against auction's maxAntiSnipeExtensions
  return this.status === RoundStatus.ACTIVE;
};

// ==================== STATICS ====================

RoundSchema.statics.findByAuction = function (auctionId: string) {
  return this.find({ auctionId }).sort({ roundNumber: 1 });
};

RoundSchema.statics.findActiveRound = function (auctionId: string) {
  return this.findOne({ auctionId, status: RoundStatus.ACTIVE });
};

RoundSchema.statics.findCurrentRound = function (auctionId: string) {
  return this.findOne({ auctionId })
    .sort({ roundNumber: -1 })
    .where('status')
    .in([RoundStatus.ACTIVE, RoundStatus.PENDING]);
};

// ==================== MODEL ====================

export interface IRoundModel extends Model<IRoundDocument> {
  findByAuction(auctionId: string): Promise<IRoundDocument[]>;
  findActiveRound(auctionId: string): Promise<IRoundDocument | null>;
  findCurrentRound(auctionId: string): Promise<IRoundDocument | null>;
}

export const Round = mongoose.model<IRoundDocument, IRoundModel>('Round', RoundSchema);
export default Round;
