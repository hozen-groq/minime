// routes/response.js
const express = require('express');
const router = express.Router();

/**
 * Route configuration
 * @param {Object} services - Services required for routes
 * @returns {Object} - Configured router
 */
module.exports = (services) => {
  const { groqResponseService, twitterService, twitterCacheService } = services;

  /**
   * Generate a response to a question based on tweet data
   * POST /api/response
   */
  router.post('/', async (req, res) => {
    try {
      const { question, twitterUsername } = req.body;
      
      if (!question) {
        return res.status(400).json({ error: 'Question is required' });
      }
      
      const username = twitterUsername || process.env.TWITTER_USERNAME || 'ozenhati';
      
      // Attempt to get tweets from cache first
      let tweets = [];
      let userData = null;
      const cacheData = twitterCacheService.getCachedUserTweets(username);
      
      if (cacheData) {
        // Use cached tweets - preserving original structure
        tweets = cacheData.tweets;
        userData = cacheData.metadata?.userData;
        console.log(`Using ${tweets.length} cached tweets for @${username}`);
      } else {
        try {
          // Get the user ID from username
          const userId = await twitterService.getUserId(username);
          
          // Try to get user profile data if possible
          try {
            userData = await twitterService.getUserProfile(username);
          } catch (profileError) {
            console.log('Could not fetch user profile:', profileError.message);
            // Continue without user profile data
          }
          
          // Get the user's tweets from Twitter API
          tweets = await twitterService.getUserTweets(
            userId, 
            100, // maxResults
            true, // includeReplies
            false // includeRetweets
          );
          
          // Cache the tweets for future use
          twitterCacheService.cacheUserTweets(username, tweets, userData);
        } catch (error) {
          console.error('Error fetching tweets:', error);
          
          // If we have no tweets at all, we need to respond with an error
          if (tweets.length === 0) {
            return res.status(503).json({ 
              error: 'Twitter data is currently unavailable', 
              message: 'Please try again later when the service is available.'
            });
          }
        }
      }
      
      // If we have no tweets, we can't generate a meaningful response
      if (tweets.length === 0) {
        return res.status(404).json({ 
          error: 'No tweets found', 
          message: 'Could not find any tweets for the specified user.'
        });
      }
      
      // Sort tweets by date (newest first) if they aren't already
      tweets.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      
      // Check if this is a common question that can be answered directly
      const directAnswer = groqResponseService.getDirectAnswer(question, tweets);
      
      if (directAnswer) {
        // Return the direct answer for common questions
        return res.json({ responseText: directAnswer });
      }
      
      // For more complex questions, use the Groq LLM
      try {
        const responseText = await groqResponseService.generateResponse(question, tweets, userData);
        res.json({ responseText });
      } catch (llmError) {
        console.error('Error generating response with Groq LLM:', llmError);
        
        // Fallback to simple keyword matching if LLM fails
        const keywords = question.toLowerCase().split(' ');
        const relevantTweets = tweets.filter(tweet => {
          const tweetText = tweet.text.toLowerCase();
          return keywords.some(keyword => tweetText.includes(keyword) && keyword.length > 3);
        }).slice(0, 3); // Get top 3 most relevant tweets
        
        let responseText;
        if (relevantTweets.length > 0) {
          const tweetContext = relevantTweets.map(t => t.text).join('\n');
          responseText = `Based on my past tweets, I can tell you that ${tweetContext}`;
        } else {
          responseText = "I don't seem to have tweeted about that topic before. Feel free to ask me something else!";
        }
        
        res.json({ responseText });
      }
    } catch (error) {
      console.error('Error generating response:', error);
      res.status(500).json({ error: 'Failed to generate response' });
    }
  });

  return router;
};