import mongoose, { Schema, Document } from 'mongoose';

export interface IUserAchievement extends Document {
  userId: string;
  achievementCode: string;
  unlockedAt: Date;
  meta?: Record<string, any>;
}

const UserAchievementSchema = new Schema<IUserAchievement>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  achievementCode: { type: String, required: true },
  unlockedAt: { type: Date, default: Date.now },
  meta: { type: Schema.Types.Mixed },
});

UserAchievementSchema.index({ userId: 1, achievementCode: 1 }, { unique: true });

export const UserAchievement = mongoose.model<IUserAchievement>('UserAchievement', UserAchievementSchema);
export default UserAchievement;
