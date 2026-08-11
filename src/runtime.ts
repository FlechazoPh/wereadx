import { dotenv } from "./deps.ts";
import { runInDenoDeploy } from "./utils/index.ts";

let env = await dotenv.load({ examplePath: null });

if (Object.keys(env).length === 0) {
  env = {};
}

let deployDomain: string;
if (runInDenoDeploy()) {
  deployDomain = Deno.env.get("DEPLOY_DOMAIN")! || "";
} else {
  deployDomain = env["DEPLOY_DOMAIN"] || "";
}
deployDomain = deployDomain.replace(/\/$/g, "");

let resendDomain: string;
if (runInDenoDeploy()) {
  resendDomain = Deno.env.get("RESEND_DOMAIN")! || "";
} else {
  resendDomain = env["RESEND_DOMAIN"] || "";
}
resendDomain = resendDomain.replace(/\/$/g, "").replace(/^https?:\/\//i, "");

let kv: Deno.Kv;
if (
  !runInDenoDeploy() && env["DENO_KV_UUID"] && env["DENO_KV_ACCESS_TOKEN"] &&
  !Deno.args.includes("local")
) {
  Deno.env.set("DENO_KV_ACCESS_TOKEN", env["DENO_KV_ACCESS_TOKEN"]);
  kv = await Deno.openKv(
    `https://api.deno.com/databases/${env["DENO_KV_UUID"]}/connect`,
  );
} else {
  kv = await Deno.openKv();
}

let databaseUrl: string;
if (runInDenoDeploy()) {
  databaseUrl = Deno.env.get("DATABASE_URL")! || env["DATABASE_URL"] || "";
} else {
  databaseUrl = env["DATABASE_URL"] || "";
}

let cronKey: string;
if (runInDenoDeploy()) {
  cronKey = Deno.env.get("CRON_KEY")! || "";
} else {
  cronKey = env["CRON_KEY"] || "";
}

export default {
  deployDomain,
  resendDomain,
  kv,
  databaseUrl,
  cronKey,
};
