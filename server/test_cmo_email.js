const { sendCMORegistrationOTPEmail } = require('./utils/emailService');

async function testCMO() {
  console.log('Sending CMO OTP email to suriyachandru2006@gmail.com...');
  try {
    await sendCMORegistrationOTPEmail({
      email: 'suriyachandru2006@gmail.com',
      otpCode: '852963'
    });
    console.log('CMO OTP Email dispatch completed successfully!');
  } catch (err) {
    console.error('CMO OTP Email error:', err);
  }
}

testCMO();
