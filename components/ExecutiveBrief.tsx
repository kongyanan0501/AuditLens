import type { ExecutiveBriefModel } from "@/server/brief";
import type { IssueSeverity, IssueType } from "@/types/audit";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { cn } from "@/lib/utils";

type ExecutiveBriefProps = {
  model: ExecutiveBriefModel;
};

const typeLabels: Record<IssueType, string> = {
  duplicate: "重复发票",
  anomaly: "金额异常",
  approval: "审批缺失",
  vendor_concentration: "供应商集中",
};

const severityLabels: Record<IssueSeverity, string> = {
  low: "低",
  medium: "中",
  high: "高",
};

const severityStyles: Record<IssueSeverity, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-warning/15 text-warning",
  high: "bg-destructive/15 text-destructive",
};

export function ExecutiveBrief({ model }: ExecutiveBriefProps) {
  return (
    <Panel className="overflow-hidden" glow>
      <PanelHeader
        title="管理层摘要"
        description="面向财务与内控负责人的一页纸结论"
      />
      <div className="space-y-6 p-5">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-3">
            <p className="text-sm font-semibold tracking-tight text-foreground">
              风险结论
            </p>
            <p className="al-metric text-3xl font-semibold">
              {model.score === null ? "—" : model.score}
              {model.score !== null ? (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  / 100 · {model.tierLabel}
                </span>
              ) : null}
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {model.scoreNarrative}
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold tracking-tight text-foreground">
              覆盖范围
            </p>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">发现问题</dt>
                <dd className="font-medium">{model.issueCount}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">高风险项</dt>
                <dd className="font-medium text-destructive">{model.highCount}</dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-semibold tracking-tight text-foreground">
            优先整改 Top3
          </p>
          {model.topActions.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无待整改项</p>
          ) : (
            <ol className="space-y-3">
              {model.topActions.map((action, index) => (
                <li key={`${action.type}-${index}`} className="text-sm">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="font-medium text-foreground">
                      {index + 1}. {typeLabels[action.type]}
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        severityStyles[action.severity],
                      )}
                    >
                      {severityLabels[action.severity]}
                    </span>
                  </div>
                  <p className="text-muted-foreground">{action.summary}</p>
                  {action.recommendation ? (
                    <p className="mt-1 text-xs text-foreground/80">
                      建议：{action.recommendation}
                    </p>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </Panel>
  );
}
