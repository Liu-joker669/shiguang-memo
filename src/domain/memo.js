const QUESTION_STOP_WORDS = new Set([
  '什么', '怎么', '如何', '哪些', '为什么', '讲的', '一下', '介绍', '关于', '可以', '这个', '那个',
]);

export function summarizeText(text) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= 120) return clean;
  const sentences = clean.split(/[。！？]/).map(item => item.trim()).filter(Boolean);
  return `${sentences.slice(0, 2).join('。').slice(0, 110)}${sentences.length > 2 ? '…' : ''}`;
}

export function extractKeyPoints(text) {
  const lines = String(text || '').split('\n').map(line => line.trim()).filter(line => line.length > 3);
  const listed = lines
    .filter(line => /^[0-9]+[.、）)]/.test(line) || /^[-•]/.test(line))
    .map(line => line.replace(/^[0-9]+[.、）)]\s*/, '').replace(/^[-•]\s*/, ''))
    .filter(Boolean)
    .slice(0, 5);
  if (listed.length > 0) return listed;

  return String(text || '')
    .split(/[。！？]/)
    .map(item => item.trim())
    .filter(item => item.length > 5)
    .slice(0, 3)
    .map(item => item.slice(0, 32));
}

export function createNoteFromText({ title, text, id = `note-${Date.now()}`, createdAt } = {}) {
  const cleanTitle = String(title || '').trim();
  const cleanText = String(text || '').trim();
  if (!cleanTitle || !cleanText) return null;

  return {
    id,
    title: cleanTitle,
    category: '我的资料',
    tags: ['文本导入'],
    createdAt: createdAt || new Date().toISOString().slice(0, 10),
    sourceLabel: '本地导入文本',
    content: cleanText,
    summary: summarizeText(cleanText),
    keyPoints: extractKeyPoints(cleanText),
  };
}

function normalize(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '');
}

export function getSearchTerms(query) {
  const rawTokens = String(query || '').toLowerCase().match(/[a-z0-9]+|[\u4e00-\u9fff]+/g) || [];
  const terms = new Set();

  rawTokens.forEach(token => {
    if (/^[a-z0-9]+$/.test(token)) {
      if (token.length >= 2) terms.add(token);
      return;
    }

    if (token.length >= 2 && !QUESTION_STOP_WORDS.has(token)) terms.add(token);
    for (let index = 0; index < token.length - 1; index += 1) {
      const bigram = token.slice(index, index + 2);
      if (!QUESTION_STOP_WORDS.has(bigram)) terms.add(bigram);
    }
  });

  return [...terms];
}

export function retrieveNotes(query, notes) {
  const normalizedQuery = normalize(query);
  const terms = getSearchTerms(query);
  if (!normalizedQuery || terms.length === 0) return [];

  return notes
    .map(note => {
      const title = normalize(note.title);
      const tags = normalize(note.tags?.join(' '));
      const searchable = normalize([
        note.title,
        note.content,
        note.summary,
        ...(note.keyPoints || []),
        ...(note.tags || []),
      ].join(' '));
      let score = 0;

      terms.forEach(term => {
        const normalizedTerm = normalize(term);
        if (!normalizedTerm) return;
        if (title.includes(normalizedTerm)) score += 5;
        else if (tags.includes(normalizedTerm)) score += 3;
        else if (searchable.includes(normalizedTerm)) score += 1;
      });
      if (title.includes(normalizedQuery)) score += 8;

      return { note, score };
    })
    .filter(result => result.score > 0)
    .sort((a, b) => b.score - a.score);
}

export function answerFromNotes(query, notes) {
  const results = retrieveNotes(query, notes);
  if (results.length === 0) {
    return {
      text: '当前资料中没有检索到足够相关的内容。你可以换一个更具体的关键词，或先导入对应课程资料。',
      sources: [],
      status: 'no-result',
    };
  }

  const top = results.slice(0, 2).map(result => result.note);
  return {
    text: `根据《${top[0].title}》：${top[0].summary}\n\n可重点复习：${top[0].keyPoints.slice(0, 3).join('；')}。`,
    sources: top.map(note => ({ id: note.id, title: note.title, label: note.sourceLabel })),
    status: 'answered',
  };
}

export function buildDiagnosticQuiz(notes, limit = 5) {
  const usableNotes = notes.filter(note => note.keyPoints?.length > 0);
  const distractorPool = usableNotes.flatMap(note => note.keyPoints.map(point => ({ noteId: note.id, point })));

  return usableNotes.slice(0, limit).map((note, questionIndex) => {
    const correct = note.keyPoints[0];
    const distractors = distractorPool
      .filter(item => item.noteId !== note.id && item.point !== correct)
      .slice(questionIndex, questionIndex + 3)
      .map(item => item.point);
    const options = [correct, ...distractors].slice(0, 4);
    const rotation = options.length > 0 ? questionIndex % options.length : 0;
    const rotatedOptions = [...options.slice(rotation), ...options.slice(0, rotation)];

    return {
      id: `quiz-${note.id}`,
      noteId: note.id,
      title: `以下哪一项来自《${note.title}》的核心要点？`,
      options: rotatedOptions,
      answer: rotatedOptions.indexOf(correct),
      explanation: note.summary,
      citation: note.title,
    };
  }).filter(question => question.options.length >= 2);
}

export function getQuizResult(questions, answers) {
  const correct = questions.reduce((total, question, index) => (
    total + (answers[index] === question.answer ? 1 : 0)
  ), 0);
  return {
    correct,
    total: questions.length,
    accuracy: questions.length > 0 ? correct / questions.length : 0,
    weakNoteIds: questions
      .filter((question, index) => answers[index] !== question.answer)
      .map(question => question.noteId),
  };
}
