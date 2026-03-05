import mongoose, { Schema, Document, Model } from 'mongoose';
import { IUser, UserRank, IUserStats } from '../types';

// ==================== INTERFACE ====================

export interface IUserDocument extends Omit<IUser, '_id'>, Document {}

// ==================== SCHEMA ====================

const UserStatsSchema = new Schema<IUserStats>(
  {
    totalBids: { type: Number, default: 0 },
    totalWins: { type: Number, default: 0 },
    totalSpent: { type: Number, default: 0 },
    auctionsParticipated: { type: Number, default: 0 },
    winRate: { type: Number, default: 0 },
    currentStreak: { type: Number, default: 0 },
    bestStreak: { type: Number, default: 0 },
  },
  { _id: false }
);

const UserSchema = new Schema<IUserDocument>(
  {
    telegramId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    username: {
      type: String,
      sparse: true,
      index: true,
    },
    firstName: {
      type: String,
      required: true,
    },
    lastName: {
      type: String,
    },
    photoUrl: {
      type: String,
    },
    rank: {
      type: String,
      enum: Object.values(UserRank),
      default: UserRank.BRONZE,
    },
    stats: {
      type: UserStatsSchema,
      default: () => ({}),
    },
    // Bot marker for stress testing
    isBot: {
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

UserSchema.index({ rank: 1, 'stats.totalWins': -1 });
UserSchema.index({ 'stats.totalSpent': -1 });

// ==================== METHODS ====================

UserSchema.methods.updateWinRate = function () {
  if (this.stats.totalBids > 0) {
    this.stats.winRate = (this.stats.totalWins / this.stats.totalBids) * 100;
  }
};

UserSchema.methods.calculateRank = function (): UserRank {
  const { totalWins, totalSpent, winRate } = this.stats;

  if (totalWins >= 50 && winRate >= 30) return UserRank.LEGEND;
  if (totalSpent >= 10000 || totalWins >= 30) return UserRank.WHALE;
  if (totalSpent >= 5000 || totalWins >= 15) return UserRank.DIAMOND;
  if (totalSpent >= 1000 || totalWins >= 5) return UserRank.GOLD;
  if (totalSpent >= 100 || totalWins >= 1) return UserRank.SILVER;
  return UserRank.BRONZE;
};

// ==================== STATICS ====================

UserSchema.statics.findByTelegramId = function (telegramId: string) {
  return this.findOne({ telegramId });
};

UserSchema.statics.getLeaderboard = function (limit = 100) {
  return this.find()
    .sort({ 'stats.totalWins': -1, 'stats.totalSpent': -1 })
    .limit(limit)
    .select('telegramId username firstName lastName rank stats photoUrl');
};

// ==================== MODEL ====================

export interface IUserModel extends Model<IUserDocument> {
  findByTelegramId(telegramId: string): Promise<IUserDocument | null>;
  getLeaderboard(limit?: number): Promise<IUserDocument[]>;
}

export const User = mongoose.model<IUserDocument, IUserModel>('User', UserSchema);
export default User;
