import test from 'node:test';
import assert from 'node:assert/strict';
import { SEED_NOTES } from '../src/data/seedNotes.js';
import {
  answerFromNotes,
  buildDiagnosticQuiz,
  createNoteFromText,
  extractKeyPoints,
  getQuizResult,
  retrieveNotes,
  summarizeText,
} from '../src/domain/memo.js';

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
