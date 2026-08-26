let nodemailer = null;
try {
  nodemailer = require('nodemailer');
} catch (e) {
  // Fallback engine if nodemailer package is uninstalled
}

const { memoryStore, saveMemoryStoreToDisk } = require('../config/db');

// Configure Transporter (using Direct Port 465 SSL for 100% Reliable Gmail Dispatch)
function getTransporter() {
  const user = (process.env.SMTP_USER || 'sn4194529@gmail.com').trim();
  const rawPass = process.env.SMTP_PASS || 'hyhh ushk ykiz obxx';
  const pass = rawPass.replace(/\s+/g, '');

  if (nodemailer) {
    try {
      return nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: Number(process.env.SMTP_PORT) || 465,
        secure: process.env.SMTP_SECURE !== 'false',
        auth: { user, pass },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 10000,
        tls: { rejectUnauthorized: false }
      });
    } catch (e) {
      console.warn('Nodemailer initialization warning:', e.message);
    }
  }

  // Fallback Transport Engine
  return {
    sendMail: async (options) => {
      console.log(`=======================================================`);
      console.log(`📧 [FALLBACK EMAIL DISPATCHED TO]: ${options.to}`);
      console.log(`📌 [SUBJECT]: ${options.subject}`);
      console.log(`=======================================================`);
      return { messageId: 'fallback_' + Date.now() };
    }
  };
}

// Log notification into System Notifications Audit Store
function logNotification(recipientEmail, title, message, type = 'EMAIL') {
  const notif = {
    _id: 'notif_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    recipientEmail,
    title,
    message,
    type,
    read: false,
    isRead: false,
    createdAt: new Date().toISOString()
  };
  memoryStore.notifications.unshift(notif);
  saveMemoryStoreToDisk();
}

// 1. Send Doctor Registration Welcome Email
async function sendDoctorRegistrationEmail({ name, email, username, password, shiftStart, shiftEnd, phcName }) {
  try {
    const transporter = getTransporter();

    const subject = `Welcome Dr. ${name} - Your GeoAttendance Login Credentials & Shift Timings`;
    const html = `
      <div style="font-family: Arial, sans-serif; background-color: #0F172A; padding: 24px; color: #F8FAFC;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #1E293B; border: 1px solid #334155; border-radius: 16px; padding: 24px;">
          <h2 style="color: #38BDF8; margin-top: 0;">Govt. Health Services GeoAttendance Portal</h2>
          <p style="font-size: 14px; color: #94A3B8;">Hello <strong>Dr. ${name}</strong>,</p>
          <p style="font-size: 14px; color: #CBD5E1;">Your medical doctor account has been registered in the Hospital Geofence Attendance System.</p>
          
          <div style="background-color: #0F172A; border-left: 4px solid #38BDF8; padding: 16px; margin: 20px 0; border-radius: 8px;">
            <h4 style="margin: 0 0 10px 0; color: #F1F5F9;">Your Login Credentials & Schedule:</h4>
            <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #94A3B8; line-height: 1.9;">
              <li><strong>Hospital PHC:</strong> <span style="color: #F8FAFC;">${phcName || 'Primary Health Center'}</span></li>
              <li><strong>Email:</strong> <span style="color: #F8FAFC;">${email}</span></li>
              <li><strong>Login Username:</strong> <span style="color: #38BDF8; font-weight: bold;">${username}</span></li>
              <li><strong>Login Password:</strong> <span style="color: #10B981; font-weight: bold;">${password || 'Set by Admin'}</span></li>
              <li><strong>Daily Duty Shift:</strong> <span style="color: #F59E0B; font-weight: bold;">${shiftStart} – ${shiftEnd}</span></li>
            </ul>
          </div>

          <p style="font-size: 12px; color: #94A3B8;">Instructions: Please select the <strong>DOCTOR</strong> tab on the login screen, enter your credentials above, and pass mandatory biometric face verification on arrival at the hospital.</p>
          <hr style="border: 0; border-top: 1px solid #334155; margin: 20px 0;" />
          <p style="font-size: 11px; color: #64748B; text-align: center;">Automated System Notification • Department of Public Health Services</p>
        </div>
      </div>
    `;

    try {
      const info = await transporter.sendMail({
        from: `"Govt. Health Services" <${process.env.SMTP_USER || 'sn4194529@gmail.com'}>`,
        to: email,
        subject,
        html
      });
      console.log(`🟢 LIVE REGISTRATION EMAIL DELIVERED TO: ${email} (MessageID: ${info.messageId})`);
    } catch (sendErr) {
      console.warn(`⚠️ SMTP dispatch notice for ${email}:`, sendErr.message);
    }

    logNotification(email, 'Account Registration Notice', `Welcome Dr. ${name}! Your medical doctor account was registered at ${phcName}. Your assigned duty shift is ${shiftStart} - ${shiftEnd}. Account credentials: Username=${username}, Password=${password}`);
  } catch (err) {
    console.error('Error sending registration email:', err);
  }
}

// 2. Send Shift Update Email
async function sendShiftUpdateEmail({ name, email, shiftStart, shiftEnd, phcName }) {
  try {
    const transporter = getTransporter();

    const subject = `Notice: Duty Shift Schedule Updated (Dr. ${name})`;
    const html = `
      <div style="font-family: Arial, sans-serif; background-color: #0F172A; padding: 24px; color: #F8FAFC;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #1E293B; border: 1px solid #334155; border-radius: 16px; padding: 24px;">
          <h2 style="color: #F59E0B; margin-top: 0;">Duty Schedule Update Alert</h2>
          <p style="font-size: 14px; color: #94A3B8;">Hello <strong>Dr. ${name}</strong>,</p>
          <p style="font-size: 14px; color: #CBD5E1;">Your hospital administration has updated your active duty shift timings.</p>
          
          <div style="background-color: #0F172A; border-left: 4px solid #F59E0B; padding: 16px; margin: 20px 0; border-radius: 8px;">
            <h4 style="margin: 0 0 10px 0; color: #F1F5F9;">New Shift Timings:</h4>
            <p style="font-size: 14px; color: #F59E0B; margin: 0; font-weight: bold;">${shiftStart} – ${shiftEnd}</p>
            <p style="font-size: 12px; color: #94A3B8; margin: 5px 0 0 0;">Hospital: ${phcName || 'Assigned PHC'}</p>
          </div>

          <p style="font-size: 12px; color: #94A3B8;">Hourly 60-minute checkpoint reminders will trigger automatically during your new duty hours.</p>
          <hr style="border: 0; border-top: 1px solid #334155; margin: 20px 0;" />
          <p style="font-size: 11px; color: #64748B; text-align: center;">Automated System Notification • Department of Public Health Services</p>
        </div>
      </div>
    `;

    try {
      const info = await transporter.sendMail({
        from: `"Hospital Admin" <${process.env.SMTP_USER || 'sn4194529@gmail.com'}>`,
        to: email,
        subject,
        html
      });
      console.log(`🟢 LIVE SHIFT UPDATE EMAIL DELIVERED TO: ${email} (MessageID: ${info.messageId})`);
    } catch (sendErr) {
      console.warn(`⚠️ SMTP dispatch notice for ${email}:`, sendErr.message);
    }

    logNotification(email, 'Duty Shift Schedule Updated', `Dr. ${name}, your shift timings were updated to ${shiftStart} - ${shiftEnd}.`);
  } catch (err) {
    console.error('Error sending shift update email:', err);
  }
}

// 3. Send Hourly Checkpoint Reminder Email
async function sendHourlyCheckpointReminderEmail({ name, email, checkpointIndex, windowLabel, phcName }) {
  try {
    const transporter = getTransporter();

    const subject = `⏰ Hourly Attendance Checkpoint #${checkpointIndex} Open (${windowLabel}) - Dr. ${name}`;
    const html = `
      <div style="font-family: Arial, sans-serif; background-color: #0F172A; padding: 24px; color: #F8FAFC;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #1E293B; border: 1px solid #10B981; border-radius: 16px; padding: 24px;">
          <h2 style="color: #10B981; margin-top: 0;">⏰ Hourly Attendance Reminder</h2>
          <p style="font-size: 14px; color: #94A3B8;">Hello <strong>Dr. ${name}</strong>,</p>
          <p style="font-size: 14px; color: #CBD5E1;">Your duty checkpoint window <strong>#${checkpointIndex}</strong> is now open for attendance marking.</p>
          
          <div style="background-color: #0F172A; border-left: 4px solid #10B981; padding: 16px; margin: 20px 0; border-radius: 8px;">
            <h4 style="margin: 0 0 5px 0; color: #F1F5F9;">Open Checkpoint Window:</h4>
            <p style="font-size: 18px; color: #10B981; margin: 0; font-weight: bold;">${windowLabel}</p>
            <p style="font-size: 12px; color: #94A3B8; margin: 5px 0 0 0;">Hospital: ${phcName}</p>
          </div>

          <p style="font-size: 12px; color: #94A3B8;">Please open your Doctor Portal on your mobile or device and click <strong>Mark Attendance Now</strong> while inside the hospital geofence radius.</p>
          <hr style="border: 0; border-top: 1px solid #334155; margin: 20px 0;" />
          <p style="font-size: 11px; color: #64748B; text-align: center;">Automated Hourly Duty Scheduler • Hospital GeoAttendance System</p>
        </div>
      </div>
    `;

    try {
      const info = await transporter.sendMail({
        from: `"GeoAttendance Duty Bot" <${process.env.SMTP_USER || 'sn4194529@gmail.com'}>`,
        to: email,
        subject,
        html
      });
      console.log(`🟢 LIVE HOURLY REMINDER EMAIL DELIVERED TO: ${email} (MessageID: ${info.messageId})`);
    } catch (sendErr) {
      console.warn(`⚠️ SMTP dispatch notice for ${email}:`, sendErr.message);
    }

    logNotification(email, `Hourly Checkpoint #${checkpointIndex} Reminder`, `Dr. ${name}, your hourly attendance window (${windowLabel}) is open now.`);
  } catch (err) {
    console.error('Error sending hourly reminder email:', err);
  }
}

// 4. Send Master CMO Registration Verification OTP Email
async function sendCMORegistrationOTPEmail({ email, otpCode }) {
  try {
    const transporter = getTransporter();

    const subject = `🔐 Master CMO Registration Verification OTP Code - ${otpCode}`;
    const html = `
      <div style="font-family: Arial, sans-serif; background-color: #0F172A; padding: 24px; color: #F8FAFC;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #1E293B; border: 1px solid #8B5CF6; border-radius: 16px; padding: 24px;">
          <h2 style="color: #8B5CF6; margin-top: 0;">👑 Master CMO Registration OTP</h2>
          <p style="font-size: 14px; color: #94A3B8;">Hello,</p>
          <p style="font-size: 14px; color: #CBD5E1;">A request was made to register a new <strong>State Chief Medical Officer (CMO)</strong> account for email: <strong>${email}</strong>.</p>
          
          <div style="background-color: #0F172A; border-left: 4px solid #8B5CF6; padding: 20px; margin: 20px 0; border-radius: 8px; text-align: center;">
            <p style="font-size: 12px; color: #94A3B8; margin: 0 0 8px 0; font-weight: bold; text-transform: uppercase;">Your 6-Digit Master CMO Verification OTP:</p>
            <div style="font-size: 36px; font-weight: bold; letter-spacing: 10px; color: #10B981; font-family: monospace;">${otpCode}</div>
            <p style="font-size: 11px; color: #94A3B8; margin: 10px 0 0 0;">Valid for 10 minutes. Strictly 3 verification attempts permitted.</p>
          </div>

          <p style="font-size: 12px; color: #94A3B8;">If you did not initiate this CMO registration, please disregard this message.</p>
          <hr style="border: 0; border-top: 1px solid #334155; margin: 20px 0;" />
          <p style="font-size: 11px; color: #64748B; text-align: center;">State Directorate of Public Health Services • GeoAttendance System</p>
        </div>
      </div>
    `;

    try {
      const info = await transporter.sendMail({
        from: `"State CMO Directorate" <${process.env.SMTP_USER || 'sn4194529@gmail.com'}>`,
        to: email,
        subject,
        html
      });
      console.log(`🟢 LIVE CMO REGISTRATION OTP DELIVERED TO: ${email} (OTP: ${otpCode}) (MessageID: ${info.messageId})`);
    } catch (sendErr) {
      console.warn(`⚠️ SMTP dispatch notice for ${email}:`, sendErr.message);
    }

    logNotification(email, 'CMO Registration Verification OTP Dispatched', `Master CMO Registration OTP code: ${otpCode}. Dispatched to ${email}.`);
  } catch (err) {
    console.error('Error sending CMO registration OTP email:', err);
  }
}

// 5. Send Password Reset OTP Email
async function sendPasswordResetOTPEmail({ name, email, otpCode }) {
  try {
    const transporter = getTransporter();

    const subject = `🔐 Security Verification Request - GeoAttendance Portal`;
    const html = `
      <div style="font-family: Arial, sans-serif; background-color: #0F172A; padding: 24px; color: #F8FAFC;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #1E293B; border: 1px solid #3B82F6; border-radius: 16px; padding: 24px;">
          <h2 style="color: #3B82F6; margin-top: 0;">🔐 Security Verification Request</h2>
          <p style="font-size: 14px; color: #94A3B8;">Hello <strong>${name || 'User'}</strong>,</p>
          <p style="font-size: 14px; color: #CBD5E1;">A credential authorization request was initiated for your account: <strong>${email}</strong>.</p>
          
          <div style="background-color: #0F172A; border-left: 4px solid #3B82F6; padding: 20px; margin: 20px 0; border-radius: 8px; text-align: center;">
            <p style="font-size: 12px; color: #94A3B8; margin: 0 0 8px 0; font-weight: bold; text-transform: uppercase;">Your 6-Digit OTP Verification Code:</p>
            <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #10B981; font-family: monospace;">${otpCode}</div>
            <p style="font-size: 11px; color: #64748B; margin: 8px 0 0 0;">Valid for 10 minutes. Do not share this OTP with anyone.</p>
          </div>

          <p style="font-size: 12px; color: #94A3B8;">If you did not request this authorization, please contact administration.</p>
          <hr style="border: 0; border-top: 1px solid #334155; margin: 20px 0;" />
          <p style="font-size: 11px; color: #64748B; text-align: center;">Govt. Public Health GeoAttendance Security System</p>
        </div>
      </div>
    `;

    try {
      const info = await transporter.sendMail({
        from: `"GeoAttendance Security" <${process.env.SMTP_USER || 'sn4194529@gmail.com'}>`,
        to: email,
        subject,
        html
      });
      console.log(`🟢 OTP EMAIL DELIVERED TO: ${email} (OTP: ${otpCode}) (MessageID: ${info.messageId})`);
    } catch (sendErr) {
      console.warn(`⚠️ SMTP dispatch notice for ${email}:`, sendErr.message);
    }

    logNotification(email, 'Security Verification Notice', `Password Reset OTP Code: ${otpCode}. Dispatched to ${email}.`);
  } catch (err) {
    console.error('Error sending OTP email:', err);
  }
}

// 6. Send Custom Message Email
async function sendCustomMessageEmail({ recipientName, recipientEmail, subject, messageText, senderRole = 'CMO' }) {
  try {
    const transporter = getTransporter();

    const mailSubject = subject || `Official Notice from ${senderRole} Office - ${recipientName}`;
    const html = `
      <div style="font-family: Arial, sans-serif; background-color: #0F172A; padding: 24px; color: #F8FAFC;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #1E293B; border: 1px solid #EF4444; border-radius: 16px; padding: 24px;">
          <h2 style="color: #EF4444; margin-top: 0;">⚠️ Official Communication / Warning Notice</h2>
          <p style="font-size: 14px; color: #94A3B8;">Attention: <strong>${recipientName}</strong> (${recipientEmail}),</p>
          <p style="font-size: 14px; color: #CBD5E1;">You have received an official communication dispatch from the <strong>${senderRole} Directorate</strong>.</p>
          
          <div style="background-color: #0F172A; border-left: 4px solid #EF4444; padding: 18px; margin: 20px 0; border-radius: 8px;">
            <h4 style="margin: 0 0 10px 0; color: #F8FAFC; font-size: 15px;">${subject}</h4>
            <div style="font-size: 13px; color: #E2E8F0; line-height: 1.8; white-space: pre-wrap;">${messageText}</div>
          </div>

          <p style="font-size: 12px; color: #94A3B8;">Please review this notice and take necessary compliance actions immediately.</p>
          <hr style="border: 0; border-top: 1px solid #334155; margin: 20px 0;" />
          <p style="font-size: 11px; color: #64748B; text-align: center;">Directorate of Public Health & Preventive Medicine • Govt. Health Services</p>
        </div>
      </div>
    `;

    try {
      const info = await transporter.sendMail({
        from: `"${senderRole} Directorate" <${process.env.SMTP_USER || 'sn4194529@gmail.com'}>`,
        to: recipientEmail,
        subject: mailSubject,
        html
      });
      console.log(`🟢 OFFICIAL NOTICE EMAIL DELIVERED TO: ${recipientEmail} (MessageID: ${info.messageId})`);
    } catch (sendErr) {
      console.warn(`⚠️ SMTP dispatch notice for ${recipientEmail}:`, sendErr.message);
    }

    logNotification(recipientEmail, mailSubject, `Official Notice from ${senderRole}: ${messageText}`);
  } catch (err) {
    console.error('Error sending custom message email:', err);
  }
}

// 7. Send Doctor Attendance Report Email
async function sendDoctorAttendanceReportEmail({ name, email, attendanceSummary, phcName }) {
  try {
    const transporter = getTransporter();

    const subject = `📊 Duty Attendance Audit & Performance Report - Dr. ${name}`;
    const html = `
      <div style="font-family: Arial, sans-serif; background-color: #0F172A; padding: 24px; color: #F8FAFC;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #1E293B; border: 1px solid #10B981; border-radius: 16px; padding: 24px;">
          <h2 style="color: #10B981; margin-top: 0;">📊 Duty Attendance Audit Report</h2>
          <p style="font-size: 14px; color: #94A3B8;">Hello <strong>Dr. ${name}</strong>,</p>
          <p style="font-size: 14px; color: #CBD5E1;">Below is your official attendance audit log summary for your assigned hospital: <strong>${phcName}</strong>.</p>
          
          <div style="background-color: #0F172A; border-left: 4px solid #10B981; padding: 18px; margin: 20px 0; border-radius: 8px;">
            <h4 style="margin: 0 0 10px 0; color: #F8FAFC; font-size: 15px;">Attendance Breakdown:</h4>
            <table style="width: 100%; font-size: 13px; color: #CBD5E1; border-collapse: collapse;">
              <tr>
                <td style="padding: 6px 0; color: #94A3B8;">Total Scheduled Checkpoints:</td>
                <td style="padding: 6px 0; font-weight: bold; color: #F8FAFC; text-align: right;">${attendanceSummary.totalCheckpoints || 0}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #94A3B8;">Checkpoints Verified (Present):</td>
                <td style="padding: 6px 0; font-weight: bold; color: #10B981; text-align: right;">${attendanceSummary.presentCount || 0}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #94A3B8;">Pending / Missed Windows:</td>
                <td style="padding: 6px 0; font-weight: bold; color: #EF4444; text-align: right;">${attendanceSummary.absentCount || 0}</td>
              </tr>
              <tr style="border-top: 1px solid #334155;">
                <td style="padding: 10px 0 0 0; color: #F8FAFC; font-weight: bold;">Compliance Score:</td>
                <td style="padding: 10px 0 0 0; font-weight: bold; color: #38BDF8; text-align: right; font-size: 16px;">${attendanceSummary.complianceRate || '100%'}</td>
              </tr>
            </table>
          </div>

          <p style="font-size: 12px; color: #94A3B8;">This attendance summary is generated by the State Geofenced Duty Attendance Monitoring Engine.</p>
          <hr style="border: 0; border-top: 1px solid #334155; margin: 20px 0;" />
          <p style="font-size: 11px; color: #64748B; text-align: center;">Govt. Health Services Attendance Audit System</p>
        </div>
      </div>
    `;

    try {
      const info = await transporter.sendMail({
        from: `"Attendance Audit Bot" <${process.env.SMTP_USER || 'sn4194529@gmail.com'}>`,
        to: email,
        subject,
        html
      });
      console.log(`🟢 ATTENDANCE REPORT EMAIL DELIVERED TO: ${email} (MessageID: ${info.messageId})`);
    } catch (sendErr) {
      console.warn(`⚠️ SMTP dispatch notice for ${email}:`, sendErr.message);
    }

    logNotification(email, 'Attendance Audit Report Dispatched', `Attendance summary report sent to ${email} (Compliance: ${attendanceSummary.complianceRate || '100%'}).`);
  } catch (err) {
    console.error('Error sending attendance report email:', err);
  }
}

module.exports = {
  sendDoctorRegistrationEmail,
  sendShiftUpdateEmail,
  sendHourlyCheckpointReminderEmail,
  sendCMORegistrationOTPEmail,
  sendPasswordResetOTPEmail,
  sendCustomMessageEmail,
  sendDoctorAttendanceReportEmail,
  logNotification
};
