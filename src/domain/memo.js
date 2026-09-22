const QUESTION_STOP_WORDS = new Set([
  '什么', '怎么', '如何', '哪些', '为什么', '讲的', '一下', '介绍', '关于', '可以', '这个', '那个',
]);

const TAG_STOP_WORDS = new Set([
  '我们', '你们', '他们', '一个', '一种', '这些', '那些', '以及', '进行', '通过', '需要', '可以', '能够',
  '相关', '主要', '内容', '资料', '课程', '学习', '复习', '知识', '问题', '方法', '部分', '不同', '使用',
  'the', 'and', 'for', 'with', 'from', 'this', 'that', 'into', 'document', 'chapter',
]);

const CATEGORY_RULES = [
  ['产品与设计', ['产品', '用户', '需求', '交互', '设计', '可用性', '原型', '竞品', '体验']],
  ['计算机', ['算法', '数据结构', '计算机', '代码', '编程', '数据库', '网络', '操作系统', '软件']],
  ['数理基础', ['高等数学', '线性代数', '概率', '统计', '微积分', '函数', '定理', '矩阵']],
  ['工程技术', ['机械', '结构', '材料', '制造', '工程', '工艺', '设备']],
  ['经管', ['经济', '管理', '营销', '财务', '会计', '商业', '市场']],
  ['外语', ['英语', 'english', '词汇', '语法', '听力', '阅读理解']],
];

function fileNameWithoutExtension(fileName) {
  return String(fileName || '').replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
}

export function inferTitle({ fileName, text } = {}) {
  const fileTitle = fileNameWithoutExtension(fileName);
  if (fileTitle && !/^(未命名|文档|document|新建文档)$/i.test(fileTitle)) return fileTitle.slice(0, 48);

  const firstLine = String(text || '')
    .split(/\r?\n/)
    .map(line => line.replace(/^\s*(#+|第?[0-9一二三四五六七八九十]+[章节、.]|[-•])\s*/, '').trim())
    .find(line => line.length >= 2);
  return (firstLine || '未命名课程资料').slice(0, 48);
}

export function inferCategory({ title, text } = {}) {
  const sample = `${title || ''}\n${String(text || '').slice(0, 12000)}`.toLowerCase();
  let best = { category: '我的课程', score: 0 };

  CATEGORY_RULES.forEach(([category, keywords]) => {
    const score = keywords.reduce((total, keyword) => (
      total + (sample.includes(keyword) ? (String(title || '').toLowerCase().includes(keyword) ? 3 : 1) : 0)
    ), 0);
    if (score > best.score) best = { category, score };
  });

  return best.category;
}

function segmentWords(text) {
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    const segmenter = new Intl.Segmenter('zh-CN', { granularity: 'word' });
    return [...segmenter.segment(text)]
      .filter(item => item.isWordLike)
      .map(item => item.segment.toLowerCase());
  }
  return String(text || '').toLowerCase().match(/[a-z][a-z0-9-]+|[\u4e00-\u9fff]{2,8}/g) || [];
}

export function inferTags({ title, text, limit = 4 } = {}) {
  const scores = new Map();
  const addTokens = (value, weight) => {
    segmentWords(String(value || '')).forEach(token => {
      const clean = token.replace(/^[\d.]+|[\d.]+$/g, '');
      if (clean.length < 2 || clean.length > 16 || TAG_STOP_WORDS.has(clean) || /^\d+$/.test(clean)) return;
      scores.set(clean, (scores.get(clean) || 0) + weight);
    });
  };

  addTokens(title, 4);
  addTokens(String(text || '').slice(0, 30000), 1);

  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, limit)
    .map(([token]) => token);
}

export function summarizeText(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(line => line && !/^第\s*\d+\s*页/.test(line));
  const contentLines = lines.filter(line => !/^(.*课程|.*面试)?试讲题目?$/.test(line));
  const source = contentLines.length > 0 ? contentLines : lines;
  const sentences = source
    .flatMap(line => line.match(/[^。！？!?；;]+[。！？!?；;]?/g) || [])
    .map(item => item.trim())
    .filter(Boolean);
  const clean = sentences.join(' ');
  if (clean.length <= 110) return clean;
  return `${sentences.slice(0, 2).join(' ').slice(0, 110)}${sentences.length > 2 || clean.length > 110 ? '…' : ''}`;
}

export function extractKeyPoints(text) {
  const points = String(text || '')
    .split(/\r?\n/)
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(line => line.length > 3)
    .filter(line => !/^第\s*\d+\s*页/.test(line))
    .filter(line => !/^(.*课程|.*面试)?试讲题目?$/.test(line))
    .flatMap(line => line.match(/[^。！？!?；;]+[。！？!?；;]?/g) || [])
    .map(item => item
      .replace(/^[0-9]+[.、）)]\s*/, '')
      .replace(/^[（(][0-9]+[）)]\s*/, '')
      .replace(/^[-•]\s*/, '')
      .trim())
    .filter(item => item.length >= 4)
    .map(item => item.slice(0, 46));

  return [...new Set(points)].slice(0, 5);
}

export function createNoteFromText({ title, text, id = `note-${Date.now()}`, createdAt } = {}) {
  const cleanText = String(text || '').trim();
  if (!cleanText) return null;
  const cleanTitle = String(title || '').trim() || inferTitle({ text: cleanText });

  return {
    id,
    title: cleanTitle,
    category: inferCategory({ title: cleanTitle, text: cleanText }),
    tags: inferTags({ title: cleanTitle, text: cleanText }),
    createdAt: createdAt || new Date().toISOString().slice(0, 10),
    sourceLabel: '本地导入文本',
    content: cleanText,
    summary: summarizeText(cleanText),
    keyPoints: extractKeyPoints(cleanText),
  };
}

export function createNoteFromDocument({
  fileName,
  text,
  mimeType,
  pageCount,
  importWarning,
  id = `file-${Date.now()}`,
  createdAt,
} = {}) {
  const cleanText = String(text || '').trim();
  if (!cleanText) return null;
  const title = inferTitle({ fileName, text: cleanText });
  const extension = String(fileName || '').split('.').pop()?.toUpperCase() || '文件';
  const sourceParts = [extension, fileName];
  if (pageCount) sourceParts.push(`${pageCount} 页`);

  return {
    id,
    title,
    category: inferCategory({ title, text: cleanText }),
    tags: inferTags({ title, text: cleanText }),
    createdAt: createdAt || new Date().toISOString().slice(0, 10),
    sourceLabel: sourceParts.filter(Boolean).join(' · '),
    content: cleanText,
    summary: summarizeText(cleanText),
    keyPoints: extractKeyPoints(cleanText),
    fileMeta: {
      fileName: String(fileName || ''),
      mimeType: String(mimeType || ''),
      pageCount: pageCount || null,
    },
    importWarning: String(importWarning || ''),
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
