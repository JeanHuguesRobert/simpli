// section: wiki.js, export
// Class Wiki
//
// There is a singleton TheRootWiki and clones maybe

var bug = global.bug, mand = global.mand;
var Sys = global.Sys, Sw = global.Sw, SW = global.SW;

function Wiki( parent, name, options ){

  options || (options = {})

  this.init_de&&bug(
    "newWiki:", name,
    "parent:", parent,
    "options:", Sys.inspect( options)
  )

  this.initializing = true
  // During initialization I cannot handle HTTP requests & cb, I queue them
  // Queued requests and cb are process when wiki's context is fully restored
  this.queuedRequests = []

  // Initialize/refresh global Sw.timeNow
  Sw.setTimeNow()

  // All wikis, but the root wiki, have a parent wiki, they inherit pages
  this.parentWiki = parent

  // Name defaults to statically configured one if root, random if not
  this.name = name ? name : (!parent ? SW.name : this.random3Code( "-"))
  if( this.name == "sandbox" || this.name == "entrainement" ){
    this.isSandbox = true
  }

  // Sets a seed for &cid= closure ids, usefull on restarts
  this.idSalt = Sw.timeNow % 100000

  // Initialize login ids
  this.countLogins = 0

  // Remember all sessions
  this.allSessions = []

  // Remember last session that involved this wiki
  this.lastSession = null
  this.dateLastSession = Sw.dateNow

  // Remember last login of a session (ie new user)
  this.lastLogin = null

  // Remember last login that is for a guest
  this.lastGuestLogin = null

  // Remember last login that is for a member
  this.lastMemberLogin = null

  // List of all pages, both existing and referenced, by name
  this.allPages = {}

  // Remember all valid login names
  this.allLoginNames = {}

  // List draft pages
  this.allTransientPages = {}

  // Size of allTransientPages minus codes & users (a stupid optimization?)
  this.countDrafts = 0

  // List "hot" pages, the pages that were modified
  this.allHotPages = {}

  // Remember last session attached to some user name
  this.allSessionsByName = {}

  // Remember all User objects by User id. See .logAuthenticUser()
  this.allUsersById = {}

  // Remember some recent identified guest visitors
  this.recentGuestVisitors = []

  // Remember last session attached to some User
  this.allSessionsByUserId = {}

  // Remember last session attached to some session id
  this.allSessionsBySessionId = {}

  // List of all "about" page, they have a data member, a hash
  this.allDataPages = {}

  // Total number of members that have visited the wiki (not guests)
  this.countMembers = 0

  // Only the Root wiki dispatches closures (ie HTTP req with cid query param)
  if( !parent ){
    this.allClosures = [null]
  }

  // List all clones of this wiki (clones "inherit" pages from "parent")
  this.allClones = {}

  // List of all backlinks for all pages, entries are hashes with name:Page
  this.allBacklinksByPage = {}

  // Each wiki has a config, copied from parent or global SW.config for root
  this.config = parent ? Sw.copyHash( parent.config) : SW.config

  // This new wiki is very open if parent say so
  if( parent && parent.config.veryOpenClones ){
    this.config.veryOpen = true
    this.config.open = true
  }

  // A little treat to myself
  if( name == "virteal" || name == "jhr" ){
    this.config.premium = true
  }

  // The config is modified using the options
  var key
  for( key in options ){
    this.config[key] = options[key]
  }

  // Some tests, because things gets tricky some times
  if( !parent ){
    var test = function( a, neg ){
      if( !De )return
      !neg && mand(  SW.wikiword.test( a), "false negative " + a)
      neg  && mand( !SW.wikiword.test( a), "false positive " + a)
      var match = SW.wikiwords.exec( " " + a + " ")
      if( !match ){
        mand( neg, "bad match " + a)
      }else{
        mand( match[1] == " ", "bad prefix for " + a)
        match = match[2]
        !neg && mand( match == a, "false negative match: " + a + ": " + match)
        neg  && mand( match != a, "false positive match: " + a + ": " + match)
        match = SW.wikiwords.exec( "~" + a + " ")
        if( match ){
          mand( neg, "bad ~match " + a)
        }
      }
    }
    var ok = function( a ){ test( a)       }
    var ko = function( a ){ test( a, true) }
    ok( "WikiWord")
    ok( "WiWi[jhr]")
    ok( "W_W_2")
    ok( "@jhr")
    ok( "@Jhr")
    ko( "@jhr.")
    ok( "@jhr@again")
    ko( "j-h.robert@")
    ko( "jhR@")
    ok( "#topic")
    ok( "#Topic")
    ok( "#long-topic5")
    ko( "Word")
    ko( "word")
    ko( " gar&badge ")
    ok( "UserMe@myaddress_com")
    ko( "aWiki")
    ko( "aWikiWord")
    ok( "_word_")
    ko( "_two words_")
    ok( "[free link]")
    ok( "User[free]")
    ok( "[free]Guest")
    ko( "[free/link]")
    ko( "linkedIn")
    ko( "shrtIn")
    ko( "badLinkIn")
  }

  // Some metaprogramming (not very useful so far)
  this.protoGuest = Session // Temporary, needed to make Page objects
  Session.wiki = this
  this.allPages["Page"]  = this.lookupPage( "Page")
  this.allPages["Class"] = this.lookupPage( "Class")
  this.allPages["Class"].proto = this.allPages["Page"]
  Session.wiki = null

  // The homepage
  this.homePage = this.lookupPage( "HomePage")

  // Remember user labels associated to service ids
  this.allUserLabelsById = {}
  this.allUserLabels     = [] // Array of {id:xx,label:zz} pairs

  // Context last saved in PrivateContext page (helps to detect changes)
  this.lastSafeContext = ""

  // Some monitoring
  this.updateCounters()
  this.countWikis = 1
  this.timeLastStarted = Sw.timeNow
  if( parent ){ parent.countWikis++ }

  // Map for interwiki links. ToDo: test
  this.interwikiMap = Sw.interwikiMap
  var item
  if( !parent ){
    // Convert lowercase entries because wikify() matches capitalized interlinks
    for( item in Sw.interwikiMap ){
      Sw.interwikiMap[item.toUpperCase()] = Sw.interwikiMap[item]
    }
  }

  this.pageStore = new PageStore( this, this.fullname())

  // Test pages, they look like they don't exist before one write them
  this.testPages = {}

  this.dateLastStarted = new Date()
  this.touch()
  Wiki.timeoutAutoreset( this)

  // Create prototypal guest user if root wiki
  //  The prototypal guest session handles method calls that would normally
  //  require some valid session but are at times applied without such a beast
  if( !parent ){
    this.protoGuest = new Session
    this.protoGuest.login( this)
    // I patch the name for the rare cases where it is displayed
    this.protoGuest.loginName = SW.name
    this.protoGuest.isBot     = true
    this.protoGuest.logout( "proto" )
  // Else reuse Root's proto guest session
  }else{
    // Note: "anonymous" rest requests from sw_api requires a per wiki proto
    // guest, it is created when that happends (lazy)
    this.protoGuest = parent.protoGuest
  }

  // ToDo: handle options

  var that = this
  var done = false

  // Preload some pages, asynchronous

  // I store some of these pages *inside* PrivateContext
  // These "virtual" pages are small or frequently accessed pages

  var aboutwiki = this.lookupPage( "AboutWiki" )
  this.aboutwikiPage = aboutwiki

  var context   = this.lookupPage( "PrivateContext" )
  this.contextPage = context

  var homepage  = this.lookupPage( "HomePage" )
  homepage.containerPage = context

  var onload = Sw.copyArray( SW.onload)
  this.init_de&&bug( "Preload:", onload.join( '+') )

  var loaded = {}

  function loader(){
    var pagename
    var page
    if( pagename = onload.shift() ){
      if( !loaded[pagename] ){
        loaded[pagename] = true        	      
        page = that.lookupPage( pagename)
        // Preloaded pages are all contained by the "context" page
        if( page != context ){ page.containerPage = context }
        page.read( function( err, page ){
          if( err ){
            that.init_de&&bug( "Err on load:", page) // , ",", err)
          }else{
            that.init_de&&bug( "loaded:", page)
            // AboutWiki also contains a "fetch" list, as a string, 
            if( page == aboutwiki ){
              var more = that.config.fetch
              if( more ){
                that.init_de&&bug( "load more:", more)
                onload = onload.concat( more.split( /\s+/))
              }
            }
          }
          loader.call( that)
        })
      }else{
        loader.call( that)
      }
    }else if( !done ){
      done = true
      // ToDo: Maybe I should store wiki's config in PrivateContext?
      that.processConfig( aboutwiki)
      // Now restore some context from PrivateContext page
      that.restoreContext( context) // null => default name for context page
    }
  }

  context.read( function( err, page ){
    if( !that.parsePrivateContext( page) ){
      that.error( "malformed context:", page)
      that.lookupPage( page.name + "Backup").read( function( err, page){
        if( !that.parsePrivateContext( page) ){
          that.error( "malformed context:", page)
          return loader.call( that)
        }
        context.write( page.getBody(), function( err, page ){
          if( !that.parsePrivateContext( page) ){
            that.error( "malformed context:", page)
          }
          return loader.call( that)
        })
      })
    }else{
      loader.call( that)
    }	    
  })

  that.init_de&&bug( "newWiki:", "built, initializing")
}

// Turn function into a constructor of Wiki objects.
var WikiProto = Wiki.prototype = {};
// Note: If I wished Wiki to be a sub class of say AbstractWiki I
// would do: Wiki.prototype = new AbstractWiki()
MakeDebuggable( WikiProto, "Wiki")

Wiki.assertIsWiki = function(){}

WikiProto.toString = function(){
// Helps debugging
// Note: I don't use Wiki.prototype.toString = xxx because every Wiki
// object is setup to have the Wiki function/object as prototype
  return "<W:" + (this.fullname() ? " " + this.fullname() : "") + ">"
}

WikiProto.isInitializing = function(){
// When a wiki is created, it is not immediately available, it goes
// thru an initializing phase (some important pages are preloaded)
  return this.initializing
}
WikiProto.declareIdempotentPredicate( "isInitializing")

WikiProto.isResetting = function(){
// Inactive wikis are removed from memory
// Note: shutting down, closing, going down...
  return this.resetInProgress
}
WikiProto.declareIdempotentPredicate( "isResetting")

WikiProto.getState = function(){
// "initializing" => "operational" => "resetting"
  if( this.isInitializing() )return "intializing"
  if( this.isResetting()    )return "resetting"
  return "operational"
}
WikiProto.declareIdempotentGetter( "getState")

WikiProto.reset = function( force ){
// Inactive wikis are removed from memory after a while.
// ToDo: Shell script to auto restart
  De&&bug( "Reset ", this)
  if( this.isResetting() && !force ){
    this.context_de&&bug( "reset already scheduled")
    return
  }
  // Move to "resetting" state
  this.resetInProgress = true
  if( this.parentWiki ){
    this.parentWiki.deregisterClone( this)
  }
  if( this.saveContextScheduled ){
    this.context_de&&bug( "reset postpone until context is safe")
    return
  }
  var clonename
  var clone
  // Reset all clones too
  for( clonename in this.allClones ){
    if( clone = this.allClones[clonename] ){
      clone.reset()
    }
    this.allClones[clonename] = null
  }
  // If reset of root wiki, exit process
  if( this.isRoot() ){
    this.de&&bug( "Exit 0")
    process.exit( 0)
  }
  // ToDo: clean more stuff
  // Or let the garbadge collector do it?
  // reset all sessions
  // reset all known pages
}

Wiki.timeoutAutoreset = function( wiki ){
// After enough inactivity, clone wikis are removed from memory
// Static
  if( wiki.isRoot() )return
  if( (Sw.timeNow - wiki.timeLastTouched) > SW.resetDelay ){
    return wiki.reset()
  }
  setTimeout( Wiki.timeoutAutoreset, SW.resetDelay, wiki)
}

WikiProto.lookupWiki = function( pathname, cb, depth ){
// Look for a sub/clone wiki using a aaabcc/cccddd/.. pathname
// Create it if needed.
// Note: new wiki is not immediately available, see isInitializing()
// However, when optionnal cb( wiki) is called, initialization is finished.
        
  this.init_de&&bug( "wikiLookup:", pathname)

  // Get rid of trailing /
  if( "/".ends( pathname) ){
    pathname = pathname.substr( 0, pathname.length - 1)
  }
  
  var ii = pathname.indexOf( "/")
  var basename = null
  var subname = null
  if( ii >= 0 ){
    // ToDo: Should not deal with encoding here
    basename = Wiki.decode( pathname.substr( 0, ii))
    subname  = pathname.substr( ii + 1)
    if( !subname ){ subname = "HomePage" }
    this.init_de&&bug( "lookupBase: ", basename, "sub:", subname)
  }else{
    basename = ""
  }
  
  var that = this
  function callback( cb ){
    // If cb was provided invoke it now or queue it if wiki is initializing
    if( cb ){
      if( that.isInitializing() ){
        // Queued cb will be invoked once context is restored
        that.init_de&&bug( "initializing, queued cb")
        that.queuedRequests.push( {cb: cb, wiki: that})
      }else{
        cb.call( that, that)
      }
    }
  }
  
  depth || (depth = 0)
  depth++
  if( !basename || !subname || depth > 3 ){
    this.init_de&&bug( "found")
    callback( cb)
    return this
  }
  
  // Delegate to subwiki if it exists already
  var wiki = null
  var clonename
  for( clonename in this.allClones ){
    if( this.allClones[clonename].name == basename ){
      return this.allClones[clonename].lookupWiki( subname, cb)
    }
  }
  
  // Dynamic creation of clones
  this.init_de&&bug( "notFound:", basename)
  var can_clone = this.config.canClone;
  if( can_clone ){
    wiki = this.clone( basename ).lookupWiki( subname, cb)
  }else{
    wiki = this
    callback( cb)
  }
  return wiki
}

WikiProto.lookupPage = function( pagename, default_name ){
// Returns the unique Page object that references said page.
// That does not mean that the page exists on store, just that it is referenced.
// Note: if no name is provided, a random one is generated.
  pagename || (pagename = (default_name || this.random3Code( "-")))
  return Page.lookup( this, pagename, default_name)
}

WikiProto.setTestPage = function( name ){
  this.testPages[name] = true
}

WikiProto.isTestPage = function( name ){
  return this.testPages[name]
}

WikiProto.consumeTestPage = function( name ){
  delete this.testPages[name]
}

WikiProto.processConfig = function( config_page ){
// Change config based on data (& proto data) of some config page.
// Each wiki has an "AboutWiki" page that is processed this way.
// Ignores draft changes, use non draft version only.
  if( config_page.isDraft() ){ config_page = config_page.nondraft }
  this.de_config&&bug( "config:", config_page)
  var config_proto
  // Use proto data first (a template typically)
  if( (config_proto = config_page.proto) && config_proto.data ){
    this.setOptions(
      this.config,
      config_proto.data,
      "wiki",
      config_page,
      null	// session
    )
    this.config_de&&bug( "was updated using data in:", config_proto)
  }else{
    this.bug_de&&bug( "BUG? no proto data in:", config_page)
  }
  // Override with page's local data
  this.setOptions(
    this.config,
    config_page.data,
    "wiki",
    config_page,
    null	// session
  )
}

WikiProto.setOptions = function( base, options, about, page, session ){
// ! alters the base hash using options.
// This is how I set up a wiki's config.
// There are some possible side effect on the "AboutWiki" page,
// see prefetched & notPrefetched ; when this happends, we are
// dealing with options for a page that is not "AboutWiki" itself.

  options || (options = {})

  function as_bool(){
    var str = val.toString().toLowerCase()
    var bool = str
    && str != "no"
    && str != "false"
    && str != "f"
    && str != "n"
    && str != "0"
    && str != "[]" // angular style
    return val = (bool ? "true" : false)
  }

  function as_int(){
    var ii = parseInt( val.toString(), 10)
    if( isNaN( ii) ){ ii = 0 }
    return val = ii
  }

  function as_str(){
    return val = val.toString()
  }

  function valid( condition ){
    if( !condition ){ ok = false }
    return ok
  }

  function invalid( condition ){
    return valid( !condition)
  }

  //this.deep_config_de&&bug( "Setting options:", Sys.inspect( options))
  var option
  var val
  var ok
  var virtual
  for( option in options ){

    val     = options[option]
    ok      = true
    virtual = false

    // Wiki or user level options
    if( option == "rows" ){
      as_int()
      invalid( val < 5 || val > 200 )

    }else if( option == "cols" ){
      // ToDo: better val for fluid?
      if( val == "fluid" ){ val = "0" }
      as_int()
      invalid( val < 10 || val > 200 )

    }else if( option == "" ){
      as_bool()

    }else if( option == "prefetched" && about == "page" ){
      as_bool()
      if( val && valid( page && session && session.canCurator ) ){
        this.addPrefetch( session, page)
      }
    }else if( option == "notPrefetched" && about == "page" ){
      as_bool()
      if( val && valid( page && session && session.canCurator
        && (page != this.aboutwikiPage && page != this.contextPage))
      ){
       this.session.removePrefetch( page)
      }

    }else if( option == "title" ){
      val = Wiki.htmlize( Wiki.sanitizeTitle( val.substr( 0, 32)))

    }else if( option == "style" ){ // see cssStyle

    }else if( option == "lang" ){
      valid( val == "en" || val == "fr" )

    }else if( option == "veryOpen" && about == "wiki" ){
      // ToDo: add a command line option
      if( true || !this.isRoot() ){
        as_bool()
        // If veryOpen then force openness
        if( val ){
          base["open"] = val
        }
      }else{
        // See PrivateRootConfig hack
        this.config_de&&bug( "Cannot change openess of root wiki")
        ok = false
      }

    }else if( option == "open" && about == "wiki" ){
      if( true || !this.isRoot() ){
        as_bool()
        // If closed then force openness
        if( !val ){
          base["veryOpen"] = false
        }
      }else{
        // See PrivateRootConfig hack
        this.config_de&&bug( "Cannot change openess of root wiki")
        ok = false
      }

    }else if( option == "veryOpenClones" && about == "wiki" ){
      as_bool()

    }else if( option == "pureTransientClones" && about == "wiki" ){
      as_bool()

    }else if( option == "canScript" ){
      as_bool()

    }else if( option == "twoPanes" ){
      as_bool()

    }else if( option == "cssStyle" ){
      as_str()
      // ToDo: more sanitization?
      val = Wiki.htmlize( val)

    }else if( option == "fbLike" ){
      as_bool()

    // Session level options

    }else if( option == "email"      && about == "user" ){

    }else if( option == "User"       && about == "user" ){

    }else if( "aka".starts( option ) && about == "user" ){

    // Wiki level options
    }else if( option == "domain"     && about == "wiki" ){ // ToDo: sanitize

    }else if( option == "path"       && about == "wiki" ){ // ToDo: sanitize

    }else if( option == "home"       && about == "wiki" ){ // ToDo: implement

    }else if( option == "curatorUser" && about == "wiki" ){

    }else if( option == "adminIps"   && about == "wiki" && this.isRoot() ){

    }else if( option == "noCache"    && about == "wiki" ){
      as_bool()

    }else if( option == "fetch"      && about == "wiki" ){
      if( val instanceof Array ){
        val = val.sort().join( /\s+/)
      }else{
        val = val.split( /\s+/).sort().join( " ")
      }

    // ToDo: support more options
    }else{
      if( !SW.hookSetOptions ){
        ok = false
      }else{
        var hooked = SW.hookSetOption( this, option, val, base)
        if( hooked ){
          ok  = hooked.ok
          val = hooked.val
        }else{
          ok = false
        }
      }
    }

    if( ok ){
      this.config_de&&bug( "set:", about, "option:", option, "val:", val)
      base[option] = val

    }else{

      // "Virtual" short pages
      if( "Page".starts( option) && about == "wiki" ){
        var pagename = option.substr( "Page".length)
        page = this.lookupPage( pagename)
        if( page == this.contextPage ){
          page.bug_de&&bug( "Remove old experimental context")
          delete base[option]
        }else if( page.isVirtual() ){
          this.config_de&&bug( "virtual page:", option)
          base[option] = val
        }else{
          if( page.wasIncarned() ){
            page.bug_de&&bug( "newly virtual, yet incarned already")
          }
          if( page.wasStored() ){
            page.bug_de&&bug( "newly virtual, yet stored already")
          }
          base[option] = val
          page.containerPage = this.contextPage
        }

      // Invalid
      }else{
        this.config_de&&bug( "invalid:", about, "option:", option, "val:", val)
        // Also remove option from base set if present, cleaning stuff
        delete base[option]
      }
    }
  }
  return base
}

WikiProto.addPrefetch = function( session, page ){
  var list = (this.aboutwikiPage.get( "fetch") || "").split( /\s+/)
  if( list.indexOf( page.name) < 0 ){
    if( SW.wikiword.test( page.name) ){
      this.config_de&&bug( "prefetched:", page.name, "into:", list.join( " "))
      list.push( page.name)
    }
  }
  list = list.sort()
  session.setData( this.aboutwikiPage, "fetch", list.join( " "))
}

WikiProto.removePretch = function( session, page ){
  var list = (this.aboutwikiPage.get( "fetch") || "").split( /\s+/)
  if( list.indexOf( page.name) >= 0 ){
    var list2 = []
    for( var ii in list ){
      if( list[ii] == page.name )continue
      // While I am there, I do some validation, cannot hurt much
      if( SW.wikiword.test( list[ii]) ){
        // Filter out duplicates
        if( list2.indexOf( list[ii]) >= 0 )continue
        list2.push( list[ii])
      }
    }
    list2 = list2.sort()
    session.setData( this.aboutwikiPage, "fetch", list2.join( " "))
  }
}

Wiki.sanitizeTitle = function( title ){
// ToDo: this should do nothing if everthing was escaped properly everywhere
  if( !title )return ""
  // ' may interfere with " enclosed HTML attribute values
  // Ditto for "
  // \n would mess the display anyway
  // / and \ for reasons I don't remember
  return title.replace( /['"\n/\\]/g, "")
}

WikiProto.getTitle = function( session ){
// Returns the user defined wiki's title, if any.
// For "user" wikis, returns (localized) "Yours", ignoring title
  session || (session = this.protoGuest)
  // ToDo: better title sanitization. Chrome treats ' as if " ...
  var title = Wiki.sanitizeTitle( this.config.title)
  return title || (this.isUserWiki() ? session.i18n( "Yours") : "")
}
WikiProto.declareIdempotentGetter( "getTitle")

WikiProto.getLabel = function( session, full ){
// Returns either the wiki's title or its name or fullname, for displaying
  return this.getTitle( session)
  || (full ? this.fullname().replace( /\/$/, "") : this.name)
}
WikiProto.declareIdempotentGetter( "getLabel")

WikiProto.getRoot = function(){
// Return the root wiki, other wikis are clone children
  return this.parentWiki ? this.parentWiki.getRoot() : this
}
WikiProto.declareIdempotentGetter( "getRoot")

WikiProto.getAllPages = function(){
  var list = []
  for( var item in this.allPages ){
    list.push( this.allPages[item])
  }
  return list
}

WikiProto.isRoot = function(){
// True if not a child wiki (ie, has no parent)
// There is only one such wiki, aka TheRootWiki
  return !this.parentWiki
}
WikiProto.declareIdempotentPredicate( "isRoot")

WikiProto.isTopLevel = function(){
// Child wikis of the Root wiki are top level wikis
// "user" is a special top level wiki that containt "User" wikis, ie
// the wiki associated to the unique oid of local users.
  return !!(this.parentWiki && this.parentWiki.isRoot())
}
WikiProto.declareIdempotentPredicate( "isTopLevel")

// In the jungle, XSS is an issue, but not for lions
WikiProto.isJungle = function(){
  if( this.isRoot()           )return false
  if( this.isTopLevel() && this.name == "simplijs" )return false
  if( this.config.isNotJungle )return false
  if( this.config.isJungle    )return true
  return this.name == "jungle" || (this.parentWiki && this.parentWiki.isJungle())
}

WikiProto.isUserWiki = function(){
// Each user has her "own" wiki, named using a random 3 code oid.
// that wiki is located under the /user/ path
// User wikis are there just to track the wikis that the user
// is member of, so that she can get back to them easely
  // ToDo: cache in data member at creation
  return !!(this.parentWiki
  && this.parentWiki.isTopLevel()
  && (this.parentWiki.name == "user"))
}
WikiProto.declareIdempotentPredicate( "isUserWiki")

WikiProto.trackUserLabel = function( service_id, user_label ){
// Remembers the "user label" for a twitter  id.
// That user label is usually the "full name".
// Note: the service id shall include the @ sign, ie "@jhr"
  user_label = Wiki.sanitizeName( user_label)
  if( this.allUserLabelsById[service_id] != user_label ){
    this.allUserLabelsById[service_id] = user_label
    this.allUserLabels.push( {id: service_id, label: user_label})
  }
}

WikiProto.findUserLabel = function( service_id ){
// Returns the "user label" associated to some twitter id or name.
// Note: service_id shall include @ sign, ie "@jhr"
  var found = this.allUserLabelsById[service_id]
  if( found )return found
  if( this.isRoot() )return ""
  found = this.parentWiki.findUserLabel( service_id)
  if( !found )return ""
  // In production I don't want to accumulate too many labels
  if( false && this.isRoot() )return false
  // Remember the user label at this wiki level, self contained
  this.trackUserLabel( service_id, found)
  return found
}

WikiProto.getAllUserLabels = function(){
// Return the array of {id:xx,label:zz} of known id/label pairs
  return this.allUserLabels
}

WikiProto.isPremium = function(){
  return this.config.premium
}

WikiProto.fullname = function( root, no_terminator ){
// Returns fullname, including all parents, "/" terminated.
// Root wiki's fullname is always "" unless "root" parameter says otherwise
// ToDo: should root's fullname be "/" ?
  if( this.isRoot() )return (root || "")
  return this.parentWiki.fullname() + this.name + (no_terminator ? "" : "/")
}
WikiProto.declareIdempotentGetter( "fullname")

WikiProto.shortname = function(){
// Returns "" or wiki's name if wiki is not a top level wiki
  return this.parentWiki && !this.parentWiki.isRoot()
  ? this.name
  : ""
}
WikiProto.declareIdempotentGetter( "shortname")

WikiProto.clone = function( wikiname ){
// Create a child wiki
  var clone = new Wiki( this, wikiname)
  this.init_de&&bug( "Register clone ", wikiname)
  this.allClones[wikiname] = clone
  return clone
}

WikiProto.deregisterClone = function( clone ){
// Called by .reset() on clone, removes clone from list of clone
  if( this.allClones[clone.name] != clone ){
    this.bug_de&&bug( "Already re initialized?")
    return false
  }
  this.de&&mand( this.allClones[clone.name] == clone )
  delete this.allClones[clone.name]
}

Sw.log = Fs.createWriteStream( (SW.wd || ".") + "/error.txt", {flags:"a"})
Sw.log.write( "\n\nRestart\n")

WikiProto.error = function(){
// ToDo: Log error on wiki
// ToDo: this code is untested and incomplete
  this.countErrors++
  if( this.parentWiki ){
    this.parentWiki.signalChildError( this)
  }
  if( !this.allErrors ){
    this.allErrors = []
  }
  var limit = De ? 10 : 100
  if( this.allErrors.length == limit - 1 ){
    this.allErrors.unshift( {timestamp: Sw.timeNow, msg: "Too much!"})
  } else{
    var list = []
    for( var item in arguments ){
      list.push( arguments[item])
    }
    list = list.join( "-")
    De&&bug( "ERROR: ", list)
    if( this.allErrors.length < limit ){
      this.allErrors.unshift( {timestamp: Sw.timeNow, msg: list})
    }
    // Append to file error.txt in current directory
    Sw.log.write( Sw.dateNow.toISOString() + " " + list + "\n" );
    // ToDo: use some "logging" service, like loggly for example
    // See https://github.com/nodejitsu/node-loggly
  }
}

WikiProto.warning = function(){
// ToDo: Log warnings
  this.error.apply( this, arguments)
}

WikiProto.signalChildError = function( child_wiki ){
  this.countErrors++
  if( !this.allSignaledWikis ){
    this.allSignaledWikis = {}
  }
  this.allSignaledWikis[child_wiki] = child_wiki
}

WikiProto.clearChildError = function( child_wiki ){
  if( !this.allSignaledWikis )return
  delete this.allSignaledWikis[child_wiki]
}

WikiProto.getAllSignaledWikis = function(){
  if( !this.allSignaledWikis )return []
  var a = []
  for( item in this.allSignaledWikis ){
    a.push( item)
  }
  return a
}
WikiProto.declareIdempotentGetter( "getAllSignaledWikis")

WikiProto.errorQueueLength = function(){
  if( !this.allErrors )return 0
  return this.allErrors.length
}
WikiProto.declareIdempotentGetter( "errorQueueLength")

WikiProto.pullError = function(){
// ToDo: get/remove older error message
  if( !this.allErrors )return null
  var err = this.allErrors.shift()
  if( !err ){
    if( this.parentWiki ){
      this.parentWiki.clearChildError( this)
    }
  }
  return err
}

WikiProto.timeoutProcessHttpRequest = function( wiki, req ){
// Helper to invoke .processHttpRequest using setTimeout()
// This is usefull for queued requests against a wiki that is resetting
  return wiki.processHttpRequest( req)
}

WikiProto.processHttpRequest = function( req ){
// This method is called by the HTTP server when it handles a request.
// Returns false if path is not about a wiki.
// Returns "index.html" when cannot comeback.
//
// When processing a request, I look at the url.
// If it contains a ?cid query parameter then it means that the link was
// (probably) built by the wiki engine while a user was browsing a wiki.
// In that later case, I invoke the function that was registered for that
// purpose.
// Else, I login the user in a new session unless some cookie says differently

  // This function may be called multiple time for the same requests when
  // the "target wiki" is created "on the fly". That's because the wiki is not
  // immediately available, it goes thru an initialization sequence. As a
  // consequence, the request is queued and is processed again when the wiki
  // becomes ready. The same situation occurs when a request is received while
  // the target wiki is resetting. In that case it needs to be reloaded right
  // after it's reset is complete (there is no way to "interrupt" a reset)
  var queued = req.queued
  if( queued ){
    this.http_de&&bug( "reprocessHttpRequest, R:", req.deId)
  }else{
    this.countHttpRequests++
    if( De ){
      this.http_de&&bug( "-----------------\n")
      MakeDebuggable( req)
      req.setDeId( ++Sw.requestId)
    }
  }

  var parsedurl = Url.parse( req.url)
  var pathname = parsedurl.pathname || ""

  this.http_de&&bug( "HTTP:", req.method, "R: ", req.deId,
    "url:", Sys.inspect( req.url), "path:", pathname)
  
  // If wiki is resetting, I can't handle the request, not safe, I queue it
  if( this.isResetting() ){
    // ToDo: I should queue the request somehow I guess, rare, I just replay
    this.init_de&&bug( "Can't handle request while resetting, R:", req.deId)
    if( !this.isRoot() ){
      req.queued = true
      // I will retry in two seconds, in a brand new wiki instance
      setTimeout( Wiki.timeoutProcessHttpRequest, 2000, this.getRoot(), req)
      return true
    }else{
      // When the root wiki is resetting... exit() is near, no need to process
      return false
    }
  }

  // Fix weird encoding
  // ToDo: is this a good idea?
  pathname = decodeURIComponent( pathname)
  
  // static files are not for me (including fake with.google)
  if( /\.(html|ico|gif|png|svg|txt|css|js|json|google)$/.test( pathname) ){
    // embed.js is an exception
    if( "embed.js".ends( pathname) ){
      this.de&&bug( "embed.js")
      pathname = pathname.replace( /embed.js$/, "EmbedJs")
      req.embedjs = true
    }else{
      this.static_de&&bug( "file:", pathname)
      return false
    }
  }

  // Filter out bad names, no space allowed, robot probably
  if( false && pathname.includes( " ") ){
    this.static_de&&bug( "space in path:", pathname)
    return false
  }
  
  // Check for bots
  // ToDo: Figure out what are legitimate robots, per wiki maybe
  if( false && this.isBotRequest( req) ){
    this.bot_de&&bug( "Robotic request, ignore")
    return false
  }

  // ToDo: restore / at end of path?
  
  var query = QueryString.parse( parsedurl.query)
  req.sw_query = query;
  this.deep_http_de&&bug( "query:", Sys.inspect( query))
  this.deep_http_de&&bug( Sys.inspect( req.headers))
  this.deep_http_de&&bug( "host:" + req.headers.host)
  
  // Time the request. I monitor long requests (it's broken, ToDo: rm)
  Sw.setTimeNow()
  if( !queued ){ req.timeReceived = Sw.timeNow }
  
  // Handle some static routes, /rest & /oembed
  if( pathname == "/oembed" ){
    return this.processOembedRequest( pathname, query, req)
  }else if( "/rest/".starts( pathname) ){
    return this.processRestRequest(   pathname, query, req)
  }
  
  try {
    // This code is closure based, ie session state is stored in memory
    var closure = this.getClosure( query.cid)
    // If no closure, figure out something
    if( !closure ){
      // rest/ is for REST requests. ToDo: implement them!
      // Note: this is for requests that are not bound to a specific session
      // because no valid ?cid was provided.
      // When a valid session is provided, .rest() is invoked for that session
      if( "/rest".starts( pathname) ){
        // Flag as "rest" so that respond() does not redirect on POST
        req.isRest = true
        // If "anonymous" client
        if( !query.cid ){
          this.rest_de&&bug( "REST anonymous request, R:", req.deId)
          // Delegate to prototypal guest session of this wiki
          closure = this.getRestClosure()
        // If weird cid, err?
        }else{
          // Delegate to prototypal guest session of root wiki
          closure = this.getRoot().getClosure(
            this.protoGuest.restClosure,
            true // true => Don't mind if session was logged out
          )
        }
      // If not rest, I need to figure out a Session to handle the request
      }else{
        closure = this.lookupSession( pathname, query, req)
      }
      if( closure === false ){
        this.login_de&&bug( "Not a login, R:", req.deId, "pathname:", pathname)
        return false
      }else if( closure === "index.html" ){
        this.protoGuest.redirect( req)
        return false
      }
    }
    // OK, I probably get a closure, let's invoke it
    // Switch to debug mode for session if &debug=xxx valid query parameter
    if( De 
    && closure
    && query.debug
    && (query.debug == this.getRoot().config.debugCode || SW.test)
    ){
      if( !closure.session.isDebug ){
        this.de&&bug( closure.session, "setDebug")
        closure.session.isDebug = true
        closure.session.setDeId( closure.session.id)
      }
    }
    this.invokeClosure( closure, req )
    return true
  }catch( err ){
    De&&bug( Sys.inspect( err))
    this.error( "Error ", Sys.inspect( err))
    if( De ){
      throw err
    }
  }finally{
    // Monitor long requests. ToDo: does not work as is
    if( false && req.timeReceived ){
      Sw.setTimeNow()
      var how_long = Sw.timeNow - req.timeReceived
      if( how_long > 5 && how_long > this.durationLongestRequest ){
        this.monit_de&&bug( "Longest request so far: ", req.deId)
        if( De || how_long > 100 ){
          this.error( closure ? closure.session : this,
            ", longRequest: ", how_long, " msec",
            ", url: ", Sys.inspect( parsedurl),
            ", headers: ", Sys.inspect( req.headers)
          )
        }
        this.durationLongestRequest = how_long
      }
    }
  }
}

WikiProto.processOembedRequest = function( path, query, req ){
// As per http://www.oembed.com/
// URL scheme: http://*.virteal.com/*
// API endpoint: http://virteal.com/oembed/
// We got here from processHttpRequest() because path is /oembed
  var that = this
  this.de&&bug( "oembed, query:", Sys.inspect( query))
  var url = query.url || ""
  var maxwidth  = query.maxwidth  || "320"
  if( maxwidth == "0" ){ maxwidth = 0 }
  var maxheight = query.maxheight
  if( maxheight == "0" ){ maxheight = 0 }
  var format    = query.format    || "json"
  var callback  = query.callback  || query.jsonp
  if( ".json".ends( url) ){
    format = "json"
    url = url.substr( 0, url.length - ".json".length)
  }else if( ".xml".ends( url) ){
    url = url.substr( 0, url.length - ".xml".length)
  }
  var mime = (format == "json") ? "application/json" : "text/xml"
  var data = {}
  data.type          = "rich"
  data.version       = "1.0"
  data.provider_name = SW.name
  data.provider_url  = SW.protocol + SW.domain
  data.width         = maxwidth
  data.height        = maxheight
  // Avoid some urls
  if( /http:\/\/secret\..*/.test( url) ){
    this.de&&bug( "oembed, secret:", url)
    data.html = this.wiki.random3code()
    return send( data)
  }
  if( /^.*\.com\/?$/.test( url) ){
    this.de&&bug( "oembed, nopage:", url)
    data.html = url
    return send( data)
  }
  // Force maxheight if iframe, unless already specified
  if( /^http:\/\/iframe\./.test( url) ){
    if( !maxheight ){ maxheight = 480 }
  }
  // If maxheight is specified, I provide an iFrame
  if( maxheight ){
    // Add iframe pseudo host if not present, so target knows it is iframed
    if( url.indexOf( "//iframe." < 0) ){
      url = url.replace( "http://", "http://iframe.")
    }
    this.de&&bug( "oembed, iframe:", url)
    data.html
    = '<iframe src="' + url   + '"'
    + ' width="'  + maxwidth  + '"'
    + ' height="' + maxheight + '"'
    + ' border="0" style="border:none;"'
    + ' allowTransparency="true"'
    + '></iframe>'
    return send( data)
  }
  // If no max height, I provide a big div
  // Note: it is not currently possible to include more than one wiki this way
  var mock = new MockRequest()
  mock.oembed   = true
  // Add embed pseudo domain if not present, so target knows it is embedded
  if( url.indexOf( "//embed.") < 0 ){
    url = url.replace( "http://", "http://embed.")
  }
  // Extract host part of url to fill "HOST" header
  url = url.replace( "http://", "")
  var ii = url.indexOf( "/")
  if( ii < 1 ){
    data.html = url
    return send( data)
  }
  var host = url.substr( 0, ii)
  url = url.substr( ii + 1)
  mock.url = url
  mock.headers.host = host
  mock.response = mock
  mock.addListener( 'send', function(){
    data.html = mock.writeData
    send( data)
  })
  this.processHttpRequest( mock) 
  function send( data ){
    if( format = "json" ){
      data = JSON.stringify( data)
      if( callback ){
        data = callback + "(" + data + ")"
      }
    }else{
      var buf = [
        '<?xml version="1.0" encoding="utf-8" standalone="yes"?>',
        '<oembed>'
      ]
      for( var key in data ){
        buf.push(
          "<" + key + ">"
          + this.protoGuest.htmlize( data[key])
          + "</" + key + ">"
        )
      }
      buf.push( '<oembed>')
      data = buf.join( "\n")
    }
    that.protoGuest.respond( req, data, mime, true) // true => nocookies
    return true
  }
  return true
}

WikiProto.processRestRequest = function( path, query, req ){
// We got here from processHttpRequest because path starts with /rest/
  return false
}

WikiProto.invokeClosure = function( closure, req ){
  if( !closure ){
    this.bug_de&&bug( "R:", req.deId, "closure:none yet", "url:", req.url)
    return
  }
  // Attach session and request
  var session = closure.session
  req.session = session
  session.req = req
  if( De ){
    Sw.currentSession = session
  }
  // ToDo: this should be somewhere else, ie where name changes
  this.allSessionsByName[session.userName()] = session
  session.touch()
  // Inside the closure, This is the request to handle
  // ToDo: maybe I could req.closure = closure
  closure.call( req, session, closure)
}
  

WikiProto.isClosed = function(){
// Closed wikis require membership to access "normal" pages
// "User" wikis are always closed
  return !this.config.open || this.isUserWiki()
}
WikiProto.declareIdempotentPredicate( "isClosed")

WikiProto.isOpen = function(){
// Open wikis allow guest access to "normal" pages
  return !this.isClosed()
}
WikiProto.declareIdempotentPredicate( "isOpen")

WikiProto.isVeryOpen = function(){
// Very open wikis let members auto register, no prior curator is needed
  return this.isOpen() && this.config.veryOpen
}
WikiProto.declareIdempotentPredicate( "isVeryOpen")


WikiProto.isVeryOpenByDefault = function(){
// Tells if openess of This wiki was never changed.
// The "AboutWiki" page of the root wiki SHOULD reference "PrivateWiki"
// regarding it's prototype. Child wikis inherit that setting and that's
// the way I detect the presence/absence of a change.
// Note: when metadata about the root wiki are loaded, "PrivateRootWiki"
// is used when "PrivateWiki" is detected. See fixProto() about that.
  if( !this.isVeryOpen() )return false
  var config = this.aboutwikiPage
  if( config.proto && config.proto.name == "PrivateWiki" ){
    return true
  }
  return false
}
WikiProto.declareIdempotentPredicate( "isVeryOpenByDefault")


WikiProto.logUser = function( session ){
// Called whenever a user logs in.
// This is where the "session_id" cookie is associated with a session.

  session.wiki_de&&bug( "logUser, W:", this, "S:", session.loginName)
  De&&mand( session.wiki == this )
  
  // Associate session with login code
  if( this.allSessionsBySessionId[session.sessionId] != session ){
    session.login_de&&bug( "logCode:", session.sessionId )
    this.allSessionsBySessionId[session.sessionId] = session
    De&&mand( session.wiki == this, "bad session.wiki")
  }
  // If member
  if( !session.isGuest() ){
    session.login_de&&bug( "logMember:", session.loginName)
    if( !this.allLoginNames[session.loginName] ){
      this.countMembers++
    }  
    this.allLoginNames[session.loginName] = true
    // If same user already logged in, restore context
    var old = this.allSessionsByName[session.loginName]
    if( old && old != session && old.wiki == this && !old.isGuest() ){
      if( !old.isGone ){
        session.login_de&&bug( "Restore session:", old) 
        session.restoreSession( old)
      }else{
        session.login_de&&bug( "comingBack:", session.loginName)
        // old.logout( "relog")
      }
    }
    this.allSessionsByName[session.userName()] = session

  // If guest
  }else{
    session.login_de&&bug( "logGuest:", session.userName())
    this.allSessionsByName[session.userName()] = session
  }

  //session.trackUser()
}

WikiProto.logAuthenticUser = function( session ){
// This method gets called when a User object is bound to the session.
// This happens in Session.userFoundEvent() due to some previous call
// to Session.trackUser().
// Each User has a unique id, the "user id".
// This method updates global data so that further call to getUserById()
// will retrieve the user, given an id.
// It also get rid of the draft code if any.
  var id = session.user.getId()
  this.allUsersById[id]       = session.user
  this.allSessionsByUserId[id] = session
  // Also at root level
  if( !this.isRoot ){
    this.getRoot().logAuthenticUser( session)
  }
}


WikiProto.logGuestVisitor = function( name ){
  var list = this.recentGuestVisitors
  var found = false
  var ii
  var visitor
  for( ii in list ){
    visitor = list[ii]
    if( visitor == name ){
      found = true
      break
    }
  }
  // If returning visitor, move it to beginning of list
  if( found ){
    if( ii == 0 )return
    var tmp = list[0]
    list[0] = name
    list[ii] = tmp
    this.touch()
    return
  }
  // If new visitor, add it to list
  this.recentGuestVisitors = [name].concat( list.slice( 0, 20))
  this.touch()
}

WikiProto.lookupUser = function( session ){
// Given a session, try to retrieve it's User object
// Side effect: memorize it
  
  var that = this

  // Nothing to do if already done
  if( session.user )return session.user

  // Let's try using the "authentic" names
  var all_pages = this.allPages
  function check( service, id ){
    if( !id )return null
    var page = all_pages[service + "Id" + id]
    that.de&&mand( !page || !page.localUser || page.localUser.isLocal )
    return page && page.localUser
  }

  user = (
     check( "Wiki",     session.wikiId)
  || check( "Twitter",  session.twitterName)
  || (this.dropbox && this.dropbox.token 
    && check( "Dropbox", this.dropbox.token))
  )

  if( user ){
    this.login_de&&bug( "Found user using an authentic name")
    this.de&&mand( user.isLocal )
    session.user = user
    return user
  }
  
  // Try with root also
  return this.isRoot ? null : this.getRoot().lookupUser( session)

}


WikiProto.logout = function( session ){
// Called whenever a user is logged out
  session.wiki_de&&bug( "logout, W:", this)
}

WikiProto.isKnownUser = function( name ){
// Returns true if user previously logged in
  return this.allLoginNames[name]
}

WikiProto.getSession = function( name ){
// Get session associated to user's login name
  return this.allSessionsByName[name]
}

Wiki.timeoutCheckGoneSession = function( session ){
// This static method checks if a session shows some activity, if it does not
// then the session is logged out
// This method is called once when the session is created, then it calls
// itself, with a delay, as long as the session is still active
// ToDo: should be a Session method, not a Wiki method
  session.isAway()
  // Reschedule unless session is gone
  if( !session.isGone ){
    setTimeout( Wiki.timeoutCheckGoneSession, SW.awayDelay, session)
  }
}

Wiki.decode = function( str ){
// tag_xxxx becomes #xxx

  if( !str ) return str
  var ii
  var path = ""
  if( (ii = str.lastIndexOf( "/")) >= 0 ){
    path = str.substr( 0, ii + 1) + "/"
    str = str.substr( ii + 1)
  }
  if( "tag_".starts( str) ){
    str = "#" + Wiki.decode( str.substr( "tag_".length))
  }
  return path + str
}

Wiki.encode = function( pagename ){
// #xxxx becomes tag_xxxx

  // Twitter hashtag
  if( "#".starts( pagename) ){
    pagename = "tag_" + Wiki.encode( pagename.substr( 1))
  }
  return pagename
}

Wiki.encodePath = function( list ){
// Invoke Wiki.encode() on each element of the list, return / separated results
  var buf = []
  for( var ii in list ){
    buf.push( Wiki.encode( list[ii]))
  }
  var result = proto + buf.join( "/")
  return result
}

Wiki.decodePath = function( path ){
// Decode from the format used to encode, typically from a GET's path
// Get rid of front and last potential /
// Note: I don't expect http:// nor ? query parameters
// Returns a list
  var list = path.split( "/")
  var buf = []
  for( var ii in list ){
    buf.push( Wiki.decode( list[ii]))
  }
  return buf
}

WikiProto.sessionIdCookieName = function( prefix ){
// Build name of session id cookie, depends on wiki's fullname
// ToDo: signed cookies, https://github.com/jed/cookie-node
  // Encode _ into __ et / into _
  // minor bug: both _/ and /_ becomes ___, both __ and /_/ become ____, etc
  // ToDo: use encodeURIComponent()
  prefix || (prefix = "session_id")
  return "sw_" + prefix + encodeURIComponent(
    this.fullname().replace( /_/g, "__").replace( /\//g, "_")
  )
}
WikiProto.declareIdempotentGetter( "sessionIdCookieName" )

WikiProto.registerClosure = function( f ){
// Remember a closure, and its session. Returns a printable unique id.
  var id
  // ToDo: Try a random id and check if it's user is still there,
  // or else... memory leaks pretty quickly I'm afraid
  id = this.getRoot().allClosures.length
  this.getRoot().allClosures[id] = f
  id = (id + this.getRoot().idSalt).toString()
  f.id = id
  return id
}

WikiProto.deregisterClosure = function( f ){
  var id = parseInt( f.id, 10) - this.getRoot().idSalt
  // ToDo: should I "delete" instead?
  this.getRoot().allClosures[id] = null
}

WikiProto.getClosure = function( closure_id, gone_is_ok ){
  NDe&&bug( "?Wiki closure " + closure_id )
  if( !closure_id ){ return null }
  closure_id = parseInt( closure_id, 10) - this.getRoot().idSalt
  // Closure ids are global, ie registered at the root wiki level only
  var closure_f = this.getRoot().allClosures[closure_id]
  // Check if the closure is about a gone session, if so, filter out
  if( closure_f
  && !gone_is_ok
  && closure_f.session
  && closure_f.session.isAway()
  && closure_f.session.isGone
  ){
    delete this.getRoot().allClosures[closure_id]
    closure_f = null
  }
  return closure_f
}


WikiProto.getRestClosure = function(){
// When some "anonymous" rest request is received, it is forwarded to a fake
// guest session. That fake session is created only when a first such request
// is received, to avoid some overhead.
  var guest = this.protoGuest
  if( !this.isRoot() && this.protoGuest.wiki != this ){
    this.login_de&&bug( "Create local proto guest")
    this.protoGuest = new Session
    this.protoGuest.login( this)
    // I patch the name for the rare cases where it is displayed
    this.protoGuest.loginName = SW.name
    this.protoGuest.isBot     = true
    this.protoGuest.logout( "proto")
    guest = this.protoGuest
  }
  var closure_id = guest.restClosure
  return this.getClosure( closure_id, true) // true => don't mind if gone
}


WikiProto.trackBacklink = function( page, referer, is_private ){
// Remember some back link from referer to page
// Returns true iff such link if first encountered
  return this.trackBacklinkName( page.name, referer, is_private)
}

WikiProto.trackBacklinkName = function( pagename, referer, is_private ){
// Remember some back link from referer to page
  De&&mand( pagename)
  var bag = this.allBacklinksByPage[pagename]
  if( !bag ){
    this.allBacklinksByPage[pagename] = bag = {}
  }
  if( !bag[referer.name] ){
    bag[referer.name] = {page: referer, isPrivate: is_private}
    //this.de&&bug( "tracked link, referer:", referer, "target:", pagename)
    return true
  }else{
    return false
  }
}

WikiProto.forEachBacklink = function( page, with_private, cb ){
// Iterates backlinks of a page. calls cb( referrer_page, page, is_private )
// Side effect: delete obsolete links when referrer does not link to page
// anymore.
  var bag = this.allBacklinksByPage[page.name]
  if( !bag ) return false
  var referer_info
  var referer_name
  var referer
  var to_delete = {}
  var r
  for( referer_name in bag ){
    referer_info = bag[referer_name]
    referer = referer_info.page
    // I check that the other page still references this page
    // If the other page was not incarned, assume no change
    if( !referer.wasIncarned()
    ||  (referer.linksTo( page) && !referer.isNull())
    ){
      if( with_private || !referer_info.isPrivate ){
        r = cb.call( this, referer, page, referer_info.isPrivate)
        if( r === false )break
      }
    // Delete old references
    }else{
      to_delete[referer_name] = referer
    }
  }
  for( var referer_name in to_delete ){
    referer = bag[referer_name].page
    this.de&&mand( referer, "bad referer")
    if( De ){
      if( !referer.linksTo( page) ){
        this.de&&bug( "delete backlink, referer:", referer, "target:", page)
      }else{
        this.de&&bug( "delete blank, referer:", referer, "target:", page)
      }
    }
    delete bag[referer_name]
    // Also forget all links to empty pages?
    if( false && referer.isNull() ){
      delete this.allBacklinksByPage[referer_name]
    }
  }
  return true
}

WikiProto.forEachPage = function( home, session, cb, already_incarned_only ){
// Iterate all reacheable pages from some root page.
//  However, don't visit new seen pages if "alreay_incarned_only" is set.
// Defauts to "HomePage" root.
// Callback is called with some page name.
// Callback's page name is null when last called.
  var that = this
  var visited = {}
  var page
  var to_visit = []
  var match
  var total_size = 0
  to_visit.push( home ? home.name : "HomePage")
  var visit = function(){
    var pagename
    if( (pagename = to_visit.pop())
    && (page = session.lookup( pagename)) // Always true, but I need "page"
    && (!session || session.mayRead( page))
    && (!already_incarned_only || page.wasIncarned())
    ){
      NDe&&bug( "Visiting ", pagename)
      page.read( function( err, page ){
        if( !err ){
          var content = page.isDraft() ? page.getNondraftBody() : page.getBody()
          total_size += content.length
          var reg = new RegExp( SW.wikiwords)
          var word
          var referer = page // that.lookupPage( page)
          cb.call( that, referer)
          while( match = reg.exec( content) ){
            NDe&&bug( "Match: ", Sys.inspect( match))
            if( (word = match[2]) ){
              if( !"Do".starts( word)
              // Avoid #xxxx in CSS pages & Angular pages
              &&  (!"#".starts( word)
                || !(page.isCss() || page.isAngular() || page.isToDo()))
              ){
                word = word.substr( 0, 99)
                NDe&&bug( "word ", word)
                that.trackBacklinkName( word, referer)
                if( !visited[word] ){
                  visited[word] = true
                  to_visit.push( word)
                }
              }
            }else{
              De&&bug( "Broken loop in forEachPage()")
              //De&&mand( false)
            }
          }
        }
        // This is recursive, because it is asynchronous
        // ToDo: could be faster, maybe, if not sequential...
        visit()
      })
    }else{
      if( true || !session ){
        De&&bug( "Wiki total size: ", total_size)
      }
      
      cb.call( that, null)
    }
  }
  visit()
}


WikiProto.trackDraftPage = function( page ){
// Remembers if a page is a draft page
  if( !page.isDraft() )return this.trackNondraftPage( page)
  if( this.allTransientPages[page.name] ){
    De&&bug( "Already a draft:", page)
    De&&mand( page.nondraft )
    return
  }
  this.touch()
  // Keep count of draft pages, for speed. Ignore some pages, they confuse
  if( !page.isUser() ){ this.countDrafts++ }
  this.allTransientPages[page.name] = page
}


WikiProto.trackNondraftPage = function( page ){
// Forgets that a page is in draft mode
// Note: this does not restore the non draft version of the page,
// it actually forget about it. It is up to the caller to use
// the non draft version to restore, if that's what's needed.
  // Note: cache is not written to store
  if( !this.allTransientPages[page.name] ){
    De&&bug( "notDraftPage:", page)
    De&&mand( !page.nondraft )
    return false
  }
  De&&mand( !page.nondraft, "draft version" )
  this.touch()
  De&&bug( "Wiki is stamping (or clearing) a draft")
  if( !page.isUser() ){ this.countDrafts-- }
  delete this.allTransientPages[page.name]
  var p = this.allPages[page.name]
  De&&mand( p === page )
  return true 
}


WikiProto.draftsCount = function( with_codes ){
// Returns the number of draft pages, with or without draft codes (and users)
  if( !with_codes )return this.countDrafts
  // That was fast, but it gets slower if I need draft codes too
  var size = 0
  var key
  for( key in this.allTransientPages ){
    size++
  }
  return size
}

WikiProto.isEmpty = function( exclude_drafts ){
// ToDo: this does not work well
  return this.countPageWrites ==  0
  && (exclude_drafts || this.draftsCount() == 0)
}
WikiProto.declareIdempotentPredicate( "isEmpty")


WikiProto.forEachDraft = function( cb, with_users ){
// Iterates draft pages, with or without draft user pages
  var name
  var page
  var r
  for( name in this.allTransientPages ){
    page = this.allTransientPages[name]
    if( with_users || !page.isUser() ){
      r = cb.call( this, this.allTransientPages[name])
      if( r === false )break
    }
  }
}

WikiProto.stampsCount = function(){
// Returns the number of entries in "RecentStamps"
  var page = this.allPages["RecentStamps"]
  if( !page ) return 0
  // ToDo: Better regexp?
  var nstamps = page.getBody().split( 
    new RegExp( SW.datePattern, "i")
  ).length
  if( nstamps > 0 ){ nstamps-- }
  return nstamps
}
WikiProto.declareIdempotentGetter( "stampsCount")

WikiProto.forEachSession = function( cb ){
// Iterate over all sessions, there can be a lot
  var id
  var session
  var sessions = this.allSessions
  // Sort, young sessions firsts
  sessions = sessions.sort( function( a, b ){
    return b.timeLogin - a.timeLogin 
  })
  var r
  for( id in sessions ){
    session = this.allSessions[id]
    if( session != this.protoGuest ){
      r = cb.call( this, session)
    }
    if( r === false )break
  }
}

WikiProto.recentSessionsCount = function(){
  return this.allSessions.length
}
WikiProto.declareIdempotentGetter( "recentSessionsCount")

WikiProto.forEachMember = function( cb ){
// Iterate over members that logged in since start up.
// This does not include guest users, they're not "members".
  var code
  var session
  var r
  // ToDo: I should iterate over allSessionsByName
  for( id in this.allSessionsBySessionId ){
    session = this.allSessionsBySessionId[id]
    if( !session.isGuest() ){
      r = cb.call( this, session, id )
      if( r === false )break
    }
  }
}

WikiProto.forEachClone = function( cb ){
  var name
  var wiki
  var r
  for( name in this.allClones ){
    wiki = this.allClones[name]
    r = cb.call( this, wiki)
    if( r === false )break
  }
}

WikiProto.clonesCount = function(){
  var sum = 0
  var name
  for( name in this.allClones ){
    sum++
  }
  return sum
}
WikiProto.declareIdempotentGetter( "clonesCount")

WikiProto.membersCount = function(){
// Returns total number of members who logged in since start up.
  return this.countMembers
}
WikiProto.declareIdempotentGetter( "membersCount")

WikiProto.recentMembersCount = function(){
  return this.countMembers
  // Alternative:
  var sz = 0
  this.forEachMember( function(){ sz++ })
  return sz
}



WikiProto.putPage = function( page, body, cb ){
// Put page in store (unless draft) and cache, asynchronous
  page.de&&mand( !page.isDraft(), "cannot put draft page")
  // this is a create if some failed attempt to get page from store occured.
  // I also assume it is a creation if no attempts to get from store, this
  // is not 100% safe but I believe that it is almost always correct
  var is_create = !page.wasIncarned() || page.err  // err => does not exist
  // Side effect on body, see fixProto() for side effect on proto
  if( page.isPending() ){
    // ToDo: how should I handle concurrent writes to the same file?
    this.bug_de&&bug( "concurrentWrite:", page)
  }
  page.de&&mand( !page.isVirtual(), "bad virtual:" + page )
  page.incarnBody( body, "pending")
  var that = this
  // Recently modified pages are "hot"
  if( !page.isPrivate() ){ page.setHot() }
  // Update proto if page say so, then store, unless draft
  that.fixProto( page, once( function wiki_put_page_fix_proto_cb(){
    // Draft pages stay in memory until stamped/approved
    if( page.isDraft() ){
      cb.call( that, 0, page)
    // Non draft pages are written to disk
    }else{
      var body = page.getBodyWithJsonContext()
      that.consumeTestPage( page.name)
      that.pageStore.put(
        page.name,
        body, 
        once( function wikiputpage_cb( err ){
          if( err ){
            // ToDo: handle error
            if( !page.isPending() ){
              // ToDo: how should I handle concurrent writes to the same file?
              this.bug_de&&bug( "concurrentWriteErrCb:", page, "err:", err)
            }		  
          }else{
            if( is_create ){
              that.countPageCreates++
            }
            if( !page.isPending() ){
              // ToDo: how should I handle concurrent writes to the same file?
              this.bug_de&&bug( "concurrentWriteCb:", page)
            }
          }
          page.incarnErr( err)
          cb.call( that, err, page)
        })
      )
    }
  }))
}

WikiProto.fixProto = function( page, cb ){
// Does nothing for most pages, just calls cb().
// "About" pages have "proto" data that are the data
// of a page whose name is on the first line of the page.
// One such page is the very special "AboutWiki" page, a page that tells about
// the configuration of a wiki.
// Must never be called against a draft page.  
  page.assertIsPage()
  if( !page.isAbout() ){
    //this.deep_store_de&&bug( "no proto, Invoke cb:", Sys.inspect( cb))
    return cb()
  }
  page.de&&mand( !page.isDraft() )
  var proto_name = page.getBody().frontLine().replace( /\s/g, "")
  this.deep_store_de&&bug( "fixProto:", page.name, "body:", 
    page.getBody().substr( 0, 40).replace( /\n/g, "\\n") + "..."
  )
  if( proto_name ){
    this.store_de&&bug( "fixProto:", page.name, "with:", proto_name)
    // The root wiki has a special default config for security reasons
    if( this.isRoot() ){
      if(  proto_name == "PrivateWiki" ){
        proto_name = "PrivateRootWiki"
      }else{
        this.bug_de&&bug( "Weird, expected PrivateWiki, found:", proto_name)
      }
    }
    var that = this
    that.lookupPage( proto_name).read(
      function fix_proto_cb( merr, datapage ){
        if( merr ){	  
        }else{
          page.proto = datapage
          // If page is special page "AboutWiki", then I need to update the wiki
          if( page.name == "AboutWiki" ){
            // Note: processConfig() uses the non draft version of the page
            that.processConfig( page)
          }
        }
        this.deep_store_de&&bug( "fetchProto:", datapage, "invoke cb")
        return cb()
      }
    )
    return
  }
  cb()
}


WikiProto.fetchPage = function( name, cb ){
// Get page in store, asynchronous
// If page is draft, get non draft version incarned
// Calls cb( err, page)
// This method is called by Page.read() only
  
  // ToDo: DRY, this code is repeated in Page.read()
  var page = this.lookupPage( name)

  // Use cached content if already fetched
  var cached = page // this.allPages[name]
  if( page.nondraft ){
    cached = page.nondraft
  }else{
    cached = page
  }
  // However, force reload if content starts with "Original" (in clones only)
  var need_original = cached
  && cached.body
  && !this.isRoot()
  && ("Original" == cached.body.frontLine()
    || (page.wasInherited() && page.wasDeleted())
  )

  // Also force reload if config says so
  var cacheable = !this.config.noCache

  if( !need_original
  &&  cacheable && cached && cached.wasIncarned()
  // If draft, make sure non draft page was incarned, ToDo: remove
  && (!page.nondraft || page.nondraft.wasIncarned())
  ){
    return !cb ? page.body : cb.call( this, page.err, page)
  }
  var that = this

  // Once fetched, create or update cache
  var fixproto = function fetchfixproto( page, body, inherited, err ){ 
    // Double check that fetching was really needed, for it's costly
    if( !need_original && cached && cached.body ){
      if( page.wasIncarned() && !page.nondraft ){
        // For whatever reason the page was incarned in parallel
        that.bug_de&&bug( "Fetched page already incarned, page:", page)
      }
      if( page.nondraft && page.nondraft.wasIncarned() ){
        that.bug_de&&bug( "Fetched non draft already incarned, page:", page)
      }
      //De&&mand( !page.wasIncarned() || page.nondraft )
      //De&&mand( !page.nondraft      || !page.nondraft.wasIncarned() )
    }
    var nondraft = page.incarnRestore( body, inherited, err)
    return that.fixProto( nondraft, once( function fixproto_cb(){ 
      return cb.call( that, err, page)
    }))    
  }
  
  // Import from Ward's wiki
  if( this.name == "c2" ){
    var page = that.lookupPage( name)
    if( !page.isSpecial()
    && !page.isSensitive()
    && !page.isStamps()
    ){
      return this.fetchC2( name, cb)
    }
  }
  // Handle #rfcnnnn 
  if( "#rfc".starts( name) ){
    var rfc = name.substr( "#rfc".length)
    return this.fetchRfc( rfc, cb)
  }
  // Get from store. unless previous failure
  if( cached && cached.err ){
    this.store_de&&bug( "Useless refetch avoided, err:", err)
    return !cb ? cached.body : cb.call( this, cached.err, cached)
  }
  if( cached && cached.isPending() ){
    // I should be reading from local cache...
    // I could use de&&mand(), but I prefer to take the hit
    page.bug_de&&bug( "Unexpected read during ongoing write")
  }
  var that = this
  function fake_test_get( name, cb ){
    that.consumeTestPage( name)
    cb.call( 1, null )
  }

  var get = this.isTestPage( name) ? fake_test_get : this.pageStore.get
  get.call( this.pageStore, name, function fetchget_cb( err, body ){

    page = that.lookupPage( name)

    if( page.isPending() ){
      // I am checking that the PageStore() deal with this correctly
      if( body != page.body ){
        // This should never happen with the default file based PageStore
        page.bug_de&&bug( "write during ongoing read, mismatch")
      }
    }
    if( !err && body ){
      NDe&&bug( "Body is ", Sys.inspect( body))
    }

    // If no content or Original required, try to get from the parent wiki
    if( err || !body || need_original || body.frontLine() == "Original" ){
      // Inherit, but "HomePage", this one is always local, less confusing
      // Stamps are local too & so are PrivateCodes and PrivateContext
      // ToDo: for scalability reasons it is not good to try to inherit from
      // the root wiki, most of the time it will fail.
      // A better solution is to preload some pages in the root wiki and
      // inherit root wiki pages only if they are in memory.
      // "Parent" page inherit from a non parent page
      var true_name = name
      if( page.isParent() ){
        name = page.getParentPageName()
      }
      if( that.parentWiki
      && (name != "HomePage" || true_name == "ParentHomePage") 
      && !page.isCopy()
      && !page.isStamps()
      && !page.isDeletion()
      && name != "PrivateCodes"
      && !"PrivateContext".starts( name)
      ){
        // Inherit page from parent, get the non draft version
        return that.parentWiki.lookupPage( name).read( function( err, ipage ){
          ipage.assertIsPage()
          that.de&&bug( "inheriting:", ipage.name, "draft:", page.isDraft(),
          "err:", err)
          // ToDo: get rid of this, body is not needed
          var body = ipage.body
          if( ipage.isDraft() ){
            if( ipage.nondraft ){
              body = ipage.getNondraftBody()
            // If no non draft version to inherit... something is weird
            }else{
              that.bug_de&&bug(
                "BUG? inherited draft but no nondraft, page:", ipage)
              body = ""
            }
          }
          if( !err && ipage.isNull() ){
            that.de&&bug( "pointlessInheritance:", ipage.name)
          }
          if( err ){
            page.bug_de&&bug( "inherited page, err:", err)
            fixproto( page, null, false, err)
          }else{
            fixproto(
              page,
              body,
              ipage, // inherited
              err
            )
          }
        })
      }
      // No inherit
      fixproto( page, body, false, err)
    // If valid content and not Original required
    }else{
      fixproto( page, body, false, err)
    }
  })
  return this
}

WikiProto.resetInheritedPage = function( page ){
// Need to be followed by a call to fetchPage()
  De&&mand( page.wasInherited(), "not inherited" )
  page.body = "Original"
  return this
}

WikiProto.putPageSync = function( page, body ){
// ToDo: this is hack, get rid of it somehow
  page.body = body.toString()
  return this
}


Wiki.extractBasicYaml = WikiProto.extractBasicYaml = function( text ){
// Some Yaml style subset to extract data from raw text.
// "---" mark the start of the parsed data. A hash.
// "name: value" syntax, value is always a string, optional ""
// If optional "" then enclosed \" become "
// whitespaces are ok before name.
// ONE space is needed after ":"
// Empty line or malformed name mark the end of the parsed data.
// Returns null or hash with name/value pair.
  if( !text )return null
  var ii = text.indexOf( "\n---\n")
  if( ii < 0 ){
    if( !"---\n".starts( text) ) return null
    text = text.substr( "---\n".length)
  }else{
    text = text.substr( ii + "\n---\n".length)
  }
  var lines = text.split( "\n")
  var line
  var vals = {}
  var size = 0
  var name
  var val
  for( line in lines ){
    line = lines[line]
    if( (ii = line.indexOf( ": ")) < 0 )break
    name = line.substr( 0, ii).replace( /\s/g, "")
    if( !/\w+/.test( name) )break
    val = line.substr( ii + 2)
    if( '"'.starts( val) ){
      try{
        val = JSON.parse( val)
      }catch( err ){
        this.de_bug&&bug( "Malformed JSON:", name, "val:", val)
      }
    }
    this.yaml_de&&bug( "found:", name, "val:", val)
    vals[name] = val
    size++
  }
  // ToDo: handle case where there are multiple Yaml sections
  return size ? vals : null
}

Wiki.injectBasicYaml = WikiProto.injectBasicYaml = function( text, hash, at_the_end ){
// Replaces old basic Yaml in text by new one built from data hash.
  // Make sure text is \n terminated
  if( text && text.charAt( text.length - 1) != "\n" ){
    text += "\n"
  }
  hash || (hash = {})
  // Compute what to insert
  var insert = ["\n---"]
  var item = null
  var value
  var new_size = 0
  for( item in hash ){
    if( value = hash[item] ){
      value = value.toString()	
      if( value.indexOf( '"') >= 0 || value.indexOf( '\n') >= 0 ){
        value = Wiki.jsonEncode( value)
      }
      new_size++
      insert.push( item + ": " + value)
    }
  }
  insert.push( "")
  // Inserted stuff is \n delimited on both sides
  insert = insert.join( "\n") + "\n"
  // "Add" if no previous Yaml section
  var ii = text.search( /\n---\n/) // indexOf( "\n---\n")
  if( ii < 0 ){
    if( new_size ){
      text = text.replace( /\n*$/, "\n") + insert
      this.yaml_de&&bug( "newSection:", insert)
    }
  // "Replace" if some previous Yaml section
  }else{
    var head = text.substr( 0, ii)
    var tail = text.substr( ii + "\n---\n".length)
    // Detect end of yaml on first non matching line
    // ToDo: improve the pattern, this one eats lines with : in them
    ii = tail.search( /^[^:]*$/m)
    if( ii < 0 ){
      tail = ""
    }else{
      tail = tail.substr( ii + 1)  // + 1 to eat the terminating \n
    }
    if( new_size ){
      // Insert at the end or in place?
      // ToDo: Handle case where there are multiple Yaml sections
      // ie. each attribute should be replaced where it previously was
      // new attributes should be added in last section
      // and of course removed attributes should be removed from all sections
      if( at_the_end ){
        text = [head, tail, insert].join( "")
      }else{
        text = [head, insert, tail].join( "")
      }
    }else{
      text = head + tail
    }
    this.yaml_de&&bug( "Yaml section:", insert)
  }
  // Post-condition: new text contains desired hash
  if( De ){
    var new_hash = Wiki.extractBasicYaml( text)
    // ToDo: bombs when flasy value are removed, should not
    // De&&mand( Sw.equalHash( new_hash, hash) )
  }
  return text
}


WikiProto.isAnonymous = function( ignore_title ){
// A wiki is anonymous if its name is a random FreeCode, unless some
// config based title was given (and is not to be ignored)
  if( !ignore_title && this.config.title )return false
  return /3\w\w\-\w\w\w\-\w\w\w$/.test( this.name)
}
WikiProto.declareIdempotentPredicate( "isAnonymous")

WikiProto.isGuest = function( name ){
// Tells if a user is a "guest" user (vs a "member" user)
  // 2014 true if not a twitter name
  if( name[0] !== "@" )return true;
  // True if name includes "Guest", simple, but not very nice, ie collisions
  if( name.includes( "Guest" ) ) return true
  // False if wiki is very open, ie if everyone can modify it
  if( this.isVeryOpen() ) return false;
  // True if the user hash a UserXxxxx page is "transient" currently
  if( this.allTransientPages[this.protoGuest.usernamize( name)] ){
    return true
  }
  return false
}

WikiProto.unshiftTest3Code = function( code ){
// Determine what Wiki.random3Code() will return, for tests.
  Wiki.testRandom3Codes || (Wiki.testRandom3Codes = [])
  Wiki.testRandom3Codes.unshift( code)
}

Wiki.random3Code = WikiProto.random3Code = function( sep ){
// I use auto generated names for wiki names, and invitation codes sometimes.
// And also for User unique ids.
// They are 3xx-xxx-xxx style usually, I call them FreeCodes
// There is a small chance of collision, I take it (fixable)
// ToDo: it's not so small a chance, when there are lots of users
  if( Wiki.testRandom3Codes ){
    var test3Code = Wiki.testRandom3Codes.shift()
    if( Wiki.testRand3Codes.length == 0 ){
      Wiki.testRandom3Codes = null
    }
    return test3Code.split( '-').join( sep)
  }
  var str = "3"
  var max = SW.valid3.length
  for( var ii = 0 ; ii < 8 ; ii++ ){
    str += SW.valid3[Math.floor( Math.random() * max)]
    if( sep && (ii == 1 || ii == 4) ){
      str += sep
    }
  }
  this.f3Code_de&&bug( "Random 3Code:", str)
  return str
}

Wiki.random4Code = WikiProto.random4Code = function( sep ){
// ToDo: I will use 4Code instead of 3 codes to avoid too much collisions.
// I will use auto generated names for wiki names and invitation codes sometimes.
// And also for User unique ids.
// They are 4xxx-xxxx-xxxx style usually, I call them FreeCodes
// There is a small chance of collision, I take it (fixable)
  if( Wiki.testRandom4Codes ){
    var test4Code = Wiki.testRandom4Codes.shift()
    if( Wiki.testRand4Codes.length == 0 ){
      Wiki.testRandom4Codes = null
    }
    return test4Code.split( '-').join( sep)
  }
  var str = "4"
  var max = SW.valid3.length
  for( var ii = 0 ; ii < 15 ; ii++ ){
    str += SW.valid3[Math.floor( Math.random() * max)]
    if( sep && (ii == 2 || ii == 6) ){
      str += sep
    }
  }
  this.f3Code_de&&bug( "Random 4Code:", str)
  return str
}

Wiki.createDisposableCode = WikiProto.createDisposableCode = function(){
// Static
// Return a "D3aabbbccc" style random string.
// Such codes are used as session identifiers for session without
// human created code attached.
// Together with the target wiki they make unique cookie names.
  // D for Disposable
  var code = "D" + this.random3Code()
  return code
}

Wiki.isDisposableCode = function( str ){
// Returns true if str was most probably created using
// Wiki.createDisposableCode()
  return str
  && str.length == ("D3aabbbccc".length)
  && "D3".starts( str)
}


Wiki.redize = function( str ){
  if( !str )return ""
  return "<em>" + str.substr( 0, 1) + "</em>" + str.substr( 1)
}

Wiki.htmlizeMap = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;"
}

Wiki.htmlize = function( txt ){
// Per HTML syntax standard, &, < and > must be encoded in most cases, <script>
// CDATA and maybe <textarea> are the exceptions.
  // Protect pre-encoded i18n stuff, unless "HTML" in text tells differently
  if( txt.indexOf( "HTML") < 0 ){
    txt = txt.replace( /&([a-z]{2,7};)/, "\r$1")
  }
  var map = Wiki.htmlizeMap
  txt = txt.replace( /[&<>]/g, function( ch ){ return map[ch] })
  // Restore pre-encoded i18n stuff
  txt = txt.replace( /\r([a-z]{2,7};)/, "&$1")
  return txt
}

Wiki.dehtmlizeMap = {
  "&amp;": "&",
  "&lt;":  "<",
  "&gt;":  ">"
}

Wiki.dehtmlize = function( txt ){
  var map = Wiki.dehtmlizeMap
  return txt.replace( /(&.*;)/g, function( ch ){ return map[ch] })
}

Wiki.htmlizeAttrMap = {
  "&": "&amp;",
  '"': "&quot;",
  "'": "&#39;"
}

Wiki.htmlizeAttr = function( txt ){
// HTML syntax dictactes that attribute cannot contain " and, that's a bit
// suprizing ' and &... they must be encoded.
// Google Chrome specially does not like ' in attributes... it freeezes in
// some cases.
  var map = Wiki.htmlizeAttrMap
  return txt.replace( /[&"']/g, function( ch ){ return map[ch] })
}

Wiki.dehtmlizeAttrMap = {
  "&amp;": "&",
  "&quot;": '"',
  "&#39;": "'"
}

Wiki.dehtmlizeAttr = function( txt ){
// HTML syntax dictactes that attribute cannot contain " and, that's a bit
// suprizing ' and &... they must be encoded.
// Google Chrome specially does not like ' in attributes... it freeezes in
// some cases.
  var map = Wiki.dehtmlizeAttrMap
  return txt.replace( /(&.*;)/g, function( ch ){ return map[ch] })
}

Wiki.jsonEncode = function( value ){
// Like JSON.stringify() but safe to XSS regarding </script> & co
// See http://stackoverflow.com/questions/4176511/embedding-json-objects-in-script-tags
  var txt = JSON.stringify( value)
  return txt.replace( /</g, "\\u003c").replace( /-->/g, "--\\>")
}


WikiProto.host = function(){ return SW.domain }
WikiProto.declareIdempotentGetter( "host")

// ToDo: https://secure.wikimedia.org/wikipedia/en/wiki/Percent-encoding
// I suspect I don't handle weird page names (ie chinese, russian, arabic,
// etc) so well...
WikiProto.permalink = function( pagename, code, fullname ){
  return SW.protocol
  + this.host()
  + "/" 
  + (fullname || (!this.isRoot() ? this.fullname() : ""))
                    //Wiki.encodeUrl( this.fullname()) : "")
  + Wiki.encode( pagename) // Wiki.encodeUrlPagename( pagename)
  + (code ? "?code=" + encodeURIComponent( code) : "")
}


WikiProto.htmlA = function( label, page, title ){
// Returns "<a ...." with permalink to page. title is optional.
// Neither page nor title need to be encoded
  return HtmlA(
    label,
    this.permalink( page),
    title // title is encoded by HtmlA()
  )
}

WikiProto.interwiki = function( moniker ){
// See http://meatballwiki.org/wiki/InterMap
  if( moniker == SW.name ){
    return SW.protocol + this.host() + (SW.test ? ":" + SW.port : "") + "/"
  }
  if( moniker == "SimpliWiki" ){
    return "http://simpliwiki.virteal.com/"
  }
  var map = Sw.interwikiMap
  if( map ){
    var match = map[moniker]
    if( match ){
      return match
    }
  }
  map = this.interwikiMap
  if( !map ){
    De&&bug( "No InterWiki Map")
    return moniker + ":"
  }
  if( match = map[moniker] ){
    return match
  }
  De&&bug( "no interwiki:", moniker)
  return moniker + ":"
}

WikiProto.isBotRequest = function( req ){
  De&&mand( req.response, "no response" )
  var useragent = req.headers["user-agent"]
  var langs = req.headers["accept-language"]
  if( (!langs && (!useragent || !useragent.includes( "X11")))
  ){
    if( "/rest".starts( req.url) )return false
    this.bot_de&&bug( "detected on ", req.url)
    this.bot_de&&bug( "no accept-language ", Sys.inspect( req.headers))
    return true
  }
  // ToDo: config about bots ok or not
  return false
}


Wiki.asciiMap = {
  "\xC0": "A", // acute
  "\xE0": "a", // acute
  "\xC2": "A", // circumflex
  "\xE2": "a", // circumflex
  "\xC6": "A", // AE ligature
  "\xE6": "a", // ae ligature
  "\xC7": "C", // cedilla
  "\xE7": "c", // cedilla
  "\xC8": "E", // grave
  "\xE8": "e", // grave
  "\xC9": "E", // acute
  "\xE9": "e", // acute
  "\xCA": "E", // circumflex
  "\xEA": "e", // circumflex
  "\xCB": "E", // umlaut
  "\xEB": "e", // umlaut
  "\xCE": "I", // circumflex
  "\xEE": "i", // circumflex
  "\xCF": "I", // umlaut
  "\xEF": "i", // umlaut
  "\xD4": "O", // circumflex
  "\xF4": "o", // circumflex
  "\xD9": "U", // grave
  "\xF9": "u", // grave
  "\xDB": "U", // circumflex
  "\xFB": "u", // circumflex
  "\xDC": "U", // umlaut
  "\xFC": "u", // umlaut
  "\x80": "E", // Euro
  "\u0152": "O",// OE ligature
  "\u0153": "o",// oe ligature
  "\u20A3": "F" // Franc
}

Wiki.toAscii = function( txt ){
// Converts some weird characters into a decent ASCII equivalent.
// Other characters are left unchanged.
  var map = Wiki.asciiMap
  txt = txt.replace(
    /[\xC0\xE0\xC2\xE2\xC6\xE6\xC7\xE7\xC8\xE8\xC9\xE9\xCA\xEA\xCB\xEB\xCE\xEE\xCF\xEF\xD4\xF4\xD9\xF9\xDB\xFB\xDC\xFC\x80\u0152\u0153\u20A3]/g,
    function( ch ){ return map[ch] }
  )
  return txt
}

WikiProto.sanitizePath = function( str ){
// Figure out a decent path for a page. Returns "" if none.
// "/jhr" => "jhr/HomePage"
// "/JeanHuguesRobert" => "JeanHuguesRobert"
// "/@jhr" => "@jhr"
// "/@jhr/xxx" => "jhr/xxx"
// ToDo: Encoding is a mess at this point.

  // Remove / at the beginning and at the end
  str = str.replace( /(^\/)|(\/$)/, "")

  // Get rid of ctrl chars
  var path = (str || "").replace( /[\x00-\x1f]/g, "")
  
  // ToDo: 2014 Get rid of all weird characters
  // path = path.replace( /[^@#_A-Za-z0-9\/]/, "" );

  if( str == "" )return ""

  // At most 255 chars (max for a FQDN, RFC 2181)
  path = path.substr( 0, 255)

  // Split in parts, / separated
  var items = path.split( "/")
  var item
  var list = []
  var depth_credit = 2
  var last_item_idx = items.length - 1
  var needs_homepage = false
  var page_override = false

  // Collect sanitized items
  for( var itemidx = 0 ; itemidx < items.length ; itemidx++ ){

    item = items[itemidx]
    if( !item )continue
    
    // "page" is a pseudo item that force next item into a page name
    if( item == "page" ){
      page_override = true
      continue
    }

    // At most 63 characters, per rfc 2181
    // 2014, no, that's too much, reduce to 31
    item = item.substr( 0, 31 );

    // on_xxx becomes #xxx
    item = Wiki.decode( item )

    // If item is a valid page name... leave it alone... unless it a valid id
    if( SW.wikiword.test( item ) ){

      // Things like "/@jhr" are the name of a wiki, I will add "HomePage"
      // Dec 2014. Not anymore.
      if( false && itemidx == 0 && itemidx == last_item_idx ){
        if( ( ("@".starts( item ) || ( false && "@".ends( item ) ) )
        && (item.toLowerCase() == item))
        ){
          needs_homepage = true
        }else
        // LinkedIn, deprecated in 2014
        if( false && "In".ends( item)
        && (item.toLowerCase() == item.substr( 0, item.length - 2) + "in") 
        ){
          needs_homepage = true
        }
      }
      
      // Dec 2014. Things like  ...@jHr/xxxx become .../jhr/xxxx
      if( ( itemidx !== last_item_idx ) && "@".starts( item ) ){
        item = item.substring( 1 ).toLowerCase();
      }

    // When not a valid page name, convert to lower case "orthodox" chars
    }else{
      item = item
      .replace( /[\[\]'" ]/g, "_")
      .replace( /^_/g, "")
      .replace( /_$/g, "")
      item = Wiki.toAscii( item)
      .toLowerCase()
      .replace( /[^@#_a-z0-9]/g, "")
      || "anonymous"
      // Expand "secret" into a random 3Code
      // 2014, no more
      if( false && item == "secret" ){
        item = this.random3Code( "-")
      }
      // There needs to be a valid page name at the end
      if( itemidx == last_item_idx ){
        // Last item is not a valid page name, HomePage will be the valid page
        needs_homepage = !page_override
      }
    }
    list.push( item)
  }
  if( needs_homepage ){ list.push( "HomePage") }
  path = list.join( "/") || ""
  this.misc_de&&bug( "sanitizedPath:", path, "for:", str)
  return path
}


Wiki.sanitizeMail = WikiProto.sanitizeMail = function( mail ){
// Return null or figure out a somehow valid mail address
  // Get rid of spaces
  mail = mail.replace( /\s/g, "")
  // If there is a wiki name prefix, get rid of it
  var slash = mail.lastIndexOf( "/")
  if( slash != - 1 ){
    mail = mail.substr( slash + 1)
  }
  // Some limit on length
  mail = mail.substr( 0, 320)
  // Some regex, I guess better ones exist, but worse is better
  var r = /^([a-zA-Z0-9_.-])+@(([a-zA-Z0-9-])+.)+([a-zA-Z0-9]{2,4})+$/
  if( r.test( mail) ) return mail
  return null
}

Wiki.sanitizeName = function( name ){
// Returns the sanitized version of a user "name".
// I basically remove weird characters that may interfere with HTML
// or display formatting. I also remove [ and ] so that the
// result would be a free link if [] enclosed.
// If @ starts the name, I convert the name to lowercase.
// ToDo: See also https://github.com/chriso/node-validator/tree/master/lib
// ToDo: chinese...
  if( ("@".starts( name) ) // 2014 deprecated || "@".ends( name))
  && !name.includes( "[")
  ){
    name = name.toLowerCase()
  }
  // ToDo: ?issue with '
  return name.replace( /[\r\n<>="\[\]]/g, "")
  return name.replace( /[^A-Za-z_0-9 ']/g, "")
}

WikiProto.changeDefaultToCuratorConfig = function(){
// Change content of "AboutWiki" page to use "PrivateCuratorWiki"
// instead of default "PrivateWiki".
// This basically switches from "very open" to just "open".
// This method gets called when some ownership can be asserted regarding
// the wiki, i.e. either because a twitter/fb user logs in or because
// some user used an invitation code. ToDo: that later case is not there yet.
// See also Wiki.isVeryOpenByDefault()
  if( !this.config.veryOpen )return
  this.de&&bug( "change ownership")
  var config = this.lookupPage( "AboutWiki")
  // ToDo: I should call isVeryOpenByDefault()
  var proto_page = this.lookupPage( config.frontLine())
  if( proto_page.name != "PrivateWiki" ){
    if( proto_page.name != "PrivateOpenWiki" ){
      this.bug_de&&bug( "weird, not open yet config was changed:", proto_page)
    }
  }else{
    this.config.veryOpen = false
    var that = this
    config.write(
      config.getBody().replace( "PrivateWiki", "PrivateCuratorWiki"),
      Contexted( this, function( err ){
        if( err ){
          that.error( "cannot write:", config)
        }else{
          that.de&&bug( "success in changing ownership")
        }
      })
    )
  }
}

WikiProto.wikinamize = function( name, prefix, postfix ){
// Turn a text into a valid, "nice to read", wiki name
// ToDo: Refactor into multiple methods, this one is too complex
  // If in cache, cool
  var cached
  if( !prefix && !postfix && (cached = Sw.wikinamizeCache[name]) ){
    return cached
  }
  // If already a valid wiki word, no need to dig further
  if( SW.wikiword.test( name) ){	  
    if( !prefix && !postfix ){
      Sw.wikinamizeCache[name] = name
    }
    return name
  }
  NDe&&bug( "Wikinamize ", name, ", prefix: ", prefix, ", suffix: ", postfix)  
  var text = name
  // Get rid of invalid characters, slightly brutal...
  text = text.replace( /[^#@A-Za-z_0-9]/g, "_")
  if( De && text != name ){
    this.de&&bug( "Became:", text)
  }
  if( !text ){
    text = "WikiWord"
  }
  // Turn first character to uppercase when appropriate
  text = text.substr( 0, 1).toUpperCase() + text.substr( 1)
  // Turn next character in lowercase when appropriate
  if( !SW.wikiword.test( text) && text.length > 1 ){
    text = text.substr( 0, 1)
    + text.substr( 1, 1).toLowerCase()
    + text.substr( 2)
  }
  // If that is not enough, get rid of embedded @# & add some postfix
  if( !SW.wikiword.test( text) ){
    this.de&&bug( "Not enough:", text)
    // ToDo: do I really want to get rid of @, # and -, not sure...
    //text = text.replace( /@/g, "At")
    //.replace( /#/g, "Hash")
    //.replace( /-/g, "_")
    if( !SW.wikiword.test( text) ){
      this.de&&bug( "Still not enought: ", text)
      text = text.toLowerCase().capitalize() + (postfix ? postfix : "Page")
      if( !SW.wikiword.test( text) ){
        // That is enough, give up
        De&&bug( "Cannot wikinamize name:", name, ", not valid:", text)
        text = "WikiWord"
      }
    }
  }
  // Add prefix to now valid wiki word
  if( prefix && !prefix.starts( text) ){
    // If # twitter hashtag, turn into classic wikiword first
    if( false && text.substr( 0,1) == "@" ){
      text = text.substr( 1).capitalize()
    }else if( false && text.substr( 0, 1) == "#" ){
      text = text.substr( 1).capitalize()
    }
    text = prefix + text
  }else{
  }
  // Should be ok by now, restrict max length however and recheck
  // 320 is limit for a valid email address length
  if( text.length > 320 ){
    text = this.wikinamize( name.substr( 0, name.length - 1), prefix, postfix)
  }
  if( !prefix && !postfix ){
    Sw.wikinamizeCache[name] = text
  }
  if( De && text != name ){
    this.de&&bug( "Wikinamized ", name, " into ", text,
    ", prefix: ", prefix, ", suffix: ", postfix)
  }
  return text
}


require( "./globals" ).inject( Wiki, exports );
// section: end wiki.js
