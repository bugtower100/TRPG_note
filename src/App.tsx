import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { CampaignProvider, useCampaign } from './context/CampaignContext';
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
            <Route path="monsters" element={<MonsterList />} />
            <Route path="monsters/:id" element={<MonsterDetail />} />
            <Route path="locations" element={<LocationList />} />
            <Route path="locations/:id" element={<LocationDetail />} />
            <Route path="organizations" element={<OrganizationList />} />
            <Route path="organizations/:id" element={<OrganizationDetail />} />
            <Route path="events" element={<EventList />} />
            <Route path="events/:id" element={<EventDetail />} />
            <Route path="clues" element={<ClueList />} />
            <Route path="clues/:id" element={<ClueDetail />} />
            <Route path="timelines" element={<TimelineList />} />
            <Route path="timelines/:id" element={<TimelineDetail />} />
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
      <AppContent />
    </CampaignProvider>
  );
}

export default App;
