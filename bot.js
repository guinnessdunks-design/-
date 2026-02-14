const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { NewMessage } = require("telegram/events");
const axios = require("axios");
const express = require("express");
const bodyParser = require("body-parser");
const Jimp = require("jimp");
const fs = require("fs");
require("dotenv").config();

// ========================================
// 🆕 ใช้ @fortune-inc/tw-voucher แทน Proxy
// ========================================
let twvoucher;
const twPackage = require('@fortune-inc/tw-voucher');
if (typeof twPackage === 'function') {
    twvoucher = twPackage;
} else if (twPackage.voucher && typeof twPackage.voucher === 'function') {
    twvoucher = twPackage.voucher;
} else {
    twvoucher = twPackage.default || twPackage;
}

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

let CONFIG = null;
let totalClaimed = 0;
let totalFailed = 0;
let totalAmount = 0;
let loginStep = "need-config";
let otpCode = "";
let passwordCode = "";
let client = null;

const html = (title, body) => `
<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700&family=Prompt:wght@400;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --main-gradient: linear-gradient(135deg, #0f2027 0%, #2c5364 100%);
      --neon1: #00fff7;
      --neon2: #ff00cc;
      --neon3: #00ff88;
      --glass-bg: rgba(20,24,38,0.85);
      --glass-border: rgba(0,255,255,0.18);
      --shadow: 0 8px 32px 0 rgba(0,255,255,0.12);
      --primary: #00fff7;
      --secondary: #ff00cc;
      --success: #00ff88;
      --danger: #ff3c6a;
      --warning: #ffe066;
      --info: #00bfff;
    }
    html, body { height: 100%; }
    body {
      min-height: 100vh;
      background: var(--main-gradient);
      font-family: 'Prompt', 'Orbitron', Arial, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 0;
      margin: 0;
      overflow-x: hidden;
    }
    .glass-box {
      background: var(--glass-bg);
      border-radius: 24px;
      box-shadow: var(--shadow), 0 0 32px 0 var(--neon1), 0 0 8px 0 var(--neon2);
      border: 2.5px solid;
      border-image: linear-gradient(135deg, var(--neon1), var(--neon2), var(--neon3)) 1;
      padding: 48px 36px 36px 36px;
      max-width: 440px;
      width: 100vw;
      margin: 32px 0;
      backdrop-filter: blur(18px) saturate(180%);
      -webkit-backdrop-filter: blur(18px) saturate(180%);
      position: relative;
      animation: fadeIn 0.7s cubic-bezier(.4,0,.2,1);
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(40px); }
      to { opacity: 1; transform: translateY(0); }
    }
    h1 {
      color: var(--neon1);
      font-family: 'Orbitron', 'Prompt', Arial, sans-serif;
      font-size: 2.3rem;
      font-weight: 700;
      margin-bottom: 18px;
      text-align: center;
      letter-spacing: 2px;
      text-shadow: 0 0 8px var(--neon1), 0 2px 16px var(--neon2);
      text-transform: uppercase;
    }
    h2 {
      color: var(--neon2);
      font-size: 1.2rem;
      margin: 18px 0 10px;
      border-bottom: 2px solid var(--neon1);
      padding-bottom: 8px;
      font-weight: 600;
      letter-spacing: 1px;
      text-shadow: 0 0 6px var(--neon2);
    }
    form {
      margin-top: 18px;
    }
    label.label {
      font-weight: 600;
      color: var(--neon1);
      margin: 12px 0 4px;
      display: block;
      font-size: 1rem;
      letter-spacing: 1px;
      text-shadow: 0 0 4px var(--neon1);
    }
    input, button, textarea {
      width: 100%;
      padding: 15px;
      margin: 10px 0 0 0;
      border-radius: 12px;
      font-size: 1rem;
      border: 2px solid #222c;
      transition: all 0.3s;
      font-family: 'Prompt', 'Orbitron', Arial, sans-serif;
      background: rgba(30,34,54,0.85);
      color: #fff;
      outline: none;
      box-shadow: 0 0 8px #00fff733 inset;
    }
    input:focus, textarea:focus {
      border-color: var(--neon2);
      box-shadow: 0 0 0 3px var(--neon2), 0 0 8px var(--neon1) inset;
      background: #181c2a;
    }
    button {
      background: linear-gradient(90deg, var(--neon1), var(--neon2), var(--neon3));
      color: #181c2a;
      border: none;
      cursor: pointer;
      font-weight: 700;
      margin-top: 18px;
      letter-spacing: 2px;
      box-shadow: 0 0 16px var(--neon2), 0 2px 8px #0008;
      transition: transform 0.15s, box-shadow 0.15s, background 0.2s;
      text-transform: uppercase;
      font-family: 'Orbitron', 'Prompt', Arial, sans-serif;
    }
    button:hover {
      transform: translateY(-2px) scale(1.04) rotate(-1deg);
      box-shadow: 0 0 32px var(--neon1), 0 8px 32px var(--neon2);
      background: linear-gradient(90deg, var(--neon2), var(--neon1), var(--neon3));
      color: #fff;
    }
    .info, .warning, .success {
      padding: 14px 18px;
      border-radius: 10px;
      margin: 12px 0;
      font-size: 1rem;
      border-left: 5px solid;
      background: rgba(30,34,54,0.85);
      box-shadow: 0 2px 8px var(--neon1) inset;
      color: var(--neon1);
      font-family: 'Prompt', Arial, sans-serif;
    }
    .info { border-color: var(--info); color: var(--info); }
    .warning { border-color: var(--warning); color: var(--warning); background: #2c2a1aee; }
    .success { border-color: var(--success); color: var(--success); background: #1a2c1aee; }
    .stat {
      display: flex;
      gap: 16px;
      margin: 24px 0 18px 0;
      justify-content: space-between;
    }
    .stat div {
      flex: 1;
      background: rgba(30,34,54,0.85);
      padding: 18px 0 10px 0;
      border-radius: 12px;
      text-align: center;
      border: 2px solid var(--neon2);
      box-shadow: 0 2px 8px var(--neon1) inset;
      font-size: 1.1rem;
      font-weight: 600;
      color: var(--neon1);
      text-shadow: 0 0 8px var(--neon2);
    }
    .stat div span {
      display: block;
      font-size: 2.1rem;
      font-weight: 700;
      color: var(--neon2);
      margin-top: 6px;
      text-shadow: 0 0 12px var(--neon2), 0 2px 8px var(--neon1);
    }
    .note {
      font-size: 0.95rem;
      color: var(--neon3);
      margin-top: 4px;
      margin-bottom: 2px;
      text-shadow: 0 0 4px var(--neon3);
    }
    .code {
      background: #181c2a;
      color: var(--neon1);
      padding: 7px 12px;
      border-radius: 6px;
      font-family: 'Orbitron', monospace;
      font-size: 1rem;
      display: inline-block;
      margin: 3px 0;
      box-shadow: 0 0 8px var(--neon1);
    }
    .step {
      background: rgba(30,34,54,0.85);
      padding: 16px 18px;
      border-radius: 12px;
      margin: 16px 0;
      border-left: 6px solid var(--neon2);
      box-shadow: 0 2px 8px var(--neon1) inset;
      color: var(--neon1);
    }
    .step-num {
      background: var(--neon2);
      color: #fff;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      margin-right: 12px;
      font-size: 1.1rem;
      box-shadow: 0 2px 8px var(--neon2);
      font-family: 'Orbitron', Arial, sans-serif;
    }
    a {
      color: var(--neon1);
      text-decoration: none;
      font-weight: 600;
      transition: color 0.2s;
      text-shadow: 0 0 4px var(--neon1);
    }
    a:hover {
      text-decoration: underline;
      color: var(--neon2);
    }
    @media (max-width: 600px) {
      .glass-box { padding: 24px 6vw 18px 6vw; }
      h1 { font-size: 1.4rem; }
      .stat div span { font-size: 1.3rem; }
    }
    /* OTP input style */
    input[type="text"][name="otp"] {
      letter-spacing: 0.4em;
      font-size: 1.5rem;
      text-align: center;
      font-weight: 700;
      background: #222c;
      border: 2px solid var(--neon2);
      margin-bottom: 8px;
      color: var(--neon1);
      box-shadow: 0 0 8px var(--neon2);
    }
  </style>
</head>
<body>
  <div class="glass-box">${body}</div>
</body>
</html>
`;

app.get('/', (req, res) => {
  if (!CONFIG) {
    res.send(html("ตั้งค่าบอท", `
      <h1>🚀 TrueMoney Auto Claim</h1>
      <div class="warning">⚙️ กรุณาตั้งค่าบอทก่อนใช้งาน</div>
      
      <h2>📋 ขั้นตอนการตั้งค่า</h2>
      
      <div class="step">
        <span class="step-num">1</span>
        <strong>สมัคร Telegram API</strong>
        <div class="note">ไปที่ <a href="https://my.telegram.org/apps" target="_blank">https://my.telegram.org/apps</a></div>
        <div class="note">1. Login ด้วยเบอร์ Telegram ของคุณ</div>
        <div class="note">2. กรอกข้อมูล:</div>
        <div class="note" style="margin-left:20px">• App title: <span class="code">TrueMoney Bot</span></div>
        <div class="note" style="margin-left:20px">• Short name: <span class="code">tmbot</span></div>
        <div class="note" style="margin-left:20px">• Platform: <span class="code">Desktop</span></div>
        <div class="note">3. กด Create application</div>
        <div class="note">4. คัดลอก <strong>api_id</strong> และ <strong>api_hash</strong></div>
      </div>
      
      <div class="step">
        <span class="step-num">2</span>
        <strong>กรอกข้อมูลด้านล่าง</strong>
      </div>
      
      <form action="/save-config" method="POST">
        <label class="label">🔑 API ID</label>
        <input type="text" name="apiId" placeholder="12345678" required>
        <div class="note">ตัวเลขที่ได้จาก my.telegram.org</div>
        
        <label class="label">🔐 API Hash</label>
        <input type="text" name="apiHash" placeholder="abc123def456..." required>
        <div class="note">รหัสยาวๆ ที่ได้จาก my.telegram.org</div>
        
        <label class="label">📱 เบอร์ Telegram</label>
        <input type="text" name="phoneNumber" placeholder="+66812345678" required>
        <div class="note">ต้องขึ้นต้นด้วย +66 (ไม่ใช่ 0)</div>
        
        <label class="label">💰 เบอร์กระเป๋า TrueMoney</label>
        <input type="text" name="walletNumber" placeholder="0812345678" required>
        <div class="note">เบอร์ที่จะรับเงิน (เริ่มต้นด้วย 0)</div>
        
        <label class="label">📝 ชื่อกระเป๋า (ไม่บังคับ)</label>
        <input type="text" name="walletName" placeholder="กระเป๋าหลัก">

        <label class="label">🌐 Webhook URL (ไม่บังคับ)</label>
        <input type="text" name="webhookUrl" placeholder="https://your-webhook.site/xxx">
        <div class="note">URL สำหรับรับแจ้งเตือนเมื่อรับเงิน</div>
        
        <button type="submit">✅ บันทึกและเริ่มใช้งาน</button>
      </form>
      
      <div class="info" style="margin-top:20px">
        💡 <strong>หมายเหตุ:</strong> ข้อมูลจะถูกเก็บไว้ใน Environment Variables
      </div>
    `));
  } else if (loginStep === "logged-in") {
    res.send(html("Dashboard", `
      <h1>🚀 TrueMoney Bot</h1>
      <div class="success">✅ บอทกำลังทำงาน</div>
      
      <div class="stat">
        <div>รับสำเร็จ<span style="color:#10b981">${totalClaimed}</span></div>
        <div>ล้มเหลว<span style="color:#ef4444">${totalFailed}</span></div>
        <div>ยอดรวม<span style="color:#f59e0b">${totalAmount}฿</span></div>
      </div>
      
      <div class="info">📱 เบอร์: ${CONFIG.phoneNumber}</div>
      <div class="info">💰 กระเป๋า: ${CONFIG.walletName}</div>
      
      <button onclick="if(confirm('ต้องการตั้งค่าใหม่?')){location.href='/reset'}" style="background:#ef4444;margin-top:20px">🔄 ตั้งค่าใหม่</button>
      
      <script>setTimeout(()=>location.reload(),30000)</script>
    `));
  } else if (loginStep === "need-send-otp") {
    res.send(html("Login", `
      <h1>📱 Login Telegram</h1>
      <div class="warning">📮 กดปุ่มด้านล่างเพื่อส่ง OTP</div>
      <div class="info">เบอร์: ${CONFIG.phoneNumber}</div>
      <form action="/send-otp" method="POST">
        <button type="submit">📨 ส่ง OTP</button>
      </form>
    `));
  } else if (loginStep === "need-otp") {
    res.send(html("OTP", `
      <h1>🔑 ใส่รหัส OTP</h1>
      <div class="warning">📱 ตรวจสอบรหัส OTP ใน Telegram</div>
      <form action="/verify-otp" method="POST">
        <input type="text" name="otp" placeholder="12345" maxlength="5" required autofocus>
        <button type="submit">✅ ยืนยัน</button>
      </form>
    `));
  } else if (loginStep === "need-password") {
    res.send(html("2FA", `
      <h1>🔒 Two-Factor Authentication</h1>
      <div class="warning">🔐 ถ้าไม่มี 2FA ให้กด "ข้าม"</div>
      <form action="/verify-2fa" method="POST">
        <input type="password" name="password" placeholder="รหัส 2FA" autofocus>
        <button type="submit">✅ ยืนยัน</button>
      </form>
      <form action="/skip-2fa" method="POST">
        <button type="submit" style="background:#6b7280">⏭️ ข้าม</button>
      </form>
    `));
  } else {
    res.send(html("Loading", `
      <h1>🚀 กำลังเริ่มต้น...</h1>
      <div class="info">⏳ กรุณารอสักครู่...</div>
      <script>setTimeout(()=>location.reload(),3000)</script>
    `));
  }
});

app.post('/save-config', async (req, res) => {
  CONFIG = {
    apiId: parseInt(req.body.apiId),
    apiHash: req.body.apiHash,
    phoneNumber: req.body.phoneNumber,
    walletNumber: req.body.walletNumber,
    walletName: req.body.walletName || "กระเป๋าหลัก",
    webhookUrl: req.body.webhookUrl || ""
  };

  const envContent = `API_ID=${CONFIG.apiId}
API_HASH=${CONFIG.apiHash}
PHONE_NUMBER=${CONFIG.phoneNumber}
WALLET_NUMBER=${CONFIG.walletNumber}
WALLET_NAME=${CONFIG.walletName}
WEBHOOK_URL=${CONFIG.webhookUrl}`;

  fs.writeFileSync('.env', envContent);

  res.send(html("บันทึกสำเร็จ", `
    <h1>✅ บันทึกการตั้งค่าสำเร็จ</h1>
    <div class="success">กำลังเริ่มต้นบอท...</div>
    <div class="info">
      📱 เบอร์: ${CONFIG.phoneNumber}<br>
      💰 กระเป๋า: ${CONFIG.walletName}<br>
      🌐 Webhook: ${CONFIG.webhookUrl ? CONFIG.webhookUrl : 'ไม่ได้ตั้งค่า'}
    </div>
    <script>
      setTimeout(() => {
        location.href = '/';
        setTimeout(() => location.reload(), 2000);
      }, 2000);
    </script>
  `));

  setTimeout(() => startBot(), 3000);
});

app.get('/reset', (req, res) => {
  CONFIG = null;
  if (fs.existsSync('.env')) fs.unlinkSync('.env');
  if (fs.existsSync('session.txt')) fs.unlinkSync('session.txt');
  res.redirect('/');
});

app.post('/send-otp', (req, res) => {
  loginStep = "need-otp";
  res.send(html("Sending", `
    <h1>📤 กำลังส่ง OTP</h1>
    <div class="info">⏳ กรุณารอสักครู่...</div>
    <script>setTimeout(()=>location.href='/',2000)</script>
  `));
});

app.post('/verify-otp', (req, res) => {
  otpCode = req.body.otp;
  res.send(html("Processing", `
    <h1>✅ กำลังตรวจสอบ OTP</h1>
    <div class="info">⏳ กรุณารอสักครู่...</div>
    <script>setTimeout(()=>location.href='/',3000)</script>
  `));
});

app.post('/verify-2fa', (req, res) => {
  passwordCode = req.body.password;
  res.send(html("Processing", `
    <h1>✅ กำลังตรวจสอบ 2FA</h1>
    <div class="info">⏳ กรุณารอสักครู่...</div>
    <script>setTimeout(()=>location.href='/',3000)</script>
  `));
});

app.post('/skip-2fa', (req, res) => {
  passwordCode = "";
  res.send(html("Processing", `
    <h1>✅ กำลังเข้าสู่ระบบ</h1>
    <div class="info">⏳ กรุณารอสักครู่...</div>
    <script>setTimeout(()=>location.href='/',3000)</script>
  `));
});

app.listen(10000, () => {
  console.log(`🌐 Server: http://localhost:10000`);
});

setInterval(() => {
  const url = process.env.RENDER_EXTERNAL_URL || `http://localhost:10000`;
  axios.get(url).catch(() => {});
}, 10 * 60 * 1000);

const thaiMap = {"เก้าสิบเก้า":"99","เก้าสิบแปด":"98","เก้าสิบเจ็ด":"97","เก้าสิบหก":"96","เก้าสิบห้า":"95","เก้าสิบสี่":"94","เก้าสิบสาม":"93","เก้าสิบสอง":"92","เก้าสิบเอ็ด":"91","เก้าสิบ":"90","แปดสิบเก้า":"89","แปดสิบแปด":"88","แปดสิบเจ็ด":"87","แปดสิบหก":"86","แปดสิบห้า":"85","แปดสิบสี่":"84","แปดสิบสาม":"83","แปดสิบสอง":"82","แปดสิบเอ็ด":"81","แปดสิบ":"80","เจ็ดสิบเก้า":"79","เจ็ดสิบแปด":"78","เจ็ดสิบเจ็ด":"77","เจ็ดสิบหก":"76","เจ็ดสิบห้า":"75","เจ็ดสิบสี่":"74","เจ็ดสิบสาม":"73","เจ็ดสิบสอง":"72","เจ็ดสิบเอ็ด":"71","เจ็ดสิบ":"70","หกสิบเก้า":"69","หกสิบแปด":"68","หกสิบเจ็ด":"67","หกสิบหก":"66","หกสิบห้า":"65","หกสิบสี่":"64","หกสิบสาม":"63","หกสิบสอง":"62","หกสิบเอ็ด":"61","หกสิบ":"60","ห้าสิบเก้า":"59","ห้าสิบแปด":"58","ห้าสิบเจ็ด":"57","ห้าสิบหก":"56","ห้าสิบห้า":"55","ห้าสิบสี่":"54","ห้าสิบสาม":"53","ห้าสิบสอง":"52","ห้าสิบเอ็ด":"51","ห้าสิบ":"50","สี่สิบเก้า":"49","สี่สิบแปด":"48","สี่สิบเจ็ด":"47","สี่สิบหก":"46","สี่สิบห้า":"45","สี่สิบสี่":"44","สี่สิบสาม":"43","สี่สิบสอง":"42","สี่สิบเอ็ด":"41","สี่สิบ":"40","สามสิบเก้า":"39","สามสิบแปด":"38","สามสิบเจ็ด":"37","สามสิบหก":"36","สามสิบห้า":"35","สามสิบสี่":"34","สามสิบสาม":"33","สามสิบสอง":"32","สามสิบเอ็ด":"31","สามสิบ":"30","ยี่สิบเก้า":"29","ยี่สิบแปด":"28","ยี่สิบเจ็ด":"27","ยี่สิบหก":"26","ยี่สิบห้า":"25","ยี่สิบสี่":"24","ยี่สิบสาม":"23","ยี่สิบสอง":"22","ยี่สิบเอ็ด":"21","ยี่สิบ":"20","สิบเก้า":"19","สิบแปด":"18","สิบเจ็ด":"17","สิบหก":"16","สิบห้า":"15","สิบสี่":"14","สิบสาม":"13","สิบสอง":"12","สิบเอ็ด":"11","สิบ":"10","ศูนย์":"0","หนึ่ง":"1","สอง":"2","สาม":"3","สี่":"4","ห้า":"5","หก":"6","เจ็ด":"7","แปด":"8","เก้า":"9","เอ็ด":"1","ยี่":"2"};

function hasThai(text) {
  return /[\u0E00-\u0E7F]/.test(text);
}

function decodeThai(text) {
  let decoded = text.replace(/\s+/g, "");
  const keys = Object.keys(thaiMap).sort((a, b) => b.length - a.length);
  for (const thai of keys) {
    decoded = decoded.replace(new RegExp(thai, "gi"), thaiMap[thai]);
  }
  return decoded.replace(/[^a-zA-Z0-9]/g, "");
}

function isLikelyVoucher(s) {
  if (!s || s.length < 20 || s.length > 64) return false;
  return /^[a-zA-Z0-9]+$/.test(s);
}

// QR decode function removed

function extractVoucher(text) {
  if (!text) return null;
  const results = [];
  const urlRegex = /https?:\/\/gift\.truemoney\.com\/campaign\/?\??.*?v=([^\s&]+)/gi;
  const matches = [...text.matchAll(urlRegex)];
  for (const match of matches) {
    let voucher = match[1].trim();
    if (hasThai(voucher)) voucher = decodeThai(voucher);
    voucher = voucher.replace(/\s/g, '');
    if (isLikelyVoucher(voucher)) results.push(voucher);
  }
  return results.length > 0 ? results : null;
}

const recentSeen = new Set();

// ========================================
// ⚡ ฟังก์ชันหลัก: ใช้ tw-voucher แทน Proxy
// ========================================
async function processVoucher(voucher) {
  if (recentSeen.has(voucher)) return;
  recentSeen.add(voucher);
  setTimeout(() => recentSeen.delete(voucher), 30000);
  
  console.log(`📥 ${voucher}`);
  
  const phone = CONFIG.walletNumber.replace(/\s/g, '');
  const voucherUrl = `https://gift.truemoney.com/campaign/?v=${voucher}`;
  
  try {
    // ========================================
    // 🔥 เรียก tw-voucher โดยตรง (ไม่ผ่าน Proxy)
    // ========================================
    const result = await twvoucher(phone, voucherUrl);

    if (result && result.amount) {
      const amount = parseFloat(result.amount);
      totalClaimed++;
      totalAmount += amount;
      console.log(`✅ +${amount}฿`);

      // แจ้ง Webhook ถ้ามีการตั้งค่าไว้
      if (CONFIG.webhookUrl) {
        try {
          await axios.post(CONFIG.webhookUrl, {
            event: 'voucher_claimed',
            voucher: voucher,
            amount: amount,
            wallet: CONFIG.walletNumber,
            walletName: CONFIG.walletName,
            totalClaimed,
            totalAmount
          });
        } catch (e) {
          console.log('Webhook แจ้งเตือนไม่สำเร็จ:', e.message);
        }
      }
    } else {
      totalFailed++;
      console.log(`❌ ${result?.message || 'Failed'}`);
    }
  } catch (err) {
    totalFailed++;
    console.log(`❌ ${err.message}`);
  }
}

async function startBot() {
  if (!CONFIG) return;
  
  const SESSION_FILE = "session.txt";
  let sessionString = "";
  
  if (fs.existsSync(SESSION_FILE)) {
    sessionString = fs.readFileSync(SESSION_FILE, "utf8").trim();
  }
  
  const session = new StringSession(sessionString);
  client = new TelegramClient(session, CONFIG.apiId, CONFIG.apiHash, {
    connectionRetries: 5,
    useWSS: false,
    autoReconnect: true
  });
  
  console.log("🚀 Starting bot...\n");
  
  try {
    if (sessionString) {
      console.log("🔐 Connecting...");
      await client.start({ 
        botAuthToken: false,
        onError: e => console.error(e.message)
      });
      loginStep = "logged-in";
      console.log("✅ Connected!\n");
    } else {
      console.log("🔐 Login\n");
      loginStep = "need-send-otp";
      
      // Optimize login polling by using Promises
      function waitFor(condition) {
        return new Promise(resolve => {
          if (condition()) return resolve();
          const interval = setInterval(() => {
            if (condition()) {
              clearInterval(interval);
              resolve();
            }
          }, 100);
        });
      }
      await client.start({
        phoneNumber: async () => {
          await waitFor(() => loginStep !== "need-send-otp");
          return CONFIG.phoneNumber;
        },
        password: async () => {
          loginStep = "need-password";
          await waitFor(() => loginStep !== "need-password" && passwordCode !== "");
          return passwordCode || undefined;
        },
        phoneCode: async () => {
          await waitFor(() => !!otpCode);
          const code = otpCode;
          otpCode = "";
          return code;
        },
        onError: e => console.error(e.message),
      });
      
      const newSession = client.session.save();
      fs.writeFileSync(SESSION_FILE, newSession, "utf8");
      loginStep = "logged-in";
      console.log("\n✅ Login success!\n");
    }
  } catch (err) {
    console.error("❌ Login failed:", err.message);
    return;
  }
  
  console.log("👂 Listening...\n");
  
  client.addEventHandler(async (event) => {
    try {
      const msg = event.message;
      if (!msg) return;
      
      // QR scan from photo removed for performance
      
      if (msg.message) {
        const vouchers = extractVoucher(msg.message);
        if (vouchers) {
          for (const v of vouchers) {
            await processVoucher(v);
          }
        }
      }
    } catch (err) {
      console.error("❌", err.message);
    }
  }, new NewMessage({ incoming: true }));
  
  console.log("✅ Bot ready!\n");
}

if (fs.existsSync('.env')) {
  require('dotenv').config();
  if (process.env.API_ID && process.env.API_HASH) {
    CONFIG = {
      apiId: parseInt(process.env.API_ID),
      apiHash: process.env.API_HASH,
      phoneNumber: process.env.PHONE_NUMBER,
      walletNumber: process.env.WALLET_NUMBER,
      walletName: process.env.WALLET_NAME || "กระเป๋าหลัก",
      webhookUrl: process.env.WEBHOOK_URL || ""
    };
    startBot();
  }
}
