import * as functions from "firebase-functions";
import * as nodemailer from "nodemailer";

// Get Gmail credentials from Firebase config
const gmailEmail = functions.config().gmail.email;
const gmailPassword = functions.config().gmail.password;

// Create reusable transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: gmailEmail,
    pass: gmailPassword,
  },
});

export const sendVerificationEmail = functions.https.onCall(
  async (data, context) => {
    const { email, code } = data;

    const mailOptions = {
      from: `"TimeFly" <${gmailEmail}>`,
      to: email,
      subject: "Your TimeFly Verification Code",
      text: `Your verification code is: ${code}`,
      html: `<p>Your verification code is: <b>${code}</b></p>`,
    };

    try {
      await transporter.sendMail(mailOptions);
      return { success: true };
    } catch (error) {
      console.error("Error sending email:", error);
      throw new functions.https.HttpsError(
        "internal",
        "Unable to send verification email."
      );
    }
  }
);
