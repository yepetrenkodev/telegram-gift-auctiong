import mongoose, { Schema, Document } from 'mongoose';

export enum TransactionType {
  DEPOSIT = 'deposit',
  WITHDRAW = 'withdraw',
  BID_LOCK = 'bid_lock',
  BID_UNLOCK = 'bid_unlock',
  WIN = 'win',
  REFUND = 'refund',
  BONUS = 'bonus',
  TRANSFER = 'transfer',
}

export interface ITransaction extends Document {
  userId: string;
  type: TransactionType;
  amount: number;
  balanceAfter: number;
  meta?: Record<string, any>;
  createdAt: Date;
}

const TransactionSchema = new Schema<ITransaction>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: Object.values(TransactionType), required: true },
  amount: { type: Number, required: true },
  balanceAfter: { type: Number, required: true },
  meta: { type: Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now },
});


const Transaction = mongoose.models.Transaction || mongoose.model<ITransaction>('Transaction', TransactionSchema);
export default Transaction;
