import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';

const execFileMock = vi.fn();

vi.mock('node:child_process', () => ({
  execFile: execFileMock,
}));

describe('ocrPdfBufferToText', () => {
  beforeEach(() => {
    execFileMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('runs pdftoppm then tesseract and concatenates text', async () => {
    execFileMock.mockImplementation((cmd: any, args: any, _opts: any, cb: any) => {
      // pdftoppm: create fake PNG outputs based on prefix
      if (cmd === 'pdftoppm') {
        const prefix = args[args.length - 1] as string;
        void fs
          .writeFile(`${prefix}-1.png`, 'x')
          .then(() => fs.writeFile(`${prefix}-2.png`, 'x'))
          .then(() => cb(null, '', ''))
          .catch((err) => cb(err));
        return;
      }

      // tesseract: return deterministic text
      if (cmd === 'tesseract') {
        const pngPath = args[0] as string;
        const page = Number(pngPath.match(/-(\d+)\.png$/)?.[1] ?? 0);
        cb(null, `Seite ${page}\n`, '');
        return;
      }

      cb(new Error(`unexpected cmd: ${cmd}`));
    });

    const { ocrPdfBufferToText } = await import('./ocr.js');
    const result = await ocrPdfBufferToText(Buffer.from('%PDF-FAKE%'), {
      language: 'deu',
      maxPages: 10,
      dpi: 200,
      timeoutMs: 10_000,
      perPageTimeoutMs: 10_000,
      maxTextChars: 10_000,
    });

    expect(result.pagesProcessed).toBe(2);
    expect(result.truncated).toBe(false);
    expect(result.text).toContain('Seite 1');
    expect(result.text).toContain('Seite 2');
  });

  it('throws ENOENT when binaries are missing', async () => {
    const err: any = new Error('not found');
    err.code = 'ENOENT';

    execFileMock.mockImplementation((_cmd: any, _args: any, _opts: any, cb: any) => {
      cb(err);
    });

    const { ocrPdfBufferToText } = await import('./ocr.js');

    await expect(
      ocrPdfBufferToText(Buffer.from('%PDF-FAKE%'), { language: 'deu' })
    ).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
