// -------------------
// section: wikictx.js
// This section is about "context management"
//
// Each wiki has a "PrivateContext" special page. That page's content is loaded
// when the wiki is initialized.
// It contains rapidely evolving informations about the wiki itself and also
// about some of the recently modified pages.
//
// All these informations are packed inside a single page in order to reduce
// the amount of individual writes to pages, thanks to the buffering induced
// by the delay between two consecutives writes in the "PrivateContext" page.
// As a result, a wiki with a lot of visits will not generate a much larger
// amount of writes than a less active one, after a certain treshold.
//
// Additionaly, none of the context information are truely "vital", which means
// that the relialability needs are not as strong as they are for the content
// of the pages themselves. If the time/date a page was last visited gets lost...
// this is not a big deal, whereas losing the content of a page would be much
// more problematic.
//
// In the event of a server crash, some recent context can get lost, this is
// my tradeoff between performance and relialability.
//
// ToDo: save context into the "AboutWiki" page.

var Wiki = require( "./wiki.js" ).Wiki;
var WikiProto = Wiki.prototype;

WikiProto.saveContext = function( that ){
// This method gets called every so often to save the hot status
// of "hot" pages. This status is about when the page was
// last visited, last modified and its potential draft content.
// Pages refered by some other "hot" page are considered "hot" too.
// After some times, hot pages become cold.
// See Wiki.touch() where calling saveContext() is scheduled.
  that = that || this
  De&&mand( that.saveContextScheduled, "Bad saveContextScheduled")
  // I will decide later if rescheduling the context saving is necessary
  that.saveContextScheduled = true
  // Do nothing if already in progress
  if( that.timeSaveContextStarted ){
    that.context_de&&bug( "saving already in progress")
    return
  }
  // Do nothing if wiki is empty, i.e. avoid any write until some activity
  // Note: ignore drafts
  if( that.isEmpty( true) ){
    if( that.touchedHard ){
      that.bug_de&&bug( "empty but touched hard:", that.touchedHard)
    }else{
      that.context_e&&bug( "don't save on empty wiki")
      return
    }
  }
  Sw.setTimeNow()
  De&&mand( !that.timeSaveContextStarted )
  that.timeSaveContextStarted = Sw.timeNow
  // ToDo: should not start if previous saving still in progress
  that.context_de&&bug( "starting to save, now:", that.timeSaveContextStarted)
  var context = {
    wikiVersion: SW.version,
    wikiName: SW.name,
    fullname: that.fullname(),
    pages: [],
    users: that.getAllUserLabels(),
    visitors: that.recentGuestVisitors,
    buffer: []
  }
  // Iterate over all visited pages, collect pages to save in context
  var pages = []
  var pagename
  var page
  for( pagename in that.allPages ){
    page = that.allPages[pagename]
    // Skip void & not recently visited pages, they are too cold
    if( !page.isCold() ){
      pages.push( page)
    // However, if some hot page links to this... save it too
    }else if( page.wasIncarned() || !page.isVoid() ){
      var seen = false
      that.forEachBacklink( page, true, function( referer ){ // with_private
        if( seen || !referer.isCold() ){
          seen = true
        }
      })
      if( seen ){ pages.push( page) }
    }
  }
  // The rest of the work is asynchronous to avoid to much locking maybe
  that.saveContext1( that, context, pages)
}

WikiProto.saveContext1 = function( that, context, pages ){
// Asynchronously iterates over pages, then calls saveContext2()
  var page = pages.pop()
  if( !page ){
    return that.saveContext2( context)
  }
  this.deep_context_de&&bug( "savePage:", page)
  if( false && De && !page.isDraft() ){
    this.bug_de&&bug( "BUG? Not a draft page: ", page)
  }
  context.buffer.push( page.saveContext())
  // Process next page
  setTimeout( that.saveContext1, 1, that, context, pages)
}

WikiProto.saveContext2 = function( context ){
// Save accumulated context info into a private page, "PrivateContext"
  Sw.setTimeNow()
  var timenow = Sw.timeNow
  context.pages = context.buffer
  context.buffer = null
  this.deep_context_de&&bug( "About to JSON context:", Sys.inspect( context))
  var json = JSON.stringify( context)
  if( De ){
    Sw.setTimeNow
    if( Sw.timeNow != timenow ){
      this.deep_context_de&&bug( "Time to JSON:", Sw.timeNow - timenow)
    }
  }
  // If there was no changes, no need to keep checking
  if( json == this.lastSafeContext ){
    if( this.touchedHard ){
      this.bug_de&&bug( "no change, yet touched hard:", this.touchedHard)
    }else{
      this.context_de&&mand( this.saveContextScheduled, "rescheduled" )
      this.saveContextScheduled = false
      this.context_de&&bug( "unchanged, for: ",
        ((Sw.timeNow - this.timeLastContext) / 1000), " seconds")
      this.saveContext3()
      return
    }
  }
  this.deep_context_dee&&bug( "JSONs delta length = ",
    json.length - this.lastContext.length)
  this.lastSafeContext = json
  this.timeLastContext = Sw.timeNow
  // Add counters
  var counters = this.sampleCounters()
  var ctx_and_counters = json + "\n" + JSON.stringify( counters) + "\n"
  var that = this
  
  // Store context in PrivateContext page
  // ToDo: Should be AdminContext I guess
  var started = this.timeSaveContextStarted
  this.lookupPage( "PrivateContext").write(
    ctx_and_counters,
    once( function putpagecb_savectx2( err ){
      if( err ){
        that.error( that, "cannot write PrivateContext")
      }else{
        that.context_de&&bug(
          "saved, time:",
          "" + started + " " + that.protoGuest.timeLabel( started, true)
        )
        that.touchedHard = false
      }
      // Once in a while, copy to a backup page
      // I do that because when the process is killed, sometimes it's while
      // PrivateContext is beeing written and file gets broken, rare
      if( Sw.timeNow % 10 == 0 ){
        that.lookupPage( "PrivateContextBackup").write(
          ctx_and_counters,
          function( err ){
            if( err ){
              that.error( that, "cannot write PrivateContextBackup")
            }else{
              that.context_de&&bug( "backup")
            }
          }
        )
      }
      that.contextInfo( context)
    })
  )
  // If some potential changes since last save, redo soon
  De&&mand( this.timeSaveContextStarted, "timeSaveContextStarted" )
  De&&mand( this.saveContextScheduled, "rescheduled" )
  if( this.timeLastTouched > this.timeSaveContextStarted ){
    this.saveContextScheduled = false
    this.timeSaveContextStarted = 0
    this.scheduleSaveContext()
    this.de&&mand( this.saveContextScheduled, "scheduled" )
  }else if( this.touchedHard ){
    this.bug_de&&bug( "still touched despite save & no changes, hard:",
      this.touchedHard)
    this.saveContextScheduled = false
    this.timeSaveContextStarted = 0
    this.scheduleSaveContext()
    this.de&&mand( this.saveContextScheduled, "scheduled" )
  }else{
    this.saveContextScheduled = false
    this.context_de&&bug( "Context saved and no potential change, descheduled")
    this.de&&mand( !this.touchedHard, "touched hard")
    this.de&&mand( !this.saveContextScheduled, "scheduled" )
  }
  this.saveContext3()
}

WikiProto.saveContext3 = function(){
// Final step
  this.timeSaveContextStarted = 0
  // If reset in progress, complete reset
  if( !this.saveContextScheduled && this.isResetting() ){
    if( this.touchedHard ){
      this.bug_de&&bug( "Can't reset, still touched hard:", this.touchedHard )
      this.scheduleSaveContext()
    }else{
      this.reset( true) // force
    }
  }
}

WikiProto.sampleCounters = function( nhttpreqs ){
  // Return null if no activity since previous sampling
  if( nhttpreqs && nhttpreqs == this.countHttpRequests ){
    return null
  }
  var context = {
    timeSampled:         Sw.timeNow,
    timeLastStarted:     this.timeLastStarted,
    countErrors:         this.countErrors,
    countHttpRequests:   this.countHttpRequests,
    durationLongestRequest: this.durationLongestRequest,
    countSessions:       this.countSessions,
    countMemberSessions: this.countMemberSessions,
    countByteSent:       this.countByteSent,
    countWikis:          this.countWikis,
    countWikiCreates:    this.countWikiCreates,
    countPageReads:      this.countPageReads,
    countPageReadBytes:  this.countPageReadBytes,
    countPageMisses:     this.countPageMisses,
    timeCreated:         this.timeCreated,
    countPageCreates:    this.countPageCreates,
    countPageWrites:     this.countPageWrites,
    countPageWriteBytes: this.countPageWriteBytes
  }
  if( !this.lastSampleCounters ){
    this.lastSampleCounters = context
  }
  return context
}

WikiProto.updateCounters = function( context ){
  var all_counters = {
    timeSampled:         Sw.timeNow,
    countErrors:         0,
    countHttpRequests:   0,
    durationLongestRequest: 0,
    countSessions:       0,
    countMemberSessions: 0,
    countByteSent:       0,
    countWikis:          0,
    countWikiCreates:    0,
    countPageReads:      0,
    countPageReadBytes:  0,
    countPageMisses:     0,
    timeCreated:         Sw.timeNow,
    countPageCreates:    0,
    countPageWrites:     0,
    countPageWriteBytes: 0
  }
  if( !context ){
    context = all_counters
  }
  // Sanitize counters & init This's counters if needed
  var item
  var val
  for( item in all_counters ){
    val = context[item]
    NDe&&bug( "Check counter ", item, "= ", val, ", in ", this)
    if( !val || isNaN( val) ){
      NDe&&bug( "Reset counter ", item, " in ", this)
      context[item] = all_counters[item]
    }
    val = this[item]
    if( !val || isNaN( val) ){
      NDe&&bug( "Reset This counter ", item, " in ", this)
      this[item] = all_counters[item]
    }
  }
  this.countErrors          += context.countErrors
  this.countHttpRequests    += context.countHttpRequests
  if( context.durationLongestRequest > this.durationLongestRequest ){
    this.durationLongestRequest = context.durationLongestRequest
  }
  this.countSessions        += context.countSessions
  this.countMemberSessions  += context.countMemberSessions
  this.countByteSent        += context.countByteSent
  this.countWikis           += context.countWikis
  this.countWikiCreates     += context.countWikiCreates
  this.countPageReads       += context.countPageReads
  this.countPageReadBytes   += context.countPageReadBytes
  this.countPageMisses      += context.countPageMisses
  this.timeCreated           = context.timeCreated
  this.countPageCreates     += context.countPageCreates
  this.countPageWrites      += context.countPageWrites
  this.countPageWriteBytes  += context.countPageWriteBytes
}

Wiki.diffCounters = function( c0, c1, force ){
  if( c0.timeCreated != c1.timeCreated ){
    De&&bug( "BUG: timeCreated mismatch in Wiki.diffCounters")
    if( !force )return null
  }
  var counters = {
    durationSampled:     c1.timeSampled         - c0.timeSampled,
    timeLastStarted:     c0.timeLastStarted,
    countErrors:         c1.countErrors         - c0.countErrors,
    countHttpRequests:   c1.countHttpRequests   - c0.countHttpRequests,
    durationLongestRequest:
      c1.durationLongestRequest > c0.durationLongestRequest
      ? c1.durationLongestRequest
      : c0.durationLongestRequest,
    countSessions:       c1.countSessions       - c0.countSessions,
    countMemberSessions: c1.countMemberSessions - c0.countMemberSessions,
    countByteSent:       c1.countByteSent       - c0.countByteSent,
    countWikis:          c1.countWikis          - c0.countWikis,
    countWikisCreates:   c1.countWikiCreates    - c0.countWikiCreates,
    countPageReads:      c1.countPageReads      - c0.countPageReads,
    countPageReadBytes:  c1.countPageReadBytes  - c0.countPageReadBytes,
    countPageMisses:     c1.countPageMisses     - c0.countPageMisses,
    timeCreated:         c0.timeCreated,
    countPageCreates:    c1.countPageCreates    - c0.countPageCreates,
    countPageWrites:     c1.countPageWrites     - c0.countPageWrites,
    countPageWriteBytes: c1.countPageWriteBytes - c0.countPageWriteBytes
  }
  return counters
}

WikiProto.parsePrivateContext = function( page ){
// Check the content of a private context file, either "PrivateContext"
// or "PrivateContextBackup"
// Returns true if ok
// Side effect:
//   page.context is the context object, see saveContext()
//   page.contextText is the JSON string version of page.context
//   page.counters is the counters
//   All of them are set to null if method returns false
  page.context     = null
  page.contextText = null
  page.counters    = null
  if( page.err || page.isVoid() ){
    this.error( "context: invalid, name: " + page.name, 
    ", err: ", Sys.inspect( page.err))
    return false
  }
  NDe&&bug( "Restore from JSON: ", Sys.inspect( page.getBody()))
  var ctx_and_counters = page.getBody().split( "\n")
  var ctx = ctx_and_counters[0]
  var counters = ctx_and_counters[1]
  var context = null
  try{ context = JSON.parse( ctx)
  }catch( err ){
    this.error( ", context: cannot parse, name: ", page.name, 
        ", err: ", Sys.inspect( page.err))
    return false
  }
  this.deep_context_de&&bug( "restore: ", Sys.inspect( context))
  // Some monitoring
  if( counters ){
    // ToDo: try/catch
    try{
      counters = JSON.parse( counters)
    }catch( err ){
      this.error( "context: cannot parse counters, name: ", page.name, 
      ", err: ", Sys.inspect( err))
    }
  }else{
    this.error( "context: No counters, name: ", page.name)
    // ToDo: I should have a backup...
  }
  page.contextText = ctx
  page.context     = context
  page.counters    = counters
  page.context_de&&bug( "context parsed ok")
  return true
}

WikiProto.restoreContext = function( page ){
// This method is called when a wiki is initialized.
// It process the informations from the PrivateContext page.
// It asynchrously eventually change the wiki's state to "operational"
// at which time queued requests against the wiki are processed.
  page.context_de&&bug( "starting to restore")
  var that = this
  var context  = page.context || {}
  var ctx      = page.contextText
  var counters = page.counters
  // Track text of JSON to detect changes later
  that.lastSafeContext = ctx
  // Some monitoring
  if( counters ){
    that.updateCounters( counters)
  }else{
    that.error( "context: No counters, name: ", page)
    // ToDo: I should have a backup...
  }
  // Extract list of pages from context object
  var pages = []
  var item
  for( item in context.pages ){
    pages.push( context.pages[item])
  }
  page.context = null
  page.contextText = null
  page.counters = null
  // Process pages and then call restoreContext2( context)
  that.restoreContext1( that, context, pages)
}

WikiProto.restoreContext1 = function( that, context, pages ){
// This is the second step of Wiki.restoreContext()
// It restore context for pages.
// When done, restoreContext2() is called to finish the initialization.
// Static. Called by setTimeout in Wiki.restoreContext()
  var page = pages.pop()
  if( !page ){
    return that.restoreContext2( context)
  }
  this.deep_init_de&&bug( "Restoring page:", page)
  var wpage = that.lookupPage( page.name)
  wpage.restoreContext( page, "wiki")
  setTimeout( that.restoreContext1, 1, that, context, pages)
}

WikiProto.restoreContext2 = function( context ){
// This is the final step of a wiki's initialization. Context restoration
// started in the wiki constructor when .restoreContext() was called.
// Static. called by setTimeout in Wiki.restoreContext1()
  // Restore user labels
  var user
  if( context.users ){
    var sz = context.users.length
    for( var ii = (sz < 200 ? 0 : sz - 200) ; ii < sz ; ii++ ){
      // Dunbar, I remember only so many labels, defensive
      // However I do remember the 200 last ones
      user = context.users[ii]
      this.trackUserLabel( user.id, user.label)
    }
  }
  if( context.visitors ){
    this.recentGuestVisitors
    = this.recentGuestVisitors.concat( context.visitors)
  }
  this.context_de&&bug( "restored")
  this.contextInfo( context)
  // Initialization is finished, unless parent wiki is still initializing
  if( this.parentWiki && this.parentWiki.isInitializing() ){
    // re invoke restoreContext2 when parent wiki is fully initialized
    this.init_de&&bug( "parent not Initialized")
    this.parentWiki.queuedRequests.push({
      cb: function( wiki ){
        wiki.restoreContext2( context)
      },
      wiki:this
    })
    return
  }
  this.initializing = false
  this.init_de&&bug( "Initialized")
  this.scheduleSaveContext()
  // I need to reschedule requests & cb that were put on hold during initialization
  var queue = this.queuedRequests.reverse()
  this.queuedRequests = null
  var req
  var cb
  var wiki
  for( var item in queue ){
    item = queue[item]
    wiki = item.wiki
    req  = item.req
    cb   = item.cb
    if( req ){
      req.queued = true
      this.init_de&&bug( "processQueuedRequest, R:", req.deId)
      wiki.processHttpRequest( req)
    }else{
      this.init_de&&bug( "processQueuedLookupCb")
      cb.call( wiki, wiki)
    }
  }
}

WikiProto.contextInfo = function( context ){
  if( !NDe )return
  var counters = this.sampleCounters()
  De&&bug( "Counters: ", Sys.inspect( counters))
  NDe&&bug( "Pages: ", context.countPages)
  NDe&&bug( "Size: ", context.totalSize)
  NDe&&bug( "Average: ", context.totalSize / context.countPages)
  NDe&&bug( "Context size: ", this.lastContext.length)
}

WikiProto.scheduleSaveContext = function(){
// This method gets called when something potentially changed in a wiki.
// See Wiki.touch()
// It schedules Wiki.saveContext() that will check for changes and
// save them on store.
  if( this.saveContextScheduled ){
    this.deep_context_de&&bug( "saving already scheduled for")
    return
  }
  if( this.timeSaveContextStarted ){
    this.deep_context_de&&bug( "saving in progress, will reschedule itself")
    // After context is saved, timeLastTouched is checked
    return
  }
  var delay = this.isResetting() ? 0 : SW.saveDelay
  setTimeout( this.saveContext, delay, this)
  this.saveContextScheduled = true
  this.context_de&&bug( "saving scheduled, delay: ", delay)
}

WikiProto.touch = function( hard ){
// Basic change management, time based
  this.timeLastTouched = Sw.timeNow
  if( !this.saveContextScheduled ){
    this.scheduleSaveContext()
  }
  // I don't 100% trust the context diff mechanism, better save twice than none
  if( hard ){
    this.touchedHard = hard
    this.de&&bug( "Touched hard on:", hard)
  }
}


exports.Wiki = Wiki;
// section: end wikictx.js


