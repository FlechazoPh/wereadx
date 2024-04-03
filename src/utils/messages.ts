import {get} from "../../utils/request.ts";
import runtime from "../runtime.ts";
export async function sendTelegramMessage(text: string): Promise<void> {
    try {
        const url = `https://api.telegram.org/bot${runtime.botToken}/sendMessage`;
        const params = {
            chat_id: runtime.chatId,
            text: text
        };
        await get(url, { params });
        console.log('TG Message sent successfully');
    } catch (error) {
        console.error('Error sending TG message:', error);
    }
}

// 使用示例
// const botToken = 'YOUR_BOT_TOKEN';
// const chatId = '-1234';
// const messageText = 'Hello World';

// sendTelegramMessage(botToken, chatId, messageText);
