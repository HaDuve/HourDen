import { StrictMode, useEffect, useState } from "react";
import { DEFAULT_WORKSPACE_ID } from "@hourden/domain";

type HealthResponse = {
  status: string;
};

export default function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/health")
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Health check failed (${res.status})`);
        }
        return res.json() as Promise<HealthResponse>;
      })
      .then(setHealth)
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-4 p-8">
      <h1 className="text-3xl font-semibold tracking-tight">HourDen</h1>
      <p className="text-neutral-600">
        Your den for billable hours — skeleton is live.
      </p>
      <dl className="rounded-lg border border-neutral-200 bg-white p-4 text-sm">
        <div className="flex justify-between gap-4 py-1">
          <dt className="text-neutral-500">Workspace</dt>
          <dd className="font-mono text-xs">{DEFAULT_WORKSPACE_ID}</dd>
        </div>
        <div className="flex justify-between gap-4 py-1">
          <dt className="text-neutral-500">API</dt>
          <dd>
            {error && <span className="text-red-600">{error}</span>}
            {health && (
              <span className="text-green-700">API status: {health.status}</span>
            )}
            {!error && !health && (
              <span className="text-neutral-400">Checking…</span>
            )}
          </dd>
        </div>
      </dl>
    </main>
  );
}
