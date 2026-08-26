const nodemailer = require('nodemailer');

async function testGmailWithTimeout() {
  const user = 'sn4194529@gmail.com';
  const pass = 'hyhhushkykizobxx';

  console.log(`Connecting to Gmail SMTP (with 5s socket timeout)...`);

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 5000,
    tls: { rejectUnauthorized: false }
  });

  try {
    const info = await transporter.sendMail({
      from: `"GeoAttendance Test" <${user}>`,
      to: 'suriyachandru2006@gmail.com',
      subject: '🔐 LIVE TEST EMAIL DISPATCH (Timeout Protected) - GeoAttendance',
      html: '<h2>Live Email Test Successful!</h2>'
    });
    console.log('SUCCESS! Email Sent:', info.messageId);
  } catch (err) {
    console.error('ERROR Sending Email:', err.message);
  }
}

testGmailWithTimeout();
