import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { buildDiagnosticQuiz, getQuizResult } from '../domain/memo.js';
import { useMemoData } from '../memo-context.js';

export default function Quiz() {
  const navigate = useNavigate();
  const { notes } = useMemoData();
  const questions = useMemo(() => buildDiagnosticQuiz(notes, 5), [notes]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [done, setDone] = useState(false);
  const question = questions[questionIndex];
  const selected = answers[questionIndex];
  const result = done ? getQuizResult(questions, answers) : null;

  function answer(optionIndex) {
    if (selected !== undefined) return;
    setAnswers(current => {
      const next = [...current];
      next[questionIndex] = optionIndex;
      return next;
    });
  }

  function next() {
    if (selected === undefined) return;
    if (questionIndex >= questions.length - 1) {
      setDone(true);
      return;
    }
    setQuestionIndex(current => current + 1);
  }

  function reset() {
    setQuestionIndex(0);
    setAnswers([]);
    setDone(false);
  }

  if (!question) {
    return (
      <div className="page-enter empty-state">
        <span>🧭</span>
        <h2>还不能生成诊断题</h2>
        <p>请先导入包含复习要点的课程资料。</p>
        <button type="button" onClick={() => navigate('/')}>返回资料库</button>
      </div>
    );
  }

  if (done) {
    const weakNotes = [...new Set(result.weakNoteIds)]
      .map(id => notes.find(note => note.id === id))
      .filter(Boolean);
    return (
      <div className="page-enter" style={{ padding: '24px 16px' }}>
        <div className="quiz-result-card">
          <span className="quiz-result-label">诊断完成</span>
          <strong>{result.correct} / {result.total}</strong>
          <h2>{result.accuracy >= 0.8 ? '示例知识掌握良好' : '找到需要回看的资料'}</h2>
          <p>结果只反映本次规则题作答，不等同于真实学习效果。</p>
        </div>

        {weakNotes.length > 0 ? (
          <section className="weak-notes-card">
            <h3>建议回看</h3>
            {weakNotes.map(note => (
              <button key={note.id} type="button" onClick={() => navigate(`/note/${note.id}`)}>
                <span>《{note.title}》</span><b>查看资料 →</b>
              </button>
            ))}
          </section>
        ) : null}

        <button type="button" className="primary-action" onClick={reset}>重新诊断</button>
      </div>
    );
  }

  return (
    <div className="page-enter" style={{ padding: '20px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1e2130', margin: 0 }}>诊断测验</h2>
          <p style={{ fontSize: 13, color: '#9aa0b5', marginTop: 4 }}>用资料要点生成规则题，定位待回看内容</p>
        </div>
        <span style={{ color: '#6366f1', fontSize: 12, fontWeight: 700 }}>{questionIndex + 1}/{questions.length}</span>
      </div>

      <div className="demo-notice" style={{ marginTop: 16 }}>
        当前题目由本地规则生成，用于验证“诊断 → 回看来源”的流程。
      </div>

      <div className="quiz-progress"><i style={{ width: `${((questionIndex + 1) / questions.length) * 100}%` }} /></div>
      <section className="quiz-card">
        <span className="quiz-source">来源可核对 · 《{question.citation}》</span>
        <h3>{question.title}</h3>
        <div className="quiz-options">
          {question.options.map((option, index) => {
            const answered = selected !== undefined;
            const isCorrect = answered && index === question.answer;
            const isWrong = answered && selected === index && index !== question.answer;
            return (
              <button
                type="button"
                key={option}
                onClick={() => answer(index)}
                className={`${isCorrect ? 'correct' : ''} ${isWrong ? 'wrong' : ''}`}
              >
                <span>{String.fromCharCode(65 + index)}</span>{option}
              </button>
            );
          })}
        </div>

        {selected !== undefined ? (
          <div className="quiz-feedback">
            <strong>{selected === question.answer ? '回答正确' : '建议回看来源'}</strong>
            <p>{question.explanation}</p>
            <button type="button" onClick={() => navigate(`/note/${question.noteId}`)}>查看原始资料 →</button>
          </div>
        ) : null}
      </section>

      <button type="button" className="primary-action" disabled={selected === undefined} onClick={next}>
        {questionIndex === questions.length - 1 ? '查看诊断结果' : '下一题'}
      </button>
    </div>
  );
}
