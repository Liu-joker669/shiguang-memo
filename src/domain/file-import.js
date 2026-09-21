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
    for (let pageNumber = 1; pageNumber <= pageLimit; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const pageText = content.items.map(item => item.str || '').join(' ');
      pages.push(pageText);
    }
    const cleaned = cleanExtractedText(pages.join('\n\n'));
    if (cleaned.length < 20) {
      throw new FileImportError('scanned-pdf', '没有提取到可用文字，可能是扫描版 PDF；当前 Demo 暂不支持 OCR。');
    }
    const limited = limitText(cleaned);
    return {
      ...limited,
      pageCount: document.numPages,
      warning: document.numPages > pageLimit
        ? `文件共 ${document.numPages} 页，本次仅整理前 ${pageLimit} 页。`
        : limited.truncated ? '资料较长，本次仅保留前 8 万字。' : '',
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
