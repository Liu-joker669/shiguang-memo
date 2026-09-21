import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { answerFromNotes } from '../domain/memo.js';
import { useMemoData } from '../memo-context.js';

const SUGGESTIONS = [
  '菲茨定律讲的是什么？',
  '怎么做需求优先级排序？',
  '访谈时怎么追问？',
  'RAG 是什么？',
];

export default function Qa() {
  const navigate = useNavigate();
  const { notes } = useMemoData();
  const [messages, setMessages] = useState([
    {
      role: 'ai',
      text: '你好！这里会用本地关键词规则检索已保存资料，并展示可核对的来源。当前不调用大模型。试试下面的问题 👇',
      sources: [],
    },
  ]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, thinking]);

  function send(text) {
    const q = (text || input).trim();
    if (!q || thinking) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: q, sources: [] }]);
    setThinking(true);
    // 本地检索 + 模板回答，用于验证来源可核对的产品链路。
    setTimeout(() => {
      const result = answerFromNotes(q, notes);
      setMessages(prev => [...prev, { role: 'ai', ...result }]);
      setThinking(false);
    }, 900);
  }

  return (
    <div className="page-enter" style={{ padding: '16px', display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1e2130', margin: 0 }}>智能问答</h2>
        <p style={{ fontSize: 13, color: '#9aa0b5', marginTop: 4 }}>
          本地资料检索 Demo · 回答来源可核对
        </p>
      </div>

      <div className="demo-notice">
        当前回答由关键词检索和固定模板生成，不代表真实 RAG 或大模型效果。
      </div>

      {/* Messages */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.map((m, i) => (
          <div key={i} className="card-in" style={{
            display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
          }}>
            <div style={{
              maxWidth: '85%',
              background: m.role === 'user' ? '#6366f1' : 'white',
              color: m.role === 'user' ? 'white' : '#1e2130',
              borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
              padding: '12px 16px',
              fontSize: 13.5,
              lineHeight: 1.65,
              whiteSpace: 'pre-line',
              boxShadow: m.role === 'user' ? 'none' : '0 1px 3px rgba(0,0,0,0.06)',
              border: m.role === 'user' ? 'none' : '1px solid #eef0f5',
            }}>
              {m.text}
              {m.sources && m.sources.length > 0 && (
                <div style={{
                  marginTop: 10, paddingTop: 8, borderTop: '1px solid #eef0f5',
                  fontSize: 11.5, color: '#9aa0b5',
                }}>
                  <div style={{ marginBottom: 6 }}>📖 检索来源</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {m.sources.map(source => (
                      <button key={source.id} type="button" onClick={() => navigate(`/note/${source.id}`)} style={{
                        border: '1px solid #dbe4ff', borderRadius: 999, background: '#f8faff',
                        color: '#4f46e5', padding: '5px 8px', fontSize: 11, cursor: 'pointer',
                      }}>
                        《{source.title}》
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Thinking indicator */}
        {thinking && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', paddingLeft: 4 }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {[0, 1, 2].map(i => (
                <div key={i} className="typing-dot" style={{
                  width: 7, height: 7, borderRadius: 4, background: '#c7cbe0',
                }} />
              ))}
            </div>
            <span style={{ fontSize: 12, color: '#9aa0b5' }}>正在本地检索资料…</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggestions */}
      {messages.length <= 1 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
          {SUGGESTIONS.map(s => (
            <button key={s} onClick={() => send(s)} style={{
              background: 'white', border: '1px solid #e5e8f0', borderRadius: 18,
              padding: '8px 14px', fontSize: 12.5, color: '#6366f1', cursor: 'pointer',
              transition: 'all 0.15s',
            }}>
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{
        display: 'flex', gap: 10, background: 'white', borderRadius: 24,
        padding: '6px 6px 6px 16px', border: '1px solid #e5e8f0',
        alignItems: 'center',
      }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="提问，如：菲茨定律讲什么？"
          style={{
            flex: 1, border: 'none', outline: 'none', fontSize: 14, color: '#1e2130',
            background: 'transparent',
          }}
        />
        <button onClick={() => send()} disabled={thinking} style={{
          background: '#6366f1', border: 'none', color: 'white', borderRadius: 20,
          width: 40, height: 40, cursor: 'pointer', fontSize: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          ➤
        </button>
      </div>
    </div>
  );
}
