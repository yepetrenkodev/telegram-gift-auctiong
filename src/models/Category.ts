import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Category - категории аукционов
 */
export interface ICategoryDocument extends Document {
  name: string;
  slug: string;
  description?: string;
  icon?: string;           // Emoji или URL иконки
  color?: string;          // HEX цвет для UI
  sortOrder: number;
  isActive: boolean;
  auctionCount: number;    // Счётчик аукционов
}

const categorySchema = new Schema<ICategoryDocument>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    description: {
      type: String,
      maxlength: 500,
    },
    icon: {
      type: String,
      default: '🎁',
    },
    color: {
      type: String,
      default: '#6366f1',
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    auctionCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

categorySchema.index({ slug: 1 });
categorySchema.index({ sortOrder: 1 });

export const Category = mongoose.model<ICategoryDocument>('Category', categorySchema);

/**
 * Tag - теги для аукционов
 */
export interface ITagDocument extends Document {
  name: string;
  slug: string;
  type: 'system' | 'custom';  // system = автоматические (#hot, #ending-soon)
  color?: string;
  usageCount: number;
}

const tagSchema = new Schema<ITagDocument>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['system', 'custom'],
      default: 'custom',
    },
    color: {
      type: String,
      default: '#64748b',
    },
    usageCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

tagSchema.index({ slug: 1 });
tagSchema.index({ type: 1 });

export const Tag = mongoose.model<ITagDocument>('Tag', tagSchema);

// Системные теги (создаются при инициализации)
export const SYSTEM_TAGS = [
  { name: 'Hot', slug: 'hot', type: 'system', color: '#ef4444' },
  { name: 'New', slug: 'new', type: 'system', color: '#22c55e' },
  { name: 'Ending Soon', slug: 'ending-soon', type: 'system', color: '#f59e0b' },
  { name: 'Popular', slug: 'popular', type: 'system', color: '#8b5cf6' },
  { name: 'Rare', slug: 'rare', type: 'system', color: '#06b6d4' },
  { name: 'Featured', slug: 'featured', type: 'system', color: '#ec4899' },
] as const;
