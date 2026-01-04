import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export type OcrPdfOptions = {
  language: 'deu';
  maxPages: number;
  dpi: number;
  timeoutMs: number;
  perPageTimeoutMs: number;
  maxTextChars: number;
};

export type OcrPdfResult = {
  text: string;
  pagesProcessed: number;
  truncated: boolean;
};

const DEFAULTS: OcrPdfOptions = {
  language: 'deu',
  maxPages: 10,
  dpi: 200,
  timeoutMs: 60_000,
  perPageTimeoutMs: 15_000,
  maxTextChars: 50_000,
};

function sortPngByPage(a: string, b: string): number {
  const pageA = Number(a.match(/-(\d+)\.png$/)?.[1] ?? 0);
  const pageB = Number(b.match(/-(\d+)\.png$/)?.[1] ?? 0);
  return pageA - pageB;
}

async function safeRmDir(dirPath: string): Promise<void> {
  try {
    await fs.rm(dirPath, { recursive: true, force: true });
  } catch {
    // best-effort cleanup
  }
}

/**
 * OCR for scanned PDFs (server-side): PDF -> PNG (pdftoppm) -> text (tesseract).
 *
 * @security Processes potentially sensitive health data (DSGVO Art. 9). Do NOT log `text`.
 */
export async function ocrPdfBufferToText(
  pdfBuffer: Buffer,
  options: Partial<OcrPdfOptions> = {}
): Promise<OcrPdfResult> {
  const opts: OcrPdfOptions = { ...DEFAULTS, ...options };

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'abu-ocr-'));
  const pdfPath = path.join(tmpDir, 'input.pdf');
  const outputPrefix = path.join(tmpDir, 'page');

  try {
    await fs.writeFile(pdfPath, pdfBuffer);

    // Rasterize PDF pages to PNG
    // Output: `${outputPrefix}-1.png`, `${outputPrefix}-2.png`, ...
    await execFileAsync(
      'pdftoppm',
      [
        '-r',
        String(opts.dpi),
        '-f',
        '1',
        '-l',
        String(opts.maxPages),
        '-png',
        pdfPath,
        outputPrefix,
      ],
      {
        encoding: 'utf8',
        timeout: opts.timeoutMs,
        maxBuffer: 10 * 1024 * 1024,
      }
    );

    const files = await fs.readdir(tmpDir);
    const pngs = files
      .filter((f) => /^page-\d+\.png$/.test(f))
      .sort(sortPngByPage)
      .map((f) => path.join(tmpDir, f));

    let text = '';
    let pagesProcessed = 0;
    let truncated = false;

    for (const pngPath of pngs) {
      const remaining = opts.maxTextChars - text.length;
      if (remaining <= 0) {
        truncated = true;
        break;
      }

      const { stdout } = await execFileAsync(
        'tesseract',
        [
          pngPath,
          'stdout',
          '-l',
          opts.language,
          '--dpi',
          String(opts.dpi),
        ],
        {
          encoding: 'utf8',
          timeout: opts.perPageTimeoutMs,
          maxBuffer: 5 * 1024 * 1024,
        }
      );

      pagesProcessed += 1;
      const out =
        typeof stdout === 'string'
          ? stdout
          : stdout && typeof (stdout as any).toString === 'function'
            ? (stdout as any).toString('utf8')
            : '';

      if (out.trim()) {
        const chunk = out.trim();
        text += (text ? '\n\n' : '') + chunk.slice(0, remaining);
        if (chunk.length > remaining) truncated = true;
      }

      if (pagesProcessed >= opts.maxPages) break;
    }

    return {
      text,
      pagesProcessed,
      truncated,
    };
  } finally {
    await safeRmDir(tmpDir);
  }
}
