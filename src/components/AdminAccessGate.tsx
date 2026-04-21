// Hidden admin login modal triggered by Ctrl+Shift+G
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { KeyRound, X, ShieldAlert } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function AdminAccessGate() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const { signIn, signUp, session, isAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.key === "G" || e.key === "g")) {
        e.preventDefault();
        if (session && isAdmin) {
          navigate({ to: "/gestor" });
        } else {
          setOpen(true);
        }
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [session, isAdmin, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = mode === "signin"
        ? await signIn(email, password)
        : await signUp(email, password);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      if (mode === "signup") {
        toast.success("Conta criada. Solicite ao administrador acesso de gestor.");
        setMode("signin");
      } else {
        toast.success("Acesso liberado");
        setOpen(false);
        navigate({ to: "/gestor" });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] grid place-items-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setOpen(false)}
        >
          <motion.div
            initial={{ y: 20, scale: 0.96, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 20, scale: 0.96, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="glass relative w-full max-w-md rounded-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setOpen(false)}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="mb-5 flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/15 text-primary">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Acesso restrito</h2>
                <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                  Painel de gestão · Ctrl+Shift+G
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="admin-email">E-mail</Label>
                <Input
                  id="admin-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="gestor@exemplo.com"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-pass">Senha</Label>
                <Input
                  id="admin-pass"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>

              <Button type="submit" disabled={busy} className="w-full">
                {busy ? "Aguarde…" : mode === "signin" ? "Entrar" : "Criar conta"}
              </Button>

              <div className="flex items-start gap-2 rounded-lg border border-border bg-surface/50 p-3 text-xs text-muted-foreground">
                <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                <p>
                  Apenas usuários com perfil de administrador acessam o painel.
                  {mode === "signin" ? (
                    <>
                      {" "}Sem conta?{" "}
                      <button
                        type="button"
                        className="text-primary hover:underline"
                        onClick={() => setMode("signup")}
                      >
                        Criar agora
                      </button>
                    </>
                  ) : (
                    <>
                      {" "}Já possui?{" "}
                      <button
                        type="button"
                        className="text-primary hover:underline"
                        onClick={() => setMode("signin")}
                      >
                        Entrar
                      </button>
                    </>
                  )}
                </p>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
