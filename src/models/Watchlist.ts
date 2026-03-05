import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Watchlist - пользователь может отслеживать интересные аукционы
 */
export interface IWatchlistDocument extends Document {
  userId: mongoose.Types.ObjectId;
  auctionId: mongoose.Types.ObjectId;
  addedAt: Date;
  notifyOnStart: boolean;      // Уведомлять при старте
  notifyOnEndingSoon: boolean; // Уведомлять за 5 мин до конца
  notifyOnOutbid: boolean;     // Уведомлять при перебитии
  notes?: string;              // Заметки пользователя
}

export interface IWatchlistModel extends Model<IWatchlistDocument> {
  getUserWatchlist(userId: string): Promise<IWatchlistDocument[]>;
  isWatching(userId: string, auctionId: string): Promise<boolean>;
  getWatchersCount(auctionId: string): Promise<number>;
}

const watchlistSchema = new Schema<IWatchlistDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    auctionId: {
      type: Schema.Types.ObjectId,
      ref: 'Auction',
      required: true,
      index: true,
    },
    addedAt: {
      type: Date,
      default: Date.now,
    },
    notifyOnStart: {
      type: Boolean,
      default: true,
    },
    notifyOnEndingSoon: {
      type: Boolean,
      default: true,
    },
    notifyOnOutbid: {
      type: Boolean,
      default: true,
    },
    notes: {
      type: String,
      maxlength: 500,
    },
  },
  {
    timestamps: true,
  }
);

// Уникальный индекс: один пользователь - один аукцион
watchlistSchema.index({ userId: 1, auctionId: 1 }, { unique: true });

// Статические методы
watchlistSchema.statics.getUserWatchlist = async function (
  userId: string
): Promise<IWatchlistDocument[]> {
  return this.find({ userId })
    .populate('auctionId')
    .sort({ addedAt: -1 });
};

watchlistSchema.statics.isWatching = async function (
  userId: string,
  auctionId: string
): Promise<boolean> {
  const count = await this.countDocuments({ userId, auctionId });
  return count > 0;
};

watchlistSchema.statics.getWatchersCount = async function (
  auctionId: string
): Promise<number> {
  return this.countDocuments({ auctionId });
};

export const Watchlist = mongoose.model<IWatchlistDocument, IWatchlistModel>(
  'Watchlist',
  watchlistSchema
);
