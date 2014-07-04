// section: sessionpage.js

var Session = require( "./session.js" ).Session;
var SessionProto = Session.prototype;

Session.lookup = function( pagename, default_name ){
// Look for / make a Page object to reference said page
  return this.wiki.lookupPage( pagename, default_name)
}

Session.getPageTitle = function( page ){
  page || (page = this.getCurrentPage())
  var title = page.get( "title") || page.name
  title += " " + this.wiki.getTitle() || this.wiki.name || SW.name
  title += " " + this.getPlausibleName()
  return title
}

Session.setData = function( page, name, val, dont_put ){
// Set Yaml data on page and then write page to store in the background.
// Val is stored as a string. No JSON.
// Please use dont_put to avoid multiple puts.
// ToDo: a version with an array/hash of changes
// ToDo: some kind of buffering
// ToDo: transient pages
  // Do nothing if no change
  if( this.getData( page, name) == val )return this
  page.set( name, val)
  if( !dont_put ){
    // Save/write page, reusing the unchanged body
    var text = page.body
    if( !text ){ text = "" }
    // This is asynchronous, I assume it runs FIFO style
    // I guess that this is a safe bet, but I could manage a queue
    this.putPage( page, text, null)
    // ToDo: I could bufferize this a little
    // But then I would have to detect/avoid multiple writes
  }
  // ToDo: if( dont_put == "defered" )... schedule defered write
  return this
}

Session.getData = function( page, key ){
// Get some (string) data from a page.
// Returns null if named item is not part of page (or proto).
  return page.get( key)
}

Session.setSessionData = function( name, val, page, is_global ){
  var pagename = page ? page.name : "Session"
  if( !this.dataByPage[pagename] ){
    this.dataByPage[pagename] = {}
  }
  this.dataByPage[pagename][name] = val
  if( is_global && pagename != "Session" ){
    this.setSessionData( name, val, null, false)
  }
  return val
}

Session.getSessionData = function( name, page ){
  var pagename = page ? page.name : "Session"
  if( !this.dataByPage[pagename] ){
    this.dataByPage[pagename] = {}
  }
  var val = this.dataByPage[pagename][name]
  if( val )return val // ToDo: should check for "undefined"
  if( pagename != "Session" ){
    return this.getSessionData( name)
  }
  return val
}

Session.setUserData = function( name, val, page, is_global ){
  if( !this.user ){
    return this.setSessionData( name, val, page, is_global)
  }
  var pagename = page ? page.name : "User"
  if( user.dataByPage[pagename] ){
    this.dataByPage[pagename] = {}
  }
  user.dataByPage[pagename][name] = val
  if( is_global && pagename != "User" ){
    this.setUserData( name, val, null, false)
  }
  return val
}

Session.getUserData = function( name, page ){
  if( !this.user ){
    return this.getSessionData( name, page)
  }
  var pagename = page ? page.name : "User"
  if( !this.dataByPage[pagename] ){
    this.dataByPage[pagename] = {}
  }
  var val = this.dataByPage[pagename][name]
  if( val )return val // ToDo: should check for "undefined"
  if( pagename != "User" ){
    return this.getUserData( name)
  }
  return val
}

Session.deletePage = function( page, cb ){
// Deleted pages's content is moved to archive
  if( page.isDeletion() ){
    cb.call( this, 3, page) // ToDo: document errors
    return this
  }
  var mvname = this.wikinamize( "Deleted" + page.name)
  var that = this
  // If page is draft, only remove the draft
  if( page.isDraft() ){
    that.trash( page)
    cb.call( this, 3, null)
    return this
  }
  // Make 2 copies, including one in regular copy archive
  this.copyPage( page, "Copy" + page.name, function(){
    that.copyPage( page, mvname, function( err ){
      if( err ) return cb.call( this, err)
      if( page.wasInherited() ){
        mvname = "Original"
      }
      // Clear the data too
      page.data = null
      that.putPage( page, mvname, function( err, delpage ){
        cb.call( that, err, delpage)
      })
    })
  })
  return this
}

Session.undeletePage = function( page, cb ){
// Revert deletion. Page is either a "DeletedXxxxx" page or
// a regular page name
  var del = page
  var source = page
  // If page is a deletion, extract name
  if( page.isDeletion() ){
    source = page.getSource()
    del = page
  // Else built name of deletion page
  }else{
    del = this.lookup( this.wikinamize( "Deleted" + page.name))
  }
  // Copy from deletion page to source of deletion page
  var that = this
  del.read( function( err, del ){
    if( !err && !del.isVoid() ){
      that.putPage( source, del.getBody(), function( err, source ){
        cb.call( that, err, source, del)
      })
    }else{
      cb.call( that, err, source, del)
    }
  })
  return this
}

Session.copyPage = function( page, copyname, cb ){
// cb is f( err, page, copypage )
  if( page.isCopy() || page.isDeletion() ){
    this.bug_de&&bug( "Bad copyPage")
    cb.call( this, 3, page, null)
    return this
  }
  copyname = this.wikinamize( copyname)
  var that = this
  // Cannot copy draft, use original instead
  if( page.isDraft() ){
    return this.copyPage( page.nondraft, copyname, function( err, _, copypage){
      return cb.call( that, err, page, copypage)
    })
  }
  page.read( function( err, page ){
    if( err ) return cb.call( that, err, page, null)
    that.lookup( copyname).read( function( err, copypage ){
      var copydata = copypage.getBody()
      if( err ){ copydata = "" }
      // Defense: don't copy if data was copied before
      // ToDo: this is not very good, I'd better compress
      if( copydata.includes( page.getBody()) ){
        return cb.call( that, 0, page, copypage)
      }
      var date = new Date()
      copydata = date.toISOString()
      + " " + page.name
      + " " + copypage.name
      + " " + that.userName()
      + "\n\n" + page.getBody()
      + "\n\n" + copydata
      that.de&&bug( "Copy side effect on " + copypage.name)
      // ToDo: compact copy
      // For each line
      //  If seen before, reference last previous occurence/reference
      //    using relative index, ie "#2" if two lines before
      // For each line
      //  If line is a reference, look for consecutive references
      //  and change them into empty lines
      // For each line
      //  If line is a reference with count of matching lines
      //    filter out next lines
      // ToDo: to expand
      // For each line
      //  If line is a reference or count of references,
      //    append referenced lines
      copypage.write( copydata, function( err ){
        if( err ){
          cb.call( that, 2, page, copypage)
        }else{
          cb.call( that, 0, page, copypage)
        }
      })
    })
  })
  return this
}

Session.restorePage = function( copyname, cb ){
// Restore page from copy.
// The copy contains accumulated copies.
// ToDo: Restore last copy? or detect copies and
// list choices
// call cb( err, copypage, restoredpage)
  if( !"Copy".starts( copyname) ){
    copyname = this.wikinamize( "Copy" + copyname)
  }
  var copypage = this.lookup( copyname)
  // ToDo: Page.getSource()
  var name = this.wikinamize( copyname.substr( "Copy".length))
  var page = this.lookup( name)
  if( !this.canEdit( page) || !this.canRead( copypage) ){
    this.bug_de&&bug( "Should not be authorized")
    cb.call( this, 3, page, copypage, page )
    return false
  }
  var that = this
  that.lookup( copyname).read( function( err, copypage ){
    if( err ){
      return cb.call( that, err, copypage, page)
    }
    this.putPage( page, copypage.getBody(), function( err, putpage ){
      return cb.call( that, err, copypage, putpage)
    })
  })
  return this
}

Session.getPage = function( page, cb ){
// Reads a page from script ("Do" pages) or store, then calls a cb( err, page)
// Callback is optional for "Do" pages.
  // DoXxxx are special pages
  var that = this
  if( page.isDo() ){
    return this.doPage( page.name.substr( 2), function( data) {
      // If callback was specified, I create a fake temporary page
      // ToDo: page name should be specific to the session...
      if( cb ){
        // when command returned an object
        data || (data = "")
        if( data.body ){
          // Get text body from .body
          var tmppage = new Page( that.wiki, page.name, data.body)
          // Inject the object's properties as data attributes for page
          for( var item in data ){
            tmppage.set( item, data[item])
          }
          cb.call( that, 0, tmppage)
        // when command returned a string
        }else{
          cb.call( that, 0, new Page( that.wiki, page.name, data))
        }
      }
    })
  }
  De&&mand( cb )
  page.read( function session_getPage( err, page ){
    cb.call( that, err, page)
  })
}

Session.putPage = function( page, txt, cb ){
  page.setWriter( this.userName())
  // maxCols will have to be recomputed
  page.maxCols = 0
  // If page is "aboutWiki", I need to check that whoever is "closing"
  // a wiki has the right to do that.
  var was_pure_open = this.wiki.config.veryOpen
  var old_content = page.getBody()
  var that = this
  this.session_de&&bug( "putPage:", page, "data:", txt.substr( 0, 30))
  return page.write( txt, function session_putpage( err, page ){
    if( was_pure_open && !that.wiki.config.veryOpen ){
      that.acl_de&&bug( "Very open wiki should now belong to some visitor")
      // Revert change if user is not a curator
      if( !that.canCurator ){
        that.warnUser( "Only a curator can close an open wiki")
        // I cannot assume that the proto data reverts the side effect, I force
        that.wiki.config.veryOpen = true
        that.acl_de&&bug( "Revert change, page:", page)
        return page.write( old_content, cb)
      }
    }
    that.store_de&&bug( "donePutPage: ", page)
    return !cb ? (err ? null : page.getBody()) : cb.call( that, err, page)
  })
}

Session.canRestore = function( copypage ){
  return !this.isGuest() || this.wiki.config.veryOpen
}

Session.mayEdit = function( page, mayread ){
  page || (page = this.getCurrentPage())
  // Inherited "special pages" cannot be changed
  // This includes codes, secrets, copies, deletions, etc...
  // Why: I'm not sure...
  if( page.inherited
  &&  page.isSpecial()
  &&  page.name != "AboutWiki"
  && !page.isHelp() 
  && !page.isUser() // ie UserSome
  ) return false
  // On closed wikis, guests can write on Public pages only
  if( this.wiki.isClosed() && this.isGuest() && !page.isPublic() ){
    return false
  }
  if( !(mayread || this.mayRead( page)) ){
    return false
  }
  // Only curators can rewrite history
  // Code && PrivateXXX pages are protected too.
  if( (page.isCopy() || page.isDeletion()
    || page.isCode() || page.isPrivate() 
    )
  && !this.canCurator
  ){
    return false
  }
  if( page.isDo() || page.isHtml() ){
    return false
  }
  if( page.isSecret() && this.isGuest() ){
    return false
  }
  if( page.isRead() && !this.canCurator ){
    return false
  }
  if( page.kindIs( "Guest") && !this.isGuest() && !this.canCurator ){
    return false
  }
  if( page.kindIs( "UserRestore") ){
    return false
  }
  if( page.isUserId() ){
    return false
  }
  return this.canCurator || !(page.data && page.data.isReadOnly)
}
Session.declareIdempotentGetter( "mayEdit")

Session.canEdit = function( page ){
  return this.canRead( page) && this.mayEdit( page, true)
}
Session.declareIdempotentPredicate( "canEdit")

Session.mayRead = function( page ){
// Returns true if user can read the page or need to try
  // Only authenticated users can read something in User wikis
  if( this.wiki.isUserWiki() ){
    return page.isPublic() || page.isRead() || page.isHelp()
    || page.isDo() || page.isToDo() || (page.name == "SignIn")
    || (this.user && ("f" + this.user.getId() == this.wiki.name))
    || this.isDebug
  }
  page || (page = this.getCurrentPage())
  // User ids are invisible, unless debugging
  if( page.isUserId() && !this.isDebug )return false
  if( this.canCurator && !this.wiki.isVeryOpen() ){ return true }
  var pagename = page.name
  // On closed wikis, anonymous guests can read homepage & public /guest pages only
  if( this.wiki.isClosed()
  &&  this.isGuest()
  && !( page.isPublic()
    || page.isHome()
    || page.isGuest()
    || page.isRead()
    || page.isHelp() )
  ){
    this.acl_de&&bug( "closed wiki, guest cannot read, page:", page)
    return false
  }
  // Guest cannot read Member pages
  if( page.isMember()
  &&  this.isGuest()
  && !this.wiki.isVeryOpen()
  ){
    this.acl_de&&bug( "guest cannot read member page:", page)
    return false
  }
  // Only curators read some pages, unless veryOpen and not an inherited page
  if( (page.isPrivate()
    || page.name == "AboutWiki"
    || page.isDeletion())	// ToDo: quid of copy pages?
  && (!this.wiki.isVeryOpen() || page.wasInherited())
  && !this.canCurator
  ){
    this.acl_de&&bug( "Only curators can read page:", page)
    return false
  }
  // Access to secret pages
  if( page.isSecret() && !this.canCurator && !this.knows( page) ){
    this.acl_de&&bug( "secure secret page:", page)
    return false
  }
  // Access to UserXxxx page by owner
  if( page == this.loginPage )return true
  // If I know the content of the page, I can check further
  if( page.wasIncarned() ){
    return this.canRead( page, true)
  }
  return true
}
Session.declareIdempotentPredicate( "mayRead")

Session.canRead = function( page, maybe, alternate_text ){
// Returns true if user can read the page for sure.
// In some case, it is better to try because some page's
// accessibility is defined in the page itself.
// "maybe" is optional, it helps to avoid some redundant checking.
// "alternate_text" is optional, it is usefull to check if
// a change to the page would change it's accessibility
  page || (page = this.getCurrentPage())
  if( NDe&&(this.userName() == "@jhr") )return true
  if( !maybe && !this.mayRead( page) ){ return false }
  if( this.canCurator ){ return true }
  
  // Cannot do better unless page was loaded, assume ok for now
  if( !page.wasIncarned() ){ return true }
  
  // User pages
  if( page.isUser() && !page.wasDeleted() ){
    this.deep_acl_de&&bug( "? Can read User page:", page, "user:" + this.userName())
    // Visible for some specific users only
    var validusers = (" " + page.getUsers( alternate_text) + " ")
    if( validusers == "  " || validusers == " Some " )return true
    if( !validusers.includes( this.userName() + " ")
    && !validusers.includes( "SomeGuest")
    && !(this.twitterName
      && validusers.includes( " @" + this.twitterName  + " "))
    && !(this.wikiId
      && validusers.includes( " "  +this.facebookName  + "In "))
    ){
      this.acl_de&&bug( "Cannot read, user:", this.userName(),
      "valid:", validusers)
      return false
    }
  }
  
  // Access rights, Map. OK if named in map or visited a named map
  if( page.isMap() ){
     // ToDo: safe includesName (that checks termination)
     // ToDo: cache
    if( page.getBody().includes( this.userName() + "\n") ){
      return true
    }
    var found = false
    this.forEachMap( function( map ){
      // Good secret map names are secrets, should not collide
      if( !found && page.getBody().includes( map.name) ){
        found = true
        return false
      }
    })
    if( !found ){
      return false
    }else{
      // Side effect, user is in "private" mode now
      this.behindMap = true
    }
  }
  if( page.data && page.data.isCuratorLock && !this.canCurator ){
    this.acl_de&&bug( "Locked, curators only, page:", page)
    return false
  }
  return !this.isGuest() || !(page.data && page.data.isNoGuests)
}
Session.declareIdempotentPredicate( "canRead")

Session.canDelete = function( page ){
  if( !this.mayEdit( page) )return false
  return !this.isGuest() || this.wiki.config.veryOpen
}
Session.declareIdempotentPredicate( "canDelete")

Session.stamp = function( page, dontwrite ){
// Clears the "draft" status of a page and save content to store.
// Note: dontwrite is usefull when caller is about to call putPage(),
// it avoids useless double writes.
  //if( "User".starts( page) && !this.isCurator ) returns false
  if( !this.canStamp( page) ){
    this.acl_de&&bug( "Session cannot stamp, page:", page)
    return false
  }
  if( !page.stamp() )return false
  this.de&&bug( "Session is stamping, page:", page)
  if( !dontwrite ){
    this.putPage( page, page.body, function( err ){
      // ToDo: err handling
    })
  }
  return true
}

Session.canStamp = function( page ){
// Guests can never turn a draft into a stamped page, unless page is public
  page || (page = this.getCurrentPage())
  if( this.isGuest()
  && !page.isPublic()
  && !this.wiki.isVeryOpen()
  ){
    return false
  }
  // Cannot stamp Stamps pages, useless & disturbing
  if( "Stamps".ends( page.name) )return false
  // Cannot stamp if already last writer, unless draft
  if( page.lastWriter() == this.loginName )return page.isDraft()
  return true
}
Session.declareIdempotentPredicate( "canStamp")

Session.draft = function( page, force ){
// Sets the "draft" status of a page
  // Normally it is not a good idea to draft a user page. ToDo: why?
  if( !this.canDraft( page) && !force ){
    this.acl_de&&bug( "Session cannot draft, page:", page)
    return false
  }
  if( page.draft() ){
    this.de&&bug( "drafting, page:", page)
    page.setWriter( this.userName())
    return true
  }else{
    return false
  }
}

Session.canDraft = function( page ){
  page || (page = this.getCurrentPage())
  if( page.isVirtualStore() )return false
  return this.canCurator || !page.isUser()
}
Session.declareIdempotentPredicate( "canDraft")

Session.isHot = function( page ){
  page || (page = this.getCurrentPage())
  var session = this.wiki.getSession( page)
  if( session && !session.isAway() ){ return true }
  var visitor = page.lastVisitor()
  return !!(this.wiki.allHotPages[page]
  && (!visitor && this.hasVisited( page) || visitor != this.userName()))
}
Session.declareIdempotentPredicate( "isHot")

Session.hasVisited = function( page ){
  page || (page = this.getCurrentPage())
  return this.allVisitsByPage[page]
}
Session.declareIdempotentPredicate( "hasVisited")

Session.timeLastVisit = function( page ){
  page || (page = this.getCurrentPage())
  return this.allVisitsByPage[page]
}
Session.declareIdempotentGetter( "timeLastVisit")

Session.fixVisit = function( page ){
  // No trace in curator mode
  if( this.isCurator )return
  page || (page = this.getCurrentPage())
  this.allVisitsByPage[page.name] = Sw.timeNow
  page.setVisitor( this)
  return this
}

Session.trash = function( page ){
// Get rid of "draft" content, get back to previous stamped page
  // ToDo: Trash by guests should remove last stamp only.
  // When no more stamp remains, the transient is removed
  if( this.canTrash( page) ){
    page.setWriter( this.userName())
    page.trash()
    return true
  }
  return false
}

Session.canTrash = function( page ){
  page || (page = this.getCurrentPage())
  if( !page.isDraft() ){ return false }
  return true
}
Session.declareIdempotentPredicate( "canTrash")

Session.knows = function( page ){
  return page.isMap() || this.allKnownPages[page.name]
}

Session.addMap = function( page ){
  this.allVisitedMaps[page.name] = page
  return this
}

Session.forEachMap = function( cb ){
  var name
  var r
  for( name in this.allVisitedMaps ){
    r = cb.call( this, this.allVisitedMaps[name])
    if( r === false )break
  }
  return this
}

exports.Session = Session;
// section: end sessionpage.js
