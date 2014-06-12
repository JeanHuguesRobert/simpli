// ----------------
// section: page.js, export
//  class Page

function Page( wiki, name, body, proto, inherited, err ){
// A Page object belongs to a wiki and has a name in it

  De&&mand( wiki && name, "bad page")
  NDe&&bug( "new Page: ", Sys.inspect( name))

  this.wiki  = wiki
  this.name  = name
  this.body  = body
  this.proto = proto
  // ToDo: my eval

  // If page inherits from a parent wiki, let's remember that.
  // From now on the page will however have it't own content.
  // ToDo: if local content does not change, body should mirror parent's
  // page body, but this not the case today, if parent's page change,
  // child's page does not get updated. It's only when the wiki is
  // restarted that the page will refetch it's content from it's parent.
  // That's not good.
  this.inherited = inherited
  if( inherited ){
    wiki.deep_de&&bug( "inheritedNewPage:", name)
    // Usually it's the non draft body that is inherited
    De&&mand( this.body == inherited.body
      || (inherited.nondraft && this.body == inherited.nondraft.body),
      "inherited new body mismatch"
    )
  }

  // Code pages are contained in the wiki's PrivateContext page
  // Why: avoid excessive disk access
  if( this.isCode() ){
    if( this != this.wiki.contextPage ){
      this.containerPage = this.wiki.contextPage
    }else{
      this.bug_de&&bug( "OMG, virtual container in virtual container???")
    }
  }

  // Look for data about body, either in property or Yaml embedded in string body
  if( body && body.data ){
    this.data = body.data
  }else{
    // ToDo: what about inherited pages? I should get the data from the parent
    // maybe? But that should be a copy.
    this.data = wiki.extractBasicYaml( body)
    // this.body = wiki.injectBasicYaml( body, {})
  }

  this.lastSession      = null
  this.timeCreated      = Sw.timeNow
  this.timeLastSession  = null
  this.timeLastModified = null
  this.lastVisitorName  = ""
  this.lastWriterName   = ""
  this.countVisits      = 0
  this.enterMap         = {}
  this.exitMap          = {}
  this.resetLinks()
  this.err = err
}

var PageProto = Page.prototype = {};
MakeDebuggable( PageProto, "Page")

PageProto.assertIsPage = function(){
  // Help migrate from pagename strings to Page objects
  return true
}

PageProto.toString = function(){
  return this.name
  // return "<Page " + this.wiki.fullname() + " " + this.name + ">"
}

PageProto.fullname = function(){
  return this.wiki.fullname() + this.name
}

PageProto.getStore = function(){
  return this.wiki.pageStore
}

PageProto.getStoreUrl = function(){
  return this.getStore().getUrl( this.name)
}

PageProto.dump = function( sep ){
  var buf = ["Page"]
  var that = this
  var attr = "name wiki body nondraft data"
  var val
  attr = attr.split( " ").map( Contexted( this, function( item ){
    val = this[item]
    if( !val )return ""
    return item + ": "
    + val.toString().substr( 0, 30).replace( /\n/g, "\\n")
  }))
  buf = buf.concat( attr)
  return buf.join( sep ? sep : "\n")
}
//Session.declareIdempotentGetter( "dump")

PageProto.get = function( key, visited ){
// Access "property" of page
  if( this.data && (key in this.data) ){
    return this.data[key]
  }
  // ToDo: not tested, not used, but interesting
  if( this.proto ){
    visited || (visited = {})
    if( visited[this] ){
      this.de_bug&&bug( "Circular ref:", key)
      return null
    }
    visited[this] = true
    return this.proto.get( key, visited)
  }
}

PageProto.set = function( key, value ){
// Write access to property/attribute of page.
// This does not update the page in store.
// To update the page in store, please use .write().
  this.data || (this.data = {})
  if( this.data[key] != value ){
    this.touch()
  }
  if( value ){
    this.data[key] = value
  }else{
    delete this.data[key]
    var empty = true
    for( var key in this.data ){
      empty = false
      break
    }
    if( empty ){
      this.data = null
    }
  }
  return value
}

Page.lookup = function( wiki, pagename, default_name ){
// Static
  De&&mand( wiki )
  De&&mand( pagename )
  pagename = pagename.toString()
  // __defineGetter__, __proto__, etc... can't be redefined...
  // I am pretty sure that some web sites will behave weirdly if you use
  // __proto__ as a user input in some fields...
  if( "_" === pagename.charAt( 1) && "_" === pagename.charAt( 0) ){
    if( pagename === "__defineGetter__" ){
      pagename = "__Buggy_defineGetter__"
    }else if( pagename === "__proto__" ){
      pagename = "__Buggy_proto__"
    }
  }
  // If page was already signaled, return it
  var page = wiki.allPages[pagename]
  // However, if a default was provided, don't return empty page
  if( page && (!default_name || !page.isNull()) ){
    De&&mand( page.name, "no name for " + pagename )
    return page
  // Try default page
  }else if( default_name ){
    page = wiki.allPages[default_name]
    if( page )return page
  }
  // Deal with case insensitivity for invitation codes & hashtags
  var othername = pagename.toLowerCase()
  if( "code".starts( othername) ){
    othername = othername.substr( "code".length)
    othername = othername.toLowerCase().capitalize()
    othername = "Code" + othername
  }else if( '#'.starts( othername) ){
    // othername = lowername
  }else{
    othername = null
  }
  if( othername ){
    page = wiki.allPages[othername]
    if( page ){
      De&&mand( page.name )
      return page
    }
  }
  // Create a new Page object and remember it at wiki's level
  page = new Page( wiki, pagename, null, null, false)
  this.de&&mand( !page.wasIncarned() )
  this.de&&mand( page.name )
  wiki.allPages[page.name] = page
  // Deal with invitation code pages & hashtags, case insensitive
  if( othername ){
    wiki.allPages[othername] = page 
  }
  return page
}

PageProto.incarnFetch = function( body, proto, inherited, err ){
// Called when page is fetched from store
  // Some insane sanitization
  if( body && !inherited ){
    body = body.replace( /\r/g, "")
    if( body.frontLine() == "Original" ){
      this.bug_de&&bug( "Unusual 'Original' in fetched body")
      if( this.wiki.isRoot() ){
        body = "Buggy Original\n" + body.butFrontLine()
        //De&&mand( false, "BUGGY ORIGINAL")
      }
    }
  }
  this.body      = body
  this.proto     = proto
  this.inherited = inherited
  if( inherited ){
    this.store_de&&bug( this.wiki, ", inheritedIncarn: " + this.name)
    if( this.body != inherited.body
    && (inherited.nondraft 
      && (this.body != inherited.nondraft.body
        || (!inherited.nondraft.body && !this.body) )
      )	
    ){
      De&&bug_de&&bug( "BUG? bad body")
      De&&bug_de&&bug( "this.body: ", Sys.inspect( this.body).substr( 0, 10))
      De&&bug_de&&bug( "inherited body: ", Sys.inspect( inherited.body).substr( 0, 10))
      if( inherited.nondraft ){
        De&&bug_de&&bug( "inherited.nondraft.body: ",
          Sys.inspect( inherited.nondraft.body).substr( 0, 10))
      }
    }
    De&&mand( this.body == inherited.body
      || ( inherited.nondraft 
        && (inherited.nondraft.body == this.body
          || (!inherited.nondraft.body && !this.body)
        ))
      || (!inherited.nondraft && this.body == ""),
      "inherited incarned body mismatch"
    )
    if( inherited.containerPage ){
      this.containerPage = this.wiki.lookupPage( inherited.containerPage.name)
    }
  }
  // The "data" always come from the non draft version
  // ToDo: quid of inherited data?
  if( this.nondraft ){
    this.data = this.nondraft.data
  }else{
    this.data = this.wiki.extractBasicYaml( this.getBody())
  }
  this.err = err ? err : 0
  return this
}

PageProto.incarnRestore = function( body, inherited, err ){
// This method gets called when the raw body content of a page is fetched
// from the PageStore.
// It updates the non draft version of the page using that raw body.
// The raw body container a __ctx__ section.
// Returns either This or the non draft page if there is one.
  var page = this
  // Process context data
  var body_and_ctx = page.extractBodyAndJsonContext( body)
  body = body_and_ctx.body
  var ctx = body_and_ctx.context
  // Always restore in the nondraft page if there is draft version now
  var was_draft = !!page.nondraft
  if( page.nondraft ){
    page.store_de&&bug( "Draft, restoreContext")
  }else{
    page.store_de&&bug( "restoreContext")
  }
  var nondraft = page.nondraft || page
  nondraft.assertIsPage()
  if( page.nondraft ){
    page.nondraft.incarnFetch( body, null, inherited, err) // null proto
    page.nondraft.restoreContext( ctx)
    // Update draft
    page.incarnUpdate()
  }else{
    page.incarnFetch( body, null, inherited, err)
    page.restoreContext( ctx)
  }
  if( page.de ){
    if( was_draft ){
      if( !page.nondraft ){
        page.draft_de&&bug( "was draft, restoreContext, isn't anymore")
      }
    }else{
      if( page.nondraft ){
        page.draft_de&&bug( "wasn't draft, restoreContext, became draft")
      }
    }
  }
  if( page.nondraft ){
    page.store_de&&bug( "Draft, incarned nondraft version")
    nondraft = page.nondraft
    De&&mand( page.nondraft.wasIncarned() )
    De&&mand( page.isDraft() )
  }else{
    page.store_de&&bug( "Incarned")
    nondraft = page
    De&&mand( page.wasIncarned() )
    De&&mand( !page.isDraft() )
  }
  return nondraft
}

PageProto.incarnBody = function( body, err ){
// Set the body content of the page.
// If "err" is "dirty", then it means that page is not in sync with store.
// If "err" is "pending", then it means either a read or write is ongoing.
// Yaml section is parsed and data are extracted from it.
  this.body = body
  this.err  = err
  if( !this.isDraft() ){
    var data = Wiki.extractBasicYaml( body)
    // ToDo: quid if no data? Why keep previous ones?
    if( data ){
      this.data = data
    }
  }
}

PageProto.incarnErr = function( err ){
  this.err = err
}

PageProto.incarnDraft = function(){
  this.de&&mand( !this.isDraft() )
  var page = this.nondraft = new Page( this.wiki, this.name)
  page.de&&mand( !page.isDraft() )
  page.incarnFromPage( this)
}

PageProto.incarnFromPage = function( from, with_body ){
// Incarn this page using data from another one
// Note: existing body is kept unless specified otherwise using with_body
  var page = this
  if( !page.body || with_body ){ page.body = from.body }
  page.containerPage = from.containerPage
  page.inherited     = from.inherited
  page.err           = from.err
  page.data          = from.data
  page.proto         = from.proto
  page.lastSession      || (page.lastSession      = from.lastSession)
  page.timeLastSession  || (page.timeLastSession  = from.timeLastSession)
  page.timeLastModified || (page.timeLastModified = from.timeLastModified)
  page.lastVisitorName  || (page.lastVisitorName  = from.lastVisitorName)
  page.lastWriterName   || (page.lastWriterName   = from.lastWriterName)
  page.countVisits += from.countVisits
  // Count got wrong at some point in early 2011
  if( page.countVisits > 10000 ){
    // That was mainly for the "HomPage" ans the "User" pages
    page.countVisits = 100
  }
  page.resetLinks()
  page.err = page.err
}

PageProto.incarnUpdate = function( from ){
// If page is a draft, reincarn it using fresh data from store
// "from" defaults to current non draft page
// Note: draft body is kept of course
  if( !this.isDraft() )return
  this.incarnFromPage( from || this.nondraft)
}

PageProto.wasStored = function(){
// Returns true if page is known to exists in store, presumably with
// same content as local body.
// Returns false if page is not in synch with store, ie when page is dirty.
// Returns false if some error occured when last read or write was attempted.
// Returns true if page is beeing synchronized with store, ie isPending()
// Note: this is optimistic, but anyway there is nothing sane to do until the
// pending result is delivered.
  return !!(this.body && (!this.err || this.isPending()))
}
PageProto.declareIdempotentPredicate( "wasStored")

PageProto.isDirty = function(){
// Returns true if local content is not in synch with store
  return this.err == "dirty"
}

PageProto.setDirty = function(){
  this.err = "dirty"
}

PageProto.isPending = function(){
// Returns true if some IO is going on (read or write) with the result pending
  return this.err == "pending"
}

PageProto.setPending = function(){
  this.err = "pending"
}	

PageProto.dequeueCb = function( err ){
  if( this.queuedRequest.length == 0 ){
    this.err = err
    return
  }
  var cb = this.queuedRequest.shift()
  cb.call( this)
}

PageProto.isVirtual = function(){
// A virtual page has it's content stored inside another page.
// ToDo: have PrivateContext, PrivateCodes & RecentStamps be stored into
// AboutWiki
  if( this.containerPage ){
    this.containerPage.isContainer = true
    return true
  }else{
    return false
  }
}

PageProto.isVirtualStore = function(){
// A virtual store page is a page that contains other pages, so called virtual
// pages. These pages are either small or frequently accessed page associated to
// the wiki. This includes all the pages that are preloaded when a wiki is
// is initialized.
  return this.isContainer
}

PageProto.getVirtualBody = function( name ){
// Return the (JSON) content of a virtual page
  this.isContainer = true
  return this.get( "Page" + name)
}

PageProto.setVirtualBody = function( name, body ){
// Set the (JSON) content of a virtual page
  this.isContainer = true
  return this.set( "Page" + name, body)
}

PageProto.devirtualize = function( cb ){
// Move page from virtual store to regular store (ie PageStore)
  if( this.isDraft() )return this.nondraft.devirtualize( cb)
  this.de&&mand( this.isVirtual() )
  var that = this
  this.read( function( err, page ){
    if( err ){ return cb.call( that, err, that) }
    if( !that.isVirtual() ){ return cb.call( that, 0, that) }
    var container = that.containerPage
    var content
    that.containerPage = null
    that.write( that.getBody(), function( err, page ){
      if( err ){
        that.containerPage = container
        return cb.call( that, err, page)
      }
      content = container.getVirtualBody( that.name)
      container.setVirtualBody( that.name, null)
      container.write( that.container.getBody(), function( err, page ){
        if( err ){
          container.setVirtualBody( that.name, content)
          that.containerPage = container
        }
        cb.call( that, err, that)
      })
    })
  })
}

PageProto.virtualize = function( container, cb ){
// Move page from store to virtual store
  this.de&&mand( !this.isVirtual() )
  if( this.isDraft() )return this.nondraft.virtualize( container, cb)
  var that = this
  this.containerPage = container
  var oldbody = this.getBody()
  this.read( function( err, page ){
    var body = page.getBody()
    that.write( body || oldbody || "!", function( err, page ){
      cb.call( that, err, page)
    })
  })
}

PageProto.read = function( cb, local ){
// Get content from store or cache, then call cb( err, page)
// If page is a draft, content is put in the attached non draft page
// Also deals with "virtual stores" for "virtual" pages.
// Also deals with "proxy" pages that are stored elsewhere on the Net.

  var that = this
  var page = this

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
  && !this.wiki.isRoot()
  && ("Original" == cached.body.frontLine()
    || (page.wasInherited() && page.wasDeleted() )
  ) 

  // Also force reload if config says so
  var cacheable = !this.wiki.config.noCache

  if( !need_original
  &&  cacheable && cached && cached.wasIncarned()
  // If draft, make sure non draft page was incarned, ToDo: remove
  && (!page.nondraft || page.nondraft.wasIncarned())
  && (local || !page.isProxy())
  ){
    return !cb ? page.body : cb.call( this, page.err, page)
  }

  // If draft page, fetch the nondraft content
  if( this.isDraft() ){
    return this.nondraft.read( function( err, page ){
      // Update draft
      that.incarnUpdate()
      cb.call( that, err, that)
    })
  }
  // If page is "virtual" it is stored in a container page
  if( this.isVirtual() ){
    this.de&&mand( !this.isDraft(), "read virtual draft" )
    this.deep_store_de&&bug( "Virtual read, from:", this.containerPage)
    var that = this
    // Try to get from container page
    return this.containerPage.read( function( err, page ){
      // Fall back to store if unable to fetch container
      if( err ){
        page.store_de&&bug( "virtual read, issue with container:",
          that.containerPage
        )
        return that.wiki.fetchPage( that.name, function( err, page){
          // Update draft if any
          that.incarnUpdate()
          cb.call( that, err, that)
        })
      }
      var body = need_original ? null : page.getVirtualBody( that.name)
      // Fall back to store if container does not contain specified page
      if( body ){
        // OK, I got the content from the container
        try{
          body = JSON.parse( body)
        }catch( err ){
          that.bug_de&&bug( "virtual body, JSON err:", err, "body:", body)
          body = null
        }
      }
      // Fall back to store if container does not contain specified page
      if( !body || body.frontLine() == "Original" ){
        // Don't do it for "Code" pages, they must be in "PrivateContext"
        if( page.isCode() ){
          return cb.call( that, 1, that)
        }
        page.store_de&&bug( "virtual read, try store, page:", page)
        return that.wiki.fetchPage( that.name, function( err, page ){
          // Update draft if any
          that.incarnUpdate()
          // Make sure next write will put in container
          that.de&&mand( that.containerPage )
          cb.call( that, err, that)
        })
      }
      // I incarn the page and
      // deal with "AboutXxxx" page's prototype if any.
      return that.wiki.fixProto(
        that.incarnRestore( body, false, 0),
        once( function vs_fixproto_cb(){ cb.call( that, err, that) })
      )	
    })
    // Never reached
  }

  // "proxy" pages are stored somewhere else on the Internet
  if( this.isProxy() && !local ){
    var url = this.getProxy()
    if( url ){
      if( this.wiki.fetchRemotePage( url, this.name, function( err, page ){
        // Update draft if any
        that.incarnUpdate()
        cb && cb.call( that, err, that)
        })
      ){
        return
      }
    // empty proxied pages are fetched from the local store
    }else{
    }
  }

  // Non virtual pages are stored in the wiki's PageStore
  return this.wiki.fetchPage( this.name, function( err, page ){
    // Update draft if any
    that.incarnUpdate()
    cb && cb.call( that, err, that)
  })

}

PageProto.getBodyWithJsonContext = function(){
// Returns current body plus JSON encoded page's context data.
// This is a serialized version of the page, with all data.
// This is the encoding I use when I store a page inside another "container"
// page, so called "virtual" pages.
  var ctx  = JSON.stringify( this.saveContext())
  var body = this.body	// ToDo: getBody()?
  body = this.extractBodyAndJsonContext( body).body
  body = body.replace( /\r/, "") + "\r\n__ctx__\r\n" + ctx
  return body
}

PageProto.extractBodyAndJsonContext = function( body ){
// Returns {body:str,context:obj_or_null}
// "body" is encoded like Page.getBodyWithJsonContext() does
  var ctx = null
  var ii
  var sep = "\r\n__ctx__\r\n"
  if( body && (ii = body.lastIndexOf( sep)) != -1 ){
    ctx  = body.substr( ii)
    body = body.substr( 0, ii)
    try{
      ctx = JSON.parse( ctx.substr( sep.length))
    }catch( err ){
      this.wiki.error(
        "JSON, page.name:", this.name,
        "err:", Sys.inspect( err),
        "ctx:", ctx.substr( 0, 4).replace( "\n", "\\n")
      )
      ctx = null
    }
  }
  return { body: body, context: ctx }
}


PageProto.write = function( body, cb ){
// Writes page to store (unless draft) then calls cb( err, page)
// If page is draft, content is saved locally only, not in store.
// Note: this.data takes over whatever Yaml section is in the body.
  var that = this
  // There is never a good reason to write an empty page, refuse
  // It is just too dangerous in case of bugs.
  // The proper way is to "delete" the page explicitely.
  if( !body ){
    this.de&&mand( body, "don't write empty page")
    this.wiki.error( "Attempt to empty " + this)
    return cb.call( this, 1, this)
  }
  body = this.wiki.injectBasicYaml( body, this.data)
  this.incarnBody( body, 0)
  // If draft, don't write to store
  if( this.isDraft() ){
    this.deep_de&&bug( "Don't store, draft")
    return cb.call( that, 0, that)
  }
  if( this.isVirtual() ){
    this.store_de&&bug( "Virtual write, into:", this.containerPage,
      "wiki:", that.wiki)
    var jsonbody = JSON.stringify( this.getBodyWithJsonContext())
    this.containerPage.setVirtualBody( this.name, jsonbody)
    // Deal with "AboutXxxx" proto data
    return this.wiki.fixProto( this, function(){
      // If content is stored in PrivateContext, writes are buffered
      if( that.containerPage == that.wiki.contextPage ){
        that.containerPage.touch()
        that.wiki.touch( that) // hard. ToDo: understand bug
        return cb.call( that, 0, that)
      }
      // Else I write the container page now
      return that.containerPage.write(
        that.containerPage.getBody(),
        function( err, page ){
          cb.call( that, err, that)
        }
      )
    })
    // Never reached
  }      
  return this.wiki.putPage( this, body, cb)
}

PageProto.wasIncarned = function(){
// Returns true if page was incarned (ie was fetched from store)
// Note: returns true when page was fetched even when such fetch failed.
  if( this.nondraft ){
    return this.nondraft.wasIncarned()
  }
  if( false && this.inherited ){
    return this.inherited.wasIncarned()
  }
  return !!((this.body !== null || this.err) && this.wiki.allPages[this.name])
}
PageProto.declareIdempotentPredicate( "wasIncarned")

PageProto.isVoid = function(){
// Returns true if page is empty
// Returns false if page's body is unknown because page was never incarned
// See also .isNull()
  return this.wasIncarned() && this.getBody().length === 0
}
PageProto.declareIdempotentPredicate( "isVoid")

PageProto.wasDeleted = function(){
// Returns true if page was fore sure deleted.
// Return false if it was not or was not incarned.
// Side effect on links list: clear it if page was deleted
  if( this.nondraft )return this.nondraft.wasDeleted()
  if( !!(this.getBody() && "Deleted".starts( this.getBody())) ){
    this.resetLinks()
    return true
  }else{
    return false
  }
}
// I know that it does a small side effect, it's ok
PageProto.declareIdempotentPredicate( "wasDeleted")

PageProto.isNull = function(){
// Return true if page's content is basically empty, whatever the reason
// See also .isVoid()
  if( false && this.inherited ){
    return this.inherited.isNull()
  }
  if( !this.wasIncarned()
  ||  !this.body
  ||  this.body.length === 0
  ||  "Deleted".starts( this.body)
  ){
    return true
  }
  return false
}
PageProto.declareIdempotentPredicate( "isNull")

PageProto.resetLinks = function(){
// Forget about links from this page to other pages.
// This is called when the page is displayed, prior to calls to
// Session.trackBacklink(), that in turn calls Page.trackLinkTo()
  this.links = {}
}

PageProto.getLinks = function(){
  var list = []
  for( var item in this.links ){
    list.push( item)
  }
  return list.sort()
}

PageProto.getBacklinks = function( with_private ){
  var list = []
  this.wiki.forEachBacklink( this, with_private, function( referer ){
    list.push( referer.name)
  })
  return list.sort()
}

PageProto.trackLinkTo = function( otherpage ){
// Track link from this page to some other page. Does not track the
// corresponding back link.
// Private. Called by Session.trackBacklink( page, referer)
  this.links[otherpage.name] = otherpage
}

PageProto.linksTo = function( otherpage ){
// Check if there is a known link in this page to the other page
// Note: this is based on what was tracked when the page was last displayed
  return !!this.links[otherpage.name]
}

PageProto.trackVisit = function( from_page ){
  
}

PageProto.getBody = function( nondraft ){
// Returns either the current or non draft text body, as a string.
// Note: never returns null, even for not incarned pages, returns "" instead.
// The body of inherited page is always the non draft version.
  if( nondraft ){
    if( this.nondraft ){
      return this.nondraft.getBody()
    }else{
      return ""
    }
  }
  if( false && this.inherited ){
    if( this.inherited.nondraft ){
      return this.inherited.getNondraftBody()
    }else{
      return this.inherited.getBody()
    }
  }
  return this.body || ""
}

PageProto.getNondraftBody = function(){
// Return string version of body of nondraft version of page.
// Returns "" if no nondraft version (+ warning)
  if( this.nondraft ){
    return this.nondraft.body || ""
  }else{
    this.bug_de&&bug(
    "BUG? attempt to get null nondraft body:", this)
    return ""
  }
}
PageProto.declareIdempotentGetter( "getNondraftBody")

PageProto.touch = function(){
  this.wiki.touch()
  return 
}

PageProto.isParent = function(){
  return this.kindIs( "Parent")
}
PageProto.declareIdempotentGetter( "isParent")


PageProto.getParentPageName = function(){
  if( !this.isParent() )return this.name
  return this.name.substr( "Parent".length)
}
PageProto.declareIdempotentGetter( "getParentPageName")

PageProto.wasInherited = function(){
  return !!this.inherited
}
PageProto.declareIdempotentPredicate( "wasInherited")

PageProto.isDraft = function(){
// Returns true if page is a "draft"
// Note: all draft pages have a "nondraft" property
  return !!this.nondraft
}
PageProto.declareIdempotentPredicate( "isDraft")

PageProto.draft = function(){
// Save a "non draft" version of the page that can be easely restored.
// See .stamp() to forget non draft version.
// See .undraft() to restore non draft version.
  if( this.isDraft() )return false
  if( this.isVirtualStore() )return false
  // Remember the previous content
  var page = this
  var p = this.wiki.allPages[page.name]
  if( !p ){
    De&&bug( this, "badDraft:", page, "no previous content... BUG")
    De&&mand( false)
  }
  De&&mand( p === page )
  De&&mand( !p.nondraft )
  p.incarnDraft()
  this.draft_de&&bug( "draft original is kept")
  if( !p.nondraft.wasIncarned() ){
    this.draft_de&&bug( "not incarned original, page:", p)
  }else{
    this.draft_de&&bug( "incarned original, page:", p)
  }
  this.wiki.trackDraftPage( this)
  De&&mand( page.nondraft )
  De&&mand( this.isDraft() )
  return this
}

PageProto.stamp = function(){
// Forget "non draft" version of a page.
  if( !this.isDraft() )return false
  this.nondraft = null
  this.wiki.trackDraftPage( this)
  return true
}

PageProto.undraft = function(){
// Restore page's content using previously saved "non draft" version.
  if( !this.isDraft() ){
    this.bug_de&&bug( "useless undraft, page: ", this)
    return false
  }
  this.de&&bug( "from original")
  var nondraft = this.nondraft
  this.nondraft = null
  this.incarnFromPage( nondraft, true) // true => with body
  De&&mand( !this.isDraft() )
  this.wiki.trackDraftPage( this)
  return true
}

PageProto.setVisitor = function( session ){
  this.setLastSession( session)
  return this
}
  
PageProto.session = function(){
// Returns user session if page is a user name
  return this.wiki.getSession( this.name)
}
PageProto.declareIdempotentGetter( "session")

PageProto.setLastSession = function( session ){
  if( session.isBot )return
  if( session != this.lastSession ){
    this.countVisits++
  }
  this.lastSession = session
  this.timeLastSession = Sw.timeNow
  this.touch()
  return this
}

PageProto.lastVisit = function(){
  return this.lastSession
}
PageProto.declareIdempotentGetter( "lastVisit")

PageProto.visitCount = function(){
  return this.countVisits
}
PageProto.declareIdempotentGetter( "visitCount")

PageProto.lastVisitor = function(){
// Returns userName() of last visitor
  var session = this.lastVisit()
  return session ? session.userName() : this.lastVisitorName
}
PageProto.declareIdempotentGetter( "lastVisitor")

PageProto.timeVisited = function(){
  return this.timeLastSession
}
PageProto.declareIdempotentGetter( "timeVisited")

PageProto.setWriter = function( username ){
  NDe&&bug( "Set writer on ", this, " to ", username)
  this.lastWriterName = username
  this.timeLastModified = Sw.timeNow
  this.touch()
}

PageProto.lastWriter = function(){
  return this.lastWriterName
}
PageProto.declareIdempotentGetter( "lastWriter")

PageProto.timeModified = function(){
  return this.timeLastModified
}
PageProto.declareIdempotentGetter( "timeModified")

PageProto.isHot = function( ignore_sessions ){
// A page is "hot" when some activity occured about it recently
// Note: hot => !cold but the inverse is not true because in addition
// to not beeing "hot" a "cold" page must also have received no visitors
// for some time.
  var session = this.session()
  // User page have .session attached, if session is alive, page is hot
  if( !ignore_sessions && session && !session.isAway() ){ return true }
  return !!this.wiki.allHotPages[this.name]
}
PageProto.declareIdempotentPredicate( "isHot")

PageProto.setHot = function( restore ){
  De&&mand( !"PrivateContext".starts( this.name),
    "hot PrivateContext: " + this.name)
  // Don't hotify copies, too much noise
  if( this.isCopy() )return false
  // Don't hotify version rollback pages
  if( "UserRestore".starts( this.name) )return false
  // Don't hotify AboutWiki, would change PrivateContext for nothing
  if( this == this.wiki.aboutwikiPage )return false
  // Don't hotify virtual pages, useless
  if( this.isVirtual() )return false
  // Don't hotify virtual containers, useless
  if( this.isVirtualStore() )return false
  if( this.wasDeleted() )return false
  if( this.wasIncarned() && this.isVoid() )return false
  // Set .timeLastSession, unless called by some .restoreContext()
  if( !restore ){
    this.timeLastSession = Sw.timeNow
  }
  this.wiki.allHotPages[this.name] = this
  return true
}

PageProto.clearHot = function(){
  if( !this.wiki.allHotPages[this.name] )return false
  delete this.wiki.allHotPages[this.name]
  return true
}

PageProto.isCold = function(){
// A page is cold unless it is hot obviously.
// But only not visited pages eventually become truely cold.
  // Page is cold if it is empty
  if( this.wasIncarned() && this.isVoid() )return true
  // Page is cold if it was not visited
  if( !this.timeVisited() )return true
  // Page is not cold if it was visited recently
  if( this.timeVisited() > Sw.timeNow - SW.hotDelay ){
    return false
  }
  if( this.isHot() )return false
  return true
}
PageProto.declareIdempotentPredicate( "isCold")

PageProto.trash = function(){
// Get rid of "draft" content, get back to previous stamped page
  if( this.isDraft() ){
    this.undraft() 
    return true
  }
  return false
}

PageProto.kindIs = function( kind ){
  if( !this.cachedKinds ){ this.cachedKinds = {} }
  var cached // = this.cachedKinds[kind]
  if( cached === true || cached === false )return cached
  return this.cachedKinds[kind]
  = (kind.starts( this.name)
  && ( (this.name.substr( kind.length, 1)
    == this.name.substr( kind.length, 1).capitalize())
    || "Id".ends( kind))
  )
}

PageProto.getKinds = function(){
// returns ordered list of "kinds", longest first
// Note: result may vary depending on cache
// ToDo: is this a bug or a feature?
  var cached_kinds = this.cachedKinds
  if( !this.cachedKinds )return []
  var list = []
  for( var key in cached_kinds ){
    if( cached_kinds[key] ){ list.push( key) }
  }
  list = list.sort( function( a, b ){
    if( a.length < b.length )return 1
    if( a.length > b.length )return -1
    if( a < b )return -1
    if( a > b )return 1
    return 0
  })
  return list
}

PageProto.isPublic = function(){
  return this.kindIs( "Public")
}
PageProto.declareIdempotentPredicate( "isPublic")

PageProto.isUser = function(){
  return this.kindIs( "User")
  || this.kindIs( "CopyUser")
}
PageProto.declareIdempotentPredicate( "isUser")

PageProto.userName = function(){
  return this.kindIs( "User") ? this.name.substr( "User".length) : ""
}

PageProto.isUserId = function(){
// Returns true if page describes a User (see that class)
  return this.kindIs( "UserId")
  ||     this.kindIs( "WikiId")
  ||     this.kindIs( "TwitterId")
  ||     this.kindIs( "MailId")
  ||     this.kindIs( "DropboxId")
}

PageProto.getService = function(){
// Returns the service that the user id page references.
// Returns "" if page is not a user id page.
  if( !this.isUserId() ){
    this.bug_de&&bug( "Attempt to get service on a non user id page")
    return ""
  }
  var ii = this.name.indexOf( "Id")
  return this.name.substr( 0, ii)
}

PageProto.getId = function(){
// Returns the id part of a user id page. This is the unique id local to
// the service. For "Mail", this is the mail address.
  if( !this.isUserId() )return ""
  var ii = this.name.indexOf( "Id")
  return this.name.substr( ii + "Id".length)
}

PageProto.isShortName = function(){
  return this.isTwitterUser()
}

PageProto.isName = function(){
  return this.isShortName()
  ||     this.isFacebookUser()
  ||     this.isLinkedInUser()
  ||     this.isUserId()
}

PageProto.getName = function(){
  return this.isName() ? this.name : ""
}

PageProto.isTwitterUser = function(){
  if( this.isSpecial() )return false
  var is_it = !!this.name.match( /^@[^@#-]*$/)
  // ToDo: cache
  return is_it
}

PageProto.isFacebookUser = function(){
  if( this.isSpecial() )return false
  var is_it = !!this.name.match( /^[^@#-]*@$/)
  // ToDo: cache
  return is_it
}

PageProto.isLinkedInUser = function(){
  if( this.isSpecial() )return false
  var is_it = !!this.name.match( /^[^@#-]*In$/)
  // ToDo: cache
  return is_it
}

PageProto.isTag = function(){
  if( this.name.charAt( 0) === "#" )return true
  return this.kindIs( "Tag") || this.kindIs( "Category")
}
PageProto.declareIdempotentPredicate( "isTag")

PageProto.isBot = function(){
  return "BotGuest".ends( this.name) || "Bot".ends( this.name)
}
PageProto.declareIdempotentPredicate( "isBot")

PageProto.frontLine = function( alternate_text ){
  return (!this.wasIncarned() || this.isVoid() || this.wasDeleted())
  ? ""
  : (this.getBody() || alternate_text).frontLine() 
}

PageProto.getUsers = function( alternate_text ){
// Returns the space separated list of user names that
// is the content of the first line of the page.
// Only "User" and "Code" pages contains such a list. 
  if( !this.isUser() && !this.isCode() ){ return "" }
  return this.frontLine( alternate_text)
  .trim().replace( /,/g, " ").replace( /"  "/g, " ")
}
PageProto.declareIdempotentGetter( "getUsers")

PageProto.getFirstUser = function(){
// Returns the first item of this.getUsers()
// "Code" pages first user is the name of the user that logs in.
  var users = this.getUsers()
  if( !users )return ""
  // Get rid of Mentor qualifier in code pages
  if( this.isCode() ){
    users = users.replace( /Mentor/g, "")
  }
  var ii = users.indexOf( " ")
  if( ii >= 0 ){
    return users.substr( 0, ii)
  }
  return users
}
PageProto.declareIdempotentGetter( "getFirstUser")

PageProto.isMentorCode = function(){
  if( !this.isCode() )return false
  return this.getUsers().includes( "Mentor")
}
PageProto.declareIdempotentPredicate( "isMentorCode")

PageProto.getSource = function(){
// Return source for Copy pages and Deleted pages.
// Else, returns this
  var name
  if( this.isCopy() ){
    name = this.name.substr( "Copy".length )
  }else if( this.isDeletion() ){
    name = this.name.substr( "Deleted".length)
  }
  if( !name ){ return this }
  name = this.wiki.protoGuest.wikinamize( name, null, "Page")
  return this.wiki.protoGuest.lookup( name)
}
PageProto.declareIdempotentGetter( "getSource")

PageProto.isCopy = function(){
  return this.kindIs( "Copy")
}
PageProto.declareIdempotentPredicate( "isCopy")

PageProto.isRestore = function(){
  return this.kindIs( "UserRestore")
}
PageProto.declareIdempotentPredicate( "isRestore")

PageProto.isPrivate = function(){
  return this.kindIs( "Private")
  || this.kindIs( "Mentor")
  || this.kindIs( "CopyPrivate")
  || this.kindIs( "CopyMentor")
}
PageProto.declareIdempotentPredicate( "isPrivate")

PageProto.isMember = function(){
  return this.kindIs( "Member")
  || this.kindIs( "Membre")
  || this.kindIs( "CopyMember")
  || this.kindIs( "CopyMembre")
}
PageProto.declareIdempotentPredicate( "isMember")

PageProto.isDeletion = function(){
  return this.kindIs( "Deleted")
}
PageProto.declareIdempotentPredicate( "isDeletion")

PageProto.isAbout = function(){
// "about" pages are pages with "proto" data about them
// The data comes from another page, specified on the first line
  return (this.kindIs( "About") && this.name != "AboutUs")
  ||      this.kindIs( "Super")
}
PageProto.declareIdempotentPredicate( "isAbout")

PageProto.isSecret = function(){
  return this.kindIs( "Secret")
  || this.kindIs( "CopySecret")
}
PageProto.declareIdempotentPredicate( "isSecret")

PageProto.isMap = function(){
  return this.kindIs( "Map")
  || this.kindIs( "Carte")
  || this.kindIs( "CopyMap")
  || this.kindIs( "CopyCarte")
}
PageProto.declareIdempotentPredicate( "isMap")

PageProto.isToc = function(){
  return this.kindIs( "Toc")
}
PageProto.declareIdempotentPredicate( "isToc")

PageProto.isLocal = function(){
  return this.kindIs( "Local")
}
PageProto.declareIdempotentPredicate( "isLocal")

PageProto.isYour = function(){
  return this.kindIs( "Your")
  ||     this.kindIs( "Tu")
}
PageProto.declareIdempotentPredicate( "isYour")

PageProto.isThis = function(){
  return this.kindIs( "This")
  ||     this.kindIs( "Ista")
}
PageProto.declareIdempotentPredicate( "isThis")

PageProto.isRead = function(){
  return this.kindIs( "Read")
  ||     this.kindIs( "Lire")
}
PageProto.declareIdempotentPredicate( "isRead")

PageProto.isDo = function(){
  return this.kindIs( "Do")
  ||     this.kindIs( "Op")
}
PageProto.declareIdempotentPredicate( "isDo")

PageProto.isToDo = function(){
  return this.kindIs( "ToDo")
  ||     this.kindIs( "OpOp")
}
PageProto.declareIdempotentPredicate( "isToDo")

PageProto.getToDo = function(){
  if( this.isDo()    )return this.name
  if( !this.isToDo() )return "Do" + this.name
  var do_cmd = this.frontLine()
  if( !SW.wikiword.test( "Do" + do_cmd) ){
    do_cmd = this.name.substr( "To".length)
    if( !SW.wikiword.test( do_cmd) ){
      do_cmd = "HelpToDo"
    }
  }
  return do_cmd || "DoIt"
}
PageProto.declareIdempotentGetter( "getToDo")

PageProto.isHelp = function(){
  return this.kindIs( "Help")
  || this.kindIs( "Aide")
}
PageProto.declareIdempotentPredicate( "isHelp")

PageProto.isCode = function(){
  return "Code".starts( this.name)
}
PageProto.declareIdempotentPredicate( "isCode")

PageProto.getCode = function(){
  if( !this.isCode() ){ return "" }
  return this.name.substr( "Code".length)
}
PageProto.declareIdempotentGetter( "getCode")

PageProto.isDisposableCode = function(){
  return this.isCode() && Wiki.isDisposableCode( this.getCode())
}
PageProto.declareIdempotentPredicate( "isDisposableCode")

PageProto.isHtml = function(){
  return this.kindIs( "Html")
}
PageProto.declareIdempotentPredicate( "isHtml")

PageProto.isHome = function(){
  return this === this.wiki.homePage
}
PageProto.declareIdempotentPredicate( "isHtml")

PageProto.isGuest = function(){
  return this.kindIs( "Guest")
  ||     this.kindIs( "Visiteur")
}
PageProto.declareIdempotentPredicate( "isGuest")

PageProto.isStamps = function(){
  return "Stamps".ends( this.name)
}
PageProto.declareIdempotentPredicate( "isStamps")

// ToDo: Chat pages
// See long polling https://github.com/yojimbo87/minotaur
// Or Video Chat maybe, http://code.google.com/p/tokboxapi/wiki/CallWidget
PageProto.isChat = function(){
  return "Chat".ends( this.name)
}
PageProto.declareIdempotentPredicate( "isChat")

PageProto.isSpecial = function(){
  return this.isUser()
  || this.isCode()
  || this.isSecret()
  || this.isCopy()
  || this.isRead()
  || this.isHelp()
  || this.isGuest()
  || this.isAbout()
  || this.isDo()
  || this.isDeletion()
}
PageProto.declareIdempotentPredicate( "isSpecial")

PageProto.isSensitive = function(){
  return this.isUser()
  || this.isCode()
  || this.isMap()
  || this.isSecret()
  || this.isPrivate()
  || this.isCopy()
  || this.isDeletion()
}
PageProto.declareIdempotentPredicate( "isSensitive")

PageProto.isTweet = function(){
  return this.name.includes( "Tweet")
}
PageProto.declareIdempotentPredicate( "isTweet")

PageProto.isAngular = function( with_to_do ){
// Is angular if name says so unless data says otherwise
  if( this.kindIs( "Angular") )return true
  if( this.data && this.data.isNotAngular )return false
  if( this.data && this.data.isAngular    )return true
}
PageProto.declareIdempotentPredicate( "isAngular")

PageProto.needsAngular = function(){
// DoAngular pages need angular.js when run, but ToDo do too
  if( this.kindIs( "DoAngular") )return true
  if( !this.kindIs( "ToDo")     )return false
  if( this.data && this.data.isNotAngular )return false
  if( this.data && this.data.isAngular    )return true
  return true
}
PageProto.declareIdempotentPredicate( "needsAngular")

PageProto.isCss = function(){
// Is CSS if name says so unless data says otherwise
  return (
    (this.name.includes( "Style") && !(this.data && this.data.isNotCss))
    || (this.data && this.data.isCss)
  )
}
PageProto.declareIdempotentPredicate( "isCss")

PageProto.isLessCss = function(){
  return this.data && this.data.isLess
}

PageProto.isMarkdown = function(){
  if( this.data && this.data.isNotMarkdown )return false
  if( this.data && this.data.isMarkdown    )return true
  return this.getBody().indexOf( "mrkdwn") >= 0
}

PageProto.isProxy = function(){
  return this.kindIs( "Proxy")
}
PageProto.declareIdempotentPredicate( "isProxy")

PageProto.getProxy = function(){
  return this.isProxy() ? this.frontLine() : ""
}

require( "./globals" ).inject( Page, exports );
