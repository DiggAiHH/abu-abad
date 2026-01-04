declare module 'pdf-parse' {
  type PdfParseResult = {
    text?: string;
    numpages?: number;
    info?: unknown;
    metadata?: unknown;
    version?: string;
  } & Record<string, any>;

  const pdfParse: (data: Buffer | Uint8Array, options?: any) => Promise<PdfParseResult>;
  export default pdfParse;
}
