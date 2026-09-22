import { useParams, useNavigate } from 'react-router-dom';
import { useMemoData } from '../memo-context.js';

export default function Detail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { notes } = useMemoData();
  const note = notes.find(n => n.id === id);

  if (!note) {
    return (
      <div className="page-enter" style={{ padding: 40, textAlign: 'center' }}>
        <p style={{ color: '#9aa0b5' }}>未找到该资料</p>
        <button onClick={() => navigate('/')} style={{
          marginTop: 16, background: '#6366f1', border: 'none', color: 'white',
          padding: '10px 24px', borderRadius: 20, cursor: 'pointer',
        }}>返回资料库</button>
      </div>
    );
  }

  return (
    <div className="page-enter" style={{ padding: '20px 16px' }}>
      <button onClick={() => navigate(-1)} style={{
        background: 'white', border: '1px solid #e5e8f0', color: '#6b7280',
        width: 36, height: 36, borderRadius: 18, fontSize: 16, cursor: 'pointer',
        marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>←</button>

      {/* Title */}
      <h1 style={{ fontSize: 21, fontWeight: 700, color: '#1e2130', marginBottom: 8, lineHeight: 1.4 }}>
        {note.title}
      </h1>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, background: '#eef2ff', color: '#6366f1', padding: '3px 10px', borderRadius: 8 }}>
          {note.category}
        </span>
        {note.tags.map(t => (
          <span key={t} style={{ fontSize: 11, color: '#9aa0b5', background: '#f6f7fb', padding: '3px 10px', borderRadius: 8 }}>
            #{t}
          </span>
        ))}
      </div>

      {note.importWarning && (
        <div className="detail-import-warning">
          <strong>⚠️ 解析提醒</strong>
          <span>{note.importWarning}</span>
        </div>
      )}

      {/* Rule summary card */}
      <div style={{
        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', borderRadius: 16,
        padding: 18, color: 'white', marginBottom: 16,
      }}>
        <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>本地规则总结 · Demo</div>
        <p style={{ fontSize: 14, lineHeight: 1.65, fontWeight: 500 }}>{note.summary}</p>
      </div>

      {/* Key points */}
      <div style={{
        background: 'white', borderRadius: 16, padding: 18, marginBottom: 16,
        border: '1px solid #eef0f5',
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#1e2130', marginBottom: 12 }}>
          ⚡ 复习要点
        </div>
        {note.keyPoints.map((kp, i) => (
          <div key={i} style={{
            display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 10,
          }}>
            <div style={{
              width: 20, height: 20, borderRadius: 10, background: '#eef2ff',
              color: '#6366f1', fontSize: 11, fontWeight: 700, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1,
            }}>
              {i + 1}
            </div>
            <span style={{ fontSize: 13.5, color: '#374151', lineHeight: 1.6 }}>{kp}</span>
          </div>
        ))}
      </div>

      {/* Original content */}
      <div style={{
        background: 'white', borderRadius: 16, padding: 18, border: '1px solid #eef0f5',
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#1e2130', marginBottom: 12 }}>
          📄 原始资料
        </div>
        <div style={{
          fontSize: 13, color: '#4b5563', lineHeight: 1.8, whiteSpace: 'pre-line',
        }}>
          {note.content}
        </div>
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #eef0f5', fontSize: 11, color: '#9aa0b5' }}>
          来源：{note.sourceLabel || '当前浏览器中的本地资料'}
        </div>
      </div>
    </div>
  );
}
