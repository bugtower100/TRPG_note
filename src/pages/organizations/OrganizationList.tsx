import React from 'react';
import { useCampaign } from '../../context/CampaignContext';
import EntityListLayout from '../../components/common/EntityListLayout';
import { dataService } from '../../services/dataService';
import { useNavigate } from 'react-router-dom';
import { Organization } from '../../types';
import { useReceivedShares } from '../../hooks/useReceivedShares';

const OrganizationList: React.FC = () => {
  const { campaignData, setCampaignData } = useCampaign();
  const navigate = useNavigate();
  const sharedEntries = useReceivedShares('organizations');

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
      entities={campaignData.organizations}
      entityType="organizations"
      onAdd={handleAdd}
      sharedEntries={sharedEntries}
    />
  );
};

export default OrganizationList;
