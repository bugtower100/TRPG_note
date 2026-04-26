import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { CampaignProvider, useCampaign } from './context/CampaignContext';
import { GuideProvider } from './components/common/InteractiveGuide';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import LandingPage from './pages/LandingPage';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import CharacterList from './pages/characters/CharacterList';
import LocationList from './pages/locations/LocationList';
import OrganizationList from './pages/organizations/OrganizationList';
import EventList from './pages/events/EventList';
import EventDetail from './pages/events/EventDetail';
import ClueList from './pages/clues/ClueList';
import ClueDetail from './pages/clues/ClueDetail';
import TimelineList from './pages/timelines/TimelineList';
import TimelineDetail from './pages/timelines/TimelineDetail';
import CharacterDetail from './pages/characters/CharacterDetail';
import MonsterList from './pages/monsters/MonsterList';
import MonsterDetail from './pages/monsters/MonsterDetail';
import LocationDetail from './pages/locations/LocationDetail';
import OrganizationDetail from './pages/organizations/OrganizationDetail';
import RelationGraphs from './pages/RelationGraphs';
import TeamNotes from './pages/TeamNotes';
import SharedContent from './pages/SharedContent';
import SharedEntityDetailRoute from './pages/SharedEntityDetailRoute';
import SessionTaskBoard from './pages/SessionTaskBoard';

function AppContent() {
  const { user, currentCampaignId } = useCampaign();

  // If not logged in or no campaign selected, show Landing Page
  if (!user || !currentCampaignId) {
    return <LandingPage />;
  }

  return (
    <ErrorBoundary>
      <Router>
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
            <Route path="timelines/:id" element={<TimelineDetail />} />
            <Route path="timelines/shared/:shareId" element={<SharedEntityDetailRoute entityType="timelines" />} />
            <Route path="relation-graphs" element={<RelationGraphs />} />
            <Route path="team-notes" element={<TeamNotes />} />
            <Route path="shared-content" element={<SharedContent />} />
            <Route path="versions" element={<Navigate to="/settings" replace />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
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
