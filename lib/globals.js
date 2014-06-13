// globals.js
//   ease global stuff
//
// This is not the idiomatic nodejs style. SimpliWiki was initialy developped
// as a "one big file" with "sections". Nowadays, such sections should be
// "modules", with "exports". Until the code migrates to that idiom, I inject
// stuff in the global scope using require( "./globals" ).inject() defined
// here.
//
// Jun 11 2014 by @jhr

var All = {};
exports.inject = function inject( stuff, scope, not_global ){
  if( !arguments.length || !stuff )return All;
  if( typeof stuff === "string" )return inject( require( stuff ) );
  if( Array.isArray( stuff ) ){
    for( var ii = 0 ; ii < stuff.length ; ii++ ){
      inject( stuff[ ii ], scope, not_global );
    }
    return All;
  }
  if( typeof stuff === "function" ){
    var tmp = {};
    tmp[ stuff.name ] = stuff;
    return inject( tmp, scope, not_global );
  }
  for( var attr in stuff ){
    if( attr[0] === "_" )continue;
    if( attr === "local" ){
      inject( stuff[ attr ], scope, true );
      continue;
    }
    console.log( "Exporting " + ( not_global ? "module." : "global." ) + attr );
    if( !not_global ){
      All[ attr ] = stuff[ attr ];
      global[ attr ] = stuff[ attr ];
    }
    if( scope ){ scope[ attr ] = stuff[ attr ]; }
  }
  return All;
};

// Some global constants
var SW = {
  // Needed at startup
  version:  "0.19",
  name:     "SimpliJs",		// Name of the root wiki
  debug:    true,		// Debug mode means lots of traces
  test:     false,		// Test mode
  dir:      "",		        // Local to cwd, where files are, must exist
  port:     1234,		// 80 default, something else if behind a proxy
  domain:   "",			// To build permalinks, empty => no virtual hosting
  static:   "",			// To serve static files, optionnal, ToDo: ?
  protocol: "http://",		// Idem, https requires a reverse proxy
  fbid:     "",                 // Facebook app ID
  twid:     "",			// Twitter app ID
  likey:    "",			// LinkedIn API key
  dbkey:    "",			// Dropbox key
  dbsecret: "",			// Dropbox secret
  shkey:    "",			// Shareaholic key
  scalable: false,		// ToDo: a multi-core/multi-host version
  onload: 			// List of pages loaded at startup
    ["PrivateContext", "AboutWiki", "RecentStamps", "PrivateCodes"],
  style:    "",			// CSS string (or lesscss if "less" is found)
 
  // Patterns for valid page names, please change with great care only
  
  // ~= CamelCase, @#_[ are like uppercase, . - [ are like lowercase
  wikiwordCamelCasePattern:
    "[@#A-Z_\\[][a-z0-9_.\\[-]{1,62}[@#A-Z_\\[\\]]",
  // 3Code style
  wikiword3CodePattern:
    "3\\w\\w-\\w\\w\\w-\\w\\w\\w",
  // 4Codes
  wikiword4CodePattern: 
    "4\\w\\w\\w-\\w\\w\\w\\w-\\w\\w\\w\\w-\\w\\w\\w\\w",
  // Twitter hash tag
  wikiwordHashTagPattern:
    "#[a-z_0-9]{3,30}",
  // Twitter name
  wikiwordTwitterPattern:
    "@[a-z_0-9]{3,30}",
  // Facebook username  
  wikiwordFacebookPattern:
    "[a-z][a-z_0-9.-]{4,62}@",
  // Facebook group, ToDo: for further study
  wikiwordFacebookGroupPattern:
    "[a-z][a-z_0-9.-]{4,62}#",
  // LinkedIn screen name
  wikiwordLinkedInPattern:
    "[a-z][a-z_0-9]{4,62}In",
  // email address, very liberal but fast
  wikiwordEmailPattern:
    "[a-z][a-z_0-9.-]{1,62}@[a-z0-9.-]{5,62}",
  // Free links, anything long enough but without / & infamous <> HTML tags
  // ToDo: I also filter out .", = and ' but I should not, but that would break
  wikiwordFreeLinkPattern:
    "[A-Za-z_]*\\[[^.='\"/<>\\]]{3,62}\\]",
  // Suffix, can follow any of the previous pattern
  wikiwordSuffixPattern:
    "(([\\.][@#A-Z_a-z0-9-\\[\\]])|([@#A-Z_a-z0-9\\[\\]-]*))*",
  // Prefix, cannot precede a wikiword
  wikiwordPrefixPattern:
    "([^=@#A-Za-z0-9_~\\?&\\)\/\\\">.:-]|^)",
  // ToDo: Postfix anti pattern, cannot succede a wikiword, non capturing
  wikiwordPostfixAntiPattern: "",

  // Valid chars in 3Codes, easy to read, easy to spell
  // 23 chars => 23^8 possibilities, ~= 80 000 000 000, 80 billions
  // 4codes: 23^15 ~= a billion of billions, enough
  // Don't change that. If you change it, all exiting "public" key get confused
  valid3: "acefghjkprstuvxyz234678",	// avoid confusion (ie O vs 0...)
  
  // Pattern for dates, ISO format, except I allow lowercase t & z
  datePattern: "20..-..-..[tT]..:..:..\\....[zZ]",

  // Delays:
  thereDelay:        30 * 1000,	// Help detect current visitors
  recentDelay:  30 * 60 * 1000,	// Recent vs less recent
  awayDelay:    10 * 60 * 1000,	// Help logout old guests
  logoutDelay: 2 * 3600 * 1000,	// Help logout inactive members
  saveDelay:         30 * 1000,	// Save context delay
  resetDelay: 12 * 3600 * 1000,	// Inactive wikis are unloaded
  hotDelay:  45 * 84600 * 1000,	// Short term memory extend

  // Hooks
  hookSetOption: null, // f( wiki, key, str_val, base) => null or {ok:x,val:y}
  hookStart:     null, // Called right before .listen()

  the: "end" // of the missing comma
}

// Compute the maximum numeric value of a 3Code (or 4Code)
// These are approximates because it does not fit in a javascript 53 bits
// integer
;(function compute_max_3Code(){
  var len = SW.valid3 * len;
  // 8 chars for 3 codes, 15 for 4codes
  var nch = 8;
  var max = 1;
  while( nch-- ){ max = max * len }
  SW.max3code = max;
  // 8 + 7 is 15
  nch = 7;
  while( nch-- ){ max = max * len }
  SW.max4code = max;
})();

// String pattern for all valid Wikiwords
SW.wikiwordPattern = "("
  + "("
  +       SW.wikiwordCamelCasePattern
  + "|" + SW.wikiword3CodePattern
  + "|" + SW.wikiword4CodePattern
  + "|" + SW.wikiwordHashTagPattern
  + "|" + SW.wikiwordTwitterPattern
  + "|" + SW.wikiwordEmailPattern
  + "|" + SW.wikiwordFreeLinkPattern
  + ")"
  // All previous followed by optionnal non space stuff, but not . ending
  + SW.wikiwordSuffixPattern
+ ")";

// String pattern for all ids
SW.wikiwordIdPattern = ""
  + "("
  +       SW.wikiwordTwitterPattern
  + "|" + SW.wikiwordEmailPattern
  + ")";

// From string patterns, let's build RegExps

// Pattern to isolate wiki words out of stuff
SW.wikiwords = new RegExp(
    SW.wikiwordPrefixPattern
  + SW.wikiwordPattern
  + SW.wikiwordPostfixAntiPattern
  , "gm"
);

// Pattern to check if a str is a wikiword
SW.wikiword
  = new RegExp( "^" + SW.wikiwordPattern              + "$");
// Pattern to check if a str in an id
SW.wikiwordId
  = new RegExp( "^" + SW.wikiwordIdPattern            + "$");
// Pattern for each type of wikiword
SW.wikiwordCamelCase
  = new RegExp( "^" + SW.wikiwordCamelCasePattern     + "$");
SW.wikiword3Code
  = new RegExp( "^" + SW.wikiword3CodePattern         + "$");
SW.wikiword4Code
  = new RegExp( "^" + SW.wikiword4CodePattern         + "$");
SW.wikiwordHashTag
  = new RegExp( "^" + SW.wikiwordHashTagPattern       + "$");
SW.wikiwordTwitter
  = new RegExp( "^" + SW.wikiwordTwitterPattern       + "$");
SW.wikiwordEmail
  = new RegExp( "^" + SW.wikiwordEmailPattern         + "$");
SW.wikiwordFreeLink
  = new RegExp( "^" + SW.wikiwordFreeLinkPattern      + "$");

// Some tests
if( true ){
  var assert = function( cond, msg ){
    if( cond )return;
    console.log( "SimpliWiki Assert failure " + msg );
    throw new Error( "SimpliWiki Assert Failure " + msg );
  };
  // Smoke test
  if( !SW.wikiword.test( "WikiWord") ){
    console.log( "Pattern:", SW.wikiwordPattern);
    console.log( false, "Failed WikiWord smoke test");
  }
  // Some more tests, because things gets tricky some times
  var test_wikiwords = function(){
    function test( a, neg ){
      !neg && assert(  SW.wikiword.test( a), "false negative " + a);
      neg  && assert( !SW.wikiword.test( a), "false positive " + a);
      var match = SW.wikiwords.exec( " " + a + " ");
      if( !match ){
        assert( neg, "bad match " + a);
      }else{
        assert( match[1] == " ", "bad prefix for " + a);
        match = match[2];
        !neg && assert( match == a, "false negative match: " + a + ": " + match);
        neg  && assert( match != a, "false positive match: " + a + ": " + match);
        match = SW.wikiwords.exec( "~" + a + " ");
        if( match ){
          assert( neg, "bad ~match " + a);
        }
      }
    }
    function ok( a ){ test( a)       }
    function ko( a ){ test( a, true) }
    ok( "WikiWord");
    ok( "WiWi[jhr]");
    ok( "W_W_2");
    ok( "@jhr");
    ko( "@Jhr");
    ko( "@jhr.");
    ok( "@jhr@again");
    ko( "j-h.robert@");
    ko( "jhR@");
    ok( "#topic");
    ko( "#Topic");
    ok( "#long-topic5");
    ko( "Word");
    ko( "word");
    ko( " gar&badge ");
    ok( "UserMe@myaddress_com");
    ko( "aWiki");
    ko( "aWikiWord");
    ok( "_word_");
    ko( "_two words_");
    ok( "[free link]");
    ok( "User[free]");
    ok( "[free]Guest");
    ko( "[free/link]");
    ko( "linkedIn");
    ko( "shrtIn");
    ko( "badLinkIn");
    ok( "info@simpliwiki.com");
  };
  test_wikiwords();
}

// Each wiki has configuration options.
// Some of these can be overridden by wiki specific AboutWiki pages
// and also at session's level (or even at page level sometimes).
SW.config = 
// section: config.json, import, optional, keep
// If file config.json exists, it's content is included, ToDo
{
  lang:           "en",	// Default language
  title:          "",	// User label of wiki, cool for 3xx-xxx-xxx ones
  cols: 50,		// IETF RFCs style is 72
  rows: 40,		// IETF RFCs style is 58
  twoPanes:       false,// Use right side to display previous page
  cssStyle:       "",	// CSS page or url, it patches default inlined CSS
  canScript:      true,	// To please Richard Stallman, say false
  open:           true,	// If true everybody can stamp
  canClone:       true, // If true, clones are allowed
  veryOpen:       false,// If false, members need a mentor stamp
  veryOpenClones: true, // True if clones are very open by default
  premium:        false,// True to get lower Ys back
  noCache:        false,// True to always refetch fresh data
  backupWrites:   SW.debug,	// Log page changes in SW.dir/Backup
  mentorUser:     "",	// default mentor
  mentorCode:     "",	// hard coded default mentor's login code
  mentors:        "",	// Users that become mentor when they log in
  adminIps:       "",	// Mentors from these addresses are admins
  debugCode:      "",	// Remote debugging
  fbLike:         true,	// If true, Like button on some pages
  fetch :         "",   // space separated pages to prefetch at init
};
// section: end config.json

// Local hooks makes it possible to change (ie hack) things on a local install
// This is where one want to define secret constants, ids, etc...
// ToDo: JHR 2014, issue with search path
var Include = require( "./include.js" );
var $include = Include.$include;
global.SW = SW;
$include( "./hooks.js" );
$include( "./local_hooks.js" );
$include( "/home/jhrobert/SimpliWiki/virteal/hooks.js" );
SW.debug = true;
if( SW.name != "SimpliJs" ){
  console.log( "Congratulations, SimpliJs is now " + SW.name );
  if( SW.dir ){
    console.log( "wiki's directory: " + ( SW.wd || process.cwd() ) + "/" + SW.dir );
  }else{
    console.log( "wiki is expected to be in directory:" + ( SW.wd || process.cwd() ) );
    console.log( "See the doc about 'hooks', SW.dir in 'hooks.js'" );
  }
  if( SW.port == "1234" ){
    console.log( "default 1234 port" );
    console.log( "see the doc about 'hooks', SW.port in 'hooks.js'" );
  }
}else{
  console.log( "Humm... you could customize the application's name" );
  console.log( "See the doc about 'hooks', SW.name in 'hooks.js'" );
}

// Let's compute "derived" constants

SW.idCodePrefix = "code" + "id";

// Global variables
var Sw = {
  interwikiMap: {},	// For interwiki links, actually defined below
  sessionId: 0,         // For debugging
  currentSession: null, // Idem
  requestId: 0,
  timeNow: 0,
  dateNow: 0,
  cachedDateTooltips: {},
  inspectedObject: null
};

Sw.setTimeNow = function(){
// Update Sw.timeNow & Sw.dateNow, called often enought.
// Fast and somehow usefull to correlate traces about the same event.
// ToDo: Use V8/Mozilla Date.now() ?
  this.timeNow = (this.dateNow = new Date()).getTime();
};

Sw.age = function( time_ago ){
// Returns n millisec since time_ago
// Returns 0 if no time_ago
  return time_ago ? (Sw.timeNow - time_ago) : 0;
};

// No operation dummy function that does nothing, used as a placeholder
Sw.noop = function noop(){};

exports.inject( { SW: SW, Sw: Sw }, exports );
// section: end globals.js

