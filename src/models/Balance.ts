import mongoose, { Schema, Document, Model, ClientSession } from 'mongoose';
import { IBalance, ITransaction, TransactionType } from '../types';

// ==================== INTERFACES ====================

export interface IBalanceDocument extends Omit<IBalance, '_id'>, Document {
  canSpend(amount: number): boolean;
  lock(amount: number, session?: ClientSession): Promise<this>;
  unlock(amount: number, session?: ClientSession): Promise<this>;
  deductLocked(amount: number, session?: ClientSession): Promise<this>;
  addFunds(amount: number, session?: ClientSession): Promise<this>;
}

export interface ITransactionDocument extends Omit<ITransaction, '_id'>, Document {}

// ==================== BALANCE SCHEMA ====================

const BalanceSchema = new Schema<IBalanceDocument>(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      ref: 'User',
    },
    available: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    locked: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
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

// ==================== VIRTUALS ====================

BalanceSchema.virtual('total').get(function () {
  return this.available + this.locked;
});

// ==================== METHODS ====================

BalanceSchema.methods.canSpend = function (amount: number): boolean {
  return this.available >= amount;
};

BalanceSchema.methods.lock = async function (
  this: IBalanceDocument,
  amount: number,
  session?: ClientSession
) {
  if (this.available < amount) {
    throw new Error(`Insufficient available balance. Required: ${amount}, Available: ${this.available}`);
  }

  const balanceBefore = this.available;
  const lockedBefore = this.locked;

  this.available -= amount;
  this.locked += amount;

  await this.save({ session });

  // Create transaction record
  await Transaction.create(
    [
      {
        balanceId: this._id,
        userId: this.userId,
        type: TransactionType.BID_LOCK,
        amount,
        balanceBefore,
        balanceAfter: this.available,
        lockedBefore,
        lockedAfter: this.locked,
        description: `Locked ${amount} for bid`,
      },
    ],
    { session }
  );

  return this;
};

BalanceSchema.methods.unlock = async function (
  this: IBalanceDocument,
  amount: number,
  session?: ClientSession
) {
  if (this.locked < amount) {
    throw new Error(`Insufficient locked balance. Required: ${amount}, Locked: ${this.locked}`);
  }

  const balanceBefore = this.available;
  const lockedBefore = this.locked;

  this.locked -= amount;
  this.available += amount;

  await this.save({ session });

  await Transaction.create(
    [
      {
        balanceId: this._id,
        userId: this.userId,
        type: TransactionType.BID_UNLOCK,
        amount,
        balanceBefore,
        balanceAfter: this.available,
        lockedBefore,
        lockedAfter: this.locked,
        description: `Unlocked ${amount} from bid`,
      },
    ],
    { session }
  );

  return this;
};

BalanceSchema.methods.deductLocked = async function (
  this: IBalanceDocument,
  amount: number,
  session?: ClientSession
) {
  if (this.locked < amount) {
    throw new Error(`Insufficient locked balance for deduction. Required: ${amount}, Locked: ${this.locked}`);
  }

  const lockedBefore = this.locked;

  this.locked -= amount;

  await this.save({ session });

  await Transaction.create(
    [
      {
        balanceId: this._id,
        userId: this.userId,
        type: TransactionType.WIN_DEDUCT,
        amount,
        balanceBefore: this.available,
        balanceAfter: this.available,
        lockedBefore,
        lockedAfter: this.locked,
        description: `Deducted ${amount} for winning bid`,
      },
    ],
    { session }
  );

  return this;
};

BalanceSchema.methods.addFunds = async function (
  this: IBalanceDocument,
  amount: number,
  session?: ClientSession
) {
  const balanceBefore = this.available;

  this.available += amount;

  await this.save({ session });

  await Transaction.create(
    [
      {
        balanceId: this._id,
        userId: this.userId,
        type: TransactionType.DEPOSIT,
        amount,
        balanceBefore,
        balanceAfter: this.available,
        lockedBefore: this.locked,
        lockedAfter: this.locked,
        description: `Added ${amount} to balance`,
      },
    ],
    { session }
  );

  return this;
};

// ==================== STATICS ====================

BalanceSchema.statics.findByUserId = function (userId: string) {
  return this.findOne({ userId });
};

BalanceSchema.statics.getOrCreate = async function (
  userId: string,
  session?: ClientSession
): Promise<IBalanceDocument> {
  let balance = await this.findOne({ userId }).session(session || null);
  
  if (!balance) {
    const created = await this.create([{ userId, available: 0, locked: 0 }], { session });
    balance = created[0];
  }
  
  return balance;
};

// ==================== TRANSACTION SCHEMA ====================

const TransactionSchema = new Schema<ITransactionDocument>(
  {
    balanceId: {
      type: String,
      required: true,
      ref: 'Balance',
      index: true,
    },
    userId: {
      type: String,
      required: true,
      ref: 'User',
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(TransactionType),
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    reference: {
      type: String,
    },
    referenceId: {
      type: String,
      index: true,
    },
    balanceBefore: {
      type: Number,
      required: true,
    },
    balanceAfter: {
      type: Number,
      required: true,
    },
    lockedBefore: {
      type: Number,
      required: true,
    },
    lockedAfter: {
      type: Number,
      required: true,
    },
    description: {
      type: String,
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

TransactionSchema.index({ userId: 1, createdAt: -1 });
TransactionSchema.index({ type: 1, createdAt: -1 });

// ==================== MODELS ====================

export interface IBalanceModel extends Model<IBalanceDocument> {
  findByUserId(userId: string): Promise<IBalanceDocument | null>;
  getOrCreate(userId: string, session?: ClientSession): Promise<IBalanceDocument>;
}

export const Balance = mongoose.model<IBalanceDocument, IBalanceModel>('Balance', BalanceSchema);
export const Transaction = mongoose.model<ITransactionDocument>('Transaction', TransactionSchema);

export default Balance;
