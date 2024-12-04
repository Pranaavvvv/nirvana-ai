const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const winston = require('winston');
require('dotenv').config();

const app = express();

// Advanced Logging Setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Security Middleware
app.use(helmet());

// Dynamic CORS Configuration with Enhanced Security
const allowedOrigins = [
  'http://localhost:3001', 
  'https://your-production-domain.com',
  /\.yourdomain\.com$/  // Regex for subdomains
];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.some(allowed => 
      typeof allowed === 'string' 
        ? allowed === origin 
        : allowed.test(origin)
    )) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS policy'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Rate Limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', apiLimiter);

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));

// Initialize Google AI
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

// MongoDB Connection with Advanced Error Handling
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => logger.info('MongoDB connected successfully'))
.catch(err => {
  logger.error('MongoDB connection error:', err);
  process.exit(1);
});

// Enhanced Schemas with Validation
const moodRangeSchema = new mongoose.Schema({
  min: { 
    type: Number, 
    required: true,
    validate: {
      validator: Number.isInteger,
      message: '{VALUE} is not an integer value'
    }
  },
  max: { 
    type: Number, 
    required: true,
    validate: {
      validator: Number.isInteger,
      message: '{VALUE} is not an integer value'
    }
  },
  prompt: { 
    type: String, 
    required: true,
    trim: true,
    minlength: 10
  },
  resources: [{ 
    type: String, 
    validate: {
      validator: function(v) {
        return /^https?:\/\/\S+$/.test(v);
      },
      message: props => `${props.value} is not a valid URL!`
    }
  }],
  severity: {
    type: String,
    enum: ['low', 'moderate', 'high', 'critical'],
    required: true
  }
});

const moodLogSchema = new mongoose.Schema({
  moodValue: { 
    type: Number, 
    required: true,
    min: -51,
    max: 51
  },
  userMessage: { 
    type: String, 
    required: true,
    trim: true,
    maxlength: 1000
  },
  timestamp: { 
    type: Date, 
    default: Date.now,
    expires: '30d' // Automatically delete after 30 days
  },
  ipAddress: String
});

const feedbackSchema = new mongoose.Schema({
  userMessage: { 
    type: String, 
    required: true,
    trim: true
  },
  aiResponse: { 
    type: String, 
    required: true,
    trim: true
  },
  rating: { 
    type: Number, 
    min: 1, 
    max: 5,
    required: true
  },
  timestamp: { 
    type: Date, 
    default: Date.now 
  }
});

const MoodRange = mongoose.model('MoodRange', moodRangeSchema);
const MoodLog = mongoose.model('MoodLog', moodLogSchema);
const Feedback = mongoose.model('Feedback', feedbackSchema);

// Advanced Conversation Context Tracking
const conversationContextSchema = new mongoose.Schema({
  userId: { 
    type: String, 
    required: true,
    unique: true
  },
  lastInteraction: {
    message: String,
    timestamp: Date
  },
  emotionalTrajectory: [Number],
  keyTopics: [String]
});

const ConversationContext = mongoose.model('ConversationContext', conversationContextSchema);

// Sophisticated Chat Processing
async function processUserMessage(moodValue, userMessage, userId, ipAddress) {
  try {
    // Log mood and message
    await MoodLog.create({ 
      moodValue, 
      userMessage,
      ipAddress 
    });

    // Update or create conversation context
    await ConversationContext.findOneAndUpdate(
      { userId },
      { 
        $push: { 
          emotionalTrajectory: moodValue 
        },
        lastInteraction: {
          message: userMessage,
          timestamp: new Date()
        }
      },
      { upsert: true, new: true }
    );

    // Find appropriate mood range
    const moodRange = await MoodRange.findOne({
      min: { $lte: moodValue },
      max: { $gt: moodValue }
    });

    if (!moodRange) {
      throw new Error('No mood range found');
    }

    // Advanced Prompt Engineering
    const advancedPrompt = `
Context Guidelines:
- User's Current Mood Range: ${moodRange.severity} (${moodRange.prompt})
- Emotional Support Level: ${moodRange.severity === 'critical' ? 'High Empathy' : 'Compassionate'}
- Conversation Goal: Provide supportive, nuanced emotional guidance

User's Message: "${userMessage}"

Response Criteria:
1. Demonstrate deep empathy and active listening
2. Validate the user's emotional experience
3. Offer contextually appropriate coping strategies
4. Suggest resources matching emotional state
5. Encourage positive self-reflection
6. Maintain a warm, non-judgmental tone
`;

    const chatResult = await model.generateContent(advancedPrompt);
    const aiResponse = chatResult.response.text();

    // Enhanced Resource Recommendation
    const resourceRecommendation = moodRange.resources.length > 0
      ? `Helpful Resources: ${moodRange.resources.join(', ')}`
      : 'Remember, support is always available. Consider reaching out to a mental health professional.';

    return {
      response: `${aiResponse}\n\n${resourceRecommendation}`,
      followUp: "Would you like to explore this feeling more? I'm here to listen.",
      severity: moodRange.severity
    };

  } catch (error) {
    logger.error('Chat Processing Error', { error, moodValue, userMessage });
    throw error;
  }
}

// Routes with Enhanced Error Handling
app.get('/api/welcome', (req, res) => {
  res.json({
    message: "Welcome to MindSpace. A compassionate companion for your mental wellness journey.",
    supportTypes: [
      "Emotional Support",
      "Mood Tracking",
      "Resource Guidance",
      "Non-Judgmental Conversation"
    ]
  });
});

app.post('/api/chat', async (req, res) => {
  try {
    const { moodValue, userMessage, userId } = req.body;
    const ipAddress = req.ip;

    if (moodValue === undefined || !userMessage || !userId) {
      return res.status(400).json({
        message: 'Incomplete request. Mood value, user message, and user ID are required.',
        requiredFields: ['moodValue', 'userMessage', 'userId']
      });
    }

    const result = await processUserMessage(moodValue, userMessage, userId, ipAddress);
    res.json(result);

  } catch (error) {
    logger.error('Chat Endpoint Error', error);
    res.status(500).json({ 
      message: 'Unable to process your message. Please try again.', 
      errorCode: 'CHAT_PROCESSING_ERROR' 
    });
  }
});

// More Routes... (Mood Logs, Feedback)

// Error Handling Middleware
app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(500).json({
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'production' ? {} : err.stack
  });
});

// Initialization & Server Start
async function initializeApplication() {
  try {
    await initializeMoodRanges();
    
    const PORT = process.env.PORT || 5555;
    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      if (!process.env.GOOGLE_AI_KEY) {
        logger.warn('GOOGLE_AI_KEY is not set in environment variables');
      }
    });
  } catch (error) {
    logger.error('Application Initialization Failed', error);
    process.exit(1);
  }
}

initializeApplication();

// Existing initializeMoodRanges function remains the same...
async function initializeMoodRanges() {
  try {
    const count = await MoodRange.countDocuments();
    if (count === 0) {
      // Your existing mood ranges array with added 'severity' field
      const defaultRanges = [/* ... existing ranges with severity added ... */];
      
      await MoodRange.insertMany(defaultRanges);
      logger.info('Default mood ranges initialized');
    }
  } catch (error) {
    logger.error('Error initializing mood ranges:', error);
  }
}

module.exports = app; // For potential testing