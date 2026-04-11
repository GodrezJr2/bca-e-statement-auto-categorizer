"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, FileText, BarChart2, LogOut, Upload, ChevronRight, Menu, X
} from "lucide-react";
import { createClient } from "@/lib/supabase";

const NAV = [
  { href: "/dashboard",            icon: LayoutDashboard, label: "Dashboard"  },
  { href: "/dashboard/statements", icon: FileText,         label: "Statements" },
  { href: "/dashboard/analytics",  icon: BarChart2,        label: "Analytics"  },
];

function SidebarContent({ onNav }: { onNav?: () => void }) {
  const pathname = usePathname();
  const router   = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-6 py-7" style={{ borderBottom: "1px solid var(--sidebar-border)" }}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "var(--accent-gradient)" }}>
            <span className="text-white text-xs font-bold" style={{ fontFamily: "Sora, sans-serif" }}>BCA</span>
          </div>
          <div>
            <p className="text-white text-sm font-semibold leading-none" style={{ fontFamily: "Sora, sans-serif" }}>e-Statement</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Financial Hub</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-5 space-y-1">
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = pathname === href;
          return (
            <Link key={href} href={href} onClick={onNav}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150"
              style={{
                background: active ? "var(--accent-gradient)" : "transparent",
                color: active ? "#fff" : "var(--text-secondary)",
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
        <Link href="/dashboard" onClick={onNav}
          className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg text-sm font-semibold transition-all"
          style={{ background: "var(--accent-gradient)", color: "#fff" }}>
          <Upload size={15} />
          Upload Statement
        </Link>
      </div>

      {/* Logout */}
      <div className="px-3 pb-6">
        <button onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg w-full transition-all duration-150 text-sm"
          style={{ color: "var(--text-muted)" }}>
          <LogOut size={15} />
          Logout
        </button>
      </div>
    </div>
  );
}

export function Sidebar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        style={{ background: "var(--sidebar-bg)", borderRight: "1px solid var(--sidebar-border)" }}
        className="hidden md:flex fixed left-0 top-0 h-screen w-56 flex-col z-20 select-none">
        <SidebarContent />
      </aside>

      {/* Mobile top bar */}
      <header
        style={{ background: "var(--sidebar-bg)", borderBottom: "1px solid var(--sidebar-border)" }}
        className="md:hidden fixed top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: "var(--accent-blue)" }}>
            <span className="text-white text-xs font-bold" style={{ fontFamily: "Sora, sans-serif" }}>BCA</span>
          </div>
          <p className="text-sm font-semibold" style={{ fontFamily: "Sora, sans-serif", color: "var(--text-primary)" }}>e-Statement</p>
        </div>
        <button onClick={() => setOpen(true)} style={{ color: "var(--text-muted)" }}>
          <Menu size={22} />
        </button>
      </header>

      {/* Mobile drawer overlay */}
      {open && (
        <div className="md:hidden fixed inset-0 z-30 flex">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          {/* Drawer */}
          <aside className="relative w-64 h-full flex flex-col select-none"
            style={{ background: "var(--sidebar-bg)", borderRight: "1px solid var(--sidebar-border)" }}>
            <button onClick={() => setOpen(false)}
              className="absolute top-4 right-4"
              style={{ color: "#64748B" }}>
              <X size={20} />
            </button>
            <SidebarContent onNav={() => setOpen(false)} />
          </aside>
        </div>
      )}
    </>
  );
}
