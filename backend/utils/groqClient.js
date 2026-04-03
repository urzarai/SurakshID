// utils/groqClient.js
// Centralized Groq API client.
// All communication with the Groq LLM goes through this utility.
// Keeps API key management and request configuration in one place.
// Uses axios to POST to Groq's OpenAI-compatible /chat/completions endpoint.

const axios = require('axios');

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

/**
 * callGroq
 * Sends a prompt to Groq and returns the raw text response.
 * @param {string} systemPrompt — sets the behavior/role of the model
 * @param {string} userPrompt  — the actual content/question to process
 * @param {number} maxTokens  — max tokens in the response (default 1024)
 * @returns {Promise<string>} — raw text response from the model
 */
const callGroq = async (systemPrompt, userPrompt, maxTokens = 1024) => {
  try {
    const response = await axios.post(
      GROQ_API_URL,
      {
        model: GROQ_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: maxTokens,
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
    throw new Error(`Groq API error: ${errMsg}`);
  }
};

module.exports = { callGroq };