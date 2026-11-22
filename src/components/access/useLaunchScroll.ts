import { useEffect, useRef, useState } from "react";
import Lenis from "lenis";

export function useLaunchScroll(enabled: boolean) {
  const [raised, setRaised] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [mobileAction, setMobileAction] = useState(false);
  const [nearTop, setNearTop] = useState(true);
  const header = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!enabled) return;
    const motion = window.matchMedia("(prefers-reduced-motion: no-preference)");
    let lenis: Lenis | undefined;
    function updateLenis() {
      lenis?.destroy();
      lenis =
        motion.matches && !document.hidden
          ? new Lenis({ autoRaf: true, duration: 1.1 })
          : undefined;
    }
    updateLenis();
    let previous = window.scrollY;
    let frame = 0;
    const hero = document.querySelector(".launch-hero");
    const close = document.querySelector(".launch-close");

    function update() {
      frame = 0;
      const y = window.scrollY;
      setRaised(y > 16);
      setNearTop(y < 80);
      setMobileAction(
        Boolean(
          hero &&
          close &&
          hero.getBoundingClientRect().bottom < hero.getBoundingClientRect().height * 0.4 &&
          close.getBoundingClientRect().top > window.innerHeight * 0.75,
        ),
      );
      if (!motion.matches || y < 90) setHidden(false);
      else if (Math.abs(y - previous) > 5) {
        setHidden(y > previous && !header.current?.contains(document.activeElement));
      } else return;
      previous = y;
    }
    const queue = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    window.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", queue);
    motion.addEventListener("change", updateLenis);
    motion.addEventListener("change", queue);
    document.addEventListener("visibilitychange", updateLenis);
    queue();
    return () => {
      window.removeEventListener("scroll", queue);
      window.removeEventListener("resize", queue);
      motion.removeEventListener("change", updateLenis);
      motion.removeEventListener("change", queue);
      document.removeEventListener("visibilitychange", updateLenis);
      cancelAnimationFrame(frame);
      lenis?.destroy();
    };
  }, [enabled]);

  return { header, raised, hidden, mobileAction, nearTop };
}
