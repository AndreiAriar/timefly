// pages/api/notifications.js
import { Resend } from 'resend';

const resend = new Resend('re_your_api_key_here'); // Replace with your key
const FROM_EMAIL = 'staff@yourclinic.com'; // Use verified domain or resend domain

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, phone, subject, message } = req.body;

  try {
    // Send Email
    if (email) {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: email,
        subject,
        text: message,
        html: `<p>${message}</p><br><small>Sent via TimeFly Clinic Staff System</small>`
      });
    }

    // You can log SMS here for now (we'll handle SMS in Step 2)
    if (phone) {
      console.log(`SMS would be sent to ${phone}: ${message}`);
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error sending notification:', error);
    res.status(500).json({ error: 'Failed to send notification' });
  }
}