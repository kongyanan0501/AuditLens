import { BarChart3 } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { issueTypeChartColor } from "@/lib/theme";

const categories = [
  { label: "重复发票", key: "duplicate" },
  { label: "金额异常", key: "anomaly" },
  { label: "审批缺失", key: "approval" },
  { label: "供应商集中", key: "vendor_concentration" },
] as const;

export function RiskChartPlaceholder() {
  return (
    <Panel className="flex h-full flex-col overflow-hidden">
      <PanelHeader
        title="风险分布"
        description="完成分析后将展示各类问题占比"
      />

      <div className="flex flex-1 flex-col">
        <div className="flex flex-1 items-end gap-3 px-5 pb-2 pt-8">
          {categories.map((category) => (
            <div
              key={category.key}
              className="flex flex-1 flex-col items-center gap-2"
            >
              <div
                className="w-full rounded-t-md opacity-40"
                style={{
                  height: "12%",
                  backgroundColor: issueTypeChartColor[category.key],
                }}
                aria-hidden
              />
              <span className="text-center text-[10px] leading-tight text-muted-foreground">
                {category.label}
              </span>
            </div>
          ))}
        </div>

        <EmptyState
          icon={BarChart3}
          title="等待分析数据"
          description="上传 Excel 或 CSV 后，各类风险的分布将在此可视化。"
          className="border-t border-[var(--border-subtle)] py-8"
        />
      </div>
    </Panel>
  );
}
