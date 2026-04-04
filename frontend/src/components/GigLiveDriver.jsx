import { useEffect } from "react";
import { useGigStore } from "../store/useGigStore.js";

/**
 * Drives global rainfall + derived metrics on an interval (single source of truth).
 */
export default function GigLiveDriver({ intervalMs = 3000 }) {
  const setRainfall = useGigStore((s) => s.setRainfall);
  const updateFromRainfall = useGigStore((s) => s.updateFromRainfall);

  useEffect(() => {
    const tick = () => {
      const rain = Math.random() * 80;
      setRainfall(rain);
      updateFromRainfall(rain);
      if (import.meta.env.DEV) {
        console.log("Rainfall:", rain);
      }
    };
    tick();
    const id = setInterval(tick, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, setRainfall, updateFromRainfall]);

  return null;
}
