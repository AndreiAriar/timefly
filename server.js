// server.js - Backend notification service
const express = require('express');
const cors = require('cors');
const sgMail = require('@sendgrid/mail');
const twilio = require('twilio');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Initialize services
sgMail.setApiKey(process.env.SENDGRID_API_KEY);
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// Email notification endpoint
app.post('/api/send-email', async (req, res) => {
  try {
    const { to, subject, message, appointmentData } = req.body;

    const msg = {
      to: to,
      from: process.env.FROM_EMAIL, // Your verified sender email
      subject: subject,
      text: message,
      html: generateEmailTemplate(subject, message, appointmentData)
    };

    await sgMail.send(msg);
    console.log(`Email sent to ${to}`);
    res.json({ success: true, message: 'Email sent successfully' });
  } catch (error) {
    console.error('Email error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// SMS notification endpoint
app.post('/api/send-sms', async (req, res) => {
  try {
    const { to, message } = req.body;

    const result = await twilioClient.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER, // Your Twilio phone number
      to: to
    });

    console.log(`SMS sent to ${to}, SID: ${result.sid}`);
    res.json({ success: true, message: 'SMS sent successfully', sid: result.sid });
  } catch (error) {
    console.error('SMS error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Combined notification endpoint
app.post('/api/notifications', async (req, res) => {
  try {
    const { email, phone, subject, message, appointmentData } = req.body;
    const results = { email: null, sms: null };

    // Send email if provided
    if (email) {
      try {
        const emailMsg = {
          to: email,
          from: process.env.FROM_EMAIL,
          subject: subject,
          text: message,
          html: generateEmailTemplate(subject, message, appointmentData)
        };
        await sgMail.send(emailMsg);
        results.email = { success: true, message: 'Email sent successfully' };
      } catch (emailError) {
        results.email = { success: false, error: emailError.message };
      }
    }

    // Send SMS if provided
    if (phone) {
      try {
        const smsResult = await twilioClient.messages.create({
          body: message,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: phone
        });
        results.sms = { success: true, message: 'SMS sent successfully', sid: smsResult.sid };
      } catch (smsError) {
        results.sms = { success: false, error: smsError.message };
      }
    }

    res.json({ success: true, results });
  } catch (error) {
    console.error('Notification error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Email template generator
function generateEmailTemplate(subject, message, appointmentData) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #4f46e5; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9fafb; }
        .appointment-details { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        .button { display: inline-block; padding: 12px 24px; background: #4f46e5; color: white; text-decoration: none; border-radius: 6px; margin: 10px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>TimeFly Clinic</h1>
          <h2>${subject}</h2>
        </div>
        <div class="content">
          <p>${message}</p>
          ${appointmentData ? `
            <div class="appointment-details">
              <h3>Appointment Details:</h3>
              <p><strong>Patient:</strong> ${appointmentData.name}</p>
              <p><strong>Doctor:</strong> ${appointmentData.doctor}</p>
              <p><strong>Date:</strong> ${appointmentData.date}</p>
              <p><strong>Time:</strong> ${appointmentData.time}</p>
              <p><strong>Type:</strong> ${appointmentData.type}</p>
              ${appointmentData.queueNumber ? `<p><strong>Queue Number:</strong> #${appointmentData.queueNumber}</p>` : ''}
            </div>
          ` : ''}
          <p>If you need to reschedule or have any questions, please contact us at:</p>
          <p>Phone: (555) 123-4567<br>Email: info@timefly-clinic.com</p>
        </div>
        <div class="footer">
          <p>&copy; 2024 TimeFly Clinic. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Notification service running on port ${PORT}`);
});