import mongoose, { Schema, Document } from 'mongoose';

export interface IAchievement extends Document {
  code: string; // уникальный код
  name: string;
  description: string;
  icon?: string;
  criteria: string; // описание условия
  createdAt: Date;
}

const AchievementSchema = new Schema<IAchievement>({
  code: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  description: { type: String, required: true },
  icon: { type: String },
  criteria: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

export const Achievement = mongoose.model<IAchievement>('Achievement', AchievementSchema);
export default Achievement;
