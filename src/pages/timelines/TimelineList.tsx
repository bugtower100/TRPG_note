import React, { useEffect, useMemo } from 'react';
import { useCampaignData, useCampaignTabs } from '../../context/CampaignContext';
import { dataService } from '../../services/dataService';
import { useNavigate, useParams } from 'react-router-dom';
import { Timeline } from '../../types';
import { ExternalLink } from 'lucide-react';
import TimelineDetail from './TimelineDetail';

const TimelineList: React.FC = () => {
  const { id: routeTimelineId } = useParams<{ id?: string }>();
  const { campaignData, setCampaignData } = useCampaignData();
  const { openInTab } = useCampaignTabs();
  const navigate = useNavigate();

  const handleAdd = () => {
    const newTimeline = dataService.createEntity<Timeline>({
      name: '新时间线',
      details: '',
      relatedImages: [],
      timelineEvents: [],
    });

    setCampaignData({
      ...campaignData,
      timelines: [...campaignData.timelines, newTimeline]
    });

    navigate(`/timelines/${newTimeline.id}`);
  };

  const timelines = campaignData.timelines;
  const activeTimeline = useMemo(
    () => timelines.find((timeline) => timeline.id === routeTimelineId) || null,
    [timelines, routeTimelineId]
  );

  useEffect(() => {
    if (timelines.length === 0) return;
    if (routeTimelineId && timelines.some((timeline) => timeline.id === routeTimelineId)) return;
    navigate(`/timelines/${timelines[0].id}`, { replace: true });
  }, [timelines, routeTimelineId, navigate]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold">时间线</h2>
          <p className="text-sm theme-text-secondary">页面直接显示当前时间轴，右上角切换不同时间线。</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <select
            value={activeTimeline?.id || ''}
            onChange={(event) => navigate(`/timelines/${event.target.value}`)}
            className="min-w-[220px] px-3 py-2 border border-theme rounded-md bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            title="切换时间线"
            disabled={timelines.length === 0}
          >
            {timelines.length === 0 ? (
              <option value="">暂无时间线</option>
            ) : (
              timelines.map((timeline) => (
                <option key={timeline.id} value={timeline.id}>
                  {timeline.name}
                </option>
              ))
            )}
          </select>
          {activeTimeline && (
            <button
              type="button"
              onClick={() => openInTab('timelines', activeTimeline.id, activeTimeline.name)}
              className="inline-flex items-center gap-1 px-3 py-2 border border-theme rounded-md hover:bg-primary-light transition-colors"
              title="在侧边栏打开当前时间线"
            >
              <ExternalLink size={16} />
              侧边打开
            </button>
          )}
          <button
            type="button"
            onClick={() => navigate('/timelines/workbench', {
              state: { focusTimelineId: activeTimeline?.id || '' },
            })}
            className="px-3 py-2 border border-theme rounded-md hover:bg-primary-light transition-colors whitespace-nowrap"
          >
            工作版
          </button>
          <button
            onClick={handleAdd}
            className="px-3 py-2 bg-primary text-white rounded-md hover:bg-primary-dark transition-colors whitespace-nowrap"
          >
            新建时间线
          </button>
        </div>
      </div>

      {timelines.length === 0 ? (
        <div className="text-center py-12 theme-text-secondary bg-theme-card rounded-lg border border-dashed border-theme">
          <p>暂无时间线，请先新建一条时间线。</p>
          <button
            onClick={handleAdd}
            className="mt-4 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark transition-colors"
          >
            创建第一条时间线
          </button>
        </div>
      ) : activeTimeline ? (
        <TimelineDetail
          key={activeTimeline.id}
          entityId={activeTimeline.id}
          embedded
          onDeleted={() => {
            const remainingTimelines = campaignData.timelines.filter((timeline) => timeline.id !== activeTimeline.id);
            if (remainingTimelines.length > 0) {
              navigate(`/timelines/${remainingTimelines[0].id}`, { replace: true });
            } else {
              navigate('/timelines', { replace: true });
            }
          }}
        />
      ) : (
        <div className="text-center py-12 theme-text-secondary bg-theme-card rounded-lg border border-dashed border-theme">
          当前时间线不存在，请在右上角重新选择。
        </div>
      )}
    </div>
  );
};

export default TimelineList;
