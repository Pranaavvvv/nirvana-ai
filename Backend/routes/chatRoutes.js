const express = require('express');
const UserSession = require('../models/UserSession');
const { generateAIResponseWithContext } = require('../services/aiService');
const router = express.Router();

router.post('/', async (req, res) => {
  const { userId, userName, userMessage, moodValue, selectedTone, language } = req.body;

  try {
    // Fetch or create user session
    let session = await UserSession.findOne({ userId });
    if (!session) {
      session = new UserSession({ userId, userName, chatHistory: [] });
    }

    // Generate AI response with context
    const aiResponse = await generateAIResponseWithContext(
      userName,
      session.chatHistory,
      userMessage,
      selectedTone,
      language
    );

    // Save conversation to chat history
    session.chatHistory.push({ moodValue, userMessage, botResponse: aiResponse });
    await session.save();

    // Simulate a typing indicator
    setTimeout(() => {
      res.json({ response: aiResponse, suggestions: ["Tell me more.", "What else can I help you with?"] });
    }, 1500);
  } catch (error) {
    console.error('Error generating response:', error);
    res.status(500).json({ message: 'Something went wrong. Please try again later.' });
  }
});

module.exports = router;
