"use client";
import { useEffect, useState } from "react";
import { TrendingDown, TrendingUp, Hash } from "lucide-react";

interface Props {
  label: string;
  value: number;
  type: "expense" | "income" | "count";
  subtitle?: string;
}

function useCountUp(target: number, duration = 1000) {
  const [current, setCurrent] = useState(0);
  useEffect(() => {
    if (target === 0) return;
    const start = Date.now();
    const tick = () => {
      const p = Math.min((Date.now() - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setCurrent(Math.round(target * ease));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, duration]);
  return current;
}

export function StatsCard({ label, value, type, subtitle }: Props) {
  const animated = useCountUp(value);

  const config = {
    expense: {
      icon: TrendingDown,
      color: "var(--expense-red)",
      bg: "#FEF2F2",
      prefix: "Rp ",
    },
    income: {
      icon: TrendingUp,
      color: "var(--income-green)",
      bg: "#ECFDF5",
      prefix: "Rp ",
    },
    count: {
      icon: Hash,
      color: "var(--accent-blue)",
      bg: "#EFF6FF",
      prefix: "",
    },
  }[type];

  const Icon = config.icon;
  const display = type === "count"
    ? animated.toString()
    : animated.toLocaleString("id-ID");

  return (
    <div className="rounded-2xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)", fontFamily: "DM Sans, sans-serif" }}>
          {label}
        </p>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: config.bg }}>
          <Icon size={15} style={{ color: config.color }} />
        </div>
      </div>
      <p className="text-2xl font-bold leading-none" style={{ color: config.color, fontFamily: "Sora, sans-serif" }}>
        {config.prefix}{display}
      </p>
      {subtitle && (
        <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>{subtitle}</p>
      )}
    </div>
  );
}
