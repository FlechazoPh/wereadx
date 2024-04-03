import {get} from "../utils/request.ts";
import runtime from "../runtime.ts";
export async function sendTelegramMessage(text: string): Promise<void> {
    try {
        const url = `https://api.telegram.org/bot${runtime.botToken}/sendMessage`;
        const params = {
            chat_id: runtime.chatId,
            text: text
        };
        // await get(url, { params });

        const resp = await get(url, {
            chat_id: runtime.chatId,
            text: text + "\n\n#微信自动阅读任务 \nfrom https://busy-condor-50.deno.dev"
            }, {})
        
        console.log(`TG Message sent successfully! \n test: ${text}`);
    } catch (error) {
        console.error('Error sending TG message:', error);
    }
}

// 使用示例
// const botToken = 'YOUR_BOT_TOKEN';
// const chatId = '-1234';
// const messageText = 'Hello World';

// sendTelegramMessage(botToken, chatId, messageText);
