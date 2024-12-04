const mongoose = require('mongoose');

const userSessionSchema = new mongoose.Schema({
  userId: String,
  userName: String,
  chatHistory: [
    {
      moodValue: Number,
      userMessage: String,
      botResponse: String,
      timestamp: { type: Date, default: Date.now },
    },
  ],
});

module.exports = mongoose.model('UserSession', userSessionSchema);
