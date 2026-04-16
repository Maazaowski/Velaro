import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import CreateModel from './pages/CreateModel';
import Training from './pages/Training';
import Playground from './pages/Playground';
import Publish from './pages/Publish';
import SettingsPage from './pages/SettingsPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/create" element={<CreateModel />} />
          <Route path="/training" element={<Training />} />
          <Route path="/playground" element={<Playground />} />
          <Route path="/publish" element={<Publish />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
