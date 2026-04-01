import React, { useState, useEffect } from 'react';
import { useCampaign } from '../context/CampaignContext';
import { useGuide } from '../components/common/InteractiveGuide';

const Dashboard: React.FC = () => {
  const { campaignData, setCampaignData } = useCampaign();
  const { startGuide } = useGuide();
  const [notes, setNotes] = useState(campaignData.notes || '');

  useEffect(() => {
    setNotes(campaignData.notes || '');
  }, [campaignData.notes]);

  useEffect(() => {
    const hasSeen = localStorage.getItem('trpg_has_seen_guide');
    if (hasSeen) return;
    const timer = window.setTimeout(() => {
      startGuide('dashboard');
      localStorage.setItem('trpg_has_seen_guide', 'true');
    }, 180);
    return () => window.clearTimeout(timer);
  }, [startGuide]);

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newNotes = e.target.value;
    setNotes(newNotes);
    setCampaignData({
        ...campaignData,
        notes: newNotes,
        meta: { ...campaignData.meta, lastModified: Date.now() }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">
            {campaignData.meta.projectName} <span className="text-gray-400 text-sm font-normal">概览</span>
        </h2>
        <button 
            onClick={() => startGuide('dashboard')}
            className="text-primary text-sm hover:underline"
        >
            新手引导
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <div className="bg-theme-card p-6 rounded-lg shadow-sm border border-theme">
          <h3 className="theme-text-secondary text-sm font-medium uppercase">角色</h3>
          <p className="text-3xl font-bold mt-2">{campaignData.characters.length}</p>
        </div>
        <div className="bg-theme-card p-6 rounded-lg shadow-sm border border-theme">
          <h3 className="theme-text-secondary text-sm font-medium uppercase">怪物</h3>
          <p className="text-3xl font-bold mt-2">{campaignData.monsters.length}</p>
        </div>
        <div className="bg-theme-card p-6 rounded-lg shadow-sm border border-theme">
          <h3 className="theme-text-secondary text-sm font-medium uppercase">地点</h3>
          <p className="text-3xl font-bold mt-2">{campaignData.locations.length}</p>
        </div>
        <div className="bg-theme-card p-6 rounded-lg shadow-sm border border-theme">
          <h3 className="theme-text-secondary text-sm font-medium uppercase">组织</h3>
          <p className="text-3xl font-bold mt-2">{campaignData.organizations.length}</p>
        </div>
        <div className="bg-theme-card p-6 rounded-lg shadow-sm border border-theme">
            <h3 className="theme-text-secondary text-sm font-medium uppercase">最后更新</h3>
            <p className="text-sm font-bold mt-4">
                {new Date(campaignData.meta.lastModified).toLocaleString()}
            </p>
        </div>
      </div>

      {/* Campaign Notes Section */}
      <div className="bg-theme-card p-6 rounded-lg shadow-sm border border-theme">
        <h3 className="text-lg font-bold mb-4">模组笔记 / 备忘录</h3>
        <textarea
            value={notes}
            onChange={handleNotesChange}
            className="w-full h-64 p-4 border border-theme rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 resize-y bg-transparent"
            placeholder="在这里记录模组的大纲、待办事项或灵感..."
        />
      </div>
    </div>
  );
};

export default Dashboard;
