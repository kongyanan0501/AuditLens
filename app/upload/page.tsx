import { UploadCard } from "@/components/UploadCard";

export default function UploadPage() {
  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary">上传财务数据</h1>
        <p className="text-sm text-muted-foreground">
          支持 Excel / CSV，上传后触发审计分析流水线
        </p>
      </div>
      <UploadCard />
    </section>
  );
}
