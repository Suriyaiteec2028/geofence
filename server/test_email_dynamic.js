const { sendCMORegistrationOTPEmail } = require('./utils/emailService');

async function testDynamicEmailRecipient() {
  const dynamicRecipient = 'suriyan182006@gmail.com';
  console.log(`Testing dynamic email dispatch to recipient: ${dynamicRecipient}...`);

  try {
    await sendCMORegistrationOTPEmail({
      email: dynamicRecipient,
      otpCode: '777444'
    });
    console.log(`SUCCESS! Live OTP email delivered to entered inbox: ${dynamicRecipient}`);
  } catch (err) {
    console.error('ERROR delivering dynamic email:', err);
  }
}

testDynamicEmailRecipient();
