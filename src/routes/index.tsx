import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bus, LayoutDashboard, Navigation, MapPin, Volume2 } from "lucide-react";
import { Link, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RA Routes — Gestão Inteligente da Linha 474" },
      {
        name: "description",
        content:
          "Sistema profissional para gestão e condução assistida da Linha 474, com voz, telemetria e mapa interativo.",
      },
    ],
  }),
  component: Splash,
});

function Splash() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* ambient blobs */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-accent/15 blur-3xl" />
      </div>

      <main className="relative mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center px-6 py-20">
        <AnimatePresence>
          {mounted && (
            <>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="mb-6 flex items-center gap-3 rounded-full border border-border bg-surface/60 px-4 py-1.5 backdrop-blur"
              >
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                </span>
                <span className="font-mono text-xs uppercase tracking-[0.25em] text-muted-foreground">
                  Sistema Ativo · v1.0
                </span>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.1 }}
                className="text-center text-5xl font-bold tracking-tight md:text-7xl"
              >
                Condução{" "}
                <span className="bg-gradient-to-br from-primary via-primary to-accent bg-clip-text text-transparent">
                  inteligente
                </span>
                <br />
                para a Linha 474
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.25 }}
                className="mt-6 max-w-2xl text-center text-lg text-muted-foreground"
              >
                Gerencie rotas e dirija com orientações de voz em tempo real,
                telemetria simulada e dicas de condução econômica.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="mt-12 grid w-full max-w-3xl gap-4 md:grid-cols-2"
              >
                <Link
                  to="/gestor"
                  className="group relative overflow-hidden rounded-2xl border border-border bg-surface p-6 transition-all hover:border-primary/50 hover:shadow-[var(--shadow-elevated)]"
                >
                  <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-primary/10 blur-2xl transition-all group-hover:bg-primary/20" />
                  <div className="relative">
                    <div className="mb-4 grid h-12 w-12 place-items-center rounded-xl bg-primary/15 text-primary">
                      <LayoutDashboard className="h-6 w-6" strokeWidth={1.75} />
                    </div>
                    <h3 className="text-xl font-semibold">Modo Gestor</h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Crie, edite e organize rotas. Adicione waypoints clicando
                      no mapa e defina dicas de condução.
                    </p>
                    <div className="mt-6 flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-primary">
                      Acessar painel →
                    </div>
                  </div>
                </Link>

                <Link
                  to="/motorista"
                  className="group relative overflow-hidden rounded-2xl border border-border bg-surface p-6 transition-all hover:border-accent/50 hover:shadow-[var(--shadow-elevated)]"
                >
                  <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-accent/10 blur-2xl transition-all group-hover:bg-accent/20" />
                  <div className="relative">
                    <div className="mb-4 grid h-12 w-12 place-items-center rounded-xl bg-accent/15 text-accent">
                      <Navigation className="h-6 w-6" strokeWidth={1.75} />
                    </div>
                    <h3 className="text-xl font-semibold">Modo Motorista</h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Execute o percurso com voz ativa, telemetria em tempo
                      real e alertas de velocidade.
                    </p>
                    <div className="mt-6 flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-accent">
                      Iniciar condução →
                    </div>
                  </div>
                </Link>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.6 }}
                className="mt-16 grid grid-cols-3 gap-8 text-center"
              >
                {[
                  { Icon: MapPin, label: "Mapa interativo" },
                  { Icon: Volume2, label: "Voz em pt-BR" },
                  { Icon: Bus, label: "Telemetria" },
                ].map(({ Icon, label }) => (
                  <div key={label} className="flex flex-col items-center gap-2">
                    <Icon className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
                    <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                      {label}
                    </span>
                  </div>
                ))}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
