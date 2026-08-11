import * as credentialUtil from "../../kv/credential.ts";
import {
  web_book_chapter_e,
  web_book_chapterInfos,
  web_book_info,
} from "../../apis/web/book.ts";
import { errorMessage, randomInteger, sleep } from "../../utils/index.ts";
import { incrementDownloadCount } from "../../kv/download.ts";
import { checkParams, sendEvent } from "./common.ts";
import type { Credential } from "../../kv/credential.ts";
import { ErrCode } from "../../apis/err-code.ts";

import { jsonResponse } from "../../utils/index.ts";
import { ResponseCode } from "./common.ts";
import type { BookInfo, ChapterInfo } from "../../apis/web/utils.ts";

const pausedDownloads = new Set<string>();
const [resetStyle, footerNoteStyle, footerNoteScript] = await Promise.all([
  Deno.readTextFile(new URL("../assets/styles/reset.css", import.meta.url)),
  Deno.readTextFile(
    new URL("../assets/styles/footer_note.css", import.meta.url),
  ),
  Deno.readTextFile(new URL("../assets/js/footer_note.js", import.meta.url)),
]);

// 在 detail.js 中添加延迟函数
function randomDelay(min: number, max: number): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise((resolve) => setTimeout(resolve, delay / 3.0));
}

// 增加非线性的阅读行为模拟
function createHumanReadingProfile() {
  // 基础阅读速度 (字符/分钟)
  const baseReadingSpeed = randomInteger(380, 620);

  // 注意力波动程度 (0.1-0.3)
  const attentionVariability = 0.1 + Math.random() * 0.2;

  // 用户类型: 0-快速扫读, 1-平均阅读者, 2-仔细阅读者
  const readerType = Math.floor(Math.random() * 3);

  // 是否容易分心 (20-40% 概率暂停思考)
  const distractionProbability = 0.2 + Math.random() * 0.2;

  // 眼动模式: 每次停顿阅读的字符数
  const saccadeLength = randomInteger(20, 40);

  return {
    baseReadingSpeed,
    attentionVariability,
    readerType,
    distractionProbability,
    saccadeLength,
  };
}

/**
 * 安全章节下载函数
 */
async function safeDownloadChapter(
  bookInfo: BookInfo,
  chapter: ChapterInfo,
  cookie: string,
): Promise<[string, string, string]> {
  const maxRetries = 3;
  let attempts = 0;
  let lastError;

  // 为了减轻请求压力，先做一个长时间休息
  await randomDelay(3000, 8000);

  while (attempts < maxRetries) {
    try {
      // 使用我们的封装函数而不是直接调用API
      const [title, html, style] = await web_book_chapter_e(
        bookInfo,
        chapter,
        cookie,
      );

      return [title, html, style];
    } catch (error) {
      attempts++;
      lastError = error;
      console.warn(
        `下载章节 "${chapter.title}" 失败 (${attempts}/${maxRetries}): ${
          errorMessage(error)
        }`,
      );

      // 错误后采用更长的指数退避延迟
      await randomDelay(
        10000 * Math.pow(2, attempts - 1),
        15000 * Math.pow(2, attempts - 1),
      );

      // 如果是频率过高错误，等待更长时间
      if (errorMessage(error).includes("频率") || isHighFrequencyError(error)) {
        console.log("检测到频率限制，等待更长时间...");
        await randomDelay(30000, 60000);
      }
    }
  }

  throw lastError ||
    new Error(`下载章节 "${chapter.title}" 失败，超过最大重试次数`);
}

function isHighFrequencyError(error: unknown): boolean {
  return typeof error === "object" && error !== null &&
    "errCode" in error && error.errCode === ErrCode.HighFrequency;
}

interface ChapterInfoResponse {
  data: Array<{ updated: ChapterInfo[] }>;
}

/**
 * 下载
 */
export function downloadSSE(
  bookId: string,
  credential: Credential,
  startChapter?: number,
  endChapter?: number,
): Response {
  let isClosed = false;

  const body = new ReadableStream({
    start: async (controller) => {
      try {
        const cookie = credentialUtil.getCookieByCredential(credential);

        let bookInfo: BookInfo;
        let chapterInfos: ChapterInfoResponse;

        try {
          // 首先获取书籍信息
          bookInfo = await web_book_info(bookId, cookie);

          // 为下一个请求添加随机延迟，模拟真实用户浏览网页的时间
          await randomDelay(1000, 3000);

          // 然后获取章节信息
          chapterInfos = await web_book_chapterInfos([bookId], cookie);
        } catch (error) {
          console.error("获取书籍信息失败:", error);
          sendEvent(
            isClosed,
            controller,
            "error",
            `获取书籍信息失败: ${errorMessage(error)}`,
          );
          return;
        }

        // todo: 检查是否获取章节失败
        let chapters = chapterInfos.data[0].updated;

        // 根据章节范围过滤章节
        if (startChapter !== undefined || endChapter !== undefined) {
          chapters = chapters.filter((_, index) => {
            const chapterNum = index + 1; // 章节编号从1开始
            return chapterNum >= (startChapter || 1) &&
              chapterNum <= (endChapter || chapters.length);
          });
          console.log(
            `下载章节范围: ${startChapter || 1} - ${
              endChapter || chapterInfos.data[0].updated.length
            }, 共 ${chapters.length} 章`,
          );
        }

        // 开始下载前，先发送公共样式及脚本
        const preface = {
          styles: [resetStyle, footerNoteStyle],
          scripts: [footerNoteScript],
        };
        sendEvent(isClosed, controller, "preface", preface);

        // 创建人类阅读特征
        const readingProfile = createHumanReadingProfile();
        let accumulatedFatigue = 0; // 累积疲劳度，会随着章节增加

        // 添加阅读时间跟踪，模拟真实用户的阅读会话时长
        const sessionStartTime = Date.now();
        let sessionDuration = 0;

        // 阅读会话设置上限，真实用户不太可能连续阅读太长时间
        const maxSessionDuration = randomInteger(90, 180) * 60 * 1000; // 90-180分钟

        // 跟踪连续阅读的章节数，真实用户可能会间歇性地休息
        let continuousChapters = 0;
        const maxContinuousChapters = randomInteger(3, 8); // 连续阅读3-8章后可能休息

        for (let i = 0; i < chapters.length; i++) {
          const chapter = chapters[i];
          console.log(
            `开始下载章节: ${chapter.chapterUid}, 标题: ${chapter.title}`,
          );

          // 检查是否已关闭流
          if (isClosed) {
            return;
          }

          // 检查是否暂停
          while (pausedDownloads.has(credential.token) && !isClosed) {
            console.log("暂停下载中");
            await sleep(100);
          }

          // 检查阅读会话时长，如果超过上限则模拟结束整个下载
          sessionDuration = Date.now() - sessionStartTime;
          if (sessionDuration > maxSessionDuration) {
            console.log(
              `阅读会话已超过${
                Math.floor(maxSessionDuration / 60000)
              }分钟，暂停下载`,
            );
            await randomDelay(120000, 180000); // 休息2-3分钟
            continuousChapters = 0; // 重置连续章节计数器
          }

          // 检查连续章节数，决定是否需要休息
          if (continuousChapters >= maxContinuousChapters) {
            console.log(`已连续阅读${continuousChapters}章，休息一下`);
            await randomDelay(30000, 120000); // 休息30秒到2分钟
            continuousChapters = 0; // 重置章节计数器
          }

          // 单章下载——使用安全的下载方法
          let title, html, style;
          try {
            [title, html, style] = await safeDownloadChapter(
              bookInfo,
              chapter,
              cookie,
            );
          } catch (error) {
            console.error(`下载章节 "${chapter.title}" 失败:`, error);

            // 如果连续失败，可能被反爬系统盯上，等待更长时间
            await randomDelay(60000, 120000);

            // 尝试继续下一章
            continue;
          }

          const data = {
            total: chapters.length,
            current: chapter.chapterIdx,
            chapterUid: chapter.chapterUid,
            title: title,
            html: html,
            style: style,
          };

          // 模拟人类阅读过程
          // 1. 计算内容长度和复杂度
          const contentLength = html.length;
          const complexity = Math.min(
            1.3,
            0.8 + (countComplexPatterns(html) / 500),
          );

          // 2. 基于阅读特征和内容复杂度计算阅读时间
          let effectiveReadingSpeed = readingProfile.baseReadingSpeed;

          // 根据读者类型调整阅读速度
          if (readingProfile.readerType === 0) {
            // 快速扫读
            effectiveReadingSpeed *= 1.4;
          } else if (readingProfile.readerType === 2) {
            // 仔细阅读
            effectiveReadingSpeed *= 0.7;
          }

          // 根据内容复杂度调整阅读速度
          effectiveReadingSpeed /= complexity;

          // 根据累积疲劳调整阅读速度
          effectiveReadingSpeed *= 1 - (accumulatedFatigue * 0.02);

          // 计算基础阅读时间 (毫秒)
          const baseReadingTime = Math.max(
            8000, // 最少8秒
            Math.min(
              120000, // 最多2分钟
              (contentLength / effectiveReadingSpeed) * 60000,
            ),
          );

          // 模拟当前时间点的阅读速度波动 - 更自然的阅读模式
          const timeOfDay = new Date().getHours();
          let timeBasedSpeedFactor = 1.0;

          // 早上精神好，傍晚疲劳
          if (timeOfDay >= 8 && timeOfDay <= 11) {
            timeBasedSpeedFactor = 1.1; // 早上读得快一点
          } else if (timeOfDay >= 13 && timeOfDay <= 15) {
            timeBasedSpeedFactor = 0.9; // 午后犯困
          } else if (timeOfDay >= 22 || timeOfDay <= 5) {
            timeBasedSpeedFactor = 0.85; // 深夜/凌晨读得慢
          }

          // 3. 模拟阅读过程中的变速和停顿
          const contentChunks = Math.ceil(
            contentLength / readingProfile.saccadeLength,
          );

          // 章节开头和结尾的特殊处理
          // 一般人阅读会在章节开头花更多时间调整思路
          await randomDelay(1500, 3000);

          // 分段阅读，更真实地模拟人类阅读行为
          for (let chunk = 0; chunk < contentChunks; chunk++) {
            // 每个小段使用基于基础速度的小变化
            const chunkSpeedVariation = 1 +
              (Math.random() * 2 - 1) * readingProfile.attentionVariability;
            const chunkReadingTime = (baseReadingTime / contentChunks) *
              chunkSpeedVariation * timeBasedSpeedFactor;

            // 模拟短暂停顿 (眼动)
            await randomDelay(chunkReadingTime * 0.9, chunkReadingTime * 1.1);

            // 偶尔模拟回读行为 (10% 概率)
            if (Math.random() < 0.1) {
              await randomDelay(300, 800);
            }

            // 模拟用户偶尔分心，有一定概率触发长停顿
            if (
              Math.random() <
                readingProfile.distractionProbability / contentChunks
            ) {
              // 分心暂停时间随机
              await randomDelay(3000, 15000);
            }

            // 检查是否被取消或暂停
            if (isClosed) {
              return;
            }
            while (pausedDownloads.has(credential.token) && !isClosed) {
              await sleep(100);
            }
          }

          // 4. 章节读完后的思考/消化时间
          const chapterImportance = 0.5 + (complexity * 0.5); // 重要/复杂章节需要更多思考

          if (Math.random() < 0.35 * chapterImportance) {
            // 模拟深度思考
            await randomDelay(10000, 30000);
          }

          // 5. 每读完几个章节，模拟用户休息
          accumulatedFatigue += 0.05 + (complexity * 0.05);
          if (accumulatedFatigue > 0.4 && Math.random() < 0.4) {
            // 模拟长休息
            await randomDelay(40000, 120000);
            accumulatedFatigue *= 0.5; // 休息后疲劳减半
          }

          // 6. 章节结束额外增加行为变化
          // 如果是章节结尾，可能花更多时间思考和消化
          if (Math.random() < 0.3) {
            // 模拟用户在章节结束处翻回去检查一些内容
            await randomDelay(5000, 15000);
          }

          // 特殊章节（如序章、尾声等）可能会多停留一会
          if (
            chapter.title.includes("序") ||
            chapter.title.includes("前言") ||
            chapter.title.includes("后记") ||
            chapter.title.includes("结语")
          ) {
            await randomDelay(5000, 20000);
          }

          sendEvent(isClosed, controller, "progress", data);
          console.log("web_book_chapter_e");

          // 更新累计变量
          continuousChapters++;
        }

        sendEvent(isClosed, controller, "complete", null);
        await incrementDownloadCount(credential, bookId);
      } catch (e) {
        console.error(e);
        sendEvent(isClosed, controller, "error", errorMessage(e));
      } finally {
        sendEvent(isClosed, controller, "close");
        isClosed = true;
        pausedDownloads.delete(credential.token);
      }
    },
    cancel(reason) {
      console.debug("downloadSSE: ", reason);
      isClosed = true;
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

// 辅助函数：分析内容复杂度
function countComplexPatterns(html: string): number {
  // 简单的复杂度评估，计算特殊符号、长单词等数量
  const complexPatterns = [
    /<table/g, // 表格
    /<code/g, // 代码块
    /[，。！？；：""''（）【】『』「」]/g, // 中文标点
    /\d{4,}/g, // 长数字
    /<img/g, // 图片
    /<h[1-6]/g, // 标题
  ];

  return complexPatterns.reduce((count, pattern) => {
    const matches = html.match(pattern);
    return count + (matches ? matches.length : 0);
  }, 0);
}

// 新增控制暂停和恢复的函数
export async function pauseDownload(req: Request) {
  const token = await getDownloadToken(req);
  if (token instanceof Response) return token;
  pausedDownloads.add(token);
  return jsonResponse({ code: ResponseCode.Success, data: "", msg: "成功" });
}

export async function resumeDownload(req: Request) {
  const token = await getDownloadToken(req);
  if (token instanceof Response) return token;
  pausedDownloads.delete(token);
  return jsonResponse({ code: ResponseCode.Success, data: "", msg: "成功" });
}

async function getDownloadToken(req: Request): Promise<string | Response> {
  const result = await checkParams(req, [{
    name: "token",
    from: "header",
    statusCode: ResponseCode.CredentialError,
    statusText: "token无效",
  }]);
  return result instanceof Response ? result : result.token;
}
