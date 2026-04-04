// utils/groqClient.js
// Centralized Groq API client.
// All communication with the Groq LLM goes through this utility.
// Includes retry logic with exponential backoff — retries up to 2 times
// on failure before throwing. Keeps API key management in one place.
// utils/groqClient.js
const axios = require('axios');

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL   = 'llama-3.3-70b-versatile';

const callGroq = async (systemPrompt, userPrompt, maxTokens = 1024, retries = 2) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await axios.post(
        GROQ_API_URL,
        {
          model: GROQ_MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user',   content: userPrompt   },
          ],
          max_tokens:  maxTokens,
          temperature: 0.1,
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const content = response.data.choices[0].message.content;
      return content.trim();

    } catch (error) {
      const errMsg = error.response?.data?.error?.message || error.message;
      if (attempt === retries) {
        throw new Error(`Groq API error after ${retries} attempts: ${errMsg}`);
      }
      console.warn(`[Groq] Attempt ${attempt} failed: ${errMsg}. Retrying...`);
      await new Promise((r) => setTimeout(r, 1000 * attempt)); // backoff
    }
  }
};

module.exports = { callGroq };