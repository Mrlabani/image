import axios from 'axios';
import FormData from 'form-data';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const body = req.body;

  const BOT_TOKEN = process.env.BOT_TOKEN;
  const IMGBB_API_KEY = process.env.IMGBB_API_KEY;
  const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

  const sendMessage = async (chatId, text, extra = {}) => {
    await axios.post(`${TELEGRAM_API}/sendMessage`, {
      chat_id: chatId,
      text,
      ...extra,
    });
  };

  if (body.message?.text === '/start') {
    const name = body.message.from.first_name || 'there';
    await sendMessage(body.message.chat.id, `👋 Hello *${name}*! \n\n📤 Send me a *photo* and I'll upload it to ImgBB for you!`, {
      parse_mode: 'Markdown',
    });
    return res.status(200).send('OK');
  }

  if (body.message?.photo) {
    const chatId = body.message.chat.id;
    const fileId = body.message.photo.pop().file_id;

    try {
      // Step 1: Get File URL
      const fileInfo = await axios.get(`${TELEGRAM_API}/getFile?file_id=${fileId}`);
      const filePath = fileInfo.data.result.file_path;
      const fileURL = `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`;

      // Step 2: Download and encode
      const image = await axios.get(fileURL, { responseType: 'arraybuffer' });
      const base64Image = Buffer.from(image.data).toString('base64');

      // Step 3: Upload to ImgBB
      const form = new FormData();
      form.append('key', IMGBB_API_KEY);
      form.append('image', base64Image);

      const imgbb = await axios.post('https://api.imgbb.com/1/upload', form, {
        headers: form.getHeaders(),
      });

      const imageUrl = imgbb.data.data.url;

      // Step 4: Send back link
      await sendMessage(chatId, `✅ *Upload successful!*\n\n🔗 [Click to view image](${imageUrl})`, {
        parse_mode: 'Markdown',
        disable_web_page_preview: false,
      });

    } catch (error) {
      console.error('Upload failed:', error.message);
      await sendMessage(chatId, '❌ Image upload failed. Try again later.');
    }

    return res.status(200).send('OK');
  }

  // Fallback
  if (body.message?.text) {
    await sendMessage(body.message.chat.id, '❗ Please send a *photo* to upload.', {
      parse_mode: 'Markdown',
    });
  }

  res.status(200).send('OK');
}
