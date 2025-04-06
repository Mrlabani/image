const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const FormData = require('form-data');

const bot = new TelegramBot(process.env.BOT_TOKEN);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const body = req.body;

  // /start command
  if (body.message?.text === '/start') {
    const name = body.message.from.first_name || 'there';
    await bot.sendMessage(body.message.chat.id, `👋 Hi ${name}!\n\n📸 Send me an image and I’ll host it for you on ImgBB and give you a shareable link!\n\n🚀 Super simple. Totally free.`);
    return res.status(200).send('OK');
  }

  // When user sends a photo
  if (body.message?.photo) {
    const chatId = body.message.chat.id;
    const fileId = body.message.photo[body.message.photo.length - 1].file_id;

    try {
      // Get image file
      const fileLink = await bot.getFileLink(fileId);
      const response = await axios.get(fileLink.href, { responseType: 'arraybuffer' });

      // Upload to ImgBB
      const form = new FormData();
      form.append('image', Buffer.from(response.data).toString('base64'));
      form.append('key', process.env.IMGBB_API_KEY);

      const upload = await axios.post('https://api.imgbb.com/1/upload', form, {
        headers: form.getHeaders(),
      });

      const imageUrl = upload.data.data.url;

      // Respond to user with emoji UI
      await bot.sendMessage(chatId, `✅ *Upload Successful!*\n\n🖼️ *Image URL:* [Click to View](${imageUrl})\n\n🔗 You can copy/share this link anywhere!`, {
        parse_mode: 'Markdown',
        disable_web_page_preview: false
      });

    } catch (err) {
      console.error(err);
      await bot.sendMessage(chatId, '❌ Oops! Something went wrong while uploading your image. Please try again.');
    }

    return res.status(200).send('OK');
  }

  // For anything else
  if (body.message?.text) {
    await bot.sendMessage(body.message.chat.id, '❓ Please send a *photo* to upload. Type /start to see instructions again.', {
      parse_mode: 'Markdown'
    });
  }

  res.status(200).send('OK');
}
