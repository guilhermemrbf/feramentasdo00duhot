import { useEffect, useRef, useState } from "react";

export function useVisibleMotion<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!ref.current || !("IntersectionObserver" in window)) return;
    const media = window.matchMedia("(prefers-reduced-motion: no-preference)");
    let inView = false;
    const sync = () => setRunning(inView && media.matches && !document.hidden);
    const observer = new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting;
        sync();
      },
      { threshold: 0.15 },
    );
    observer.observe(ref.current);
    media.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      observer.disconnect();
      media.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

  return { ref, running };
}
