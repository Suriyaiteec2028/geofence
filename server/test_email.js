const { sendCMORegistrationOTPEmail } = require('./utils/emailService');

console.log('Sending test email via emailService.js...');
sendCMORegistrationOTPEmail({
  email: 'suriyachandru2006@gmail.com',
  otpCode: '999888'
}).then(() => {
  console.log('Test email function execution completed.');
});
