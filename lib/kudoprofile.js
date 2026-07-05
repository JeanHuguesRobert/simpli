// lib/kudoprofile.js
//
// SimpliKudo Profile management
// Allows users to configure their Kudocracy Twitter name

"use strict";

/**
 * Update Kudo Twitter name for session
 * @param {Object} session - Session object
 * @param {string} newTwitterName - New Twitter name (with or without @)
 * @returns {Object} Result {success, error, previousName, newName}
 */
function updateKudoTwitterName(session, newTwitterName) {
  if (!newTwitterName || typeof newTwitterName !== 'string') {
    return {
      success: false,
      error: 'Invalid Twitter name'
    };
  }

  // Normalize: ensure @ prefix, remove spaces, max 15 chars
  var normalized = newTwitterName.trim();
  if (!normalized.startsWith('@')) {
    normalized = '@' + normalized;
  }

  // Validate: only alphanumeric and underscore, 1-15 chars after @
  var pattern = /^@([A-Za-z0-9_]{1,15})$/;
  if (!pattern.test(normalized)) {
    return {
      success: false,
      error: 'Invalid Twitter name format (use @username, 1-15 chars)'
    };
  }

  var previousName = session.kudoTwitterName || null;
  session.kudoTwitterName = normalized;

  return {
    success: true,
    previousName: previousName,
    newName: normalized
  };
}

/**
 * Get current Kudo Twitter name for session
 * @param {Object} session - Session object
 * @returns {string|null} Current Kudo Twitter name
 */
function getKudoTwitterName(session) {
  return session.kudoTwitterName || null;
}

/**
 * Set cookie for Kudo Twitter name
 * @param {Object} res - HTTP response object
 * @param {string} twitterName - Twitter name
 * @param {number} maxAge - Cookie max age in seconds (default: 1 year)
 */
function setKudoCookie(res, twitterName, maxAge) {
  if (!maxAge) {
    maxAge = 365 * 24 * 60 * 60; // 1 year
  }

  var expires = new Date(Date.now() + maxAge * 1000);
  var cookieValue = "sw_kudo_twitter_name=" + twitterName
    + "; Path=/; Expires=" + expires.toUTCString();

  // Note: this should be added to existing Set-Cookie headers
  return cookieValue;
}

/**
 * Generate HTML for Kudo profile settings
 * @param {Object} session - Session object
 * @returns {string} HTML content
 */
function generateProfileHtml(session) {
  var currentName = getKudoTwitterName(session) || '';
  var githubName = session.githubLogin || session.twitterName || '';

  return '\
<div class="kudo-profile">\
  <h2>Kudocracy Profile Settings</h2>\
\
  <div class="kudo-profile-section">\
    <h3>Your Identities</h3>\
    <table class="kudo-identities">\
      <tr>\
        <td class="label">GitHub Auth:</td>\
        <td class="value">' + (githubName ? '@' + githubName : 'Not authenticated') + '</td>\
      </tr>\
      <tr>\
        <td class="label">Kudocracy Name:</td>\
        <td class="value">' + (currentName || '@github_' + (githubName || 'user')) + '</td>\
      </tr>\
    </table>\
  </div>\
\
  <div class="kudo-profile-section">\
    <h3>Change Kudocracy Name</h3>\
    <p class="help">Your Kudocracy name is used when generating contexts for embedded SimpliWiki instances.</p>\
\
    <form method="POST" action="/kudo-profile/update" class="kudo-form">\
      <label for="kudo_name">New Kudocracy Name:</label>\
      <input\
        type="text"\
        id="kudo_name"\
        name="kudo_name"\
        value="' + currentName + '"\
        placeholder="@username"\
        pattern="@[A-Za-z0-9_]{1,15}"\
        required\
      />\
      <button type="submit">Update Kudocracy Name</button>\
    </form>\
\
    <p class="note">\
      This name will be used as your identity when accessing SimpliWiki via Kudocracy context.\
      You are responsible for the name you choose. GitHub authentication ensures traceability.\
    </p>\
  </div>\
\
  <div class="kudo-profile-section">\
    <h3>Generate Test Context</h3>\
    <p class="help">Test your Kudocracy context generation:</p>\
    <button onclick="generateTestContext()">Generate Test Context</button>\
    <pre id="test-context" style="display:none;"></pre>\
  </div>\
</div>\
\
<script>\
function generateTestContext() {\
  var ctx = {\
    time: Date.now(),\
    authentic: true,\
    visitor: "' + (currentName || ('@github_' + (githubName || 'user'))) + '",\
    can_script: true,\
    lang: "en",\
    host: window.location.host\
  };\
  var json = JSON.stringify(ctx, null, 2);\
  var encoded = encodeURIComponent(json);\
  var result = document.getElementById("test-context");\
  result.style.display = "block";\
  result.textContent = "Context (JSON):\\n" + json + "\\n\\nEncoded:\\n" + encoded + "\\n\\nTest URL:\\n" + window.location.origin + "/HomePage?kudocracy=" + encoded;\
}\
</script>\
';
}

// Export functions
exports.updateKudoTwitterName = updateKudoTwitterName;
exports.getKudoTwitterName = getKudoTwitterName;
exports.setKudoCookie = setKudoCookie;
exports.generateProfileHtml = generateProfileHtml;

// section: end kudoprofile.js
