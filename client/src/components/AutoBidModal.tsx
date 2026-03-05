import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { useTelegram } from '../hooks/useTelegram';

interface AutoBidModalProps {
  isOpen: boolean;
  onClose: () => void;
  auctionId: string;
  auctionTitle: string;
  currentPrice: number;
  bidIncrement: number;
  userBalance: number;
}

interface AutoBidStatus {
  hasAutoBid: boolean;
  autoBid: {
    maxAmount: number;
    currentBid: number;
    isActive: boolean;
    bidCount: number;
    stoppedReason?: string;
  } | null;
  currentPrice: number;
  bidIncrement: number;
}

export function AutoBidModal({
  isOpen,
  onClose,
  auctionId,
  auctionTitle,
  currentPrice,
  bidIncrement,
  userBalance,
}: AutoBidModalProps) {
  const { haptic, showAlert } = useTelegram();
  const queryClient = useQueryClient();
  
  const minAutoBid = currentPrice + bidIncrement;
  const [maxAmount, setMaxAmount] = useState(minAutoBid);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Fetch current auto-bid status
  const { data: status, isLoading } = useQuery<AutoBidStatus>({
    queryKey: ['autoBid', auctionId],
    queryFn: async () => {
      const response = await api.get(`/autobid/status/${auctionId}`);
      return response.data;
    },
    enabled: isOpen,
  });

  // Update maxAmount when status loads
  useEffect(() => {
    if (status?.autoBid?.maxAmount) {
      setMaxAmount(status.autoBid.maxAmount);
    } else {
      setMaxAmount(minAutoBid);
    }
  }, [status, minAutoBid]);

  // Setup auto-bid mutation
  const setupMutation = useMutation({
    mutationFn: async (amount: number) => {
      const response = await api.post('/autobid/setup', {
        auctionId,
        maxAmount: amount,
      });
      return response.data;
    },
    onSuccess: () => {
      haptic('notification');
      queryClient.invalidateQueries({ queryKey: ['autoBid', auctionId] });
      showAlert?.('✅ Auto-bid activated! You will automatically outbid others up to your maximum.');
    },
    onError: (error: any) => {
      haptic('notification');
      showAlert?.(error.response?.data?.error || 'Failed to setup auto-bid');
    },
  });

  // Cancel auto-bid mutation
  const cancelMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/autobid/cancel', { auctionId });
      return response.data;
    },
    onSuccess: () => {
      haptic('notification');
      queryClient.invalidateQueries({ queryKey: ['autoBid', auctionId] });
      showAlert?.('Auto-bid cancelled');
    },
    onError: (error: any) => {
      haptic('notification');
      showAlert?.(error.response?.data?.error || 'Failed to cancel auto-bid');
    },
  });

  const handleSetup = () => {
    if (maxAmount <= currentPrice) {
      showAlert?.(`Maximum amount must be higher than current price (${currentPrice} ⭐)`);
      return;
    }
    if (maxAmount > userBalance) {
      showAlert?.(`Insufficient balance. You have ${userBalance} ⭐`);
      return;
    }
    setupMutation.mutate(maxAmount);
  };

  const handleCancel = () => {
    cancelMutation.mutate();
  };

  const presetAmounts = [
    { label: '+10%', value: Math.ceil(currentPrice * 1.1) },
    { label: '+25%', value: Math.ceil(currentPrice * 1.25) },
    { label: '+50%', value: Math.ceil(currentPrice * 1.5) },
    { label: '2x', value: currentPrice * 2 },
  ];

  const potentialBids = Math.floor((maxAmount - currentPrice) / bidIncrement);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />
          
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-[#1c1c1e] rounded-t-3xl max-h-[85vh] overflow-hidden"
          >
            {/* Handle */}
            <div className="flex justify-center py-3">
              <div className="w-10 h-1 bg-gray-600 rounded-full" />
            </div>

            <div className="px-5 pb-8 overflow-y-auto max-h-[calc(85vh-40px)]">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">
                  🤖 Auto-Bid
                </h2>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Auction Info */}
              <div className="bg-white/5 rounded-xl p-4 mb-6">
                <p className="text-sm text-gray-400 mb-1">Auction</p>
                <p className="text-white font-medium truncate">{auctionTitle}</p>
                <div className="flex items-center justify-between mt-3">
                  <div>
                    <p className="text-xs text-gray-500">Current Price</p>
                    <p className="text-lg font-bold text-white">{currentPrice} ⭐</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Your Balance</p>
                    <p className="text-lg font-bold text-green-400">{userBalance} ⭐</p>
                  </div>
                </div>
              </div>

              {/* Loading State */}
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
                </div>
              ) : status?.autoBid?.isActive ? (
                /* Active Auto-Bid Status */
                <div className="space-y-4">
                  <div className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/30 rounded-xl p-4">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                        <span className="text-xl">🤖</span>
                      </div>
                      <div>
                        <p className="text-white font-semibold">Auto-Bid Active</p>
                        <p className="text-sm text-gray-400">Bot is bidding for you</p>
                      </div>
                      <div className="ml-auto">
                        <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-black/30 rounded-lg p-3">
                        <p className="text-xs text-gray-500 mb-1">Maximum Bid</p>
                        <p className="text-lg font-bold text-white">
                          {status.autoBid.maxAmount} ⭐
                        </p>
                      </div>
                      <div className="bg-black/30 rounded-lg p-3">
                        <p className="text-xs text-gray-500 mb-1">Bids Placed</p>
                        <p className="text-lg font-bold text-blue-400">
                          {status.autoBid.bidCount}
                        </p>
                      </div>
                    </div>

                    {status.autoBid.currentBid > 0 && (
                      <div className="mt-3 bg-black/30 rounded-lg p-3">
                        <p className="text-xs text-gray-500 mb-1">Last Auto-Bid</p>
                        <p className="text-lg font-bold text-white">
                          {status.autoBid.currentBid} ⭐
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Update Max Amount */}
                  <div className="bg-white/5 rounded-xl p-4">
                    <p className="text-sm text-gray-400 mb-3">Update Maximum</p>
                    <div className="relative">
                      <input
                        type="number"
                        value={maxAmount}
                        onChange={(e) => setMaxAmount(Math.max(minAutoBid, parseInt(e.target.value) || 0))}
                        className="w-full bg-black/50 border border-gray-700 rounded-xl px-4 py-3 text-white text-lg font-bold pr-12 focus:outline-none focus:border-blue-500"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-yellow-500">⭐</span>
                    </div>
                    <button
                      onClick={handleSetup}
                      disabled={setupMutation.isPending || maxAmount === status.autoBid.maxAmount}
                      className="w-full mt-3 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold rounded-xl transition-colors"
                    >
                      {setupMutation.isPending ? 'Updating...' : 'Update Maximum'}
                    </button>
                  </div>

                  {/* Cancel Button */}
                  <button
                    onClick={handleCancel}
                    disabled={cancelMutation.isPending}
                    className="w-full py-3 bg-red-500/20 border border-red-500/30 text-red-400 font-semibold rounded-xl hover:bg-red-500/30 transition-colors"
                  >
                    {cancelMutation.isPending ? 'Cancelling...' : '🛑 Cancel Auto-Bid'}
                  </button>
                </div>
              ) : (
                /* Setup New Auto-Bid */
                <div className="space-y-5">
                  {/* Stopped Reason */}
                  {status?.autoBid?.stoppedReason && (
                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
                      <p className="text-yellow-500 text-sm">
                        ⚠️ Previous auto-bid stopped: {status.autoBid.stoppedReason}
                      </p>
                    </div>
                  )}

                  {/* Description */}
                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
                    <p className="text-blue-400 text-sm">
                      🤖 Auto-bid will automatically place bids on your behalf when you're outbid, 
                      up to your maximum amount. You won't need to watch the auction constantly!
                    </p>
                  </div>

                  {/* Max Amount Input */}
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">
                      Maximum Amount
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={maxAmount}
                        onChange={(e) => setMaxAmount(Math.max(minAutoBid, parseInt(e.target.value) || 0))}
                        min={minAutoBid}
                        max={userBalance}
                        className="w-full bg-black/50 border border-gray-700 rounded-xl px-4 py-4 text-white text-2xl font-bold pr-12 focus:outline-none focus:border-blue-500 transition-colors"
                        placeholder={String(minAutoBid)}
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-yellow-500 text-xl">⭐</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Minimum: {minAutoBid} ⭐ (current + increment)
                    </p>
                  </div>

                  {/* Preset Amounts */}
                  <div className="grid grid-cols-4 gap-2">
                    {presetAmounts.map((preset) => (
                      <button
                        key={preset.label}
                        onClick={() => setMaxAmount(Math.min(preset.value, userBalance))}
                        disabled={preset.value > userBalance}
                        className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                          maxAmount === preset.value
                            ? 'bg-blue-500 text-white'
                            : preset.value > userBalance
                            ? 'bg-gray-800 text-gray-600'
                            : 'bg-white/10 text-gray-300 hover:bg-white/20'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>

                  {/* Stats Preview */}
                  <div className="bg-white/5 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-gray-400">Potential auto-bids</span>
                      <span className="text-white font-bold">~{potentialBids}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Max spend</span>
                      <span className="text-white font-bold">{maxAmount} ⭐</span>
                    </div>
                    <div className="h-px bg-gray-700 my-3" />
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Remaining balance</span>
                      <span className={userBalance - maxAmount >= 0 ? 'text-green-400' : 'text-red-400'}>
                        {userBalance - maxAmount} ⭐
                      </span>
                    </div>
                  </div>

                  {/* Advanced Options */}
                  <button
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="flex items-center gap-2 text-gray-400 text-sm"
                  >
                    <svg
                      className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                    Advanced options
                  </button>

                  <AnimatePresence>
                    {showAdvanced && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="bg-white/5 rounded-xl p-4 space-y-4 overflow-hidden"
                      >
                        <p className="text-xs text-gray-500">
                          Auto-bid will use the minimum increment to stay ahead of competition.
                          If another user also has auto-bid, the system will bid in small increments
                          until one reaches their maximum.
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Setup Button */}
                  <button
                    onClick={handleSetup}
                    disabled={setupMutation.isPending || maxAmount <= currentPrice || maxAmount > userBalance}
                    className="w-full py-4 bg-gradient-to-r from-blue-500 to-purple-500 disabled:from-gray-700 disabled:to-gray-700 text-white font-bold text-lg rounded-xl transition-all active:scale-[0.98]"
                  >
                    {setupMutation.isPending ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                        Setting up...
                      </span>
                    ) : (
                      '🤖 Activate Auto-Bid'
                    )}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default AutoBidModal;

