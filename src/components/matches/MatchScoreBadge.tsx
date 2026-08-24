import { Badge } from "@/components/ui/Badge";

export function matchScoreLabel(score: number) {
  if (score >= 90) return "Excellent";
  if (score >= 80) return "Strong";
  if (score >= 70) return "Good";
  return "Possible";
}

export function MatchScoreBadge({ label, score }: { label?: string; score: number }) {
  const tone = score >= 90 ? "emerald" : score >= 80 ? "blue" : score >= 70 ? "amber" : "slate";
  return (
    <div className="flex flex-col items-start gap-1">
      <Badge tone={tone}>{score}%</Badge>
      <span className="text-xs text-slate-500">{label || matchScoreLabel(score)}</span>
    </div>
  );
}
