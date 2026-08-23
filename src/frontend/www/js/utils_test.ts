import { convertChaptersToToc } from "./utils.js";

Deno.test("目录忽略与章节同名的锚点", () => {
  const toc = convertChaptersToToc([{
    chapterUid: 1,
    title: "01 看清利益格局",
    level: 1,
    anchors: [
      { title: "01 看清利益格局", level: 1, anchor: "same" },
      { title: "补充内容", level: 2, anchor: "extra" },
    ],
  }]);

  if (toc.length !== 1 || toc[0].children?.[0].title !== "补充内容") {
    throw new Error("目录仍包含重复章节");
  }
});
