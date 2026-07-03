// lib/github.js
// GitHub OAuth integration for SimpliWiki
// Replaces Twitter/Facebook/LinkedIn authentication

const crypto = require('crypto');
const path = require('path');

// Load environment variables from .env file in the simpli directory
const dotenv = require('dotenv');
const envPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: envPath });

// GitHub OAuth endpoints
const GITHUB_ENDPOINTS = {
  authorizeUrl: 'https://github.com/login/oauth/authorize',
  accessTokenUrl: 'https://github.com/login/oauth/access_token',
  userApiUrl: 'https://api.github.com/user',
  userAgent: 'SimpliWiki' // GitHub requires User-Agent header
};

// Helper to get config with defaults
function getConfig() {
  return {
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackUrl: process.env.GITHUB_CALLBACK_URL || 'http://localhost:8080/auth/github/callback',
  };
}

// Generate random state for CSRF protection
function generateState() {
  return crypto.randomBytes(16).toString('hex');
}

// Store state temporarily (in production, use Redis or similar)
const stateStore = new Map();
const STATE_TTL = 10 * 60 * 1000; // 10 minutes

// Clean expired states
setInterval(() => {
  const now = Date.now();
  for (const [state, data] of stateStore.entries()) {
    if (now - data.timestamp > STATE_TTL) {
      stateStore.delete(state);
    }
  }
}, 60 * 1000); // Clean every minute

/**
 * Generate GitHub authorization URL
 * @param {string} state - CSRF protection token
 * @returns {string} Authorization URL
 */
function getAuthorizeUrl(state) {
  const config = getConfig();
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.callbackUrl,
    scope: 'read:user user:email', // Read user profile and email
    state: state
  });
  return `${GITHUB_ENDPOINTS.authorizeUrl}?${params.toString()}`;
}

/**
 * Store state for CSRF protection
 * @param {string} state - State token
 */
function storeState(state) {
  stateStore.set(state, { timestamp: Date.now() });
}

/**
 * Verify state token
 * @param {string} state - State token to verify
 * @returns {boolean} True if valid
 */
function verifyState(state) {
  const data = stateStore.get(state);
  if (!data) return false;

  // Check TTL
  if (Date.now() - data.timestamp > STATE_TTL) {
    stateStore.delete(state);
    return false;
  }

  // Remove after verification (one-time use)
  stateStore.delete(state);
  return true;
}

/**
 * Exchange authorization code for access token
 * @param {string} code - Authorization code from GitHub
 * @returns {Promise<Object>} Token response
 */
async function getAccessToken(code) {
  const config = getConfig();
  const response = await fetch(GITHUB_ENDPOINTS.accessTokenUrl, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': GITHUB_ENDPOINTS.userAgent
    },
    body: JSON.stringify({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code: code
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GitHub token exchange failed: ${error}`);
  }

  return await response.json();
}

/**
 * Get GitHub user profile
 * @param {string} accessToken - GitHub access token
 * @returns {Promise<Object>} User profile
 */
async function getUserProfile(accessToken) {
  const response = await fetch(GITHUB_ENDPOINTS.userApiUrl, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
      'User-Agent': GITHUB_ENDPOINTS.userAgent
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GitHub user fetch failed: ${error}`);
  }

  return await response.json();
}

/**
 * Complete GitHub OAuth flow
 * @param {string} code - Authorization code from callback
 * @param {string} state - State token from callback
 * @returns {Promise<Object>} User info { login, id, name, email, avatar_url }
 */
async function authenticateGithub(code, state) {
  // Verify state for CSRF protection
  if (!verifyState(state)) {
    throw new Error('Invalid or expired state token');
  }

  // Exchange code for access token
  const tokenResponse = await getAccessToken(code);

  if (tokenResponse.error) {
    throw new Error(`GitHub OAuth error: ${tokenResponse.error}`);
  }

  // Get user profile
  const user = await getUserProfile(tokenResponse.access_token);

  // Return normalized user info
  return {
    // Use GitHub login as the primary identifier
    login: user.login,
    // GitHub numeric ID
    id: user.id,
    // Display name (may be null)
    name: user.name || user.login,
    // Email (may be null/private)
    email: user.email,
    // Avatar URL
    avatar_url: user.avatar_url,
    // GitHub profile URL
    html_url: user.html_url,
    // Access token (store if you need to make API calls later)
    access_token: tokenResponse.access_token
  };
}

/**
 * Initiate GitHub login
 * @param {Object} res - HTTP response object (for redirect)
 * @returns {string} Authorization URL
 */
function initiateLogin(res) {
  const state = generateState();
  storeState(state);
  return getAuthorizeUrl(state);
}

/**
 * Handle GitHub OAuth callback
 * @param {string} code - Authorization code
 * @param {string} state - State token
 * @returns {Promise<Object>} User info
 */
async function handleCallback(code, state) {
  return await authenticateGithub(code, state);
}

/**
 * Format GitHub user as SimpliWiki username
 * Converts "githubuser" to "@githubuser" format
 * @param {Object} githubUser - User info from GitHub
 * @returns {string} Formatted username
 */
function formatUsername(githubUser) {
  return '@' + githubUser.login;
}

/**
 * Generate SimpliWiki user ID from GitHub user
 * @param {Object} githubUser - User info from GitHub
 * @returns {string} User ID in format "github123456789"
 */
function generateUserId(githubUser) {
  return 'github' + githubUser.id;
}

// Export functions
module.exports = {
  getAuthorizeUrl,
  storeState,
  verifyState,
  getAccessToken,
  getUserProfile,
  authenticateGithub,
  initiateLogin,
  handleCallback,
  formatUsername,
  generateUserId,
  // Config for debugging
  getConfig: getConfig
};
