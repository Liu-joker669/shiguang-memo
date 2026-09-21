import { useNavigate, useLocation } from 'react-router-dom';

const NAV_ITEMS = [
  { path: '/', label: '资料库', icon: '📚' },
  { path: '/quiz', label: '诊断', icon: '🧭' },
  { path: '/qa', label: '问答', icon: '💬' },
  { path: '/cards', label: '卡片', icon: '🃏' },
];

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav className="bottom-nav">
      {NAV_ITEMS.map(item => {
        const isActive = item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path);
        return (
          <button
            type="button"
            key={item.path}
            className={`nav-item ${isActive ? 'active' : ''}`}
            onClick={() => navigate(item.path)}
          >
            <span style={{ fontSize: 20 }}>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
