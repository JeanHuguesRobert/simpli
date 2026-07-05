// lib/kudocracy.js
//
// SimpliKudo - Kudocracy context generation for SimpliWiki
// Uses GitHub OAuth for authentication and allows configurable Twitter name
//
// July 2025 by @jhr - SimpliWiki revival

"use strict";

/**
 * Generate Kudocracy context for session
 * This context is passed via ?kudocracy= parameter when embedding SimpliWiki
 *
 * @param {Object} session - Session object with user info
 * @param {Object} options - Optional parameters
 * @param {boolean} options.full - Include full context (default: true)
 * @returns {Object} Kudocracy context object
 */
function generateKudoContext(session, options = {}) {
  const { full = true } = options;

  const ctx = {
    time: Date.now(),
    authentic: isGithubAuthenticated(session),
    lang: session.lang || "en",
    host: session.host || "",
  };

  // Only include these if authenticated
  if (ctx.authentic && full) {
    ctx.visitor = session.kudoTwitterName || getDefaultKudoName(session);
    ctx.can_script = session.canScript || false;
    ctx.github_login = session.githubLogin;
    ctx.github_id = session.githubId;
  }

  // Optional full context fields
  if (full) {
    ctx.url = session.url;
    ctx.current_page = session.currentPage;
  }

  return ctx;
}

/**
 * Encode context for URL parameter
 * @param {Object} session - Session object
 * @returns {string} URL-encoded JSON context
 */
function encodeKudoContext(session) {
  const ctx = generateKudoContext(session);
  const jsonStr = JSON.stringify(ctx);
  return encodeURIComponent(jsonStr);
}

/**
 * Generate Kudocracy URL for SimpliWiki page
 * @param {Object} session - Session object
 * @param {string} wikiBaseUrl - Base URL of wiki (e.g., "http://localhost:8080/")
 * @param {string} pagePath - Page path (e.g., "HomePage" or "SomeWiki/HomePage")
 * @returns {string} Full URL with ?kudocracy= parameter
 */
function generateKudoUrl(session, wikiBaseUrl, pagePath) {
  const baseUrl = wikiBaseUrl.replace(/\/$/, "");
  const path = pagePath.startsWith("/") ? pagePath : "/" + pagePath;
  const context = encodeKudoContext(session);
  return `${baseUrl}${path}?kudocracy=${context}`;
}

/**
 * Check if session is authenticated via GitHub
 * @param {Object} session - Session object
 * @returns {boolean}
 */
function isGithubAuthenticated(session) {
  return !!(session.githubId || session.githubLogin);
}

/**
 * Get default Kudo name based on GitHub login
 * @param {Object} session - Session object
 * @returns {string} Default Twitter-style name
 */
function getDefaultKudoName(session) {
  if (session.githubLogin) {
    return "@" + session.githubLogin;
  }
  return "@guest";
}

/**
 * Parse Kudocracy context from URL parameter
 * @param {string} kudoParam - URL-decoded ?kudocracy= parameter value
 * @returns {Object|null} Parsed context or null if invalid
 */
function parseKudoContext(kudoParam) {
  if (!kudoParam) return null;

  try {
    const ctx = JSON.parse(decodeURIComponent(kudoParam));

    // Validate age (1 hour max, like original Kudocracy)
    if (ctx.time) {
      const age = Date.now() - ctx.time;
      if (age > 3600 * 1000) {
        ctx.authentic = false;
        ctx.expired = true;
      }
    }

    return ctx;
  } catch (e) {
    console.error("Failed to parse Kudocracy context:", e);
    return null;
  }
}

/**
 * Verify Kudocracy context integrity
 * @param {Object} ctx - Context object from parseKudoContext
 * @returns {boolean} True if context is valid and authentic
 */
function verifyKudoContext(ctx) {
  if (!ctx) return false;
  if (ctx.expired) return false;
  return ctx.authentic === true;
}

// Export functions
exports.generateKudoContext = generateKudoContext;
exports.encodeKudoContext = encodeKudoContext;
exports.generateKudoUrl = generateKudoUrl;
exports.isGithubAuthenticated = isGithubAuthenticated;
exports.getDefaultKudoName = getDefaultKudoName;
exports.parseKudoContext = parseKudoContext;
exports.verifyKudoContext = verifyKudoContext;

// section: end kudocracy.js
