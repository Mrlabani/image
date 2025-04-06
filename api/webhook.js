import axios from 'axios';
import FormData from 'form-data';

const TELEGRAM_API = `https://api.telegram.org/bot${process.env.BOT_TOKEN}`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const body = req.body;

  const sendMessage = async (chat_id, text, extra = {}) => {
    await axios.post(`${TELEGRAM_API}/sendMessage`, {
      chat_id,
      text,
      ...extra,
    });
  };

  // Handle /start command
  if (body.message?.text === '/start') {
    const name = body.message.from.first_name || 'friend';
    await sendMessage(body.message.chat.id, `👋 Hi ${name}!\n\n📤 Send me an *image* and I’ll upload it to ImgBB and give you a link!\n\n✅ Super simple & free!`, { parse_mode: 'Markdown' });
    return res.status(200).send('OK');
  }

  // Handle photo uploads
  if (body.message?.photo) {
    const chatId = body.message.chat.id;
    const fileId = body.message.photo.slice(-1)[0].file_id;

    try {
      const fileResp = await axios.get(`${TELEGRAM_API}/getFile?file_id=${fileId}`);
      const filePath = fileResp.data.result.file_path;
      const fileURL = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${filePath}`;

      const imageResp = await axios.get(fileURL, { responseType: 'arraybuffer' });
      const base64Image = Buffer.from(imageResp.data).toString('base64');

      const form = new FormData();
      form.append('key', process.env.IMGBB_API_KEY);
      form.append('image', base64Image);

      const uploadResp = await axios.post('https://api.imgbb.com/1/upload', form, {
        headers: form.getHeaders(),
      });

      const imageUrl = uploadResp.data.data.url;
      await sendMessage(chatId, `✅ *Image uploaded!*\n\n🔗 [Click here to view it](${imageUrl})`, {
        parse_mode: 'Markdown',
        disable_web_page_preview: false,
      });

    } catch (err) {
      console.error('Upload error:', err.response?.data || err.message);
      await sendMessage(chatId, '❌ Failed to upload image. Please try again.');
    }

    return res.status(200).send('OK');
  }

  // Handle all other messages
  if (body.message?.text) {
    await sendMessage(body.message.chat.id, '❓ Please send a *photo* to upload to ImgBB.', {
      parse_mode: 'Markdown',
    });
  }

  res.status(200).send('OK');
}
