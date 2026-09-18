let nodemailer = null;
try {
  nodemailer = require('nodemailer');
} catch (e) {
  // Fallback engine if nodemailer package is uninstalled
}

const { memoryStore, saveMemoryStoreToDisk } = require('../config/db');

// Helper to send email with dual-port fallback (Port 465 SSL -> Port 587 TLS)
async function sendMailWithFallback({ from, to, subject, html }) {
  const user = (process.env.SMTP_USER || 'sn4194529@gmail.com').trim();
  const rawPass = process.env.SMTP_PASS || 'hyhh ushk ykiz obxx';
  const pass = rawPass.replace(/\s+/g, '');

  if (!nodemailer) {
    console.log(`=======================================================`);
    console.log(`📧 [FALLBACK EMAIL DISPATCHED TO]: ${to}`);
    console.log(`📌 [SUBJECT]: ${subject}`);
    console.log(`=======================================================`);
    return { messageId: 'fallback_' + Date.now() };
  }

  // 1. Try SSL Port 465
  try {
    const transporter465 = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user, pass },
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 8000,
      tls: { rejectUnauthorized: false }
    });

    const info = await transporter465.sendMail({
      from: from || `"Govt. Health Services" <${user}>`,
      to,
      subject,
      html
    });
    console.log(`🟢 LIVE EMAIL DISPATCHED (Port 465) TO: ${to} (MessageID: ${info.messageId})`);
    return info;
  } catch (err465) {
    console.warn(`⚠️ Port 465 dispatch notice for ${to}, trying Port 587 TLS fallback...`, err465.message);
  }

  // 2. Try TLS Port 587 Fallback
  try {
    const transporter587 = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: { user, pass },
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 8000,
      tls: { rejectUnauthorized: false }
    });

    const info = await transporter587.sendMail({
      from: from || `"Govt. Health Services" <${user}>`,
      to,
      subject,
      html
    });
    console.log(`🟢 LIVE EMAIL DISPATCHED (Port 587) TO: ${to} (MessageID: ${info.messageId})`);
    return info;
  } catch (err587) {
    console.error(`❌ Port 587 dispatch failed for ${to}:`, err587.message);
    throw err587;
  }
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
    const user = (process.env.SMTP_USER || 'sn4194529@gmail.com').trim();
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

    await sendMailWithFallback({
      from: `"Govt. Health Services" <${user}>`,
      to: email,
      subject,
      html
    });

    logNotification(email, 'Account Registration Notice', `Welcome Dr. ${name}! Your medical doctor account was registered at ${phcName}. Your assigned duty shift is ${shiftStart} - ${shiftEnd}. Account credentials: Username=${username}, Password=${password}`);
  } catch (err) {
    console.error('Error sending registration email:', err);
  }
}

// 2. Send Shift Update Email
async function sendShiftUpdateEmail({ name, email, shiftStart, shiftEnd, phcName }) {
  try {
    const user = (process.env.SMTP_USER || 'sn4194529@gmail.com').trim();
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

          <p style="font-size: 12px; color: #94A3B8;">Automatic reminders will be sent to your email 5 minutes before every hourly duty checkpoint.</p>
          <hr style="border: 0; border-top: 1px solid #334155; margin: 20px 0;" />
          <p style="font-size: 11px; color: #64748B; text-align: center;">Automated System Notification • Department of Public Health Services</p>
        </div>
      </div>
    `;

    await sendMailWithFallback({
      from: `"Hospital Admin" <${user}>`,
      to: email,
      subject,
      html
    });

    logNotification(email, 'Duty Shift Schedule Updated', `Dr. ${name}, your shift timings were updated to ${shiftStart} - ${shiftEnd}.`);
  } catch (err) {
    console.error('Error sending shift update email:', err);
  }
}

// 3. Send 5-Minute Pre-Checkpoint Duty Reminder Email (Server-Side Backend Automated)
async function sendHourlyCheckpointReminderEmail({ name, email, checkpointTime, reminderTime, dutyDate, shiftLabel, phcName }) {
  try {
    const user = (process.env.SMTP_USER || 'sn4194529@gmail.com').trim();
    const subject = `⏰ Duty Checkpoint Reminder: ${checkpointTime} Window Approaching (Dr. ${name})`;
    const html = `
      <div style="font-family: Arial, sans-serif; background-color: #0F172A; padding: 24px; color: #F8FAFC;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #1E293B; border: 1px solid #10B981; border-radius: 16px; padding: 24px;">
          <h2 style="color: #10B981; margin-top: 0;">⏰ Hourly Attendance Checkpoint Reminder</h2>
          <p style="font-size: 14px; color: #94A3B8;">Hello <strong>Dr. ${name}</strong>,</p>
          <p style="font-size: 14px; color: #CBD5E1;">Your hourly duty attendance checkpoint is approaching at <strong style="color: #10B981;">${checkpointTime}</strong>.</p>
          
          <div style="background-color: #0F172A; border-left: 4px solid #10B981; padding: 18px; margin: 20px 0; border-radius: 8px;">
            <h4 style="margin: 0 0 10px 0; color: #F1F5F9; font-size: 14px;">Duty Checkpoint Details:</h4>
            <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #94A3B8; line-height: 1.8;">
              <li><strong>Hospital PHC:</strong> <span style="color: #F8FAFC;">${phcName || 'Primary Health Center'}</span></li>
              <li><strong>Duty Date:</strong> <span style="color: #F8FAFC;">${dutyDate || 'Today'}</span></li>
              <li><strong>Duty Shift Window:</strong> <span style="color: #F59E0B; font-weight: bold;">${shiftLabel || 'Scheduled Shift'}</span></li>
              <li><strong>Upcoming Checkpoint:</strong> <span style="color: #10B981; font-weight: bold; font-size: 15px;">${checkpointTime}</span></li>
              <li><strong>Reminder Sent At:</strong> <span style="color: #38BDF8;">${reminderTime || '5 minutes before checkpoint'}</span></li>
            </ul>
          </div>

          <p style="font-size: 13px; color: #CBD5E1; line-height: 1.6;">
            <strong>Action Required:</strong> Please open the Hospital Attendance System and complete your biometric face scan & geofence verification to mark attendance for this interval.
          </p>

          <hr style="border: 0; border-top: 1px solid #334155; margin: 20px 0;" />
          <p style="font-size: 11px; color: #64748B; text-align: center;">Automated Production Backend Scheduler • Department of Public Health Services</p>
        </div>
      </div>
    `;

    await sendMailWithFallback({
      from: `"GeoAttendance Duty Scheduler" <${user}>`,
      to: email,
      subject,
      html
    });

    logNotification(email, `Duty Checkpoint Reminder: ${checkpointTime}`, `Dr. ${name}, your hourly duty checkpoint at ${checkpointTime} opens in 5 minutes (Reminder sent at ${reminderTime}).`);
  } catch (err) {
    console.error('Error sending duty reminder email:', err);
  }
}

// 4. Send Master CMO Registration Verification OTP Email
async function sendCMORegistrationOTPEmail({ email, otpCode }) {
  try {
    const user = (process.env.SMTP_USER || 'sn4194529@gmail.com').trim();
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

    await sendMailWithFallback({
      from: `"State CMO Directorate" <${user}>`,
      to: email,
      subject,
      html
    });

    logNotification(email, 'CMO Registration Verification OTP Dispatched', `Master CMO Registration OTP code: ${otpCode}. Dispatched to ${email}.`);
  } catch (err) {
    console.error('Error sending CMO registration OTP email:', err);
  }
}

// 5. Send Password Reset / Security Verification OTP Email
async function sendPasswordResetOTPEmail({ name, email, otpCode }) {
  try {
    const user = (process.env.SMTP_USER || 'sn4194529@gmail.com').trim();
    const subject = `🔐 Security Verification OTP Code: ${otpCode} - GeoAttendance Portal`;
    const html = `
      <div style="font-family: Arial, sans-serif; background-color: #0F172A; padding: 24px; color: #F8FAFC;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #1E293B; border: 1px solid #3B82F6; border-radius: 16px; padding: 24px;">
          <h2 style="color: #3B82F6; margin-top: 0;">🔐 Security Verification Request</h2>
          <p style="font-size: 14px; color: #94A3B8;">Hello <strong>${name || 'User'}</strong>,</p>
          <p style="font-size: 14px; color: #CBD5E1;">A credential authorization request was initiated for account: <strong>${email}</strong>.</p>
          
          <div style="background-color: #0F172A; border-left: 4px solid #3B82F6; padding: 20px; margin: 20px 0; border-radius: 8px; text-align: center;">
            <p style="font-size: 12px; color: #94A3B8; margin: 0 0 8px 0; font-weight: bold; text-transform: uppercase;">Your 6-Digit Verification OTP Code:</p>
            <div style="font-size: 34px; font-weight: bold; letter-spacing: 8px; color: #10B981; font-family: monospace;">${otpCode}</div>
            <p style="font-size: 11px; color: #64748B; margin: 8px 0 0 0;">Valid for 10 minutes. Do not share this OTP with anyone.</p>
          </div>

          <p style="font-size: 12px; color: #94A3B8;">If you did not request this authorization, please contact administration immediately.</p>
          <hr style="border: 0; border-top: 1px solid #334155; margin: 20px 0;" />
          <p style="font-size: 11px; color: #64748B; text-align: center;">Govt. Public Health GeoAttendance Security System</p>
        </div>
      </div>
    `;

    await sendMailWithFallback({
      from: `"GeoAttendance Security" <${user}>`,
      to: email,
      subject,
      html
    });

    logNotification(email, 'Security Verification Notice', `Password Reset OTP Code: ${otpCode}. Dispatched to ${email}.`);
  } catch (err) {
    console.error('Error sending OTP email:', err);
  }
}

// 6. Send Custom Message Email
async function sendCustomMessageEmail({ recipientName, recipientEmail, subject, messageText, senderRole = 'CMO' }) {
  try {
    const user = (process.env.SMTP_USER || 'sn4194529@gmail.com').trim();
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

    await sendMailWithFallback({
      from: `"${senderRole} Directorate" <${user}>`,
      to: recipientEmail,
      subject: mailSubject,
      html
    });

    logNotification(recipientEmail, mailSubject, `Official Notice from ${senderRole}: ${messageText}`);
  } catch (err) {
    console.error('Error sending custom message email:', err);
  }
}

// 7. Send Doctor Attendance Report Email
async function sendDoctorAttendanceReportEmail({ name, email, attendanceSummary, phcName }) {
  try {
    const user = (process.env.SMTP_USER || 'sn4194529@gmail.com').trim();
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

    await sendMailWithFallback({
      from: `"Attendance Audit Bot" <${user}>`,
      to: email,
      subject,
      html
    });

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
