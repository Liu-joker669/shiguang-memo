import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ACCEPTED_FILE_TYPES, extractTextFromFile, FILE_IMPORT_LIMITS } from '../domain/file-import.js';
import { createNoteFromDocument, createNoteFromText } from '../domain/memo.js';
import { useMemoData } from '../memo-context.js';

function makeDraftId(index) {
  return `draft-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`;
}

function splitTags(value) {
  return String(value || '').split(/[，,\s]+/).map(item => item.trim()).filter(Boolean).slice(0, 6);
}

export default function Library() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const { notes, addNote, addNotes, resetNotes } = useMemoData();
  const [showImport, setShowImport] = useState(false);
  const [drafts, setDrafts] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [panelNotice, setPanelNotice] = useState('');
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [importResult, setImportResult] = useState(null);

  const readyDrafts = drafts.filter(draft => draft.status === 'ready' && draft.note);
  const isProcessing = drafts.some(draft => draft.status === 'reading');

  function updateDraft(draftId, updater) {
    setDrafts(current => current.map(draft => (
      draft.id === draftId ? updater(draft) : draft
    )));
  }

  async function handleFiles(fileList) {
    const selected = Array.from(fileList || []);
    if (selected.length === 0) return;

    const availableSlots = Math.max(0, FILE_IMPORT_LIMITS.maxFiles - drafts.length);
    const files = selected.slice(0, availableSlots);
    setPanelNotice(selected.length > files.length
      ? `一次最多处理 ${FILE_IMPORT_LIMITS.maxFiles} 份资料，本次已读取 ${files.length} 份。`
      : '');
    if (files.length === 0) return;

    const pendingDrafts = files.map((file, index) => ({
      id: makeDraftId(index),
      file,
      fileName: file.name,
      status: 'reading',
      note: null,
      warning: '',
      error: '',
    }));
    setDrafts(current => [...current, ...pendingDrafts]);

    for (const draft of pendingDrafts) {
      try {
        const extracted = await extractTextFromFile(draft.file);
        const note = createNoteFromDocument({
          id: `file-${Date.now()}-${draft.id}`,
          fileName: draft.fileName,
          text: extracted.text,
          mimeType: draft.file.type,
          pageCount: extracted.pageCount,
        });
        updateDraft(draft.id, current => ({
          ...current,
          status: 'ready',
          note,
          tagsInput: note.tags.join(' '),
          warning: extracted.warning,
        }));
      } catch (error) {
        updateDraft(draft.id, current => ({
          ...current,
          status: 'error',
          error: error?.message || '文件读取失败，请换一份资料重试。',
        }));
      }
    }
  }

  function handleDrop(event) {
    event.preventDefault();
    setIsDragging(false);
    handleFiles(event.dataTransfer.files);
  }

  function updateNoteField(draftId, field, value) {
    updateDraft(draftId, draft => ({
      ...draft,
      note: { ...draft.note, [field]: value },
    }));
  }

  function confirmImport() {
    const imported = readyDrafts.map(draft => ({
      ...draft.note,
      title: draft.note.title.trim() || draft.fileName,
      category: draft.note.category.trim() || '我的课程',
      tags: splitTags(draft.tagsInput).length > 0 ? splitTags(draft.tagsInput) : ['课程资料'],
    }));
    if (imported.length === 0) return;
    addNotes(imported);
    setImportResult({ count: imported.length, title: imported[0].title });
    setDrafts([]);
    setShowImport(false);
    setPasteOpen(false);
  }

  function importPastedText() {
    const note = createNoteFromText({ id: `paste-${Date.now()}`, text: pasteText });
    if (!note) return;
    addNote(note);
    setImportResult({ count: 1, title: note.title });
    setPasteText('');
    setPasteOpen(false);
    setShowImport(false);
  }

  function closeImport() {
    if (isProcessing) return;
    setShowImport(false);
    setDrafts([]);
    setPanelNotice('');
    setPasteOpen(false);
  }

  return (
    <div className="page-enter library-page">
      <div className="library-heading">
        <div>
          <h2>课程资料库</h2>
          <p>{notes.length} 篇资料 · 数据只保存在当前浏览器</p>
        </div>
        <button type="button" className="quiet-pill" onClick={resetNotes}>重置示例</button>
      </div>

      <div className="demo-notice">
        文件会在当前设备本地解析，不会上传服务器。资料分类、标签、摘要和要点由本地规则生成，并非大模型结论。
      </div>

      {importResult && (
        <div className="import-success card-in">
          ✅ {importResult.count > 1
            ? `已导入 ${importResult.count} 份资料`
            : `《${importResult.title}》已导入`}，可在卡片、诊断和问答中继续使用
        </div>
      )}

      <button type="button" className="open-import-button" onClick={() => setShowImport(true)}>
        <span>＋</span>
        <strong>上传课程资料</strong>
        <small>支持 PDF、Word、TXT、Markdown，可一次选择多份</small>
      </button>

      {showImport && (
        <section className="import-panel card-in" aria-label="导入课程资料">
          <div className="import-panel-heading">
            <div>
              <strong>把资料交给拾光整理</strong>
              <p>提取文字后自动预填信息，你确认后再加入资料库。</p>
            </div>
            <button type="button" onClick={closeImport} disabled={isProcessing} aria-label="关闭导入面板">×</button>
          </div>

          <input
            ref={fileInputRef}
            className="visually-hidden"
            type="file"
            accept={ACCEPTED_FILE_TYPES}
            multiple
            onChange={event => {
              handleFiles(event.target.files);
              event.target.value = '';
            }}
          />
          <div
            className={`file-drop-zone${isDragging ? ' is-dragging' : ''}`}
            role="button"
            tabIndex={0}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={event => {
              if (event.key === 'Enter' || event.key === ' ') fileInputRef.current?.click();
            }}
            onDragOver={event => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <span className="file-drop-icon">📄</span>
            <strong>点击选择或拖拽资料到这里</strong>
            <small>单个不超过 20 MB，一次最多 5 份</small>
          </div>
          <p className="file-support-note">
            支持文字型 PDF、.docx、.txt、.md；扫描版 PDF 需要 OCR，旧版 .doc 请先另存为 .docx。
          </p>
          {panelNotice && <div className="import-inline-notice">{panelNotice}</div>}

          {drafts.length > 0 && (
            <div className="import-draft-list">
              {drafts.map(draft => (
                <article key={draft.id} className={`import-draft ${draft.status}`}>
                  <div className="import-draft-status">
                    <div>
                      <strong>{draft.fileName}</strong>
                      {draft.status === 'reading' && <span>正在本地读取和整理…</span>}
                      {draft.status === 'error' && <span>{draft.error}</span>}
                      {draft.status === 'ready' && <span>已提取 {draft.note.content.length.toLocaleString()} 字</span>}
                    </div>
                    <button
                      type="button"
                      onClick={() => setDrafts(current => current.filter(item => item.id !== draft.id))}
                      disabled={draft.status === 'reading'}
                    >
                      移除
                    </button>
                  </div>

                  {draft.status === 'ready' && (
                    <div className="import-draft-fields">
                      <label>
                        标题
                        <input
                          value={draft.note.title}
                          onChange={event => updateNoteField(draft.id, 'title', event.target.value)}
                        />
                      </label>
                      <label>
                        分类
                        <input
                          value={draft.note.category}
                          onChange={event => updateNoteField(draft.id, 'category', event.target.value)}
                        />
                      </label>
                      <label className="full-field">
                        标签（用空格分隔）
                        <input
                          value={draft.tagsInput}
                          onChange={event => updateDraft(draft.id, current => ({
                            ...current,
                            tagsInput: event.target.value,
                          }))}
                        />
                      </label>
                      <div className="full-field generated-preview">
                        <b>自动摘要</b>
                        <p>{draft.note.summary || '未生成摘要'}</p>
                      </div>
                      {draft.warning && <p className="full-field draft-warning">⚠️ {draft.warning}</p>}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}

          <button type="button" className="paste-toggle" onClick={() => setPasteOpen(current => !current)}>
            {pasteOpen ? '收起文本粘贴' : '没有文件？改为粘贴文字'}
          </button>
          {pasteOpen && (
            <div className="paste-fallback">
              <textarea
                value={pasteText}
                onChange={event => setPasteText(event.target.value)}
                placeholder="直接粘贴课堂笔记，标题、分类和标签将自动填写"
                rows={5}
              />
              <button type="button" onClick={importPastedText} disabled={!pasteText.trim()}>
                自动整理并导入
              </button>
            </div>
          )}

          {drafts.length > 0 && (
            <button
              type="button"
              className="confirm-file-import"
              onClick={confirmImport}
              disabled={isProcessing || readyDrafts.length === 0}
            >
              {isProcessing ? '正在整理资料…' : `确认导入 ${readyDrafts.length} 份资料`}
            </button>
          )}
        </section>
      )}

      <div className="notes-list">
        {notes.map(note => (
          <button key={note.id} type="button" className="note-list-card" onClick={() => navigate(`/note/${note.id}`)}>
            <div className="note-card-heading">
              <span>{note.title}</span>
              <b>{note.category}</b>
            </div>
            <p>{note.summary}</p>
            <div className="note-card-meta">
              {note.tags.map(tag => <span key={tag}>#{tag}</span>)}
              <time>{note.createdAt}</time>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
