import { useNavigate } from 'react-router-dom';
import { useMemoData } from '../memo-context.js';

const CARD_COLORS = [
  { bg: '#eef2ff', accent: '#6366f1' },
  { bg: '#fef3e2', accent: '#f59e0b' },
  { bg: '#ecfdf5', accent: '#10b981' },
  { bg: '#fdf2f8', accent: '#ec4899' },
];

export default function Cards() {
  const navigate = useNavigate();
  const { notes } = useMemoData();
  const cards = notes.flatMap(n => {
    const base = CARD_COLORS[notes.indexOf(n) % CARD_COLORS.length];
    return [
      {
        noteId: n.id, type: 'summary', title: `📄 ${n.title}`,
        body: n.summary, meta: `规则总结 · ${n.category}`, ...base,
      },
      ...n.keyPoints.slice(0, 2).map((kp, i) => ({
        noteId: n.id, type: 'point', title: kp,
        body: `来自《${n.title}》的关键要点 ${i + 1}`, meta: '本地规则提炼', ...base,
      })),
    ];
  });

  return (
    <div className="page-enter" style={{ padding: '20px 16px' }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1e2130', margin: 0 }}>知识卡片</h2>
        <p style={{ fontSize: 13, color: '#9aa0b5', marginTop: 4 }}>
          将课程资料整理成便于快速回顾的卡片
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {cards.map((c, i) => (
          <div key={i} onClick={() => navigate(`/note/${c.noteId}`)} style={{
            background: c.bg, borderRadius: 16, padding: 16, cursor: 'pointer',
            display: 'flex', flexDirection: 'column', minHeight: 140,
            transition: 'all 0.15s', border: '1px solid transparent',
          }}>
            <div style={{
              fontSize: 13, fontWeight: 600, color: '#1e2130',
              lineHeight: 1.5, marginBottom: 8, flex: 1,
            }}>
              {c.title}
            </div>
            <p style={{
              fontSize: 12, color: '#4b5563', lineHeight: 1.55, marginBottom: 12,
              flex: 2, overflow: 'hidden',
            }}>
              {c.body}
            </p>
            <div style={{
              fontSize: 10.5, color: c.accent, fontWeight: 600,
              borderTop: `1px solid ${c.accent}30`, paddingTop: 8,
            }}>
              {c.meta}
            </div>
          </div>
        ))}
      </div>

      {/* Explanation */}
      <div style={{
        marginTop: 24, background: 'white', borderRadius: 16, padding: 16,
        border: '1px solid #eef0f5',
      }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: '#1e2130', marginBottom: 8 }}>
          💡 知识卡片的产品逻辑
        </h3>
        <p style={{ fontSize: 12.5, color: '#6b7280', lineHeight: 1.7 }}>
          当前 Demo 使用本地规则把资料拆成<b>总结卡</b>和<b>要点卡</b>，用于验证“导入后快速回顾”的流程。
          间隔复习算法和真实 AI 总结仍属于后续规划，不作为当前已实现能力。
        </p>
      </div>
    </div>
  );
}
