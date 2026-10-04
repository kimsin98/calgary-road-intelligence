import { useEffect, useState, startTransition } from "react";
import type { AnalysisConfig } from "../domain/types";
export function usePlayback(config: AnalysisConfig) {
  const [playing, setPlaying] = useState(false),
    [loop, setLoop] = useState(true),
    [playDate, setPlayDate] = useState<string | null>(null),
    [speed, setSpeed] = useState(250);
  useEffect(() => {
    setPlaying(false);
    setPlayDate(null);
  }, [config.start, config.end]);
  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    let remainder = 0;
    const cadence = Math.max(1000, speed);
    const timer = window.setInterval(() => {
      const now = performance.now();
      remainder += now - last;
      last = now;
      const steps = Math.floor(remainder / speed);
      if (!steps) return;
      remainder -= steps * speed;
      startTransition(() =>
        setPlayDate((current) => {
          const value = current ?? config.start;
          const start = Date.parse(config.start + "T00:00:00Z"),
            end = Date.parse(config.end + "T00:00:00Z");
          const next = Date.parse(value + "T00:00:00Z") + steps * 86400000;
          if (next > end) {
            if (loop) {
              const days = Math.round((end - start) / 86400000) + 1;
              return new Date(
                start +
                  (Math.round((next - start) / 86400000) % days) * 86400000,
              )
                .toISOString()
                .slice(0, 10);
            }
            setPlaying(false);
            return config.end;
          }
          return new Date(next).toISOString().slice(0, 10);
        }),
      );
    }, cadence);
    return () => clearInterval(timer);
  }, [playing, loop, speed, config.start, config.end]);
  function togglePlayback() {
    if (!playing && (!playDate || playDate >= config.end))
      setPlayDate(config.start);
    setPlaying((v) => !v);
  }
  const timelineDays = Math.max(
    0,
    Math.round((Date.parse(config.end) - Date.parse(config.start)) / 86400000),
  );
  const timelinePosition = playDate
    ? Math.max(
        0,
        Math.round(
          (Date.parse(playDate) - Date.parse(config.start)) / 86400000,
        ),
      )
    : timelineDays;

  return {
    playing,
    setPlaying,
    loop,
    setLoop,
    playDate,
    setPlayDate,
    speed,
    setSpeed,
    togglePlayback,
    timelineDays,
    timelinePosition,
  };
}
