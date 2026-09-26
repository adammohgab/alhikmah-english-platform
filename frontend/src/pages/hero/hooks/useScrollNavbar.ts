import { useEffect, useState } from "react";

interface ScrollNavbarState {
  /** True while scrolling down past the threshold — navbar slides away. */
  hidden: boolean;
  /** True once the user left the very top — navbar gets a solid background. */
  solid: boolean;
  /** Raw scroll Y, used to fade the scroll invitation. */
  scrollY: number;
}

/**
 * Transparent over the hero, hides on scroll-down, slides back on scroll-up.
 * Short smooth transition — never abrupt.
 */
export function useScrollNavbar(): ScrollNavbarState {
  const [hidden, setHidden] = useState(false);
  const [solid, setSolid] = useState(false);
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    let lastY = window.scrollY;
    let ticking = false;

    const update = () => {
      ticking = false;
      const y = window.scrollY;
      setScrollY(y);
      setSolid(y > 24);
      const goingDown = y > lastY + 4;
      const goingUp = y < lastY - 4;
      if (y < 120) {
        setHidden(false);
      } else if (goingDown) {
        setHidden(true);
      } else if (goingUp) {
        setHidden(false);
      }
      lastY = y;
    };

    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(update);
      }
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return { hidden, solid, scrollY };
}
