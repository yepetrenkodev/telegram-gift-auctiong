import mongoose, { Schema, Document } from 'mongoose';

/**
 * Audit Log Entry
 * Records all important financial and administrative operations
 */
export interface IAuditLogDocument extends Document {
  // Event identification
  eventType: AuditEventType;
  eventId: string;
  timestamp: Date;
  
  // Actor
  actorType: 'user' | 'system' | 'admin' | 'bot';
  actorId?: string;
  actorIp?: string;
  
  // Target
  targetType: 'auction' | 'bid' | 'balance' | 'user' | 'round';
  targetId: string;
  
  // Event details
  action: string;
  description: string;
  
  // Before/After state for changes
  previousState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
  
  // Financial data (if applicable)
  amount?: number;
  balanceBefore?: number;
  balanceAfter?: number;
  
  // Metadata
  metadata?: Record<string, unknown>;
  
  // Request info
  requestId?: string;
  userAgent?: string;
}

export enum AuditEventType {
  // Balance operations
  BALANCE_DEPOSIT = 'balance.deposit',
  BALANCE_WITHDRAW = 'balance.withdraw',
  BALANCE_LOCK = 'balance.lock',
  BALANCE_UNLOCK = 'balance.unlock',
  BALANCE_DEDUCT = 'balance.deduct',
  
  // Bid operations
  BID_PLACED = 'bid.placed',
  BID_OUTBID = 'bid.outbid',
  BID_WON = 'bid.won',
  BID_REFUNDED = 'bid.refunded',
  
  // Auction operations
  AUCTION_CREATED = 'auction.created',
  AUCTION_STARTED = 'auction.started',
  AUCTION_PAUSED = 'auction.paused',
  AUCTION_CANCELLED = 'auction.cancelled',
  AUCTION_COMPLETED = 'auction.completed',
  
  // Round operations
  ROUND_STARTED = 'round.started',
  ROUND_EXTENDED = 'round.extended',
  ROUND_ENDED = 'round.ended',
  
  // User operations
  USER_REGISTERED = 'user.registered',
  USER_LOGIN = 'user.login',
  USER_BANNED = 'user.banned',
  
  // Auto-bid operations
  AUTOBID_CREATED = 'autobid.created',
  AUTOBID_TRIGGERED = 'autobid.triggered',
  AUTOBID_STOPPED = 'autobid.stopped',
  
  // Admin operations
  ADMIN_ACTION = 'admin.action',
}

const auditLogSchema = new Schema<IAuditLogDocument>(
  {
    eventType: {
      type: String,
      required: true,
      enum: Object.values(AuditEventType),
      index: true,
    },
    eventId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
    actorType: {
      type: String,
      required: true,
      enum: ['user', 'system', 'admin', 'bot'],
    },
    actorId: {
      type: String,
      index: true,
    },
    actorIp: String,
    targetType: {
      type: String,
      required: true,
      enum: ['auction', 'bid', 'balance', 'user', 'round'],
    },
    targetId: {
      type: String,
      required: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    previousState: Schema.Types.Mixed,
    newState: Schema.Types.Mixed,
    amount: Number,
    balanceBefore: Number,
    balanceAfter: Number,
    metadata: Schema.Types.Mixed,
    requestId: String,
    userAgent: String,
  },
  {
    timestamps: false, // We use our own timestamp
    collection: 'audit_logs',
  }
);

// Compound indexes for common queries
auditLogSchema.index({ actorId: 1, timestamp: -1 });
auditLogSchema.index({ targetId: 1, timestamp: -1 });
auditLogSchema.index({ eventType: 1, timestamp: -1 });
auditLogSchema.index({ targetType: 1, targetId: 1, timestamp: -1 });

// TTL index - keep logs for 1 year
auditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

export const AuditLog = mongoose.model<IAuditLogDocument>('AuditLog', auditLogSchema);
