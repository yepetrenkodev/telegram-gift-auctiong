import mongoose, { Schema, Document, Model } from 'mongoose';
import { IBid, BidStatus } from '../types';

// ==================== INTERFACE ====================

export interface IBidDocument extends Omit<IBid, '_id'>, Document {}

// ==================== SCHEMA ====================

const BidSchema = new Schema<IBidDocument>(
  {
    auctionId: {
      type: String,
      required: true,
      ref: 'Auction',
      index: true,
    },
    roundId: {
      type: String,
      required: true,
      ref: 'Round',
      index: true,
    },
    userId: {
      type: String,
      required: true,
      ref: 'User',
      index: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 1,
    },
    status: {
      type: String,
      enum: Object.values(BidStatus),
      default: BidStatus.ACTIVE,
      index: true,
    },

    // Auto-bid reference
    isAutoBid: {
      type: Boolean,
      default: false,
    },
    autoBidConfigId: {
      type: String,
      ref: 'AutoBidConfig',
    },

    // Timing
    placedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    processedAt: {
      type: Date,
    },

    // Anti-snipe tracking
    triggeredExtension: {
      type: Boolean,
      default: false,
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

// For finding top bids in a round
BidSchema.index({ roundId: 1, amount: -1, placedAt: 1 });

// For user's bid history
BidSchema.index({ userId: 1, placedAt: -1 });

// For finding active bids
BidSchema.index({ roundId: 1, status: 1, amount: -1 });

// For unique user bid per round (highest only)
BidSchema.index({ roundId: 1, userId: 1 });

// ==================== STATICS ====================

BidSchema.statics.findByRound = function (roundId: string) {
  return this.find({ roundId }).sort({ amount: -1, placedAt: 1 });
};

BidSchema.statics.findTopBids = function (roundId: string, limit: number) {
  return this.find({ roundId, status: BidStatus.ACTIVE })
    .sort({ amount: -1, placedAt: 1 })
    .limit(limit);
};

BidSchema.statics.findUserBidInRound = function (roundId: string, userId: string) {
  return this.findOne({ roundId, userId, status: BidStatus.ACTIVE });
};

BidSchema.statics.findUserBids = function (userId: string, limit = 50) {
  return this.find({ userId })
    .sort({ placedAt: -1 })
    .limit(limit)
    .populate('auctionId', 'title gift');
};

BidSchema.statics.getHighestBidInRound = function (roundId: string) {
  return this.findOne({ roundId, status: BidStatus.ACTIVE })
    .sort({ amount: -1, placedAt: 1 });
};

BidSchema.statics.countBidsInRound = function (roundId: string) {
  return this.countDocuments({ roundId });
};

BidSchema.statics.getUniqueParticipants = function (auctionId: string) {
  return this.distinct('userId', { auctionId });
};

// ==================== MODEL ====================

export interface IBidModel extends Model<IBidDocument> {
  findByRound(roundId: string): Promise<IBidDocument[]>;
  findTopBids(roundId: string, limit: number): Promise<IBidDocument[]>;
  findUserBidInRound(roundId: string, userId: string): Promise<IBidDocument | null>;
  findUserBids(userId: string, limit?: number): Promise<IBidDocument[]>;
  getHighestBidInRound(roundId: string): Promise<IBidDocument | null>;
  countBidsInRound(roundId: string): Promise<number>;
  getUniqueParticipants(auctionId: string): Promise<string[]>;
}

export const Bid = mongoose.model<IBidDocument, IBidModel>('Bid', BidSchema);
export default Bid;
