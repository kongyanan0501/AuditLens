type ReportSection = {
  title: string;
  body: string;
};

type ReportViewerProps = {
  content: string | null;
};

const placeholderSections: ReportSection[] = [
  {
    title: "执行摘要",
    body: "审计任务完成后，将在此展示整体风险评级与关键发现摘要。",
  },
  {
    title: "发现项",
    body: "规则命中与异常检测结果将按严重程度结构化列出，含具体数据引用。",
  },
  {
    title: "风险分析",
    body: "综合评分、问题分布与内控影响将在此汇总说明。",
  },
  {
    title: "整改建议",
    body: "基于 RAG 政策上下文与 LLM 分析，生成可执行的整改建议。",
  },
];

function parseReportSections(content: string): ReportSection[] | null {
  const normalized = content.replace(/\r\n/g, "\n").trim();
  const sectionPattern = /^##\s+(.+)$/gm;
  const matches = [...normalized.matchAll(sectionPattern)];

  if (matches.length === 0) {
    return null;
  }

  const sections: ReportSection[] = [];

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const title = match[1]?.trim();
    if (!title) continue;

    const start = (match.index ?? 0) + match[0].length;
    const end =
      index + 1 < matches.length
        ? (matches[index + 1].index ?? normalized.length)
        : normalized.length;
    const body = normalized.slice(start, end).trim();

    sections.push({ title, body });
  }

  return sections.length > 0 ? sections : null;
}

function ReportSectionBlock({ title, body }: ReportSection) {
  return (
    <section className="space-y-2 border-l-2 border-primary/30 pl-4">
      <h3 className="font-semibold tracking-tight">{title}</h3>
      <div className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
        {body}
      </div>
    </section>
  );
}

export function ReportViewer({ content }: ReportViewerProps) {
  if (!content) {
    return (
      <article className="al-panel overflow-hidden">
        <div className="border-b border-[var(--border-subtle)] px-6 py-4">
          <h2 className="font-semibold tracking-tight">报告预览</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            分析完成后将自动生成结构化审计报告
          </p>
        </div>
        <div className="space-y-8 px-6 py-8">
          {placeholderSections.map((section) => (
            <ReportSectionBlock key={section.title} {...section} />
          ))}
        </div>
      </article>
    );
  }

  const sections = parseReportSections(content);
  const subtitleMatch = content.match(/^>\s*(.+)$/m);
  const subtitle = subtitleMatch?.[1]?.trim();

  return (
    <article className="al-panel overflow-hidden">
      <div className="border-b border-[var(--border-subtle)] px-6 py-4">
        <h2 className="font-semibold tracking-tight">审计报告</h2>
        {subtitle ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      <div className="px-6 py-8">
        {sections ? (
          <div className="space-y-8">
            {sections.map((section) => (
              <ReportSectionBlock key={section.title} {...section} />
            ))}
          </div>
        ) : (
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">
            {content}
          </pre>
        )}
      </div>
    </article>
  );
}
