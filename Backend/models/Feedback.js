const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
  userId: String,
  botResponse: String,
  feedback: String,
});

module.exports = mongoose.model('Feedback', feedbackSchema);
