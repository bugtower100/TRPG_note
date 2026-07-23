import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { CampaignProvider, useCampaignSession } from './context/CampaignContext';
import { GuideProvider } from './components/common/InteractiveGuide';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import LandingPage from './pages/LandingPage';
import StartupSplashScreen from './components/system/StartupSplashScreen';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Settings = lazy(() => import('./pages/Settings'));
const CharacterList = lazy(() => import('./pages/characters/CharacterList'));
const LocationList = lazy(() => import('./pages/locations/LocationList'));
const OrganizationList = lazy(() => import('./pages/organizations/OrganizationList'));
const EventList = lazy(() => import('./pages/events/EventList'));
const EventDetail = lazy(() => import('./pages/events/EventDetail'));
const ClueList = lazy(() => import('./pages/clues/ClueList'));
const ClueDetail = lazy(() => import('./pages/clues/ClueDetail'));
const TimelineList = lazy(() => import('./pages/timelines/TimelineList'));
const TimelineWorkbench = lazy(() => import('./pages/timelines/TimelineWorkbench'));
const CharacterDetail = lazy(() => import('./pages/characters/CharacterDetail'));
const MonsterList = lazy(() => import('./pages/monsters/MonsterList'));
const MonsterDetail = lazy(() => import('./pages/monsters/MonsterDetail'));
const LocationDetail = lazy(() => import('./pages/locations/LocationDetail'));
const OrganizationDetail = lazy(() => import('./pages/organizations/OrganizationDetail'));
const RelationGraphs = lazy(() => import('./pages/RelationGraphs'));
const MindMaps = lazy(() => import('./pages/MindMaps'));
const TeamNotes = lazy(() => import('./pages/TeamNotes'));
const SharedContent = lazy(() => import('./pages/SharedContent'));
const SharedEntityDetailRoute = lazy(() => import('./pages/SharedEntityDetailRoute'));
const SessionTaskBoard = lazy(() => import('./pages/SessionTaskBoard'));
const CharacterSheets = lazy(() => import('./pages/CharacterSheets'));

function LegacyCharacterSheetRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={id ? `/characters/sheets/${id}` : '/characters/sheets'} replace />;
}

const routeFallback = (
  <div className="flex min-h-[40vh] items-center justify-center text-sm theme-text-secondary">
    正在加载页面...
  </div>
);

function AppContent() {
  const { user, currentCampaignId, isSessionBootstrapping } = useCampaignSession();

  if (isSessionBootstrapping) {
    return <StartupSplashScreen message="正在恢复用户与最近打开的模组..." />;
  }

  // If not logged in or no campaign selected, show Landing Page
  if (!user || !currentCampaignId) {
    return <LandingPage />;
  }

  return (
    <ErrorBoundary>
      <Router>
        <Suspense fallback={routeFallback}>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="characters" element={<CharacterList />} />
              <Route path="characters/:id" element={<CharacterDetail />} />
              <Route path="characters/shared/:shareId" element={<SharedEntityDetailRoute entityType="characters" />} />
              <Route path="monsters" element={<MonsterList />} />
              <Route path="monsters/:id" element={<MonsterDetail />} />
              <Route path="monsters/shared/:shareId" element={<SharedEntityDetailRoute entityType="monsters" />} />
              <Route path="locations" element={<LocationList />} />
              <Route path="locations/:id" element={<LocationDetail />} />
              <Route path="locations/shared/:shareId" element={<SharedEntityDetailRoute entityType="locations" />} />
              <Route path="organizations" element={<OrganizationList />} />
              <Route path="organizations/:id" element={<OrganizationDetail />} />
              <Route path="organizations/shared/:shareId" element={<SharedEntityDetailRoute entityType="organizations" />} />
              <Route path="events" element={<EventList />} />
              <Route path="events/:id" element={<EventDetail />} />
              <Route path="events/shared/:shareId" element={<SharedEntityDetailRoute entityType="events" />} />
              <Route path="clues" element={<ClueList />} />
              <Route path="clues/:id" element={<ClueDetail />} />
              <Route path="clues/shared/:shareId" element={<SharedEntityDetailRoute entityType="clues" />} />
              <Route path="clue-board" element={<Navigate to="/clues" replace />} />
              <Route path="session-tasks" element={<SessionTaskBoard />} />
              <Route path="timelines" element={<TimelineList />} />
              <Route path="timelines/workbench" element={<TimelineWorkbench />} />
              <Route path="timelines/:id" element={<TimelineList />} />
              <Route path="timelines/shared/:shareId" element={<SharedEntityDetailRoute entityType="timelines" />} />
              <Route path="relation-graphs" element={<RelationGraphs />} />
              <Route path="mind-maps" element={<MindMaps />} />
              <Route path="team-notes" element={<TeamNotes />} />
              <Route path="characters/sheets" element={<CharacterSheets />} />
              <Route path="characters/sheets/:id" element={<CharacterSheets />} />
              <Route path="character-sheets" element={<LegacyCharacterSheetRedirect />} />
              <Route path="character-sheets/:id" element={<LegacyCharacterSheetRedirect />} />
              <Route path="shared-content" element={<SharedContent />} />
              <Route path="versions" element={<Navigate to="/settings" replace />} />
              <Route path="settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </Suspense>
      </Router>
    </ErrorBoundary>
  );
}

function App() {
  return (
    <CampaignProvider>
      <GuideProvider>
        <AppContent />
      </GuideProvider>
    </CampaignProvider>
  );
}

export default App;
