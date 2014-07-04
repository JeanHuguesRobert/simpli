// ---------------
// section: css.js
// This is a dynamically generated css definition that is embedded in all pages.
// ToDo: split in two part: static & dynamic, so that static part is cached in
// browser. This is easy because, so far, the "dynamic" part is rather static too,
// it is defined once, at startup, here.
// ToDo: reset?, see http://meyerweb.com/eric/thoughts/2011/01/03/reset-revisited/

var Sw = global.Sw;


// This seems to be the "minimum" to have some desired effects:
// - menu that fades
// - textarea that overlaps normal content exactly
// The main trick is about using a monospace font. Without it, the font
// resizing basically fails.
Sw.minimumStyle = "\
#sw_tooltip {z-index:+2;background-color:white;}\n\
#unfadder {position:fixed;top:0;background-color:white;}\n\
#header {position:fixed;top:0;z-index:+1;background-color:white;}\n\
#header_content>div{display:inline;}\n\
#container {margin:2em auto;font-family: monospace;}\n\
#sizer {font-family:monospace;position:absolute;}\n\
.content {text-wrap:unrestricted;word-wrap:break-word;white-space:pre-wrap;}\n\
#content_editable {display:none;}\n\
#previous_content{display:none;}\n\
textarea {font-size:1em;text-wrap:unrestricted;white-space:pre-wrap;overflow:hidden;width:inherit;\
line-height:inherit;border:0;padding:0;outline:none;}\n\
p {word-wrap: break-word;}\n\
pre {white-space: pre-wrap;}\n\
"

Sw.padding = 'padding: 0px 1em 0px 1em;'
Sw.font
= 'font-family: "Droid Sans", Verdana, Arial, sans-serif;'
Sw.monofont
= 'font-family: "Droid Sans Mono", Monaco, Consolas, "Lucida Console", monospace;'

// ToDo: reset?
// See http://meyerweb.com/eric/tools/css/reset/
SW.dark_red = "B01"; // was "942" before 2014
Sw.style = [
'',

'html {',
  'font-size: 100%;',
  'overflow-y: scroll;',	// Force scrollbar to avoid "centering jumps"
'}',

'body {',
  //'background-color:#fff;',
  'margin:0px;',		// Becomes 0px on touch devices
  Sw.font,
  'line-height: 1.35em;',	// Becomes 1em on touch devices
  'color: #444;',
  // Very light (but still too much, hence => commented out)
  // 'text-shadow: #DDD -0.03em -0.03em 0.05em;',
  //'position: relative;',
  //'cursor: default;',
'}',

'#sw_tooltip {',
  'display: none;',
  'background: white;',
  'padding: 0px 0.5em 0px 0.5em;',
  'color: #444;',
  'border: 2px solid lightgray;',
  'max-width: 20em;',
  'word-wrap: break-word;',
  'z-index: 20;', // overlap content & header. Note: +2 breaks lesscss.org
'}',


'#unfadder {',
  'position: fixed;',
  'top: 0;',
  'margin: 0px 0.3em;',
  'padding: 0px 0.3em;',
  //'font-weight: bold;',
  //'color:#' + SW.dark_red + ';',
  'background-color: #FFBABA;',
  '-moz-border-radius: 0.3em;',
  '-webkit-border-radius: 0.3em;',
  '-khtml-border-radius: 0.3em;',
  'border-radius: 0.3em;',
'}',

// The header of page is the "top menu"
// ToDo: rename #topmenu
'#header {',
  'position: fixed;',
  'top: 0;',
  'width: 100%;',
  'border-bottom: 1px solid #BBB;',
  // http://www.color-hex.com/color/99CCFF
  // LIGHTSKYBLUE, Very light azure
  // http://www.colourlovers.com/palette/1332459/SL_cloud
  'background-color: #9CF;',
  'color: #BBB;',
  'line-height: 1.35em;',
  'text-wrap: normal;',
  'word-wrap: break-word;',
  '-moz-user-select:none;',
  '-webkit-user-select:none;',
  'cursor:default;',
  'z-index: 10;', // Overlap content
'}',

// The top menu is made of a list of inlined div enclose in the #header_content div
'#header_content{',
  'margin: 0px 0.3em;',
  'text-align: center;',
'}',

'#header_content>div{',
  'display: inline;',
'}',

// Inside the top menu, items on the left are about the current wiki
'.top_left {',
  'float:left;',
  'border-bottom: 1px dotted blue;',
  'text-align: left;',
'}',

// Inside the top menu, items on the center are about the current page
'.top_center {',
  // 'border-bottom: 1px dotted white;',
  //'width: auto;',
  //'margin-left:auto;',
  //'margin-right:auto;',
  //'text-align: center;',
'}',

// Inside the top menu, items on the right are about the current user
'.top_right {',
  'float:right;',
  'border-bottom: 1px dotted red;',
  'text-align: right;',
'}',

'.hide {',
  'display: none',
'}',

'#header a {',
  'color: #333;',
'}',
'#header a:hover {', 
  'border-radius: 0.3em;',
  '-moz-border-radius: 0.3em;',
  '-webkit-border-radius: 0.3em;',
  '-khtml-border-radius: 0.3em;',
  'box-shadow: 0px 0px 10px #666;',
  '-moz-box-shadow: 0px 0px 10px #666;',
  '-webkit-box-shadow: 0px 0px 10px #666;',
  'color: #' + SW.dark_red + ';',
  'background-color: #FFBABA;', // pale red
  'text-decoration: none;',
'}',

'#container {',
  'margin: 2em auto;',
  Sw.monofont,
'}',

'#sizer {',
  'position: absolute;',
  Sw.monofont,
  'font-size: 1em;',
  'left:0px;',
  'top: 0px;',
  'padding: 0px 0px 0px 0px;',
  'margin: 0px 0px 0px 0px;',
  'color: transparent;',
  'line-height: inherit;',
  'text-shadow: none;',
'}',

'table {',
  'border-spacing: 0px 0px;',
  'margin: auto;',
'}',

'.content {',
  // I really want text to look exactly as typed in the textarea, with
  // wrapping breaking long word like long urls for example
  'text-wrap: unrestricted;',
  'word-wrap: break-word;',
  //'word-break: break-all;',
  'white-space: pre-wrap;',
  'border: 2px solid lightgray;',
  'border-top-style: none;',
  'border-bottom-style: none;',
  'margin: auto;',
  'text-align:left;',
  'vertical-align: top;',
  Sw.padding,
  'min-height: 240px;',
  // For noscript, will be about 50 characters wide with monospace font
  'width: 31.5em;',
  'background-color: #fdfdfa;',
'}',

'.sw_markdown {',
  'white-space: normal;',
  Sw.font,
'}',

'.angular {',
  'white-space: normal;',
'}',

'.content a {',
  '/* matrix color: lightgreen;*/',
  '/*text-decoration: underline;*/',
'}',

'#content_header {',
  'margin-bottom: 1em;',
'}',

'#content_text {',
  'display: inherit;',
'}',

'#content_edit {',
  'display: inherit;',
  'background-color: #F0F0F0;',
'}',

'#content_editable {',
  'display: none;',
  'background-color: #F0F0F0;',
'}',

'textarea {',
  Sw.monofont,
  'font-size: 1em;',
  'line-height: inherit;',
  'width: inherit;',
  'text-wrap:unrestricted;',
  'white-space: pre-wrap;',
  'border: 0px solid transparent;',	// ToDo: 1 px border?
  'outline: none;',
  'padding: 0px 0px 0px 0px;',
  'margin: 0px 0px 0px 0px;',
  'background-color: transparent;',
  'overflow: hidden;',
'}',

'#previous_content{',
  'border: 2px solid lightgray;',
  'border-top-style: none;',
  'border-bottom-style: none;',
  Sw.padding,
  'display: none;',
'}',

'#previous_content_header {',
  'display: inherit;',
  'margin-bottom: 2em;',
'}',

'#sw_traces {',
  'font-size: 9px;',
  'background-color: #000;',
  'color: #eee;',
'}',

'#sw_notifications {',
  'font-size: 1em;',
  'background-color: #EEF;',
  'color: #9CF;',
  'position: fixed;',
  'top: 0px;',
  'right: 0px;',
  'margin-right: 1em;',
  'margin-top: 2em;',
  'margin-left: auto;',
  // Becomes "inline" when page is ready (to avoid strange effect in Opera)
  'display: none;',
'}',

'.sw_boxed {',
  '-webkit-box-shadow: #EEE 0px 0px 6px;',
  '-moz-box-shadow: #EEE 0px 0px 6px;',
  '-box-shadow: #EEE 0px 0px 6px;',
  'border-color: initial;',
  'border-style: initial;',
  'border-bottom-left-radius: 1em 0.5em;',
  'border-bottom-right-radius: 1em 3em;',
  'border: 1px solid #CCC;',
  'border-top-left-radius: 1em 3em;',
  'border-top-right-radius: 1em 0.5em;',
  'margin: 0px auto;',
  'max-width: 30em;',
  'width: auto;',
  'padding: 0.5em;',
'}',

'.sw_boxed ul {',
  '-webkit-padding-start: 1em;',
  'list-style-type: disc;',
'}',

'#footer {',
  //'position: fixed;',
  //'bottom: 0;',
  'width: 100%;',
  'min-height: 400px;',
  'border-top: 1px solid #BBB;',
  'border-bottom: 1px solid #BBB;',
  //'background-color: #EEE;',
  'color: #999;',
  'word-wrap: break-word;',
  '-moz-user-select:none;',
  '-webkit-user-select:none;',
  'cursor:default;',
  'line-height: 1.2em;',
'}',

'#footer_content {',
  'margin: 0px 0.3em;',
'}',

'#gotop {',
 'float: right;',
'}',

'#login {',
  //'vertical-align: text-top;',
  'text-align: right;',
'}',

'#sw-login-box {',
  'display: inline-block;',
  'min-height: 24px;',
  'max-height: 24px;',
  'width: auto;',
  'background-color: #99CCFF;',
  'color: #444;',
  'font-family: monospace;',
  'font-size: small;',
  'padding: 0 0.5em;',
'}',

// Avoid flicker
'#sw-login {',
  'min-height: 29px;',
'}',
'#tw-login {',
  'min-height: 29px;',
'}',
'#li-login {',
  'min-height: 29px;',
'}',
'#fb-login {',
  'min-height: 29px;',
'}',
'.fb_iframe_widget {',
  'min-height: 187px;',
'}',
        
'#footer_content a {',
  'color: #777;',
'}',

'#powered {',
  'text-align: right;',
  'font-size: 60%;',
  Sw.monofont,
'}',

'#footer_content a:hover {',
  'border-radius: 0.3em;',
  '-moz-border-radius: 0.3em;',
  '-webkit-border-radius: 0.3em;',
  '-khtml-border-radius: 0.3em;',
  'box-shadow: 0px 0px 10px #666;',
  '-moz-box-shadow: 0px 0px 10px #666;',
  '-webkit-box-shadow: 0px 0px 10px #666;',
  'color: #' + SW.dark_red + ';',
  'background-color: #FFBABA;',	// pale red
  'text-decoration: none;',
'}',

// Avoid hover box shadow on Shareaholic links
'#footer_content ul.socials a:hover {',
  'border-radius: 0;',
  '-moz-border-radius: 0;',
  '-webkit-border-radius: 0;',
  '-khtml-border-radius: 0;',
  'box-shadow: none;',
  '-moz-box-shadow: none;',
  '-webkit-box-shadow: none;',
'}',

'input {',
  'background-color: transparent;',
  Sw.font,
  'font-size: 1em;',
  'color: #555;',
  'margin: 0.3em 0px 0px 0px;',
  'border: 1px solid #AAA;',
  '-moz-border-radius: 0.3em;',
  '-webkit-border-radius: 0.3em;',
  '-khtml-border-radius: 0.3em;',
  'border-radius: 0.3em;',
'}',

'input:hover {',
  'color: #' + SW.dark_red + ';',
  'background-color: #FFBABA;',
  'text-decoration: none;',
  'border-radius: 0.3em;',
  '-moz-border-radius: 0.3em;',
  '-webkit-border-radius: 0.3em;',
  '-khtml-border-radius: 0.3em;',
  'box-shadow: 0px 0px 10px #666;',
  '-moz-box-shadow: 0px 0px 10px #666;',
  '-webkit-box-shadow: 0px 0px 10px #666;',
'}',

'input:focus {',
  'background-color: transparent;',
'}',

'#send {',
  'color: red;',        // "Send" button, very visible
'}',

'p {',
  'word-wrap: break-word;',
'}',

'img {',
  'border-top-color: #000000;',
  'border-left-color: #000000;',
  'border-right-color: #000000;',
  'border-bottom-color: #000000;',
  'border-top-width: 0;',
  'border-left-width: 0;',
  'border-right-width: 0;',
  'border-bottom-width: 0;',
  'border-top-style: none;',
  'border-left-style: none;',
  'border-right-style: none;',
  'border-bottom-style: none;',
  'vertical-align: middle;',
'}',

'a {',
  'color:#33A;',	// Classic blue
  'text-decoration:none;',
'}',

'a:visited {',
  'color:#33A;',	// Classic blue
  //'text-decoration:none;',
'}',
//'a:link.hot {',
'.hot strong {',
  'color: #' + SW.dark_red + ';',	// Very visible, dark red
'}',
//'a:link.hothot {',
'.hothot strong {',
  'color: red;',	// Very very very visible
'}',
//'a:visited.hot {',
//  'color: #' + SW.dark_red + ';',	// Very visible, dark red
//'}',
//'a:visited.hothot {',
//  'color: #red;',	// ToDo: does not work, due to &time= in url
//'}',
/*
'a:hover {',
  'color: #' + SW.dark_red + ';',
  'background-color: #FF9900;',
  'text-decoration: none;',
'}',*/
'a:hover, a.hover {',
  'text-decoration: underline;',
'}',

'b {',
  'color: #222;',	// Slightly more visible
'}',

'i {',
  'font-style: italic;',
  // Droid Sans has no italics on Opera... revert to Mono that has them...
  Sw.monofont,
'}',

'em {',
  'font-style: normal;',
  //'font-weight: bold;',
  'color: #' + SW.dark_red + ';', // Very very visible, dark red
'}',

'strong {',
  // ToDo: figure out a better way to display WikiWords
  // I currently use <strong>W</strong>iki<strong>W</strong>ords
  //'font-weight: normal;',	// Bold is to "heavy"
  //'color: #000;',
  //'text-shadow: 0px 0px 2px;',	// strange "bold", ToDo: 1px?
  //'text-shadow: 0px 0px 2px #666;',	// #666, else... transparent in webkit
'}',

'cite {',
  'color: #222;',
  'font-style: italic;',
  //'font-weight: bold;',	// italic+bold would be too much
  Sw.monofont,
'}',

// Markup language
'dfn {',
  'color: #BBB;',	// Much less visible
'}',
'dfn:hover {',
  'color: #555;',	// Visible
'}',

'var {',
  'font-size: 0px;',
  'color: #FFF;',
'}',

'code {',
  'font-family: monospace;',
  'font-size: 80%;',
  'line-height: 1.4em;',
  'color: #004600;',
'}',

'code.sw_markdown {',
  'font-family: monospace;',
  'font-size: 100%;',
  'line-height: 1.35em;',
  'color: #004600;',
'}',

'span.twitter {',
  'background-color: #9AE4E8;',
'}',

'span.diff {',
  'background-color: yellow;',
'}',

'div.yaml {',
  'color: #CCC;',		// Less visible
'}',
'div.yaml:hover {',		// Dark green
  'color: #004600;',
'}',

'time {',
  // Less visible
  'color: #BBB;',
  // "hint" for user, ISO format matters, make it visibly detected
  'font-style: italic;',
  // Lessen noise (when visible, like when selected for copy/paste)
  'text-transform: lowercase;',
'}',

// Hide ISO noise, but keep content copy/paste friendly
'time > i {',
  'color: transparent;',
  // Hide shadow too...
  'text-shadow: none;',	
'}',
// de-em the micro seconds, but still copy/paste friendly
'time > em {',
  'font-size: 0px;',
  'color: transparent;',
  'text-shadow: none;',		// Hide shadow too...
'}',
'time:hover {',
  'color: #555;',
'}',

// for <time>
'.recent {',
  'color: #B99;',
'}',

// for <time>
'.old {',
  'color: #DDD;',
'}',

'h1, h2, h3, h4, h5 {',
  'display: inline;', // Avoid "break", container uses "display: inline"
  SW.font,
  'margin: 0.9em 0px 0.3em;',
  'padding: 0px;',
  'line-height: 135%;',
'}',
'h1, h2, h3 {',
  'letter-spacing: -0.05em;',
'}',
'h1 {',
  'font-size: 280%;',
  'font-weight: bolder;',
'}',
'h2 {',
  'font-size: 140%;',
  'font-weight: bold;',
  //'margin-bottom: 0px;',
'}',
'h3 {',
  'font-size: 110%;',
  'font-weight: bold;',
  //'margin-bottom: 0px;',
'}',
'h4 {',
  'font-size: 85%;',
  //'margin-bottom: 0px;',
'}',
'h5 {',
  'font-size: 60%;',
  'line-height: 1.2em;',  // vs 1.35
  'font-weight: normal;',
'}',

'hr {',
  'color: #333;',
  'background-color: #333;',
  'height: 1px;',
  'border-style: solid;',
  'border-width: 0px;',
  //'border-top: 1px solid #333;',
  'width: 100%;',
  'margin: 0.5em 0px;',
'}',

'.sw_hr {',
  'display: inline-block;',
  'width: 100%;',
  'text-align: center;',
  'color: #BBB;',
'}',

// This is needed to handle "click to edit" scrolltop management
'.sw_pre_edit h1, .sw_pre_edit h2, .sw_pre_edit h3, \
 .sw_pre_edit h4, .sw_pre_edit h5 {',
  'font-size: 100%;',
  'line-height: 1.35em;',
  'margin: 0px 0px 0px 0px;',
'}',

// Markdown does not render in a "pre" preformated block, I need
// restore "normal" block behaviour for headings
'.sw_markdown h1, .sw_markdown h2, .sw_markdown h3, \
.sw_markdown h4, .sw_markdown h5 {',
  'display: block;',
'}',

'pre {',
  'line-height: inherit;',
  'white-space: pre-wrap;',
  'margin: 0px 0px 0px 0px;',
  'font-family: inherit;',
'}',

'form {',
  'padding: 0px 0px 0px 0px;',
  'margin: 0px 0px 0px 0px;',
  'border: 0px 0px 0px 0px;',
  'outline: 0px 0px 0px 0px;',
'}',

'ul {',
  'margin: 0;',
  // revert default
  '-webkit-padding-start: 2em;',
  // revert default
  '-moz-padding-start: 2em;',
  'padding-left: 1em;',
  'list-style-type: none;',
  Sw.font,
'}',

'ol {',
  'margin: 0;',
  // revert default
  '-webkit-padding-start: 3em;',
  // revert default
  '-moz-padding-start: 3em;',
  'padding-left: 1em;',
  'list-style-type: decimal;',
  'font-family: inherit;', // Mono, unless inside UL
'}',

// http://codemirror.net/
'.CodeMirror-line-numbers {',
  'width: 2.2em;',
  'color: #aaa;',
  'background-color: #eee;',
  'text-align: right;',
  'padding-right: .3em;',
  'padding-top: .4em;',
  Sw.monofont,
  'font-size: 100%;',
  'line-height: 1.35em;',
'}',

'.sw_codemirror {',
  Sw.monofont,
  'font-size: 100%;',
  'line-height: 1.35em;',
'}',

'#sw_fb_like_button {',
  'min-height: 21px;',
'}',
'.sw_fb_like_iframe {',
  'border:none;',
  'overflow:hidden;',
  'height:21px;',
'}',

'.editbox {',
  Sw.monofont,
  'font-size: 100%;',
  'line-height: 1.35em;',
'}',

'.sw_what {',
  'display: inline;',
'}',

'.sw_what_content {',
   // Not displayed initially, becomes inline when clicked
  'display: none;',
   // light yellow
  'background-color: #FFFFE0;',
'}',

// Style for the "ok" button in the notification window
'.sw_what_close {',
  'position: absolute;',
  'top: 2px;',
  'right: 3px;',
'}',

''
].join( "\n")

// Hook: SW.style
if( SW.style ){
  Sw.style = SW.style
}

// See http://lesscss.org/
// npm install less

var Less = null
try {
  Less = require( "less")
}catch( err ){
  trace( "No less, see lesscss.org")
  trace( Sys.inspect( err))
}

if( Less ){
  try{
    Less.render( Sw.style, function( e, css ){
      if( e )throw e
      Sw.style = css
    })
  }catch( err ){
    trace( "Is less broken? err:" + Sys.inspect( err))
    Less = null
  }

// If less than less, I use the strict minimum
}else{
  // ToDo: Less is currently broken, I keep to my style
  // Sw.style = SW.style || Sw.minimumStyle
}

// See https://github.com/mishoo/UglifyJS
// npm install uglify
// ToDo: install & test
var Uglify = null


require( "./globals.js" ).inject( {
  Sw:     Sw,
  Less:   Less,
  Uglify: Uglify
}, exports );
// section: end css.js
