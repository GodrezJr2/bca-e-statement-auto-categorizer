"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, FileText, BarChart2, LogOut, Upload, ChevronRight
} from "lucide-react";
import { createClient } from "@/lib/supabase";

const NAV = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/dashboard/statements", icon: FileText, label: "Statements" },
  { href: "/dashboard/analytics", icon: BarChart2, label: "Analytics" },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <aside style={{ background: "var(--sidebar-bg)" }}
      className="fixed left-0 top-0 h-screen w-56 flex flex-col z-10 select-none">
      {/* Logo */}
      <div className="px-6 py-7 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "var(--accent-blue)" }}>
            <span className="text-white text-xs font-bold" style={{ fontFamily: "Sora, sans-serif" }}>BCA</span>
          </div>
          <div>
            <p className="text-white text-sm font-semibold leading-none" style={{ fontFamily: "Sora, sans-serif" }}>e-Statement</p>
            <p className="text-xs mt-0.5" style={{ color: "#64748B" }}>Financial Hub</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-5 space-y-1">
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = pathname === href;
          return (
            <Link key={href} href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 group"
              style={{
                background: active ? "var(--accent-blue)" : "transparent",
                color: active ? "#fff" : "#94A3B8",
              }}>
              <Icon size={16} />
              <span className="text-sm font-medium flex-1">{label}</span>
              {active && <ChevronRight size={14} className="opacity-60" />}
            </Link>
          );
        })}
      </nav>

      {/* Upload CTA */}
      <div className="px-3 pb-4">
        <Link href="/dashboard"
          className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg text-sm font-semibold transition-all"
          style={{ background: "var(--accent-blue)", color: "#fff" }}>
          <Upload size={15} />
          Upload Statement
        </Link>
      </div>

      {/* Logout */}
      <div className="px-3 pb-6">
        <button onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg w-full transition-all duration-150 text-sm"
          style={{ color: "#64748B" }}>
          <LogOut size={15} />
          Logout
        </button>
      </div>
    </aside>
  );
}
