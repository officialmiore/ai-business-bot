// middleware/notifications.js
import nodemailer from "nodemailer";
export async function sendNotification({ to, subject, text }){
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  if(!user || !pass) throw new Error("EMAIL_USER/EMAIL_PASS not configured");
  const transporter = nodemailer.createTransport({ service: "gmail", auth: { user, pass }});
  await transporter.sendMail({ from: user, to, subject, text });
}
