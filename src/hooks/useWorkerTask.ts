import { useCallback, useEffect, useRef, useState } from "react";
export function useWorkerTask<Input, Output>(createWorker: () => Worker) {
  const active = useRef<Worker | null>(null),
    sequence = useRef(0);
  const [result, setResult] = useState<Output | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(
    () => () => {
      sequence.current++;
      active.current?.terminate();
    },
    [],
  );
  const run = useCallback(
    (input: Input) => {
      const request = ++sequence.current;
      active.current?.terminate();
      setResult(null);
      setBusy(true);
      setError("");
      const worker = createWorker();
      active.current = worker;
      const finish = () => {
        worker.terminate();
        if (active.current === worker) active.current = null;
      };
      worker.onmessage = ({ data }) => {
        if (sequence.current === request) {
          setBusy(false);
          if (data.error) setError(data.error);
          else setResult(data.result);
        }
        finish();
      };
      worker.onerror = () => {
        if (sequence.current === request) {
          setBusy(false);
          setError("Calculation failed. Please retry.");
        }
        finish();
      };
      worker.postMessage(input);
    },
    [createWorker],
  );
  return { result, busy, error, run };
}
