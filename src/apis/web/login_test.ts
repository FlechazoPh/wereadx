import { getCredentialCookies } from "./login.ts";

Deno.test("credential cookies preserve absent refresh tokens", () => {
  const headers = new Headers();
  headers.append("set-cookie", "wr_skey=new-skey==; Path=/; HttpOnly");
  const result = getCredentialCookies(headers);

  if (result.accessToken !== "new-skey==" || "refreshToken" in result) {
    throw new Error("unexpected credential cookie parsing result");
  }
});
