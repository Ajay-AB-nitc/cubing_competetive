"use client";

import { useState, useEffect } from "react";
import { formatTime } from "@/lib/timeUtils";

interface TimerProps {
  isRunning: boolean;
  startTime: number;
  elapsedWhenStopped: number;
}

export function Timer({ isRunning, startTime, elapsedWhenStopped }: TimerProps) {
  const [timeElapsed, setTimeElapsed] = useState(0);

  useEffect(() => {
    if (!isRunning) {
      setTimeElapsed(elapsedWhenStopped);
      return;
    }

    const intervalId = setInterval(() => {
      setTimeElapsed(Date.now() - startTime);
    }, 10);

    return () => clearInterval(intervalId);
  }, [isRunning, startTime, elapsedWhenStopped]);

  return (
    <div className="text-7xl md:text-8xl font-black tabular-nums tracking-tight drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
      {formatTime(timeElapsed)}
    </div>
  );
}
