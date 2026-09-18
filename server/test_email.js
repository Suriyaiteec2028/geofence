const nodemailer = require('nodemailer');

async function testGmail() {
  const user = 'sn4194529@gmail.com';
  const pass = 'hyhhushkykizobxx';

  console.log('Testing SSL port 465...');
  try {
    const transporter465 = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user, pass },
      connectionTimeout: 8000,
      tls: { rejectUnauthorized: false }
    });

    const info = await transporter465.sendMail({
      from: `"GeoAttendance Security" <${user}>`,
      to: 'suriyachandru2006@gmail.com',
      subject: 'Test OTP Email via Port 465',
      text: 'This is a test OTP email from Port 465.'
    });
    console.log('SUCCESS Port 465! MessageID:', info.messageId);
    return;
  } catch (err465) {
    console.error('FAILED Port 465:', err465.message);
  }

  console.log('Testing TLS port 587...');
  try {
    const transporter587 = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: { user, pass },
      connectionTimeout: 8000,
      tls: { rejectUnauthorized: false }
    });

    const info = await transporter587.sendMail({
      from: `"GeoAttendance Security" <${user}>`,
      to: 'suriyachandru2006@gmail.com',
      subject: 'Test OTP Email via Port 587',
      text: 'This is a test OTP email from Port 587.'
    });
    console.log('SUCCESS Port 587! MessageID:', info.messageId);
  } catch (err587) {
    console.error('FAILED Port 587:', err587.message);
  }
}

testGmail();
