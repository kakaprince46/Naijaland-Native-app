// C:\Users\Hp\Downloads\New project\landproperties\netlify\functions\verify-and-register.js

const admin = require("firebase-admin");
const { Resend } = require("resend");

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
    ),
  });
}
const db = admin.firestore();
const auth = admin.auth();

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  let parsedBody;
  try {
    parsedBody = JSON.parse(event.body);
  } catch (error) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: "Invalid JSON format in request body.",
      }),
    };
  }

  try {
    const { name, email, phone, location, password, code } = parsedBody;

    // 1. Verify the code
    const verificationRef = db.collection("verifications").doc(email);
    const verificationDoc = await verificationRef.get();

    if (!verificationDoc.exists) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: "Invalid verification code or email.",
        }),
      };
    }

    const verificationData = verificationDoc.data();
    const isExpired = new Date() > verificationData.expiresAt.toDate();

    if (isExpired) {
      await verificationRef.delete();
      return {
        statusCode: 400,
        body: JSON.stringify({
          message:
            "Your verification code has expired. Please request a new one.",
        }),
      };
    }

    if (verificationData.code !== code) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: "The verification code is incorrect.",
        }),
      };
    }

    // 2. If code is valid, create user in Firebase Auth
    const userRecord = await auth.createUser({
      email,
      password,
      displayName: name,
    });

    // 3. Add user data to Firestore
    await db.collection("users").doc(userRecord.uid).set({
      name,
      phone,
      location,
      email,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      isAdmin: false,
      acceptedTerms: true,
    });

    // 4. Delete the verification document
    await verificationRef.delete();

    // 5. Send admin notification email
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: "NaijaLand <notifications@naijaland.site>",
      to: "kakaprince46@gmail.com",
      subject: " New User Registration on NaijaLand!",
      html: `<h1>New User Alert!</h1><p>A new user has just registered on the NaijaLand platform.</p><ul><li><strong>Name:</strong> ${name}</li><li><strong>Email:</strong> ${email}</li><li><strong>Phone:</strong> ${phone || "Not provided"}</li><li><strong>Location:</strong> ${location || "Not provided"}</li></ul>`,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Registration successful!",
        uid: userRecord.uid,
      }),
    };
  } catch (error) {
    console.error("Error in verify-and-register function:", error);
    let message = "An error occurred during registration.";
    if (error.code === "auth/email-already-in-use") {
      message = "Email address is already in use.";
    }
    return {
      statusCode: 500,
      body: JSON.stringify({ message }),
    };
  }
};
