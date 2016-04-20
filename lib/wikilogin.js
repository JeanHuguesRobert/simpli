// lib/wikilogin.js
//
// July 9 2014 by @jhr, from previous code, remove "invitation code" notion

// ---------------------
// section: wikilogin.js

var Wiki = require( "./wiki.js" ).Wiki;
var WikiProto = Wiki.prototype;

WikiProto.lookupSession = function( path, query, req ){
// This function is called by processHttpRequest() when
// a potentially "new" user visits a page (ie, no valid cid closure in query).
// It returns a closure if it manage to retrieve one or if a brand new Session
// was started.
// It returns false if this is a not a request for a wiki (ie static file).
// It returns "index.html" when path is "/comeback" but there is no cookie.
// It returns null if further processing (async) is engaged.
// That later case occurs when a wiki is created "on the fly". Once the wiki
// is created, processHttpRequest() is automatically re-entered in order to
// complete the processing of the request.

  // Get rid of invasive Baidus spider bot
  var ua = req.headers["user-agent"] || ""
  if( ua.includes( "Baidus") 
  ||  ua === "en-US, UserAgent:Mozilla/5.0 (Windows NT 5.1; rv:6.0.2) Gecko/20100101 Firefox/6.0.2"
  ){
    // Don't even answer
    // ToDo: remove this, duplicate code
    return null;
  }

  // There is already a session attached when a parent wiki did some login
  var session = req.session
  
  // Some traces in that case
  if( De && session ){
    session.login_de&&bug( "Rid:", req.deId, "lookupClone:", path)
    if( session.wiki != this ){
      session.login_de&&bug(
        "login in new sub wiki, sourceWiki:", session.wiki
      )
    }else{
      session.bug_de&&bug( "BUG? already logged, why?")
    }
  }else{
    this.deep_login_de&&bug( "Rid:", req.deId, "sessionRootLogin:", path)
  }

  // First I try to figure out what is the target wiki
  // Then I look for an associated session
  // If no valid session, I create a new one to log the user in
  
  // Handle virtual hosting for Wiki pages
  var custom    = false
  var subdomain = ""
  if( session ){
    // Don't recompute if done by parent wiki
    subdomain = session.subdomain
    custom    = session.custom
  }else{
    var host = req.headers.host // This is the target host
    if( host
    && SW.domain
    && host != SW.domain
    && !(/^[\d.]+$/.test( host)) // Not with numerical ip addresses
    ){
      this.login_de&&bug(
        "host:", host,
        "SW.domain:", SW.domain,
        "path:", path
      )
      // If target host is subdomain of configured domain
      if( SW.domain.ends( host) ){
        // Extract the subdomain part
        subdomain = host.substr(
          0,
          host.length - SW.domain.length
        )
        subdomain = subdomain.split( ".")
        subdomain = subdomain.reverse().join( "/") + "/"
        if( subdomain == "/" ){
          subdomain = ""
        }else{
          // ie "/somedomain/"
          this.login_de&&bug( "subdomain:", subdomain)
          req.subdomain = subdomain
        }
      // If target host is a whole different beast, custom domain
      }else{
        if( host.indexOf( ":") < 0 && !"localhost".starts( host) ){
          // I turn xxx.yyy.top into top_yyy_xxx/
          subdomain = host.split( ".").reverse().join( "_") + "/"
          // If SW.domain pseudo host, get rid of it, implicit
          var local_domain = SW.domain.split( ".").reverse().join( "_")
          if( local_domain.starts( subdomain) ){
            subdomain = subdomain.substr(
              0,
              subdomain.length - local_domain.length
            )
          }
          // Special treat for .com domain
          if( "com_".starts( subdomain) ){
            subdomain = subdomain.substr( "com_".length)
          }
          custom = true
          this.login_de&&bug( "custom, subdomain:", subdomain)
          req.custom = subdomain
          // See robots.txt handling, crawling is ok for custom domains only
        }
      }
    }
    // Handle "embed" & "iframe" pseudo domains
    if( /_?embed\/$/.test(  req.subdomain)
    ||  /_?iframe\/$/.test( req.subdomain)
    ){
      req.iframe    = req.subdomain.includes( "iframe/")
      req.oembed    = req.subdomain.includes( "embed/")
      req.subdomain = req.subdomain
      .replace( /_?iframe/g, "")
      .replace( /_?embed/g, "")
      .replace( "//", "")
      if( req.iframe ){
        this.de&&bug( "iframed, subdomain:", req.subdomain, "path:", path)
      }
      if( req.oembed ){
        this.de&&bug( "oembed, subdomain:", req.subdomain, "path:", path)
      }
      subdomain = req.subdomain
    }
  } // end of virtual hosting handling
  
  NDe&&bug( "Referrer: " + (req.headers.referrer || req.headers.referer))
    
  var page = req.page

  if( !page ){
    // Handle special encoded # prefix
    var wikipath = Wiki.decode( path)
    wikipath = (subdomain + path).replace( "//", "/")
    this.deep_login_de&&bug( "wikipath:", wikipath)
    wikipath = this.sanitizePath( wikipath)
    De&&mand( wikipath !== null ) // Seen once
    this.deep_login_de&&bug( "saneWikipath:", wikipath)
    // For subdomains, defaults to home page, instead of index.html
    if( subdomain && ("/" + wikipath + "/") == subdomain ){
      wikipath += "/HomePage"
    }
    page = wikipath
    this.login_de&&bug( session || this, "loginPage:", page)
    // Query specified page
    if( query && query.page ){
      // ToDo: need to handle subdomain
      page = this.sanitizePath( query.page)
      this.login_de&&bug( session || this, "queryPage:", page)
    }
    // Facebook specific. I don't know what it is about
    if( query && query.fb_page_id ){
      page = "fbpage/id" + query.fb_page_id + "/HomePage"
    }
    req.page = page
  }
  
  // Debug? debug cookie's (or query param) must match config defined value
  var cookies = req.headers.cookie
  var is_debug = false
  var configdebug = this.getRoot().config.debugCode
  if( query && query.debug ){  
    this.login_de&&bug( "debugQuery:", query.debug, "debugConfig: ", configdebug)
    is_debug =  !configdebug || query.debug == configdebug
  }else if( cookies ){
    var cookied_debug
    var match = cookies.match( /sw_debug=[^;]*/)
    if( match ){
      cookied_debug = match[0].substr( "sw_debug=".length)
      this.cookie_de&&bug( "cookiedDebug:", cookied_debug)
      is_debug =  !configdebug || cookied_debug == configdebug
      if( !is_debug ){
        this.login_de&&bug( "no debug, debugConfig:", configdebug)
      }
    }
  }

  // index.html if no better page was found
  if( !page )return false

  // Filter out some erroneous requests
  if( false && /\/in\/|\/rest\/|\/comeback\//.test( "/" + page + "/") ){
    return false
  }
 
  // Extract base name, after last / if any, that's a page name inside a wiki
  var basename  = ""
  var ii = page.lastIndexOf( "/")
  if( ii >= 0 ){
    basename  = page.substr( ii + 1)
  }else{
    basename = page
  }
  this.login_de&&bug( "page:", page, "basename:", basename)

  // Look for target wiki based on page's name with path in it (or session's)
  var wiki = session ? this : (page ? this.lookupWiki( page) : this)
  page = basename
  
  // If the wiki is initializing, I must queue the request
  if( wiki.isInitializing() ){
    wiki.login_de&&bug( session, "initializing, postpone request")
    req.queued = true
    wiki.queuedRequests.push( {req: req, wiki: this})
    // I return "null", a special value that means "please do nothing yet"
    return null
  }
  
  // Look for session using "session_id" cookie
  var id;
  if( req.headers.cookie ){
    // I look for a cookie whose name depends on the wiki's name
    // ie, there exists typically one cookie per wiki the user is connected to
    var cookies = req.headers.cookie
    var session_cookie_name = wiki.sessionIdCookieName();
    var match = cookies.match( 
      new RegExp( session_cookie_name + "=[^;]*")
    )
    if( match ){
      id = match[0].substr( (session_cookie_name + "=").length)
      this.login_de&&bug( "cookieSessionId:", id)
    }
    // ToDo: Check against "stolen" cookie
    // see http://jaspan.com/improved_persistent_login_cookie_best_practice
    // Remember that code comes from cookie, for further security check
    this.cookiedSessionId = id
    // ToDo: cipher/decipher code
  }
  // Look for session associated to code
  if( id ){
    id = id.toLowerCase().capitalize()
    this.login_de&&bug( "capitalizedSessionId:", id )
    session = wiki.allSessionsBySessionId[id]
    if( session ){
      wiki.login_de&&bug( "found session associated to id:", session)
      session.loginLog( "(session retrieved, Id" + id + ")")
      if( page ){
        session.setCurrentPage( wiki.lookupPage( page))
      }
    }
  }
  
  var referer = req.headers.referrer || req.headers.referer

  // If no valid session, create a new one or reuse current from parent wiki
  if( !session
  || (session.isAway() && session.isGone)
  || session.wiki != wiki // reuse from login in parent wiki
  || session.checkIntrusion( req)
  ){
    // index.html default is handled elsewhere
    if( wiki.isRoot() && (!page || page == "/") )return false
    // Maybe there is a session with the parent wiki?
    if( session && session == req.session && session.wiki != wiki ){
      this.login_de&&bug( session, "reuseInChildWiki: ", wiki)
      // ToDo: partial logout?, ToDo: move this into session.login()
      session.logout( "reuse")
    // Else, I need a new session object
    }else{
      if( !session ){
        wiki.login_de&&bug( "R:", req.deId, "\n\nnewLoginOn:", page)
      }else if( session.isGone ){
        session.login_de&&bug( "R:", req.deId, "goneFor: ", page)
      }else{
        session.bug_de&&bug( "BUG? need new session?, R:", req.deId)
      }
      req.session = session = new Session()
      wiki.login_de&&bug( "newSession:", session, "R:", req.deId)
    }
    if( is_debug ){
      wiki.dee&&bug( "debugMode: ", is_debug)
      session.isDebug = true
      session.setDeId( session.id)
    }
    return session.login( wiki, subdomain, custom, page, query, req)
  }
  
  // If valid session, put the visitor back to where she was
  De&&mand( session.wiki == wiki )
  var closure_f = wiki.getClosure( session.postClosureId, true)
  wiki.login_de&&bug( "returningSession:", session, "userSessionId:", 
    session.sessionId, "name:", session.userName())
  if( !closure_f ){
    De&&bug( "Bad session: ", session)
    De&&bug( "dumpSession: ", session.dump())
  }
  De&&mand( closure_f, "null closure")
  return closure_f
}

exports.Wiki = Wiki;
// section: end wikilogin.js