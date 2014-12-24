// lib/sessionlogin.js
//
// July 9 2014 by @jhr, from previous code, remove "invitation code" notion
// December 16 2014 by @jhr, login via Kudocracy

// ------------------------
// section: sessionlogin.js
//
// Login in SimpliWiki is a rather complex process, with multiple inputs
// involved.

var Session = require( "./session.js" ).Session;
var SessionProto = Session.prototype;

Session.login = function( wiki, subdomain, custom, path, query, req ){
// Called by Wiki.lookupSession() when it could not connect an HTTP request
// with an existing session.
// Also .login() multiple times, with .logout( "reuse") between calls. This
// happens when a user logs into a sub wiki, as she is first logged in the
// parent wiki before being logged in the child wiki.

  var that  = this
  var relog = false
  this.wiki = wiki
  this.login_de&&bug( "Session.login")
  De&&mand( !wiki.isInitializing() || !req )

  // Detect "relog" (when session first logged into the parent wiki typically)
  if( this.config ){
    this.login_de&&bug( "relog")
    relog = true
    this.loginLog( "relog")
  }
  
  // Session inherits config from global wiki's config
  this.config = Sw.copyHash( wiki.config)
  // Parse additional session's config parameters from query string
  if( query && query.length ){
    // this.login_de&&bug( "Session.login with query parameters")
    this.wiki.setOptions(
      this.config,
      query,
      "session",
      null, // no page
      this
    )
  }
  
  // Default to HomePage
  var page = path ? path : "HomePage"
  // ToDo: url decode, for e acute style of urls
  
  // Sanitize a little
  page = page.substr( 0, 99)
  if( !page.match( SW.wikiword) ){
    page = page.replace( /\//g, "Slash")
    page = this.wikinamize( page)
    if( !page || page == "WikiWord" ){
      page = "HomePage"
    }
  }
  if( !page ) page = "HomePage"
  if( page == "/" ) page = "HomePage"
  
  this.loginPage = this.lookup( page)
  this.entryPage = this.loginPage

  this.subdomain = subdomain
  this.custom    = custom
  if( !this.sessionId ){
    this.sessionId = this.wiki.countLogins++
  }

  // Anonymous Guest by default
  this.isGuestMember = false

  this.allClosures = []
  this.viewClosureCache = {}
  if( !relog ){
    this.dateLogin  = Sw.dateNow
    this.timeLogin  = Sw.timeNow
    this.dataByPage = {}
    this.canScript  = this.config.canScript
    // Name guest using the target page, this will change maybe
    // ToDo: this is disturbing, I need a better way to handle this
    // this.loginName = this.guestnamize( page)
    this.loginName = "SomeGuest"
    // Login as guest initialy. ToDo: could handle Codexxx page here
    if( this.loginName == "HomePageGuest" ){
      this.loginName = "SomeGuest"
    }
    this.isGone = false
    this.isAuthentic   = false
    this.twitterName   = ""
    this.twitterLabel  = ""
    this.twitterId     = ""
    // ToDo: look for name= in cookies. Dec 2014, done
    if( false && query && query.kudocracy ){
      this.isKudocracy = true;
      var kudo_name = query.kudocracy.replace( /[^A-Za-z0-9_]/g, "" );
      if( kudo_name ){
        this.canScript = true;
        this.setLoginName( "@" + kudo_name );
        this.isAuthentic = true;
        this.twitterName = kudo_name.toLowerCase();
        this.twitterLabel = kudo_name;
        this.twitterId = kudo_name.toLowerCase();
      }
    }
  }
  this.isOwner      = false // Authentic twitter users "own" some wikis
  this.isCurator    = false
  this.isAdmin      = false 
  this.canCurator   = false
  this.allVisitsByPage = {} // Sw.timeNow when last visited
  this.allKnownPages   = {}
  this.allVisitedMaps  = {}
  this.allMaps         = {} 
  this.wiki.allSessions[this.sessionId] = this // ToDo ?
  this.wikiHistory     = []
  this.wikiPage        = null
  this.setCurrentPage( this.loginPage)
  this.doOnPage        = this.wikiPage
  this.localName       = wiki.name.capitalize()
  this.previousContent = ""
  this.isBehindMap     = false
  this.httpLogin = req ? req : {headers:{}} // protoGuest has no req
  this.req       = req
  this.isOembed  = this.httpLogin.oembed
  this.isIframe  = this.httpLogin.iframe

  // Tune display to get bigger characters if embedded
  if( this.isOembed || this.isIframe ){
    // this.config.rows = 10
  }
  
  // Some partial robot detection. More elaborate detection comes next
  this.isBot = req && this.wiki.isBotRequest( req)

  // Disable noisy tracing about bots (unless deep bot trace domain is on)
  if( this.isBot && !this.deep_bot_de ){
    this.debug_mode( false );
    this.de&&bug( "THIS IS NOT SUPPOSED TO BE DISPLAYED")
    this.bug_de&&bug( "NEITHER THIS")
  }

  // Start timer about age of session
  this.touch()

  // All sessions are guest session initially
  // ToDo: avoid some useless logUser
  this.wiki.logUser( this)
  var that = this

  if( req ){
    // Some messing with the user agent
    var agent = req.headers["user-agent"]
    // Detect Internet Explorer, all versions, will disable javascript for them
    // Why: better something that works poorly than not at all
    if( agent ){
      if( agent.includes( "MSIE") ){
        this.isIe = true
        if( agent.includes( "MSIE 6" ) ){
          this.isIe6
        }else if( agent.includes( "MSIE 7" ) ){
          this.isIe7
        }else if( agent.includes( "MSIE 8" ) ){
          this.isIe8
        }else if( agent.includes( "MSIE 9" ) ){
          this.isIe9
        }
      }else if( agent.includes( "Opera") ){
        this.isOpera = true
        if( agent.includes( "Wii") ){
          this.isWii = true
          // Adjust display mode for Wii
          this.config.cols = 50
          this.config.rows = 14
        }
      }
    }
    // Try to figure out the proper language
    // ToDo: Some cookie should help override this
    var langs = (query && query.lang || req.headers["accept-language"])
    if( !langs || langs == "tr-TR" ){
      langs = "en"
    }
    // A bot?
    if( agent ){
      if( agent.includes( "Googlebot") ){
        this.loginName = "GoogleBotGuest"
        this.isBot = true
      }else
      if( agent.includes( "facebook") ){
        this.loginName = "FacebookBotGuest"
        this.isBot = true
      }else
      if( agent.includes( "Pingdom") ){
        this.loginName = "PingdomBotGuest"
        this.isBot = true
    	}else
    	if( agent.includes( "Baidus") ){
    	  this.loginName = "BaidusBotGuest"
    	  this.isBot = "Baidus"
    	}else
    	if( agent.includes( "YandexBot") ){
    	  this.loginName = "YandexBotGuest"
    	  this.isBot = true
    	}else
    	if( agent.includes( "Spider") ){
    	  this.loginName = "SomeBotGuest"
    	  this.isBot = true
    	  this.de&&bug( "New spider:", agent)
      }else{
        this.de&&bug( "Weird user agent: ", agent)
      }
    }
    if( this.isBot ){
      this.config.lang = "en"
    }else{
      if( this.config.lang == "en" ){
        if( langs.includes( ",fr") ){
          this.config.lang = "fr"
          this.lang_de&&bug( "a french frog")
          if( langs.includes( "en")
          && langs.indexOf( "en") < langs.indexOf( "fr")
          ){
            this.config.lang = "en"
            this.lang_de&&bug( "Frog prefers english")
          }
        }else{
          this.config.lang = langs.substr( 0, 2)
          this.lang_de&&bug(
      	    "Auto detect lang:", this.config.lang,
            "in:", langs,
      	    "UserAgent:", agent
      	  )
      	  if( this.config.lang == "tr" ){
      	    this.lang_de&&bug( "Bot?")
      	  }
        }
      }else{
        if( this.config.lang.starts( langs)
        ||  langs.includes( "," + this.config.lang)
        ){
          // OK
        }else{
          // Revert to english
          this.config.lang = "en"
        }
      }
    }
  }

  if( query && query.length ){
    this.login_de&&bug( "loginQuery: ", Sys.inspect( query))
  }
  if( query && query.lang ){
    this.config.lang = query.lang.substr( 0, 2)
    this.lang_de&&bug( "URI specified lang: ", this.config.lang)
  }
  
  if( !relog ){
    this.postClosureId = this.registerClosure( function( that ){
      //De&&bug( Sys.inspect( this))
      that.post_de&&bug( "method:", this.method)
      if( this.method == "POST" ){
        that.processPost( this, that.getCurrentPage())
      }else{
        that.viewForm( this)
      }
      return that
    })
    // ToDo: Manage rest services
    this.restClosure = this.registerClosure( function( that ){
      NDe&&bug( "REST")
      that.rest( this)
      NDe&&bug( "REST done")
    })
    this.byeClosure = this.registerClosure( function( that ){
      // Just get out of "Curator mode"?
      if( that.isCurator ){
        that.isCurator = false
        return that.viewForm( this)
      }
      // Special case when inside Facebook canvas
      if( that.isAuthentic
      && that.wiki.name == that.facebookName + "@"
      && that.facebookIframe
      //&& that.canCurator
      // ToDo: should I check the login name?
      ){
        // Don't log out session, index.html would autolog back
        that.login_de&&bug( "facebook logout")
        that.redirect( this)
      }
      that.logout( "bye")
      // Redirect to index.html
      that.redirect( this)
      return that
    })
    this.resetClosure = this.registerClosure( function( that ){
      if( that.isCurator ){
        that.de&&bug( "Admin reset")
        that.wiki.reset()
      }
      that.viewForm( this)
    })
  
    // Remember to check session every so often
    Wiki.timeoutCheckGoneSession( this)

    // Don't assume browser can javascript, if it can it will tell us
    if( this.canScript && req ){
      // However, assume iPhone/pod/pad can script
      // I could go much further with mobiles
      // See http://wurfl.sourceforge.net/
      var ua = req && req.headers && req.headers["user-agent"]
      if( (/(iphone|ipod|ipad)/i).test( ua) ){
        this.de&&bug( "this is an iPhone/pod/pad")
        this.canScript = true
        this.isTouch   = true
      // Also assume can script if beeing embedded
      }if( this.isOembed || this.isIframe ){
        this.de&&bug( "this is embedded, assume can script")
        this.canScript = true
      // Assume can NOT script if Internet Explorer
      // Why: IE was not tested, whereas noscript should work
      }else if( this.isIe ){
        this.de&&bug( "this is Internet Explorer")
        this.canScript = false
      // Also assume can script if sw_can_script cookie was set
      }else if( this.getCookie( "sw_can_script") ){
        this.de&&bug( "sw_can_script")
        this.canScript = true
      // Or else... wait until client's signalModel() tells us (or timeout)
      }else{
        this.canScript = "maybe"
      }
      this.roundTrip = Sw.timeNow
      // If client can script, signalModel() should turn "maybe" into true 
      setTimeout(
        function(){
          if( that.canScript == "maybe" ){
            that.login_de&&bug( "No news, assume session cannot script")
            // BTW, this may help during peak hours
            // BTW, this may help detect robots
            that.canScript = false
          }
        },
        40000 // 40 secs
      )
    }
  }
  
  // Need to return a closure, see  lookupSession()
  // I can also return null if login keeps going on asynchronously
  
  // If alreay an identified User object... weird
  if( this.user ){
    this.bug_de&&bug( "Already bound to a user:", this.user)
  }

  // Get this.twitterName & id from cookies
  this.useTwitterNameCookie(  req)

  // Some additional stuff if login with one of those
  if( this.user
  || this.twitterName
  ){
    // I load the User object then I proceed with the login
    return this.trackUser( function( err, session, user ){
      // What is done here is only one part of the story, see .userFoundEvent()
      if( !err ){
        de&&mand( that == session,   "bad session, " + that + " != " + session )
        // There are cases with multiple User objects, ie conflict&merge
        if( that.user != user ){
          that.login_de&&bug( "user:" + that.user + ", andAlso:" + user )
        }
      }
      // I load the desired page and I proceed with the login 
      page = this.lookup( page)
      return page.read( function( err, page){
        // ToDo: err handling
        // First try to log owner with the right name
        if( that.isWikiOwner( "@" + that.twitterName) ){
          return that.twitterLoginForm( that.twitterName, page, req) 
        }
        if( that.isWikiOwner( that.wikiId + "-wiki") ){
          return that.wikiLoginForm( that.wikiId, page, req) 
        }
        // Not the owner, login as identified user based on cookie
        if( that.cookiedTwitterName ){
          // ToDo: err handling
          return that.twitterLoginForm( that.twitterName, page, req) 
        }
        if( that.cookiedWikiId ){
          // ToDo: err handling
          return that.wikiLoginForm( that.wikiId, page, req) 
        }
        // Not the owner, login as identified whoever knowns own
        if( that.twitterName ){
          // ToDo: err handling
          return that.twitterLoginForm( that.twitterName, page, req) 
        }
        // Supposedly never reached...
        that.bug_de&&bug( "Can't log identified user:", user)
      })
    })
    // Never reached
    that.de&&mand( false )
  }
  
  // User logged, postclosure will handle the request & render result
  this.wiki.logUser( this)
  var closure_f     =  this.wiki.getClosure( this.postClosureId, true)
  closure_f.session = this
  return closure_f
}

Session.assertIsSession = function(){ return true }

Session.isWikiOwner = function( name ){
// Whoever has a twitter name that matches the name of a wiki is considered to
// be a legitimate owner of that wiki. Match ignores #, @ and case.
// As a result, anybody can clone a wiki and be the owner of that subwiki.
// Note: see also canClone property that prevent cloning in some cases.
  // Special case for xxxx-wiki pseudo names of truly personal wikis
  if( !name )return false;
  if( "-wiki".ends( name ) ){
    if( !this.wiki.isTopLevel() )return false;
    return name === this.wiki.name;
  }
  if( name[0] !== "@" )return false;
  var wiki_name = this.wiki.name.toLowerCase()
  .replace( /#/g, "" ).replace( /@/g, "" );
  var user_name = name.toLowerCase()
  .replace( /#/g, "" ).replace( /@/g, "" );
  return wiki_name === user_name;
}

Session.fixWikiLogin = function( name, req ){
// Checks if wiki user is curator of the wiki. This is true if the wiki's
// full name is equal to the user's screen name + "-wiki"
// Also sets the login name & login page to match the owner name.
  var is_curator = this.isOwner
  // Don't recheck
  if( is_curator )return true
  if( !name ){
    if( this.user ){
      if( this.user.getWikiId() ){
        name = User.extractWikiName( this.user.getWikiId())
      }
    }
  }
  if( this.isWikiOwner( name + "-wiki" ) ){
    this.login_de&&bug( "ownerWikiUser:", name, ", curator of its own wiki")
    is_curator = true
    // ToDo: move this to loginForm() cause 
    // However: not a curator if wiki config says so
    if( this.wiki.config.curator
    &&  this.wiki.config.curator != name
    ){
      this.login_de&&bug( "notCuratorWikiUser:", name)
      this.loginLog( "owner but not configured curator, " + name)
      is_curator = false
    }else{
      this.isOwner = true
      this.loginLog( "(owner " + name + ")")
      if( this.loginName != name ){
        this.login_de&&bug( "ownerName:", name, "insteadOf:", this.loginName)
        this.setLoginName( name)
      }
    }
  }
  return is_curator
}

Session.wikiLoginForm = function( name, page, req ){
// Change session's user & right based on "authenticated" wiki name.
// Called by Session.login()
  this.login_de&&bug( "wikiLogin:", name, "page:", page)
  // If name of user matches name of wiki, make user a curator, maybe
  var is_curator = this.fixWikiLogin( name, req)
  if( is_curator ){
    this.login_de&&bug( "curator of wiki user's wiki, user:", name)
  }
  return this.userLoginForm( name, is_curator, page, req)
}

Session.fixTwitterLogin = function( name, req ){
// Checks if twitter user is curator of the wiki. This is true if the wiki's
// full name is equal to "@" plus the user's screen name.
// Also sets the login name & login page to match the owner name.
// ToDo: what if screen name changes?
  var is_curator = this.isOwner
  // Don't recheck
  if( is_curator )return true
  if( !name ){
    name = this.useTwitterNameCookie( req)
    if( !name && this.user ){
      if( this.user.getTwitterId() ){
        name = User.extractName( this.user.getTwitterId())
      }
    }
  }
  !name || (name = "@" + name)
  if( this.isWikiOwner( name)
  ||  (De && this.wiki.isRoot() && name == "@jhr")  // In debug I own the root wiki
  ){
    this.login_de&&bug( "ownerTwitteUser:", name, ", curator of its own wiki")
    is_curator = true
    // ToDo: move this to loginForm() cause 
    // However: not a curator if wiki config says so
    if( this.wiki.config.curator
    &&  this.wiki.config.curator != name
    ){
      this.login_de&&bug( "notCuratorTwitterUser:", name)
      this.loginLog( "owner but not configured curator, " + name)
      is_curator = false
    }else{
      this.isOwner = true
      this.loginLog( "(owner " + name + ")")
      if( this.loginName != name ){
        this.login_de&&bug( "ownerName:", name, "insteadOf:", this.loginName)
        this.setLoginName( name)
      }
    }
  }
  return is_curator
}

Session.twitterLoginForm = function( name, page, req ){
// Change session's user & right based on authenticated twitter name.
// Called by Session.login()
  this.login_de&&bug( "twitterLogin:", name, "page:", page)
  // If name of user matches name of wiki, make user a curator, maybe
  var is_curator = this.fixTwitterLogin( name, req)
  if( is_curator ){
    this.login_de&&bug( "curator of twitter user's wiki, user:", name)
  }
  return this.userLoginForm( "@" + name, is_curator, page, req)
}


Session.userLoginForm = function( user, is_curator, page, req ){
// This method is called after .login() if there is any information available
// to somehow identify (or even authenticate) the user.
// It is called by either twitterLoginForm() or ...

  var that = this
  this.login_de&&bug( "userLogin:", user, "curator:", is_curator, "page:", page)

  // ToDo: better authentication, it is premature to declare authentic,
  // twitter id must be checked against their signature in
  // cookies first
  // OTOH there is no signature on LinkedIn
  // Note: so far (feb 14 2011) it's the only place when isAuthentic is set
  that.isAuthentic = true

  // ToDo: is it necessary to do that again?
  //that.useTwitterNameCookie(  req)
  //that.useFacebookNameCookie( req)
  //that.useLinkedInNameCookie( req)

  // make user a curator if wiki is very open by default
  var is_very_open_by_default = this.wiki.isVeryOpenByDefault()
  if( is_very_open_by_default ){
    this.login_de&&bug( "identified users are curators of still very open wiki")
    is_curator = true
    this.loginLog( "curator, very open wiki")
  }
  
  var that = this
  var name = user
  var is_config_defined_curator = false

  // Let's have a better name of the guest
  if( this.loginName == "SomeGuest" ){
    this.setLoginName( name)
    user = this.loginName
    that.login_de&&bug( "betterName:", this.loginPage)
  }
 
  // OK, now let's find the "User" page of the member
  var userpagename
  var userpage
  userpagename = this.usernamize( user)
  userpage = this.lookup( userpagename)
  that.login_de&&bug( "user:", user, ", userpage:", userpagename)
  if( user != "SomeGuest" ){
    that.loginLog( this.i18n( "Your page: " ) + userpagename)
  }

  // If user page does not exists, create, as draft unless wiki is 100% open
  userpage.read( function( err ){
    if( userpage.isNull() ){
      that.login_de&&bug( "brandNewUserPage:", userpage.name)
      // Unless owner or 100% open, some curator need to stamp the user
      if( !that.wiki.isVeryOpen()
      && !is_very_open_by_default
      && !is_curator
      ){
        that.login_de&&bug( "newAuthenticUser: ", user,
        ", curator stamping required for membership, page:", userpage)
        that.draft( userpage)
        that.loginLog( "new user, draft page " + userpagename)
      }else{
        that.wiki_de&&bug( "newAuthenticUser: ", user, ", becomes member of wiki")
        that.loginLog( "new member, " + user)
      }
    // If page exists, extract user name from first line of text, if any
    }else{
      // This means that the user can have a local identity per wiki
      // ToDo: too confusing
      // user = userpage.getFirstUser() ? userpage.getFirstUser() : user
      if( user != name ){
        that.loginLog( that.i18n( "new name for" ) + " " + name + ", " + user)
      }else{
        that.loginLog( that.i18n( "Welcome" ) + " " + user)
      }
    }
    // Let's try to retrieve the User object asap
    if( !that.user ){
      that.user = that.wiki.lookupUser( that)
      de&&mand( !that.user || that.user.isLocal )
    }
    // More work
    that.loginForm( user, is_curator, page, req)
  })
}


Session.setLoginName = function( name, user_name ){
// Sets This.loginName && this.loginPage
  this.loginName = name
  this.loginPage = this.lookup( user_name || this.usernamize( name))
}

Session.loginForm = function( user, has_curator, page, req ){
// This method gets called by codeLoginForm() and userLoginForm()
// to handle the login, usually just after a new session is created.
// It may also be called later, see "delayed login".
// It is also called when an anonymous guest sets her name on a
// very open by default new wiki or when an anonymous member sets
// her name.
// It is WAY too complex.

  this.login_de&&bug( "loginForm, user:", user, 
    "curator: ", has_curator,
    "page:", page,
    "R:", req ? req.deId : "none"
  )

  if( !user ){
    user = "SomeOne"
    this.login_de&&bug( "no user, fallback:", user)
    this.loginLog( "fallback to SomeOne")
  }else{
    this.login_de&&bug( "foundUser:", user)
  }

  // Make sure the name is valid
  if( "@".starts( user) ){	// ToDo: is this still needed?
    user = this.wikinamize( user, null, "One")
  }else{
    user = this.usernamize( user).substr( "User".length)
    user = this.wikinamize( user, null, "One")
  }
  this.login_de&&bug( "managedUser:", user)

  // Is it a guest or a registered member?
  var is_guest = user.includes( "Guest")
  this.de&&bug( "user:", user, "isSoFar:", is_guest ? "Guest" : "Member")
  
  // A guest can never be a curator
  if( is_guest && has_curator ){
    this.de&&bug( "badGuestCurator:", user)
    has_curator = false
  }
    
  // OK, now let's find the "User" page of the member, default content is provided
  var userpage = this.lookup( this.usernamize( user))
  if( userpage.isDraft() ){
    this.deep_login_de&&bug( "draftUserPage:", userpage)
    // this.loginLog( "draft " + userpage)
  }
  
  // There must be no draft user page on just created very open wikis
  var is_very_open_by_default = this.wiki.isVeryOpenByDefault()
  if( is_very_open_by_default ){
    if( userpage.isDraft() ){
      this.bug_de&&bug( "BUG? user page is draft, page:", userpage)
      this.stamp( userpage)
      this.loginLog( "auto stamp " + userpage)
    }
  }
  
  // Get the user page
  var that = this

  // If authentic user's wiki, make sure user is not a draft
  if( that.isOwner && userpage.isDraft() ){
    that.bug_de&&bug( "Fix draft user page of owner")
    that.loginLog( "fix draft " + userpage)
    userpage.undraft()
  }

  // OK, let's get the page, it may not actually exist
  userpage.read( function( err, userpage ){
  
  // Check if member is a guest because user page is a draft or was deleted
  if( !is_guest
  && ( userpage.isDraft() || userpage.isNull() )
  ){
    // If page is empty, it should contain the user name
    if( userpage.isNull() ){
      that.login_de&&bug( "Initialize user page:", userpage)
      userpage.incarnBody( user)
      userpage.de&&mand( !userpage.isNull() )
      // Note: I don't "write" the page, useless
      //that.putPage( userpage, user, function( err ){
      //  // ToDo: err handling
      //})
    }
    // However, on very open wikis, auto stamp the user
    // Idem if user is the owner
    if( that.wiki.isVeryOpen()
    ||  is_very_open_by_default
    ||  that.isOwner
    ){
      that.de&&bug( "user:", user, "accepted as a member")
      // ToDo: I could actually ignore the "draft" status in very open wikis
      if( userpage.isDraft() ){
        that.de&&bug( "stamp owner: ", user, ", page: ", userpage.name)
        that.stamp( userpage)
        that.loginLog( "owner, auto stamp " + userpage.name)
      }
    // Else the user's page is not ok, revert member status to guest
    }else{
      that.login_de&&bug( "draftMember:", user, "page:", userpage)
      that.loginLog( "not a member, " + user)
      if( true || that.de ){
        if( userpage.isDraft()    ){
          that.loginLog( "because " + userpage + " is a draft")
        }
        if( userpage.isVoid()     ){
          that.loginLog( "because " + userpage + " is empty")
        }
        if( userpage.wasDeleted() ){
          that.loginLog( "because " + userpage + " was deleted")
        }
      }
      user = that.guestnamize( user)
      is_guest   = true
      has_curator = false
      if( userpage.name != "UserSome" ){
        // This is not an anonymous guest however
        that.isGuestMember = true
        // User page is made a draft, this  marks user as a guest
        if( !userpage.isDraft() ){
          that.login_de&&bug( "force guest, draft page:", userpage)
          that.draft( userpage, true) // true => force
        }
      }else{
        that.bug_de&&bug( "BUG? weird guest, page:", userpage)
      }
    }
  }
  // Paranoid sanitize
  user = that.wikinamize( user, null, is_guest ? "Guest" : "One")
  that.de&&bug( "loginForm(), found wikinamized user ", user)
  
  // Now, let's determine curatorship privileges
  var is_curator = false

  // Check if user is a config defined curator...
  if( !has_curator
  && (" " + that.wiki.config.curators + " ").includes( " " + user + " ")
  ){
    that.de&&bug( that, "configDefinedCurator:", user)
    that.loginLog( "configured curator")
    has_curator = true
  }

  // Everybody is a curator in a very open wiki
  if( !has_curator
  &&  that.wiki.isVeryOpen()
  ){
    that.de&&bug( "curatorOfOpenWiki:", user)
    has_curator = true
    that.loginLog( "curator owner")
  }

  // Now let's determine if curator is a valid member
  if( has_curator ){
    // A guest cannot be a curator, only members can
    is_curator = !is_guest
    // If AboutWiki defined curatorUser, reject other curators
    if( is_curator
    && that.wiki.config.curatorUser
    && that.wiki.config.curatorUser != SW.config.curatorUser // Ignore default
    && user != that.wiki.config.curatorUser
    ){
      that.de&&bug(
        "curatorName:",     user,
        "configMismatch:", that.wiki.config.curatorUser
      )
      is_curator = false
      that.loginLog( "not the configured curator")
    }
    that.login_de&&bug( "Will be Curator:", is_curator ? "curator" : "not curator")
  }
  
  // Done, we know the user's name & its "guest" vs "member" status
  that.login_de&&bug( "Login, user:", user)
  that.loginName     = user
  that.loginLog(
    "(" + user +  ")"
  )
  // If now member, forget transient name set while becoming member
  if( !is_guest ){
    that.isGuestMember = false
  }

  // Set access right depending on curatorship
  if( req && (is_curator || that.isDebug) ){
    // I get special privileges when I am invited in a wiki
    if( De && (that.loginName == "@jhr" || that.twitterName == "jhr") ){
      that.de&&bug( "@jhr connects")
      that.isAdmin = is_curator
    }
    if( req.remoteAddress == "127.0.0.1"
      && (!req.headers || !req.headers["x-real-ip"])
    ){
      that.login_de&&bug( "Local browser connects")
      that.isAdmin = is_curator
    }else if( that.wiki.config.adminIps.includes( req.remoteAddress)
    || (req.remoteAddress == "127.0.0.1"
      && req.headers && req.headers["x-real-ip"]
      && that.wiki.config.adminIps.includes( req.headers["x-real-ip"]))
    ){
      that.de&&bug( "Authorized host connects")
      that.isAdmin = is_curator      
    }
    that.canCurator = is_curator
  }else if( req ){
    that.canCurator = false
    that.isCurator  = false
  }
  
  // Close default very open wiki when first non anonymous member logs in
  if( is_very_open_by_default
  &&  that.canCurator
  &&  that.userName() != "SomeOne"
  ){
    if( that.isAdmin ){
      that.login_de&&bug( "Avoid closing wiki because of admin access")
    }if( !that.user ){
      that.login_de&&bug( "Avoid closing wiki, not authentic")
    }else{
      that.login_de&&bug( that.wiki, "ownerBecomes:", that.userName())
      that.wiki.changeDefaultToCuratorConfig()
    }
    // Add a link in the owner's wiki, whoever creates wikis can retrieve them
    if( that.user ){
      // ToDo: what if user is found later? should logCode then
      that.newWikiTracked = true
      that.login_de&&bug( "logCodeInOwnerWiki:", that.user)
      that.wiki.getRoot().lookupWiki(
        "user/f" + that.user.getId() + "/x",
        function( wiki ){
          wiki.de&&mand( wiki.isUserWiki() )
          wiki.protoGuest.logPrivateCode(
            "",
            that.loginName,
            that.wiki
          )
        }
      )
    }
  }
  
  // Reset page history? ToDo: don't forget visit?
  that.wikiHistory = []
  
  // move to the desired page
  that.setCurrentPage( page)
  that.login_de&&bug( "desiredPage:", page, "currentPage:", that.getCurrentPage())
  
  // Some checking, debug only
  if( that.de ){
    if( is_guest ){
      if( !that.isGuest() ){
        that.bug_de&&bug( "BUG? should be guest")
      }
    }else{
      if( that.isGuest() ){
        that.bug_de&&bug( "BUG? should be member, user:", that.userName())
        if( that.isGuestMember ){
          that.bug_de&&bug( "BUG? is wrongly guest because guest member")
        }else if( that.userName().includes( "Guest") ){
          that.bug_de&&bug( "BUG? is wrongly guest because Guest in name")
        }else if( userpage.isDraft() ){
          that.bug_de&&bug( "BUG? is wrongly guest because draft user page")
        }else{
          that.bug_de&&bug( "BUG? no clue why is wrongly guest")
        }
      }
    }
    that.de&&mand( !!is_guest ==  !!that.isGuest(), "guest issue" )
  }

  // What happens next is different if user is identified
  var next
  if( that.isAuthentic ){
    that.login_de&&bug( "Track user")
    next = function( do_this ){
      that.trackUser( function( err, session, user ){
        // What is done here is only one part of the story, see .userFoundEvent()
        if( !err ){
          de&&mand( that == session,   "bad session, " + that + " != " + session )
          // There are cases with mutliple User objects, ie conflict&merge
          if( that.user != user ){
            that.login_de&&bug( "user:" + that.user + ", andAlso:" + user )
          }
        }
        do_this()
      })
    }
  }else{
    next = function( do_this ){ do_this() }
  }
  next( function(){
    that.wiki.logUser( that)
    // Track visit if member of wiki (or if wiki is somehow secret)
    if( that.user && (!that.isGuest() || that.wiki.isVeryOpen()) ){
      that.user.trackVisit( that)
    }
    // Proceed with the visit
    if( req ){
      // if login occured during a POST I reprocess the HTTP request
      if( req.method == "POST" ){
        that.login_de&&bug( "Proceed with POST after login")
        // Make it so that processPost() don't discard the post
        that.postExpected = page.name
        that.processPost( req, page)
      // if login from a GET, present the current page
      }else{
        that.viewForm( req)
      }
    }
  })

  }) // End of read() callback
} // end of loginForm()


Session.restoreSession = function( old ){
// Called by wiki.logUser() for returning logged user with code
// ToDo: this happens more often then necessary, after a post for example
  this.login_de&&bug( "restoring")
  this.wikiHistory = old.wikiHistory
  this.loginLogList = old.loginLogList
  this.loginLog( "restored")
  if( !old.isAway() && !old.isGone ){
    this.allKnownPages = old.allKnownPages
    this.allMaps = old.allMaps
    this.isBehingMap = old.isBehindMap
    this.isDebug = old.isDebug
    if( this.canCurator ){
      this.isCurator = old.isCurator
    }
    // Don't jump on problematic page too easely
    if( this.wikiPage.isSensitive()
    // ||  this.wikiPage.isRead()
    ||  this.wikiPage.isHelp()
    ||  this.wikiPage.isHtml()
    ||  this.isBehindMap
    ||  this.canCurator
    ||  this.isDebug
    ){
      this.wikiPage = this.wiki.homePage
    }
    // Restore config & data
    this.config     = old.config
    this.dataByPage = old.dataByPage
    // Restore dropbox credentials
    if( old.dropbox ){
      this.dropbox_de&&bug( "restoreSession")
      this.dropbox = old.dropbox
    }
    // Logout the older session, safer
    old.logout( "restore")
  }
  return this
}


Session.checkIntrusion = function( req ){
// Try to figure out if session id was sniffed and reused by an intruder,
// comparing new req with initial login request
  // ToDo: do this
  // Compare IP
  // Compare user-agent
  // ToDo: regenerate session id. I could set a new session id
  // whenever I send a response. This means that users would detect
  // intrusion by way of beeing unexpectably signed off when the
  // intruder takes over a session. They would fight back by
  // sign in again, login out the intruder, with neither the intruder
  // nor the legitimate user having precedence, until one of them
  // create a new invitation code, something only curators can do
  // usually.
  // Alternatively I could simply signal the intrusion when I detect
  // it, letting the user figure out what to do, or not do, in
  // cases where it is actually not intrusion and more like a dual
  // co browsing experience...
  // This could be a config parameter, config.collaborative
  return false
}

Session.logGuest = function( guestname ){
// Sets This.loginName & maybe This.loginPage (if not anonymous)
// Also track the visit of identified user to very open & secret wiki.
  var oldname = this.loginName
  this.loginName = guestname
  if( !this.isGuest() ){
    this.loginName = oldname
    this.bug_de&&bug( "cannot log guest, would be a member:", guestname)
    return false
  }
  // Set the login page if guest told us about her name
  if( this.isGuestMember ){
    this.loginPage = this.lookup( this.usernamize( this.userName()))
  }
  this.login_de&&bug( "logGuest, user: ", guestname)
  // Track user's visit to wiki if wiki is somehow secret
  // Why: user may easely lose the url of secret wikis, better keep a trace
  // when it's possible. However, if the openess of the wiki was changed,
  // it is reasonnable to consider that whoever changed that will also take care
  // of not losing the url.
  if( this.user && this.wiki.isVeryOpen() && this.wiki.isAnonymous( true) ){
    this.user.trackVisit( this)
  }
  // Also remember guest visitors that are identified
  if( this.isAuthentic ){
    var name = this.getPlausibleName()
    this.wiki.logGuestVisitor( name)
  }
  return this
}

Session.logMember = function( membername ){
// Sets This.loginName & maybe This.loginPage (if not anonymous)
// Also track the visit of identified user to wiki she is a member of.
  var page = this.lookup( membername)
  var oldname = this.loginName
  this.loginName = membername
  if( this.isGuest() ){
    this.loginName = oldname
    this.login_de&&bug( "cannot log member, would be a guest:", membername)
    return false
  }
  // Set the login page
  if( !this.isAnonymous() ){
    this.loginPage = this.lookup( this.usernamize( this.userName()))
  }
  this.login_de&&bug( "logMember, user: ", membername)
  // Track user's visits to wikis the user is a member of
  if( this.user ){
    this.user.trackVisit( this)
  }
  return this
}

Session.logout = function( reason ){
  this.login_de&&bug( "logout:", reason)
  if( this.isGone ){ return this }
  // If logging out of parent wiki while login in subwiki
  if( reason == "reuse" ){
    this.wiki.logout( this)
    return this
  }
  this.loginLog( "logout, " + reason)
  this.login_de&&bug( "\n" + this.loginLogList.join( "\n"))
  this.isGone = true
  if( this.user ){
    if( this.user.session == this ){
      this.user.logout()
      this.user = null
    }else{
      this.user_de&&bug( "changedSession:", this.user.session,
      "forUser:", this.user)
      this.user = null
    }
  }
  this.isAuthentic = false;
  if( this == this.wiki.protoGuest ){
    this.wiki.logout( this)
    return this
  }
  this.viewClosureCache = {}
  // ToDo: clear stuff in session to avoid leak?
  this.allKnownPages = null
  this.allMaps = null
  this.de&&bug( "Bye ", this)
  var closure
  while( closure = this.allClosures.pop() ){
    this.wiki.deregisterClosure( closure)
  }
  this.allClosures = []
  this.wiki.logout( this)
  // Unless protoGuest
  if( this != this.wiki.protoGuest ){
    // ToDo: figure out what I can delete
    // this.config = null
    // ToDo: cannot null wiki, need it for isGuest()
    // this.wiki = null
  }
  return this
}


Session.age = function(){
// Age of session is time since last HTTP access, in millisec
// ie: session ages only when not used...
  return Sw.timeNow - this.dateLastAccess.getTime()
}
Session.declareIdempotentGetter( "age")

Session.isOlderThan = function( delay ){
  if( this.isGone )return true
  return this.age() > delay
}

Session.isAway = function(){
// Checks age of session to guess if user is away from keyboard.
// Side effect: if away for a long time, then logout() is called.
// Note: isAway() is called from some setTimeout() often enough.
  if( this.isGone ) return true
  var age = this.age()
  // If is away, ie not active for a while...
  if( age > SW.awayDelay ){
    // ... then check if inactive for a long time, enough to log out
    // Note: guest sessions are logged out after SW.awayDelay whereas
    // member sessions are logged out after longer SW.logoutDelay
    if( this.isGuest() || age > SW.logoutDelay ){
      this.login_de&&bug( "Logout inactive, age:", age)
      this.logout( "inactive")
    }
    return true
  }
  return false
}
// The method is not strictly idempotent but it can be called as often
// as one wants without damages
Session.declareIdempotentPredicate( "isAway")

Session.isThere = function(){
// Returns true if a user request was processed very recently
  return !this.isOlderThan( SW.thereDelay)
}
Session.declareIdempotentPredicate( "isThere")
  
Session.isRecent = function(){
// Returns if some activity recently
  return !this.isAway() && this.age() < SW.recentDelay
}
Session.declareIdempotentPredicate( "isRecent")

Session.touch = function(){
// Called often, helps to keep the session alive
  this.dateLastAccess = Sw.dateNow
  this.timeLastAccess = Sw.timeNow
}


Session.handleChangedLogin = function( page, req ){
// Check current value of "connect" cookies (inc twitter).
// Also handle ?kudocracy login/logout.
// If changed, logout session and redirect to some decent page
// Return false if nothing happened, true if req is beeing processed.

  var old_name = this.cookiedTwitterName || this.twitterName;
  if( !old_name && this.loginName[0] === "@" ){
    old_name = this.loginName.substring( 1 );
    debugger;
  }
  var new_name = this.useTwitterNameCookie( req)
  var query = req.sw_query;
  if( query && query.kudocracy ){
    this.isKudocracy = true;
    var kudo_name = query.kudocracy.replace( /[^A-Za-z0-9_]/g, "" );
    // Login
    if( kudo_name ){
      new_name = kudo_name;
      this.canScript = true;
    }else{
      new_name = "";
    }
  }else{
    if( !new_name ){
      new_name = this.twitterName;
    } 
  }

  var need_tracking = false
  if( old_name ){
    // Logout if cookie/?kudocracy disappeared/changed
    if( new_name != old_name ){
      this.login_de&&bug( "Twitter gone")
      this.logout( "twitter bye")
      var pagename
      if( page.isSensitive() ){
        pagename = "/HomePage"
      }else{
        pagename = "/" + page.name
      }
      pagename = ("/" + this.wiki.fullname() + pagename).replace( "//", "/")
      // ToDo: I should redirect toward a closure
      this.redirect( req, pagename)
      return true
    }else{
      //this.login_de&&bug( "Twitter name is still", this.twitterName)
    }
  }else{
    if( new_name ){
      // If twitter login while guest, try to log with twitter credentials
      if( this.isGuest() ){
        this.login_de&&bug( "Delayed login, twitter")
        if( this.isKudocracy ){
          // ToDo: handle case, handle label
          this.twitterName  = new_name;
          this.twitterId    = new_name;
          this.twitterLabel = new_name;
        }
        this.twitterLoginForm( new_name, page, req)
        return true
      // If twitter login while already a member, track wiki membership
      }else{
        need_tracking = true
      }
    }else{
      //this.login_de&&bug( "No twitter name in cookies")
    }
  }

  // If new info about user, track wiki membership
  if( need_tracking ){
    this.login_de&&bug( "New login info, track user")
    // Note: this is done in // whereas it is done sequentially when user
    // logs in
    // ToDo: have the caller call trackuser() and deal with potential new
    // User getting bound to session
    this.trackUser()
  }
  return false
}


Session.getPlausibleName = function( page, req ){
// Figure out the "best" way to name the user
  // If registered member, use the login name as set at login
  if( !this.isGuest() ){
    return this.loginName
  }
  // If member provided some name, use it
  if( this.isGuestMember ){
    return this.userName()
  }
  // If some name is known, use it, Wiki name first, then twitter first, etc
  if( !this.isAnonymous() ){
    return false
    || (this.cookiedWikiName     && this.wikiId)
    || (this.cookiedTwitterName  && ("@" + this.cookiedTwitterName))
    || this.wikiId
    || (this.twitterName  && ("@" + this.twitterName))
    || this.loginName.replace( /Guest$/, "").replace( /^Some$/, "someone")
  }
  // Try to figure out some default name based on other accounts
  var service_name = false
  || (this.cookiedWikiId       && this.wikiId)
  || (this.cookiedTwitterName  && ("@" + this.cookiedTwitterName))
  || this.wikiId
  || (this.twitterName  && ("@" + this.twitterName))

  return service_name
}
Session.declareIdempotentGetter( "getPlausibleName")

Session.isGuest = function(){
// A Session is for a Guest if user is not a member of the wiki
  // ToDo: implement guest member fully
  return this.isGuestMember
  || this.wiki.isGuest( this.loginName )
  || this.isBot
}
Session.declareIdempotentPredicate( "isGuest")

Session.isMember = function(){
  return !this.isGuest()
}
Session.declareIdempotentPredicate( "isMember")

Session.isInTheJungle = function(){
// Returns true if user is in the "jungle", a place where XSS is not an issue
  return this.wiki.isJungle()
}
Session.declareIdempotentPredicate( "isInTheJungle")

Session.isFearless = function(){
// Returns true if XSS is not an issue
  // In some wiki, it's a safe jungle where everybody is a lion
  if( !this.isInTheJungle() )return true
  // XSS is not an issue for visitors that are not logged in elsewhere
  // because one cannot use any privileges to do anything really harmfull
  // outside of the current wiki
  if( this.isJustHere()     )return true
  if( this.isNotLion        )return false
  if( this.isLion           )return true
  if( this.config.isNotLion )return false
  if( this.config.isLion    )return true
  return !this.wiki.isJungle()
}
Session.declareIdempotentPredicate( "isFearless")

Session.getLogins = function(){
// Returns {page:id,page:id,...} for all wikis that the user can log into.
// id is the twitter id.
  var logins = {}
  var id;
  var that = this;
  ["Twitter"].forEach( function( service ){
    id = that["cookied" + service + "Name"]
    if( !id )return
    if( service == "Twitter" ){
      id = "@" + id
    }
    logins[id] = id
  });
  var cookies = this.req && this.req.headers.cookie
  if( !cookies )return logins
  // ToDo: DRY
  var decode = function( path ){
    return decodeURIComponent( path)
    .replace( /^com_/, "")
    .replace( /_/g, "/")    // _ means / in original
    .replace( /\/\//g, "_") // __ means _ in original
    .replace( /\/$/, "")
  }
  return logins
}
Session.declareIdempotentGetter( "getLogins")

Session.isJustHere = function(){
// Returns true if there is no cookies about other wikis
  var cookies = this.req && this.req.headers.cookie
  if( !cookies )return true
  var logins = this.getLogins()
  var size = 0
  for( var page in logins ){
    if( ++size > 1 )return false
  }
  return true
}
Session.declareIdempotentPredicate( "isJustHere")

Session.hasUser = function(){
// Returns true if some User object is bound to the session
  return !!(this.user)
}

Session.getUserObject = function(){
// Returns the session's User object if there is one
// See userFoundEvent() where this is set
  return this.user
}

Session.isAnonymous = function(){
  if( this.twitterName            )return false
  if( this.wikiName               )return false
  if( this.user ){
    this.bug_de&&bug( "User object but no authentic name")
  }
  if( this.isGuestMember          )return false
  if( this.isGuest()              )return true
  if( this.loginName == "SomeOne" )return true
  return false
}
Session.declareIdempotentPredicate( "isAnonymous")

//Session.isBot = function(){
//  return "BotGuest".ends( this.loginName)
//}
//Session.declareIdempotentPredicate( "isBot")

Session.setCurrentPage = function( page ){
// Set current page and remember history of visited pages.
// Note: this is a local history, it is not the browser's history (the one
// that handles the "back" button).
// Returns page itself

  this.de&&mand( page.assertIsPage(), "not a page" )
  if( page != this.wikiPage ){
    this.previousWikiPage = this.wikiPage
  }
  this.wikiPage = page
  // Don't add to history is some case
  if( page.isHome()
  || page == this.loginPage
  || page.isMap()
  || page.isDo()
  || this.isCurator     // Don't spy curators
  || this.isBehindMap  // Don't spy visitor visiting secrets
  ){
    return page
  }

  // Add to array unless already there
  var found = false
  var item
  for( item in this.wikiHistory ){
    if( this.wikiHistory[item] == page.name ){
      found = true
      break
    }
  }
  // The previous current page is moved to make room for the new item
  if( !found ){
    // Move item 0 to the end of the list
    if( this.wikiHistory.length ){
      this.wikiHistory.push( this.wikiHistory[0])
    }
  }else{
    // Move item 0 to where new item was found (works if item == 0)
    this.wikiHistory[item] = this.wikiHistory[0]
  }
  // The current page is always at index 0 in history
  this.wikiHistory[0] = page.name

  return page
}

Session.getCurrentPage = function(){
  return this.wikiPage
}
Session.declareIdempotentGetter( "getCurrentPage")


Session.getCookie = function( name, req ){
  req = req || this.req || this.httpLogin
  if( !req ) return null
  var cookie = req.headers.cookie
  if( !cookie ) return null
  return this.getCookieScript( name, cookie)
}

Session.encryptSha1 = function( str, salt ){
  return crypto.createHmac( "sha1", salt).update( str).digest( "hex")
}

Session.useTwitterNameCookie = function( req ){
// Extract twitter name from cookie set by twitter @anywhere scripts
// Note: twitter name does not include starting @
// Note: side effect on this.twitterId && this.twitterName, if cookie
// Dec 2014. @anywhere is not supported anuymore. authentic source of
// valid twitter names is now ?kudocracy=xxxx solution.
  var twitter_id = this.getCookie( "sw_twitter_id", req)
  // Sanitize
  if( twitter_id ){
    twitter_id = twitter_id.replace( /[^A-Z_a-z0-9]/g, "")
  }
  if( !twitter_id
  ||  twitter_id == "null" // Dirty cookies, ignore them
  ||  twitter_id == "undefined"
  ){
    return null
  }
  // Should check signature of twitter_id
  //var signature_idx = twitter_id.indexOf( ":")
  //if( signature_idx == - 1 ) return null
  //var signature = twitter_id.substr( signature_idx + 1)
  var id = twitter_id // twitter_id.substr( 0, signature_idx)
  // ToDo: check signature, see http://dev.twitter.com/anywhere/begin#login-signup
  // Digest::SHA1.hexdigest( id + consumer_secret)
  var name = this.getCookie( "sw_twitter_screenname", req)
  if( !name ){
    this.login_de&&bug( "Some twitter id but not the display name")
    return null
  }
  // Returning anonymous user
  if( name == "SomeGuest" || name == "null" ){
    return null
  }
  this.twitterId   = this.cookiedTwitterId   = id
  this.twitterName = this.cookiedTwitterName = name
  if( this.twitterLabel = this.getCookie( "sw_twitter_label", req ) ){
    this.wiki.trackUserLabel( "@" + this.twitterName, this.twitterLabel)
  }
  this.login_de&&bug( "Twitter cookie:", this.twitterName)
  return name
} // Session::useTwitterNameCookie()


Session.userName = function(){
// The true user name
  return this.loginName || SW.name // Defensive ||
}
Session.declareIdempotentGetter( "userName")

Session.userWikiName = function(){
// The wikinamized version of the true user name
  return this.wikinamize( this.userName(), null,
    this.isGuest() ? "Guest" : "One"
  )
}
Session.declareIdempotentGetter( "userWikiName")

Sw.wikinamizeCache = {}

Session.wikinamize = function( name, prefix, postfix ){
  return this.wiki.wikinamize( name, prefix, postfix)
}

Session.capitalnamize = function( name ){
// Canonical form for a name that needs to start with a capital.
// Returns name without leading @ and with first char capitalized
// ToDo: this is broken with facebook xxxxx@ style names.
  return name
/*
  if( "@".starts( name) ){
    return name.substr( 1, 1).toUpperCase() + name.substr( 2)
  }
  if( "@".ends( name ) ){
    this.bug_de&&bug( "Bad facebook name capitalization:", name)
  }
  return name.substr( 0, 1).toUpperCase() + name.substr( 1)
*/
}

Session.usernamize = function( name ){
// Returns "User" + something sensible about the name
  //this.de&&bug( "1, usernamize:", name)
  // Get rid of existing "User" prefix if any
  if( "User".starts( name) ){
    name = name.substr( "User".length )
  }
  // Old Facebook/LinkedIn scheme, deprecated in 2014
  if( false && !"@".ends( name) && !"In".ends( name) ){
    name = this.capitalnamize( name)
  }
  // Let's figure out a decent wiki name with a "User" prefix
  name = this.wikinamize( "User" + name, null, "One")
  //this.de&&bug( "2, usernamize:", name)
  // However "SomeOne" never turns into "UserSome" because that
  // is a bug and it took me hours to find it....
  if( "One".ends( name) && name != "SomeOne" ){
    name = name.substr( 0, name.length - "One".length)
  }else if( "Guest".ends( name) && name != "UserSomeGuest" ){ 
    name = name.substr( 0, name.length - "Guest".length)
  }
  return name
}

Session.membernamize = function( name ){
  name = name.replace( "Guest", "")
  name = this.usernamize( name).substr( "User".length)
  // this.de&&bug( "2, membernamize:", name)
  return this.wikinamize( name, null, "One")
}

Session.guestnamize = function( name ){
// A guest name ends with "Guest", this function turns a name into
// a guest name. See isGuest()
  if( !name )return "SomeGuest"
  if( name.includes( "Guest") )return this.wikinamize( name)
  name = this.wikinamize( name + "Guest")
  return (name == "SomeOne" || name == "SomeOneGuest") ? "SomeGuest" : name
}

Session.trackUser = function( user_found_cb ){
// This method gets called whenever something changes about the twitter or
// facebook id or linkedin id associated to the session.
// It tries to attach a local User object to the session and also tries to
// bind together the ids if multiple ids are provided.
// If some conflict occur, when an id already has a distinct local
// user, the twitter id is prefered, but Session.hasTwoUsers() will return
// true and the conflicting facebook user can be retrieved using
// session.user.conflict
// Optional callback's signature is f( err, Session, User)
// To fix the issue, the user must log to her "personal" wiki using the
// "your wikis" link on her personal page in any wiki.
// ToDo: improve that. 1/ When linkedid is there 2/ When merging is needed

  var that = this

  // Don't re-enter this, it's super-human
  if( this.isAlreadyTrackingUser ){
    that.login_de&&bug( "Can't re-enter Session.trackUser()")
    return user_found_cb
    && user_found_cb.call( that, that.user ? 0 : 1, that.user)
  }
  this.isAlreadyTrackingUser = true

  // How many ids to process?
  var ids         = {}
  var count_ids   = 0
  var twitter_id  = this.cookiedTwitterId
  // Dec 2014, use ?kudocracy=xxxxx configured this.twitterId
  if( !twitter_id ){
    twitter_id = this.twitterId;
  }
  if( !twitter_id && this.loginName[0] === "@" ){
    twitter_id = this.loginName.substring( 1 );
  }
  var wiki_id     = this.cookiedWikiId
  if( twitter_id  ){ ids["Twitter"]  = ++count_ids }
  if( wiki_id     ){ ids["Wiki"]     = ++count_ids }

  // The callback is called once, when User object is found and all
  // ids were processed
  var cb_was_called = false
  var remaining_ids = count_ids

  var first_found_user = null
  var tracked = function trackeUser_cb( err, session, user ){
  // When all ids are processed, calls the callback
    // ToDo: err handling
    that.login_de&&bug( "user, tracked:", user, "ids:", remaining_ids)
    de&&mand( session == that )
    de&&mand( err || user.assertIsUser() )
    // If favor the first found user, twitter before others
    first_found_user || (first_found_user = user)
    remaining_ids--
    if( remaining_ids ){
      that.login_de&&bug( "remainingIds:", remaining_ids)
      return
    }
    if( cb_was_called ){
      that.de&&mand( false, "Attempt to reenter user found callback")
      return
    }
    cb_was_called = true
    that.isAlreadyTrackingUser = false
    if( user_found_cb ){
      that.login_de&&bug( "found user, invoke cb, user:", first_found_user)
      return user_found_cb.call( that, err, session, first_found_user)
    }
  }

  if( twitter_id ){
    this.deep_user_de&&bug( "track twitter:", twitter_id)
    that.de&&mand( remaining_ids >= 1 )
    this.trackTwitterUser( tracked)
  }

  // Sorry but linkedin & wiki ids are second class citizen for now and as a result
  // if user first logs in with linkedin and then with both linkedin &
  // either fb or twitter, there will be a conflict, needing a "merge". 
  // I apply a delay to avoid race conditions (bad, bad, bad)
  // ToDo: manage conflicts
  var interval
  var done_with_wiki     = !wiki_id
  function track_other_user(){
    that.deep_user_de&&bug( "track linkedin & wiki ids")
    // Wait until job is done with other ids (twitter and/or facebook)
    if( wiki_id && remaining_ids > 2     )return
    if( (!wiki_id ) && remaining_ids > 1 )return
    // All done? stop active wait
    if( remaining_ids < 1 ){
      clearInterval( interval)
      interval = null
      return
    }
    if( !done_with_wiki ){
      done_with_wiki = true
      if( wiki_id && !that.wikiId ){
        if( ids["Wiki"] ){
          that.deep_user_de&&bug( "Oops, no more wiki id to track")
          // Consume one id 
          that.de&&mand( remaining_ids == 1 )
          return tracked( 0, that, that.user)
        }
      }else{
        that.de&&mand( remaining_ids == 1 )
        return that.trackWikiUser( tracked)
      }
    }else{
      that.bug_de&&bug( "all done, yet remaingIds:", remaining_ids)
    }
  }
  if( wiki_id ){
    that.de&&mand( remaining_ids >= 1 )
    // I poll... when twitter&facebook ids are processed, I proceed
    interval = setInterval( track_other_user, remaining_ids > 1 ? 500 : 1)
  }
}


Session.trackTwitterUser = function( cb ){
// This function gets called when a Twitter user logs in a wiki.
// It associates a "user" property to the session.
// The corresponding User objects's page are updated on store.
// Calls cb( err, this, localuser)
  var that = this
  var uid = that.twitterName + "=" + that.twitterId
  this.de&&mand( uid )
  this.trackServiceUser( "Twitter", uid, function trk_twusr_cb( err, local){
    if( cb ){ return cb.call( that, err, that, local) }
  })
}


Session.trackServiceUser = function( service, id, cb ){
// Track the identity of a user, returns the local user via cb( err, user)
// Optional cb's signature is f( err, Session, User)
  var that = this
  this.deep_user_de&&bug( "track, service:", service, "id:", id)
  var session = this
  // If there is already a local user, then I am going to use it, unless
  // the id is already bound to some other local user, in which case there
  // is a conflict
  var local_user = session.user
  var target_user
  if( !local_user ){
    this.deep_user_de&&bug( "track, no local user yet")
    var service_user_page = User.lookup( session.wiki, service, id)
    var service_user = service_user_page.user
    service_user.de&&mand( service_user.isProxy() )
    target_user = service_user
  }else{
    target_user = local_user
  }
  that.deep_user_de&&bug( "track service:", service, "id:", id,
  "onTargetUser:", target_user)
  return target_user.trackServiceId( service, id,
    function track_service_usr_cb( err, local_user, user ){
      target_user.deep_user_de&&bug( "tracked service id, err:", err)
      if( err ){
        // ToDo: err handling
        // Note: some errors are "normal", when some new User object is created
      }
      local_user.de&&mand( !local_user.isProxy() )
      session.userFoundEvent( local_user)
      cb && cb.call( err, session, local_user)
    }
  )
}


Session.isPremium = function(){
  // ToDo: manage premiumship
  return true
}

Session.userFoundEvent = function( user ){
// This method gets called when a User object is found that matches the credential
// collected in the session. ie: either a twitterId... (from cookies) that
// was turned into a User object somewhere in the login procedure
// It tracks the visit in the user's list of visited wikis.

  // User is curator on is own "User" wiki
  user.assertLocalNotEmpty()
  if( this.wiki.isUserWiki() && this.wiki.name == "f" + user.getId() ){
    if( this.isGuest() ){
      this.bug_de&&bug( "Cannot curator User wiki, guest")
    }else{
      if( !this.canCurator ){
        this.login_de&&bug( "owner can curator User wiki")
        this.canCurator = true
      }
    }
  }

  if( !this.user ){
    this.user_de&&bug( "bindToUser:", user)
    this.user = user
    this.loginLog( "(identified user)")
    // Note: space for sw_what_close button
    this.notify( "DoProfile")
    // Update association table between users & "id codes"
    this.wiki.logAuthenticUser( this)
    // Play with identities. I restore id/name/label if appropriate
    var twitter_id    = user.getTwitterId()
    var twitter_name  = twitter_id && User.extractName(  twitter_id)
    // Note: I cannot restore the label, it is not stored (yet)
    // Note: If user changes it's name... it's identity changes too. This
    // will be an issue, I will have to develop a tool to migrate old to
    // new identity. That's fairly easy, user will just have to give her
    // previous name. What is much more complex is to provide access to all
    // the wikis that the user used to have access to... I probably should
    // store the SimpliWikiIdf3xxxx somewhere in the accessed wiki when
    // there is a successful access. Later on, if user claim access to a
    // wiki, I could lookup in that list and if the id matches I could
    // restore access, but all of that is easier said than done...
    // OTOH people may understand that changing their id has some bad
    // consequences sometimes... Let's wait and see.
    if( twitter_name ){
      if( !this.twitterName ){
        this.twitterName  = twitter_name
        this.twitterId    = User.extractId( twitter_id)
        this.twitterLabel = twitter_name; // ToDo: handle case on twitter ids
      }else if( this.twitterName != twitter_name ){
        this.loginLog( this.twitterName + " takes over " + twitter_name)
      }
    }
  }else if( this.user == user ){
    this.bug_de&&bug( "Bind to same user:", user)
  }else{
    // Need to merge two users...
    this.user_de&&bug( "Merge:", this.user, "with:", user)
    user.de&&mand( user.isLocal )
    this.user.conflict = user
    // this.loginLog( "registered user, merge")
    // ToDo: callback & err management
    this.mergeUsers()
  }

  // Restore dropbox connectivity
  if( this.dropbox ){
    if( user.dropbox ){
      // OK. What dropbox do I use? the youngest one, ie connected recently
      if( this.dropbox.time > user.dropbox.time ){
        user.dropbox = this.dropbox
      }else{
        this.dropbox = user.dropbox
      }
    }else{
      user.dropbox = this.dropbox
    }
  }else{
    this.dropbox = user.dropbox
  }
  // Bind user to its Dropbox account
  var token = this.user.getDropboxId()
  if( this.dropbox && this.dropbox.token && !token ){
    this.trackServiceUser( "Dropbox", this.dropbox.token, Sw.noop)
  }
  if( token ){
    if( this.dropbox ){
      this.dropbox.token = token
    }else{
      this.dropbox = {token:token}
    }
  }
  if( this.dropbox ){
  }

  return this

}


Session.hasTwoUsers = function(){
// A session has two users if twitter id and another id refers to different
// local users.
// ToDo: handle LinkedIn too
// See mergeUsers()
  return !!(this.user && this.user.conflict)
}


Session.mergeUsers = function( cb, other_user, visited_users ){
// This method gets called to resolve a conflict regarding local user
// not beeing the same via twitter and via Facebook (or via LinkedIn, ...)
// It extracts content from the other user in order to extend the
// twitter based local user and mark the facebook local user as beeing
// "deprecated". Further reference to the deprecated local user are
// redirected to the valid local user. See class User
// Optional cb's signature is f( err, User, User)
// ToDo: handle visited wikis too + better handling of linkedin?
// ToDo: mark as "deprecated" when previous ToDo is done

  this.de&&mand( this.hasTwoUsers() )

  var that = this
  var a = this.user
  var b = other_user || a.conflict
  b.assertIsUser()

  var id
  var count_ids = 0

  de&&mand( a != b )

  // Avoid infinite loop
  visited_users || (this.mergedUsers = visited_users = {})

  if( visited_users[a] || visited_users[b] ){
    // ToDo: better err handling
    return cb && cb.call( that, 0, a, b)
  }

  visited_users[a] = true
  visited_users[b] = true

  var cb_called = false
  var tracked = function mergeUsers_cb( err ){
    that.deep_user_de&&bug( "tracked, ids:", count_ids)
    if( count_ids-- > 0 )return
    if( cb_called ){
      that.bug_de&&bug( "Bad, merge should invoke callback once only")
      that.de&&mand( false )
    }else{
      cb_called = true
      cb && cb.call( that, err, a, b)
    }
  }

  // Fake id to avoid premature callback
  count_ids++

  if( id = b.getTwitterId() ){
    count_ids++
    a.trackTwitterId( User.extractName( id), User.extractId( id), tracked)
  }

  if( id = b.getWikiId() ){
    count_ids++
    a.trackWikiId( User.extractWikiName( id), User.extractCode( id), tracked)
  }

  if( id = b.getMailId() ){
    count_ids++
    a.trackMailId( id, tracked)
  }

  if( id = b.getDropboxId() ){
    count_ids++
    a.trackDropboxId( id, tracked)
  }

  if( id = b.getDropboxId() ){
    count_ids++
    a.trackDropboxId( id, tracked)
  }

  // Undo fake id to enable callback
  count_ids--

  // Follow the chain of conflicts (domino effect, vive la revolution)
  if( b.conflict ){
    count_ids++
    that.mergeUsers( tracked, b.conflict, visited_users)
    count_ids--
  }
  if( count_ids <= 0 ){ tracked() }

  // ToDo: should merge list of visited wikis
  return

  // Not reached
  a.mergeWith( b, function( err, winner, loser ){
    if( err || !winner ){
      return cb.call( that, err, winner, loser)
    }
    winner.getHomepage( function( err, pwin ){
      if( err ){
        return cb.call( that, err, winner, loser)
      }
      loser.getHomepage( function( err, ploss ){
        if( err ){
          return cb.call( that, err, winner, loser)
        }
        pwin.wiki.mergeWith( ploss.wiki, function( err ){
          cb.call( that, err, winner, loser)
        })
      })
    })
  })
}

exports.Session = Session;
// section: end sessionlogin.js
