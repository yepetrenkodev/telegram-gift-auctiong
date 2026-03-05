import mongoose, { Schema, Document } from 'mongoose';

/**
 * Activity Feed - лента активности в реальном времени
 */
export interface IActivityDocument extends Document {
  type: ActivityType;
  auctionId: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  
  // Данные события
  data: {
    userName?: string;
    userAvatar?: string;
    auctionTitle?: string;
    amount?: number;
    position?: number;
    giftName?: string;
    giftEmoji?: string;
    roundNumber?: number;
    message?: string;
  };
  
  timestamp: Date;
  isPublic: boolean;  // Показывать в общей ленте
}

export enum ActivityType {
  BID_PLACED = 'bid_placed',
  BID_OUTBID = 'bid_outbid',
  AUCTION_WON = 'auction_won',
  AUCTION_STARTED = 'auction_started',
  AUCTION_ENDING = 'auction_ending',
  AUCTION_ENDED = 'auction_ended',
  ROUND_STARTED = 'round_started',
  ROUND_ENDED = 'round_ended',
  NEW_PARTICIPANT = 'new_participant',
  PRICE_MILESTONE = 'price_milestone',  // Цена достигла X
}

const activitySchema = new Schema<IActivityDocument>(
  {
    type: {
      type: String,
      required: true,
      enum: Object.values(ActivityType),
      index: true,
    },
    auctionId: {
      type: Schema.Types.ObjectId,
      ref: 'Auction',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    data: {
      userName: String,
      userAvatar: String,
      auctionTitle: String,
      amount: Number,
      position: Number,
      giftName: String,
      giftEmoji: String,
      roundNumber: Number,
      message: String,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
    isPublic: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: false,
  }
);

// Составные индексы
activitySchema.index({ timestamp: -1 });
activitySchema.index({ auctionId: 1, timestamp: -1 });
activitySchema.index({ userId: 1, timestamp: -1 });
activitySchema.index({ isPublic: 1, timestamp: -1 });

// TTL - храним 7 дней
activitySchema.index({ timestamp: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

export const Activity = mongoose.model<IActivityDocument>('Activity', activitySchema);
