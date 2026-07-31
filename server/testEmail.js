const dotenv = require('dotenv');
dotenv.config();

const nodemailer = require('nodemailer');

async function testGmail() {
  console.log('Testing Gmail SMTP with credentials & rejectUnauthorized: false...');

  const cleanPass = (process.env.SMTP_PASS || '').replace(/\s+/g, '');

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER.trim(),
      pass: cleanPass
    },
    tls: {
      rejectUnauthorized: false // Bypasses local antivirus / SSL certificate interception
    }
  });

  try {
    console.log('Verifying SMTP connection...');
    await transporter.verify();
    console.log('🟢 SMTP Server connection verified successfully!');

    console.log('Sending test email to:', process.env.SMTP_USER);
    const info = await transporter.sendMail({
      from: `"Govt. Health Test" <${process.env.SMTP_USER}>`,
      to: process.env.SMTP_USER,
      subject: 'Test Email from Hospital GeoAttendance System',
      text: 'Hello! This is a test email to verify real Gmail SMTP delivery.'
    });

    console.log('SUCCESS! Email sent:', info.messageId);
  } catch (err) {
    console.error('❌ SMTP Error:', err);
  }
}

testGmail();
