// /netlify/functions/send-verification-code.js

const admin = require("firebase-admin");
const { Resend } = require("resend");

// --- Initialize Resend ---
// This uses the RESEND_API_KEY from your Netlify environment variables.
const resend = new Resend(process.env.RESEND_API_KEY);

// --- Initialize Firebase Admin ---
// This ensures we only initialize the app once.
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
    ),
  });
}
const db = admin.firestore();

exports.handler = async (event) => {
  // Only allow POST requests
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    let email;
    try {
      // ✅ The fix: Wrap JSON.parse in a nested try/catch to handle malformed JSON.
      const parsedBody = JSON.parse(event.body);
      email = parsedBody.email;
    } catch (parseError) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: "Invalid JSON format in request body.",
        }),
      };
    }

    if (!email) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Email is required." }),
      };
    } // 1. Generate a random 6-digit code.

    const code = Math.floor(100000 + Math.random() * 900000).toString(); // 2. Set an expiration time of 10 minutes from now.

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 3. Save the code and its expiration date to Firestore.
    // We use the user's email as the document ID for easy lookup.

    const verificationRef = db.collection("verifications").doc(email);
    await verificationRef.set({
      code: code,
      expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
    }); // 4. Send the email using Resend.

    await resend.emails.send({
      from: "NaijaLand <notifications@naijaland.site>", // This must be a verified domain in your Resend account.
      to: email,
      subject: "Your NaijaLand Verification Code",
      html: `
        <div style="font-family: sans-serif; text-align: center; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; max-width: 400px; margin: auto;">
            <h2 style="color: #10b981;">Welcome to NaijaLand!</h2>
            <p style="color: #333;">Your one-time verification code is:</p>
            <p style="font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0; background-color: #f3f4f6; padding: 10px 15px; border-radius: 5px; color: #1f2937;">
                ${code}
            </p>
            <p style="font-size: 14px; color: #555;">This code will expire in 10 minutes.</p>
        </div>
      `,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Verification code sent successfully." }),
    };
  } catch (error) {
    console.error("Error in send-verification-code function:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "An error occurred while sending the code.",
      }),
    };
  }
};
