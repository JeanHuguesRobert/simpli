// section: depends.js
//
// Some dependencies, nodejs's builtins mainly
//
// npm less
//   to handle .less style of CSS file, see http://lessorg.com
// npm prettyfy
//   google's prettyfier for section.ized .js source files
// npm dropbox
//   dropbox support
//
// These are all optional, if they are not found life goes on without them.
//
// In addition to these modules, SimpliWiki depends on some images.
//
// In the top menu:
//   yanugred16.png
//   facebook_ico.png
//   twitter_ico.png
//   linkedin_ico.png
//   gmail_ico.png
//   yahoo_ico.png
//   dropbox_ico.png
//
// scrollcue, "powered by", shortcut icon, OneBigFile sections, etc:
//   yanugred16.png
//
// Angular support requires an angular.js file, this should be the last
// minimized version preferably (about 60kb as of feb 12 2011). Get it
// from http://angularjs.com
//
// Support for the codemirror editor is more complex to install. You need
// codemirror.js, codemirror_base.js, parsexml.js, parsecss.js,
// tokenizejavascript.js, parsejavascript.js, parsehtmlmixed.js, csscolors.css
// xmlcolors.css & jscolors.cs
// You can get those at http://codemiror.net
// I plan to use v2 some day. https://github.com/marijnh/codemirror2
// 
// ToDo: better handling of these image dependencies, make them configurable,
// auto-detected or optional somehow.

require( "./globals" ).inject( {
  Sys:          require( 'sys'),	// ToDo: move to "util" soon
  Events:       require( 'events'),
  Http:         require( 'http'),
  Fs:           require( 'fs'),
  Url:          require( 'url'),
  Net:          require( 'net'),
  ChildProcess: require( 'child_process'),
  QueryString:  require( 'querystring'),
  Crypto:       require( 'crypto'),
  Gzip:         null // ToDo: install node-compress require( 'compress').Gzip
  // Note: nginx does a good job with gzip.
} );

// section: end depends.js
