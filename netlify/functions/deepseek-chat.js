// [File: /netlify/functions/deepseek-chat.js]

// The knowledge base for the chatbot, derived from your document.
const naijaLandKnowledge = `
Company Name: NaijaLand
Parent Company: Prince Kaka Global Resources
Industry: PropTech (Property Technology)
Location: Awka, Anambra State, Nigeria
Mission: To simplify digital land transactions and make land ownership accessible, secure, and straightforward in Nigeria.

Core Offerings:
- Verified and affordable land properties in Nigeria.
- Digital land transactions with secure payment gateways (Paystack or UBA bank).
- Investment management services.
- Property documentation services (Sales Receipt, Contract of Sale, Title Documents, Deed of Conveyance, Registered Survey Plan, Irrevocable Power of Attorney). Documents are delivered within 30 business days after payment.

Key Policies:
- All sales are final after documentation transfer.
- A 5% commission is charged on property resales through the platform.
- Free site inspections are available from Monday to Saturday at 10 AM and 2 PM. Inspections are strongly recommended.
- Payments should only be made to official company accounts (Prince Kaka Global Resources at UBA), not in cash to agents.
- A development fee is required before any construction can begin.
- Buyers must show development (like fencing) within 6-12 months.
- Refunds are only possible if requested in writing before a site inspection, with a 100-day processing period.

CEO: The CEO is a seasoned politician, a real estate consultant, and an AI engineer in training, who combines governance expertise with tech innovation.

Platform:
- NaijaLand is a Progressive Web App (PWA), accessible on a browser and can be added to the home screen.
- The platform uses technology to verify all properties thoroughly.

Contact:
- The primary support channel is WhatsApp: +234 816 095 2082.
- Emails are: smartprincenet@gmail.com or kakaprince46@gmail.com.
`;

exports.handler = async (event) => {
  // We only respond to POST requests
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const { messages } = JSON.parse(event.body);
  const deepseekApiKey = process.env.DEEPSEEK_API_KEY;

  if (!deepseekApiKey) {
    return { statusCode: 500, body: "API key is not configured." };
  }

  const systemPrompt = {
    role: "system",
    content: `You are NaijaLand's friendly and professional AI assistant. Your purpose is to help users interested in buying land in Nigeria.
        - Your knowledge is strictly based on the following information: ${naijaLandKnowledge}.
        - Do not invent information or provide details from outside this knowledge base.
        - If a user asks a question you cannot answer from the provided text, politely say, "I do not have information on that. For more specific details, please contact our support team on WhatsApp at +234 816 095 2082."
        - Keep your answers concise and helpful.
        - Always be polite and professional. Your value proposition is "Building Wealth Through Real Estate".`,
  };

  try {
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${deepseekApiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [systemPrompt, ...messages], // Prepend the system prompt to the conversation
        max_tokens: 1024,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("DeepSeek API Error:", errorData);
      return { statusCode: response.status, body: JSON.stringify(errorData) };
    }

    const data = await response.json();

    return {
      statusCode: 200,
      body: JSON.stringify(data),
    };
  } catch (error) {
    console.error("Error calling DeepSeek API:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Failed to communicate with the AI service.",
      }),
    };
  }
};
