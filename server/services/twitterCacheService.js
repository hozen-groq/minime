// twitterCacheService.js
const fs = require('node:fs');
const path = require('node:path');

class TwitterCacheService {
  constructor(cacheDir = null) {
    this.cacheDir = cacheDir || path.join(__dirname, '..', 'cache', 'twitter');
    this.ensureCacheDirectory();
    this.defaultMaxAgeHours = Number.parseInt(process.env.CACHE_MAX_AGE_HOURS || "24");
  }

  // Create cache directory if it doesn't exist
  ensureCacheDirectory() {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  // Generate cache filename for user tweets - maintaining original naming
  getUserTweetsCacheFilename(username) {
    return path.join(this.cacheDir, `${username.toLowerCase()}_tweets.json`);
  }

  // Generate cache filename for search results
  getSearchCacheFilename(query) {
    // Create a safe filename from the search query
    const safeQuery = query.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 50);
    return path.join(this.cacheDir, `search_${safeQuery}.json`);
  }

  // Generate cache filename for hashtag search
  getHashtagCacheFilename(hashtag) {
    return path.join(this.cacheDir, `hashtag_${hashtag.toLowerCase()}.json`);
  }

  // Save tweets to cache with metadata
  saveTweetsToCache(filename, tweets, metadata = {}) {
    const cacheData = {
      cachedAt: new Date().toISOString(),
      count: tweets.length,
      metadata,
      tweets
    };

    fs.writeFileSync(filename, JSON.stringify(cacheData, null, 2), 'utf8');
    console.log(`Cached ${tweets.length} tweets to ${filename}`);
    return cacheData;
  }

  // Load tweets from cache if available and not expired
  loadTweetsFromCache(filename, maxAgeHours = null) {
    const effectiveMaxAgeHours = maxAgeHours === null ? this.defaultMaxAgeHours : maxAgeHours;
    
    try {
      if (!fs.existsSync(filename)) {
        return null;
      }

      const stats = fs.statSync(filename);
      const fileAge = Date.now() - stats.mtimeMs;
      const maxAge = effectiveMaxAgeHours * 60 * 60 * 1000; // Convert hours to milliseconds

      // Check if cache is expired
      if (fileAge > maxAge) {
        console.log(`Cache expired for ${filename}`);
        return null;
      }

      const cacheData = JSON.parse(fs.readFileSync(filename, 'utf8'));
      console.log(`Loaded ${cacheData.count} tweets from cache ${filename}`);
      return cacheData;
    } catch (error) {
      console.error(`Error loading cache from ${filename}:`, error);
      return null;
    }
  }

  // Cache user tweets
  cacheUserTweets(username, tweets, userData = null) {
    const filename = this.getUserTweetsCacheFilename(username);
    return this.saveTweetsToCache(filename, tweets, { username, userData });
  }

  // Get cached user tweets
  getCachedUserTweets(username, maxAgeHours = null) {
    const filename = this.getUserTweetsCacheFilename(username);
    return this.loadTweetsFromCache(filename, maxAgeHours);
  }

  // Cache search results
  cacheSearchResults(query, tweets) {
    const filename = this.getSearchCacheFilename(query);
    return this.saveTweetsToCache(filename, tweets, { query });
  }

  // Get cached search results
  getCachedSearchResults(query, maxAgeHours = null) {
    const filename = this.getSearchCacheFilename(query);
    return this.loadTweetsFromCache(filename, maxAgeHours);
  }

  // Cache hashtag search results
  cacheHashtagResults(hashtag, tweets) {
    const filename = this.getHashtagCacheFilename(hashtag);
    return this.saveTweetsToCache(filename, tweets, { hashtag });
  }

  // Get cached hashtag search results
  getCachedHashtagResults(hashtag, maxAgeHours = null) {
    const filename = this.getHashtagCacheFilename(hashtag);
    return this.loadTweetsFromCache(filename, maxAgeHours);
  }

  // Get all cached data
  getAllCachedData() {
    const files = fs.readdirSync(this.cacheDir);
    const cacheInfo = files.map(file => {
      const filePath = path.join(this.cacheDir, file);
      try {
        const stats = fs.statSync(filePath);
        const cacheData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        return {
          filename: file,
          cachedAt: cacheData.cachedAt,
          count: cacheData.count,
          metadata: cacheData.metadata,
          size: stats.size,
          age: Math.floor((Date.now() - stats.mtimeMs) / (60 * 60 * 1000)) // Age in hours
        };
      } catch (error) {
        return {
          filename: file,
          error: error.message
        };
      }
    });
    return cacheInfo;
  }

  // Clear specific cache
  clearCache(filename) {
    const filePath = path.join(this.cacheDir, filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  }

  // Clear all caches
  clearAllCaches() {
    const files = fs.readdirSync(this.cacheDir);
    let clearedCount = 0;
    
    for (const file of files) {
      try {
        fs.unlinkSync(path.join(this.cacheDir, file));
        clearedCount++;
      } catch (error) {
        console.error(`Error deleting ${file}:`, error);
      }
    }
    
    return clearedCount;
  }
  
  // Clean old caches based on age
  cleanOldCaches(maxAgeHours = null) {
    const effectiveMaxAgeHours = maxAgeHours === null ? this.defaultMaxAgeHours : maxAgeHours;
    
    const maxAge = effectiveMaxAgeHours * 60 * 60 * 1000; // Convert hours to milliseconds
    const files = fs.readdirSync(this.cacheDir);
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const file of files) {
      const filePath = path.join(this.cacheDir, file);
      try {
        const stats = fs.statSync(filePath);
        const fileAge = now - stats.mtimeMs;
        
        if (fileAge > maxAge) {
          fs.unlinkSync(filePath);
          console.log(`Cleaned old cache: ${file}`);
          cleanedCount++;
        }
      } catch (error) {
        console.error(`Error processing ${file}:`, error);
      }
    }
    
    return cleanedCount;
  }
}

module.exports = TwitterCacheService;