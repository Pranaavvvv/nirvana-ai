const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const app = express();

// CORS Configuration
const corsOptions = {
  origin: 'https://google-genai-hackathon.vercel.app/', // Update this to your frontend URL
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

// Initialize Google AI
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-pro" });

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Mood Range Schema
const moodRangeSchema = new mongoose.Schema({
  min: Number,
  max: Number,
  prompt: String,
  resources: [String],
});

const MoodRange = mongoose.model('MoodRange', moodRangeSchema);

// Mood Log Schema
const moodLogSchema = new mongoose.Schema({
  moodValue: Number,
  userMessage: String,
  timestamp: { type: Date, default: Date.now },
});

const MoodLog = mongoose.model('MoodLog', moodLogSchema);

// Feedback Schema
const feedbackSchema = new mongoose.Schema({
  userMessage: String,
  aiResponse: String,
  rating: { type: Number, min: 1, max: 5 },
  timestamp: { type: Date, default: Date.now },
});

const Feedback = mongoose.model('Feedback', feedbackSchema);

// Welcome endpoint
app.get('/api/welcome', (req, res) => {
  res.json({
    message: "Welcome to the Mental Health Chatbot! Share how you're feeling, and let's chat.",
  });
});

// Handle chat with context
app.post('/api/chat', async (req, res) => {
  try {
    const { moodValue, userMessage } = req.body;

    if (moodValue === undefined || !userMessage) {
      return res.status(400).json({ message: 'Mood value and user message are required' });
    }

    // Log the mood and message
    await MoodLog.create({ moodValue, userMessage });

    // Find the appropriate mood range
    const moodRange = await MoodRange.findOne({
      min: { $lte: moodValue },
      max: { $gt: moodValue },
    });

    if (!moodRange) {
      return res.status(404).json({ message: 'No mood range found for this value' });
    }

    const chatPrompt = `Context: A user has shared the following message: "${userMessage}". From the user's message, we can infer the following emotional state: "${moodRange.prompt}". As a compassionate mental health chatbot, your response should adhere to the following guidelines:
    the number 1 priority is to talk like a friend you can use some light humour or if sad you can give some confidence 
    1. **Empathetic Acknowledgment**: Recognize the user's emotional state through your response without explicitly naming the mood or numerical values. Use phrases that reflect understanding and validate their feelings.
    
    2. **Thoughtful Engagement**: Craft a detailed reply that directly addresses the user's concerns while incorporating their emotional context. Ensure the response feels personal and relevant to the individual’s experience.
    
    3. **Validation and Support**: Depending on the inferred mood range, validate their feelings. For positive moods, celebrate their achievements and highlight strengths. For neutral to negative moods, emphasize empathy and provide emotional support, reassuring them that their feelings are valid.
    
    4. **Encouragement and Constructive Feedback**: Offer encouragement and constructive feedback aligned with their mood. For those in a positive state, encourage them to continue their progress. For neutral or negative emotions, gently propose coping strategies or solutions that may help them navigate their feelings.
    
    5. **Conversational Tone**: Maintain a warm and inviting tone throughout your response. Encourage further dialogue by posing open-ended questions that invite the user to share more about their feelings or experiences, or suggest helpful resources that might assist them.
    
    6. **Comprehensive Structure**: Ensure your response is thorough where needed. Remember to focus on emotional nuance and provide a response that is genuinely supportive and encouraging, without relying on mood metrics.`;

    const chatResult = await model.generateContent(chatPrompt);
    const aiResponse = chatResult.response.text();

    // Include resources in the response
    const resourcesMessage = moodRange.resources.length
      ? `Here are some resources that might help: ${moodRange.resources.join(', ')}`
      : '';

    res.json({ response: `${aiResponse}\n\n${resourcesMessage}` });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Feedback endpoint
app.post('/api/feedback', async (req, res) => {
  try {
    const { userMessage, aiResponse, rating } = req.body;

    if (!userMessage || !aiResponse || rating === undefined) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    await Feedback.create({ userMessage, aiResponse, rating });
    res.json({ message: 'Feedback submitted successfully' });
  } catch (error) {
    console.error('Error submitting feedback:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Initialize Mood Ranges
async function initializeMoodRanges() {
  try {
    const count = await MoodRange.countDocuments();
    if (count === 0) {
      const defaultRanges = [
        {
          min: 40,
          max: 51,
          prompt: "The user is feeling extremely positive, enthusiastic, and optimistic. They likely feel energized and ready to take on challenges.",
          resources: [
            "https://www.success.com/7-positive-affirmations-to-tell-yourself-every-day/",
            "https://www.lifehack.org/articles/communication/10-ways-stay-positive-everyday.html"
          ],
        },
        {
          min: 30,
          max: 40,
          prompt: "The user is in a very good mood, feeling confident and optimistic about their circumstances.",
          resources: [
            "https://www.verywellmind.com/how-to-cultivate-a-positive-mindset-5097546",
            "https://tinybuddha.com/blog/how-to-maintain-a-positive-mindset/"
          ],
        },
        {
          min: 20,
          max: 30,
          prompt: "The user is feeling quite good, generally positive, and content with their current situation.",
          resources: [
            "https://www.psychologytoday.com/us/blog/click-here-happiness/201901/15-tips-living-happier-life",
            "https://greatergood.berkeley.edu/article/item/how_to_keep_a_good_mood_going"
          ],
        },
        {
          min: 10,
          max: 20,
          prompt: "The user is in a slightly positive mood, feeling generally okay but may have some minor concerns.",
          resources: [
            "https://www.headspace.com/articles/how-to-be-more-positive",
            "https://www.mind.org.uk/information-support/types-of-mental-health-problems/mood-problems/"
          ],
        },
        {
          min: 0,
          max: 10,
          prompt: "The user is feeling neutral to slightly positive, generally balanced but may be experiencing some uncertainty.",
          resources: [
            "https://www.psychologytoday.com/us/blog/the-moment-youth/201807/7-ways-manage-uncertainty",
            "https://www.verywellmind.com/what-is-emotional-intelligence-2795423"
          ],
        },
        {
          min: -10,
          max: 0,
          prompt: "The user is feeling neutral to slightly negative, possibly experiencing some mild stress or concern.",
          resources: [
            "https://www.stress.org/how-to-deal-with-stress",
            "https://www.mindful.org/meditation/mindfulness-getting-started/"
          ],
        },
        {
          min: -20,
          max: -10,
          prompt: "The user is feeling somewhat down or upset, likely facing some challenges or disappointments.",
          resources: [
            "https://www.helpguide.org/articles/stress/stress-management.htm",
            "https://www.betterhelp.com/advice/stress/how-to-cope-with-feeling-down/"
          ],
        },
        {
          min: -30,
          max: -20,
          prompt: "The user is feeling quite negative or distressed, possibly dealing with significant difficulties or emotional pain.",
          resources: [
            "https://www.psychologytoday.com/us/blog/the-decision-tree/202003/what-do-when-youre-feeling-overwhelmed",
            "https://www.nimh.nih.gov/health/topics/stress"
          ],
        },
        {
          min: -40,
          max: -30,
          prompt: "The user is feeling very negative or troubled, likely experiencing serious problems or emotional distress.",
          resources: [
            "https://www.betterhelp.com/",
            "https://www.crisistextline.org/"
          ],
        },
        {
          min: -51,
          max: -40,
          prompt: "The user is feeling extremely negative or in severe distress, potentially facing a crisis or overwhelming challenges.",
          resources: [
            "https://www.crisistextline.org/",
            "https://www.samhsa.gov/find-help/national-helpline",
            "https://suicidepreventionlifeline.org/"
          ],
        },
      ];
      
      await MoodRange.insertMany(defaultRanges);
      console.log('Default mood ranges initialized');
    }
  } catch (error) {
    console.error('Error initializing mood ranges:', error);
  }
}

initializeMoodRanges();

const PORT = process.env.PORT || 5555;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  if (!process.env.GOOGLE_AI_KEY) {
    console.warn('WARNING: GOOGLE_AI_KEY is not set in environment variables');
  }
});
