import { useEffect, useState } from "react";

const REFRESH_INTERVAL_MS = 30_000;

export function useTripStateClock(): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, []);

  return now;
}
