import mongoose, { Schema, Document } from 'mongoose';

// ==================== INTERFACE ====================

export interface IAutoBid {
  auctionId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  maxAmount: number;
  currentBid: number;
  isActive: boolean;
  bidCount: number;
  createdAt: Date;
  updatedAt: Date;
  lastBidAt?: Date;
  stoppedReason?: 'manual' | 'max_reached' | 'outbid' | 'auction_ended' | 'insufficient_funds';
}

export interface IAutoBidDocument extends IAutoBid, Document {
  canBid(requiredAmount: number): boolean;
  incrementBid(amount: number): Promise<void>;
  stop(reason: IAutoBid['stoppedReason']): Promise<void>;
}

// ==================== SCHEMA ====================

const AutoBidSchema = new Schema<IAutoBidDocument>(
  {
    auctionId: {
      type: Schema.Types.ObjectId,
      ref: 'Auction',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    maxAmount: {
      type: Number,
      required: true,
      min: 1,
    },
    currentBid: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    bidCount: {
      type: Number,
      default: 0,
    },
    lastBidAt: {
      type: Date,
    },
    stoppedReason: {
      type: String,
      enum: ['manual', 'max_reached', 'outbid', 'auction_ended', 'insufficient_funds'],
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for quick lookups
AutoBidSchema.index({ auctionId: 1, userId: 1 }, { unique: true });
AutoBidSchema.index({ auctionId: 1, isActive: 1 });

// ==================== METHODS ====================

AutoBidSchema.methods.canBid = function (requiredAmount: number): boolean {
  return this.isActive && this.maxAmount >= requiredAmount;
};

AutoBidSchema.methods.incrementBid = async function (amount: number): Promise<void> {
  this.currentBid = amount;
  this.bidCount += 1;
  this.lastBidAt = new Date();
  await this.save();
};

AutoBidSchema.methods.stop = async function (reason: IAutoBid['stoppedReason']): Promise<void> {
  this.isActive = false;
  this.stoppedReason = reason;
  await this.save();
};

// ==================== STATICS ====================

AutoBidSchema.statics.findActiveForAuction = function (auctionId: mongoose.Types.ObjectId) {
  return this.find({ auctionId, isActive: true }).sort({ maxAmount: -1 });
};

AutoBidSchema.statics.findByUserAndAuction = function (
  userId: mongoose.Types.ObjectId,
  auctionId: mongoose.Types.ObjectId
) {
  return this.findOne({ userId, auctionId });
};

// ==================== MODEL ====================

export const AutoBid = mongoose.model<IAutoBidDocument>('AutoBid', AutoBidSchema);

export default AutoBid;
