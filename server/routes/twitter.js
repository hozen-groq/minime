// routes/twitter.js
const express = require('express');

const router = express.Router();

/**
 * Route configuration
 * @param {Object} services - Services required for routes
 * @returns {Object} - Configured router
 */
module.exports = (services) => {
  const { twitterService, twitterCacheService } = services;

  /**
   * Get tweets by hashtag with caching
   * GET /api/twitter/hashtag/:hashtag
   */
  router.get('/hashtag/:hashtag', async (req, res) => {
    try {
      const { hashtag } = req.params;
      const { maxResults = 100, forceRefresh = false } = req.query;
      
      // Check cache first unless force refresh is specified
      if (forceRefresh !== 'true') {
        const cacheData = twitterCacheService.getCachedHashtagResults(hashtag);
        if (cacheData) {
          return res.json({
            success: true,
            hashtag,
            count: cacheData.tweets.length,
            tweets: cacheData.tweets,
            source: 'cache',
            cachedAt: cacheData.cachedAt
          });
        }
      }
      
      // If not in cache or force refresh, fetch from Twitter API
      const tweets = await twitterService.getTweetsByHashtag(hashtag, Number.parseInt(maxResults));
      
      // Cache the results
      twitterCacheService.cacheHashtagResults(hashtag, tweets);
      
      res.json({ 
        success: true, 
        hashtag,
        count: tweets.length,
        tweets,
        source: 'api'
      });
    } catch (error) {
      console.error('Error fetching tweets by hashtag:', error);
      res.status(500).json({ 
        error: 'Failed to fetch tweets by hashtag', 
        message: error.message 
      });
    }
  });

  /**
   * Get user tweets with caching
   * GET /api/twitter/user/:username
   */
  router.get('/user/:username', async (req, res) => {
    try {
      const { username } = req.params;
      const { maxResults = 100, includeReplies = false, includeRetweets = false, forceRefresh = false } = req.query;
      
      // Check cache first unless force refresh is specified
      if (forceRefresh !== 'true') {
        const cacheData = twitterCacheService.getCachedUserTweets(username);
        if (cacheData) {
          return res.json({
            success: true,
            username,
            count: cacheData.tweets.length,
            tweets: cacheData.tweets,
            userData: cacheData.userData,
            source: 'cache',
            cachedAt: cacheData.cachedAt
          });
        }
      }
      
      // Get the user ID from username
      const userId = await twitterService.getUserId(username);
      
      // Try to get user profile data if possible
      let userData = null;
      try {
        userData = await twitterService.getUserProfile(username);
      } catch (profileError) {
        console.log('Could not fetch user profile:', profileError.message);
      }
      
      // Get user tweets
      const tweets = await twitterService.getUserTweets(
        userId, 
        Number.parseInt(maxResults), 
        includeReplies === 'true', 
        includeRetweets === 'true'
      );
      
      // Cache the tweets for future use
      twitterCacheService.cacheUserTweets(username, tweets, userData);
      
      res.json({
        success: true,
        username,
        count: tweets.length,
        tweets,
        userData,
        source: 'api'
      });
    } catch (error) {
      console.error('Error fetching user tweets:', error);
      res.status(500).json({ 
        error: 'Failed to fetch user tweets', 
        message: error.message 
      });
    }
  });

  /**
   * Search tweets with caching
   * GET /api/twitter/search
   */
  router.get('/search', async (req, res) => {
    try {
      const { q: query, maxResults = 100, forceRefresh = false } = req.query;
      
      if (!query) {
        return res.status(400).json({ error: 'Search query (q) is required' });
      }
      
      // Check cache first unless force refresh is specified
      if (forceRefresh !== 'true') {
        const cacheData = twitterCacheService.getCachedSearchResults(query);
        if (cacheData) {
          return res.json({
            success: true,
            query,
            count: cacheData.tweets.length,
            tweets: cacheData.tweets,
            source: 'cache',
            cachedAt: cacheData.cachedAt
          });
        }
      }
      
      // If not in cache or force refresh, fetch from Twitter API
      const tweets = await twitterService.searchTweets(query, Number.parseInt(maxResults));
      
      // Cache the results
      twitterCacheService.cacheSearchResults(query, tweets);
      
      res.json({ 
        success: true, 
        query,
        count: tweets.length,
        tweets,
        source: 'api'
      });
    } catch (error) {
      console.error('Error searching tweets:', error);
      res.status(500).json({ 
        error: 'Failed to search tweets', 
        message: error.message 
      });
    }
  });

  /**
   * Get cache information
   * GET /api/twitter/cache
   */
  router.get('/cache', (req, res) => {
    try {
      const cacheInfo = twitterCacheService.getAllCachedData();
      res.json({
        success: true,
        cacheCount: cacheInfo.length,
        caches: cacheInfo
      });
    } catch (error) {
      console.error('Error getting cache info:', error);
      res.status(500).json({ 
        error: 'Failed to get cache information', 
        message: error.message 
      });
    }
  });

  /**
   * Clear specific cache
   * DELETE /api/twitter/cache/:filename
   */
  router.delete('/cache/:filename', (req, res) => {
    try {
      const { filename } = req.params;
      const success = twitterCacheService.clearCache(filename);
      
      if (success) {
        res.json({
          success: true,
          message: `Cache ${filename} cleared successfully`
        });
      } else {
        res.status(404).json({
          success: false,
          message: `Cache ${filename} not found`
        });
      }
    } catch (error) {
      console.error('Error clearing cache:', error);
      res.status(500).json({ 
        error: 'Failed to clear cache', 
        message: error.message 
      });
    }
  });

  /**
   * Clear all caches
   * DELETE /api/twitter/cache
   */
  router.delete('/cache', (req, res) => {
    try {
      const count = twitterCacheService.clearAllCaches();
      res.json({
        success: true,
        message: `${count} cache files cleared successfully`
      });
    } catch (error) {
      console.error('Error clearing all caches:', error);
      res.status(500).json({ 
        error: 'Failed to clear all caches', 
        message: error.message 
      });
    }
  });

  return router;
};