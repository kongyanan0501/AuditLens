"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Panel, PanelHeader } from "@/components/ui/panel";

type RuleConfigView = {
  amountAnomalyMultiplier: number;
  vendorConcentrationThreshold: number;
  approvalRequiredMinAmount: number;
  version: number;
  scopeKey: string;
  changeNote: string | null;
  createdAt?: string | null;
  history?: RuleConfigView[];
};

export function RuleConfigForm() {
  const [config, setConfig] = useState<RuleConfigView | null>(null);
  const [history, setHistory] = useState<RuleConfigView[]>([]);
  const [multiplier, setMultiplier] = useState("5");
  const [vendorShare, setVendorShare] = useState("50");
  const [approvalMin, setApprovalMin] = useState("0");
  const [changeNote, setChangeNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const response = await fetch("/api/settings/rules");
      const json = (await response.json()) as {
        data?: RuleConfigView;
        error?: string;
      };
      if (!response.ok || !json.data) {
        setError(json.error ?? "加载规则配置失败");
        return;
      }
      setConfig(json.data);
      setHistory(json.data.history ?? []);
      setMultiplier(String(json.data.amountAnomalyMultiplier));
      setVendorShare(String(json.data.vendorConcentrationThreshold * 100));
      setApprovalMin(String(json.data.approvalRequiredMinAmount));
    });
  }, []);

  const handleSave = () => {
    setMessage(null);
    setError(null);
    if (!changeNote.trim()) {
      setError("请填写变更说明");
      return;
    }
    startTransition(async () => {
      const response = await fetch("/api/settings/rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountAnomalyMultiplier: Number(multiplier),
          vendorConcentrationThreshold: Number(vendorShare) / 100,
          approvalRequiredMinAmount: Number(approvalMin),
          changeNote: changeNote.trim(),
        }),
      });
      const json = (await response.json()) as {
        data?: RuleConfigView;
        error?: string;
      };
      if (!response.ok || !json.data) {
        setError(json.error ?? "保存失败");
        return;
      }
      setConfig(json.data);
      setHistory((prev) => [json.data!, ...prev].slice(0, 10));
      setChangeNote("");
      setMessage(`已发布规则配置 v${json.data.version}`);
    });
  };

  return (
    <Panel className="overflow-hidden">
      <PanelHeader
        title="规则阈值"
        description="变更将写入新版本并用于后续审计任务；历史命中保留当时版本号"
      />
      <div className="space-y-4 px-5 py-4">
        {config ? (
          <p className="text-xs text-muted-foreground">
            当前生效：scope={config.scopeKey} · v{config.version}
            {config.changeNote ? ` · ${config.changeNote}` : ""}
          </p>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="space-y-1 text-xs">
            <span className="text-muted-foreground">金额异常倍数</span>
            <input
              className="w-full rounded-md border border-[var(--border-subtle)] bg-background px-2 py-1.5"
              value={multiplier}
              onChange={(event) => setMultiplier(event.target.value)}
              inputMode="decimal"
            />
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-muted-foreground">供应商集中阈值（%）</span>
            <input
              className="w-full rounded-md border border-[var(--border-subtle)] bg-background px-2 py-1.5"
              value={vendorShare}
              onChange={(event) => setVendorShare(event.target.value)}
              inputMode="decimal"
            />
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-muted-foreground">必审金额（0=全部支出）</span>
            <input
              className="w-full rounded-md border border-[var(--border-subtle)] bg-background px-2 py-1.5"
              value={approvalMin}
              onChange={(event) => setApprovalMin(event.target.value)}
              inputMode="decimal"
            />
          </label>
        </div>

        <label className="block space-y-1 text-xs">
          <span className="text-muted-foreground">变更说明（必填）</span>
          <input
            className="w-full rounded-md border border-[var(--border-subtle)] bg-background px-2 py-1.5"
            value={changeNote}
            onChange={(event) => setChangeNote(event.target.value)}
            placeholder="例如：按事业部 A 调整供应商集中度"
            required
          />
        </label>

        <Button
          type="button"
          size="sm"
          disabled={pending || !changeNote.trim()}
          onClick={handleSave}
        >
          发布新版本
        </Button>

        {message ? (
          <p className="text-xs text-success">{message}</p>
        ) : null}
        {error ? <p className="text-xs text-destructive">{error}</p> : null}

        {history.length > 0 ? (
          <div className="space-y-2 border-t border-[var(--border-subtle)] pt-3">
            <p className="text-xs font-medium text-muted-foreground">最近变更</p>
            <ul className="space-y-2 text-xs">
              {history.slice(0, 8).map((row) => (
                <li
                  key={`${row.scopeKey}-v${row.version}`}
                  className="rounded-md border border-[var(--border-subtle)] px-2 py-1.5"
                >
                  <p className="font-medium">
                    v{row.version}
                    {row.createdAt
                      ? ` · ${new Date(row.createdAt).toLocaleString("zh-CN")}`
                      : ""}
                  </p>
                  <p className="text-muted-foreground">
                    倍数 {row.amountAnomalyMultiplier} · 集中{" "}
                    {(row.vendorConcentrationThreshold * 100).toFixed(0)}% · 必审{" "}
                    {row.approvalRequiredMinAmount}
                  </p>
                  {row.changeNote ? (
                    <p className="mt-0.5">{row.changeNote}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </Panel>
  );
}
