import { useEffect } from "react";

export default function useOutsideClick(ref, onOutsideClick, enabled = true) {
  useEffect(() => {
    if (!enabled) return undefined;

    const handlePointerDown = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        onOutsideClick();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [enabled, onOutsideClick, ref]);
}
