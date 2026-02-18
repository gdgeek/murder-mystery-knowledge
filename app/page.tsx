import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-center gap-12 px-8 py-16 bg-white dark:bg-black">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-black dark:text-zinc-50">
            剧本杀知识库
          </h1>
          <p className="mt-3 text-lg text-zinc-600 dark:text-zinc-400">
            AI 驱动的剧本杀文档处理与知识管理平台
          </p>
        </div>

        <nav className="grid w-full gap-4 sm:grid-cols-3" aria-label="主导航">
          <Link
            href="/upload"
            className="flex flex-col items-center gap-3 rounded-xl border border-zinc-200 p-6 text-center transition-colors hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:border-zinc-600 dark:hover:bg-zinc-900"
          >
            <span className="text-3xl" role="img" aria-label="上传">📄</span>
            <span className="text-lg font-semibold text-black dark:text-zinc-50">
              文档上传
            </span>
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              上传 PDF 剧本，自动解析与提取
            </span>
          </Link>

          <Link
            href="/chat"
            className="flex flex-col items-center gap-3 rounded-xl border border-zinc-200 p-6 text-center transition-colors hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:border-zinc-600 dark:hover:bg-zinc-900"
          >
            <span className="text-3xl" role="img" aria-label="聊天">💬</span>
            <span className="text-lg font-semibold text-black dark:text-zinc-50">
              智能问答
            </span>
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              基于知识库的自然语言问答
            </span>
          </Link>

          <Link
            href="/search"
            className="flex flex-col items-center gap-3 rounded-xl border border-zinc-200 p-6 text-center transition-colors hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:border-zinc-600 dark:hover:bg-zinc-900"
          >
            <span className="text-3xl" role="img" aria-label="搜索">🔍</span>
            <span className="text-lg font-semibold text-black dark:text-zinc-50">
              结构化检索
            </span>
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              多维度筛选与语义搜索
            </span>
          </Link>
        </nav>
      </main>
    </div>
  );
}
