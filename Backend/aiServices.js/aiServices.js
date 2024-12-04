const { translateText, detectSentiment } = require('./utils'); // Mocked utility functions
const empatheticStarters = [
  "I hear you, and that sounds challenging.",
  "That must be tough to deal with.",
  "Thanks for sharing that—it’s important to talk about these things.",
];

async function generateAIResponseWithContext(userName, chatHistory, userMessage, tone, language) {
  const context = chatHistory
    .map(chat => `User: ${chat.userMessage}\nBot: ${chat.botResponse}`)
    .join('\n');

  const starter = empatheticStarters[Math.floor(Math.random() * empatheticStarters.length)];
  const translatedMessage = await translateText(userMessage, language || 'en'); // Translate input if needed

  const prompt = `
    User Name: ${userName || 'Anonymous'}
    Tone: ${tone || 'Friendly'}
    Context:
    ${context}
    User: ${translatedMessage}
    Bot Response Starter: ${starter}
    Bot:
  `;

  // Mocked AI API call
  const aiResponse = await callAIService(prompt); // Replace with actual AI call

  return await translateText(aiResponse, 'en', language); // Translate response back if needed
}

module.exports = { generateAIResponseWithContext };
