import { useEffect, useState } from "react";
import {
  ATTEMPTS_PER_ROUND,
  attemptsRemaining,
  formatCountdown,
  getUnlockLockout,
  isLocked,
  remainingLockMs,
  type UnlockLockoutState,
} from "./unlockLockout";

/** Live lockout snapshot for a vault/file id; ticks every second while locked. */
export function useUnlockLockout(scope: string, id: string | null) {
  const [state, setState] = useState<UnlockLockoutState>(() =>
    id ? getUnlockLockout(scope, id) : {
      failsInRound: 0,
      nextLockoutTier: 0,
      lockedUntil: null,
    },
  );
  const [now, setNow] = useState(Date.now());

  const refresh = () => {
    if (!id) return;
    setState(getUnlockLockout(scope, id));
    setNow(Date.now());
  };

  useEffect(() => {
    refresh();
  }, [scope, id]);

  const locked = id ? isLocked(state, now) : false;
  const lockMs = locked ? remainingLockMs(state, now) : 0;

  useEffect(() => {
    if (!id || !locked) return;
    const t = window.setInterval(() => {
      setNow(Date.now());
      setState(getUnlockLockout(scope, id));
    }, 250);
    return () => window.clearInterval(t);
  }, [scope, id, locked, state.lockedUntil]);

  return {
    state,
    refresh,
    locked,
    lockMs,
    countdown: formatCountdown(lockMs),
    attemptsLeft: id ? attemptsRemaining(state) : ATTEMPTS_PER_ROUND,
    maxAttempts: ATTEMPTS_PER_ROUND,
    nextLockoutLabel:
      state.nextLockoutTier === 0
        ? "1 minute"
        : state.nextLockoutTier === 1
          ? "5 minutes"
          : "10 minutes",
  };
}
