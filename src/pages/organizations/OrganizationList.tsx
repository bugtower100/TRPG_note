import React from 'react';
import { useCampaignData } from '../../context/CampaignContext';
import EntityListLayout from '../../components/common/EntityListLayout';
import { dataService } from '../../services/dataService';
import { useNavigate } from 'react-router-dom';
import { Organization } from '../../types';
import { useReceivedShares } from '../../hooks/useReceivedShares';
import { useCampaignMemberRole } from '../../hooks/useCampaignMemberRole';

const OrganizationList: React.FC = () => {
  const { campaignData, setCampaignData, reorderEntities } = useCampaignData();
  const navigate = useNavigate();
  const sharedEntries = useReceivedShares('organizations');
  const { canManageCampaignContent } = useCampaignMemberRole();
  const visibleOrganizations = canManageCampaignContent ? campaignData.organizations : [];

  const handleAdd = () => {
    const newOrg = dataService.createEntity<Organization>({
      name: '新组织',
      details: '',
      relatedImages: [],
      notes: '',
      relations: []
    });

    setCampaignData({
      ...campaignData,
      organizations: [...campaignData.organizations, newOrg]
    });

    navigate(`/organizations/${newOrg.id}`);
  };

  return (
    <EntityListLayout
      title="组织列表"
      entities={visibleOrganizations}
      entityType="organizations"
      onAdd={canManageCampaignContent ? handleAdd : undefined}
      onReorder={canManageCampaignContent ? ((orderedIds) => reorderEntities('organizations', orderedIds)) : undefined}
      sharedEntries={sharedEntries}
    />
  );
};

export default OrganizationList;
