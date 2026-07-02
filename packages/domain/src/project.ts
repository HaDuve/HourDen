export type Project = {
  id: string;
  clientId: string;
  name: string;
  color: string | null;
};

export type CreateProjectInput = {
  clientId: string;
  name: string;
  color?: string | null;
};

export type UpdateProjectInput = {
  name?: string;
  color?: string | null;
};
