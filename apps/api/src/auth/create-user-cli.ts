import "../load-env.js";
import { Pool } from "pg";
import { createUserWithWorkspace } from "../db/workspaces.js";

function usage(): never {
  console.error(`Usage: create-user --email <email> --password <password> --workspace <name> [options]

Options:
  --sender-name <name>       Invoice Sender name override
  --sender-email <email>     Invoice Sender email override
  --calendar-timezone <tz>   IANA calendar timezone (default: Europe/Berlin)
  --help                     Show this help`);
  process.exit(1);
}

function parseArgs(argv: string[]): {
  email?: string;
  password?: string;
  workspaceName?: string;
  senderName?: string;
  senderEmail?: string;
  calendarTimezone?: string;
} {
  const result: ReturnType<typeof parseArgs> = {};

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    const next = argv[i + 1];

    switch (arg) {
      case "--help":
      case "-h":
        usage();
        break;
      case "--email":
        result.email = next;
        i += 1;
        break;
      case "--password":
        result.password = next;
        i += 1;
        break;
      case "--workspace":
        result.workspaceName = next;
        i += 1;
        break;
      case "--sender-name":
        result.senderName = next;
        i += 1;
        break;
      case "--sender-email":
        result.senderEmail = next;
        i += 1;
        break;
      case "--calendar-timezone":
        result.calendarTimezone = next;
        i += 1;
        break;
      default:
        console.error(`Unknown argument: ${arg}`);
        usage();
    }
  }

  return result;
}

const args = parseArgs(process.argv.slice(2));

if (!args.email || !args.password || !args.workspaceName) {
  usage();
}

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://hourden:hourden@localhost:5433/hourden";

const pool = new Pool({ connectionString: databaseUrl });

try {
  const created = await createUserWithWorkspace(pool, {
    email: args.email,
    password: args.password,
    workspaceName: args.workspaceName,
    calendarTimezone: args.calendarTimezone,
    sender: {
      ...(args.senderName ? { name: args.senderName } : {}),
      ...(args.senderEmail ? { email: args.senderEmail } : {}),
    },
  });

  console.log(
    JSON.stringify(
      {
        userId: created.userId,
        workspaceId: created.workspaceId,
        email: args.email,
        workspaceName: args.workspaceName,
      },
      null,
      2,
    ),
  );
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
} finally {
  await pool.end();
}
