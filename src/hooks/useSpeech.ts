import { useCallback, useEffect, useRef } from "react";

export function useSpeech() {
  const synthRef = useRef<SpeechSynthesis | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      synthRef.current = window.speechSynthesis;
    }
  }, []);

  const speak = useCallback((text: string, opts?: { priority?: boolean }) => {
    const synth = synthRef.current;
    if (!synth || !text) return;
    if (opts?.priority) synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "pt-BR";
    u.rate = 1;
    u.pitch = 1;
    u.volume = 1;
    synth.speak(u);
  }, []);

  const stop = useCallback(() => {
    synthRef.current?.cancel();
  }, []);

  return { speak, stop };
}
