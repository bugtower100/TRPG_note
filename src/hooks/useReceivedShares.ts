import { useCallback, useEffect, useState } from 'react';
import { useCampaign } from '../context/CampaignContext';
import { GraphEntityType, SharedEntityRecord } from '../types';
import { sharingService } from '../services/sharingService';

export const useReceivedShares = (entityType: GraphEntityType) => {
  const { currentCampaignId, user } = useCampaign();
  const [shares, setShares] = useState<SharedEntityRecord[]>([]);

  const loadShares = useCallback(async () => {
    if (!currentCampaignId || !user) {
      setShares([]);
      return;
    }
    const items = await sharingService.listReceivedShares(currentCampaignId, user);
    setShares(items.filter((item) => item.targetUserId === user.id && item.entityType === entityType));
  }, [currentCampaignId, entityType, user]);

  useEffect(() => {
    loadShares().catch(() => setShares([]));
  }, [loadShares]);

  useEffect(() => {
    if (!currentCampaignId || !user) return;
    const timer = window.setInterval(() => {
      loadShares().catch(() => void 0);
    }, 15000);
    return () => window.clearInterval(timer);
  }, [currentCampaignId, loadShares, user]);

  return shares;
};
