import React, { useState } from 'react';
import { useCampaign } from '../../context/CampaignContext';
import EntityListLayout from '../../components/common/EntityListLayout';
import { dataService } from '../../services/dataService';
import { useNavigate } from 'react-router-dom';
import { Clue } from '../../types';
import { useReceivedShares } from '../../hooks/useReceivedShares';
import ClueBoard from '../ClueBoard';

const ClueList: React.FC = () => {
  const { campaignData, setCampaignData } = useCampaign();
  const navigate = useNavigate();
  const sharedEntries = useReceivedShares('clues');
  const [activeTab, setActiveTab] = useState<'list' | 'board'>('list');

  const handleAdd = () => {
    const newClue = dataService.createEntity<Clue>({
      name: '新线索',
      details: '',
      relatedImages: [],
      type: '普通',
      relations: []
    });

    setCampaignData({
      ...campaignData,
      clues: [...campaignData.clues, newClue]
    });

    navigate(`/clues/${newClue.id}`);
  };

  return (
    <div className="space-y-4">
      <div data-tour="clue-tabs" className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('list')}
          className={`px-3 py-1.5 text-sm rounded border ${
            activeTab === 'list' ? 'bg-primary text-white border-primary' : 'border-theme hover:bg-primary-light'
          }`}
        >
          线索列表
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('board')}
          className={`px-3 py-1.5 text-sm rounded border ${
            activeTab === 'board' ? 'bg-primary text-white border-primary' : 'border-theme hover:bg-primary-light'
          }`}
        >
          线索板
        </button>
      </div>
      {activeTab === 'list' ? (
        <EntityListLayout
          title="线索列表"
          entities={campaignData.clues}
          entityType="clues"
          onAdd={handleAdd}
          sharedEntries={sharedEntries}
        />
      ) : (
        <div data-tour="clue-board">
          <ClueBoard />
        </div>
      )}
    </div>
  );
};

export default ClueList;
