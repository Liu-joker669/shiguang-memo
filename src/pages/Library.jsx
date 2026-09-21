import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createNoteFromText } from '../domain/memo.js';
import { useMemoData } from '../memo-context.js';

export default function Library() {
  const navigate = useNavigate();
  const { notes, addNote, resetNotes } = useMemoData();
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [importTitle, setImportTitle] = useState('');
  const [aiWorking, setAiWorking] = useState(false);
  const [importResult, setImportResult] = useState(null);

  function handleImport() {
    if (!importTitle.trim() || !importText.trim()) return;
    setAiWorking(true);
    // 保留短暂处理反馈，实际执行的是本地规则整理。
    setTimeout(() => {
      const newNote = createNoteFromText({ title: importTitle, text: importText });
      addNote(newNote);
      setAiWorking(false);
      setShowImport(false);
      setImportText('');
      setImportTitle('');
      setImportResult(newNote);
    }, 1200);
  }

  return (
    <div className="page-enter" style={{ padding: '20px 16px' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1e2130', margin: 0 }}>课程资料库</h2>
            <p style={{ fontSize: 13, color: '#9aa0b5', marginTop: 4 }}>
              {notes.length} 篇资料 · 数据只保存在当前浏览器
            </p>
          </div>
          <button type="button" onClick={resetNotes} style={{
            border: '1px solid #dbe1ea', background: 'white', color: '#64748b',
            borderRadius: 999, padding: '7px 10px', fontSize: 11, cursor: 'pointer',
          }}>
            重置示例
          </button>
        </div>
      </div>

      <div className="demo-notice">
        当前版本不调用大模型：文本总结、要点和问答由本地规则生成，用于验证复习闭环。
      </div>

      {/* Import success toast */}
      {importResult && (
        <div className="card-in" style={{
          background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 14,
          padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#065f46',
        }}>
          ✅ 《{importResult.title}》已导入，可在卡片、诊断和问答中继续使用
        </div>
      )}

      {/* Import button */}
      <button onClick={() => setShowImport(true)} style={{
        width: '100%', background: 'white', border: '2px dashed #c7cbe0', borderRadius: 16,
        padding: '16px', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#6366f1',
        marginBottom: 20, transition: 'all 0.2s',
      }}>
        ＋ 导入课程资料（粘贴文本，本地规则整理）
      </button>

      {/* Import panel */}
      {showImport && (
        <div className="card-in" style={{
          background: 'white', borderRadius: 16, padding: 16, marginBottom: 20,
          border: '1px solid #eef0f5',
        }}>
          <input
            value={importTitle}
            onChange={e => setImportTitle(e.target.value)}
            placeholder="资料标题，如：交互设计 · 菲茨定律"
            style={{
              width: '100%', border: '1px solid #e5e8f0', borderRadius: 10,
              padding: '10px 12px', fontSize: 14, marginBottom: 10, outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <textarea
            value={importText}
            onChange={e => setImportText(e.target.value)}
            placeholder="粘贴资料内容（论文段落 / 笔记 / 课程内容均可）"
            rows={5}
            style={{
              width: '100%', border: '1px solid #e5e8f0', borderRadius: 10,
              padding: '10px 12px', fontSize: 13, marginBottom: 12, outline: 'none',
              resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit',
            }}
          />
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={handleImport} disabled={aiWorking} style={{
              flex: 1, background: aiWorking ? '#c7d2fe' : '#6366f1', border: 'none',
              color: 'white', padding: '11px', borderRadius: 10, fontSize: 14, fontWeight: 600,
              cursor: aiWorking ? 'wait' : 'pointer',
            }}>
              {aiWorking ? '正在本地整理…' : '导入并生成复习要点'}
            </button>
            <button onClick={() => setShowImport(false)} style={{
              background: 'white', border: '1px solid #e5e8f0', color: '#6b7280',
              padding: '11px 16px', borderRadius: 10, fontSize: 14, cursor: 'pointer',
            }}>
              取消
            </button>
          </div>
        </div>
      )}

      {/* Notes list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {notes.map(n => (
          <div key={n.id} onClick={() => navigate(`/note/${n.id}`)} style={{
            background: 'white', borderRadius: 16, padding: 16, cursor: 'pointer',
            border: '1px solid #eef0f5', transition: 'all 0.15s',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: '#1e2130', lineHeight: 1.4, flex: 1, paddingRight: 8 }}>
                {n.title}
              </span>
              <span style={{
                fontSize: 11, background: '#eef2ff', color: '#6366f1',
                padding: '3px 8px', borderRadius: 8, whiteSpace: 'nowrap', flexShrink: 0,
              }}>
                {n.category}
              </span>
            </div>
            <p style={{ fontSize: 12.5, color: '#6b7280', lineHeight: 1.6, marginBottom: 8 }}>
              {n.summary}
            </p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {n.tags.map(t => (
                <span key={t} style={{ fontSize: 11, color: '#9aa0b5', background: '#f6f7fb', padding: '2px 8px', borderRadius: 6 }}>
                  #{t}
                </span>
              ))}
              <span style={{ fontSize: 11, color: '#c3c8d9', marginLeft: 'auto', alignSelf: 'center' }}>
                {n.createdAt}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
