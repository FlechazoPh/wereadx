import { readEncryptedResponse } from "./book.ts";

Deno.test("encrypted chapter responses surface JSON API errors", async () => {
  const error = { errCode: -2012, errMsg: "session timeout" };
  try {
    await readEncryptedResponse(Response.json(error), "test-user");
    throw new Error("expected response error");
  } catch (thrown) {
    if (
      !(thrown instanceof Error) ||
      thrown.message !== error.errMsg ||
      !("errCode" in thrown) ||
      thrown.errCode !== error.errCode
    ) {
      throw thrown;
    }
  }
});
