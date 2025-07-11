// /netlify/functions/send-notification.js

// Import the Resend library
const { Resend } = require("resend");

// Initialize Resend with the API key from your Netlify environment variables
const resend = new Resend(process.env.RESEND_API_KEY);

exports.handler = async function (event) {
  // Only allow POST requests
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    // Parse the data sent from the frontend
    const { to, subject, html } = JSON.parse(event.body);

    // Send the email using Resend
    await resend.emails.send({
      from: "NaijaLand <notifications@naijaland.site>", // IMPORTANT: Replace with your verified domain in Resend
      to: to,
      subject: subject,
      html: html,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Email sent successfully" }),
    };
  } catch (error) {
    console.error("Error sending email:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to send email" }),
    };
  }
};
