import type { Client, Project } from "@hourden/domain";

export type ProjectClientGroup = {
  clientId: string;
  clientName: string;
  projects: Project[];
};

export function groupProjectsByClient(
  projects: Project[],
  clients: Client[],
): ProjectClientGroup[] {
  const clientNameById = new Map(clients.map((client) => [client.id, client.name]));
  const projectsByClientId = new Map<string, Project[]>();

  for (const project of projects) {
    const existing = projectsByClientId.get(project.clientId) ?? [];
    existing.push(project);
    projectsByClientId.set(project.clientId, existing);
  }

  return [...projectsByClientId.entries()]
    .map(([clientId, clientProjects]) => ({
      clientId,
      clientName: clientNameById.get(clientId) ?? clientId,
      projects: [...clientProjects].sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => a.clientName.localeCompare(b.clientName));
}
