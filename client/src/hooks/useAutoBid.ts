import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';

interface AutoBidData {
  maxAmount: number;
  currentBid: number;
  isActive: boolean;
  bidCount: number;
  stoppedReason?: string;
  createdAt?: string;
  lastBidAt?: string;
}

interface AutoBidStatus {
  hasAutoBid: boolean;
  autoBid: AutoBidData | null;
  currentPrice: number;
  bidIncrement: number;
}

interface AutoBidStats {
  total: number;
  active: number;
  totalBidsPlaced: number;
  totalAmountBid: number;
}

interface ActiveAutoBid {
  id: string;
  auction: {
    _id: string;
    title: string;
    currentPrice: number;
    endTime: string;
    status: string;
    gift?: {
      name: string;
      imageUrl: string;
    };
  };
  maxAmount: number;
  currentBid: number;
  bidCount: number;
  createdAt: string;
}

export function useAutoBid(auctionId?: string) {
  const queryClient = useQueryClient();

  // Get auto-bid status for specific auction
  const statusQuery = useQuery<AutoBidStatus>({
    queryKey: ['autoBid', auctionId],
    queryFn: async () => {
      const response = await api.get(`/autobid/status/${auctionId}`);
      return response.data;
    },
    enabled: !!auctionId,
    staleTime: 10000,
  });

  // Get user's auto-bid stats
  const statsQuery = useQuery<AutoBidStats>({
    queryKey: ['autoBidStats'],
    queryFn: async () => {
      const response = await api.get('/autobid/stats');
      return response.data;
    },
    staleTime: 30000,
  });

  // Get all active auto-bids
  const activeQuery = useQuery<{ autoBids: ActiveAutoBid[] }>({
    queryKey: ['activeAutoBids'],
    queryFn: async () => {
      const response = await api.get('/autobid/active');
      return response.data;
    },
    staleTime: 15000,
  });

  // Setup auto-bid
  const setupMutation = useMutation({
    mutationFn: async ({ auctionId, maxAmount }: { auctionId: string; maxAmount: number }) => {
      const response = await api.post('/autobid/setup', { auctionId, maxAmount });
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['autoBid', variables.auctionId] });
      queryClient.invalidateQueries({ queryKey: ['autoBidStats'] });
      queryClient.invalidateQueries({ queryKey: ['activeAutoBids'] });
    },
  });

  // Cancel auto-bid
  const cancelMutation = useMutation({
    mutationFn: async (auctionId: string) => {
      const response = await api.post('/autobid/cancel', { auctionId });
      return response.data;
    },
    onSuccess: (_, auctionId) => {
      queryClient.invalidateQueries({ queryKey: ['autoBid', auctionId] });
      queryClient.invalidateQueries({ queryKey: ['autoBidStats'] });
      queryClient.invalidateQueries({ queryKey: ['activeAutoBids'] });
    },
  });

  return {
    // Status for specific auction
    status: statusQuery.data,
    isLoading: statusQuery.isLoading,
    hasAutoBid: statusQuery.data?.hasAutoBid ?? false,
    isActive: statusQuery.data?.autoBid?.isActive ?? false,

    // Stats
    stats: statsQuery.data,
    statsLoading: statsQuery.isLoading,

    // Active auto-bids
    activeAutoBids: activeQuery.data?.autoBids ?? [],
    activeLoading: activeQuery.isLoading,

    // Mutations
    setup: setupMutation.mutate,
    setupAsync: setupMutation.mutateAsync,
    isSettingUp: setupMutation.isPending,
    setupError: setupMutation.error,

    cancel: cancelMutation.mutate,
    cancelAsync: cancelMutation.mutateAsync,
    isCancelling: cancelMutation.isPending,
    cancelError: cancelMutation.error,

    // Refetch
    refetch: statusQuery.refetch,
    refetchStats: statsQuery.refetch,
    refetchActive: activeQuery.refetch,
  };
}

export default useAutoBid;
