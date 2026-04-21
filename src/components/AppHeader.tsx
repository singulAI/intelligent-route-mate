import { Link, useLocation } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Bus, LayoutDashboard, Navigation } from "lucide-react";

export default function AppHeader() {
  const location = useLocation();
  const path = location.pathname;

  const tabs = [
    { to: "/gestor", label: "Gestor", icon: LayoutDashboard },
    { to: "/motorista", label: "Motorista", icon: Navigation },
  ] as const;

  return (
    <header className="glass sticky top-0 z-40 border-b">
      <div className="mx-auto flex h-16 items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow-[var(--shadow-glow)]">
            <Bus className="h-5 w-5" strokeWidth={2} />
          </div>
          <span className="text-sm font-semibold tracking-wide">
            RA Routes
          </span>
        </Link>

        <nav className="flex items-center gap-1 rounded-full border border-border bg-surface/60 p-1 backdrop-blur">
          {tabs.map((t) => {
            const active = path.startsWith(t.to);
            const Icon = t.icon;
            return (
              <Link
                key={t.to}
                to={t.to}
                className="relative flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-colors"
              >
                {active && (
                  <motion.div
                    layoutId="header-pill"
                    className="absolute inset-0 rounded-full bg-primary"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                <span
                  className={`relative z-10 flex items-center gap-2 ${active ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <Icon className="h-4 w-4" strokeWidth={2} />
                  {t.label}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
