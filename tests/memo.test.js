import test from 'node:test';
import assert from 'node:assert/strict';
import { SEED_NOTES } from '../src/data/seedNotes.js';
import {
  answerFromNotes,
  buildDiagnosticQuiz,
  createNoteFromDocument,
  createNoteFromText,
  extractKeyPoints,
  getQuizResult,
  inferCategory,
  inferTitle,
  retrieveNotes,
  summarizeText,
} from '../src/domain/memo.js';
import { extractTextFromFile, getFileKind } from '../src/domain/file-import.js';

test('text import creates a local note with summary and key points', () => {
  const note = createNoteFromText({
    id: 'imported-note',
    title: '测试资料',
    text: '1. 先定义问题\n2. 再验证假设\n3. 最后复盘结果',
    createdAt: '2026-09-21',
  });

  assert.equal(note.id, 'imported-note');
  assert.equal(note.sourceLabel, '本地导入文本');
  assert.deepEqual(note.keyPoints, ['先定义问题', '再验证假设', '最后复盘结果']);
});

test('summary and key point rules handle prose without claiming an LLM', () => {
  const text = `${'课程复习需要先确定目标。'.repeat(8)}最后根据错题回看来源。`;
  assert.ok(summarizeText(text).length <= 111);
  assert.ok(extractKeyPoints('复习时先做诊断。然后根据错误回看资料。').length > 0);
});

test('document import auto-fills title, category, source and tags', () => {
  const note = createNoteFromDocument({
    id: 'document-note',
    fileName: '交互设计-菲茨定律.pdf',
    text: '菲茨定律用于描述目标距离、目标宽度与指向操作时间之间的关系。交互设计需要扩大高频按钮的点击区域。',
    mimeType: 'application/pdf',
    pageCount: 12,
    createdAt: '2026-09-21',
  });

  assert.equal(note.title, '交互设计 菲茨定律');
  assert.equal(note.category, '产品与设计');
  assert.equal(note.sourceLabel, 'PDF · 交互设计-菲茨定律.pdf · 12 页');
  assert.ok(note.tags.length > 0);
});

test('pasted text can infer a title without another form field', () => {
  const text = '需求优先级评估\n应综合考虑用户价值、影响范围、开发成本与业务目标。';
  assert.equal(inferTitle({ text }), '需求优先级评估');
  assert.equal(inferCategory({ title: '需求优先级评估', text }), '产品与设计');
  assert.equal(createNoteFromText({ text }).title, '需求优先级评估');
});

test('file import recognises supported formats and reads plain text locally', async () => {
  const file = {
    name: '课程笔记.md',
    size: 128,
    type: 'text/markdown',
    text: async () => '# 课程笔记\n这是用于测试本地资料导入的正文。',
  };

  assert.equal(getFileKind('lecture.pdf'), 'pdf');
  assert.equal(getFileKind('lecture.docx'), 'docx');
  assert.equal(getFileKind('lecture.doc'), 'legacy-word');
  assert.equal((await extractTextFromFile(file)).text, '# 课程笔记\n这是用于测试本地资料导入的正文。');
});

test('legacy Word files return an actionable boundary message', async () => {
  await assert.rejects(
    extractTextFromFile({ name: '旧讲义.doc', size: 128 }),
    error => error.code === 'legacy-word' && error.message.includes('.docx'),
  );
});

test('Chinese natural-language questions retrieve matching notes', () => {
  assert.equal(retrieveNotes('菲茨定律讲的是什么？', SEED_NOTES)[0].note.id, 'n1');
  assert.equal(retrieveNotes('怎么做需求优先级排序？', SEED_NOTES)[0].note.id, 'n2');
  assert.equal(retrieveNotes('访谈时怎么追问？', SEED_NOTES)[0].note.id, 'n3');
  assert.equal(retrieveNotes('RAG 是什么？', SEED_NOTES)[0].note.id, 'n4');
});

test('sourced answers return note identifiers and an explicit no-result state', () => {
  const answered = answerFromNotes('RAG 是什么？', SEED_NOTES);
  const missing = answerFromNotes('量子纠缠实验', SEED_NOTES);

  assert.equal(answered.status, 'answered');
  assert.equal(answered.sources[0].id, 'n4');
  assert.equal(missing.status, 'no-result');
  assert.deepEqual(missing.sources, []);
});

test('diagnostic quiz links each question back to its source note', () => {
  const questions = buildDiagnosticQuiz(SEED_NOTES, 4);

  assert.equal(questions.length, 4);
  assert.ok(questions.every(question => question.noteId && question.citation));
  assert.ok(questions.every(question => question.options[question.answer]));
});

test('quiz result returns accuracy and weak source notes', () => {
  const questions = buildDiagnosticQuiz(SEED_NOTES, 2);
  const answers = [questions[0].answer, (questions[1].answer + 1) % questions[1].options.length];
  const result = getQuizResult(questions, answers);

  assert.equal(result.correct, 1);
  assert.equal(result.total, 2);
  assert.equal(result.accuracy, 0.5);
  assert.deepEqual(result.weakNoteIds, [questions[1].noteId]);
});
