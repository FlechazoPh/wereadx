import { postgres } from "../deps.ts";
import runtime from "../runtime.ts";

const sql = postgres.default(
  runtime.databaseUrl || "postgresql://disabled:disabled@127.0.0.1:1/disabled",
  { onnotice: () => {} },
);

export default sql;
