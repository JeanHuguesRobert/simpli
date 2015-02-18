// -------------------
// section: session.js
// Class Session
//
// A session object tracks the connection between a web browser user and
// SimpliWiki. The same web browser can be involved in multiple session,
// typically with multiple wikis. Sometimes the user behing the web browser
// is identified, or even authenticated (twitter), sometimes she
// just provided some comment about her, not enough to uniquely identify
// her, sometimes the user is totally anonymous.
//
// During the life time of a session, the amount of information about the
// identity can change, usually it increases.
//
// Sessions are not persisted on disk, they stay in memory. However, using
// some cookie, it is to some extend possible to recreate a new session that
// has some similarities with the old one, like what is the wiki involved for
// example.
//
// Session terminate either due to inactivity or due to explicit user logout.

var Sw = global.Sw;

function Session(){
  this.id = this.deId = ++Sw.sessionId
  Sw.currentSession = this
  this.login_de&&bug( "newSession:" + this.id)
  // Difficulties to "login" are the number one source of support calls
  // I keep a log of what happens during the login process, so that it is
  // easier to figure out what went wrong.
  this.loginLogList = ["#" + this.id]
}

Session.prototype = Session
MakeDebuggable( Session, "Session")

Session.toString = function(){
// Debug label for object
  // <Sb for bots, <Sg for guests, <S! for curators
  var prefix = "<S"
  if( this.loginName ){
    if( this.isBot ){
      prefix += "b"
    }else if( this.isGuest() ){
      prefix += "g"
    }
    if( this.canCurator ){
      prefix += "!"
    }
  }
  // <S:id name wiki current_page>
  return prefix + ":" + this.id + " "
  + this.loginName + " "
  + (this.wiki ? this.wiki.fullname() : "New ")
  + this.getCurrentPage()
  + ">"
}

Session.loginLog = function( msg ){
  this.login_de&&bug( msg)
  this.loginLogList.push( Sw.dateNow.toISOString() + " " + msg)
  this.notify( msg)
}

Session.notify = function( msg ){
// Registers a msg to be notified (growl style) asap
  if( !this.notifyList ){
    this.notifyList = [msg]
    return
  }
  this.notifyList.push( msg)
}

Session.pullNotifications = function(){
// Returns null or the list of notifications. Also clears it.
  if( !this.notifyList )return null
  var ret = this.notifyList
  this.notifyList = null
  return ret
}

Session.dump = function( sep ){
  var buf = ["Session"]
  var that = this
  var attr
  = "id wiki loginName sessionId isGone canCurator postClosureId"
  attr = attr.split( " ").map( Contexted( this, function( item ){
    return item + ": " + this[item]
  }))
  buf = buf.concat( attr)
  return buf.join( sep ? sep : "\n")
}
//Session.declareIdempotentGetter( "dump")

Session.logTrace = function( msg ){
// This method is about debugging traces using de&&bug() style.
// Whenever a trace occur, logTrace() is called on the Sw.currentSession
// object if there is such an object.
  if( !this.allTraces ){
    this.allTraces = []
  }
  this.allTraces.push( msg)
}

Session.pullTraces = function( noreset ){
// Returns debugging trace messages collected by logTrace()
  var all = this.allTraces || []
  this.deep_de&&bug( this, ", pullTraces: ", all.length)
  if( !noreset ){ this.allTraces = [] }
  return all
}

Session.registerClosure = function( f ){
  // Remember closures, to clean things on logout
  this.allClosures.push( f)
  f.session = this
  return this.wiki.registerClosure( f)
}

Session.getViewClosure = function( page ){
// Returns the closure to view a page.
// This is a cache, to avoid creating too many closures.
  var closure = this.viewClosureCache[page.name]
  if( closure ) return closure
  var that = this
  closure = this.registerClosure( function( that ){
    that.setCurrentPage( page)
    that.viewForm( this)
  })
  return this.viewClosureCache[page.name] = closure
}

Session.warnUser = function( msg ){
// ToDo: Display warning message to user
  this.de&&bug( "Warning to user: ", msg, ", on ", this)
}

Session.doDecodeParameters = function( str ){
  // _ separated named parameter (n1_v1_n2_v2...)
  var h = {}
  var pvl = str.split( "_")
  var ii = 0
  while( ii < pvl.length ){
    h["p" + ii] = h[ii] = pvl[ii]
    if( ii % 2 == 1  ){
      h[h[ii - 1]] = pvl[ii]
    }
    ii++
  }
  return h
}


Session.adjustColumns = function(){
// Returns true if single/dual pages mode changed
  
  // No two panes in some cases
  if( !this.config.rows 
  || !this.screenCols 
  || this.isTouch
  || ( this.isKudocracy && this.isIframe )
  ){
    if( this.twoColumns ){
      this.session_de&&bug( "Switching to single column")
      if( !this.config.rows ){
        this.session_de&&bug( "because fuild mode")
      }
      if( !this.screenCols  ){
        this.session_de&&bug( "because no screenCols")
      }
      if( this.isTouch      ){
        this.session_de&&bug( "because isTouch")
      }
      this.twoColumns = false
      return true
    }
    return false
  }
  
  if( this.screenCols > this.config.cols ){
    if( !this.twoColumns ){
      if( this.config.twoPanes ){
        this.session_de&&bug( "Size change, switching to 2 columns mode")
        this.twoColumns = true
        return true
      }
    }
  }
  
  if( this.screenCols && this.screenCols < this.config.cols ){
    if( this.twoColumns ){
      this.de&&bug( "Size change, switching to single column mode")
      this.twoColumns = false
      return true
    }
  }
  return false
}

Session.trackBacklink = function( page, referer ){
// Track backlinks (and forward links)
  if( !page
  ||  !referer
  ||  page.isCopy()
  ||  referer.isCopy()
  ||  page.isDeletion()
  ||  referer.isDeletion()
  ||  referer.isDo()
  // Don't track #xxxx in code page, noise
  ||  ((referer.isAngular() || referer.isCss() || referer.isToDo())
    && "#".starts( page.name))
  ||  referer.kindIs( "UserRestore")
  ||  page == referer
  ||  (referer.isToc() && referer.name == "TocAll")
  ){
    //this.de&&bug( "Don't track link, referer:", referer, "target:", page)
    return this
  }
  if( referer.isUser()
  ||  referer.isPrivate()
  ){
    referer.trackLinkTo( page)
    if( this.wiki.trackBacklink( page, referer, true) ){ // true => is_private
      this.de&&bug( "track private link, referer:", referer, "target:", page)
      this.de&&mand( referer.linksTo( page), "bad linking")
    }
    return this
  }
  // Update secret maps  
  if( referer.isMap() ){
    this.allKnownPages[page.name] = referer
    this.addMap( referer)
  }
  // Remember link, both directions, but don't link map with non map pages
  // to keep the link secret.
  if( (!referer.isMap() && !page.isMap() )
  ||  ( referer.isMap() &&  page.isMap() )
  ){
    referer.trackLinkTo( page)
    if( this.wiki.trackBacklink( page, referer) ){
      //this.de&&bug( "track back link, referer:", referer, "target:", page)
      this.de&&mand( referer.linksTo( page), "bad linking")
    }
  }
  return this
}

Session.getCookieScript = function sw_cookie( name, cookie ){
// Client side
  // This happens to be the the first script loaded in everypages
  // ToDo: that's false, sw_api is loaded before sometimes
  // I should take advantage of that
  // Maybe I could load underscore.js?
  // ToDo: see http://documentcloud.github.com/underscore/
  cookie = cookie || document.cookie
  var ii = cookie.indexOf( name += "=") // ToDo: delimeter issue?
  if( ii < 0 ) return null
  cookie = cookie.substr( ii + name.length)
  ii = cookie.indexOf( ";")
  if( ii >= 0 ){ cookie = cookie.substr( 0, ii) }
  return cookie
}

Session.configScript = function( page, other, editclosure ){
// Client side setup, dynamic, different for each page

  if( !this.canScript ) return "";
  NDe&&bug( "config script for ", page, " ", page.maxCols)
  
  other = !!other;
  
  // Adjust number of cols on page actual size if possible
  // Dec 2014. This is no longer active, .maxCols is not set anymore
  var maxcols = this.config.cols
  if( !other
  && editclosure
  && page
  && page.maxCols
  && page.maxCols < maxcols
  ){
    maxcols = page.maxCols
  }
  
  var path = this.hrefPath( page)
  
  // In debug mode, add accumulated traces
  var traces = ""
  if( this.isDebug ){
    traces = Wiki.htmlize(
      this.pullTraces( true).join( "\n").replace( /!>, /g, ">\n - ")
    )
    .replace( /\n/g, "<br>")
    .replace( /\"/g, "\\'")
    .replace( /\'/g, "\\'")
    .replace( /:/g, "<em>:</em>")
    .replace( /,/g, "<em>,</em>")
  }
  
  var config      = Sw.copyHash( this.config)
  var wiki_config = Sw.copyHash( this.wiki.config)
  // Remove "sensitive" stuff from config
  var blacklist = "adminIps".split( " ")
  for( var ii in blacklist ){
    delete config[blacklist[ii]]
    delete wiki_config[blacklist[ii]]
  }
  // Remove empty/false entries
  for( ii in wiki_config ){ if( !wiki_config[ii] ){ delete wiki_config[ii] } }
  for( ii in      config ){ if( !     config[ii] ){ delete      config[ii] } }
  
  // ToDo: should use sw_ctx.xxxx instead of sw_xxxx
  var ctx = {
    // System level
    domain:      SW.domain,
    twid:        SW.twid,
    // Wiki level
    wiki:        this.wiki.fullname(),
    wikiConfig:  wiki_config,
    configCols:  this.config.cols,
    rows:        this.config.rows,
    visitors:    this.wiki.recentSessionsCount(),
    // User level
    user:        this.user && this.user.saveContext(),
    userData:    this.user && this.user.dataByPage,
    // Session level
    login:       this.loginName,
    isAnonymous: this.isAnonymous(),
    isKudocracy: this.isKudocracy,
    sessionData: this.dataByPage,
    canScript:   this.canScript,
    lang:        this.lang,
    restCid:     this.restClosure,
    config:      config,
    // Page level
    page:        page.name,
    address:     path,
    pageData:    page.data,
    pageCtx:     page.saveContext(),
    isSource:    page.isSourceCode,
    isOembed:    !!this.isOembed,
    isIframe:    !!this.isIframe,
    traces:      traces,
    canCache:    page.isDo(),
    cols:        maxcols,
    scrollTo:    (page.isDo() ? 0 : this.getCookie( "sw_scroll_to") || 0),
    editClosure: editclosure,
    withPreviousContent: other
  }
  
  return [
    //this.htmlScript( this.getCookieScript, true), // true => sync
    '\n<script type="text/javascript">',
    this.getCookieScript,
    //'/* <![CDATA[ */',
    // ToDo: I should put all of these into a big sw_session object I guess
    //'var sw_domain = "'      + SW.domain + '"',
    //'var sw_fbid = "'        + SW.fbid + '"',
    //'var sw_twid = "'        + SW.twid + '"',
    //'var sw_likey = "'       + SW.likey + '"',
    //'var sw_login = "'       + this.loginName + '"',
    //'var sw_is_source = '    + (page.isSourceCode ? "true" : "false"),
    //'var sw_wiki_config = '  + JSON.stringify( wiki_config),
    //'var sw_config = '       + JSON.stringify( config),
    //'var sw_user = '         + JSON.stringify( this.user && this.user.saveContext()),
    //'var sw_user_data = '    + JSON.stringify( this.user && this.user.dataByPage),
    //'var sw_session_data = ' + JSON.stringify( this.dataByPage),
    //'var sw_wiki = '         + JSON.stringify( this.wiki.fullname()),
    //'var sw_page = '         + JSON.stringify( page.name),
    //'var sw_page_data = '    + JSON.stringify( page.data),
    //'var sw_page_ctx = '     + JSON.stringify( page.saveContext()),
    //'var sw_traces = "'      + traces + '"',
    //'var sw_can_cache = '    + page.isDo(),
    //'var sw_config_cols = '  + this.config.cols,
    //'var sw_cols = '         + maxcols,
    //'var sw_rows = '         + this.config.rows,
    //'var sw_scroll_to = '
    //+ (page.isDo() ? 0 : this.getCookie( "sw_scroll_to") || 0),
    //'var sw_can_script = "'  + this.canScript + '"',
    //'var sw_rest_cid = "'    + this.restClosure + '"',
    //'var sw_is_anonymous = ' + (this.isAnonymous() ? "true" : "false"),
    //'var sw_visitors = '     + this.wiki.recentSessionsCount(),
    //'var sw_lang = '         + this.lang,
    //'var sw_oembed = '       + !!this.isOembed,
    //'var sw_iframe = '       + !!this.isIframe,
    //'var sw_previous_content = ' + other,
    'var sw_ctx = '          + Wiki.jsonEncode( ctx),
    //'var sw_previous_content_displayed = false',
    // Helper to detect "back" button, don't apply to Do pages
    'var sw_time_built = '   + (new Date()).getTime(),
    'var sw_time_offset = 0',
    // Browser local time is unreliable, need to evaluate offset
    //'var sw_edit_closure = ' + (editclosure || "null"),
    'var sw_touch_device = window.sw_is_touch_device;',
    // Auto detect case where page is displayed inside an iframe
    'if( !sw_ctx.isIframe ){ sw_ctx.isIframe = top.location != self.location; }',
    //'var sw_address = '
    //+ 'decodeURIComponent( "' + encodeURIComponent( path) + '")',
    'var De  = ' + !!De,
    'var NDe = false',
    'var de  = ' + !!De,
    'var bugC = (window.console && console.log '
    + '&& function bug( m ){ '
    +   'var args = [].slice.call( arguments );'
    +   'args[0] = "' + SW.name + ': " + m;'
    +   'console.log.apply( console, args );'
    +   'if( ("" + m).toLowerCase().indexOf( "err" ) !== -1 )debugger;'
    +   '})'
    + ' || (de = false)',
    'de&&bugC( "loading " + sw_ctx.domain + "/" + sw_ctx.page)',
    'var sw_ready = true',
    // I can as well hide the body to avoid some flicker until .ready()
    'document.getElementsByTagName( "body")[0].style.display = "none"',
    //'/* ]]> */',
    '</' + 'script>\n'
  ].join( "\n")
}

Session.server    = true 
Session.canScript = true

Session.alert = function( msg ){
// Client side alert
  if( this.server ){ return this.script.apply( this, arguments) }
  if( msg ){ alert( msg) }
}

Session.script = function(){
// Execute code client side
// Usage: session.script( "my_function", "hello", "world"
// ToDo: submit to remote COMET if not building a page
  if( !this.canScript )return ""
  var args = Array.prototype.slice.call( arguments)
  return Session.htmlScript( [
    '(',
    args[0].toString(),
    ').apply( window,', Wiki.jsonEncode( args.slice( 1)), ')'
  ].join( "\n"), true)
  // true => not async
}

Session.scriptlet = function( name, fn ){
 if( !this.canScript ) return ""
  // ToDo: submit to remote COMET if not building a page
  return this.htmlScript( "var " + name + " = " + fn)
}


Session.htmlScript = function( javascript, not_async ){
// Called while building an HTML page.
// "javascript" is either a Function object or a string.
// Returns HTML text for javascript code, either inlined or src referenced.
// src is for static code only, not variable code.

  // I support client without any javascript, sounds crazy these days...
  if( this.canScript === false )return ""

  // The name of the "static" file is based on the name of the function
  var filename = javascript.name

  // Convert Function object to string
  javascript = javascript.toString()

  // If code is a function, with a name, function gets called when file is
  // loaded. The function is called without any parameters, this may help
  // it figure out that it is called for the first time.
  // Commented out.
  // Why: it's better to load scripts dynamically, see loadfire
  if( filename ){
    javascript += "\n;" + filename + "();"
  }

  // Check if already in cache, if not do some basic minification & cache
  if( filename && !Sw.fileIsCached( filename + ".js") ){
    // Remove comments
    javascript = javascript.replace( /[^\\:]\/\/ .*(?=[\n\r])/g, '')
    Sw.cacheFile( filename + ".js", "text/javascript", javascript)
  }

  // And that's it for this case, unless tracing is enabled
  if( filename && !this.inline_de ){
    filename = filename + ".js"
    if( not_async ){
      return '\n<script src="' + filename + '"></script>\n'
    }
    javascript = 'loadfire( "' + filename + '")'
    // return '<script src="' + filename + '"></script>'
  }

  // When not including a Function or in "inline" trace mode, embed the script
  return [
    '\n<script>\n',
    javascript,  // ToDo: some encoding here?
    '\n</' + 'script>\n'
  ].join( "" );
}

Session.onloadScript = function sw_onload(){
// Client side
// The code for this function is included by an HTML page. It is
// called when sw_onload.js is loaded.
// It does some init stuff for the page and register additional stuff to init
// once the page is "ready"

  var t0 // document.getElementById( "content")
  var t1 // document.getElementById( "previous_content")

  // I define my De&&bug darling, it sends a message to the server and may
  // execute code sent back from it (this last feature is not used today)
  // Note: there is also a bugC() that logs on the client's console only
  window.bug = function(){
    var list = Array.prototype.slice.call( arguments)
    var msg  = list.join( "")
    bugC( msg)
    $.getScript( "/rest?cid=" + sw_ctx.restCid
      + "&do=debug&msg=" + encodeURIComponent( msg)
    )
  }

  // Define a "magic loader" that loads pages at light's speed.
  // Works only with browsers that support history.pushState()
  // See http://caniuse.com/#search=push
  window.sw_magic_loader = function sw_magic_loader( url, back ){
    //!When I looked at the numbers, I saw that when a page loads, at lot
    // of time is spent "parsing" jQuery. About 300ms on my machine. In an
    // attempt to avoid that, I experiment with an alternative page loader
    // that requests a page using ajax and rebuilt the body of the current page.
    // Because the new body reuse the old head, all the scripts that were
    // loaded before (and parsed) are still available for the new page.
    // The html page that I load defines sw_ctx where basically everything
    // about the current page is stored. As a result there is little to no
    // issue with global variables (that you would normally expect to be
    // undefined but that now remember whatever content they had when the
    // previous page was loaded).
    // See also https://github.com/defunkt/jquery-pjax
    de&&bugC( "magic loader " + url)
    if( !window.history.pushState ){
      // Sorry, no magic
      window.location = url
      return
    }
    // First get the page's html content, using Ajax
    var time_started = (new Date()).getTime()
    $.ajax( url, {
       // I will handle script tags myself, hence "text" instead of "html"
       dataType: "text",
       cache: false,
       // Provide a "hint" in the query, not used so far
       data: {magic:true},
       beforeSend: function(xhr){ xhr.setRequestHeader( 'X-MAGICLOADER', 'true') },
       complete: function( response, status ){
         var time_received = (new Date()).getTime()
         if( status != "success" ){
           // Meh...
           alert( "" + url + " - " + status + " \n" + "Please refresh")
           return
         }
         // When I get the page, change the html body and do what I normally do
         // with $(document).ready(), simple!
         // ToDo: some kind of loadfire.reset() to deregister all callbacks and
         // clear goals.
         var html = response.responseText
         // Clear the new body for the page, to avoid any flicker
         $('body').html( "")
         // Replace meta in head by meta from new content
         $('meta').remove()
         html = html.replace( /<meta[\s\S]*?>/g, function( m ){
           $('head').append( m)
           return ""
         })
         // Collect links in head & body of new content, moved to current head
         $("link").remove()
         html = html.replace( /<link[\s\S]*?>/g, function( s ){
           $('head').append( s)
           return ""
         })
         // Collect styles in head & body of new content, moved to current head
         $("style").remove()
         html = html.replace( /<style[\s\S]*?<\/style>/g, function( s ){
           $('head').append( s)
           return ""
         })
         // Collect title in head & body of new content, moved to current head
         $("title").remove()
         html = html.replace( /<title[\s\S]*?<\/style>/g, function( s ){
           $('head').append( s)
           return ""
         })
         // Collect scripts that in the head and body, ran in new body
         var body = ""
         html = html.replace( /<script[\s\S]*?<\/script>/g, function( s ){
           // Avoid sw_load.js, we want to benefit from what was already loaded
           if( s.indexOf( "sw_load.js") >= 0 )return ""
           // de&&bugC( "script:" + s)
           body += s
           return ""
         })
         // Add what remains of the body (with all scripts moved to the end)
         html = html.replace( /(<body[\s\S]*)(<\/body>)/, function( _, b, eb ){
           body = b + body + eb
         })
         // Remember where to go "back" (unless already going back)
         if( !back ){
           window.history.pushState( sw_ctx.address, sw_ctx.page, sw_ctx.address)
         }
         // Set the new body for the page
         $('body').html( body)
         // Flag, just in case, when a page wants to know how it got loaded
         sw_ctx.isMagicLoaded = true
         // Invoke what is normally bound to $('document').ready()
         sw_when_ready()
         de&&bugC(
           "total, "
           + ( (new Date()).getTime() - time_started)
           + " msec. "
           + "transmit, "
           + ( time_received - time_started)
           + " msec. "
           + "process, "
           + ( (new Date()).getTime() - time_received)
           + " msec."
         )
       }
    })
  }
  
  // Magic loader "back" button handling
  window.onpopstate = function( event ){
    de&&bugC( "onpopstate " + document.location.href + ", " + event.state)
    // Load, true => "back"
    event.state && sw_magic_loader( event.state, true)
  }
 
  // The "top menu" is hidden sometime, to remove "distraction"
  var shown          = true	// actual state
  var shown_desired  = false	// desired state
  var scheduled_show = 0	// a timeout registered function, or null

  window.sw_fade = function schedule_fade( desired, now ){
  // Like jQuery's fadeTo() somehow, but slightly defered maybe

    // Remove previous timeout function if any, I will install a new one maybe
    if( scheduled_show ){
      clearTimeout( scheduled_show );
    }

    // The goal is to have the state eventually reach the "desired" state
    shown_desired = desired;

    // Hide within 2 sec, unless some change happens, unless "now" asked
    var delay = now ? 0 : ( desired ? 0 : 2000 );

    function do_it(){
    // Makes it so that actual state matches the desired state
      if( shown === shown_desired && shown )return
      if( shown_desired ){
        $(".sw_fade").fadeTo( 0, 1 );
        // Footer is also shown, this may trigger some stuff at first
        if( window.onFooterDisplay ){ window.onFooterDisplay( true) }
      }else{
        $(".sw_fade").fadeTo( 0, 0 );
      }
      shown = shown_desired;
    }
    
    // Change state, either now or maybe later
    if( delay ){
      scheduled_show = setTimeout( function(){
        scheduled_show = 0;
        do_it();
      }, delay );
    }else{
      do_it();
    }
  }

  var redraw = function(){ try{
  // This function gets called when page loading is ready.
  // It is also called if the window's size changed.
  // It recomputes the size of the font when in monospace mode, so
  // that the width of the content is just enough to hold the desired number
  // of characters.
  // Note: I could make it work with proportional fonts, I would have to use
  // a better "sizer" trick to compute the "average" width of characters.

    // #content is the element that matters (#previous_content comes next)
    t0 = document.getElementById( "content")

    // In "edit" page, there is a content_edit div
    sw_ctx.isEditPage = !!document.getElementById( "content_edit")

    // I use an "hidden" div with letters "M" in it, I measure its px size
    var sz = document.getElementById( "sizer")

    // Let's figure out what is the total height of the window, as we
    // will to make it so that cols x rows of characters fit in it.
    // When inside an iframe, this height is bigger than the screen height
    var h =  window.innerHeight ? window.innerHeight : $(window).height()
    var w = $(window).width()

    // On iPhone I think that screen.width is more accurate
    if( sw_touch_device && screen && screen.width ){
      w = Math.min( screen.width, w)
    }

    // Remember that because I need it somewhere else
    sw_width  = w
    sw_height = h
    bugC( "width", w, "height", h );
    
    // If "fluid" layout (or source code), don't change font, just make visible
    if( !sw_ctx.rows || sw_ctx.isSource ){
      t0.style.display = "inherit"
      document.body.style.visibility = "visible"
      document.body.style.display    = "inherit"
      sw_content_width = sw_width
      sw_hpx = sz.clientHeight
      // ToDo: reset sz to "M"
      sw_wpx = Math.floor( ( sz.clientWidth ) );
      return
    }

    // In "two panes" mode, there is a #previous_content to ajust too.
    // It uses a font that is 60% of the first pane, so as to look "far".
    // why: this convey some sense that the content is "older", because it is
    // "behind". It's like if the user was moving away from it whenever new
    // content is displayed one the left column. All of this is done to
    // improve navigation in the wiki, something notoriouly complex.
    t1 = document.getElementById( "previous_content")

    // Avoid flicker while I compute stuff
    document.body.style.visibility = "hidden"
    document.body.style.display    = "inherit"

    // The number of rows to display defaults to what user configured
    var rows = sw_ctx.rows
    
    // When inside an iframe, the height is not the actual visible height
    var iframe_factor = 1;
    if( sw_ctx.isIframe ){
      // I assume that only the 800 first pixels are visible
      // ToDo: get the actual size of the parent viewport.
      if( h > 800 ){
        iframe_factor = h / 800;
      }
    }

    // If number of columns is negative, it means we go proportional
    // ToDo: this is not fully implemented, far from it.
    var proportional = (sw_ctx.cols < 0)

    // Compute exact number of desired rows & columns
    // On small screens I relax the user expectation regarding rows
    var r = rows + ( h < 500 ? -rows + 2 : 2)
    var c = proportional ? -sw_ctx.cols : sw_ctx.cols

    // Adjust that if I want margins
    // ToDo: margin is set to 1, this should be configurable somehow
    if( !sw_ctx.isOembed ){
      c += t1 ? 4 : 2 // twice for margins if two panes, two columns
    }

    // Make a guess about the font size
    var px = Math.floor( Math.min(
      // Apparently width is 60% of height for mono-space fonts
      w / ( c * 0.6 ),
      // 1.35em in css
      h / ( r *  1.35 * iframe_factor )
    ) ) + 2 // ToDo: could it be + 1 ?
    // + 2 to increase "guess" in order to avoid being too small

    // Set some limit
    if( px < 1 ){ px = 1 }
    
    if( sw_ctx.isIframe ){
      if( px > 24 ){
        px = 24;
      }
    }
    
    // Fill the sizer element with dummy M chars, then we measure its size
    var sz_filler = "";
    var sz_len = c;
    while( sz_len-- ){
      sz_filler += "M";
    }
    sz.innerHTML = sz_filler;
    
    bugC( "Guessed px", px );
    
    // Restore initial font size
    document.getElementById( "container" ).style.fontSize
    = document.body.style.fontSize
    = "16px"; // see css.js for body

    // Based on the guess, I look for the biggest font that fits, going downward
    while( px ){

      // Change the font size, either for whole page or just content (!header)
      var header_px = px;
      if( header_px > 16 ){
        header_px = 16;
      }else if( header_px < 9 ){
        header_px = 9;
      }
      if( true || !sw_ctx.isIframe ){
        document.body.style.fontSize = header_px + "px";
      }
      document.getElementById( "container" ).style.fontSize = px + "px";

      // I changed the font's size, but what I ask for is not what happens exactly.
      var container = document.getElementById( "container" );
      
      // Keep header fixed unless it spans multiple lines
      var header_height = $("#header").outerHeight( true );
      if( header_height <= 42 && !sw_ctx.isIframe ){
        $("#header").css( "position", "fixed" );
        // Adjust container's top margin so that header does not overlap it
        $("#container").css( "margin-top", header_height );
      }else{
        $("#header").css( "position", "static" );
        $("#container").css( "margin-top", 0 );
      }

      // Now I can get the "actual" size of characters, thanks to the sizer
      // ToDo: should I use display instead of visibility?
      sz.style.lineHeight = "inherit" // force recompute
      sz.style.visibility = "visible"
      var ch = sz.clientHeight
      var cw = sz.clientWidth / c;
      sz.style.lineHeight = "1em";
      sz.style.visibility = "hidden"

      // Does enough character fits in each line?
      if( ( cw * c ) <= w ){
        bugC( "font sz px", px,
          ". h", h, "n_rows", r, "ch", ch, "n_r*ch", r * ch, 
          ". w", w, "n_cols", c, "cw", cw, "n_c*cw", c * cw
        )
        // Remember the actual width & height of characters
        // Note: this includes the space between lines, ie lineHeight
        sw_wpx = cw
        sw_hpx = ch
        break
      }

      // If font is too big to have enough characters per line, reduce it
      px--
    }

    // OK. Now the font size is set and sw_wpx/sw_hpx are up to date

    // I set to width to match "exactly" what is needed for the content
    var room_to_avoid_wrapping = 1;
    t0.style.width = t0.style.minWidth // = t0.style.maxWidth
    = "" + ( sw_content_width 
      = Math.ceil( ( sw_ctx.cols * cw ) + room_to_avoid_wrapping )
    ) + "px";
    // The  + 1 is to avoid some word wrapping when 0 pixels remains
    t0.style.lineHeight = "inherit"

    // If there is a second pane, ajust its size too
    if( t1 ){

      // Make it 60% of the size of the "near" pane, it then look "distant"
      sz.style.fontSize   = "0.6em";
      sz.style.lineHeight = "inherit" // force recompute
      sz.style.visibility = "visible"
      var fch = sz.clientHeight
      var fcw = sz.clientWidth / c;
      sz.style.visibility = "hidden"

      // I set the width to match "exactly" what is needed
      t1.style.width = t1.style.minWidth // = t1.style.maxWidth
      = "" + Math.ceil( sw_ctx.cols * fcw + room_to_avoid_wrapping ) + "px"
      t1.style.fontSize   = "0.6em"
      t1.style.lineHeight = "1.35em" // Force recompute, ToDo: inherit?

      // When there is a second pane, contents are in a table
      t1.style.display    = "table-cell"
      t0.style.display    = "table-cell"

      // The content of the second pane fades when mouse is not on it
      $("#previous_content")
      .mouseenter( function(){
        $("#previous_content").fadeTo( 0, 1)
      })
      .mouseleave( function(){
        $("#previous_content").fadeTo( 0, 0.2)
      })
      .fadeTo( 0, 0.2)
      .removeClass( "sw_fade")

      // Remember that some previous content is displayed in the second pane
      sw_ctx.previous_content_displayed = true

    // If there is just one pane
    }else{

      t0.style.display = "inherit"

      // Remember that there is content in one pane only
      sw_ctx.previous_content_displayed = false

    }

    // Restore document visibility
    document.body.style.visibility = "visible"
    document.body.style.display    = "inherit"
    
    // Tell potential parent frame about that
    if( window.parent ){
      var height = document.getElementsByTagName("html")[0].scrollHeight;
      window.parent.postMessage( [ "sw_height", height ], "*" );
    }

  }catch( err ){
    // Defensive, restore document visibility
    document.body.style.visibility = "visible"
    document.body.style.display   = "inherit"
    bug( "redraw err:", err)
  }}

  // I will track window's size changes, but not too often
  var delayedresizes = 0
  var signaled_height
  var signaled_width
  var signaled_px

  var signalModel = function(){
  // This function monitor the window's size when it changes and it sends a
  // message to the server about the new size
  // It will also send a message once at load time when first called
    setTimeout(
      function(){
        delayedresizes--
        if( delayedresizes == 0 ){
          // Filter some events
          if( (false && sw_height != signaled_height)
          ||  Math.floor( 8 * sw_width       / sw_ctx.cols / sw_wpx)
            > Math.floor( 8 * signaled_width / sw_ctx.cols / sw_wpx)
          ||  sw_wpx != signaled_px
          ){
            $.getScript( "/rest"
              + "?cid="    + sw_ctx.restCid
              + "&do=resize"
              + "&height=" + (signaled_height = sw_height)
              + "&width="  + (signaled_width  = sw_width)
              + "&wpx="    + (signaled_px     = sw_wpx)
              + "&hpx="    + (signaled_px     = sw_hpx)
              + "&content_width=" + sw_content_width
              + "&touch="  + sw_touch_device
              + "&lang="   + (navigator.language || navigator.userLanguage)
            )
          }
        }
      },
      100
    )
    delayedresizes++
  }

  // Asynch loading of Google Droid fonts
  false && setTimeout( function() {
    // ToDo: sw_touch_device ?
    if( /AppleWebKit/.test(    navigator.userAgent)
    &&  /iP[oa]d|iPhone/.test( navigator.userAgent)
    ){
     return
    }
    var link = document.createElement( "link")
    link.type = "text/css"
    link.rel = "stylesheet"
    link.href
    = "http://fonts.googleapis.com/css?family="
    + "Droid+Sans|Droid+Sans:bold|Droid+Sans+Mono|Droid+Sans+Mono:bold"
    document.documentElement.getElementsByTagName( "head")[0]
    .appendChild( link)
    active_wait()
    function active_wait(){
      for( var ii = 0 ; ii < document.styleSheets.length ; ii++ ){
        if( /googleapis/.test( document.styleSheets[ii].href) ){
          if( sw_document_ready ){ redraw() }
          return
        }
      }
      setTimeout( active_wait, 100)
    }
  }, 10)

  // Tracks if document is ready, to avoid early inits
  sw_document_ready = false

  // When the document is fully loaded, I can safely init stuff
  $(document).ready( window.sw_when_ready = function sw_when_ready(){

    if( !window.sw_ready ){
      de&&bugC( "Weird, jQuery ready() before sw_ready?")
      loadfire.event( function( fire ){
        if( window.sw_ready ){
          sw_when_ready()
          return true
        }
      })
    }
    sw_document_ready = true
    
    // Browser detection, based on UA
    $.browser = {};
    $.browser.mozilla = /mozilla/.test( navigator.userAgent.toLowerCase() )
      && !/webkit/.test( navigator.userAgent.toLowerCase() );
    $.browser.webkit  = /webkit/.test(  navigator.userAgent.toLowerCase() );
    $.browser.opera   = /opera/.test(   navigator.userAgent.toLowerCase() );
    $.browser.msie    = /msie/.test(    navigator.userAgent.toLowerCase() );

    // ToDo: http://www.spoiledmilk.dk/blog/?p=1922 to change address in browser
    // Reload page on "back" button
    // ToDo: https://developer.mozilla.org/en/DOM/Manipulating_the_browser_history
    var sw_time_last_page = sw_cookie( "sw_time_last_page")
    if( !sw_ctx.canCache && sw_time_last_page && !sw_touch_device
      && parseInt( sw_time_last_page, 10 ) > sw_time_built
    ){
      // ToDo: magic_load
      window.location = ""
      window.location.reload( true)
    }else{
       document.cookie = "sw_time_last_page=" + sw_time_built
    }

    // Set the url to match the displayed page, HTML5, thanks to Jean Vincent
    if( !sw_ctx.wasMagicLoaded && window.history.replaceState ){
      window.history.replaceState( sw_ctx.address, sw_ctx.page, sw_ctx.address)
    }

    // Turn Yaml attributes into Angular
    // Note: I need to do it first or else my nicer tooltips don't show up,
    // for reasons I have no time to investigate further.
    loadfire.event( function( fire ){
      if( !fire.does( "angular.js") ){
        if( window.sw_page_uses_angular ){
          de&&bugC( "Weird, page uses angular but angular.js is not loading")
          fire.load( "bower/angular/angular.js")
          return
        }
        return true
      }else{
        if( !fire.does( "angularize") ){
          de&&bugC( "Weird, angular.js but not loading sw_angularize")
          fire.load( "sw_angularize.js")
          return
        }
      }
      if( window.sw_angularize && fire.did( "angular.js") ){
        window.sw_angularize( $)
        return true
      }
    })

    // On touch devices I slightly change the design because of small screen
    // ToDo: a mobile app, one day... http://www.phonegap.com/about
    // See also http://tech.richardrodger.com/2010/09/30/debug-phonegap-mobile-apps-five-times-faster/
    if( true || sw_touch_device ){
      // Setting maxWidth helps to avoid auto zooming artifacts
      var w = sw_width = Math.min( screen.width, $(window).width())
      if( !w ){ 
        w = sw_width = screen.width || $(window).width()
      }
      document.body.style.maxWidth = w + "px"
      if( sw_ctx.isOembed || sw_ctx.isIframe ){
        $("#header").css( 'font-size', '100%' ) // vs 140%
      }
      var header = document.getElementById( "header" ).style;
      // header.maxWidth = sw_width + "px"
      var header_height = $("#header").outerHeight( true );
      // Keep header fixed unless it is multiple lines (on small screens typically)
      if( header_height <= 42 && !sw_ctx.isIframe ){
        header.position = "fixed";
        document.getElementById( "container" ).style.marginTop
        = header_height + "px";
      }
      // var footer = document.getElementById( "footer").style
      // footer.maxWidth = sw_width + "px";
    }

    // Do some wikification that was purposedly not done server side
    loadfire.event( function( fire ){
      if( !fire.does( "sw_wikify") )return true
      if( !window.sw_wikify )return
      // console.log( "wikification started")
      var is_rfc = sw_ctx.page.substr( 0, 4) === "#rfc"
      var html   =  $("#content_text").html()
      // Force display if wikification may take a while
      if( html && html.length > 30000 ){ redraw() }
      if( !sw_ctx.isSource ){ html = sw_wikify( html, is_rfc) }
      $("#content_text").html( html)
      html = $("#previous_content").html()
      if( html ){
        if( html && html.length > 30000 ){ redraw() }
        html = sw_wikify( html, is_rfc)
        $("#previous_content").html( html)
      }
      // console.log( "wikification done")
      return true
    })

    // Initial "re" draw
    redraw()

    // Show notifications, click to hide
    if( sw_touch_device ){
      $('#sw_notifications').css( "position", "relative")
    }
    $('#sw_notifications').css( "display", "inline").show()
    .one( "click", function( e ){
      $('#sw_notifications').hide()
    })

    // Hide login buttons, they need a click to show up
    if( sw_ctx.page != "SignIn" ){
      $('#login-buttons').hide()
      $('#login').click( function( event ){
        // If click on "SignIn" when div is open, go to that page
        // Idem if no login buttons
        var $buttons = $('#login-buttons')
        if( !$buttons.size() || $buttons.is(":visible") )return
        // Avoid loading "SignIn"
        event.preventDefault()
        $('#login-buttons').show()
        onFooterDisplay( true, true)
      })
    }
    if( window.onFooterDisplay ){
      window.onFooterDisplay( "init")
    }

    if( sw_ctx.traces && !sw_touch_device ){
      $("#traces").append( sw_ctx.traces + "<br><br><br><br><br><br><br><br><br>")
    }

    // Unless it's a touch device, I "hide" the top menu & footer to some extend
    if( !sw_touch_device ){

      // I show them when mouse moves to where they are
      $(".sw_fade").mouseenter( function() {
        sw_fade( true, true) // show, now
      })

      if( false && sw_ctx.isAnonymous ){
        $("#header").removeClass( "sw_fade") // Less confusing at first
        $("#footer").removeClass( "sw_fade")
        if( window.onFooterDisplay ){ onFooterDisplay( true) }
        //$("#footer").css( "position", "static")
      }else{
        // Don't display header/footer at first, so that readers focus on text
        // true => now, don't delay
        sw_fade( false, true) // hide, now
      }

      // Hide them when mouse enters area with content
      $("#content").mouseenter( function(){
        sw_fade()
      })

      //.mouseleave( function(){
      //  $(".sw_fade").fadeTo( 0, 1)
      //  if( window.onFooterDisplay ){ window.onFooterDisplay( true) }
      //})

      // Also display them when scrolling to bottom of page
      $(window).scroll( function(){
        var new_top = $(window).scrollTop()
        if( (false && new_top == 0)
        || $('body').height() <= $(window).height() + new_top
        ){
          sw_fade( true, true) // show, now
          // Let the menu "stick" if enough scrolling to reach top or bottom
          //$("#header").removeClass( "sw_fade")
          //$("#footer").removeClass( "sw_fade")
        }
      })

      // Hide them when mouse leaves window, quiet
      $('html').mouseleave( function(){
        $("#header").addClass( "sw_fade")
        // $("#footer").addClass( "sw_fade")
        // if( window.onFooterDisplay ){ window.onFooterDisplay( true) }
        sw_fade()
      })

      // Provide a visual cue during scrolling, asap
      loadfire.event( function( fire ){
        if( !window.sw_scrollcue )return
        sw_scrollcue( true)
        return true
      })
   
      // When inside a Kudocracy iframe, open external links in a new tab
      if( sw_ctx.isKudocracy ){
        bugC( "Patch external links for Kudocracy" );
        // $('a[rel="external"]')
        $('a[href^="http"]')
        .attr( 'target', '_blank' );
      }

      // This will add an underline to all occurences of the same link, this
      // may help the user a little bit in terms of navigation
      // Thanks to http://kilianvalkhof.com/2008/css-xhtml/context-hover-adding-context-feedback-to-your-links/
      // Somehow async, can be slow
      var time_started = +(new Date())
      $("a").each( function(){
        var that = $(this)
        setTimeout( function(){
          var age = (+(new Date()) - time_started)
          // Don't do it if it took longer that 2 sec
          if( age > 1000 ){ return }
          var href = that.attr( "href")
          href = href ? ("" + href) : ""
          // Avoid weird cases that break, when href includes " or '
          // ToDo: I could escape those, but this is a minor bug
          if( !href
          ||  (href.indexOf( '"') >= 0)
          ||  (href.indexOf( "'") >= 0)
          ){
            return
          }
          var a = $('a[href="' + href + '"]');
          that.hover(
            function(){ a.addClass(    "hover"); },
            function(){ a.removeClass( "hover"); }
          )
        }, 10) // Runs after next trick on wiki words
      })

      // Nicer tooltip
      loadfire.event( function( fire ){
        // Don't do that on opera, issue, div & clippling
        if( window.opera )return true
        // Wait until angularize did it's job, else some tooltip don't show up
        // for reasons I have to investigate. ToDo: investigate.
        if( fire.does( "angular") && !window.sw_angularize )return
        // ToDo: on Touch devices, I should use long tap or tap&move,
        // see https://github.com/dotmaster/Touchable-jQuery-Plugin
        if( window.kudo_is_touch_device )return;
        $("body").append( '<div id="sw_tooltip"></div>')
        var $tooltip = $('#sw_tooltip');
        function tooltip(){
          var title = $(this).attr( "title")
          if( !title )return
          // I will adjust the X position so that the tooltip stays in screen
          var header_height = $("#header").outerHeight( true );
          var target_height = Math.min( header_height, 32 );
          // On Internet Explorer... 0!
          if( target_height === 0 ){
            target_height = 32;
          }
          var title_width
          $(this).hover(
            function( e ){
              $(this).attr( "title", "" );
              $tooltip.html( title );
              var tooltip_width = $tooltip.outerWidth()
              var x = e.pageX - tooltip_width / 2
              if( x < 0 ){
                x = 0
              }else if( e.pageX + tooltip_width > sw_width ){
                x = sw_width - tooltip_width
              }
              $tooltip
              .css( "display", "none")
              .css( "position", "absolute")
              // Set initial position, will follow mouse
              // ToDo: there is an issue with changing font sizes
              .css( "top",  (e.pageY + 1 * target_height ) + "px")
              .css( "left", x + "px")
              .fadeIn( 0)
            },
            function(){
              $tooltip.fadeOut( 0)
              $(this).attr( "title", title)
            }
          )
          $(this).mousemove( function( e ){
             $tooltip
            // ToDo: there is an issue when fonts get big
            .css( "top",  (e.pageY + 1 * target_height ) + "px")
            // ToDo: compute X so that content stays inside window
            // .css( "left", (e.pageX - 4 * sw_wpx) + "px")
          })
          // de&&bugC( "tooltip: " + title)
        }
        try{
          // ToDo: shine?
          // See http://www.metaextension.com/static/shine.js
          $("a").each(    tooltip)
          $("time").each( tooltip)
          // de&&bug( "Nicer tooltips")
        }catch( e ){
          De&&bugC( "No nicer tooltip, err:" + e)
        }
        return true // deregister from loadfire.event()
      })

      // For wiki word links, improve readability with emphasis on upper cases
      $(".wiki").each( function(){
        var that = $(this)
        // Async, can be slow
        // setTimeout( function(){
          var text = that.html()
          // de&&bugC( "upperize " + text)
          var new_text = text.replace(
            /([A-Z_@#\[\]]+)/g, "<strong>$1</strong>"
            //function( ch ){ return "<strong>" + ch + "</strong>" }
          )
          if( new_text != text ){
            // de&&bugC( "UPPERIZED " + new_text)
            that.html( new_text)
          }
        //}, 1)
      })

      // Show "what" info when clicked
      $('.sw_what').click( function( event ){
        // If click on a link, follow link
        if( $(event.target || event.srcElement).closest( "a").size() )return
        // ToDo: show apply to child of clicked object only
        var $content = $('.sw_what_content', this)
        if( $content.is(':visible') ){
          $content.css( "display", "none")
        }else{
          $content.css( "display", "inline")
        }
        // Avoid "edit on click". ToDo: this does not work, see sw_what forward
        event.preventDefault()
      })
    }
    
    // If screen is tall enough, I embed stuff
    if( sw_height > 500 ){

      // Embedded wikis & other stuff
      if( true ){

        // Embed wikis, unless current page is inappropriate
        if( sw_ctx.page != "DoProfile"
        &&  sw_ctx.page != "PrivateCodes"
        &&  sw_ctx.page != "DoClones"
        ){ setTimeout(
          function(){
            $("#content_text a")
            .each( function( item ){
              // Don't recurse if embedded
              if( sw_ctx.isOembed || sw_ctx.isIframe )return false
              var elem = $(this)
              var url = elem.attr( 'href')
              // Don't do it for static files, including "with.google"
              if( !url
              || /\.[a-z]{2,6}$/.test( url)
              || /javascript:/.test(   url)
              )return
              // Don't do it if self reference
              var loc = window.location.toString()
              if( loc.indexOf( url) >= 0 ){
                // console.log( "self " + loc + " == " + url)
                return
              }
              var embed  = /http:\/\/(embed.simpliwiki.com\/.+)/.test( url)
              var iframe = /http:\/\/(.*simpliwiki.com\/.+)/    .test( url)
              var qwiki  = /http:\/\/(.*qwiki.com\/q\/#!\/.+)/  .test( url)
              if( !(embed || iframe || qwiki) )return
              // console.log( "ajax " + (embed ? "embed " : "iframe"))
              if( qwiki ){
                var html = '<iframe class="qwiki-player" type="text/html"'
                + ' width="' + sw_content_width + '"'
                + ' height="' + Math.floor( sw_content_width * (9/16)) + '"'
                + ' src="http://www.qwiki.com/embed/'
                + url.substr( url.indexOf( "!/") + "!/".length)
                + '"'
                + ' frameborder="0" scrolling="no"/>'
                // console.log( "qwiki:" + html)
                elem.after( html)
                return
              }
              $.ajax({
                url: "http://simpliwiki.com/oembed",
                dataType: 'jsonp',
                data: {
                  url:      url,
                  maxwidth: sw_content_width,
                  maxheight: (!embed ? 420 : 0)
                },
                success: function( oembed ){
                  elem.after( oembed.html)
                },
                error: function( _, msg, err ){
                  // console.log( "oembed error")
                }
              })
            })
          },
          1
        )}

        // Embed.ly
        // ToDo: some sw_no_embed directive, noEmbed: true
        loadfire( "http://scripts.embed.ly/jquery.embedly.min.js")
        .event( function( fire ){
          if( !fire.did( "jQuery") || !fire.did( "embedly") )return
	  var sources =
/((http:\/\/(.*youtube\.com\/watch.*|.*\.youtube\.com\/v\/.*|youtu\.be\/.*|.*\.youtube\.com\/user\/.*|.*\.youtube\.com\/.*#.*\/.*|m\.youtube\.com\/watch.*|m\.youtube\.com\/index.*|.*\.youtube\.com\/profile.*|.*\.youtube\.com\/view_play_list.*|.*\.youtube\.com\/playlist.*))|(https:\/\/(.*youtube\.com\/watch.*|.*\.youtube\.com\/v\/.*)))/i
          $("#content_text a").embedly( {
	          urlRe: sources,
            maxWidth: sw_content_width,
            wrapElement: 'div',
            method : "after"
          })
          return true
        })
      }
      // ToDo: handle dates, to display something nicer than an ISO format
      // ToDo: constraint: it should be of the exact same size
    }

    // Signal screen size & other stuff to server
    if( sw_ctx.canScript == "maybe" ){ signalModel() }

    // Install "Click to edit" asap, needs both sw_edit.js & sw_grow.js

    // Call sw_grow( "init") asap to install "click to edit" event listener
    // Note: "edit" page move to "edit mode" automatically
    loadfire.event( function( fire ){
      // Some page are not editable at all
      if( !sw_ctx.editClosure )return true
      // One cannot edit until sw_grow.js is loaded
      if( !window.sw_grow ){
        console.log( "waiting for sw_grow() to be defined" );
        return;
      }
      console.log( "sw_grow() was defined, call it?" );
      // Unless page is "edit" page, wait for sw_edit()
      if( !sw_ctx.isEditPage ){
        if( !window.sw_edit )return
        // Let sw_edit() define sw_ctx.onClickOnContent()
        sw_edit()
      }
      sw_grow( "init")
      return true
    })

    // Monitor changes in screen size
    $(window).resize( function(){
      redraw()
      signalModel()
    })

    // Tell potential parent frame about that
    if( window.parent ){
      window.parent.postMessage( [ "sw_scroll", sw_ctx.scrollTo ], "*" );
    }
    
    // Scroll back to where user was before edit
    if( sw_ctx.scrollTo ){
      // 2014, don't mess with scroll
      if( false ){
        $('body').scrollTop( sw_ctx.scrollTo)
      }else{
        
      }
      sw_ctx.scrollTo = 0
      document.cookie = "sw_scroll_to=0"
    }

    // Some measures. One can only optimize what one can measure
    sw_ready_duration = ((new Date()).getTime() - sw_time_loaded)
    de&&bugC( "ready in: " + sw_ready_duration + "ms")
  })
  // console.log( "onready() done")
}


Session.editScript = function sw_edit(){
// Client side
// This is script is run in pages that need a "edit on click" thing.
// sw_edit() defines a listener in order to detect "edit on click"
// That listener is sw_ctx.onClickOnContent(). It is installed by
// sw_grow( "init")

  // When location changes, it means a new page is beeing loaded, don't edit
  var initial_window_location = window.location.href

  // Def function installed on the #content div, for click & mousedown events
  sw_ctx.onClickOnContent = function( e ){

        de&&bugC( "Click on content")

        function update_ta(){
        // Replace old values by new value in textarea, angularize related
          if( !window.sw_angularize     )return null
          if( !window.sw_angular_inputs )return null
          var new_values = sw_angular_inputs()
          if( !sw_text_changed )return null
          var ta_text = $('#textarea_sw').val()
          for( var attr in new_values ){
            var regexp = new RegExp(
              "(\\n {0,2}" + attr + ":\\s*)([^\\n]*)", "g"
            )
            ta_text = ta_text.replace(
              regexp,
              "$1" + new_values[attr]
            )                
          }
          $('#textarea_sw').val( ta_text)
          return new_values
        }

        e = e || window.event
        var content = document.getElementById( "content_text")
        var target  = e.target || e.srcElement
        var $link   = $(target).closest( "a")

        // If click on a link, go to associated url
        if( $link.size() ){
          // Unless it is "DoIt" in an angularized page
          var href = $link.attr( "href")
          var label = $link.text()
          // For angular "DoIt", I submit the new text if it changed
          // with a "DoIt" verb
          if( window.sw_angularize && label == "DoIt" ){
            var new_values = update_ta()
            if( new_values ){ 
              // console.log( "Text changed, needs to DoIt")
              // console.log( new_values)
              // Submit change, as a "DoIt", not as a plain "Send"
              window.sw_submit( "DoIt")
              return false
            }else{
              // console.log( "no sw_text_changed")
              // return false
            }
          }
          // Experimental magic loader
          if( window.sw_magic_loader && href.substr( 0, 1) == "/" ){
            // Avoid loading by browser
            e.preventDefault()
            // Let the magic operate
            sw_magic_loader( href)
            return 
          }
          // When inside a Kudocracy iframe, open external links in a new tab
          if( sw_ctx.isKudocracy ){
            window.open( href );
            // Avoid loading by browser
            e.preventDefault();
            return;
          }
        }

        // If click on a <input xx>, ignore
        if( $(target).closest( "input").size() ){ return }

        // If click on sw_what div, ignore
        if( $(target).closest( ".sw_what").size() ){
          return true // Important
        }

        // Filter out embed.ly content
        if( $(target).closest( "object").size() ){ return }

        // If cannot switch to edit mode...
        // This happens when a new page is about to be loaded, on touch devices
        // and if, obviously, edit mode is alreay active
        if( window.location.href != initial_window_location
        || sw_ctx.isEditing
        || sw_touch_device
        ){
          // If already editing, manage some "macros", when I can
          if( sw_ctx.isEditing
          && !sw_ctx.codemirror
          && sw_ctx.onClickOnEditContent
          ){
            sw_ctx.onClickOnEditContent( e)
          }
          // Either I can't, I already switched, or browser is loading a page
          return
        }

        // Load edit page in some cases, when there is no "content_editable" div
        // or some stuff I don't remember about cols... comment, comment, comment
        var edit = document.getElementById( "content_editable")
        if( !edit
        || sw_ctx.cols != sw_ctx.config.cols
        ){
          // This is how I ask the browser to load a new page. Note: I don't
          // provide the path to the page, because I reference a closure in the
          // server, a closure that will provide an "edit form" for the proper
          // page (ie the page that was the "current page" when the closure was
          // created).
          window.location.href= sw_ctx.address + "?cid=" + sw_ctx.editClosure;
          return
        }

        // Use inputs from user, angularize related
        update_ta()

        // Refetch content if page is somehow old
        // ToDo: Commet style notification from other writer would be better
        var time_now = (new Date()).getTime()
        var age = time_now - sw_time_loaded
        // console.log( "click to edit, age: " + age)
        if( (sw_ctx.visitors > 1 && age > 5000)
        ||  age > 20000
        ){
          // ToDo: this can be avoided if there are no other active user in the wiki
          // Safe old style ? reload page
          if( false && true ){
            window.location.href= sw_ctx.address + "?cid=" + sw_ctx.editClosure;
            return
          }
          // New API based style
          // console.log( "update content")
          window.sw_do && sw_do.getPage( sw_ctx.page, function( result ){
            if( result.status == 200 && result.body ){
              var inputs = update_ta()
              var $ta = $('#textarea_sw')
              if( $ta.val() != result.body ){
                // Something changed...
                // console.log( "change")
                age = (new Date()).getTime() - time_now
                // Better afford losing 1 second of typing than an unknown amount
                // from some other potential writer
                if( age < 1000 ){
                  // console.log( "fast, changed")
                  $ta.val( result.body)
                // However, if request took longer
                // or if there exists other potential writers...
                }else{
                  // Check if user changed its local version
                  // Assume change is local if no one else is visiting the wiki
                  var local_change = (result.visitors == 1) || inputs
                  // ToDo: better check for local change
                  if( !local_change ){
                    // Check if local content changed since when page was loaded
                    // ToDo
                  }
                  if( !local_change ){
                    $ta.val( result.body)
                    // console.log( "slow, changed")
                  }else{
                    // Conflict!
                    // ToDo: I could signal the conflict and let the user decide
                    // to either cancel or continue
                    alert( result.writer)
                    // result.writer is the name of the last writer
                    // I could also try to "merge" the changes, tricky
                  }
                }
              }
            }
          })
        }

        //edit.style.display = "inherit"

        // Display current version in "previous content" area
        if( sw_ctx.previous_content_displayed ){
          var pc = document.getElementById( "previous_content")
          if( pc && pc.style.display != "none" ){
            pc.innerHTML = '\n\n' + content.innerHTML
          }
          $("#previous_content").fadeTo( 0, 1).removeClass( "sw_fade")
        }
        // Move footer at the end of the page
        // ToDo: not usefull anymore I guess
        document.getElementById( "footer").style.position = "relative"
        // We start editing, give focus to properly sized textarea asap
        loadfire.event( function( fire ){
          if( !window.sw_grow )return
          de&&bugC( "Calling sw_grow() from onClickOnContent()")
          sw_grow( "init")
          sw_grow( "edit")
          return true
        })
        // Let the menu & footer "stick"
        $("#header").removeClass( "sw_fade")
        $("#footer").removeClass( "sw_fade")

        var text = document.getElementById( "textarea_sw").value

        // Tell user when she may leave without saving changes
        // ToDo: do something similar in Edit pages
        window.onbeforeunload = function( e ){
          // ToDo: does not work in Chrome, see http://code.google.com/p/chromium/issues/detail?id=4422
          // ToDo: does not work in Opera
          if( !sw_ctx.isEditing
          || text == document.getElementById( "textarea_sw").value
          ){
            // No change, can leave
            window.onbeforeunload = null
            return
          }
          // Warn user, but once only, not a child
          window.onbeforeunload = null
          var e = e || window.event
          var msg = "edit..."
          // IE and Firefox
          if( e ){ e.returnValue = msg }
          // Safari
          return msg
        }

        $("#edit_form").submit( function(){
          sw_ctx.isEditing = false
          window.onbeforeunload = null
        })
        return false
  }
}

Session.htmlLayout = function( page, tools, content, other, editclosure ){
// Build content, not including footer

  // No other content if fluid layout
  // ToDo: not true, I need some machinery
  var fluid = this.config.rows == 0
  if( fluid ){ other = null }
  
  var head = ["\n"]
  var body = []
  var tail = []
  var previous_first = false

  if( this.canScript ){
    head.push(
      this.configScript( page, other, editclosure),
      this.htmlScript( Session.onloadScript)
    )
  }else{
    editclosure = null
  }

  if( tools ){ head.push( tools) }

  // ToDo: get rid of table if no other content
  head.push( '<div id="container"><a name="top"></a>' );

  // On load, resize font and hide previous content if needed
  // ToDo: memorize it instead of recompute on each load
  if( this.canScript && !fluid ){
    head.push( '\n<div id="sizer"></div>\n')
  }

  if( other ){
    head.push( "<table><tbody><tr>")
  }
  
  if( previous_first && other ){
    body.push(
      '<td class="sw_fade" id="previous_content">\n',
      other,
      '</td>'
    )
  }
  // If scripting, then avoid display until font resizing
  // ToDo: remove? done by script itself
  if( false && this.canScript && this.canScript != "maybe" ){
    body.push( 
     '<' + (other ? 'td' : 'div') 
      + ' class="content" id="content" style="display:none;">'
    )
  }else{
    body.push(
      '<' + (other ? 'td' : 'div')
      + ' class="content" id="content">'
    )
  }
  body.push( content)
  if( !previous_first && other ){
    body.push(
      '\n</td><td class="content sw_fade" id="previous_content">',
      other
    )
  }
  
  if( other ){
    tail.push( "</td></tr></tbody></table>\n")
  }else{
    tail.push( "</div>\n")
  }
  tail.push( '</div>' );
  
  // If content editable, track clicks
  if( editclosure ){
    // Inject sw_edit.js on the client side, here is its definition
    tail.push(
      this.htmlScript( Session.editScript)
    ) // push()
  }
  
  return head.concat( body, tail).join( "")
}

// usage of "comment" text field when editing a page
// either ask for user's name, wiki's title, new page's name
// or just a comment about the change, depending on current page & state
// Current policy: title first, then name, then comment

Session.shouldAskForName = function( page, req ){
// Returns true when time is appropriate to ask for the user's name
  if( this.shouldAskNothing( page, req)       )return false
  if( !this.isAnonymous()                     )return false
  if( this.shouldAskForWikiTitle( page, req)  )return false
  return true
}

Session.shouldAskForWikiTitle = function( page, req ){
  if( this.shouldAskNothing( page, req)       )return false
  if( page.name == "AboutWiki"                )return true
  if( !page || !page.isHome()                 )return false
  //if( this.shouldAskForName( page, req)     )return false
  if( !this.wiki.isAnonymous()                )return false
  return true
}

Session.shouldAskForNewMember = function( page, req ){
  if( page.name == "NewMember"
  ||  page.name == "NouveauMembre"
  )return true
  return false
}

Session.shouldAskForComment = function( page, req ){
  if( this.shouldAskNothing( page, req)       )return false
  if( this.shouldAskForName( page, req)       )return false
  if( this.shoudASkForNewMember( page, req)   )return false
  if( this.shouldAskForWikiTitle( page, req)  )return false
  return true
}

Session.shouldAskNothing = function( page, req ){
  if( this.isCurator &&  page.name != "AboutWiki" ){
    return true
  }
  return false
}

// -----

Session.viewForm = function( req, loop ){
// This is where most pages are rendered

  if( req.embedjs ){
    return this.processEmbedJsRequest( req)
  }

  var that = this
  var html = []
  var page     = this.getCurrentPage()
  var pagename = page.name
  var wiki = this.wiki
  
  // Don't allow robots in c2 wiki
  if( this.isBot && this.wiki.name === "c2" ){
    this.respond( req, "http://simpliwiki.com", "text/plain", true );
    return;
  }

  // Final is asynchronous sometimes
  var once_only
  var phase3 = function(){
    that.send_de&&mand( !once_only )
    once_only = true
    // And, finally, send the answer (that may be a redirect)
    that.respond( req, that.html(
      page,
      page.name + " - " + that.userName(),
      html.join( ""),
      that.editClosure
    ))
    // that.editClosure was maybe set in toolForm(), consume it
    that.editClosure = null
    return that
  }
  
  // If processing a POST, respond() will try to redirect to avoid issue with
  // "back" button && UX about reposting the same request 
  if( req.method == "POST" ){
    if( !req.isRest ){
      if( page.wasIncarned() ){
        // Note: user will log back using cookie
        // ToDo: should check some "can_cookie" property of the session
        // ToDo: should make it that user comes back with a proper &cid=
        this.get_de&&bug( "Redirect after post")
        // Provide a link, for cases where respond() refuses to redirect
        html.push( this.link( page, null, ":)")) // page, label, title
        // It is .respond() that will perform the actual redirect
        phase3()
        return
      }else{
        this.bug_de&&bug( "got a POST on not incarned page:", page)
        // ToDo: figure out why I did manage this special case...
        // I see reasons to redirect and none not to, what am I missing?
        this.preventRedirect = true
        // Do not return
      }
    }else{
      this.bug_de&&bug( "got a POST 'rest' request on page:", page)
      return
    }
  }

  this.get_de&&bug( "viewForm:", page)

  // Check login/logout with twitter..
  if( that.handleChangedLogin( page, req) ){
    this.login_de&&bug( "changed login handled on page:", page)
    return
  }

  // Remember who is visiting what (or trying to visit actually)
  this.fixVisit( page)

  // Acccess rights
  if( !this.mayRead( page) ){
    this.acl_de&&bug( this.loginName, "cannot access:", pagename)
    // ToDo: better way to signal "errors"
    this.setCurrentPage( this.lookup( this.i18n( "err:locked")))
    return this.viewForm( req)
  }
  
  // If this is a draft, let's make sure I have the original loaded
  if( page.nondraft && !page.nondraft.wasIncarned() ){
    if( !loop ){
      page.nondraft.read( function(){
        that.viewForm( req, true) // true to avoid deadly loop on read err
      })
      return
    }
    this.bug_de&&bug( "BUG? Could not load non draft content, page:", page)
    this.bug_de&&bug( "nondraft name: ", page.nondraft)
  }

  // Signal curation
  if( this.isCurator && !page.isDo() ){
    this.notify( this.i18n( "In 'curator' mode, DoNoCurator" ) );
  }
  
  // Let's get page content and render it.
  this.getPage( page, function viewform_getPage( err, page )
  {
  var data = page.getBody()
  
  // Set some default content for user pages
  if( !data && page.isUser() && page.name != "UserSome" ){
    // Use user's name as default content for user pages, unless curator
    if( !that.canCurator  ){
      data = this.userName()
    // If curator, maybe help register new twitter users
    }else{
      if( page.name.includes( "@") || "In".ends( page.name) ){
        data = page.name.substr( "User".length)
      }else{
        data= this.userName()
      }
    }
  }

  // Get rid of bots (there is actually some code to filter them elsewhere)
  if( that.loginName.includes( "BotGuest") ){
    data = "http://simpliwiki.com, SimpliWiki rocks!"
  }
  var inherited = page.wasInherited()

  // Don't show inherited pages to bots
  // Why: bots are stupid, they will follow links ad infinitum, never
  // noticing similarities ; it's better to avoid that
  if( that.isBot && inherited ){
    that.respond( req, "http://simpliwiki.com", "text/plain", true)
    return
  }
  
  // Access right. This time I can use the page's content
  if( !that.canRead( page, true) ){
    // ToDo: better error signaling
    that.get_de&&bug( "user:", that.userName(), "cannotRead:", pagename)
    that.setCurrentPage( that.lookup( that.i18n( "err:locked")))
    return that.viewForm( req)
  }
  
  // "Do" pages control their rendering using data
  // ToDo: no they don't, remove this I guess, this is a hack
  if( page.isDo() && page.data ){
    if( page.data.redirect ){
      // Consume parameters, so that redirect occurs once only
      page.data.redirect = false
      var url        = page.data.url
      var code       = page.data.code
      page.data.url  = null
      page.data.code = null
      return that.redirect( req, url, code)
    }
  }
  
  // Adjust user's config based on content of some pages
  if( true // page.data
  && !that.isCurator
  && !page.isDo()
  && !page.isCopy()
  && !page.isRestore()
  && !page.isDeletion()
  ){
    // ToDo: I should be able to use page.data directly
    var body = !page.isDraft() ? data : page.getNondraftBody()
    var newdata = that.wiki.extractBasicYaml( body)
    if( newdata != page.data ){
      that.de&&bug( "set new data, page:", page.name)
      page.data = newdata
    }
    that.wiki.setOptions(
      that.config,
      page.data,
      that == that.loginPage ? "user" : "page",
      page,
      that
    )
    // Attach data to the session too
    if( page.isDraft() ){
      newdata = that.wiki.extractBasicYaml( data)
    }
    if( newdata ){
      for( var key in newdata ){
        that.setSessionData( key, newdata[key], page)
      }
    }
  }
  
  // Edit new page?
  var may_edit =  that.mayEdit( page );
  if( page.isNull()
  && !page.isUser()
  && may_edit
  && !(that.isGuest() && that.wiki.isClosed())
  ){
    return that.editForm( req, false )
  }

  // Set default content for pages. User pages default to current user
  if( page.isNull() ){
    if( page.isUser() && !that.isCurator ){
      data = that.userName()
      if( !data ){
        data = ""
      }
    }
  }
  if( (page.isUser() )
  && "Deleted".starts( data) && !that.isCurator
  ){
    that.de&&bug( "Set deleted page back to default user name")
    data = that.userName()
  }
  
  // Welcome auto-registering draft members
  if( page == that.loginPage
  &&  that.isGuestMember
  &&  data.replace( /\s/g, "") == that.userName()
  &&  page.name != "SomeOne"
  ){
    that.de&&bug( "Set initial content of user page") 
    var welcome = [
      that.loginName,
      "",
      that.i18n( 'Hello!'),
      that.i18n( 'Please bookmark the "SECRET!" below.'),
      "",
      "Help" + SW.name
    ]
    that.login_de&&bug( "autoregistering, loginpage:", page,
    "user:", that.loginName)
    that.draft( page, true)  // true => force
    that.putPage( page, data = welcome.join( "\n"), function(){})
  }
  
  if( "Deleted".starts( data) && !this.isCurator ){
    data = ""
  }
  
  // Tool? (this is the "top" menu)
  var tools = ""
  if( !page.isHtml() ){
    // ToDo: I should at least have a "Bye", even on "read" pages
    if( (true || !page.isRead()) || that.canCurator ){
      tools = that.toolForm( page)
    }
  }

  // Content
  NDe&&bug( "Building content")
  var content  = ""
  var previous = null
  
  // Phase2 occurs after potential wikification
  function phase2(){
    // Build html page's body
    html.push( that.htmlLayout(
      page,
      tools,
      content,
      previous,
      that.editClosure  // Set by toolForm(), a hack, ToDo: fix
    ))
    // Footer, if header tools
    if( tools ){
      html.push( that.footerForm( page, tools))
    }
    return phase3()
  }
  
  // For html, no more to do, jump to phase3 (i.e. send result)
  if( page.isHtml() ){
    html = [data]
    return phase3()
  }
  
  // For Do page, sometimes the result contains HTML, jump to phase2
  if( page.isDo() && "HTML".starts( data) ){
    content = data.substr( 4)
    return phase2()
  }
 
  // For regular pages, wikify then content & organize the two columns layout
  
  var pagelabel = tools ? that.pageLabel( page) : ""
  NDe&&bug( "pagelabel ", pagelabel)

  // Sometimes I display two panes/columns  
  var canprevious = that.config.rows > 10 && that.twoColumns

  // Flag differences, basic, detect lines that are not in old content
  if( page.nondraft ){
    var old = "\n" + page.getNondraftBody() + "\n"
    var new_data = ""
    data.split( "\n").forEach( function( line ){
      if( line && !old.includes( "\n" + line + "\n" ) ){
        new_data += "!!!" + line + "\n"
      }else{
        new_data += line + "\n"
      }
    })
    data = new_data
  }
  
  // Wikification. It's asynchronous because of Toc pages
  return that.wikify( data, page, null, null, function viewform_wikified( wikitext ){
  
    content = [
      pagelabel,
      '<div id="content_text">',
      wikitext,
      '</div>'
    ]
    // Inline editing. Avoid editForm() when possible
    if( that.canScript && may_edit ){
      content.push(
        '<div id="content_editable">',
        that.editFragment( page, req),
        '</div>'
      )
    }
    content = content.join( "")
    
    // Display page and maybe some previous page
    // In two columns mode, the other column usually hold some previous content
    // Previous content is non draft version of draft pages
    if( canprevious && page.nondraft ){
      var old = page.getNondraftBody()
      // Flag differences, basic, detect lines that are not in new content
      // See better: http://code.google.com/p/google-diff-match-patch/
      if( old ){
        data =  "\n" + data + "\n"  // Make sure all lines are \n enclosed
        old  =  "\n" + old + "\n"
        old = old.split( "\n").map( function( line ){
          return (!line || data.includes( "\n" + line + "\n" )) ? line : ("!!!" + line)
        }).join( "\n")
      }
      // And a new line
      data.split( "\n").forEach( function( line ){
        if( line && !old.includes( "\n" + line + "\n") ){
          old += "\n!!!+" + line
        }
      })
      // ToDo: client side wikifyText
      if( that.canScript ){
        previous = that.i18n( "Original content") + "\n"
        + that.wikifyText( Wiki.htmlize( old))
      }else{
        previous = that.i18n( "Original content") + "\n"
        + Wiki.htmlize( old)
      }
    }
    if( canprevious && tools && !previous ){
      // If previous page is inadequate
      if( !that.previousPage || that.previousPage == page ){
        previous = null
        // I want to display the home page (global or user's)
        var other = that.loginPage
        if( other == page ){
          if( page != that.wiki.homePage ){
            other = that.wiki.homePage
          }else{
            other = null
          }
        }
        if( other && !other.isVoid() ){
          previous = that.pageLabel( other, true) // true => long, ToDo ???
          + that.wikify( other.getBody(), other)
        }
      // If previous page is ok
      }else{
        // ToDo: issue with lack of wikification on client side
        previous = that.previousContent
      }
    }
    if( canprevious && content ){
      that.previousContent = [
        that.i18n( "Previous ") + that.pageLabel( page),
        wikitext
      ].join( "")
      if( previous ){
        that.previousPage = page
      // If single page was displayed, reset previous stuff
      }else{
        that.previousPage = null
      }
    }
    
    // Build Html content & footer and send result
    phase2()

  })
  }, this.isCurator)
  // .read() is "local" if curatoring, see "Proxy" pages
  return this
}

Session.editForm = function( req, loop ){
// This method is very much like viewForm() but it displays that page in
// "edit" mode.
 
  // ToDo: There should be some basic mechanism to detect concurrent
  // change. When that happens, the last that talked is right.
  // But the previous version should be presented on the right
  // side of the display together with the page again in edit
  // mode on the left side. The user would have the ability
  // to copy/paste from both side to build the final result.
  
  this.get_de&&bug( "editForm:" + this.getCurrentPage())
  
  var that = this
  var page = this.getCurrentPage()
  
  // If processing a POST, viewForm() will try to redirect to referer
  if( req.method == "POST" && !req.isRest && page.wasIncarned() ){
    return this.viewForm( req)
  }

  // Check login/logout with twitter...
  if( this.handleChangedLogin( page, req) )return
  
  this.fixVisit( page)
  page.read( function( err, page ){
    var previous = null
    if( page.nondraft ){
      previous = Wiki.htmlize( page.getNondraftBody())
    }else{
      previous = that.previousContent
    }
    var form = [
      '<div id="content_edit">',
      that.editFragment( page, req),
      '</div>'
    ].join( "")
    var text = that.htmlLayout(
      page,
      that.toolForm( page, "edit"),
      ((page.isHome() && that.wiki.isRoot()
        ? ""
        : that.pageLabel( page, false, that.i18n( "Editing ")))
      + form),
      previous
    )
    // ToDo: move this somewhere else
    var perma
    if( that.config.twitter && (perma = that.permalinkTo( page)) ){
      text += '<script type="text/javascript">'
      + 'tweetmeme_source = "' + that.config.twitter + '";'
      + 'tweetmeme_url = "' + perma + '";' 
      + '</' + 'script>'
      + '<script type="text/javascript" '
      + 'src="http://tweetmeme.com/i/scripts/button.js">'
      + '</' + 'script>'
    }
    
    text += that.footerForm( page, true)
    text = that.html(
      page,
      "Edit " + page.name + " - " + that.loginName, 
      text
    )
    that.respond( req, text);
  }, that.isCurator)
  // "local" fetch if curatoring
}


Session.pageLabel = function( page, long, prefix ){
// Returns label for page, 2 lines, including blanks
// This is the "content_header" div (or "content_header_void" if slides)
  if( (page.name.includes( "Slide") // ToDo: get rid of, rely on CSS?
   || page.isRead())
  && !this.twoColumns
  ){
    return '<div id="content_header_void"></div>'
  }
  prefix || (prefix = "Page ")
  return '<div id="content_header">'
  + (page.wasInherited() ? (this.wiki.parentWiki.name) + " " : "")
  + prefix + "<i>" // ToDo: CSS class?
  + this.link( page, page.name, this.tooltip( page))
  + "</i></div>"
}

Session.wikiUserLabel = function(){
// Returns nice looking "label" for the wiki.
// Returns i18n'ed "Anonymous" or the wiki's name (or title)
  if( this.wiki.isUserWiki() )return this.i18n( "Yours")
  var homelabel
  var wiki  = this.wiki
  var title = wiki.getTitle( this)
  if( title ){
    homelabel = title
  }else{
    homelabel = wiki.name || SW.name
    // If wiki name matches user's name
    if( this.isWikiOwner( this.loginName) ){
      homelabel = this.i18n( "Home")
    // If custom domain
    }else if( this.custom ){
      // Get rid of trailing /
      homelabel = this.subdomain.substr( 0, this.subdomain.length -1)
    // "Anonymous" case
    }else if( wiki.isAnonymous() ){
      homelabel = this.i18n( "Anonymous")
    // "normal" case
    }else{
      // ToDo: was homelabel = homelabel.replace( /.*_/, "")
      // and I don't remember why...
    }
  }
  if( wiki.isVeryOpen() ){
    homelabel += this.i18n( "(open)")
  }else if( false ){ // ToDo: finish this
    homelabel += this.i18n( "(closed)")
  }
  return homelabel
}
Session.declareIdempotentGetter( "wikiUserLabel")

// jhr
// xuor     e     l      na     i      r    b
// xno\u0279\u01dd\u0283 u\u0250\u0131\u0279q

Session.autogrowScript = function sw_grow( e ){
// Client side
// This function basically does 3 things (which is way too much).
// 1/ when called with a "init" parameter, it attaches an event listener
// (to #content_text) to detect "click to edit" in pages that needs that.
// And it defines a few functions used elsewhere...
// 2/ when called with "edit", it switches to edit mode if not done already
// 3/ if in edit mode, it makes sure the normal text is hidden, the editable text is
// shown and the textarea size is big enough and has been given the focus

  // de&&bugC( "sw_grow() called")
  // If called before global $(document).ready(), do nothing
  // This may happen when sw_grow.js gets loaded, and on some other rare
  // bad cases also, maybe (in inline_de mode)
  if( !window.sw_document_ready || !window.sw_wpx ){
    de&&bugC( "sw_grow() call is premature, postponed");
    setTimeout( function(){ sw_grow( e); }, 100 );
    return
  }

  // Inside the #content or #content_edit divs there are two divs
  var $txt  = $('#content_text')
  // The second one contains a <form>
  var $edit = $('#content_editable')
  // The "textarea" in it. There can be unexpected \r in it
  var ta    = document.getElementById( 'textarea_sw')
  var $ta   = $(ta)
  
  // Webkit has a bug with number of cols
  if( $.browser.webkit ){
    $ta.attr( "cols", sw_ctx.cols + 1 );
    // Webkit needs limits or else textarea overflows
    // Msie does not work well with such limits
    ta.style.width = ta.style.maxWidth
    = Math.floor( sw_ctx.cols * sw_wpx + 1) + 'px';
  }
  
  var do_init = ( e === "init" )  || ( e && !sw_grow.init_done );

  if( do_init ){
    if( e === "init" ){
      de&&bugC( 'sw_grow( "init" ) called');
    }else{
      de&&bugC( "Error? s_grow( " + e + " ) called before init )" );
    }
  }
  if( do_init && sw_grow.init_done ){
    de&&bugC( "Attempt to init but was done before" );
    do_init = false;
  }
  
  if( do_init ){
    sw_grow.init_done = true;
    
    // http://stackoverflow.com/questions/3053542/how-to-get-the-start-and-end-points-of-selection-in-text-area/3053640#3053640
    var getInputSelection = function( el ){
      var start = 0
      var end   = 0
      var normalizedValue
      var range
      var textInputRange
      var len
      var endRange
      if( typeof el.selectionStart == "number"
      &&  typeof el.selectionEnd   == "number"
      ){
        start = el.selectionStart
        end   = el.selectionEnd
      }else{
        range = document.selection.createRange();
        if( range && range.parentElement() == el ){
          len = el.value.length;
          normalizedValue = el.value.replace( /\r\n/g, "\n")
          // Create a working TextRange that lives only in the input
          textInputRange = el.createTextRange();
          textInputRange.moveToBookmark(range.getBookmark());
          // Check if the start and end of the selection are at the very end
          // of the input, since moveStart/moveEnd doesn't return what we want
          // in those cases
          endRange = el.createTextRange();
          endRange.collapse(false);
          if (textInputRange.compareEndPoints("StartToEnd", endRange) > -1) {
            start = end = len;
          }else{
            start = -textInputRange.moveStart("character", -len);
            start += normalizedValue.slice(0, start).split("\n").length - 1
            if (textInputRange.compareEndPoints("EndToEnd", endRange) > -1) {
              end = len;
            }else{
              end = -textInputRange.moveEnd("character", -len);
              end += normalizedValue.slice(0, end).split("\n").length - 1;
            }
          }
        }
      }
      return {
        start: start,
        end:   end
      }
    }

    // I save it because I may use it somewhere else in the future,
    // maybe in on_click to leave the text area if user clicked on it
    // by accident and then click on a link
    window.sw_get_input_selection = getInputSelection
  
    // Define a function to submit the form
    window.sw_submit = function sw_submit( verb, guest, text, action ){
      var sw_form = document.getElementById( "edit_form")
      var form    = document.createElement( "div")
      var query   = sw_ctx.address
      if( window.sw_codemirror ){
        window.sw_codemirror.save()
      }
      text || (text = ta.value)
      // Save bandwidth & improve speed
      // ToDo: to the same if value didn't change (empty content will be
      // ignored when received)
      if( verb == "Cancel" || verb == "Revenir" ){
        text = ""
      }
      guest || (guest = "")
      form.innerHTML = '<form'
      + ' action="' + query + '"'
      + ' method="POST"'
      + ' accept-charset="utf-8"'
      + '>'
      + '<textarea name="text"></textarea>'
      + '<input type="hidden" name="postpage">'
      + '<input type="hidden" name="guest">'
      + '<input type="hidden" name="post" value="' + verb + '">'
      + '</form>'
      form.firstChild.children[0].value = text
      form.firstChild.children[1].value = sw_ctx.page
      form.firstChild.children[2].value = guest
      form.firstChild.action = action || sw_form.action
      // console.log( "submit"); console.log( form)
      window.onbeforeunload = null
      // ToDo: should also set cookie when submit is in original form
      if( sw_ctx.scrollTo ){
        document.cookie = "sw_scroll_to=" + sw_ctx.scrollTo
      }
      form.firstChild.submit()
      return true
    }

    // In "edit" page, there is no "click to edit" because we go in edit mode
    // as soon as the page is loaded. However, there is still a need to handle
    // clicks (when in edit mode), this is about handling clicks on special
    // "Now" wikiwords that trigger an action. It's actually a double click
    // that triggers the action, because the first click "select" some text
    // that the second click handles.
    // ToDo: some equivalent to this when using CodeMirror
    sw_ctx.onClickOnEditContent = function( e ){
      e = e || window.event
      var target = e.target || e.srcElement
      if( target == ta ){
        var pos = window.sw_get_input_selection( ta)
        // console.log( "click in textarea, start:" + pos.start + ", end: " + pos.end)
        var val = ta.value.replace( /\r\n/g, "\n")
        // If 
        if( pos.start != pos.end ){
          var action  = val.slice( pos.start, pos.end );
          var trimmed = action.trim();
          var limit   = pos.end + val.substr( pos.end).indexOf( "\n") + 1
          de&&bugC( "action:'" + encodeURIComponent( action) + "'")
          if( trimmed == "SendNow" ){
            window.sw_submit( "Send", "", val)
          // Double click at end of line => send
          }else if( action == "\n" ){
            window.sw_submit( "Send", "", val)
          }else if( trimmed == "DoIt" ){
            window.sw_submit( "DoIt", "", val)
          }else if( trimmed == "CancelNow" ){
            window.sw_submit( "Cancel", "", val)
          }else if( trimmed == "SortNow" || trimmed == "ReverseNow" ){
            var front = val.substr( 0, limit)
            var tail  = val.substr( limit)
            tail = ("\n" + tail + "\n").replace( /\n+/g, "\n")
            var list = tail.split( "\n")
            list = (trimmed == "SortNow") ? list.sort() : list.sort().reverse()
            tail = list.join( "\n")
            tail = ("\n" + list.join( "\n") + "\n").replace( /\n+/g, "\n")
            ta.value = front + tail
          }else if( trimmed == "TimeNow" ){
            // console.log( "insert ISO date")
            ta.value = val.substr( 0, pos.start)
            + (new Date()).toISOString() + "\n" + action
            + val.substr( pos.end)
          }else if( trimmed == "DateNow" ){
            // console.log( "insert local date")
            ta.value = val.substr( 0, pos.start)
            + (new Date()).toLocaleString() + "\n" + action
            + val.substr( pos.end)
          }else if( /^[A-Z_\[]\w+[A-Z_\[\]]\w*$/.test( trimmed) ){
            if( ta.value.replace( /\r\n/g, "\n") == sw_ctx.initialContent ){
              sw_magic_loader(
                sw_ctx.address.replace( /\/[^\/]*$/, "/" + trimmed)
              )
            }else{
              window.sw_submit( "Go" + trimmed, "", val)
            }
          }else{
            // ToDo: Expand ISO date into local date
          }
        }
      }
    }

    window.sw_header_buttons = function(){
    // Turn header into link to form's submit buttons anchor
    // This helps navigation
      // Don't do that on empty page / empty wiki
      if( !ta.value.length )return
      // $("#header_content").html( '<a href="#edit">...</a>')
      // Better: copy buttons from form itself
      var form = document.getElementById( "edit_form")
      var ii = 0
      var child
      var children = form.children
      var buf = []
      var name
      var title
      // console.log( "edit_form children count:" + form.childElementCount)
      while( ii < form.childElementCount ){
        child = children[ii++]
        // console.log( "child type:" + child.type)
        if( child.type != "submit" )continue
        name  = child.value
        title = child.title
        buf.push( '<a href="javascript:window.sw_submit(\'' + name + '\')"'
          + ' title="' + title + '">' + name + '</a>'
        )
      }
      if( !sw_ctx.isIframe ){
        buf.push( '<a href="#edit">...</a>' );
      }
      $("#top_center").html( buf.join( "|"))
    }

    // Install click handler ("Click to edit" unless "edit" page already) asap
    loadfire.event( function( fire ){
      // Needs onClickOnEditContent() or onClickOnContent()
      var handler = sw_ctx.isEditPage
      ? sw_ctx.onClickOnEditContent
      : sw_ctx.onClickOnContent
      if( !handler )return
      // Don't do "click to edit" if no logged in user, too disturbing
      if( sw_ctx.isAnonymous )return;
      // Got it, install it on "content" area
      de&&bugC( "On click: edit? " + sw_ctx.isEditPage + ", handler" + handler.name)
      $("#content")
      .click( handler)
      // Dragging something also triggers the edit mode
      // Works on Chrome. ToDo: does not work on FF & Opera... :(
      .bind( "dragenter", handler)
      return true
    })

  }

  // If called while not editing
  if( !sw_ctx.isEditing ){
    if( !sw_ctx.isEditPage ){
      if( e != "edit" ){
        if( e != "init" ){
          de&&bugC( "sw_grow() called while not editing, skipped")
        }
        return
      }
    }
    sw_ctx.isEditing      = true
    sw_ctx.initialContent = ta.value.replace( /\r\n/g, "\n")
  }

  // If we get here it means that were're in editing mode 

  // Copy submit buttons to the top menu
  if( !sw_ctx.buttonsWereCopied ){
    sw_ctx.buttonsWereCopied = true
    window.sw_header_buttons && sw_header_buttons()
    // I show them now
    sw_fade( true, true)
  }

  // Make sure there is always a terminating lf, usefull for drops
  var val = ta.value.replace( /\r\n/g, "\n")
  if( typeof sw_ctx.textarea_was_empty === "undefined" ){
    sw_ctx.textarea_was_empty = !val
  }
  if( !val ){
    sw_ctx.textarea_was_empty = true
  }
  if( !sw_ctx.textarea_was_empty
  && val.charAt( val.length - 1) != "\n"
  //&& window.sw_get_input_selection // Hack to prevent err on premature calls
  ){
    // ToDo: this works poorly if user is writing at the end
    // I detect if the caret is at the end
    var pos = window.sw_get_input_selection( ta );
    pos = (pos.start > pos.end) ? pos.start : pos.end
    // console.log( "val length: " + val.length + ", pos:" + pos + "ch:" + val.charAt( val.length - 1))
    if( pos < val.length ){
      // console.log( "add extra \\n")
      // ToDo: unfortunately this moves the caret to the end of the text area
      // ta.value = val + "\n"
    }
  }

  if( !sw_ctx.editHadFocus ){
    var scroll_top = $('body').scrollTop( scroll_top)
    // de&&bugC( "height:" + scroll_delta)
    $txt.hide()
    $edit.show()
  }

  // Adjust height (only if content changed)
  if( sw_ctx.grownContent != val ){
    sw_ctx.grownContent = val
    var ch = ta.offsetHeight
    var sh = ta.scrollHeight
    // sh is bad... needs ta.style.height = 0 first,
    // on some browsers, to update scrollHeight, quirks.
    // but unfortunately it has bad side effect on scroll.
    // Workaround: create a clone just to get the height.
    // See http://james.padolsey.com/javascript/jquery-plugin-autoresize/
    // Many thanks James, it's been hard without you
    var clone  = sw_ctx.growClone
    if( !clone ){
      // Properties which may effect space taken up by characters
      var props  = ['height','width','lineHeight','textDecoration','letterSpacing']
      var propOb = {}
      // Create object of styles to apply:
      $.each( props, function( i, prop ){
        propOb[prop] = $ta.css( prop)
      })
      // Clone the actual textarea removing unique properties
      // and insert before original textarea:
      sw_ctx.growClone = clone = $ta.clone()
      .removeAttr( 'id').removeAttr( 'name').css({
        position: 'absolute',
        top: 0,
        left: -9999
      }).css( propOb).attr( 'tabIndex', '-1')
      .insertBefore( $ta)
    }
    // Prepare the clone (including calling height( 0) as required)
    clone.height( 0).val( val).scrollTop( 30000)
    // Find the height of text, now that we scrolled to the bottom
    sh = clone.scrollTop()
    // console.log( "sh:" + sh + ", ch:" + ch)
    // if( sh > ch ){
      // console.log( "grow")
      ta.style.height = (sh + 2 * sw_hpx) + 'px'
    // }else if( sh < (ch - (2 * sw_hpx)) ){
      // console.log( "shrink")
      // ta.style.height = (sh + 2 * sw_hpx) + 'px'
    // }
    clone.height( ta.style.height)
  }

  // Give focus, but once only, because I don't control the
  // caret position (that should follow the mouse I wish) and
  // as a result the caret position determines the scroll top of
  // the text area...
  // 2014, it is actually better not to force focus because this may
  // trigger a scroll to the top of the page and as a result the user
  // get lost. Consequence: click to switch to edit mode, click to move
  // cursor = two clicks... that's the best I could find so far (july 2014)
  if( !sw_ctx.editHadFocus ){
    sw_ctx.editHadFocus = true
    // Also remember it
    // ToDo: I should window.location.pushState() it...
    //var scroll_top = $('body').scrollTop( scroll_top)
    // de&&bugC( "height:" + scroll_delta)
    //$txt.hide()
    //$edit.show()
    if( !sw_ctx.isIframe ){
      // ToDo: To get the correct scrolltop I should somehow revert the effect
      // of <h1> <h2> etc that make the page look bigger in "show mode" than in
      // "edit mode", leading to a wrong scrolling when user clicks to edit
      $ta.focus( function(){
        if( scroll_top ){
          // If I do it immediately, nothing happens...
          setTimeout( function(){
            $('body').scrollTop( scroll_top)
            // Remember that in a cookie so that I get back to that
            // position when page gets refreshed after it is submitted
            // ToDo: I should set the cookie when I actually submit
            sw_ctx.scrollTo = scroll_top
            scroll_top = 0
          }, 50)
        }
      })
      // ToDo: study http://stackoverflow.com/questions/1181700/set-cursor-position-on-contenteditable-div
      // ToDo: https://github.com/kueblc/LDT
      // JHR, 2014, try without it
      if( false ){
        $ta.focus()
      }else{ 
        scroll_top = 0;
      }
    }
    // Also install a handler for Ctrl-S and Esc shortcuts
    var ctrl_pressed = false
    $ta.keydown( function( event ){
      // console.log( "keydown " + event.keyCode)
      if( event.keyCode == "17" || event.keyCode == "224" ){
        ctrl_pressed = true
      }
      // Ctrl-S to send
      if( event.keyCode == "83" && ctrl_pressed ){
        sw_submit( "Send") // ToDo: some "Update" that does not quit
        event.preventDefault()
        return false
      // Esc to cancel
      }else if( event.keyCode == "27" ){
        sw_submit( "Cancel")
        event.preventDefault()
        return false
      // Tab to insert spaces
      // See http://mattstypa.com/2010/06/tabs-in-textarea/
      // ToDo
      }
      // ToDo: handle cursor keys to scroll the window when caret is either at
      // the top or the bottom of the text area.
      // Resize text area if needed
      sw_grow()
      return true
    })
    .keyup( function( event ){
       // If Ctrl or Mac's Cmd
       if( event.keyCode == "17" || event.keyCode == "224" ){
         ctrl_pressed = false
       }
    })
    // ToDo: can't track these event as long as sw_grow() is not
    // fixed regarding it's side effect on the scrollHeight
    .change(     function(){ sw_grow() })
    .mouseleave( function(){ sw_grow() })
    .mouseenter( function(){ sw_grow() })
  }

}


Session.editFragment = function( page, req ){
// I build a form with a textarea, an input field and submit buttons
// For some pages, the textarea is managed by CodeMirror

  // ToDo: would be fun to support the todotxt file format
  // See https://github.com/ginatrapani/todo.txt-cli/wiki/The-Todo.txt-Format

  // ToDo: cache / make global
  var that = this
  var postclosure_id = that.postClosureId
  
  // Figure out some decent value for the text area if empty
  var data = page.getBody() || ""
  var empty = !data
  if( empty
  || (page.wasDeleted() && !this.isCurator)
  ){
    // "User" pages content default to the current user's name
    if( page.isUser() ){
      // Unless curator is apparently creating a user
      if( that.canCurator
      && ( "User@".starts( page.name)
        || "User[".starts( page.name)
        || "@".ends(       page.name)
        || "In".ends(      page.name))
      ){
        // In that case the content is the user's name (it comes after "User")
        data = page.name.substr( "User".length) + "\n"
      }else{
        data = that.userName() + "\n"
      }
    // "HomePage" defaults to some welcome message
      data = that.i18n( "Click !here! to add content")
    }
  }

  // Get the < > & right
  data = Wiki.htmlize( data)
  
  // I will use a textarea, I want it to grow/shrink depending on content
  var autogrowscript = this.htmlScript( Session.autogrowScript)

  // Starting with some initial height, based on content's number of lines
  // ToDo: would get a better fit if I did some wrapping management
  var nrows = data.length - data.replace( /\n/g, "").length + 5
  if( nrows < 5 ){ nrows = 5 }
  
  // Some pages uses CodeMirror for a better TextArea
  var needs_codemirror = false
  var is_angular  = page.isAngular()
  var is_markdown = page.isMarkdown()
  var is_css      = page.isCss()
  var is_less     = page.isLessCss()
  if( page.name == this.config.cssStyle
  ||  page.name == this.wiki.config.cssStyle
  ||  page.name == page.get( "cssStyle")
  ||  is_less
  ){
    is_css = true
  }
  // ToDo: JHR 2014 no codemirror yet
  if( needs_codemirror = false && is_angular || is_css ){
    nrows = 25
  }
 
  var textarea = [
    "<textarea", // ToDo: I want 50, but asking 50 gets me more...
    ' name="text" cols="', that.config.cols, '" rows="', nrows, '"',
    ' id="textarea_sw"',
    ">",
    data, // ToDo: I need to encode this somehow, apparently I don't
    '</textarea>'
  ].join( "")

  // After the textarea comes a set of action buttons in a <form> with maybe
  // a small text input before, to collect comments or short inputs
  var buttons = []
  var ask = function( question, dflt ){
    buttons.push(
      that.i18n( question + ": "), 
      '<input name="guest"',
      ' value="' + (dflt || "") + '"',
      '/><br>'
    )
  }
  var submit = function( verb, tooltip ){
    buttons.push(
      '<input type="submit" id="edit_submit" name="post" value="',
      that.i18n( verb),
      '" title="',
      tooltip,
      '" />'
    )
  }
  
  // This anchor helps to get to the buttons, from the top menu
  buttons.push( '<a name="edit"></a><hr><br>')

  // Name or wiki's name or comment (or new member's name)
  if( !that.shouldAskNothing( page) ){
    that.shouldAskForName( page)
    ? ask( "Your name maybe", that.getPlausibleName( page, req))
    : (that.shouldAskForWikiTitle( page)
      ? ask( "This wiki's title maybe")
      : (that.shouldAskForNewMember( page)
        ? ask( "Member's name")
        : ask( "Comment")
      )
    )
  }
  
  // An hidden field helps to detect valid requests, see postForm()
  buttons.push(
    '<input type="hidden" name="postpage" value="',
    Wiki.htmlizeAttr( page.name),
    '"/>'
  )

  //   Send
  // like submit( "Send") but with id, because css styled & submit on Ctrl-S
  buttons.push(
    '<input type="submit" id="send" name="post" value="',
    that.i18n( "Send"),
    '" title="' + that.i18n( "publish new version of page"),
    '"/>'
  )
  if( !that.isGuest() ){
    // Draft
       (!page.isSensitive() || that.canCurator)
    && !that.wiki.isEmpty() // Don't confuse new comers
    && !empty
    && !page.isDraft()
    && submit( "Draft", "send a draft version");
    // Stamp
       page.isDraft()
    && submit( "Stamp", "publish, not as draft");
    // Copy
       !empty
    && !page.isCopy()
    && !page.isDraft()
    && submit( "Archive", "make a copy and then publish new version");
    // Restore
       (!empty || page.wasDeleted())
    && !page.isDraft()
    && !page.isCopy()
    && !page.isRestore()
    && submit( "History", "use archived version of page");
    // Delete
       (!empty || page.wasInherited())
    && !page.isHome()
    && (page != that.loginPage || page.wasInherited())
    && page.name != "AboutWiki"
    && !page.isCopy()
    && !page.isDraft()
    && submit( "Delete", "erase content of page");
  }
  //   Cancel
  if( !empty ){
    submit( "Cancel")
  }else{
    if( this.canScript && !this.isTouch ){
      buttons.push(
        ' <a HREF="javascript:history.go( -1)"'
        + ' title="' + this.i18n( "Go to previous page") + '">'
        + this.i18n( "back") + '</a> '
      )
    }
  }
  
  // Make sure postForm() doesn't discard the post
  this.postExpected = page.name

  if( needs_codemirror ){
    //this.de&&bug( "needs CodeMirror for page:", page)
    this.needsCodeMirror = true
    page.isSourceCode = true
    var code_mirror_script = function sw_init_codemirror(){
      loadfire.event( function( fire ){
        if( !window.CodeMirror )return
        // Note: I depend on 2 base js files from CodeMirror:
        //   codemirror.js, codemirror_base.js
        // I build codemirror_base.js using Uglify at http://codemirror.net/compress.html
        // It contains all the "In-frame base files"
        // I also depends on "parser" files:
        //   parsexml.js, parsecss.js, tokenizejavascript.js & parsehtmlmixed.js
        // ToDo: I should include these files inside codemirror_base
        // I also depend on 3 css files:
        //   jscolors.css, csscolors.css & xmlcolors.css
        // All these files must be in the "root" directory
        // (the "root" directory is just the "current" directory...)
        // See http://codemirror.net/compress.html
        sw_ctx.codemirror = CodeMirror.fromTextArea( 'textarea_sw', {
          basefiles: ["codemirror_base.js"],
          height: "dynamic",
          parserfile: PARSER,	// changed below
          stylesheet: CSS,	// ditto
          continuousScanning: 500,
          iframeClass: "sw_codemirror",
          lineNumbers: true,
          enterMode: "keep", // I don't trust most "auto" indent...
          electricChars: false,
          saveFunction: function(){
            sw_submit( "Send")
          }
        })
        sw_codemirror.focus()
        return true
      })
    }
    var script_text = this.htmlScript(
      code_mirror_script.toString() + "\nsw_init_codemirror()"
    )
    if( is_angular ){
      script_text = script_text
      .replace(
        "PARSER",
        '['
        + '  "parsexml.js"'
        + ', "parsecss.js"'
        + ', "tokenizejavascript.js"'
        + ', "parsejavascript.js"'
        + ', "parsehtmlmixed.js"'
        + ']'
      )
      .replace(
        "CSS",
        '['
        + '  "csscolors.css"'
        + ', "xmlcolors.css"'
        + ', "jscolors.css"'
        + ', "simpliwiki.css"' // ToDo: should be some pseudo "current.css"
        + ']'
      )
    }
    if( is_css ){
      script_text = script_text
      .replace( "PARSER", '"parsecss.js"')
      .replace( "CSS",    '["csscolors.css","simpliwiki.css"]')
    }
    if( is_markdown ){
      script_text = script_text
      .replace( "PARSER", '""')
      .replace( "CSS",    ']')
    }
    autogrowscript = script_text + autogrowscript

  }else{
    //this.de&&bug( "No CodeMirror for page:", page)
  }
   
  //this.de&&bug( "editFragment done for page:", page)
  
  return [
    '<form method="POST" id="edit_form" accept-charset="utf-8" ',
    "action=\"" + this.hrefPath( page) + "?cid=", postclosure_id, "\">",
    textarea,
    buttons.join( ""),
    "</form>",
    "\n", //\n\n\n\n\n\n", // Room for footer
    autogrowscript    // ToDo: this is probably not the best place to inject
  ].join( "")
}


Session.footerForm = function( page, tools ){
// Builds the footer that is displayed on all pages at the bottom

  // No footer if embedded
  if( this.isOembed )return ""

  var that = this
  var foot = []
  var pagename = page.name
  var data = page.getBody() || "";
  var empty = !data;
  var isuser = page.isUser()
  var with_code = false

  // Login form? (twitter SignIn)
  if( tools 
  && ( true
    || that.isGuest()
    || page.name == "SignIn"
    || (page.isHome() && !that.user)
    || (page == that.loginPage && !that.user)
    || page.name == "DoProfile"
    || page.name == "DoSearch"
    || page.isMap()
    || page.isSecret()
    || that.wiki.isUserWiki()
    || (false && that.facebookId) // Provide "sign out" on all pages
    )
  ){
    with_code = true
  }
  
  // Login form? (twitter SignIn)
  if( with_code ){
    foot.push( that.serviceLoginForm())
  // Else, just SignIn
  }else{
    if( page.name != "SignIn" && !this.isKudocracy ){
      foot.push(
        '<div id="login">',
        this.link(  this.lookup( "SignIn"), this.i18n( "SignIn"), "click"),
        '</div>'
      )
    }
  }

  // Arrow to scroll to the top
  if( !empty && !that.isIframe ){
    foot.push(
      '<div id="gotop"><a href="#top">&uarr;</a></div>'
    );
  }

  // Visits
  if( tools
  //&& that.wikiHistory.length
  && !that.wiki.isEmpty()
  ){
    var list  = []
    var first_seven = that.wikiHistory.slice( 0, 7)
    var a_page
    for( var ii in first_seven ){
       a_page = this.lookup( first_seven[ii])
       list.push( that.link(
         a_page,
         that.isWii ? a_page.name : Wiki.redize( a_page.name)
       ))
    }     
    foot.push( this.i18n( "Visit ")
      + ((!this.canScript || this.isTouch)
      ? ""
      : '<a HREF="javascript:history.go( -1)"'
      + ' title="' + this.i18n( "Go to previous page") + '">'
      + ' ' + this.i18n( "back") + '</a> ')
      + list.join( " ")
    )
  }

  // Backlinks
  if( tools && !page.isHome() ){
    var buf = "<br>" + that.i18n( "Links:")
    var list = []
    that.wiki.forEachBacklink( page, that.canCurator, function( apage ){
      list.push( " " + that.link(
        apage,
        that.isWii ? apage.name : Wiki.redize( apage.name)
      ))
    })
    // Don't display as is if empty or too much, avoid some noise
    if( list.length ){
      // If long list not about a tag,I pick 7, randomly
      if( (list.length > 7) && !page.isTag() && !that.isCurator ){
        Sw.randomizeArray( list)
        list = list.slice( 0, 8)
      }
      foot.push( buf + list.sort().join( ""))
    }
  }
  
  // Permalink & FB like button
  var plink = that.permalinkTo( page, isuser)
  var fb_like = true

  if( tools
  && plink
  && !that.wiki.isEmpty()
  && !that.wiki.isUserWiki()
  ){
    var is_safe = false
    if( page.isHome()
     || page.isGuest()
     || page.isPublic()
     || page.isRead()
    ){
      is_safe = true
    }
    if( (page.data && page.data.isFbLike)
    || (that.config.fbLike 
      && (is_safe || that.facebookId)) // Can add comment on any page
    ){
      // However, no fb like button on iPhone, too clumsy
      fb_like = !that.isTouch
      // No comments on user & private pages,
      // useless & may compromize privacy by broadcasting secrets
      if( page.isUser() || page.isPrivate() ){
        fb_like = false
      }
      // No comments if embeded, takes too much space
      if( that.isOembed ){
        fb_like = false
      }
    }

  }else{
    fb_like = false
  }

  // "Go to page:" section
  if( true ){
    var postclosure_id = that.postClosureId
    if( !that.wiki.isEmpty()
    &&  !that.wiki.isVeryOpen()
    &&  !that.wiki.isUserWiki()
    ){
      foot.push( '<form method="POST" accept-charset="utf-8" '
        + "action=" + that.hrefPath( page) + "?cid=" + postclosure_id + ">"
        + '\n'
        + that.i18n( "Go to page: ")
        + '<input id="guest" name="guest" title="'
        + that.i18n( "page" ) + '" value="" />'
        + '\n<input type="submit" name="post" value="'
        + that.i18n( "Enter") + '"/>'
        + '</form>\n'
      )
    }
  }

  // more FB or Twitter stuff
  if( fb_like || with_code ){
    var fb = ""
    var with_fb_xml = with_code
    // fb like or fb comments
    if( fb_like ){
      fb += '<a href="' + plink + '">' + this.i18n( "share" ) + '</a> ';
      // ToDo: should move this to html()
      this.setSessionData( "fbLike", true, page)
      // Let's assume that if fb like is ok, sharing with shareaholic is ok too
      if( SW.shkey ){
        // Note: if you want a different set of "default" bookmark, you get to install
        // Shareaholic's SexyBookmarks in your WordPress custom install or grab the
        // jquery.shareaholic-publishers-api.min.js from so site where what suits you
        // was configurer.
        // In addition to these 2 files, all the imagde from the image directory
        // of the zip file at http://sexybookmarks.shareaholic.com/ must also be
        // copied over into the current workding directory.
        // All of this must be done at "install time" and repeated whenever the
        // "SexyBookmarks" WordPress plugin from Shareaholic evolves.
        // I never said SimpliWiki was simple to setup, it is simple to use, ie by
        // "users", not developers ; but I will make my best to have it be simple
        // for developers too, not an easy task either.
        var title = this.getPageTitle( page)
        var SHRSB_Settings = {
          "shr-publisher-page":{
            "link": plink,
            "short_link": plink,
            "title": title,
            "notes": page.getBody(),//.substr( 0, 140), // Magic number
            "service":"7,5,2,3,38,257,201,52,88,202",
            "apikey": SW.shkey,
            "expand": true,
            //"src": "here2", //url,
            "localize": false,
            "rel": "nofollow",
            //"target": "_blank",
            "twitter_template":"${title} - ${short_link} (via @simpliwiki)",
            "mode": "inject", // Default to iframe
            "category": "Wiki"
          }
        }
        this.setSessionData( "shrsb", true, page)
        fb += '\n<div class="shr-publisher-page"></div><br>'
        + '\n<script type="text/javascript">'
        + '\n/* <![CDATA[ */\n'
        + "var SHRSB_Settings = " + Wiki.jsonEncode( SHRSB_Settings)
        + '\n/* ]]> */\n'
        + "</script>\n"
      }
      // ToDo: http://simpliwiki.com/jeanhuguesrobert@ should open my wiki
      // versus SimpliWiki root wiki as of today.
      //plink = plink.replace( "/HomePage", "/")
      // ToDo: compute a better width
      if( !that.facebookId ){
        if( !that.isIframe ){
          // ToDo: figure out a way to do that only when footer is displayed
          fb += '\n<div id="sw_fb_like_button"></div>'
          + '<script>var sw_fb_like_button_href = "'
          + Wiki.htmlizeAttr( plink)
          + '"</script>\n'
        }
      }else{
        // ToDo: fix this, there is an issue with @ where
        // apparently facebook get rid of whatever is after @
        // As a result: no comments on personal wikis...
        if( true || !page.fullname().includes( "@") ){
          fb += "<br>"
          //+ that.i18n( "Share:") + "<br>"
          //+ '<fb:like show_faces="true" font="verdana"></fb:like>'
          //+ "<br><br>"
          + that.i18n( "Comment:")
          + "<br>"
          + '<fb:comments numposts="20" publish_feed="true"'
          + ' xid="'   + encodeURIComponent( plink) + '" '
          + ' width="' + that.screenContentWidth + '" '
          + '>'
          + '</fb:comments><br>'
        }
        with_fb_xml = true
      }
    }else{
      this.setSessionData( "fbLike", false, page)
      this.setSessionData( "shrsb", false, page)
    }
    // Do I needed to call xfml? yes if either login or comment, not if just "like"
    if( with_fb_xml || with_code ){
      fb += '<div id="fb-root"></div>'
      + (with_code
        ? that.htmlScript( that.signinScript)
        : that.htmlScript( that.xfbmlScript))
      + (page.name != "SignIn"
        ? ""
        // Force display of footer on SignIn page
        : Session.htmlScript(
          "loadfire.event( function( fire ){"
          +  "if( !window.onFooterDisplay )return;"
          +  "onFooterDisplay( true, true);"
          +  "return true})"
        )
      )
    }
    foot.push( fb)
    // ToDo: QR code? http://chart.apis.google.com/chart?cht=qr&chs=150x150&chl='
    // +encodeURIComponent(top.location.href)+'&chld=H|0','qr','width=155,height=155')
  }

  // page info
  if( that.isCurator ){
    var info = function( page, msg ){
      var ctx = page.saveContext()
      if( msg ){ foot.push( "<br>" + msg) }
      foot.push( '<br>'
        + (ctx.draft ? "Draft: " : "Page: ") + ctx.name
        + " " + that.wiki.protoGuest.tooltip( page, true)
      )
      foot.push( '<br>'
        + "Last visitor: " + ctx.visitor
        + " " + that.wiki.protoGuest.timeLabel( ctx.timeVisited)
      )
      foot.push( '<br>'
        + "Last writer: " +  ctx.writer
        + " " + that.wiki.protoGuest.timeLabel( ctx.timeModified)
      )
      foot.push( '<br>'
        + "First writer: " + ctx.creator
        + " " + that.wiki.protoGuest.timeLabel( ctx.timeCreated)
      )
      page.isCold() && foot.push( "<br>" + that.i18n( "cold"))
      ctx.hot       && foot.push( "<br>" + that.i18n( "hot"))
      ctx.inherited && foot.push( "<br>" + that.i18n( "inherited"))
      if( ctx.visits ){
        // ToDo: wikify
        foot.push( "<br>" + that.i18n( "Visits: ") + ctx.visits)
      }
      if( ctx.backlinks ){
        // ToDo: wikify
        foot.push( "<br>" 
          + that.i18n( "Links: ") + ctx.backlinks.sort().join( ", ")
        )
      }
    }
    if( page.isDraft() ){
      info( page.nondraft)
    }
    info( page)
  }
  
  // Powered by...  computed in ... 
  var cpu = ""
  if( true || !De || that.isCurator || that.isDebug ){
    cpu = ' <dfn>'
    + (((new Date()).getTime() - that.dateLastAccess.getTime()) / 1000)
    + " sec." + (De ? " (debug mode)" : "" )
    + '</dfn'
  }
  if( true || !that.isPremium() ){
    foot.push(
      '\n<div id="powered">',
      // + that.i18n( "powered by ")
      '<a href="http://github.com/JeanHuguesRobert/simpli">',
      '<img src="/yanugred16.png"/>',
      '</a> <a href="http://simpliwiki.com">',
      '<strong>Simpl<em>i</em>Wiki</strong>',
      '</a>',
      //+ '<a href="http://chartaca.com/c5e0f38e-a3e2-427f-9d4b-654865bd6300">'
      //+ '<img src="http://chartaca.com/point/c5e0f38e-a3e2-427f-9d4b-654865bd6300/s.gif"/>'
      //+ '</a>'
      cpu,
      //+ ' <a href="http://simpliwiki.com/with.google">'
      //+   "Google"
      "</div>",
      // Add room so that scrollTo() works nicely when target is near end of page
      '<br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br>',
      '<br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br>'
    );
  }
    
  return [
    '\n<a name="bottom">&nbsp;</a><br><br>',
    '<div class="sw_fade" id="footer"><div id="footer_content">\n',
    foot.join( "" ),
    "</div></div>\n"
  ].join( "" );
}

Session.permalinkTo = function( page, isuser ){
  page || (page = this.getCurrentPage())
  if( !page.isDo()
  &&  (isuser || !page.isUser() )
  &&  (isuser || this.mayRead( page)) // Was this.protoGuest.mayRead()...
  ){
    var plink = this.wiki.permalink(
      page.name
    )
    return plink
  }
  return this.permalinkTo( this.wiki.homePage)
}
Session.declareIdempotentGetter( "permalinkTo")

Session.parentLinkTo = function( page ){
// ToDo: fix this, issue with shared proto guest
  page = page || this.wiki.homePage
  if( this.wiki.isRoot() )return this.permalinkTo( page)
  return this.wiki.permalink( page.name, "", this.wiki.parentWiki.fullname())
}
Session.declareIdempotentGetter( "parentLinkTo")

Session.cloneLinkTo = function( clonename, page ){
  page = page || it.wiki.homePage
  return this.wiki.permalink( clonename + "/" + page.name)
}

Session.isOther = function( session ){
  return session != this
}


Session.toolForm = function( page, view ){
// Builds partial view, tools part.
// This huge function builds the top menu.
// Its content depends on many factors, including who is
// logged in, what is the type of the current page...

  // No tools if embedded
  if( this.isOembed )return ""

  var wiki     = this.wiki
  var pagename = page.name
  var data     = page.getBody()
  var tools    = []

  var that     = this
  var it       = this

  function tool( item ){
    return tools.push( item)
  }

  // ************
  // left side of the top menu
  
  // Wiki, sub ones
  if( false && !page.isSpecial() ){
    var wikiname = pagename
    if( "Public".starts( wikiname) ){
      wikiname = wiki.substr( "Public".length)
    }
    tool(
      it.htmlA(
        "Wiki",
        Wiki.encode( pagename) + "/HomePage",
        //Wiki.encodeUrl( pagename + "/HomePage"),
        "Another wiki, maybe"
      )
    )
  }
  
  // parent wiki
  if( !it.wiki.isRoot()
  &&  !it.wiki.parentWiki.isRoot()
  &&  (!it.isAnonymous() || it.wiki.parentWiki.name.length > 2) // /fr, etc
  ){
    tool( it.htmlA(
      it.wiki.parentWiki.name,
      it.parentLinkTo( it.wiki.homePage),
      it.i18n( "Original wiki")
    ))
  }

  // Wiki's home
  var homelabel = Wiki.htmlize( this.wikiUserLabel())
  tool( it.link(
    this.wiki.homePage,
    (that.isWii ? "" : "<em>") + homelabel + (that.isWii ? "" : "</em>"),
    it.i18n( "This wiki's home page")
    + (" ("
      // Fullname, with no / at the end
      + it.wiki.fullname( SW.name, true)
    + ")") // .replace( " ()", "")
  ))
  
  // Curator
  if( (page == it.loginPage )
  && it.canCurator
  && !it.isCurator
  && !it.wiki.isUserWiki()
  ){
    var curatorclosure = it.registerClosure( function(){
      if( it.canCurator ){ it.isCurator = true }
      it.notify( it.i18n( "You are now in 'curator' mode"))
      it.notify( "AboutWiki    ")
      it.notify( "DoDrafts")
      it.notify( "DoMembers")
      it.viewForm( this)
    })
    tool( it.button(
      "curator",
      curatorclosure,
      it.i18n( "switch to 'curator' mode" )
    ))
  }
  
  // "AboutWiki", aka "Wiki settings"
  if( !it.wiki.isUserWiki()
  && ( it.isCurator
    || it.isDebug)
  ){
    tool( it.linkPage(
      "AboutWiki",
      it.i18n( "AboutWiki")
    ))
  }
  
  // Reset... ToDo: get rid of this?
  if( it.isCurator && it.isDebug ){
    tool( it.button(
      "Reset",
      it.resetClosure,
      it.i18n( "Reboot!" )
    ))
  }
  
  // Tools
  if( it.isCurator ){
    var curator_do = it.registerClosure( function( it ){
      it.doOnPage = page
      it.setCurrentPage( it.wiki.lookupPage( "PrivateTools"))
      it.viewForm( this)
    })
    tools.push( it.button(
      "tools",
      curator_do,
      it.i18n( "Some tools for power users" )
    ))
  }
  
  // changes & drafts
  if( page == "DoVisits"
  || (true  && page.isHome())
  || (false && page.isUser())
  || it.canCurator
  // Keep displaying "drafts" for a while once started
  || it.visitingDrafts
  ){
    var nstamps = it.wiki.stampsCount()
    if( nstamps > 1 ){
      tools.push( it.linkPage(
        "RecentStamps",
        nstamps + it.i18n( " stamps"),
        it.i18n( "Some recently stamped pages")
      ))
    }
    var with_codes = it.isCurator
    var ndrafts = it.wiki.draftsCount( with_codes)
    if( ndrafts > 0 ){
      // Only one, list it here
      if( ndrafts < 2 ){
        var draft
        // Find it
        it.wiki.forEachDraft(
          function( page ){
            draft = page
            return false
          },
          with_codes
        )
        if( !draft ){
          it.bug_de&&bug( "Single draft not found")
        }else{
          tools.push( it.link(
            draft,
            it.i18n( "1 draft"),
            draft.name + " " + it.tooltip( draft, true)
          ))
        }
      // Many drafts, invoke DoDrafts
      }else{
        tools.push( it.linkPage(
          with_codes ? "DoDraftsAndCodes" : "DoDrafts",
          ndrafts > 1 ? ndrafts + it.i18n( " drafts") : it.i18n( "1 draft"),
          it.i18n( "Some recent draft changes")
        ))
      }
      // Don't show option forever
      if( it.visitingDrafts ){ it.visitingDrafts-- }
    }else{
      it.visitingDrafts = 0
    }
  }else{
    
  }
  
  // Clones
  if( page.isHome()
  && !it.isAnonymous()
  && it.wiki.clonesCount() > 0
  ){
    tools.push( it.linkPage(
      "DoClones",
      "clones",
      it.i18n( "Some active cloned wikis")
    ))
  }

  // Visits
  if( (page.name == "RecentStamps" || page.isHome())
  && !it.isGuest()
  //  || (page.isHome() && !it.isAnonymous()))
  //&& it.wiki.recentSessionsCount() > 1
  ){
    var nvisits = 0
    // ToDo: optimize this?
    //wiki.forEachSession( function( session ){
      // Skip bots
    //  if( session.isBot )return
    //  nvisits++
    //})
    // Display recent sessions & older guest visitors too
    if( true || nvisits > 1 ){
      tools.push( it.linkPage(
        "DoVisits",
       // nvisits + " "
       it.i18n( "visits"),
        "Some recent visitors")
      )
    }
  }
  
  // Members
  if( page == "DoVisits" ){
    // ToDo: Dont display members in overcrowded pages
    var nmembers = it.wiki.membersCount()
    if( nmembers > 1 || (it.isGuest() && nmembers > 0) ){
      tools.push( it.linkPage( 
        "DoMembers",
        nmembers >  1
        ? nmembers + it.i18n(" members")
        : it.i18n( "1 member"),
        "Some recent visiting members"
      ))
    }
  }
  
  // ******************
  // ToDo: center section of the top menu
  tools.push( "center")

  // Edit
  // ToDo: Session.editClosureCache management
  var canedit = it.mayEdit( page)
  var editclosure = null
  if( canedit && view != "edit" ){
    editclosure = it.registerClosure( function( it ){
      it.setCurrentPage( page)
      it.editForm( this)  
    })
    it.editClosure = editclosure
    // Displayed when necessary, avoid confusing guests
    if( it.isGuest()
    || true // Always display, fixes issue with embed.ly pages
    || !it.canScript
    ||  it.canScript == "maybe"
    ||  it.isTouch
    ){
      // Just the icon or less confusing icon + "edit" for accidental visitors
      tools.push( it.button(
        '<span class="glyphicon glyphicon-edit"></span>'
        + ((it.wiki.isEmpty() || (it.isAnonymous() && it.isGuest() && !it.user))
          ? it.i18n( "edit" ) : ""),
        editclosure, 
        it.i18n( "write your text on the page" )
      ))
    }
  }
  
  // Restore
  if( page.isRestore() ){
    tools.push( it.button( 
      "<em>Restore</em>",
      it.registerClosure( function( it ){
        var rpage = it.restorePhase2( page)
        if( rpage ){
          it.setCurrentPage( rpage)
        }
        it.viewForm( this)
      }),
      it.i18n( "restore page content using this copy" )
    ))
  }
  
  // Stamp, on draft pages
  if( canedit
  && page.isDraft()
  && !it.isGuest()
  ){
    tools.push( it.button(
      "stamp",
      it.registerClosure( function( it ){
        // This is a hack, to reuse code in postForm()
        it.postForm( this, page, null, null, it.i18n( "Stamp"))
      }),
      it.i18n( "accept draft change" )
    ))
  }

  // Trash
  if( page.isDraft()
  // && canedit
  && (!page.isUser() || canedit)
  ){
    tools.push( it.button(
      "trash",
      it.registerClosure( function( it ){
        it.trash( page)
        it.viewForm( this)
      }),
      it.i18n(  "remove draft changes, restore stamped original page" )
    ))
  }

  // Do, for #! content
  if( it.isCurator && data && "#!".starts( data) ){
    var doclosure = it.registerClosure( function( it ){
      it.setCurrentPage( it.wiki.lookupPage( "Do" + pagename))
      it.viewForm( this)
    })
    tools.push( it.button( "do", doclosure))
  }

  // Do, for ToDo pages
  // ToDo: UserToDo pages
  if( page.isToDo() ){
    var do_cmd = page.getToDo()
    if( do_cmd ){
      var doclosure = it.registerClosure( function( it ){
        it.setCurrentPage( it.wiki.lookupPage( do_cmd))
        it.doOnPage = page
        it.viewForm( this)
      })
      tools.push( it.button( "do", doclosure))
    }
  }

  // source, for Html pages & Angular apps
  if( page.isDo()
  && ("DoAngular".starts( pagename)
    || "DoHtml".starts(   pagename))
  ){
    tools.push( it.linkPage(
      pagename.substr( "Do".length),
      it.i18n( "source code")
    ))
  }
  if( page.kindIs( "Angular") ){
    tools.push( it.linkPage(
      "Do" + pagename,
      it.i18n( "run")
    ))
  }

  // Fetch, for proxy pages
  if( page.isProxy() ){
    var doclosure = it.registerClosure( function( it ){
      var url = page.getProxy().replace( "result-", "") + "\n"
      // Hack. I restore a valid "protocol" for fetching
      page.body = url + page.body
      it.setCurrentPage( page)
      it.viewForm( this)
    })
    tools.push( it.button( "fetch", doclosure))
  }
  
  //if( "Html".starts( pagename) ){
  //  var htmlname = pagename.substr( 4) + ".html";
  //  page += " | " + it.htmlA( "Html", htmlname);
  

  // Compress changes, on stamp pages
  if( page.isStamps() ){
    var show_compress = true
    // Compress "RecentStamps" is for curators only unless very open
    if( page.name == "RecentStamps" && !it.canCurator ){
      show_compress = it.wiki.isVeryOpen()
    }
    // Don't show the option if small changes, disturbing at first
    if( show_compress && !it.isCurator ){
      if( data.length < 700 ){
        show_compress = false
      }
    }
    // Don't show the option if nothing to compress
    if( show_compress ){
      var two_changes = new RegExp( SW.datePattern + "[^*]*" + SW.datePattern)
      show_compress = two_changes.test( data)
    }
    if( show_compress ){
      var compressclosure = it.registerClosure( function( it ){
        var req = this
        it.compressStamps( page, function( err, page ){ it.viewForm( req) })
      }) 
      tools.push( it.button(
        it.i18n( "compress"),
        compressclosure,
        it.i18n( "Keep last changes only")
      ))
    }
  }
  
  // Trash all (for curators only)
  if( page.name == "DoDrafts"
  && (it.isCurator
    || (it.canCurator && it.wiki.draftsCount()))
  ){
    tools.push( it.linkPage(
      "DoClearAllDrafts",
      it.i18n( "clear all drafts")
    ))
  }
  
  // Cool
  if( (page.isStamps()
    || page.name == "PrivateCodes"
    || page.name == "DoVisits")
  && (!it.isGuest() || it.wiki.isVeryOpen() )
  ){
    var hot
    var hot_mtime
    var mtime
    // Look for the older hot page
    for( var link in page.links ){
      link = page.links[link]
      if( link.isHot( true)
      && !link.isDraft()
      ){ // true => ignore recent visitors
        mtime = link.timeModified()
        || link.timeVisited()
        || (Sw.timeNow - 365 * 24 * 3600 * 1000)
        if( !hot
        ||  mtime < hot_mtime
        ){
          hot = link
          hot_mtime = mtime
        }
      }
    }
    if( hot ){
      var age = Sw.timeNow - hot_mtime
      var limit = Sw.timeNow - age
      if( age > (15 * 24 * 3600 * 1000) ){
        limit = Sw.timeNow - age / 2
      }else if( age > (48 * 3600 * 1000) ){
        limit = hot_mtime + (24 * 3600 * 1000)
      }else if( age > (2 * 3600 * 1000) ){
        limit = hot_mtime + (1 * 3600 * 1000)
      }else if( age > (10 * 60 * 1000) ){
        limit = hot_mtime + (5 * 60 * 1000)
      }
      tools.push( it.button(
        "cool",
        it.registerClosure( function( it ){
          for( var link in page.links ){
            link = page.links[link]
            if( link.isHot( true)
            && !link.isDraft()
            ){
              mtime = link.timeModified()
              || link.timeVisited()
              || (Sw.timeNow - 365 * 24 * 3600 * 1000)
              if( mtime <= limit ){
                link.clearHot()
              }
            }
          }
          // Leave a trace. ToDo: should log a msg?
          page.setWriter( it.userName())
          it.viewForm( this)
        }),
        it.i18n( "Fade older changes, up to ") + it.timeLabel( limit)
        + (!it.isCurator ? "" : it.i18n( ". Older: ") + hot.name + ", "
          + it.timeLabel( hot_mtime)
        )
      ))
    }
  }

  // *****************
  // The other items will be styled to be displayed on the right
  tools.push( "right")
  
  // User stamps
  if( page.isUser() && !it.isGuest() ){
    tools.push( it.linkPage( it.userWikiName() + "Stamps",
      "stamps",
      "Some pages you changed recently in this wiki"
    ))
    // ToDo: my wiki
  }
  
  // Your wikis
  if( (true || page == it.loginPage || it.wiki.isUserWiki())
  && (it.hasUser() || !it.isJustHere())
  ){
    // Signal User conflict, only in curator mode, can be frightening
    var conflict = (it.hasTwoUsers() && it.isCurator) ? "!" : ""
    var label = it.getPlausibleName()
    tools.push( it.linkPage(
      "DoProfile",
      conflict +  (this.isWii ? "wikis" : '<img src="/yanugred16.png" alt="wikis" />'),
      it.i18n( "Your wikis") + " (" +  label + ")"
    ))
  }

  // Dropbox
  if( (true || page == it.loginPage || it.wiki.isUserWiki())
  && it.dropbox && it.dropbox.token
  ){
    var label
    = it.dropbox.email || (this.user && this.user.getMailId()) || ""
    tools.push( it.linkPage(
      "DropBox",
      '<img src="/dropbox_ico.png" alt="dropbox"/>',
      it.i18n( "Your dropbox") + " (" +  label + ")"
    ))
  }

  // Twitter icon
  if( !this.isKudocracy ){
    var twitter = this.user && this.user.getTwitterId()
    if( twitter ){
      var name = this.twitterName || User.extractName( twitter)
      name && tool( this.htmlA(
        '<img src="/twitter_ico.png" alt="twitter"/>',
        'http://twitter.com/' + name,
        it.i18n( "Your Twitter account") + " (" + name + ")"
      ))
    }
  }

  // Mail account, for some well known providers
  var mail = this.user && this.user.getMailId()
  if( mail ){
    var ii = mail.indexOf( "@")
    var domain = mail.substr( ii + 1)
    var name   = mail.substr( 0, ii)
    ii = domain.indexOf( ".com")
    var provider = ii > 0 ? domain.substr( 0, ii) : provider
    var provider_ico = "mail"
    // In most cases, I don't know the vanity url
    if( ['gmail'].indexOf( provider) > -1 ){
      // !
    }else{
      name = ""
    }
    // In most cases, I don't know the icon either
    if( ['gmail','yahoo'].indexOf( provider) > -1 ){
      provider_ico = provider
    }
    if( "yahoo.".starts( domain) ){
      domain = "mail." + domain
    }
    if( provider ){
      tool(
        it.htmlA(
         '<img src="/' + provider_ico + '_ico.png" alt="' + provider + '"/>',
         'http://' + domain + '/' + name,
         it.i18n( "Your email account") + " (" + mail + ")"
        )
      )
    }
  }

  // login name
  // If anonymous entered wiki via the HomePage... display "sign in"
  if( it.loginPage.isHome() && it.isAnonymous() ){
    // Don't display, useless when anonymous logged in via HomePage
    if( true // it.isAnonymous()
    && !it.wiki.isEmpty()	// Remove noise
    && !it.wiki.isSandbox
    && true // !it.wiki.isRoot()
    && !it.isKudocracy // No "sign in", login must be kudocracy initiated 
    ){
      // Display "sign in" page instead
      tools.push( it.linkPage(
        "SignIn",
        it.i18n( "sign in"),
        it.i18n( "sign in") // ToDo: better msg
      ))
    }
  // If anonymous guest wandering around... "sign in"
  }else if( it.isGuest() && it.isAnonymous() ){
    if( !it.isKudocracy ){
      tools.push( it.linkPage( "SignIn" ) );
    }
  // If special user wiki, display twitter  name
  }else if( it.wiki.isUserWiki() && !it.isDebug ){
    // Some /user/Fxxxx wiki, use twitter name
    var name
    = it.twitterName
    || it.wikiId
    || "???"
    if( name ){
      tools.push( "<em>" + name + "</em>" )
    }
  // If "normal" case, display either login name or "home" for entry page
  }else if( !it.isAnonymous() 
  || it.getCurrentPage() != it.loginPage
  ){
    // Not when Kudocracy
    if( !it.isKudocracy ){
      // Display name and link to login page
      var label = it.isAnonymous()
      ? it.i18n( "home") // ToDo: '<img src="/home.png" alt="home"/>')
      : "<em>" + it.getPlausibleName() + "</em>"
      var tooltip = it.i18n(
        (it.isAnonymous() || it.isGuest())
        ? "Your entry page"
        : "Your personal page in this wiki"
      ) + " '" + this.wiki.getLabel( this) + "'" // ToDo: issue encoding "
      tooltip += " (" + it.i18n( it.loginPage.name) + ")"
      if( it.isGuest() && !it.isAnonymous() ){
        if( label.includes( "Guest") ){
          label = label.replace( "Guest", "(" + it.i18n( "guest") + ")")
        }else{
          label += "(" + it.i18n( "guest") + ")"
        }
      }
      tools.push( it.link( it.loginPage, label, tooltip))
    }
  }

  // Bye
  if( !it.isKudocracy || it.isCurator ){
    tools.push( it.button(
      it.isCurator ? "curator bye" : "bye",
      it.byeClosure,
      it.isGuest()
      ? SW.domain
      : it.i18n( "sign out") + " (" + it.i18n( it.loginName) + ")"
    ));
  }
  
  // Aa, unless fluid mode or touch device or empty wiki / small page (avoid noise)
  if( !it.config.rows == 0
  && !it.isTouch
  && !it.wiki.isEmpty()
  && page.getBody().length > 100
  && !it.wiki.isSandbox // Don't confuse new visitors
  //&& !it.isAnonymous()
  ){
    var done = false
    // ToDo: should define this once per session
    var shorterclosure = it.registerClosure( function( it ){
      if( done ) return
      done = true
      if( it.twoColumns ){
        it.de&&bug( "Zoom in, remove one column")
        it.twoColumns = false
      }else{
        it.doPage( "DisplayShorter")
        // Force single column mode
        it.twoColumns = false
      }
      it.viewForm( this)
    })
    var tallerclosure = it.registerClosure( function( it ){
      if( done ) return
      done = true
      if( !it.twoColumns && it.config.twoPanes ){
        it.de&&bug( "Zoom out, add a column")
        it.twoColumns = true
      }else{
        it.doPage( "DisplayTaller")
        if( !it.twoColumns && it.config.twoPanes ){
          // Force two column mode
          it.twoColumns = true
        }
      }
      it.viewForm( this)
    })
    if( !page.maxCols || it.twoColumns ){
      if( it.config.rows > 10 ){
        tools.push( it.button(
          '<span class="glyphicon glyphicon-zoom-in"></span>',
          shorterclosure,
          it.i18n( "zoom in" ) 
          // + " (" + it.config.rows + "x" + it.config.cols + ")"
        ))
      }
    }
    if( !page.maxCols || !it.twoColumns ){
      if( it.config.rows < 100 || it.isKudocracy ){
        tools.push( it.button(
          '<span class="glyphicon glyphicon-zoom-out"></span>',
          tallerclosure,
          it.i18n( "zoom out" )
          // + " (" + it.config.rows + "x" + it.config.cols + ")"
        ))
      }
    }
  }
  
  // Help
  if( true || it.isGuest() || page.isHome() || page == it.loginPage ){
    var help_page = it.lookup( "Help" + page.name, "Help" + SW.name)
    tools.push( it.link( 
      help_page,
      '<span class="glyphicon glyphicon-question-sign"></span>',
      "Some help, maybe")
    )
  }

  var sep = (it.canScript === true) ? "&#149;" : "|" // "&thinsp;" "&puncsp;" "&ensp;"
  return [
    '\n<div class="header sw_fade" id="header"><div id="header_content">',
    '<div id="top_left">\n',
    tools.join(
      "|"
    ).replace(
      "|center|",
      '</div>\n<div id="top_center" id="top_center">|'
    ).replace(
      "|right|",
      '|</div>\n<div id="top_right">'
    ).replace( /\|/g, sep),
    !data || this.isIframe ? "" : '\n<a href="#bottom">&darr;</a>', // Arrow to scroll
    '</div></div></div>\n',
    '<div id="unfadder"><span class="glyphicon glyphicon-menu-hamburger"></span></div>'
  ].join( "")
}


Session.processPost = function( req, page ){
  var text = ""
  var verb = ""
  var guest = ""
  var qs
  var that = this
  this.de&&mand( req.method == "POST", "not a post")
  if( req.repost ){
    this.post_de&&bug( "Process request from parent wiki")
    var redo = req.repost
    // req.reposted = null
    redo.call( that)
    return
  }
  this.post_de&&bug( "Listen for POST data, R:", req.deId)
  NDe&&bug( Sys.inspect( req))
  if( De ){
    if( req.bug ){
      this.bug_de&&bug( "BUG: same POST request again")
    }
    req.bug = true
  }
  req.setEncoding( "utf8")
  req.addListener( "data", function( post ){
    if( post ){
      text += post
    }else{
      this.bug_de&&bug( "No data in post?")
    }
  })
  req.addListener( "end", function(){
    this.post_de&&bug( "Receive POST data, R:", req.deId)
    qs = QueryString.parse( text)
    // Weird, I need a toString() because these beasts are not strings...
    NDe&&bug( "Weird QueryString ", Sys.inspect( text))
    NDe&&bug( "Gives: ", Sys.inspect( qs))
    // Update: when same parameter appears multiple times in query...
    // QueryString.parse() builds a list.
    text  = (qs.text  || "").toString()
    verb  = (qs.post  || "").toString()
    guest = (qs.guest || "").toString()
    that.deep_post_de&&bug( "Received POST body:", Sys.inspect( qs))
    req.repost = function(){
      this.postForm( req, page, text, guest, verb, qs)
    }
    req.repost.call( that)
  })
}


// -- Wikify with http://simpliwiki.com --
// Instapaper loader is:
//javascript:function iprl5(){
//var d=document,
//z=d.createElement('scr'+'ipt'),
//b=d.body,
//l=d.location;
//try{
//  if(!b)throw(0);
//  d.title='(Saving...) '+d.title;
//  z.setAttribute('src',l.protocol+'//www.instapaper.com/j/EGF5FXDc567k
//  ?u='+encodeURIComponent(l.href)
//  +'&t='+(new Date().getTime()));
//  b.appendChild(z);
//}catch(e){
//  alert('Please wait until the page has loaded.');
//}}iprl5();void(0)
// See also Read It Later

// Warning: this gets minimized in a weird way (by me), please don't
// put any comment and use ; to terminate lines
Session.wikifyItScript =  function SimpliWiki(){
  var form = document.createElement( "div");
  var location  = window.location.href;
  var title     = document.title;
  var selection = (window.getSelection
  ? window.getSelection()
  : (document.getSelection
    ? document.getSelection()
    : (document.selection
      ? document.selection.createRange().text
      : null)
    )
  );
  var query = "http://simpliwiki.com";
  form.innerHTML = '<form'
  + ' action="' + query + '"'
  + ' method="POST"'
  + ' accept-charset="utf-8"'
  + '>'
  + '<input type="hidden" name="guest">'
  + '<input type="hidden" name="post" value="add">'
  + '<input type="hidden" name="url"    value="'
    + encodeURIComponent( location)  + '">'
  + '<input type="hidden" name="title"  value="'
    + encodeURIComponent( title)     + '">'
  + '<input type="hidden" name="select" value="'
    + encodeURIComponent( selection) + '">'
  + '</form>';
  var val = prompt( 'SimpliWiki.com', title);
  if( !val )return;
  form.firstChild.firstChild.value = val;
  var body = document.getElementsByTagName( 'body')[0];
  body.appendChild( form);
  form.firstChild.submit();
}
// On firefox I need to add the element to fire .submit()
// On chrone it's not needed...


Session.postForm = function( req, page, text, guest, verb, query ){
// Called to handle "POST" http requests

  this.de&&mand( req.response, "no response" )
  var that = this
  if( this.isGone ){ return }

  // Double check that the post is really about the page it pretends
  // to be, maybe the current page changed
  if( query ){
    // Check if the current page changed since when the <form> was built
    if( !query.postpage ){
      this.bug_de&&bug( "missing postpage in posted query")
      // ToDo: the bookmarklet gets here...
      page = that.lookup( "ScratchPage")
    }else if( query.postpage != page.name ){
      this.de&&bug( "current page:", page, "vs query.postpage:", query.postpage)
      page = that.lookup( query.postpage)
    }
  }

  // Some basic spam protection
  // ToDo: see http://defensio.com/what-is-it
  var is_spam = false
  var age = Sw.timeNow - that.timeLogin
  if( that.isGuest()
  && (age < 10000)
  // Protect "attractive" pages even more
  || (age < 20000
    && " SignIn ".includes( " " + page.name + " "))
  ){
    is_spam = true
    page = this.setCurrentPage( this.lookup( "SpamPage"))
    text = text + "\n\n" + "HTTP request:" + Sys.inspect( req.url)
    + "\nHeaders: " + Sys.inspect( req.headers)
  }
  // Never write in C2 demo wiki
  if( that.wiki.name == "c2" ){
    is_spam = true
  }

  var pagename = page.name

  // I used to do: this.fixVisit( page)
  // But I don't now, because it's not a "true" visit and I don't want
  // to increase the visit count twice

  // Redirect to SignIn if user got to some page she cannot access
  if( !this.canRead( page) ){
    this.bug_de&&bug( "user:", this.userName(), "cannot read:", page)
    this.setCurrentPage( this.lookup( "SignIn"))
    return this.viewForm( req)
  }
  
  // Remember last visit to the wiki.
  // This info is not stored immediately, helps avoid excessive writes
  this.wiki.lastSession = this
  this.wiki.dateLastSession = Sw.dateNow
  
  this.de&&bug(
    "post, verb:", verb,
    "page:" + page,
    "query:", query ? "yes" : "none"
  )
  if( req.logAgain ){
    this.de&&bug( "process POST again after changed login")
  }
  
  var verb_is_wiki    = (verb == "wiki!") || (verb == "wiki !")
  var verb_is_enter   = (verb == "Enter") || (verb == that.i18n( "Enter"))
  var verb_is_add     = (verb == "add")
  var verb_is_doit    = (verb == "DoIt")
  var verb_is_stamp   = verb == that.i18n( "Stamp")
  var verb_is_copy    = verb == that.i18n( "Archive")
  var verb_is_cancel  = verb == that.i18n( "Cancel")
  var verb_is_delete  = verb == that.i18n( "Delete")
  var verb_is_draft   = verb == that.i18n( "Draft")
  var verb_is_restore
  = verb == that.i18n( "History") || /.*tablir/.test( verb)
  var then_go         = ("Go".starts( verb) && verb.substr( 2))
  
  if( !verb || verb_is_cancel ){
    that.setCurrentPage( page)
    return that.viewForm( req)
  }
  
  // ToDo: figure out a better way to discard old post requests
  if( !is_spam
  && this.postExpected != page.name 
  // && this.postExpected === false
  && !verb_is_enter
  && !verb_is_wiki
  && !verb_is_add
  ){
    // The logic to avoid double submits of same post bombs
    this.bug_de&&bug( "Unexpected Post, expected: ", this.postExpected)
    this.postExpected = false
    return that.viewForm( req)
  }
  if( !verb_is_add && !verb_is_enter && !verb_is_wiki ){
    this.postExpected = false
  }

  // Get additional text from query maybe
  if( query ){
    // this.de&&bug( "query:", Sys.inspect( query))
    var some_query
    var title = query.title ? decodeURIComponent( query.title) : ""
    if( guest && title ){
      title = guest
      guest = ""
    }
    if( title ){
      some_query = true
      text += "\n++" + title
    }
    if( query.select ){
      some_query = true
      text += '\n"' + decodeURIComponent( query.select) + '"'
    }
    if( query.url ){
      some_query = true
      text += "\n  " + decodeURIComponent( query.url)
      .replace( "http://", "")
    }
    if( some_query ){
      text += "\n" + " - " + Sw.dateNow.toISOString() + "\n"
      this.de&&bug( "some text from query")
    }
  }
  
  // Get rid of CR. There must NEVER NEVER be any CR coming from an user input
  // Note: I use CR as a special delimiter in page's content, to save the ctx
  text  = (text  ? text  : "").replace( /\r/g, '')
  guest = (guest ? guest : "").replace( /\r/g, '')
  
  // Deal with the "enter" & "wiki!" inputs
  if( verb_is_enter || verb_is_wiki ){
    // "guest" parameter takes over "text" one
    if( guest ){
      text  = guest
      guest = text
    }
    // Defaults to HomePage of session's wiki...
    if( !text || text == "a wiki" || text == "un wiki" || text == "secret" ){
      // ... unless it is a better idea to go to some other wiki
      if( that.wiki.isRoot() && verb_is_wiki ){
        // A wiki will get to identified user's wiki, if user was identified
        // 2014 removal of "secret"
        if( (true || text !=  "secret")
        && ( "@".starts( that.userName())
          //  || "@".ends(   that.userName())
          //  || "In".ends(  that.userName())
          )
        ){
          text = that.userName()
        // Or else... brand new random wiki
        // 2014, no more randomly name wikis
        }else{
          // text = Wiki.random3Code( "-")
          text = "";
        }
      }else{
        that.setCurrentPage( that.wiki.homePage)
        return that.viewForm( req)
      }
    }
    // Sanitize
    text = text.frontLine()
    var mail = that.wiki.sanitizeMail( text)
    text = that.wiki.sanitizePath( text)
    // Get rid of "HomePage" that sanitizePath() maybe added
    text = text.replace( /\/HomePage$/, "")
    that.de&&bug( "verb:", verb, "text:", text)
    // If entering a wiki, defaults to its homepage
    if( verb_is_wiki ){
      if( text && text.indexOf( "/") < 0 ){
        text += "/HomePage"
      }
    }
    // Get target sub wiki, unless done before for this request
    var targetwiki = req.wiki ? this.wiki : this.wiki.lookupWiki( text)
    var ii = text.lastIndexOf( "/")
    if( ii >= 0 ){
      text = text.substr( ii + 1)
      De&&bug( "Got rid of wiki name, text: ", text)
    }
    
    // If intra wiki...
    if( targetwiki == this.wiki ){
      // on a user page, maybe set mail or lookup map (or code)
      if( page.isUser() && !req.wiki ){
        // If email, this is the mail of the user itself
        if( mail ){
          De&&bug( "User changes her/his mail address")
          // ToDo: should sent mail, both to previous and new address
          text = that.registerMailAddress( mail)
          this.setData( page, "email", mail, true)  // true => don't flush
          // Else, maybe it is a Map or a valid page name
        }else if( /\d/.test( text)
        && text.toLowerCase() == text
        ){
          that.setCurrentPage( that.wiki.lookupPage( 
            text ? that.wikinamize( text, "Map") : "HomePage"
          ))
          text = ""
        }
      }
      // On most pages, but user pages
      if( text ){
        // if email, this is a user willing to retreive his code
        if( mail ){
          var usermailpage = that.usernamize( mail)
          De&&bug( "Mail page: ", usermailpage)
          that.lookup( usermailpage).read(
            function( err, mailpage ){
              var user = err ? null : mailpage.getFirstUser()
              if( !user ){
                De&&bug( "No mail page ", mailpage.getBody())
                that.setCurrentPage( that.lookup( that.i18n( "HelpNoSuchEmail")))
                return that.viewForm( req)
              }
              De&&bug( "Found user ", user, " in ", mailpage.getBody())
              var users = mailpage.getUsers()
              // ToDo: for each user
              var firstuser = user
              var userpagename = that.usernamize( firstuser)
              De&&bug( "Mail. Looking for ", user , ": ", userpagename)
              that.lookup( userpagename).read( function( err, userpage ){
                var mail = that.getData( userpage, "email")
                if( !mail ){
                  that.setCurrentPage( that.lookup(
                    that.i18n( "HelpNoSuchUser")
                  ))
                  return that.viewForm( req)
                }
                var to = text
                De&&bug( "Should sent mail here to ", to )
                // ToDo: change to proper "from"
                var from = "info@" + SW.domain
                var subject = "Hello"
                var body = [
                  firstuser,
                  that.wiki.permalink( userpagename ),
                  that.wiki.permalink( "HomePage" ),
                  SW.protocol + SW.domain
                ].join( "\n")
                De&&bug( "Body: ", body)
                that.sendMail( to, subject, body)
                var firstuserpagename = that.wikinamize( firstuser)
                that.setCurrentPage( that.lookup( firstuserpagename))
                that.viewForm( req)
              })
            }
          )
          return this
        }
        // Or this is a search
        if( text ){
          text = "DoSearch" + "[" + text + "]"
        }
        that.setCurrentPage( that.wiki.lookupPage(
          text ? that.wikinamize( text) : "HomePage"
        ))
      }
      return that.viewForm( req)
    }
    
    // If sub wiki
    that.de&&bug( "Go to subwiki:", targetwiki, "fromText:", text)
    // ToDo: should logout?
    // I need to warn processHttpRequest() about the fact that the request
    // was partially processed already. This is specially needed
    // for "POST" requests, because the content of body must not
    // be expected twice from the network, it is sent once only obviously
    De&&mand( req.wiki != targetwiki )
    req.wiki = targetwiki
    return targetwiki.processHttpRequest( req)
  } // end of "enter" & "wiki!" verbs

  // Use "guest" parameter, unless already done (ie relog)
  // Set title of anonymous wiki
  var should_ask_for_title = false  
  if( !req.logAgain
  && (should_ask_for_title = that.shouldAskForWikiTitle( page))
  ){
    // This is handled later on when a message is logged
    if( guest ){
      guest = Wiki.sanitizeName( guest)
      that.de&&bug( "Will set wiki title:", guest)
    }
  
  // Use provided name if guest or anonymous curator
  }else if( !req.logAgain
  && !verb_is_delete
  && ( this.shouldAskForName( page)
    || this.shouldAskForNewMember( page)
    || (!that.isCurator
      && (page.name == "NewPage" || page.name == "NouvellePage"))
    )
  ){
    that.de&&bug( "Looking for a name")
    // Sanitize guest, turn it to CamelCase if possible
    guest || (guest = "")
    if( guest ){
      guest = Wiki.sanitizeName( guest)
      var camelcase = guest
      .split( /[\s-']/g) // Space, ' and - are delimiters, removed
      .map( function( it ){ return it.capitalize() })
      .join( "")
      // Keep camel case version as long as it looks ok
      if( SW.wikiword.test( camelcase) ){
        guest = camelcase
      // Else use a free link
      }else{
        guest = "[" + guest + "]"
        if( !SW.wikiword.test( guest) ){
          // guestnamize() will do its best, see below
        }
      }
      // Don't handle twitter  names here, too complex, ToDo
      if( "@".starts( guest) ){
        // Unless it's the "NewMember" special page
        if( !this.shouldAskForNewMember( page) ){
          // I could filter out such names, I prefer not to, it's more
          // flexible this ways and does not provide a false sense of security
          // guest = "[" + guest.replace( /@/g, "") + "]"
        }
      }
    }
    if( guest ){
      // When anonymous guest sets her name
      if( this.isGuest() ){
        guest = this.guestnamize( guest)
        if( guest && guest != this.userName() ){
          this.login_de&&bug( "lessAnonymousGuest:", guest)
          this.isGuestMember = true
          this.logGuest( guest)
          // If this is the first time that a non anonymous visitor logs in
          // then it might be time to close a little a brand new wiki
          // but only after she uses her code or is authenticated
          if( this.wiki.isVeryOpenByDefault() ){
            this.login_de&&bug( "claimable by:", guest)
            guest = this.membernamize( guest)
            if( req.logAgain != guest ){
              req.logAgain = guest
              // Login with new identity
              // Note: this will reenter postForm()
              return this
              .loginForm( guest, this.canCurator, page, req)
            }else{
              this.de&&bug( "Avoid loop with guest name:", guest)
            }
          }
        }
        guest = ""
      // When anonymous curator (ie SomeOne) sets her name
      }else if( this.isAnonymous() ){
        guest = this.usernamize( guest).substr( "User".length)
        guest = this.wikinamize( guest, null, "One")
        if( guest && guest != this.userName() ){
          this.login_de&&bug( "lessAnonymousMember:", guest)
        }
        // If valid name (i.e. not guest) then login again with new name
        if( this.logMember( guest) ){
          if( req.logAgain != guest ){
            req.logAgain = guest
            // Login with new identity
            // Note: this will reenter postForm()
            return this.loginForm( guest, this.canCurator, page, req)
          }else{
            this.de&&bug( "Avoid loop with member name:", guest)
          }
        }
        guest = ""
      }
    } // end of if guest
  }
   
  // Deal with unexpected comment
  if( guest && that.shouldAskNothing( page) ){
    that.bug_de&&bug( "Unexpected comment:", guest)
    // Don't trash user input if any, add it to page's content instead
    if( !text ){ text = guest }else{ text = text + "\n" + guest }
    guest = ""
  }
  
  // Delete, unless the presence of a comment is a clue that this is a mistake
  if( verb_is_delete && !guest ){
    De&&bug( "Deleting ", page)
    if( !this.canDelete( page) ){ return that.viewForm( req) }
    return this.deletePage( page, function(){ that.viewForm( req) })
  }

  // Restore  
  var wasdraft = page.isDraft()
  if( verb_is_restore ){ // ToDo: i18n issue
    // Restore draft page
    if( page.isDraft() ){
      that.de&&bug( "Restore, from draft:", page)
      that.trash( page)
      that.setCurrentPage( page)
      return that.viewForm( req)
    }
    // Restore deleted page (curator only)
    De&&bug( "Restore on ", page)
    if( (page.isDeletion() || "Deleted".starts( page.getBody().frontLine()))
    && that.isCurator
    ){
      that.de&&bug( "Restore undelete page:", page)
      // ToDo: issue with redirect
      // req.isRest = true
      return that.undeletePage( page, function(){ that.editForm( req) })
    }
    // Restore from copy
    if( this.canRestore( page) ){
      that.de&&bug( "Restore, from copy:", page)
      // ToDo: issue with redirect in respond
      // req.isRest = true
      return that.restorePhase1( function(){ that.viewForm( req) })
    }
    // Restore from inherited page
    // ToDo:
    return that.viewForm( req)
  }

  // Draft
  if( verb_is_draft ){
    De&&bug( "post is Drafting ", page)
    this.draft( page)
  }

  // Stamp
  if( verb_is_stamp ){
    this.stamp( page, false) // false => don't write, done later on
  }
  
  // I usualy don't want ToDo pages to be modified permanently
  if( verb_is_doit ){
    // Let's save the data that the "Do" page needs
    var doit_data = Wiki.extractBasicYaml( text)
    if( doit_data && !that.isCurator && !page.isDraft() ){
      // ToDo: don't draft if no change (besides data)
      page.draft()
    }
  }
  page.read( function( err, page ) {
  
  if( !that.canEdit( page) ){
    De&&bug( "Cannot edit ", page)
    that.setCurrentPage( page)
    return that.viewForm( req)
  }
  var old_text = page.getBody()
  if( !old_text ){ old_text = "" }
  if( !text ){ text = old_text }
  if( !text ){ text = guest }
  if( !text ){ text = that.i18n( "blank page") }
  // Always \n terminated
  if( text && text.charAt( text.length - 1) != "\n" ){
    text += "\n"
  }
  if( verb_is_add ){
    text = old_text.replace( /\n+$/, "\n") + text.replace( /^\n+/, "\n")
  }
  // Leave a trace
  var should_log = !verb_is_doit
  // Curators leave a trace only when stamping a non draft page and
  // doing no other change. i.e. explicitly stamping of stamped page
  if( that.isCurator
  && !(verb_is_stamp && !wasdraft && text == old_text) 
  ){
    should_log = false
    that.deep_session_de&&bug( "No log in curator mode")
  }
  if( should_log ){
    var date = new Date()
    should_log = (guest ? " " + guest : "") + " - " + date.toISOString()
    // Add trace to the page content, later I add to xxxStamps
    // ToDo: some more filtering?
    if( guest
    || page.lastWriter() != that.loginName
    || Sw.age( page.timeModified()) > (24 * 3600 * 1000)
    || verb_is_stamp
    ){
      NDe&&bug( "Previously: ", text.substr( -50))
      NDe&&bug( "Previous old text: ", old_text.substr( -50))
      // Add a new line if last line is not a similar message already
      var tmp = text;
      while( tmp && tmp[ tmp.length - 1 ] === "\n" ){
        tmp = tmp.substr( 0, tmp.length - 1 );
      }
      var idx_nl = tmp.lastIndexOf( "\n" );
      if( idx_nl !== -1 ){
        if( tmp[ idx_nl + 1 ] !== "@" ){
          if( tmp.substring( idx_nl ).indexOf( " - " ) === -1 ){
            // Last line does not start with a '@' and does not include " - "
            text = tmp + "\n\n";
          }
        }
      }else if( tmp ){
        text = tmp + "\n\n";
      }
      text += that.loginName + should_log + "\n"
      that.deep_session_de&&bug( "log:", should_log)
      NDe&&bug( "Trace added: ", that.loginName + should_log )
    }else{
      that.deep_session_de&&bug( "log filtered out")
    }
  }
  // Side effect on wiki's title in some cases
  if( guest && should_ask_for_title ){
    that.de&&bug( "Check wiki title")
    // ToDo: better sanitization
    var sane_title = Wiki.sanitizeTitle( guest)
    // Paranoid double check that changing the title is safe
    if( true // that.canCurator
    && (page.isHome() || page == that.wiki.aboutwikiPage)
    //&& !that.isAnonymous()
    && that.userName() != sane_title
    ){
      that.de&&bug( "Set title:", sane_title)
      that.setData( that.wiki.aboutwikiPage, "title", sane_title)
      that.wiki.setOptions(
        that.wiki.config,
        {title: sane_title},
        "wiki",
        page,
        that
      )
    }else{
      that.bug_de&&bug( "Don't set title:", sane_title)
    }
  }
  // Transient if guests
  if( that.isGuest()
  &&  !page.isPublic()
  ){
    that.de&&bug( "post, guest, draft page:", page)
    // ToDo: issue with virtual HomePage
    that.draft( page, true)
  }
  
  if( text == old_text && !verb_is_stamp && !verb_is_doit && !verb_is_copy ){
    that.setCurrentPage( page)
    return that.viewForm( req)
  }
  De&&bug( "Put change")
  // Make sure user did not inadvertly remove her name from user page
  if( page.isUser() && !that.isCurator && !page.isDraft() ){
    var can_read = that.canRead( page, false, text)
    if( !can_read ){
      De&&bug( "Restore user name on front line")
      text = that.userName() + "\n" + text
    }
    // If mail address changed, send a mail
    // var olddata = that.wiki.extractBasicYaml( old_text)
    // var oldmail = olddata ? olddata.email : null
    if( !page.isDraft() ){
      var oldmail = page.get( "email")
      var newdata = that.wiki.extractBasicYaml( text)
      var newmail = newdata ? newdata.email : null
      var needsend = false
      if( oldmail && !newmail ){
        De&&bug( "Restore mail")
        newdata.email = oldmail
        text = that.wiki.injectBasicYaml( text, newdata)
      }else if( newmail != oldmail ){
        De&&bug( "Change mail address, send a mail")
        newmail = that.registerMailAddress( newmail)
        page.set( "email", newmail)
        newdata.email = newmail
        text = that.wiki.injectBasicYaml( text, newdata)
      }
      page.data = newdata
    }
  // Non user pages (or curator mode), update data, unless draft
  }else if( !page.isDraft() ){
    var newdata = that.wiki.extractBasicYaml( text)
    // ToDo: should deep compare values before issuing confusing msg
    if( newdata != page.data ){
      that.de&&bug( "set new data, page:", page.name)
      page.data = newdata
    }
  }
  // If "NewMember" page, set member's name and create new page
  if( that.shouldAskForNewMember( page) && guest ){
    var as_curator = guest.includes( "Curator")
    if( as_curator ){
      guest.replace( / *Curator */g, "")
    }
    guest = that.usernamize( guest)
    text = text + "\n" + guest + " - " + guest.substr( "User".length)
    var new_user_page = that.lookup( guest)
    if( !that.canCurator ){
      // Create as draft if not curator
      that.draft( new_user_page, true) // true => force
    }else{
      // OTOH, stamp page if curator and if page already exists as draft
      if( new_user_page.isDraft() ){
        that.de&&bug( "Stamping new member:", new_user_page)
        that.stamp( new_user_page, true) // true => don't write, putPage will
      }
      // If curator creating a curator, add to new curator to "AboutWiki" page
      if( as_curator ){
        var curators = that.getData( wiki.aboutwikiPage, "curators")
        curators = (curators + " " + guest).replace( /^ /, "")
        that.setData( wiki.aboutwikiPage, "curators", curators)
        that.wiki.setOptions(
          that.wiki.config,
          {curators: curators},
          "wiki",
          page,
          that
        )
      }
    }
    that.getPage( new_user_page, function( err ){
      var old_content = new_user_page.getBody()
      that.putPage(
        new_user_page,
        guest.substr( "User".length) + "\n\n" + old_content,
        function( err ){
          if( err ){
            that.wiki.error( "Cannot write in " + new_user_page.name)
          }
        }
      )
    })
  }
  var time_previous_modif = page.timeModified()
  var age = time_previous_modif ? (Sw.timeNow - time_previous_modif) : 0
  // Defensive: make sure context is saved
  that.wiki.touch( page) // true => hard
  // ToDo: ?Make sure Yaml section is always at the end
  if( false && !page.isDraft() ){
    text = that.wiki.injectBasicYaml(
      that.wiki.injectBasicYaml( text), // Erase
      page.data                         // Add
    )
  }
  // For "less" CSS page, compile the CSS and put it it a distinct page
  if( page.isLessCss() ){
    if( !Less ){
      // ToDo
    }else{
      Less.render( text, function( e, css ){
        that.putPage(
          that.lookup( page.name + "Style"),
          e ? e.toString() : css,
          Sw.noop
        )
      })
    }
  }
  that.putPage( page, text, function( err ){
    if( err ){
      that.de&&bug( "Error: Write error on page:", page, "err:" + err)
      // ToDo: issue with redirect
      // req.isRest = true
      that.setCurrentPage( that.wiki.lookupPage( that.i18n( "err:write")))
    }else{
      De&&bug( "Edit side effect on " + page)
      if( that.wiki.isEmpty() ){
        that.wiki.bug_de&&bug( "How come wiki appears empty?")
      }
      // I will render the same page, unless "DoIt" tells me to go elsewhere
      if( verb_is_doit ){
        that.doOnPage = page
        if( doit_data ){
          for( var key in doit_data ){
            that.setSessionData( key, doit_data[key], page)
          }
          // There is no point in keeping the page as a draft
          if( page.isDraft() ){
            page.undraft()
          }
        }
        that.setCurrentPage( that.lookup( page.getToDo()))
      // I will render the same page, unless "GoXxxxx" tells me to go elsewhere
      }else if( then_go ){
        that.setCurrentPage( that.lookup( Wiki.wikinamize( then_go)))
      }else{
        that.setCurrentPage( page)
      }
    }
    if( should_log && !that.isGuest() && !page.isDraft() ){
      that.logStamp( page, should_log)
    }
    // Unless draft or "DoIt", add to copy page if asked for
    // or if not done for a long time or if new writer or at least 100 deletes
    // or "big" reduction in page's size, maybe an "error" by the user
    if( (!verb_is_doit && !page.isDraft())
    && (verb_is_copy
      || !age
      || (age > 24 * 60 * 60 * 1000) // Daily
      || page.lastWriter() != that.userName()
      || (text.length < old_text.length) && ((old_text.length - text.length) >= 100)
      || (text.length < (old_text.length / 2) && old_text.length > 100))
    ){
      var copyname = "Copy" + page
      that.copyPage( page, copyname, function( err, page, copypage ){
        // ToDo: issue with redirect
        // req.isRest = true
        if( err == 0 ){
          if( that.isGuest() ){
            that.setCurrentPage( page)
          }
          // Also copy to user's Dropbox
          if( verb_is_copy && that.dropbox && that.dropbox.client ){
            that.dropboxPut( page, Sw.noop)
          }
        }   
        if( err == 1 ){
          De&&bug( "Error: Read error on " + page)
          that.setCurrentPage( that.wiki.lookupPage( that.i18n( "err:read")))
        }
        if( err == 2 ){
          De&&bug( "Error: Write error on " + page)
          that.setCurrentPage( that.wiki.lookupPage( that.i18n( "err:write")))
        }
        if( then_go ){
          that.editForm( req)
        }else{
          that.viewForm( req)
        }
      })
    }else{
      if( then_go ){
        that.editForm( req)
      }else{
        that.viewForm( req)
      }
    }
  })
  //if( "Html".starts( page) ){
  //  var htmlpage = page.substr( 4) + ".html";
  //  Fs.writeFile( htmlpage, text, function( err ){
  //    if( err ){
  //      De&&bug( "Error: Write error on " + htmlpage + ": " + err);
  //    }
  //  })
  //}
  })
}

Session.logStamp = function( page, shouldlog ){
// Logs stamps to RecentStamps and user stamps pages
// ToDo: should store in PrivateContext, for speed
  var that = this
  var msg  =  "* " + page.name + "\n"
  this.lookup( this.userWikiName() + "Stamps")
  .read( function( err, stamppage ){
      var txt = stamppage.getBody()
      if( err || !txt ){
        // ToDo: err
        txt = ""
      }
      if( txt.includes( msg ) ){
        txt = txt.replace( msg, msg + shouldlog + "\n")
      }else{
        txt = msg + shouldlog + "\n\n" + txt
      }
      that.de&&bug( "stampOn:", page.name)
      that.putPage( stamppage, txt, function( err ){})
    }
  )
  if( !page.isUser()
  && !"Stamps".ends( page.name)
  ){
    that.lookup( "RecentStamps").read( function( err, stamppage ){
      var txt = stamppage.getBody()
      if( err ){
        // ToDo: err
        txt = ""
      }
      if( txt.includes( msg) ){
        txt = txt
        .replace( msg, msg + that.loginName + shouldlog + "\n")
      }else{
        txt = msg + that.loginName + shouldlog + "\n\n" + txt
      }
      that.putPage(
        stamppage,
        txt,
        function( err ){
          if( err ){
            // ToDo: err
          }
        }
      )
    })
  }
}

Session.compressStamps = function( page, cb ){
// Reduce the number of stamps to one per changed page.
// Also sorts by date, recent changes first
  De&&mand( page.isStamps() )
  var that = this
  page.read( function( err, page ){
    if( err ){
      // ToDo: signal error
      return cb( err, page)
    }
    // Format is:
    // * pagename
    //   change - iso date
    //   change optional comment - iso date
    //   changes...
    // blank line separator  
    var changes = page.getBody().split( "\n\n")
    var buf = []
    var ii
    var change
    var about
    for( ii in changes ){
      change = changes[ii]
      if( !change )continue
      about = change.frontLine()
      var about_changes = change.butFrontLine()
      change = about_changes.frontLine()
      // Look for change with a comment (treat other changes as "minor")
      var comment
      var limit = 200
      while( --limit && about_changes ){
        comment       = about_changes.frontLine()
        about_changes = about_changes.butFrontLine()
        if( comment ){
          if( /\s* \s* - .*/.test( comment) ){
            change = comment
            break
          }
        }
      }
      if( !limit ){
        this.bug_de&&bug( "long loop in compress") // Fixed
      }
      if( change ){
        buf.push( about + "\n" + change + "\n")
      }
    }
    buf = buf.sort( function( a, b ){
      var ii
      // Each change ends with a "- " prefixed ISO date
      var a1 = a.substr( a.lastIndexOf( "- "))
      var b1 = b.substr( b.lastIndexOf( "- "))
      // I create "useless" a1 & b2 because of infamous IE bug
      // see http://www.zachleat.com/web/2010/02/24/array-sort/
      if( a1 < b1 )return 1
      if( a1 > b1 )return -1
      return 0
    })
    buf = buf.join( "\n")
    var logmsg = "" // that.loginName is added by logStamp()
    +  " compress " + page.name 
    + " - " + Sw.dateNow.toISOString()
    that.putPage( page, buf, function( err, page ){
      if( err ){
        // ToDo: signal error
        return cb( err, page)
      }
      // Don't log if curator or if user is compressing her own changes
      if( !that.isCurator && page.name != that.userName() + "Stamps" ){
        that.logStamp( page, logmsg)
      }
      return cb( err, page)
    })
  })
}

Session.logPrivateCode = function( name, wiki ){
// Log accessed wiki in "PrivateCodes" page
// ToDo: should be also a Wiki method
  debugger;
  var page = page || "HomePage"
  name = name || this.loginName
  wiki = wiki || this.wiki
  // Filter out anonymous guests, too much noise
  // ToDo: should also filter out non anonymous guests?
  // Log inherited code in their wiki, cause subwiki mentors should not see it
  if( !page.includes( ":") && wiki.lookupPage( page).inherited ){
    wiki = wiki.lookupPage( page).inherited.wiki
  }
  // Don't log codes for guests nor draft codes, don't pollute wiki
  // Also: I want to avoid "empty" wikis that require storage
  if( "Guest".ends( name) )return
  if( wiki.lookupPage( page).isDraft() )return
  wiki.lookupPage( "PrivateCodes").read( function( err, codepage ){  
    var txt = codepage.getBody()
    if( txt.includes( 
        "Page: " + page
      + "\nMember: " + name
      + "\nDate:"
    )) return
    txt = "Page: " + page
    + "\nMember: " + name
    + "\nDate: " + Sw.dateNow.toISOString()
    + "\n\n"
    + txt
    wiki.protoGuest.putPage( wiki.lookupPage( "PrivateCodes"), txt, function(){})
    // Propagate message to parent wiki, unless it is the root wiki
    // ToDo: on small installs, it would make sense to propagate to root wiki
    if( !wiki.isRoot()
    && (De || !wiki.parentWiki.isRoot())
    ){
      wiki.protoGuest.logPrivateCode(
        wiki.getRoot().name + ":" + wiki.fullname() + page,
        name,
        wiki.parentWiki
      )
    }
  })
}

Session.processEmbedJsRequest = function( req ){
// I need to serve a javascript page
  this.de&&bug( "serve javascript")
  var content = this.embedJsScript.toString() + "embed_wiki()"
  this.respond( req, content, "text/javascript", true) // No cookies
}

Session.embedJsScript = function embed_wiki(){
// Client side
  // Find where script was included
  var scripts = document.getElementsByTagName( "script")
  var found = false
  var script
  for( var ii ; ii < scripts.length ; ii++ ){
    script = scripts[ii]
    if( scrip.src.indexOf( "embed.js") > 0
    &&  script.src.indexOf( SW.domain) > 0
    ){
      found = script
      // Don't exit loop, I keep the last found one
    }
  }
  var wiki = ""
  // Use disqus_shortname if defined
  if( typeof disqus_shortname != "undefined" ){
    wiki = disqus_shortname
  }
  // Use simpliwiki_shortname if defined
  if( typeof simpliwiki_shortname != "undefined" ){
    wiki = simpliwiki_shortname
  }
  // Use window.location if no better option
  var loc = window.location
  if( typeof( disqus_url) != "undefined" ){
    loc = disqus_url
  }
  if( typeof( simpliwiki_url) != "undefined" ){
    loc = simpliwiki_url
  }
  loc = loc.replace( /.*:\/\//, "")
  var ii = loc.lastIndexOf( "/")
  var basename = ""
  if( ii >= 0 ){
    basename = "[" + loc.substr( ii + 1) + "]"
    loc = loc.substr( 0, ii)
  }
  loc = loc
  .split( /[.\/]/)
  .reverse()
  .join( "_")
  .toLowerCase()
  .replace( "com_", "")
  if( !wiki ){ wiki = loc }
  // Use disqus_identifier if defined
  if( typeof( disqus_identifier) != "undefined" ){
    basename = "[" + disqus_identifier + "]"
  }
  // Use simpliwiki_identifier if defined
  if( typeof( simpliwiki_identifier) != "undefined" ){
    basename = simpliwiki_identifier
  }
  // OK, now I get both the wiki and the page
  var path = wiki + (basename ? "/" + basename : "")
  var url = SW.protocol + "iframe." + SW.domain + "/" + path
  // Lets make an iframe
  maxwidth  = "100%"
  maxheight = 480
  var iframe
  = '<iframe src="' + url   + '"'
  + ' width="'  + maxwidth  + '"'
  + ' height="' + maxheight + '"'
  + ' border="0" style="border:none;"'
  + ' allowTransparency="true"'
  + '></iframe>'
  // If I could find where the script was included, add a child there
  if( document.getElementById( "simpliwiki") ){
    script = document.getElementById( "simpliwiki")
  }
  // Else, add iframe "in place", ie. right here, right now
  if( script ){
    script.html = iframe
  }else{
    document.write( iframe)
  }
}


Session.comebackScript = function sw_comeback(){
// This code is included in index.html
// It handles users who are coming back to SimpliWiki and it presents a menu
// to let the user come back to one of the wikis she is was logged in.
// Client side
  window.sw_is_index  = true
  window.sw_is_iframe = true
  try{ // document.domain not set... firefox says...
    window.sw_is_iframe = (location.href != top.location.href)
  }catch( err ){}
  var cookies = decodeURIComponent( sw_cookies)
  De&&bug( "Cookie:" + cookies)
  var wikis = {}
  var buf   = []
  // ToDo: export decode(), or, better I guess, use decodeURIComponent()
  var decode = function( path ){
    return decodeURIComponent( path)
    .replace( /^com_/, "")
    .replace( /_/g, "/")    // _ means / in original
    .replace( /\/\//g, "_") // __ means _ in original
    .replace( /\/$/, "")
  }
  // For all wiki ids that I can figure out...
  var wiki
  // Find titles
  var titles = {}
  cookies.replace( /sw_title_sw_code([^=]*)=([^;]*)/g, function( _, id, title ){
    if( id ){
      wiki = decode( id)
      wikis[wiki] = buf.length + 1 // + 1 because 0 is false, I do - 1 later
      buf.push(
        '<a href="' + encodeURI( wiki) + '/HomePage">' // HomePage?code=' + code + '">'
        + (titles[wiki] = decodeURIComponent( title))
        + '</a>'
      )
    }
  })
  // Add wikis without title but with a code
  cookies.replace( /sw_code([^=]*)=([^;]*)/g, function( _, id, code ){
    if( id ){
      wiki = decode( id)
      if( !wikis[wiki] ){
        wikis[wiki] = buf.length + 1
        buf.push(
          '<a href="' + encodeURI( wiki) + '/HomePage"' // HomePage?code=' + code + '">'
          + (wiki.charAt( 0) == "3" ? ' title="secret"': "")
          + '>'
          + wiki
          + '</a>'
        )
      }
    }
  })
  // If there are many active sessions, I display the last one first
  var sort_done = false
  if( buf.length ){
    // I can figure out what was that wiki using the sw_page cookie
    cookies.replace( /sw_page=([^;]*)/, function( _, id ){
      wiki = decode( id)
      var page = wiki
      // Remove page's name, keep wiki's name
      if( wiki.lastIndexOf( "/") ){
        wiki = wiki.substr( 0, wiki.lastIndexOf( "/"))
      }
      if( wiki ){
        // I remove that wiki from the previously built list to avoid dup
        if( wikis[wiki] ){ delete buf[wikis[wiki] - 1] }
        buf = buf.sort()
        sort_done = true
        buf.unshift(
          '<a href="' + encodeURI( page) + '">' // HomePage?code=' + code + '">'
          + (titles[wiki] || wiki)
          + '</a>'
        )
        wikis[wiki] = 1
      }
    })
  }
  if( buf.length ){
    if( !sort_done ){ buf = buf.sort() }
    $('#then').append(
      "" // Session.i18n( "go to ")
      + buf.join( " ") // ", ")
      //+ Session.i18n( " or...")
      //+ "<br>"
    )
    window.sw_comeback = true
  }
}

Session.signinScript = function sw_signin(){
// This is client code side that deals with Twitter signin.
// It is included in index.html, simpli.html and in some wiki pages

window.sw_set_cookie = function( srv, attr, value, days ){
  var cookie_name = "sw_" + (srv ? srv + "_" : "") + attr
  days || (days = 1)
  window[cookie_name] = value 
  var cookie_update = cookie_name
  + "=" + (value || "null")
  // ToDo: make this work with custom domains
  //+ ";domain=.simpliwiki.com"
  + ";expires="
  + ((value || days)
    ? (new Date( (new Date()).getTime() + (days * 84000000))).toGMTString()
    : (new Date()).toGMTString()
  )
  + ";path=/" // ";HttpOnly" // Prevent some XSS attacks
  // De&&bug( "Set cookie: " + cookie_update)
  document.cookie = cookie_update
  return value
}

window.sw_get_cookie = function( srv, attr ){
  var cookie_name = "sw_" + (srv ? srv + "_" : "") + attr
  var value = ""
  document.cookie.replace( RegExp( cookie_name + "=(.*?);"), function( _, v ){
    if( v && v != "null"){ value = v }
  })
  return window[cookie_name] = value 
}

window.sw_set_id_cookies = function( srv, id, name, label ){
  sw_set_cookie( srv, "id",         id),
  sw_set_cookie( srv, "screenname", name)
  sw_set_cookie( srv, "label",      label)
}

window.sw_get_id_cookies = function( srv ){
  sw_get_cookie( srv, "id"),
  sw_get_cookie( srv, "screenname")
  sw_get_cookie( srv, "label")
}

// Signal to server that client can script, using a cookie
sw_set_cookie( "", "can_script", true)

window.install_signout = function( srv, e ){
  e.append(
    ' <button id="signout' + srv +'" type="button">'
    + "Bye" // Session.i18n( "Sign out")
    + '</button>'
  ).fadeIn( 1500)
  $("#signout" + srv).one( "click", function (){
 
  debugger;   if( srv == "tw" ){
      sw_set_id_cookies( "twitter")
      //try{ twttr.anywhere.signOut(); }catch( e ){}
    }
    try{
      window["update_" + srv + "_login"].call()
    }catch( e ){}
  })
  // Only index.html defines a Session object, so far
  if( typeof Session === "undefined" )return
  if( Session.config.lang == "fr" ){
    // $("#1st").html( "hello !")
    // $("#2nd").empty().append( "&agrave; pr&eacute;sent...")
  }else{
    // $("#1st").html( "hello!")
    // $("#2nd").empty().append( "now...")
  }
}

window.install_signin = function(){
  // Only index.html defines a Session object
  if( typeof Session === "undefined" )return
  if( Session.config.lang == "fr" ){
    // $("#1st").html( "optionnel") // "se connecter (optionnel)")
    // $("#2nd").html( "") // "puis...")
  }else{
    // $("#1st").html( "optional") //"maybe tell who your are (optional)")
    // $("#2nd").html( "") // "then...")
  }
}


window.update_sw_login =  window.update_tw_login = function(){
  sw_get_id_cookies( "twitter" );
  var id = window.sw_twitter_id;
  if( id ){
    sw_set_id_cookies( "twitter", id, id, id )
    install_signout( "tw", $('#sw-login').fadeOut( 0).html( ""
      + ' <a href="/@' + id 
      + '">@' + window.sw_twitter_screenname + "</a>"
      + ' <img src="/twitter_ico.png" />'
    ))
  }else{
    // Do nothing if not displayed yet
    if( ! $("#sw-login").size() )return
    sw_set_id_cookies( "twitter" )
    $("#sw-login").html(
      '<div id="sw-login-box" class="sw_boxed">'
      //+'<img src="/yanugred16.png" width="16"/> '
      //+'Connect with Simpl<em>i</em>Wiki</div>'
      + "Login"
    )
    $('#sw-login-box').one( "click", function( event ){
      $("#sw-login").css( "display", "inline")
      .html(
        '<a href="http://kudocracy.com">Kudo<em>c</em>racy</a>'
//          'twitter @name: <input id="sw-connect-id"></input>'
//        + ' <button id="sw-login-ok">OK</button>'
      )
      
      $('#sw-login-ok').one( "click", function( event ){
        id = $('#sw-connect-id').val();
	      var screen_name = id
        .substr( 0, 30)
        .replace( /[^A-Z_a-z0-9]/g, "");
	      id = screen_name.toLowerCase();
        sw_set_id_cookies( "twitter", id, screen_name, id)
        update_sw_login()
      })
    })
  }
  // ToDo: I need to reload the page?
  if( typeof window.sw_logged_in_twitter === "undefined" ){
    // Initial display
  }else{
    if( window.sw_logged_in_twitter != !!id ){
      // Changed
      if( id && typeof Session === "undefined" && sw_ctx.isAnonymous ){
        // Reload the page to provide up to date view, unless index.html
        window.location = ""
        location.reload( true)
      }
    }
  }
  window.sw_logged_in_twitter = !!id
}


window.sw_twitterOnLoad = function sw_twitterOnLoad(){
  /*twttr.anywhere( function( T ){ 
    T.bind( "authComplete", function( e, user ) {
      // triggered when auth completed successfully
      update_tw_login( T)
    })
    T.bind("signOut", function (e) {
      // triggered when user logs out
      update_tw_login( T)
    })
    update_tw_login( T)
  })*/
}


var sw_footer_was_displayed         = false
var sw_login_buttons_were_displayed = false

window.onFooterDisplay = function( force, brutal ){
// Inits stuff about facebook & twitter that are better avoided at first
// Called when footer part of page may become visible.
// Also called in index.html

  // Some init
  if( force == "init" ){
    sw_footer_was_displayed = sw_login_buttons_were_displayed = false
    return
  }

  // If brutal, I show the footer and make it stay visible
  // This is usefull in the "SignIn" page
  if( brutal ){
    $('#footer').fadeTo( 0, 1).removeClass( "sw_fade")
  }

  // Do stuff once only
  if( sw_footer_was_displayed
  && sw_login_buttons_were_displayed
  )return

  // Code to load some scripts, async, after a small delay, maybe
  (  true
  || sw_ctx.twid
  || window.sw_fb_like_button_href)
  && setTimeout( function(){
    // If still visible, load
    if( !force && !$("#footer").is(":visible") )return
    // If login buttons are visible, load (always load when in index.html)
    var $buttons = $('#login-buttons')
    // de&&bugC( "buttons: " +  $buttons.size())
    if( $buttons.size()
    && ($buttons.is(":visible") || brutal)
    ){
      update_sw_login()
      // Load twitter connect. No! obsolete
      sw_ctx.twid && false && loadfire.event( function( fire ){
        if( !window.sw_twitterOnLoad )return
        fire.load(
          "http://platform.twitter.com/anywhere.js?id=" + sw_ctx.twid + '&v=1'
        ).event( function( fire ){
          // Call sw_twitterOnLoad once loaded
          if( !window.twttr )return
          sw_twitterOnLoad()
          return true
        })
        return true
      })
      var lang = (window.sw_lang == "fr") ? "fr" : "en_US"
      sw_login_buttons_were_displayed = true
    }
    if( !sw_footer_was_displayed ){
      // Load fb like button
      if( window.sw_fb_like_button_href ){
        $('#sw_fb_like_button').html( '<iframe src='
          + '"http://www.facebook.com/plugins/like.php?'
          // ToDo: should I force apps.facebook.com/simpliwiki?
          + 'href=' + sw_fb_like_button_href
          + '&amp;layout=button_count&amp;show_faces=false&amp;width=200&amp;'
          + 'action=like&amp;font=verdana&amp;colorscheme=light&amp;height=21" '
          + 'scrolling="no" frameborder="0" class="sw_fb_like_iframe"'
          + 'height:21px;" allowTransparency="true"></iframe>\n'
        )
      }
      sw_footer_was_displayed = true
    }
  }, brutal ? 1 : 1000) // setTimeout()
}

}

Session.xfbmlScript = function sw_xfbml(){

window.fbAsyncInit = function() {
// This function gets called by Facebook's code when it get loaded.
// See http://developers.facebook.com/docs/reference/javascript/
// http://developers.facebook.com/docs/reference/javascript/fb.init/
  FB.init({
    appId  : sw_ctx.fbid,
    status : true, // check login status
    cookie : true, // enable cookies to allow the server to access the session
    xfbml  : true, // parse XFBML
    // ToDo: double check Expires headers and caching by browser
    // custom channel. This is the way Facebook 
    channelUrl  : 'http:/'+'/' + sw_ctx.domain + "/channel.html"
  })
}

var sw_footer_was_displayed = false

window.onFooterDisplay = function( force, brutal ){
// Called when footer part of page may become visible.
// Inits stuff that are better avoided at first
// Note: there is another definition of onFooterDisplay() that is used
// when "login" buttons are provided. ToDo: DRY, make into only one.

  // Do stuff once only
  if( sw_footer_was_displayed )return

  // Code to load some scripts, async, after a small delay
  // ToDo: DRY, this is a repeat from just above
  ( window.sw_fb_like_button_href)
  && setTimeout( function(){
    if( !force && !$("#footer").is(":visible") )return
    sw_footer_was_displayed = true
    // Load facebook connect (for fb_like button only)
    if( typeof sw_ctx === "undefined" ){
      window.sw_lang = "en"
    }else{
      window.sw_lang = sw_ctx.lang
    }
    var lang = (window.sw_lang == "fr") ? "fr" : "en_US"
    && loadfire( "shareaholic-publishers.min.js")
    // Load fb like button
    if( window.sw_fb_like_button_href ){
      $('#sw_fb_like_button').html( '<iframe src='
        + '"http://www.facebook.com/plugins/like.php?'
        // ToDo: should I force apps.facebook.com/simpliwiki?
        + 'href=' + sw_fb_like_button_href
        + '&amp;layout=button_count&amp;show_faces=false&amp;width=200&amp;'
        + 'action=like&amp;font=verdana&amp;colorscheme=light&amp;height=21" '
        + 'scrolling="no" frameborder="0" class="sw_fb_like_iframe"'
        + 'height:21px;" allowTransparency="true"></iframe>\n'
      )
    }
  }, brutal ? 1 : 1000) // setTimeout()
}

}


Session.serviceLoginForm = function( page ){
// Return html code to login using a secret code (or twitter)
// Return "" if client can't script or current page is inadequate

  page = (page || this.getCurrentPage())

  // This does not play well with angular, the login-buttons are displayed,
  // as if user had clicked on "SignIn", so... avoid the section altogether
  // when page uses angular. ToDo: figure out what is happening
  if( page.needsAngular() )return ""
  
  // Dec 2014, don't display that if user comes from Kudocracy
  if( this.isAuthentic || this.isKudocracy )return "";
  return ""; // Kudocracy is actually the only way to login

  var buf            = '<div id="login">'
  var postclosure_id = this.postClosureId

  // Don't inject "SignIn" if already on that page. As a result the buttons
  // don't get hidden when page loads and onFooterDisplay() loads the proper
  // javascript scripts.
  var sign_in_page = this.lookup( "SignIn")
  if( page != sign_in_page ){
    buf += this.link( sign_in_page, this.i18n( "SignIn"), "click")
  }

  // If either known to be able to script or even "maybe"
  if( this.canScript ){
    buf += '<div id="login-buttons">'
    true     && (buf += '<div id="sw-login">SimpliWiki...<img src="/simpliwiki.gif" /></div>')
    SW.twid  && (buf += '<div id="tw-login">Twitter...   <img src="/twitter.gif" /></div>')
    SW.fbid  && (buf += '<div id="fb-root"></div>')
    buf += '</div>'
    // ask Session.html() to include twitter's script
    this.needsTwitter = SW.twid  // ToDo: should be attached to request, not session
  }
  return buf + "</div>"
}

Session.restorePhase1 = function( cb ){
  var it = this
  // First, copy current content in copy
  var now  = new Date() // Don't use Sw.dateNow, I want more uniq microsecs
  var page = it.getCurrentPage()
  var copyname = "Copy" + page.name
  it.copyPage( page, copyname, function( err, page, copypage )
  {
  if( err )return cb.call( it)
  var restorepage = it.wiki.lookupPage( "UserRestore" + page.name)
  // Using last and previous copies
  var items = []
  var item = null
  // Build UserRestoreAxxxx
  var delimit = SW.datePattern
   + " " + page.name
   + " " + copypage.name
   + " " + ".*\n" // user name
  // I am user the pattern used by copyPage() to delimit copies
  this.de&&bug( "Looking for ", delimit, "in ", copypage.getBody())
  var regex = new RegExp( delimit, "gi")
  var math
  var nth = 1 // 0th is useless
  var content = copypage.getBody().split( regex)
  //this.de&&bug( "Chuncks: ", content.length, Sys.inspect( content))
  var toc = []
  var title;
  var match;
  // For each copy, I extract it's date
  while( match = regex.exec( copypage.getBody()) ){
    // this.de&&bug( "Found ", Sys.inspect( match))
    title = match[0]
    title = title.match( new RegExp( SW.datePattern, "i"))[0]
    // Condense ISO date
    title = title.replace( /[ \-TZ\.:,]/gi, "")
    title = "UserRestore" + title
    items.push( {name: title, body: content[nth]})
    toc.push( title)
    nth++
  }
  // ToDo: If I could not parse the copy, provide full text
  // Build UserRestoreNnnnn
  // Show UserRestoreAxxx
  var buf = []
  var buf2
  var header
  buf.push( it.loginName)
  buf.push( header = "\nHelpRestore " + page.name
    + " (" + now.toISOString() + ")"
    + " using " + copypage.name
  )
  if( toc.length > 2 ){
    buf.push( "\nWhich one of " + (toc.length - 1) + " copies?")
  }else{
    buf.push( "\n")
  }
  var link
  var nn = 0
  for( link in toc ){
    // Skip version 0
    if( !nn++ )continue
    buf.push( "#" + link + " " + toc[link])
  }
  if( toc.length > 2 ){
    buf.push( "\n\nContent of copies:\n")
  }
  nn = 0
  for( item in items ){
    // Skip version 0
    if( !nn++ )continue
    buf2 = []
    buf.push( "Copy #" + item + ": " + items[item].name )
    buf2.push( "--- " + now.toISOString() + " ..." )
    buf2.push( items[item].body )
    buf2.push( "... " + now.toISOString() + " ---\n" )
    buf.push( buf2 = buf2.join( "\n"))
    // ToDo: I should not write such pages, draft?
    it.putPage( it.wiki.lookupPage( items[item].name), [
      it.loginName,
      "",
      header,
      "",
      buf2
    ].join( "\n"), function(){})
  }
  buf = buf.join( "\n")
  it.putPage( restorepage, buf, function( err ){
    if( !err ){
      it.setCurrentPage( restorepage)
    }
    cb.call( it)
  })
  })
}

Session.restorePhase2 = function( restorepage ){
  // Get original name
  // Extract content
  // Move content to original page
  // Log action as if a stamp
  // Show original page
  var pagename = restorepage.getBody().match( /Restore (.*) \(/)
  if( !pagename ){
    this.bug_de&&bug( "Bad restore, no restore section")
    return null
  }
  pagename = pagename[1]
  if( !pagename ){
    this.bug_de&&bug( "Bad restore, empty name")
    return null
  }
  var page = Page.lookup( this.wiki, pagename)
  var delimit = "--- " + SW.datePattern + " ...\n"
  var parts = restorepage.getBody().split( new RegExp( delimit, "i"))
  if( !parts || parts.length < 2 || !parts[1] ){
    this.bug_de&&bug( "Bad restore on:" + pagename)
    return null
  }
  delimit = "\n... " + SW.datePattern + " ..."
  parts = parts[1].split( new RegExp( delimit))
  var content = parts[0]
  if( !content ){
    this.bug_de&&bug( "Bad empty restore on:" + pagename)
    return null
  }
  
  var logmsg = this.loginName
  + " " + restorepage.name
  + " - " + Sw.dateNow.toISOString()
  if( !this.isCurator ){ content += "\n" + logmsg }
  NDe&&bug( "Restore ", page, ", using ", content)
  var that = this
  this.putPage( page, content, function( err ){
    if( !this.isCurator ){
      that.logStamp( page, logmsg)
    }
  })
  return page
}

Session.angularTest = function angular_test(){
}

Session.rest = function( req ){
// This method handles "rest" requests, AJAX style API requests.
// ToDo: this is not "true" REST, some improvements are coming...
// See http://blog.apigee.com/detail/restful_api_design/

  var that = this

  var forged = false

  // See http://nealpoole.com/blog/2010/11/preventing-csrf-attacks-with-ajax-and-http-headers/
  var x_requested_with_header = req.headers["X-Requested-With"]
  if( !x_requested_with_header ){
    this.login_de&&bug( "No X-Requested-With, forgery?")
    //forged = true    
  }

  // If I receive such a request, I can safely assume that client can script
  if( this.canScript == "maybe" ){
    this.canScript = true
    // Let's compute how long it took, between 1 and 2 seconds usually
    this.roundTrip = Sw.timeNow - this.roundTrip
    this.login_de&&bug( "Client can script, delay:", this.roundTrip)
  }
  
  this.rest_de&&bug( "Handling REST request")
  // Make sure .respond() doesn't do a redirect on POST
  req.isRest = true
  var parsedurl = Url.parse( req.url)
  var query = QueryString.parse( parsedurl.query)
  this.deep_rest_de&&bug( "Query:", Sys.inspect( query))
  this.deep_rest_de&&bug( Sys.inspect( req.headers))
  this.deep_rest_de&&bug( "Host:" + req.headers.host)
  this.deep_rest_de&&bug( "Referrer:" + (req.headers.referrer || req.headers.referer))
  this.deep_rest_de&&bug( "Cookies:" + req.headers.cookie)
  
  var verb   = query["action"]
  var req_id = query["rid"] || this.wiki.random3Code( "")
  
  // Result is an optional string with Javascript code evaled by the client
  var result = ""

  if( forged ){
    verb = verb + "_forged"
    result = forged + ", query: " + Sys.inspect( query)
  }
  
  if( verb == "debug" ){
    this.de&&bug( decodeURIComponent( query.msg))
  }
  
  if( verb == "resize" ){
    NDe&&bug( "Resize event ", Sys.inspect( query))
    var height = parseInt( query.height, 10)
    var width  = parseInt( query.width,  10)
    var px     = parseInt( query.wpx,    10)
    var hpx    = parseInt( query.hpx,    10 );
    var cwidth = parseInt( query.content_width, 10)
    if( height ){ this.screenHeight = height }
    if( width ){  this.screenWidth  = width }
    if( px ){
      this.screenFontWidth    = px
      this.screenContentWidth = cwidth
      this.screenCols      = Math.floor( this.screenWidth  / px)
      // Reload if need to display two columns now?
      result = (this.adjustColumns() && this.twoColumns && false)
      ? 'window.location = ""; location.reload( true)'
      : ""
    }
    if( hpx && height ){
      var nrows = height / hpx;
      // Adjust desired number of rows to match actual one if it is bigger
      if( nrows > 25 && this.config.rows ){
        debugger;
        this.config.rows = Math.max( this.config.rows, Math.floor( nrows ) );
      }
    }
    var lang = null // I prefer HTTP's accept-language. query.lang.substr( 0, 2)
    if( lang == "en"
    ||  lang == "fr"
    ){
      if( this.config.lang != lang ){
        // If change in language... I need to reload the page
        this.lang_e&&bug( "changeLang:", lang)
        result = 'window.location = "' + this.href( this.getCurrentPage()) + '"'
      }
    }else{
      lang = null
    }
    if( lang ){ this.config.lang = lang }
    if( query.touch && query.touch == "true" ){
      this.isTouch = true
      this.config.rows = 10
      this.twoColumns = false
    }
  }

  function respond( mime ){
    that.respond( req, result, mime || "text/javascript" );
  }

  function respondJson(){
    result = Wiki.jsonEncode( result)
    if( query.jsonp ){
      result =  query.jsonp + "(" + result + ")"
    }
    respond( "application/json" );
  }

  if( verb == "getPage" ){
    var pagename = query.name || "RestPage"
    var page = this.lookup( this.wikinamize( pagename))
    var result = {
      version: SW.version,
      rid: req_id,
      verb: verb,
      page: page.name,
      status: 200
    }
    if( this.mayRead( page) ){
      return this.getPage( page, function( err, page ){
        if( err ){
          result.status = 500
          result.error  = err
        }else if( !that.canRead( page, true) ){
          result.status = 403
        }else{
          result.ctx  = page.saveContext()
          result.data = page.data
          result.body = page.getBody()
          if( page.isDraft() ){
            result.nondraftBody = page.getNondraftBody()
          }
        }
        return respondJson()
      })
    }else{
      result.status = 403
      return respondJson()
    }
  }

  if( verb == "putPage" || verb == "appendPage" ){
    var pagename = query.name || "RestPage"
    var page = this.lookup( this.wikinamize( pagename))
    var result = {
      version: SW.version,
      rid: req_id,
      verb: verb,
      page: page.name,
      status: 200
    }
    if( this.mayRead( page) ){
      return this.getPage( page, function( err, page ){
        if( err ){
          result.status = 500
          result.error  = err
        }else if( !that.mayEdit( page, true) ){
          result.status = 403
        }else{
          var new_data = null
          var new_body = query.body
          if( verb == "putPage" ){
            new_date = query.data
            if( new_data ){
              try{
                new_data = JSON.parse( new_data)
                new_body = that.wiki.injectBasicYaml( new_body, new_data)
                page.data = new_data
                // ToDo: handle {} => .data = null
              }catch( err ){
                // ToDo: handle error
                this.de&&bug( "Rest JSON parse err")
              }
            }else{
              new_data = that.wiki.extractBasicYaml( new_body)
              if( new_data ){
                page.data = new_data
              }
            }
          }else{
            new_body = page.getBody() + new_body
          }
          return that.putPage( page, new_body, function( err, page ){
            if( err ){
              result.status = 500
              result.error  = err
            }
            result.ctx  = page.saveContext()
            result.data = page.data
            result.body = page.getBody()
            if( page.isDraft() ){
              result.nondraftBody = page.getNondraftBody()
            }
            return respondJson()
          })
        }
        return respondJson()
      })
    }else{
      result.status = 403
      return respondJson()
    }
  }
  respond()
}


Session.redirect = function( req, url, code ){
// Push a redirect HTTP response
  if( !req )return
  code = code || 303
  if( !url ){
    if( !req.custom ){
      if( SW.test ){
        url = SW.protocol + SW.domain + ":" + SW.port
      }else{	      
        url = SW.protocol + SW.domain
      }
    }else{
      url = "/"
    }
  }
  var headers = [["Location", url]]
  this.pushCookies( headers)
  req.response.writeHead( code, headers)
  req.response.end()
  if( De ){
    req.bug = "redirect"
  }
  this.de&&bug( "Redirect, code:", code, "location:", url)
  return this
}

Session.pushCookies = function( http_headers ){
// Push important cookies about the session, helps to come back.
// code + page cookies makes it possible to retrieve a session in a wiki
// If session is gone, clear cookies. Clear all cookies if session is
// gone with this.byebye (ie DoByeBye).
// ToDo: study https://github.com/jed/cookies

  // If session is closed, I actually clear all these cookies
  var age = this.isGone ? 0 : 365 * 24 * 60 * 60
  var lasts = ""
  + ";expires=" + (new Date( Sw.timeNow + age * 1000)).toGMTString()
  + ";max-age=" + age
  // ToDo: handle premium domains
  + ";domain=" + "." + SW.domain
  // Prevent some XSS attacks
  // + ";path=/;HttpOnly"

  function push_cookie( name, value ){
    if( !age ){ value = "null" }
    http_headers.push( ["Set-Cookie", name + '=' + value + lasts])
  }
  
  // Per wiki code
  // ToDo: cipher code
  push_cookie( this.wiki.sessionIdCookieName(), this.byebye ? "" : this.sessionId )
  // Title, when available
  var title = this.wiki.getTitle( this)
  if( title && !this.byebye ){
    push_cookie(
      "sw_title_" + this.wiki.sessionIdCookieName(),
      encodeURIComponent( title)
    )
  }
  // ToDo: If logging out, forget the twitter name and ids?
  // If I clear these cookies, this interferes with other sessions that used them.
  // ie, when user gets back to such a session she is detected as not logged in and
  // is logged again but as a guest, because the script that could restore the cookies
  // has had no opportunity to run on the client side yet...
  // See the handling of /in special page.
  if( !age ){
    this.cookie_de&&bug( "Removing cookies about twitter")
    push_cookie( "sw_twitter_screenname")
    push_cookie( "sw_twitter_id")
    push_cookie( "sw_twitter_label")
    // If "hard" logout with DoByeBye, clear the cookies for all wikis
    if( this.byebye ){
      this.cookie_de&&bug( "Removing all cookies")
      var cookies = this.req.headers.cookie
      // Only a robot would do "bye bye" with no cookies... hence the test
      if( cookies ){
        cookies.replace( /sw_session_id([^=]*)=([^;]*)/g,
          function( _, id, code ){
            push_cookie( "sw_session_id" + id)
          }
        )
        cookies.replace( /sw_title_sw_session_id([^=]*)=([^;]*)/g,
          function( _, id, title ){
            push_cookie( "sw_title_sw_session_id" + id)
          }
        )
      }
    }
  }
  
  // Debug
  // Remember/forget debug mode
  if( this.isDebug && (age || this.wiki.isRoot()) ){
    this.de.cookie&&bug( "cookie about debug")
    if( !age && this.deep_de ){
      // I don't clear the debug cookie in deep debug mode, so that
      // i keep traces accumulate over multiple sessions, each new session
      // beeing set with isDebug = true thanks to the cookie beeing present
    }else{
      push_cookie( "sw_debug", this.wiki.getRoot().config.debugCode)
    }
  }

  if( true || !age ){
    this.deep_cookie_de&&bug( "Send headers & cookies :"
    , Sys.inspect( http_headers))
  }
  return http_headers
}


Session.respond = function( req, data, mime, nocookies ){
// This method basically pushes the result of the request
// to the client. It is called once per HTTP request.
  NDe&&bug( "respond")
  
  // Sometimes I issue fake requests because I need their side effects
  // ToDo: get rid of this somehow
  if( !req ){
    this.de&&bug( "No need to respond, fake request")
    return this
  }

  // Get back the response object that was attached to the request early on
  var res = req.response
  if( !res ){
    this.de&&bug( "BUG: Cannot respond, no response object ", Sys.inspect( req))
    this.de&&mand( false)
    return this
  }

  // If method was a POST, I try to redirect
  // see http://en.wikipedia.org/wiki/Post/Redirect/Get
  // This is basically to avoid issue with "repost" when user "reloads"
  var location
  if( !req.isRest
  && (!data || req.method == "POST")
  &&  !req.preventRedirect
  ){
    // ToDo: "/comeback" ?
    location = this.href( this.getCurrentPage())
               // Wiki.decodeUrl( this.hrefPath( this.getCurrentPage()))
    /*
    location = req.headers.referer
    // However, don't redirect to referer if current page changed
    if( !this.getCurrentPage().name.ends( location) ){
      // Redirect instead to the new page
      this.de&&bug( "Cannot redirect, new location:",
        this.getCurrentPage().name,
        "referer:", location
      )
      // Replace end of location (after last /) with new page's name
      location = location.replace(
        /[^\/]+$/,
        encodeURIComponent( this.getCurrentPage().name)
      )
      this.de&&bug( "new location:", location)
    }*/
  }else{
    if( req.isRest ){
      // "rest" methods are API requests, they don't
      // display a bookmarkable page and they do need a proper response, not a 303
      this.rest_de&&bug( "no redirect")
    }
  }

  // data = data.toUtf8()
  
  // Gzip compression. ToDo: not tested, I use ngnix
  var gzip = false
  if( Gzip && req.headers['accept-encoding'].includes( "gzip") ){
    this.de&&bug( "Gzip")
    var zipit = new Gzip
    zipit.init()
    gzip = data = zipit.deflate( data, "binary")
    zipit.end()
  }
  
  var headers = [
    ["Server", "SimpliWiki"]
  ]
  if( location ){
    headers.push( ["Location", location])
  }else{
    headers.push( ["Content-Type", mime || "text/html"])
    if( !gzip ){
      headers.push( ["Content-Length", data.length])
    }else{
      headers.push( ["Content-Encoding", "gzip"])
    }
    headers.push( ["Cache-Control", "no-store"])
  }
  
  // Enable cross domain stuff when called by kudocracy
  if( false && this.isKudocracy && this.isKudocracy.host ){
    headers.push( 
      [ 
        "X-Frame-Options",
        "Allow-From " + this.isKudocracy.host.replace( ":80", "" )
      ]
    );
    headers.push(
      [ 
        "Content-Security-Policy",
        "frame-ancestors 'self' " + this.isKudocracy.host.replace( ":80", "" ) + ";"
      ]
    );
  }
  
  // For logged user, we keep the login code in a cookie for a little while...
  if( !nocookies ){ 
    this.pushCookies( headers)
  }
  
  // 200 if regular response, 303 if redirect
  res.writeHead( location ? 303 : 200, headers)
  
  // Send body unless HEAD HTTP type of request
  if( req.method != "HEAD" && !location && data ){
    res.write( data, "utf8")
  }
  
  res.end()
  
  this.send_de&&bug( "Push done for current page:", this.getCurrentPage())
  if( De ){
    this.send_de&&mand( req.bug != "respond", "multiple send")
    req.bug = "respond"
  }
  return this
}

var touchScript = function sw_css_touch_device( flag ){
// client side. Patches css based on touch device detection
  if( flag === undefined ){
    flag = window.sw_is_touch_device;
    if( flag === undefined ){
      flag = !!Modernizr.touch;
    }
  }
  window.sw_is_touch_device = flag;
  document.documentElement.className 
  += ( flag ? " sw_touch" : "sw_no_touch" );
}


Session.html = function( page, title, body, editclosure ){
// Build THE html page

  var that = this

  // I collect javascript chunks that I will add to the head
  var javascript    = []
  var javascripttxt = []

  // Idem for CSS, it's better to load them before any script because it
  // makes it possible for the browser to load them in //
  var stylesheets   = []
  var stylesheettxt = []

  // And this for other stuff
  var buf           = []

  // Set some flags about the page's content

  var ishtml = !page || page.isHtml()
  // Only if safe for the user
  if( ishtml && !this.isFearless() ){
    that.de&&bug( "No html, only for lions")
    that.notify( "Jungle. DoTheLion?")
  }

  var head    = !this.isOembed
  var fb_like = page && this.getSessionData( "fbLike", page)
  var shrsb   = page && this.getSessionData( "shrsb", page) 

  // Deal with <title>
  if( ishtml ){
    title = title.replace( "Html", "")
  }
  if( title.includes( "HomePage") ){
    title = title.replace(
      "HomePage",
      this.wiki.getLabel()
    )
  }
  // title = title.replace( "HomePage", this.wiki.name)

  // Angular's script loading?
  var is_angular    = !this.isCurator && page && page.isAngular()
  var needs_angular = !this.isCurator && page && page.needsAngular()
  // Only if safe for the user
  if( needs_angular && !this.isFearless() ){
    that.de&&bug( "No angular, for lions only")
    that.notify( "Jungle! DoTheLion?")
    needs_angular = false
  }
  var sync_jquery   = needs_angular


  head && buf.push(
    '<!DOCTYPE HTML>',
    (needs_angular
      ? '<html xmlns:ng="http://angularjs.org">'
      : '<html>'
    ),
    '<head>',
    '<meta http-equiv="Content-Type" content="text/html; charset=utf-8">',
    '<meta http-equiv="Pragma" content="no-cache">',
    '<meta http-equiv="Expires" content="-1">',
    // ToDo: meta charset utf8, see HTML5 Boilerplace
    // http://www.chromium.org/developers/how-tos/chrome-frame-getting-started
    // JHR: breaks Facebook Connect & Twitter Anywhere...
    //'<meta http-equiv="X-UA-Compatible" content="IE=edge,chrome=1">',// Chrome Frame
    '<meta http-equiv="X-UA-Compatible" content="IE=edge">',
    '<meta name="viewport" content="width=device-width">', // iPhone
    "<title>", title, "</title>"
  );

  // Styles
  if( !ishtml ){
    head && buf.push(
      '<link rel="icon" href="/yanugred16.png" type="image/png"/>'
    )
    // Google fonts (commented out, not worth the delay)
    false && head && stylesheets.push(
      'http://fonts.googleapis.com/css?family=Droid+Sans|Droid+Sans:bold',
      'http://fonts.googleapis.com/css?family=Droid+Sans+Mono|Droid+Sans+Mono:bold'
    )
    // Bootstrap & Fontawesome
    stylesheets.push(
      'http://maxcdn.bootstrapcdn.com/bootstrap/3.3.2/css/bootstrap.min.css',
      'http://maxcdn.bootstrapcdn.com/bootstrap/3.3.2/css/bootstrap-theme.min.css',
      'http://maxcdn.bootstrapcdn.com/font-awesome/4.3.0/css/font-awesome.min.css'
    );
    // CSS, default, inlined in "inline" debug mode
    if( this.inline_de ){
      stylesheettxt.push( Sw.style)
    }else{
      stylesheets.push( "/simpliwiki.css")
    }
    // If config specified additionnal style, at wiki or user level
    var style = this.wiki.config.cssStyle
    // Only if user is safe
    if( style && !this.isFearless() ){
      that.de&&bug( "No style, only for lions")
      style = null
    }
    var is_less
    if( style && style != "noStyle" ){
      this.de&&bug( "wiki config cssStyle:", style)
      if( ".less".ends( style) ){
        is_less = true
      }
    }
    // User level is ok unless wiki level is set to "noStyle"
    if( !style || style != "noStyle" ){
      style = this.config.cssStyle || style
      if( this.config.cssStyle ){
        this.css_de&&bug( "user config cssStyle:", style)
      }
      if( style ){
        this.css_de&&bug( "css:", style)
      }
    }
    if( style && style != "noStyle" && !this.isCurator ){
      if( !SW.wikiword.test( style) ){
        this.css_de&&bug( "external css, url:", style)
        style = Wiki.htmlizeAttr( style)
        if( is_less ){
          // Check if lesscss.org was installed
          if( !Less ){
            that.css_de&&bug( "Cannot Less on url:", style)
          }else{
            buf.push( 
              "<link "
              + 'rel="stylesheet/less" href="', style,'" type="text/css"'
              + "/>"
            )
            javascript.push( "less")
          }
        }else{
          stylesheets.push( style)
        }
      }else{
        style = this.lookup( style)
        if( !page.isSensitive()
        && !page.isToDo()
        &&  style != page // Don't apply on itself
        ){
          if( style.isDraft() ){
            style = style.nondraft
          }
          if( !style.getBody() ){
            if( !style.wasIncarned() ){
              style.read( function( err, style_page ){
                that.de&&bug( "css, first visit, name:", style_page)
                // If this happens on the HomePage, I assume that the style
                // should be prefetched in the future
                if( page.isHome() && style && style.getBody() ){
                  that.wiki.addPrefetch( that, style)
                }
              })
            }
            // Use default, will use config specified next time if possible
            // See also "fetch" option in setOptions()
            // ToDo: I could add the page to the fetch option automatically...
            style = null
          }else{
            this.css_de&&bug( "using css, page:", style)
            // Use style, without the Yaml section however
            style = Wiki.injectBasicYaml( style.getBody(), {})
            if( is_less ){
              try{
                Less.render( Sw.style, function( e, css ){
                  if( e )throw e
                  style = css
                })
              }catch( err ){
                that.de&&bug( "Less error:", err)
              }
            }
            stylesheettxt.push( style)
          }
        }else{
          // Protect security access of sensitive informations
          this.css_de&&bug( "no css for page:", page)
          style = null
        }
      }
    }
  }

  // Markdown?
  if( page && page.isMarkdown() ){
    javascript.push( "markdown")
  }

  // If I load angular.js before jQuery, it does not work well
  // That's probably because of some bad interaction with Angular's
  // own definition of $ via some jQueryLite trickery
  // ToDo: I added sync_jquery since that
  function sw_load_angular(){
    if( window.sw_page_needs_angularize ){ loadfire( "sw_angularize.js") }
    loadfire().event( function( fire ){
      if( !fire.did( "jQuery") )return
      fire.load( "bower/angular/angular.js")
      return true
    })
  }
  // On DoAngular page, ToDo pages and "angular" tagged pages
  if( needs_angular ){
    // Load angular && maybe sw_angularize(), will run when in .ready()
    javascripttxt.push(
      "var sw_page_uses_angular = true\n"
      // ToDo: should ToDo() page require angularization?
      + (page.isToDo() ? "var sw_page_needs_angularize = true\n" : "")
      + sw_load_angular.toString()
      + "\nsw_load_angular()"
    )
  }
  // ToDo: study the logic of
  // http://code.google.com/p/pageforest/source/browse/#hg/examples/scratch
  // It may prove interesting to handle onload/onsave/onlog(in|out)...
  // ToDo: include more batteries
  // See: https://github.com/andyet/ICanHaz.js
  //   except I think that any div could do what is done with <script>, for
  //   more flexibility
  // See also underscore.js
  // And.. and... coffeescript! (let's get mad)
  // Maybe also a little bit of "backbone"
  // Is that the recipe for dynamite or nitro?

  // Facebook open graph meta data (some are reused for Shareaholic)
  var ogtype      = "article"
  var url         =  this.wiki.permalink( page ? page.name : "HomePage")
  var ogurl       = url
  var ogtitle     = Wiki.htmlizeAttr( this.wiki.getTitle() || this.wiki.name)
  var ogsite_name = Wiki.htmlizeAttr( page.wiki.getLabel( this, true))
  if( !ogsite_name ){ ogsite_name = this.wiki.getRoot().name }

  if( head && fb_like ){
    // ToDo: bug with @, at fb maybe
    if( true || !page.fullname().includes( "@") ){
      ogurl = ogurl.replace(
        "//" + SW.domain,
        "//apps.facebook.com/" + SW.name.toLowerCase()
      )
    }else{
      ogurl = ""
    }
    //.replace( "/HomePage", "/") ToDo: fix this
    var fbadmins = []
    if( this.facebookId ){
      fbadmins.push( this.facebookId)
    }
    // Facebook application id
    // See http://www.facebook.com/developers/apps.php
    if( SW.fbid ){ // in hooks.js
      fbadmins.push( SW.fbid)
    }
    // fbadmins = this.loginPage.data
    //if( fbadmins ){ fbadmins = fbadmins["FbAdmins"] }
    buf.push(
      '<meta property="og:type" content="article"/>',
      '<meta property="og:title" content="'     + ogtitle +'"/>',
      '<meta property="og:url" content="'       + ogurl + '"/>',
      '<meta property="og:site_name" content="' + ogsite_name + '"/>',
      '<meta property="og:app_id" content="'    + fbadmins.join( ",") + '"/>'
    )
  }

  // Universal Edit Button
  if( head && editclosure && !ishtml ){
    buf.push(
      '<link rel="alternate"'
      + ' type="application/x-wiki"'
      + ' title="Edit this page!"'
      + 'href=' + Wiki.htmlizeAttr( // Wiki.decodeUrl(
        this.hrefPath( page)
      ) + '?cid=' + editclosure + '"/>'
    )
  }

  // Oembed
  if( head
  &&  !page.isDo()
  &&  !page.isUser()
  &&  !page.isPrivate()
  ){
    buf.push(
      '<link rel="alternate"'
      + ' type="application/json+oembed"'
      + ' href=http://simpliwiki.com/oembed?url='
        + encodeURIComponent( this.permalinkTo( page))
      + '&format=json"'
      + ' title="' + ogtitle + '" />'
    )
  }
  if( false && this.isOembed ){
    buf.push( '<base href="' + this.wiki.getRoot().permalink( "") + '"/>')
  }
  NDe&&bug( "Html head: ", buf.join( "\n"))

  // virteal.com specific stuff
  // ToDo: analytics as a "premium" service, see
  // http://getclicky.com/#/whitelabel/
  if( head && this.wiki.name == "virteal" ){
    body += [
      '<div><a href="http://virteal.com/">&copy;2006-2014 Virteal</a></div>',
      ' <div align="right">',
      '<!-- Site Meter --> ',
      '<script type="text/javascript" src="http://s25.sitemeter.com/js/counter.js?site=s25virteal">' ,
      '</script> ',
      '<noscript> ',
      '<a href="http://s25.sitemeter.com/stats.asp?site=s25virteal" target="_top"> ',
      '<img src="http://s25.sitemeter.com/meter.asp?site=s25virteal"',
      'alt="Site Meter" width="40" height="15" />',
      '</a> ',
      '</noscript> ',
      //'<!-- Copyright (c)2006 Site Meter --></div>',
      //'<script src="http://track3.mybloglog.com/js/jsserv.php?mblID=2007020914290638"></script> ',
      (page && page.isHome()
      ?  '<script src="/yanugs.js" type="text/javascript"></script>' 
       + '<script>YanUgs.move()</script>'
      : ""),
      '<script src="http://www.google-analytics.com/ga.js" type="text/javascript"></script>',
      '<script type="text/javascript"> ',
      'try {',
      'var pageTracker = _gat._getTracker("UA-7243675-1");',
      'pageTracker._trackPageview();',
      '} catch(err) {}</script> '
    ].join( "\n")
  }

  // Scripts
  if( this.canScript ){
    // SimpliWiki's api (loaded synchronously elsewhere if angular, else it bugs)
    !needs_angular && javascript.push( "sw_api") //.js; sw_api()")
    if( true || !this.isTouch ){
      // My scroll cue hack
      javascript.push( "sw_scrollcue.min")
    }
    // ToDo: For custom domains, I should get the id from the AboutWiki's data
    if( this.custom ){
    }
    // Twitter anywhere
    if( this.needsTwitter ){
      this.needsTwitter = false
      // ToDo: DRY, see simpli.html building
      //javascript.push( 'http://platform.twitter.com/anywhere.js?'
      //  + 'id=' + SW.twid + '&v=1'
      //)
    }
    // CodeMirror editor, for Angular & Style pages
    // ToDo: host the file myself
    if( this.needsCodeMirror ){
      this.needsCodeMirror = false
      javascript.push( "codemirror")
    }
    // Do some wikify client side when possible
    if( !"tag_rfc".starts( page.name) ){
      javascript.push( "sw_wikify")
    }
  }

  // Style text & sheets
  if( stylesheets.length ){
    stylesheets.forEach( function( src ){
      buf.push( '<link rel="stylesheet" type="text/css" href="' + src + '">')
    })
  }
  // The "inline" style comes after the sheets, because they "overwrite" stuff
  if( stylesheettxt.length ){
    buf.push( "<style>", stylesheettxt.join( "\n"), "</style>")
  }
  // I add some class to the body, may help to tune custom CSS
  var visible = ' class="sw_page_' + (page && page.name)
  var kinds = page.getKinds()
  for( var ii in kinds ){
    visible += ' sw_kind_' + kinds[ii]
  }
  visible += '"'

  // Javascript text & files. ToDo: move this to the body?
  if( javascript.length ){
    buf.push( 
      // Asynch loader
      '\n<script src="/sw_load.js"></script>',
      '\n<script type="text/javascript">',
      'var sw_time_loaded = (new Date()).getTime()',
      javascripttxt.join( "\n"),
      sync_jquery
      ?   '</script>'
        + '\n<script src="/public/modernizr.min.js"></script>'
        + '\n<script type="text/javascript">'
        + '\n(' + touchScript + ')()'
        + '\n</script>'
        + '\n<script src="'
        + 'http://code.jquery.com/jquery-2.1.3.min.js'
        + '"></script>'
        + '\n<script src="http://maxcdn.bootstrapcdn.com/bootstrap/3.3.2/js/bootstrap.min.js"></script>'
        + '\n<script type="text/javascript">'
        + 'loadfire.fire( "jQuery")'
      : '\nloadfire( "jQuery", "google")',
      !needs_angular ? ""
      : '</script>\n<script src="'
       + '/sw_api.js'
       + '"></script>\n<script type="text/javascript">'
       + 'loadfire.fire( "/sw_api")'
    )
    var buf2 = []
    var all_in_cache = true
    javascript.sort().forEach( function( src ){
      buf2.push( '.load("/' + src.replace( /"/g, '\\"') + '.js")')
      if( all_in_cache && !Sw.fileIsCached( src + ".js") ){
        all_in_cache = false
      }
    })
    // If all files are available from the cache, let's build a big file
    if( all_in_cache ){
      var big      = []
      var big_name = ""
      javascript.sort().forEach( function( src ){
        big_name += src + "_"
        big.push( Sw.getCachedFileContent( src + ".js"))
      })
      Sw.cacheJsFile( big_name + ".js", big.join( "\n"))
      buf.push( '.load("/' + big_name + '.js")')
    }else{
      buf.push( buf2.join( "\n"))
    }
    buf.push( '</script>')
  }
  if( head ){
    buf.push( '</head><body', visible, '>')
  }else{
    buf.push( '<div id="simpliwiki">')
  }

  // Add pending notifications & "in page" notifications ("notify" directive)
  // Note: don't display that on Wii, screen is too small
  var notifications = !this.isWii && this.pullNotifications()

  // Don't confuse new visitors
  if( this.wiki.isEmpty()
  || this.wiki.isSandbox
  || this.wiki.isRoot() && this.isGuest()
  ){
    notifications = null
  }

  var in_page_notifications = !this.isWii && page.data && page.data.notify
  if( in_page_notifications ){
    if( notifications ){
      notifications = notifications
      .concat( [""], in_page_notifications.split( ". "))
    }else{
      notifications = in_page_notifications.split( ". ")
    }
  }
  if( notifications ){
    var count = 0
    var list = []
    var last_wikified = ""
    var wikified
    for( var ii in notifications ){
      var msg = notifications[ii]
      // Skip details
      if( "(".starts( msg) && !this.isDebug )continue
      wikified = this.wikify( notifications[ii])
      if( !wikified )continue
      last_wikified = wikified
      count++
      list.push( "<li>" + last_wikified + "</li>" )
    }
    if( count > 1 ){
      buf.push(
        ( 
          '<div id="sw_notifications" class="sw_boxed"><ul>'
          + list.join( "\n").replace(
              '<li></li>',
              '</ul><br><ul>'
            )
          + '</ul><span class="glyphicon glyphicon-ok sw_what_close"></span></div>'
        ).replace( "<ul></ul><br>", "") // ToDo: should not be necessary
      )
    }else if( count ){
      buf.push(
        '<div id="sw_notifications" class="sw_boxed">'
        + last_wikified
        + '<span class="glyphicon glyphicon-ok sw_what_close"></span></div>'
      )
    }
  }

  buf.push(
    body,
    (this.isDebug ? '<div id="sw_traces"></div>' : "")
  )

  if( head ){
    buf.push( '</body></html>')
  }else{
    buf.push( '</div>')
  }

  return buf.join( "\n")
}


require( "./globals" ).inject( Session, exports );
