const express = require('express');
const Feedback = require('../models/Feedback');
const router = express.Router();

router.post('/', async (req, res) => {
  const { userId, botResponse, feedback } = req.body;

  try {
    await Feedback.create({ userId, botResponse, feedback });
    res.status(201).json({ message: 'Feedback submitted successfully!' });
  } catch (error) {
    console.error('Error saving feedback:', error.message);
    res.status(500).json({ message: 'Failed to submit feedback.' });
  }
});

module.exports = router;
