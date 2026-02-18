import { describe, it, expect } from "vitest";
import { parsePdf, ParsePdfResult } from "../../../../../lib/workflows/ingestion/nodes/parse-pdf";

/**
 * Build a minimal valid single-page PDF buffer containing the given text.
 * Computes correct xref byte offsets so pdf-parse can read it.
 */
function buildMinimalPdf(text: string): Buffer {
  const objects: string[] = [];
  const offsets: number[] = [];
  const header = "%PDF-1.4\n";
  let pos = Buffer.byteLength(header);

  function addObj(str: string) {
    offsets.push(pos);
    const chunk = str + "\n";
    pos += Buffer.byteLength(chunk);
    objects.push(chunk);
  }

  addObj("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj");
  addObj("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj");
  addObj(
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj",
  );

  const stream = `BT /F1 12 Tf 100 700 Td (${text}) Tj ET`;
  const streamLen = Buffer.byteLength(stream);
  addObj(
    `4 0 obj\n<< /Length ${streamLen} >>\nstream\n${stream}\nendstream\nendobj`,
  );
  addObj(
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj",
  );

  const xrefStart = pos;
  let xref = "xref\n0 6\n0000000000 65535 f \n";
  for (const o of offsets) {
    xref += String(o).padStart(10, "0") + " 00000 n \n";
  }
  xref += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

  return Buffer.from(header + objects.join("") + xref);
}

/** Build a valid PDF with a page but no text content. */
function buildEmptyContentPdf(): Buffer {
  const objects: string[] = [];
  const offsets: number[] = [];
  const header = "%PDF-1.4\n";
  let pos = Buffer.byteLength(header);

  function addObj(str: string) {
    offsets.push(pos);
    const chunk = str + "\n";
    pos += Buffer.byteLength(chunk);
    objects.push(chunk);
  }

  addObj("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj");
  addObj("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj");
  addObj(
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << >> >>\nendobj",
  );
  addObj("4 0 obj\n<< /Length 0 >>\nstream\n\nendstream\nendobj");

  const xrefStart = pos;
  let xref = "xref\n0 5\n0000000000 65535 f \n";
  for (const o of offsets) {
    xref += String(o).padStart(10, "0") + " 00000 n \n";
  }
  xref += `trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

  return Buffer.from(header + objects.join("") + xref);
}

describe("parsePdf", () => {
  // --- Requirement 1.2: Extract text content from PDF ---

  it("extracts text and page count from a valid PDF", async () => {
    const pdf = buildMinimalPdf("Hello World");
    const result = await parsePdf(pdf, "test.pdf");

    expect(result.text).toContain("Hello World");
    expect(result.pageCount).toBe(1);
    expect(result.filename).toBe("test.pdf");
  });

  it("returns trimmed text (no leading/trailing whitespace)", async () => {
    const pdf = buildMinimalPdf("Some content");
    const result = await parsePdf(pdf, "doc.pdf");

    expect(result.text).toBe(result.text.trim());
  });

  it("preserves the original filename in the result", async () => {
    const pdf = buildMinimalPdf("content");
    const result = await parsePdf(pdf, "剧本杀-迷雾庄园.pdf");

    expect(result.filename).toBe("剧本杀-迷雾庄园.pdf");
  });

  // --- Requirement 1.5: Reject non-PDF files ---

  it("rejects a plain text file", async () => {
    const buf = Buffer.from("This is just plain text, not a PDF.");
    await expect(parsePdf(buf, "readme.txt")).rejects.toThrow(
      "文件格式不受支持",
    );
  });

  it("rejects random bytes", async () => {
    const buf = Buffer.from([0x00, 0x01, 0x02, 0x03, 0xff, 0xfe]);
    await expect(parsePdf(buf, "random.bin")).rejects.toThrow(
      "文件格式不受支持",
    );
  });

  it("rejects an empty buffer", async () => {
    const buf = Buffer.alloc(0);
    await expect(parsePdf(buf, "empty.pdf")).rejects.toThrow(
      "文件格式不受支持",
    );
  });

  it("rejects a PNG file", async () => {
    const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    await expect(parsePdf(buf, "image.png")).rejects.toThrow(
      "文件格式不受支持",
    );
  });

  it("includes the filename in the error message for non-PDF", async () => {
    const buf = Buffer.from("not a pdf");
    await expect(parsePdf(buf, "report.docx")).rejects.toThrow("report.docx");
  });

  // --- Requirement 1.6: Reject empty PDF content ---

  it("rejects a PDF with empty text content", async () => {
    const pdf = buildEmptyContentPdf();
    await expect(parsePdf(pdf, "empty-content.pdf")).rejects.toThrow(
      "文档内容无法解析",
    );
  });

  it("includes the filename in the error message for empty content", async () => {
    const pdf = buildEmptyContentPdf();
    await expect(parsePdf(pdf, "blank.pdf")).rejects.toThrow("blank.pdf");
  });

  // --- Return type shape ---

  it("result conforms to ParsePdfResult interface", async () => {
    const pdf = buildMinimalPdf("test");
    const result: ParsePdfResult = await parsePdf(pdf, "shape.pdf");

    expect(typeof result.text).toBe("string");
    expect(typeof result.pageCount).toBe("number");
    expect(typeof result.filename).toBe("string");
  });
});
