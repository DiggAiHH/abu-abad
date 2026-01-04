export async function extractTextFromImageFile(file: File): Promise<string> {
  // Rein lokal: Browser TextDetector API (kein Upload, keine externen Modelle)
  // Hinweis: Nicht in allen Browsern verfügbar.
  const TextDetectorCtor = (window as any).TextDetector as
    | (new () => { detect: (image: ImageBitmap) => Promise<Array<{ rawValue?: string }>> })
    | undefined;

  if (!TextDetectorCtor) {
    throw new Error('OCR/Text-Erkennung wird von diesem Browser nicht unterstützt.');
  }

  const imageBitmap = await createImageBitmap(file);
  try {
    const detector = new TextDetectorCtor();
    const results = await detector.detect(imageBitmap);
    const text = (results || [])
      .map((r) => (r?.rawValue || '').trim())
      .filter(Boolean)
      .join('\n');

    return text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/[\t ]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  } finally {
    imageBitmap.close();
  }
}
