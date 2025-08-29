// netlify/functions/decline-payment.js
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // 1. Authenticate the request and verify admin status
  const { authorization } = event.headers;
  if (!authorization || !authorization.startsWith('Bearer ')) {
    return { statusCode: 401, body: 'Unauthorized' };
  }

  const token = authorization.split('Bearer ')[1];
  let decodedToken;
  try {
    decodedToken = await admin.auth().verifyIdToken(token);
  } catch (error) {
    return { statusCode: 403, body: 'Invalid token.' };
  }

  const userDoc = await db.collection('users').doc(decodedToken.uid).get();
  if (!userDoc.exists || !userDoc.data().isAdmin) {
    return { statusCode: 403, body: 'Forbidden: Admin access required.' };
  }

  // 2. Get data from the request
  const { investmentId, reason } = JSON.parse(event.body);
  if (!investmentId || !reason) {
    return { statusCode: 400, body: 'Investment ID and reason are required.' };
  }

  // 3. Perform the database updates in a transaction
  try {
    const investmentRef = db.collection('investments').doc(investmentId);

    await db.runTransaction(async (transaction) => {
      const investmentDoc = await transaction.get(investmentRef);
      if (!investmentDoc.exists) {
        throw new Error('Investment not found.');
      }

      const investmentData = investmentDoc.data();
      if (investmentData.status !== 'pending verification') {
          throw new Error('This investment is not pending verification and cannot be declined.');
      }
      
      const propertyId = investmentData.propertyId;
      const propertyRef = db.collection('properties').doc(propertyId);

      // Update investment status
      transaction.update(investmentRef, {
        status: 'declined',
        declineReason: reason,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Update property status back to available
      transaction.update(propertyRef, {
        status: 'available',
        soldTo: admin.firestore.FieldValue.delete(),
        soldAt: admin.firestore.FieldValue.delete(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Payment declined successfully and property is available again.' }),
    };

  } catch (error) {
    console.error('Error declining payment:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: error.message || 'An error occurred while declining the payment.' }),
    };
  }
};
