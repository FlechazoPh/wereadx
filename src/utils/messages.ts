import axios from 'axios';

async function sendTelegramMessage(botToken: string, chatId: string, text: string): Promise<void> {
    try {
        const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
        const params = {
            chat_id: chatId,
            text: text
        };
        await axios.get(url, { params });
        console.log('Message sent successfully');
    } catch (error) {
        console.error('Error sending message:', error);
    }
}

// 使用示例
// const botToken = 'YOUR_BOT_TOKEN';
// const chatId = '-636218921';
// const messageText = 'Hello World';

// sendTelegramMessage(botToken, chatId, messageText);
