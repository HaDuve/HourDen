import {
  parseQuickLog,
  type Client,
  type Project,
  type QuickLogResult,
} from "@hourden/domain";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useRunningTimer } from "../running-timer/RunningTimerContext.js";
import { buildQuickLogCandidates } from "./build-candidates.js";
import { QuickLogDialog } from "./QuickLogDialog.js";

async function fetchProjects(): Promise<Project[]> {
  const res = await fetch("/api/projects");
  if (!res.ok) throw new Error(`Failed to load projects (${res.status})`);
  const data = (await res.json()) as { projects: Project[] };
  return data.projects;
}

async function fetchClients(): Promise<Client[]> {
  const res = await fetch("/api/clients");
  if (!res.ok) throw new Error(`Failed to load clients (${res.status})`);
  const data = (await res.json()) as { clients: Client[] };
  return data.clients;
}

async function fetchCalendarTimezone(): Promise<string> {
  const res = await fetch("/api/auth/me", { credentials: "include" });
  if (!res.ok) throw new Error(`Failed to load session (${res.status})`);
  const data = (await res.json()) as { calendarTimezone: string };
  return data.calendarTimezone;
}

function navigatePath(
  destination: Extract<QuickLogResult, { kind: "navigate" }>["destination"],
): string {
  if (destination === "tracker") return "/tracker";
  return `/${destination}`;
}

export function QuickLogHost() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { running, refresh, replaceRunning, suppressRemoteStopNotice } =
    useRunningTimer();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [timeZone, setTimeZone] = useState("UTC");
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [catalogReady, setCatalogReady] = useState(false);

  const candidates = useMemo(
    () => buildQuickLogCandidates(projects, clients),
    [projects, clients],
  );

  const result = useMemo(() => {
    if (!catalogReady) {
      return { kind: "empty" as const, commitable: false };
    }
    return parseQuickLog(query, {
      projects: candidates,
      now,
      timeZone,
      selectedProjectId: selectedProjectId ?? undefined,
    });
  }, [query, candidates, now, timeZone, selectedProjectId, catalogReady]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setSelectedProjectId(null);
    setError(null);
    setCommitting(false);
  }, []);

  const openBar = useCallback(() => {
    setNow(new Date());
    setQuery("");
    setSelectedProjectId(null);
    setError(null);
    setCatalogReady(false);
    setOpen(true);
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "k") {
        return;
      }
      // Ignore when typing in a non-Quick-Log field with a modifier chord that
      // browsers already use — we still open Quick Log as the product shortcut.
      event.preventDefault();
      if (open) {
        close();
      } else {
        openBar();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, close, openBar]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void Promise.all([fetchProjects(), fetchClients(), fetchCalendarTimezone()])
      .then(([loadedProjects, loadedClients, calendarTimezone]) => {
        if (cancelled) return;
        setProjects(loadedProjects);
        setClients(loadedClients);
        setTimeZone(calendarTimezone);
        setCatalogReady(true);
      })
      .catch(() => {
        if (!cancelled) {
          setError(t("quickLog.loadFailed"));
          setCatalogReady(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, t]);

  const commitWithResult = useCallback(
    async (parsed: QuickLogResult) => {
      if (!parsed.commitable) {
        return;
      }

      setCommitting(true);
      setError(null);

      try {
        if (parsed.kind === "navigate") {
          navigate(navigatePath(parsed.destination));
          close();
          return;
        }

        if (parsed.kind === "stop") {
          if (!running) {
            setError(t("quickLog.noRunningTimer"));
            setCommitting(false);
            return;
          }
          suppressRemoteStopNotice();
          const res = await fetch(`/api/time-entries/${running.id}/stop`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          });
          if (!res.ok) {
            throw new Error(`Stop failed (${res.status})`);
          }
          replaceRunning(null);
          await refresh();
          close();
          return;
        }

        if (parsed.kind === "start") {
          suppressRemoteStopNotice();
          const res = await fetch("/api/time-entries/timer", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              description: parsed.description,
              projectId: parsed.projectId,
            }),
          });
          if (!res.ok) {
            throw new Error(`Start failed (${res.status})`);
          }
          await refresh();
          close();
          return;
        }

        if (parsed.kind === "manual") {
          const res = await fetch("/api/time-entries", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              description: parsed.description,
              startedAt: parsed.startedAt,
              endedAt: parsed.endedAt,
              projectId: parsed.projectId,
            }),
          });
          if (!res.ok) {
            const body = (await res.json().catch(() => null)) as {
              error?: string;
            } | null;
            throw new Error(body?.error ?? `Save failed (${res.status})`);
          }
          close();
          return;
        }
      } catch {
        setError(t("quickLog.commitFailed"));
        setCommitting(false);
      }
    },
    [
      close,
      navigate,
      refresh,
      replaceRunning,
      running,
      suppressRemoteStopNotice,
      t,
    ],
  );

  const handleCommit = useCallback(
    (overrideProjectId?: string) => {
      const projectId = overrideProjectId ?? selectedProjectId ?? undefined;
      const parsed = parseQuickLog(query, {
        projects: candidates,
        now,
        timeZone,
        selectedProjectId: projectId,
      });
      void commitWithResult(parsed);
    },
    [candidates, commitWithResult, now, query, selectedProjectId, timeZone],
  );

  if (!open) {
    return null;
  }

  return (
    <QuickLogDialog
      query={query}
      onQueryChange={setQuery}
      result={result}
      timeZone={timeZone}
      selectedProjectId={selectedProjectId}
      onSelectedProjectIdChange={setSelectedProjectId}
      onClose={close}
      onCommit={(projectId) => handleCommit(projectId)}
      committing={committing}
      error={error}
    />
  );
}
