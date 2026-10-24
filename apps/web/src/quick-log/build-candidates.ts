import type { Client, Project, QuickLogProjectCandidate } from "@hourden/domain";

export function buildQuickLogCandidates(
  projects: Project[],
  clients: Client[],
): QuickLogProjectCandidate[] {
  const clientById = new Map(clients.map((client) => [client.id, client]));
  return projects.map((project) => {
    const client = clientById.get(project.clientId);
    return {
      id: project.id,
      name: project.name,
      clientId: project.clientId,
      clientName: client?.name ?? "",
      defaultRate: client?.defaultRate ?? 0,
    };
  });
}
