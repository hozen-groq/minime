// twitterService.js
const axios = require('axios');

class TwitterService {
  constructor(bearerToken) {
    this.bearerToken = bearerToken;
    this.baseUrl = process.env.TWITTER_API_URL || 'https://api.twitter.com/2';
    this.maxRetries = Number.parseInt(process.env.API_MAX_RETRIES || "3");
    this.retryDelay = Number.parseInt(process.env.API_RETRY_DELAY_MS || "1000");
  }

  /**
   * Make a request to the Twitter API with retry logic
   * @param {string} endpoint - API endpoint
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} - API response
   */
  async makeRequest(endpoint, params = {}) {
    let attempts = 0;
    
    while (attempts < this.maxRetries) {
      try {
        const response = await axios.get(`${this.baseUrl}${endpoint}`, {
          headers: {
            'Authorization': `Bearer ${this.bearerToken}`
          },
          params,
          timeout: 10000 // 10 second timeout
        });
        
        return response.data;
      } catch (error) {
        attempts++;
        console.error(`API request failed (attempt ${attempts}/${this.maxRetries}):`, error.message);
        
        // If we've reached max retries, throw the error
        if (attempts >= this.maxRetries) {
          throw error;
        }
        
        // Rate limiting or temporary issue - wait before retry
        if (error.response && (error.response.status === 429 || error.response.status >= 500)) {
          // Use a reasonable delay with exponential backoff
          const delay = Math.min(
            this.retryDelay * (2 ** (attempts - 1)), // Exponential backoff
            30000 // Max 30 seconds wait
          );
            
          console.log(`Rate limited or server error. Waiting ${delay}ms before retry.`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          // Wait before retry for other errors
          await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        }
      }
    }
  }

  /**
   * Get user ID from username
   * @param {string} username - Twitter username (without @)
   * @returns {Promise<string>} - User ID
   */
  async getUserId(username) {
    try {
      const response = await this.makeRequest(`/users/by/username/${username}`);
      
      if (!response.data) {
        throw new Error('User not found');
      }
      
      return response.data.id;
    } catch (error) {
      console.error('Error fetching user ID:', error);
      throw error;
    }
  }

  /**
   * Get user's tweets
   * @param {string} userId - Twitter user ID
   * @param {number} maxResults - Maximum number of tweets to fetch (max 100)
   * @param {boolean} includeReplies - Whether to include replies
   * @param {boolean} includeRetweets - Whether to include retweets
   * @returns {Promise<Array>} - Array of tweet objects
   */
  async getUserTweets(userId, maxResults = 100, includeReplies = false, includeRetweets = false) {
    try {
      // Set up query parameters
      const params = {
        'max_results': maxResults,
        'tweet.fields': 'created_at,public_metrics,referenced_tweets',
        'expansions': 'author_id,in_reply_to_user_id,referenced_tweets.id',
        'user.fields': 'name,username,profile_image_url'
      };
      
      const response = await this.makeRequest(`/users/${userId}/tweets`, params);
      
      if (!response.data) {
        return [];
      }
      
      // Filter out retweets and replies if needed
      let tweets = response.data;
      
      if (!includeRetweets) {
        tweets = tweets.filter(tweet => {
          return !tweet.referenced_tweets || 
                 !tweet.referenced_tweets.some(ref => ref.type === 'retweeted');
        });
      }
      
      if (!includeReplies) {
        tweets = tweets.filter(tweet => !tweet.in_reply_to_user_id);
      }
      
      // Format tweets for our application
      return tweets.map(tweet => ({
        id: tweet.id,
        created_at: tweet.created_at,
        text: tweet.text,
        likes: tweet.public_metrics?.like_count || 0,
        retweets: tweet.public_metrics?.retweet_count || 0
      }));
    } catch (error) {
      console.error('Error fetching user tweets:', error);
      throw error;
    }
  }

  /**
   * Get tweets by hashtag
   * @param {string} hashtag - Hashtag to search for (without #)
   * @param {number} maxResults - Maximum number of tweets to fetch
   * @returns {Promise<Array>} - Array of tweet objects
   */
  async getTweetsByHashtag(hashtag, maxResults = 100) {
    try {
      const params = {
        'query': `#${hashtag}`,
        'max_results': maxResults,
        'tweet.fields': 'created_at,public_metrics,author_id',
        'expansions': 'author_id',
        'user.fields': 'name,username'
      };
      
      const response = await this.makeRequest('/tweets/search/recent', params);
      
      if (!response.data) {
        return [];
      }
      
      // Format tweets for our application
      return response.data.map(tweet => ({
        id: tweet.id,
        created_at: tweet.created_at,
        text: tweet.text,
        likes: tweet.public_metrics?.like_count || 0,
        retweets: tweet.public_metrics?.retweet_count || 0,
        author_id: tweet.author_id
      }));
    } catch (error) {
      console.error('Error fetching tweets by hashtag:', error);
      throw error;
    }
  }

  /**
   * Search for tweets
   * @param {string} query - Search query
   * @param {number} maxResults - Maximum number of tweets to fetch
   * @returns {Promise<Array>} - Array of tweet objects
   */
  async searchTweets(query, maxResults = 100) {
    try {
      const params = {
        'query': query,
        'max_results': maxResults,
        'tweet.fields': 'created_at,public_metrics,author_id',
        'expansions': 'author_id',
        'user.fields': 'name,username'
      };
      
      const response = await this.makeRequest('/tweets/search/recent', params);
      
      if (!response.data) {
        return [];
      }
      
      // Format tweets for our application
      return response.data.map(tweet => ({
        id: tweet.id,
        created_at: tweet.created_at,
        text: tweet.text,
        likes: tweet.public_metrics?.like_count || 0,
        retweets: tweet.public_metrics?.retweet_count || 0,
        author_id: tweet.author_id
      }));
    } catch (error) {
      console.error('Error searching tweets:', error);
      throw error;
    }
  }

  /**
   * Get user profile information
   * @param {string} username - Twitter username (without @)
   * @returns {Promise<Object>} - User profile data
   */
  async getUserProfile(username) {
    try {
      const params = {
        'user.fields': 'name,username,description,profile_image_url,public_metrics'
      };
      
      const response = await this.makeRequest(`/users/by/username/${username}`, params);
      
      if (!response.data) {
        throw new Error('User not found');
      }
      
      const userData = response.data;
      
      // Format user data
      return {
        id: userData.id,
        username: userData.username,
        name: userData.name,
        description: userData.description,
        profile_image_url: userData.profile_image_url,
        followers_count: userData.public_metrics?.followers_count,
        following_count: userData.public_metrics?.following_count,
        tweet_count: userData.public_metrics?.tweet_count
      };
    } catch (error) {
      console.error('Error fetching user profile:', error);
      throw error;
    }
  }
}

module.exports = TwitterService;