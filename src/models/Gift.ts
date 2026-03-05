import mongoose, { Schema, Document, Model } from 'mongoose';

// ==================== TYPES ====================

export type GiftRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface IGiftAttributes {
  giftModel?: string;
  backdrop?: string;
  symbol?: string;
  giftCollection?: string;
  [key: string]: string | number | boolean | undefined;
}

export interface IGift {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  rarity: GiftRarity;
  totalSupply: number;
  attributes?: IGiftAttributes;
  // Fragment-style additions
  giftModel?: string;
  backdrop?: string;
  symbol?: string;
  giftCollection?: string;
  number?: number; // Unique gift number like #20298
  timesSold?: number;
  floorPrice?: number;
}

// ==================== INTERFACE ====================

export interface IGiftDocument extends Omit<IGift, '_id' | 'id'>, Document {
  getRarityMultiplier(): number;
}

// ==================== SCHEMA ====================

const GiftSchema = new Schema<IGiftDocument>(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true, index: true },
    description: { type: String, required: true },
    imageUrl: { type: String, required: true },
    rarity: {
      type: String,
      enum: ['common', 'rare', 'epic', 'legendary'],
      default: 'common',
      index: true,
    },
    totalSupply: { type: Number, required: true },
    
    // Fragment-style attributes
    giftModel: { type: String, index: true },
    backdrop: { type: String, index: true },
    symbol: { type: String, index: true },
    giftCollection: { type: String, required: true, index: true },
    number: { type: Number, unique: true, sparse: true },
    timesSold: { type: Number, default: 0 },
    floorPrice: { type: Number, default: 0 },
    
    // Flexible attributes for future extensions
    attributes: { type: Schema.Types.Mixed },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = ret._id?.toString() || ret.id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// ==================== INDEXES ====================

GiftSchema.index({ giftCollection: 1, model: 1 });
GiftSchema.index({ giftCollection: 1, rarity: 1 });
GiftSchema.index({ floorPrice: -1 });
GiftSchema.index({ timesSold: -1 });

// ==================== METHODS ====================

GiftSchema.methods.getRarityMultiplier = function (): number {
  const multipliers: Record<GiftRarity, number> = {
    common: 1,
    rare: 2,
    epic: 5,
    legendary: 10,
  };
  return multipliers[this.rarity as GiftRarity] || 1;
};

// ==================== STATICS ====================

GiftSchema.statics.findByCollection = function (collection: string) {
  return this.find({ giftCollection: collection }).sort({ number: 1 });
};

GiftSchema.statics.getCollections = async function () {
  return this.distinct('giftCollection');
};

GiftSchema.statics.getModels = async function (collection?: string) {
  const query = collection ? { giftCollection: collection } : {};
  return this.distinct('model', query);
};

GiftSchema.statics.getBackdrops = async function (collection?: string) {
  const query = collection ? { giftCollection: collection } : {};
  return this.distinct('backdrop', query);
};

GiftSchema.statics.getSymbols = async function (collection?: string) {
  const query = collection ? { giftCollection: collection } : {};
  return this.distinct('symbol', query);
};

// ==================== MODEL ====================

export interface IGiftModel extends Model<IGiftDocument> {
  findByCollection(collection: string): Promise<IGiftDocument[]>;
  getCollections(): Promise<string[]>;
  getModels(collection?: string): Promise<string[]>;
  getBackdrops(collection?: string): Promise<string[]>;
  getSymbols(collection?: string): Promise<string[]>;
}

export const Gift = mongoose.model<IGiftDocument, IGiftModel>('Gift', GiftSchema);
export default Gift;
