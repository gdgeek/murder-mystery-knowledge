"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import ScriptSelector from "@/components/ScriptSelector";

interface DocumentItem {
  id: string;
  filename: string;
  status: string;
  upload_date: string;
  page_count: number | null;
  chunk_count: number;
}

type SingleUploadStatus = "idle" | "uploading" | "processing" | "completed" | "failed";

interface FileUploadEntry {
  file: File;
  status: "pending" | "uploading" | "completed" | "failed";
  error?: string;
}

export default function UploadPage() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedScriptId, setSelectedScriptId] = useState<string | null>(null);

  // Single-file mode state (no script selected)
  const [singleStatus, setSingleStatus] = useState<SingleUploadStatus>("idle");
  const [singleError, setSingleError] = useState<string | null>(null);

  // Batch mode state (script selected)
  const [batchFiles, setBatchFiles] = useState<FileUploadEntry[]>([]);
  const [isBatchUploading, setIsBatchUploading] = useState(false);

  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await fetch("/api/documents");
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.items ?? []);
      }
    } catch {
      // silently ignore fetch errors for the list
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // --- Single file upload (backward compatible, no script) ---
  const uploadSingleFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setSingleError("仅支持 PDF 文件");
      setSingleStatus("failed");
      return;
    }

    setSingleStatus("uploading");
    setSingleError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      setSingleStatus("processing");
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        setSingleError(data.error ?? "上传失败");
        setSingleStatus("failed");
        return;
      }

      setSingleStatus("completed");
      fetchDocuments();
    } catch {
      setSingleError("网络错误，请稍后重试");
      setSingleStatus("failed");
    }
  };

  // --- Batch upload (script selected) ---
  const uploadBatchFiles = async (files: File[]) => {
    const entries: FileUploadEntry[] = files.map((file) => ({
      file,
      status: file.name.toLowerCase().endsWith(".pdf") ? "pending" as const : "failed" as const,
      ...(file.name.toLowerCase().endsWith(".pdf") ? {} : { error: "仅支持 PDF 文件" }),
    }));

    setBatchFiles(entries);
    setIsBatchUploading(true);

    for (let i = 0; i < entries.length; i++) {
      if (entries[i].status === "failed") continue; // skip non-PDF

      entries[i] = { ...entries[i], status: "uploading" };
      setBatchFiles([...entries]);

      try {
        const formData = new FormData();
        formData.append("file", entries[i].file);
        if (selectedScriptId) {
          formData.append("script_id", selectedScriptId);
        }

        const res = await fetch("/api/upload", { method: "POST", body: formData });
        const data = await res.json();

        if (!res.ok) {
          entries[i] = { ...entries[i], status: "failed", error: data.error ?? "上传失败" };
        } else {
          entries[i] = { ...entries[i], status: "completed" };
        }
      } catch {
        entries[i] = { ...entries[i], status: "failed", error: "网络错误，请稍后重试" };
      }

      setBatchFiles([...entries]);
    }

    setIsBatchUploading(false);
    fetchDocuments();
  };

  // --- Event handlers ---
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    if (selectedScriptId) {
      if (!isBatchUploading) uploadBatchFiles(files);
    } else {
      uploadSingleFile(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    if (selectedScriptId) {
      if (!isBatchUploading) uploadBatchFiles(files);
    } else {
      uploadSingleFile(files[0]);
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const statusLabel = (status: string) => {
    const map: Record<string, { text: string; color: string }> = {
      uploading: { text: "上传中", color: "text-blue-600" },
      parsing: { text: "解析中", color: "text-yellow-600" },
      chunking: { text: "分块中", color: "text-yellow-600" },
      embedding: { text: "向量化中", color: "text-yellow-600" },
      extracting: { text: "提取中", color: "text-yellow-600" },
      completed: { text: "已完成", color: "text-green-600" },
      failed: { text: "失败", color: "text-red-600" },
    };
    return map[status] ?? { text: status, color: "text-gray-600" };
  };

  const isMultiMode = !!selectedScriptId;
  const dropZoneHint = isMultiMode
    ? "拖拽多个 PDF 文件到此处，或点击选择文件"
    : "拖拽 PDF 文件到此处，或点击选择文件";

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6 md:p-12">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 mb-8">
          文档上传
        </h1>

        {/* Script selector */}
        <div className="mb-6">
          <ScriptSelector
            selectedScriptId={selectedScriptId}
            onSelect={setSelectedScriptId}
          />
        </div>

        {/* Drop zone */}
        <div
          role="button"
          tabIndex={0}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
          }}
          className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 transition-colors cursor-pointer ${
            dragOver
              ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
              : "border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600"
          }`}
        >
          <svg
            className="mb-4 h-10 w-10 text-zinc-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 16V4m0 0l-4 4m4-4l4 4M4 20h16"
            />
          </svg>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {dropZoneHint}
          </p>
          <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
            仅支持 PDF 格式，最大 50MB
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={handleFileSelect}
            aria-label="选择 PDF 文件"
            {...(isMultiMode ? { multiple: true } : {})}
          />
        </div>

        {/* Single-file upload status (no script selected) */}
        {!isMultiMode && singleStatus !== "idle" && (
          <div className="mt-4 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4">
            <div className="flex items-center gap-3">
              {singleStatus === "uploading" || singleStatus === "processing" ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
              ) : singleStatus === "completed" ? (
                <span className="text-green-600">✓</span>
              ) : (
                <span className="text-red-600">✗</span>
              )}
              <span className="text-sm text-zinc-700 dark:text-zinc-300">
                {singleStatus === "uploading" && "正在上传文件…"}
                {singleStatus === "processing" && "正在处理文档…"}
                {singleStatus === "completed" && "文档处理完成"}
                {singleStatus === "failed" && (singleError ?? "上传失败")}
              </span>
            </div>
          </div>
        )}

        {/* Batch upload progress (script selected) */}
        {isMultiMode && batchFiles.length > 0 && (
          <div className="mt-4 space-y-2">
            {batchFiles.map((entry, idx) => (
              <div
                key={`${entry.file.name}-${idx}`}
                className="flex items-center gap-3 rounded-lg border border-zinc-200 dark:border-zinc-800 p-3"
              >
                {entry.status === "pending" && (
                  <span className="text-zinc-400 text-xs">⏳</span>
                )}
                {entry.status === "uploading" && (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                )}
                {entry.status === "completed" && (
                  <span className="text-green-600">✓</span>
                )}
                {entry.status === "failed" && (
                  <span className="text-red-600">✗</span>
                )}
                <span className="flex-1 truncate text-sm text-zinc-700 dark:text-zinc-300">
                  {entry.file.name}
                </span>
                {entry.status === "failed" && entry.error && (
                  <span className="text-xs text-red-500">{entry.error}</span>
                )}
                {entry.status === "completed" && (
                  <span className="text-xs text-green-600">完成</span>
                )}
                {entry.status === "uploading" && (
                  <span className="text-xs text-blue-600">处理中…</span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Document list */}
        <div className="mt-10">
          <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-4">
            已上传文档
          </h2>
          {documents.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              暂无文档，请上传 PDF 文件。
            </p>
          ) : (
            <ul className="space-y-3">
              {documents.map((doc) => {
                const s = statusLabel(doc.status);
                return (
                  <li
                    key={doc.id}
                    className="flex items-center justify-between rounded-lg border border-zinc-200 dark:border-zinc-800 p-4"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {doc.filename}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        {doc.page_count != null && `${doc.page_count} 页 · `}
                        {doc.chunk_count} 块 ·{" "}
                        {new Date(doc.upload_date).toLocaleDateString()}
                      </p>
                    </div>
                    <span className={`ml-4 text-xs font-medium ${s.color}`}>
                      {s.text}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
