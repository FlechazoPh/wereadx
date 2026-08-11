import { isAllowedAssetUrl } from "./assets.ts";
import { parseChapterNumber } from "./shelf.ts";

function assertEquals(actual: unknown, expected: unknown): void {
  if (!Object.is(actual, expected)) {
    throw new Error(`${actual} !== ${expected}`);
  }
}

Deno.test("validates chapter ranges", () => {
  assertEquals(parseChapterNumber(null), undefined);
  assertEquals(parseChapterNumber("1"), 1);
  assertEquals(parseChapterNumber("0"), null);
  assertEquals(parseChapterNumber("nope"), null);
});

Deno.test("allows only known HTTPS asset hosts", () => {
  assertEquals(isAllowedAssetUrl("https://res.weread.qq.com/a.png"), true);
  assertEquals(isAllowedAssetUrl("http://res.weread.qq.com/a.png"), false);
  assertEquals(isAllowedAssetUrl("https://127.0.0.1/a.png"), false);
  assertEquals(isAllowedAssetUrl("not-a-url"), false);
});
