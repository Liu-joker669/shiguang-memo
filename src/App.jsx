import { HashRouter, Route, Routes } from 'react-router-dom';
import BottomNav from './components/BottomNav.jsx';
import Cards from './pages/Cards.jsx';
import Detail from './pages/Detail.jsx';
import Library from './pages/Library.jsx';
import Qa from './pages/Qa.jsx';
import Quiz from './pages/Quiz.jsx';

function AppShell() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <span className="app-eyebrow">COURSE REVIEW DEMO</span>
          <strong>拾光 Memo</strong>
        </div>
        <span className="demo-badge">本地规则 Demo</span>
      </header>
      <div className="app-content">
        <Routes>
          <Route path="/" element={<Library />} />
          <Route path="/quiz" element={<Quiz />} />
          <Route path="/qa" element={<Qa />} />
          <Route path="/cards" element={<Cards />} />
          <Route path="/note/:id" element={<Detail />} />
        </Routes>
      </div>
      <BottomNav />
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <AppShell />
    </HashRouter>
  );
}
