export const FILE_IMPORT_LIMITS = {
  maxFiles: 5,
  maxFileBytes: 20 * 1024 * 1024,
  maxPdfPages: 80,
  maxCharacters: 80000,
};

export const ACCEPTED_FILE_TYPES = '.pdf,.docx,.txt,.md,text/plain,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export class FileImportError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'FileImportError';
    this.code = code;
  }
}

const PDF_GLYPH_REPLACEMENTS = new Map([
  ['\uf028', '('],
  ['\uf029', ')'],
  ['\uf02b', '+'],
  ['\uf02d', '−'],
  ['\uf02f', '/'],
  ['\uf03d', '='],
  ['\uf05b', '['],
  ['\uf05d', ']'],
  ['\uf07c', '|'],
]);

const PAGE_NUMBER_PATTERN = /^第\s*\d+\s*页\s*[（(]\s*共\s*\d+\s*页\s*[）)]$/;

function repairPdfGlyphs(value) {
  let repairedGlyphs = 0;
  const text = [...String(value || '')].map(char => {
    if (!PDF_GLYPH_REPLACEMENTS.has(char)) return char;
    repairedGlyphs += 1;
    return PDF_GLYPH_REPLACEMENTS.get(char);
  }).join('');
  return { text, repairedGlyphs };
}

function normalizePdfLine(value) {
  let text = String(value || '').replace(/\s+/g, ' ').trim();
  let previous;
  do {
    previous = text;
    text = text.replace(/([\u3400-\u9fff])\s+(?=[\u3400-\u9fff])/g, '$1');
  } while (text !== previous);
  return text
    .replace(/\s+([，。；：！？、）】])/g, '$1')
    .replace(/([（【])\s+/g, '$1')
    .replace(/\s*([+−=|])\s*/g, '$1')
    .trim();
}

function shouldInsertSpace(previousText, nextText, gap) {
  if (gap > 20) return true;
  const previous = previousText.at(-1) || '';
  const next = nextText[0] || '';
  const previousIsLatin = /[a-z0-9]/i.test(previous);
  const nextIsLatin = /[a-z0-9]/i.test(next);
  return previousIsLatin && nextIsLatin && gap > 1.5;
}

export function rebuildPdfPageText(items, lineTolerance = 3) {
  const fragments = (items || [])
    .filter(item => String(item?.str || '').trim())
    .map(item => {
      const repaired = repairPdfGlyphs(item.str);
      return {
        text: repaired.text.trim(),
        repairedGlyphs: repaired.repairedGlyphs,
        x: Number(item.transform?.[4] || 0),
        y: Number(item.transform?.[5] || 0),
        width: Math.max(0, Number(item.width || 0)),
      };
    })
    .sort((a, b) => b.y - a.y || a.x - b.x);

  const lines = [];
  fragments.forEach(fragment => {
    const currentLine = lines.at(-1);
    if (!currentLine || Math.abs(currentLine.y - fragment.y) > lineTolerance) {
      lines.push({ y: fragment.y, items: [fragment] });
      return;
    }
    currentLine.items.push(fragment);
  });

  let repairedGlyphs = 0;
  let unresolvedGlyphs = 0;
  const textLines = lines.map(line => {
    const ordered = [...line.items].sort((a, b) => a.x - b.x);
    let text = '';
    let previousEnd = null;
    ordered.forEach(item => {
      repairedGlyphs += item.repairedGlyphs;
      unresolvedGlyphs += ([...item.text].filter(char => (
        /[\uE000-\uF8FF]/.test(char) || char === '\ufffd' || char === '□'
      )).length);
      const gap = previousEnd === null ? 0 : item.x - previousEnd;
      if (text && shouldInsertSpace(text, item.text, gap)) text += ' ';
      text += item.text;
      previousEnd = Math.max(previousEnd ?? item.x, item.x + item.width);
    });
    return normalizePdfLine(text);
  }).filter(line => line && !PAGE_NUMBER_PATTERN.test(line));

  return {
    text: textLines.join('\n'),
    repairedGlyphs,
    unresolvedGlyphs,
  };
}

export function getFileExtension(fileName) {
  return String(fileName || '').toLowerCase().split('.').pop() || '';
}

export function getFileKind(fileName) {
  const extension = getFileExtension(fileName);
  if (extension === 'pdf') return 'pdf';
  if (extension === 'docx') return 'docx';
  if (extension === 'txt' || extension === 'md') return 'text';
  if (extension === 'doc') return 'legacy-word';
  return 'unsupported';
}

function cleanExtractedText(text) {
  return String(text || '')
    .split(String.fromCharCode(0)).join('')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

function limitText(text) {
  if (text.length <= FILE_IMPORT_LIMITS.maxCharacters) return { text, truncated: false };
  return {
    text: text.slice(0, FILE_IMPORT_LIMITS.maxCharacters),
    truncated: true,
  };
}

async function extractPdf(file) {
  const [{ getDocument, GlobalWorkerOptions }, workerModule] = await Promise.all([
    import('pdfjs-dist/build/pdf.mjs'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ]);
  GlobalWorkerOptions.workerSrc = workerModule.default;

  const loadingTask = getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  let document;
  try {
    document = await loadingTask.promise;
    const pageLimit = Math.min(document.numPages, FILE_IMPORT_LIMITS.maxPdfPages);
    const pages = [];
    let repairedGlyphs = 0;
    let unresolvedGlyphs = 0;
    for (let pageNumber = 1; pageNumber <= pageLimit; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const rebuilt = rebuildPdfPageText(content.items);
      pages.push(rebuilt.text);
      repairedGlyphs += rebuilt.repairedGlyphs;
      unresolvedGlyphs += rebuilt.unresolvedGlyphs;
    }
    const cleaned = cleanExtractedText(pages.join('\n\n'));
    if (cleaned.length < 20) {
      throw new FileImportError('scanned-pdf', '没有提取到可用文字，可能是扫描版 PDF；当前 Demo 暂不支持 OCR。');
    }
    const limited = limitText(cleaned);
    const warnings = [];
    if (document.numPages > pageLimit) warnings.push(`文件共 ${document.numPages} 页，本次仅整理前 ${pageLimit} 页。`);
    if (limited.truncated) warnings.push('资料较长，本次仅保留前 8 万字。');
    if (repairedGlyphs > 0) {
      warnings.push(`已修复 ${repairedGlyphs} 个常见数学符号；复杂公式、数轴或图片仍建议对照原 PDF。`);
    }
    if (unresolvedGlyphs > 0) {
      warnings.push(`仍有 ${unresolvedGlyphs} 个符号无法可靠识别，请检查原 PDF。`);
    }
    return {
      ...limited,
      pageCount: document.numPages,
      warning: warnings.join(' '),
    };
  } catch (error) {
    if (error instanceof FileImportError) throw error;
    if (error?.name === 'PasswordException') {
      throw new FileImportError('password-pdf', '该 PDF 有密码保护，请解锁后重新导入。');
    }
    throw new FileImportError('pdf-read-failed', 'PDF 读取失败，请确认文件没有损坏或加密。');
  } finally {
    await document?.destroy?.();
  }
}

async function extractDocx(file) {
  try {
    const module = await import('mammoth');
    const mammoth = module.default || module;
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    const cleaned = cleanExtractedText(result.value);
    if (cleaned.length < 10) {
      throw new FileImportError('empty-docx', 'Word 文档中没有提取到可用文字。');
    }
    const limited = limitText(cleaned);
    return {
      ...limited,
      warning: limited.truncated ? '资料较长，本次仅保留前 8 万字。' : '',
    };
  } catch (error) {
    if (error instanceof FileImportError) throw error;
    throw new FileImportError('docx-read-failed', 'Word 读取失败，请确认文件为有效的 .docx 格式。');
  }
}

async function extractPlainText(file) {
  const cleaned = cleanExtractedText(await file.text());
  if (cleaned.length < 2) throw new FileImportError('empty-text', '文件中没有可用文字。');
  const limited = limitText(cleaned);
  return {
    ...limited,
    warning: limited.truncated ? '资料较长，本次仅保留前 8 万字。' : '',
  };
}

export async function extractTextFromFile(file) {
  if (!file?.name) throw new FileImportError('invalid-file', '没有读取到有效文件。');
  if (file.size > FILE_IMPORT_LIMITS.maxFileBytes) {
    throw new FileImportError('file-too-large', '单个文件不能超过 20 MB。');
  }

  const kind = getFileKind(file.name);
  if (kind === 'legacy-word') {
    throw new FileImportError('legacy-word', '暂不支持旧版 .doc，请在 Word 中另存为 .docx 后导入。');
  }
  if (kind === 'unsupported') {
    throw new FileImportError('unsupported', '暂只支持 PDF、DOCX、TXT 和 Markdown 文件。');
  }
  if (kind === 'pdf') return extractPdf(file);
  if (kind === 'docx') return extractDocx(file);
  return extractPlainText(file);
}
