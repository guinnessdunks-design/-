const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { NewMessage } = require("telegram/events");
const fs = require("fs");
const axios = require("axios");
// ...existing code...
const twApi = require("@opecgame/twapi");

const CONFIG = {
  apiId: 12345678,
  apiHash: "your_api_hash_here",
  phone: "0812345678",
  webhook: ""
};

const SESSION_FILE = "session.txt";

async function shootVoucher(voucherCode) {
  const startTime = Date.now();
  try {
    const result = await twApi(voucherCode, CONFIG.phone);
    const elapsed = Date.now() - startTime;
    switch (result.status.code) {
      case "SUCCESS": {
        const amount = result.data.my_ticket.amount_baht;
        console.log(`💰 [${elapsed}ms] รับซองสำเร็จ ${amount} บาท | ${voucherCode}`);
        if (CONFIG.webhook && CONFIG.webhook.trim()) {
          sendWebhook(`✅ รับซองสำเร็จ ${amount} บาท`, {
            voucher: voucherCode,
            amount: amount,
            phone: CONFIG.phone,
            time: `${elapsed}ms`
          });
        }
        break;
      }
      case "CANNOT_GET_OWN_VOUCHER":
        console.log(`⚠️ [${elapsed}ms] ไม่สามารถรับซองของตัวเองได้ | ${voucherCode}`);
      const http = require("http");
        break;
      case "TARGET_USER_NOT_FOUND":
        apiId: process.env.API_ID ? parseInt(process.env.API_ID) : 12345678,
        apiHash: process.env.API_HASH || "your_api_hash_here",
        phone: process.env.PHONE || "0812345678",
        webhook: process.env.WEBHOOK || ""
        break;
      case "VOUCHER_OUT_OF_STOCK":
        console.log(`⚠️ [${elapsed}ms] ซองหมดแล้วหรือรับไปแล้ว | ${voucherCode}`);
        break;
      case "VOUCHER_NOT_FOUND":
        console.log(`⚠️ [${elapsed}ms] ไม่พบซอง | ${voucherCode}`);
        break;
      case "VOUCHER_EXPIRED":
        console.log(`⚠️ [${elapsed}ms] ซองหมดอายุ | ${voucherCode}`);
        break;
      default:
        console.log(`⚠️ [${elapsed}ms] สถานะไม่รู้จัก: ${result.status.code} | ${voucherCode}`);
        break;
    }
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.log(`❌ [${elapsed}ms] เกิดข้อผิดพลาด: ${error.message} | ${voucherCode}`);
  }
}

function sendWebhook(title, data) {
  axios.post(CONFIG.webhook, {
    embeds: [{
      title: title,
      description: `\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``,
      color: title.includes("✅") ? 0x00ff00 : 0xff0000,
      timestamp: new Date().toISOString()
    }]
  }, { timeout: 2000 }).catch(() => {});
}

// ...existing code...

function isValidVoucherCode(str) {
  if (!str || str.length < 10 || str.length > 64) return false;
  if (!str.startsWith("019")) return false;
  if (!/^[a-zA-Z0-9]+$/.test(str)) return false;
  
  const hasNumbers = /\d/.test(str);
  const hasLetters = /[a-zA-Z]/.test(str);
  if (!hasNumbers || !hasLetters) return false;
  
  const lowerStr = str.toLowerCase();
  const blacklistedWords = ['telegram', 'truemoney', 'password', 'username', 'facebook', 'instagram', 'twitter', 'youtube'];
  for (const word of blacklistedWords) {
    if (lowerStr.includes(word)) return false;
  }
  return true;
}

const seenVouchers = new Set();

function extractVoucherCodes(text) {
  if (!text) return [];
  const foundVouchers = [];
  const urlPattern = /https?:\/\/gift\.truemoney\.com\/campaign\/?(?:voucher_detail\/?)?\?v=([A-Za-z0-9]+)/gi;
  let match;
  
  while ((match = urlPattern.exec(text)) !== null) {
    const code = match[1].trim();
    if (isValidVoucherCode(code) && !seenVouchers.has(code)) {
      foundVouchers.push(code);
      seenVouchers.add(code);
    }
  }
  
  const words = text.split(/[\s\n\r,;.!?()[\]{}'"<>\/\\]+/);
  for (const word of words) {
    const cleanWord = word.replace(/[^a-zA-Z0-9]/g, '');
    if (isValidVoucherCode(cleanWord) && !seenVouchers.has(cleanWord)) {
      foundVouchers.push(cleanWord);
      seenVouchers.add(cleanWord);
    }
  }
  return foundVouchers;
}

setInterval(() => {
  seenVouchers.clear();
}, 20000);

let sessionString = "";
if (fs.existsSync(SESSION_FILE)) {
  sessionString = fs.readFileSync(SESSION_FILE, "utf8").trim();
}

const telegramClient = new TelegramClient(
  new StringSession(sessionString),
  CONFIG.apiId,
  CONFIG.apiHash,
  { connectionRetries: 5 }
);

async function startBot() {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("⚡ Telegram Voucher Bot v1.0.0");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  
  try {
    if (sessionString) {
      await telegramClient.start({ botAuthToken: false });
      console.log("✅ Logged in with saved session");
    } else {
      const input = require("input");
      const phoneNumber = await input.text("📱 Enter phone number: ");
      await telegramClient.start({
        phoneNumber: phoneNumber.replace(/\s/g, ""),
        password: async () => await input.text("🔐 2FA password (press Enter to skip): "),
        phoneCode: async () => await input.text("📟 OTP code: "),
        onError: (err) => console.error(err)
      });
      fs.writeFileSync(SESSION_FILE, telegramClient.session.save());
      console.log("💾 Session saved");
    }
    
    console.log(`📞 Receiving phone: ${CONFIG.phone}`);
    console.log(`🎯 Mode: Instant shoot (no delay)`);
    console.log(`📡 Webhook: ${CONFIG.webhook || "Disabled"}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    
    telegramClient.addEventHandler(async (event) => {
      const message = event.message;
      if (!message) return;
      
      if (message.message) {
        const vouchers = extractVoucherCodes(message.message);
        if (vouchers.length > 0) {
          vouchers.forEach(voucher => {
            console.log(`🎯 พบซอง: ${voucher}`);
            shootVoucher(voucher);
          });
        }
      }
      
      // ...existing code...
    }, new NewMessage({ incoming: true }));
    
    telegramClient.on("disconnected", () => {
      console.log("⚠️ Connection lost. Reconnecting...");
    });
    
  } catch (error) {
    console.error("❌ Startup error:", error.message);
    process.exit(1);
  }
}

startBot();