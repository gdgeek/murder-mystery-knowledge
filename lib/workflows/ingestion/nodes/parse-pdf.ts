import { PDFParse } from "pdf-parse";

/** Result returned on successful PDF text extraction. */
export interface ParsePdfResult {
  /** Extracted full text from the PDF. */
  text: string;
  /** Total number of pages in the PDF. */
  pageCount: number;
  /** Original filename that was processed. */
  filename: string;
}

/** PDF magic bytes: every valid PDF starts with "%PDF" */
const PDF_MAGIC = Buffer.from([0x25, 0x50, 0x44, 0x46]); // %PDF

/**
 * Parse a PDF buffer and extract its text content.
 *
 * Validates:
 * - The buffer starts with PDF magic bytes (%PDF) → Requirement 1.5
 * - The extracted text is non-empty → Requirement 1.6
 *
 * @param buffer  Raw file content
 * @param filename  Original filename (used in error messages and result)
 * @returns Extracted text, page count, and filename
 * @throws Error if the file is not a valid PDF or content is empty
 */
export async function parsePdf(
  buffer: Buffer,
  filename: string,
): Promise<ParsePdfResult> {
  // Requirement 1.5: reject non-PDF files via magic bytes
  if (!isPdfBuffer(buffer)) {
    throw new Error(
      `文件格式不受支持：${filename} 不是有效的 PDF 文件`,
    );
  }

  const parser = new PDFParse({ data: buffer });

  let textResult;
  try {
    textResult = await parser.getText();
  } catch {
    throw new Error(
      `文件格式不受支持：${filename} 不是有效的 PDF 文件`,
    );
  } finally {
    await parser.destroy();
  }

  // Collect text from all pages
  const pageTexts = textResult.pages.map((p) => p.text);
  const fullText = pageTexts.join("\n").trim();

  // Requirement 1.6: reject empty content
  if (fullText.length === 0) {
    throw new Error(
      `文档内容无法解析：${filename} 的 PDF 内容为空或无法提取文本`,
    );
  }

  return {
    text: fullText,
    pageCount: textResult.total,
    filename,
  };
}

/**
 * Check whether a buffer starts with the PDF magic bytes (%PDF).
 */
function isPdfBuffer(buffer: Buffer): boolean {
  if (buffer.length < 4) {
    return false;
  }
  return buffer.subarray(0, 4).equals(PDF_MAGIC);
}
