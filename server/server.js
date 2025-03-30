// server.js
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const fs = require('node:fs');
const path = require('node:path');

// Load environment variables
dotenv.config();

// Import services
const TwitterService = require('./services/twitterService');
const TwitterCacheService = require('./services/twitterCacheService');
const GroqResponseService = require('./services/groqResponseService');

// Initialize services
const twitterService = new TwitterService(process.env.TWITTER_BEARER_TOKEN);
const twitterCacheService = new TwitterCacheService();
const groqResponseService = new GroqResponseService(process.env.GROQ_API_KEY);

// Group services for route modules
const services = {
  twitterService,
  twitterCacheService,
  groqResponseService
};

// Setup Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Create required directories
const directories = {
  audio: path.join(__dirname, 'audio'),
  cache: path.join(__dirname, 'cache')
};

// Ensure directories exist
for (const [name, dir] of Object.entries(directories)) {
  if (!fs.existsSync(dir)) {
    console.log(`Creating ${name} directory: ${dir}`);
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Configure static file serving
app.use('/audio', express.static(directories.audio));

// Import routes
const speechRoutes = require('./routes/speech');
const twitterRoutes = require('./routes/twitter')(services);
const responseRoutes = require('./routes/response')(services);

// API Routes
app.use('/api/v1/speech', speechRoutes);
app.use('/api/v1/twitter', twitterRoutes);
app.use('/api/v1/response', responseRoutes);

// Backwards compatibility routes
app.post('/api/text-to-speech', (req, res) => {
  // Forward to new endpoint
  req.url = '/v1/speech';
  app._router.handle(req, res);
});

app.post('/api/generate-response', (req, res) => {
  // Forward to new endpoint
  req.url = '/v1/response';
  app._router.handle(req, res);
});

// Utility function to clean old audio files
const cleanupAudioFiles = () => {
  console.log('Running audio file cleanup...');
  
  try {
    if (!fs.existsSync(directories.audio)) {
      console.log('Audio directory does not exist, skipping cleanup');
      return;
    }
    
    const audioFiles = fs.readdirSync(directories.audio);
    const now = Date.now();
    let removedCount = 0;
    
    for (const file of audioFiles) {
      const filePath = path.join(directories.audio, file);
      try {
        const stats = fs.statSync(filePath);
        const fileAge = now - stats.mtimeMs;
        
        // Remove files older than specified age
        const maxAgeMs = Number.parseInt(process.env.AUDIO_MAX_AGE_HOURS || "1") * 60 * 60 * 1000;
        if (fileAge > maxAgeMs) {
          fs.unlinkSync(filePath);
          removedCount++;
        }
      } catch (error) {
        console.error(`Error processing audio file ${file}:`, error);
      }
    }
    
    if (removedCount > 0) {
      console.log(`Cleaned up ${removedCount} old audio files`);
    } else {
      console.log('No audio files needed cleanup');
    }
  } catch (error) {
    console.error('Error during audio cleanup:', error);
  }
};

// Schedule periodic cleanups
const CLEANUP_INTERVAL_MS = Number.parseInt(process.env.CLEANUP_INTERVAL_HOURS || "1") * 60 * 60 * 1000;
setInterval(() => {
  try {
    // Clean old audio files
    cleanupAudioFiles();
    
    // Clean old caches
    const cleanedCaches = twitterCacheService.cleanOldCaches();
    if (cleanedCaches > 0) {
      console.log(`Cleaned ${cleanedCaches} old cache files`);
    }
  } catch (error) {
    console.error('Error during scheduled cleanup:', error);
  }
}, CLEANUP_INTERVAL_MS);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Initial cache warmup for common users
// This helps avoid Twitter API rate limits during the first request
const warmupCache = async () => {
  try {
    const username = process.env.TWITTER_USERNAME || 'ozenhati';
    console.log(`Warming up cache for Twitter user @${username}...`);
    
    // Check if we already have cached data
    const cachedData = twitterCacheService.getCachedUserTweets(username);
    if (cachedData) {
      console.log(`Cache already exists for @${username} with ${cachedData.tweets.length} tweets`);
      return;
    }
    
    // If no cached data, try to fetch and cache
    try {
      // Get the user ID
      const userId = await twitterService.getUserId(username);
      
      // Get profile data if possible
      let userData = null;
      try {
        userData = await twitterService.getUserProfile(username);
      } catch (profileError) {
        console.log('Could not fetch user profile during warmup:', profileError.message);
      }
      
      // Get tweets
      const tweets = await twitterService.getUserTweets(userId, 100, true, false);
      
      // Cache the tweets
      twitterCacheService.cacheUserTweets(username, tweets, userData);
      console.log(`Successfully cached ${tweets.length} tweets for @${username} during warmup`);
    } catch (error) {
      console.error('Error during cache warmup:', error.message);
      console.log('Will attempt to cache on first user request instead');
    }
  } catch (error) {
    console.error('Unexpected error during cache warmup:', error);
  }
};

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  
  // Run initial cleanup
  cleanupAudioFiles();
  
  // Warm up the cache
  warmupCache();
});