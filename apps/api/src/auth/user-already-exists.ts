type DatabaseError = {
  code?: string;
  constraint?: string;
};

export class UserAlreadyExistsError extends Error {
  constructor() {
    super("User already exists");
    this.name = "UserAlreadyExistsError";
  }
}

export function isUserAlreadyExistsError(error: unknown): boolean {
  if (error instanceof UserAlreadyExistsError) {
    return true;
  }

  const dbError = error as DatabaseError;
  return (
    dbError?.code === "23505" && dbError.constraint === "users_email_key"
  );
}
