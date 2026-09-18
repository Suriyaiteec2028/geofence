const { sendPasswordResetOTPEmail } = require('./utils/emailService');

async function run() {
  console.log('Sending test OTP email to suriyachandru2006@gmail.com...');
  await sendPasswordResetOTPEmail({
    name: 'Dr. Suriya N',
    email: 'suriyachandru2006@gmail.com',
    otpCode: '852963'
  });
  console.log('Finished test call.');
}

run();
