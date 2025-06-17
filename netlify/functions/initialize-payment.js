const axios = require('axios');

exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { email, amount } = JSON.parse(event.body);
  const secretKey = process.env.PAYSTACK_SECRET_KEY;

  if (!email || !amount) {
    return { statusCode: 400, body: 'Email and amount are required.' };
  }

  const paystackUrl = 'https://api.paystack.co/transaction/initialize';

  try {
    const response = await axios.post(
      paystackUrl,
      {
        email: email,
        amount: amount * 100, // Paystack requires amount in kobo
      },
      {
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return {
      statusCode: 200,
      body: JSON.stringify(response.data),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'An error occurred while initializing the payment.' }),
    };
  }
};