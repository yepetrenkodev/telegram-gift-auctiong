import mongoose, { Schema, Document, Model } from 'mongoose';
import { IAuction, AuctionStatus, IGift } from '../types';
import config from '../config';

// ==================== INTERFACE ====================

export interface IAuctionDocument extends Omit<IAuction, '_id'>, Document {
  isActive(): boolean;
  canAcceptBids(): boolean;
  getRemainingTime(): number;
}

// ==================== GIFT SUB-SCHEMA ====================

const GiftSchema = new Schema<IGift>(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String, required: true },
    imageUrl: { type: String, required: true },
    rarity: {
      type: String,
      enum: ['common', 'rare', 'epic', 'legendary'],
      default: 'common',
    },
    totalSupply: { type: Number, required: true },
    // Fragment-style attributes
    model: { type: String },
    backdrop: { type: String },
    symbol: { type: String },
    giftCollection: { type: String },
    number: { type: Number },
    timesSold: { type: Number, default: 0 },
    floorPrice: { type: Number },
    attributes: { type: Schema.Types.Mixed },
  },
  { _id: false }
);

// ==================== AUCTION SCHEMA ====================

const AuctionSchema = new Schema<IAuctionDocument>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      required: true,
      maxlength: 2000,
    },
    gift: {
      type: GiftSchema,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(AuctionStatus),
      default: AuctionStatus.DRAFT,
      index: true,
    },

    // Configuration
    totalGifts: {
      type: Number,
      required: true,
      min: 1,
    },
    totalRounds: {
      type: Number,
      required: true,
      min: 1,
    },
    giftsPerRound: {
      type: Number,
      required: true,
      min: 1,
    },
    winnersPerRound: {
      type: Number,
      required: true,
      default: 10,
      min: 1,
    },
    minBidAmount: {
      type: Number,
      required: true,
      default: config.auction.defaultMinBid,
      min: 1,
    },
    bidIncrement: {
      type: Number,
      required: true,
      default: config.auction.defaultBidIncrement,
      min: 1,
    },

    // Anti-sniping
    antiSnipeThresholdSeconds: {
      type: Number,
      default: config.auction.antiSnipeThresholdSeconds,
    },
    antiSnipeExtensionSeconds: {
      type: Number,
      default: config.auction.antiSnipeExtensionSeconds,
    },
    maxAntiSnipeExtensions: {
      type: Number,
      default: config.auction.maxAntiSnipeExtensions,
    },

    // Timing
    scheduledStartAt: {
      type: Date,
    },
    startedAt: {
      type: Date,
    },
    endsAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },

    // Stats
    currentRound: {
      type: Number,
      default: 0,
    },
    totalBids: {
      type: Number,
      default: 0,
    },
    totalParticipants: {
      type: Number,
      default: 0,
    },
    highestBid: {
      type: Number,
      default: 0,
    },
    // Stress test marker
    isStressTest: {
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

AuctionSchema.index({ status: 1, scheduledStartAt: 1 });
AuctionSchema.index({ status: 1, endsAt: 1 });
AuctionSchema.index({ 'gift.rarity': 1, status: 1 });

// ==================== METHODS ====================

AuctionSchema.methods.isActive = function (): boolean {
  return this.status === AuctionStatus.ACTIVE;
};

AuctionSchema.methods.canAcceptBids = function (): boolean {
  if (this.status !== AuctionStatus.ACTIVE) return false;
  if (!this.endsAt) return false;
  return new Date() < this.endsAt;
};

AuctionSchema.methods.getRemainingTime = function (): number {
  if (!this.endsAt) return 0;
  const remaining = this.endsAt.getTime() - Date.now();
  return Math.max(0, remaining);
};

// ==================== STATICS ====================

AuctionSchema.statics.findActive = function () {
  return this.find({ status: AuctionStatus.ACTIVE }).sort({ startedAt: -1 });
};

AuctionSchema.statics.findUpcoming = function () {
  return this.find({
    status: AuctionStatus.SCHEDULED,
    scheduledStartAt: { $gt: new Date() },
  }).sort({ scheduledStartAt: 1 });
};

AuctionSchema.statics.findByStatus = function (status: AuctionStatus) {
  return this.find({ status });
};

// ==================== MODEL ====================

export interface IAuctionModel extends Model<IAuctionDocument> {
  findActive(): Promise<IAuctionDocument[]>;
  findUpcoming(): Promise<IAuctionDocument[]>;
  findByStatus(status: AuctionStatus): Promise<IAuctionDocument[]>;
}

export const Auction = mongoose.model<IAuctionDocument, IAuctionModel>('Auction', AuctionSchema);
export default Auction;
