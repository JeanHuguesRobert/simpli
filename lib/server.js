// lib/server.js
//   the http server
//
// Jun 13 2014 by @jhr, extracted from simpliwiki big file
// Dec 16 2014 by @jhr, link to kudocracy
//
// I currently don't use any framework, nor connect, nor express, nor kao
// nor anything. This was probably a good idea in 2010 but not so much
// nowadays.
//
// There are some advantages however, speed maybe. And full control. Plus
// you don't need to understand anything external.

var Sw      = global.Sw;
var Wiki    = require( "./wiki.js"    ).Wiki;
var Uglify  = require( "./css.js"     ).Uglify;
//var Section = require( "./section.js" ).Section;

function map(){
  return Object.create( null ); // Like {} but really empty
}

// Singleton root wiki dispatches requests to child wikis
var TheRootWiki = new Wiki( null, "", null );

// I cache static files
var StaticFileCache = map();

Sw.fileIsCached = function( file ){
  file = "/" + file;
  return !!StaticFileCache[ file ];
};

Sw.getCachedFileContent = function( file ){
  file = "/" + file;
  return StaticFileCache[ file ].data;
};

Sw.cacheFile = function( file, mime, data ){
// Add a "pseudo" file to the static file cache
  file = "/" + file;
  StaticFileCache[ file ] = {
    mimetype: mime,
    code:     200,
    encoding: "utf8",
    data:     data
  };
};

Sw.cacheHtmlFile = function( name, content ){
// Like SW.cacheFile() but with one less parameter
// ToDo: some compression?
  return Sw.cacheFile( name, "text/html", content );
};

Sw.cacheCssFile = function( name, content ){
// Like SW.cacheFile() but with one less parameter
// ToDo: some compression?
  return Sw.cacheFile( name, "text/css", content );
};

Sw.cacheTxtFile = function( name, content ){
// Like SW.cacheFile() but with one less parameter
// ToDo: some compression?
  return Sw.cacheFile( name, "text/plain", content );
};

Sw.cacheJsFile = function( name, content ){
// This is a special version of SW.cacheFile() that deals with .js files.
// When posible, it caches two versions, the normal version and the Uglified
// version. However, even when the Uglify package is not there, the normal
// version is "slightly" uglified, some comments are removed (I hope this is
// safe).

  // Comments removal
  content = content.toString().replace( /[^\\:]\/\/.*(?=[\n\r])/g, '' );
  Sw.cacheFile( name, "text/javascript", content );

  // If no Uglify, copy "normal" version in .min
  if( !Uglify ){
    Sw.cacheFile(
      name.replace( /.js$/, ".min.js" ),
      "text/javascript",
      content
    );
  }

  // Let's get ugly
  // ToDo: uglify
};

// I add some "pseudo" files in the cache

// Credits: https://github.com/brianleroux/Google-Code-Prettyfy-for-NodeJS
var Prettyfy = null;
try{
  Prettyfy = require( "prettyfy" );
}catch( err ){
  trace( "npm prettyfy to get prettyfied source code" );
}

// Style for Google's Prettyfy
Sw.cacheFile(
  "prettyfy.css",
  "text/css",'\
body { font-family: monospace; }\n\
/* google code prettyfy classes */\n\
.str{color:#008}\
.kwd{color:#800}\
.com{color:#000}\
.typ{color:#606}\
.lit{color:#066}\
.pun{color:#660}\
.pln{color:#444}\
.tag{color:#040}\
.atn{color:#606}\
.atv{color:#080}\
.dec{color:#606}\
pre.prettyprint{padding:2px;border:1px solid #888}\
@media print{.str{color:#060}.kwd{color:#006;font-weight:bold}.com{color:#600;font-style:italic}.typ{color:#404;font-weight:bold}.lit{color:#044}.pun{color:#440}.pln{color:#000}.tag{color:#006;font-weight:bold}.atn{color:#404}.atv{color:#060}}\n\
'
);


// Prefetch a bunch of files in the cache
Sw.cacheCssFile( "simpliwiki.css",   Sw.style );
Sw.cacheCssFile( "minimum.css",      Sw.minimumStyle );
Sw.cacheJsFile(  "sw_load.js",       Session.loadScript );
Sw.cacheJsFile(  "sw_api.js",        Session.apiScript );
Sw.cacheJsFile(  "sw_angularize.js", Session.angularizeScript );
Sw.cacheJsFile(  "sw_scrollcue.js",  Wiki.scrollcueScript );
Sw.cacheJsFile(  "sw_wikify.js",     Session.wikifyText );

// Goodies
Sw.cacheHtmlFile( "with.google",
  '<html>'
+ '<head>'
+ '<title>' + SW.name + '</title>'
+ '<link rel="shortcut icon" href="/yanugred16.png" type="image/png" />'
+ '</head>'
+ '  <frameset cols="25%,*"> '
+ '    <frame src="comeback"/>'
+ '    <frame src="http://google.com"/>'
+ '  </frameset>'
+ '</html>'
);
Sw.cacheHtmlFile( "avec.google", StaticFileCache["/with.google"].data );

Sw.cacheHtmlFile( "simpliwiki.html",
  '<html>'
+ '<head>'
+ '<title>' + SW.name + '</title>'
+ '<link rel="shortcut icon" href="/yanugred16.png" type="image/png" />'
+ '</head>'
+ '  <frameset cols="*,*"> '
+ '    <frame src="comeback"/>'
+ '    <frame src="http://simpliwiki.com"/>'
+ '  </frameset>'
+ '</html>'
);

// channel.html is a Facebook connect related file.
// This page is loaded in the background for cross domain communication. 
// See http://developers.facebook.com/docs/reference/javascript/fb.init/
// which says: "You MUST send valid Expires headers and ensure the channel
// file is cached by the browser. "
// However, I don't send a valid Experires header, I use "Cache-Control" with
// a "max-age" directive instead and it seems to work well.
// See http://www.w3.org/Protocols/rfc2616/rfc2616-sec14.html
Sw.cacheHtmlFile( "channel.html",
  '<script src="http://connect.facebook.net/en_US/all.js"></script>'
);


// Here comes the HTTP handler
Sw.nr = 0; // Total number of requests

Sw.handler = function handler( req, res ){
// ToDo: Factor out file management

  this.deep_http_de&&bug( "HTTP request; req:" + Sys.inspect( req ) );
  Sw.nr++;

  // Show referers, to detect who is interested in simpliwiki
  if( req.headers.referer
  && !req.headers.referer.includes( "simpliwiki.com")
  && !req.headers.referer.includes( "virteal.com")
  && !req.headers.referer.includes( "kudocracy.com")
  ){
    bug(
      "r:", Sw.nr,
      "referer:", req.headers.referer,
      "url:", req.url
    );
    // ToDo: log this for analysis?
  }

  // Attach response to request, I don't get why nodejs don't do that by dflt
  req.response = res;

  // Experimental, global context
  Contexted.scope ={ req: req };

  // Ask the root wiki to deal with the request, it may refuse
  if( TheRootWiki.processHttpRequest( req ) )return;

  // Serve the request myself
  var pathname = Url.parse( req.url ).pathname;
  TheRootWiki.deep_http_de&&bug( "HTTP pathname: " + pathname );
  
  // Basic web server for static files
  
  // / with no path leads to index.html, a cached file
  if( pathname == "/" ){ pathname = "/index.html" }
  
  // Get rid of directory names, static files are in current working directory
  // However, bower components are sourced from a distinct directory
  // See SW.static_dir and SW_bower_dir
  if( !"/bower/".starts( pathname ) ){
    var ii = pathname.lastIndexOf( "/" );
    if( ii > 0 ){ pathname = pathname.substr( ii) }
  }
  
  // In production, I shall usually serve static pages using nginx
  // See also /etc/nginx/sites-available/SimpliWiki
  
  // Static files are small, I keep them in memory
  var cached = StaticFileCache[ pathname ];
  
  // Compute encoding & mimetype based on file extension
  var mimetype;
  var encoding;
  if( cached ){
    mimetype = cached.mimetype;
    encoding = cached.encoding;
  }else{
    mimetype = "text/plain";
    encoding = "binary";
    var ext = extname( pathname );
    if( ext == ".css"  ){ mimetype = "text/css" }
    if( ext == ".html" ){ mimetype = "text/html" }
    if( ext == ".png"  ){ mimetype = "image/png" }
    if( ext == ".gif"  ){ mimetype = "image/gif" }
    if( ext == ".jpg"  ){ mimetype = "image/jpeg" }
    if( ext == ".js"   ){ mimetype = "text/javascript" }
    NDe&&bug( "Mimetype: " + mimetype );
    if( "text".starts( mimetype ) ){
      encoding = "utf8";
    }else{
      encoding = "binary"
    }
  }
  
  var send = function( code, data ){
    
    NDe&&bug( "Request headers: ",  Sys.inspect( req.headers ) );
    NDe&&bug( "Response headers: ", Sys.inspect( headers ) );
    
    var cache_data = data;
    
    // Reduce cache delay when in debug mode
    var cache_control = (De ? "300" : "" + 30 * 24 * 3600 )
    // Some hand tuning
    if( De
    && "/1.png /2.png /yanugred64.png /yanugred16.png".includes( pathname )
    ){
      cache_control = "" + 30 * 24 * 3600;
    }
    cache_control = "max-age=" + cache_control // + ", public", useless?
    
    // index.html is half static, half dynamic... nice hack
    if( pathname == "/index.html"
    ||  pathname == "/simpli.html"
    ){
      // Include cookie data to log in back in previous wikis
      // I do that because client side I get nothing in document.cookie
      data = data.replace(
        '<div id="sw_comeback"></div>',
        '<script>var sw_cookies = "'
        + encodeURIComponent( req.headers.cookie)
        + '" </script>\n'
      )
      // Don't cache and don't even store, codes...
      cache_control = "no-store"
    }
    
    // Send answer to request
    // ToDo: should filter out HEAD requests
    var headers = [
      [ "Server",         "SimpliWiki" ],
      [ "Content-Type",   mimetype ],
      [ "Content-Length", data.length ],
      [ "Cache-Control",  cache_control ]
    ];
    res.writeHead( code, headers  );
    res.write(     data, encoding );
    res.end();
    
    // Update cache
    // ToDo: limit size of cache?
    StaticFileCache[ pathname ] = {
      mimetype: mimetype,
      code:     code,
      encoding: encoding,
      data:     cache_data
    };
  };
  
  // Disallow robots unless custom domain
  // ToDo: Should be handled by the target wiki, not here
  if( pathname == "/robots.txt" ){
    De&&bug( "robot: ", pathname )
    return send(
      200,
      ""
      // Disable sitebot.org, don't known what it does but it's too much
      + 'user-agent: sitebot\n'
      + 'disallow: /\n'
      + 'User-agent: *\n'
      + 'Allow: /index.html\n'
      + 'Allow: /\n'
      + 'Disallow:' + ( req.custom ? "\n" : " /.\n" )
    );
  }
  
  if( cached ){
    var data = cached.data;
    send( cached.code, data );
    return;
  }
  
  // Not cached, read from filesystem
  var true_path;
  // Bower compenents, including Angular are special
  if( "/bower/".starts( pathname ) ){
    true_path = pathname.replace( "/bower", SW.bower_dir || SW.static_dir || "." )
  // Other stuff must come from "static" directory
  }else{
    true_path = ( SW.static_dir || "." ) + pathname;
  }
  Fs.readFile( true_path, encoding, function( err, data ){
    
    var code = 200;
    
    if( err ){
      code = 404;
      data = "Not Found: ." + pathname;
      encoding = "utf8";
      mimetype = "text/plain";
      De&&bug( "Not found: " + true_path + ", cwd:" + process.cwd() + ", err: " + err );
    }
    
    De&&bug( "readFile:", pathname, "code:", code );
    
    // Patch index.html
    var is_index
    =  (pathname === "/index.html")
    || (pathname === "/simpli.html")
    if( code === 200 || is_index ){
      
      if( is_index ){
        // Provide a default index.html if none was found
        if( code != 200 ){
          code = 200;
          mimetype = "text/html";
          // Minimal valid operational index.html
          data = '<!DOCTYPE HTML>\n'
          + '<html><body style="font-family: monospace;">'
          + '\n<script type="text/javascript"'
          + 'src="http://ajax.googleapis.com/ajax/libs/jquery/1.10.2/jquery.min.js">'
          + '</' + 'script>'
          + '\n<script type="text/javascript" src="sw_load.js"></script>'
          //+ 'id=' + SW.twid + '&v=1" type="text/javascript"></script>')
          + '\n<script type="text/javascript">\n'
          + 'var De = ' + (De ? "true" : "false") + ';\n'
          + 'var Session = {i18n: function( m ){return m},config:{}};\n'
          + 'var sw_ctx = {'
          +     'fbid:"' + SW.fbid
          + '", twid:"'  + SW.twid 
          + '", likey:"' + SW.likey
          + '"};\n'
          + '</script>\n'
          + '<div id="login-buttons">'
          + '<div id="sw-login"></div>'
          //+ '<div id="fb-login"></div>'
          //+ '<div id="tw-login"></div>'
          //+ '<div id="li-login"></div>'
          + '<div id="fb-root"></div>'
          + '</div>\n'
          + '<div id="sw_comeback"></div>\n'
          + '<a href="/HomePage">' + SW.name + '</a>'
          + '<hr><a href="http://simpliwiki.com">'
          +   '<img src="http://simpliwiki.com/yanugred16.png"/>'
          +   " <strong>Simpl<em>i</em>Wiki</strong>"
          + "</a>\n"
          + '</body></html>\n';
        }
        
        // Include Twitter, Facebook & co code
        data = data.replace(
          '<div id="fb-root"></div>',
          '<div id="fb-root"></div>'
          + Session.htmlScript( 
            'var sw_ctx = {'
            + 'twid:"'  + SW.twid
            + '"};'
          )
          + Session.htmlScript( Session.signinScript, true ) // sync
          + Session.htmlScript(
            "loadfire(); loadfire.event( function( fire ){"
            + "if( !window.onFooterDisplay ) return;"
            + "onFooterDisplay( true, true); return true })"
          )
        );
        // Include code to log in back in previous wikis
        data = data.replace(
          '<div id="sw_comeback"></div>',
          '<div id="sw_comeback"></div>'
          + Session.htmlScript( Session.comebackScript )
        );
      }
      // Some basic minification, hopefully harmless, remove comments (// comment)
      if( ".js".ends( pathname )
      // ToDo: this breaks angular.js
      && !"/bower/".starts( pathname
      )){
        data = data.replace( /[^\\:]\/\/ .*(?=[\n\r])/g, '' );
      }
    }
    send( code, data );
  });
};

var Server = Http.createServer( Sw.handler )
// ToDo
// HttpsServer = https://tootallnate.net/setting-up-free-ssl-on-your-node-server

if( !De ){
  process.on( "uncaughtException", function( err ){
    console.log( "uncaughtException, err:", Sys.inspect( err ) );
    TheRootWiki.error( "BUG: Some serious error: ", Sys.inspect( err ) );
    if( err && err.stack ){
      console.log( err.stack );
    }
    // ToDo: throw err?
  });
}

// Capture SIGINT to avoid rare truncated files
// ToDo: this does not seem to work, I don't see the trace
// Well... maybe it works somehow. But as a result Ctrl-C does not stop the
// process if it entered an infinite loop...
// kill -9 works better in that later case...

Sw.sigint = false;
process.on( "SIGINT", function siginting(){
  if( Sw.sigint ){
    // Panic
    process.exit( 2 );
  }
  Sw.sigint = true;
  setTimeout( function defered_exit(){
    bug( "SimpliWiki, bye bye" );
    process.exit( 0 );
  }, 100 );
});

require( "./globals" ).inject({
  TheRootWiki: TheRootWiki,
  Sw:          Sw,
  Server:      Server,
  Prettyfy:    Prettyfy
}, exports );
// section: end server.js
