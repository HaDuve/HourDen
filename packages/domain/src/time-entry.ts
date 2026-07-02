export type TimeEntry = {
  id: string;
  projectId: string | null;
  startedAt: string;
  endedAt: string | null;
  description: string | null;
  tags: string[];
  billable: boolean;
  amount: number | null;
  billableComplete: boolean;
  isRunning: boolean;
  durationMinutes: number;
  invoiced: boolean;
};

export type StartTimerInput = {
  projectId?: string | null;
  description?: string | null;
};

export type StopTimerInput = {
  description?: string | null;
  endedAt?: string;
};

export type CreateManualEntryInput = {
  startedAt: string;
  endedAt: string;
  projectId?: string | null;
  description?: string | null;
  tags?: string[];
  billable?: boolean;
};

export type UpdateTimeEntryInput = {
  projectId?: string | null;
  startedAt?: string;
  endedAt?: string | null;
  description?: string | null;
  tags?: string[];
  billable?: boolean;
};
