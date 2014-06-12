// -------------------
// section: pagectx.js
// Context management section
//
// Here are the frequently changing informations about the "hot" pages.
// I save these informations rather often in the "PrivateContext" special page.
//
// These informations are also packed in the page's body when the page
// content is updated and stored, but this is much less frequent, it occurs
// only when the page's content is edited.

var Page = require( "./page.js" ).Page;
var PageProto = Page.prototype;

PageProto.saveContext = function(){
  var ctx = {name: this.name}
  if( this.timeCreated       ){ ctx.timeCreated  = this.timeCreated       }
  if( this.lastVisitor()     ){ ctx.visitor      = this.lastVisitor()     }
  if( this.timeVisited()     ){ ctx.timeVisited  = this.timeVisited()     }
  if( this.lastWriter()      ){ ctx.writer       = this.lastWriter()      }
  if( this.creatorName       ){ ctx.creator      = this.creatorName       }
  if( this.timeModified()    ){ ctx.timeModified = this.timeModified()    }
  if( this.isDraft()         ){ ctx.draft        = this.body              }
  if( this.isHot( true)      ){ ctx.hot          = true                   }
  if( this.wasInherited()    ){ ctx.inherited    = true                   }
  if( this.visitCount()      ){ ctx.visits       = this.visitCount()      }
  // ToDo: remember that page is empty?
  // This could speed things, cause there is no need to check the filesystem
  var backlinks = []
  this.wiki.forEachBacklink( this, true, function( referer ){ // with_private
    backlinks.push( referer.name)
  })
  if( backlinks.length > 0 ){   ctx.backlinks    = backlinks              }
  return ctx
}

PageProto.restoreContext = function( ctx, source ){
// This method gets called when a page is loaded from store or when a
// wiki is started (source == "wiki").
// It restore some informations about the page, when it was accessed,
// who last changed it, when, etc...
// It uses context information that was injected into the page's body when
// the page is stored or some other source (PrivateContext).
// This is done to bufferize changes and avoid writes to too many pages.
  if( !ctx )return
  this.deep_context_de&&bug( "restoreContext:", Sys.inspect( ctx) )
  if( ctx.name && ctx.name != this.name ){
    this.bug_de&&bug( "Mismatch, name:", ctx.name)
    return
  }
  // The "hot" status is valid in PrivateContext only
  if( ctx.hot && source == "wiki" ){
    this.setHot( true) // true => restoring, ie. don't .touch()
  }
  // Accumulates number of visits as long as page stays hot
  if( ctx.visits && ctx.visits > this.countVisits ){
    this.countVisits = ctx.visits
    // Count got wrong in early 2011, see also similar fix somewhere else
    // ToDo: should check time of page before messing with count
    if( this.countVisits > 10000 ){
      this.countVisits = 100
    }
  }
  if( ctx.inherited ){
    if( !this.wiki.parentWiki ){
      bug( "BUG? Page is wrongly inherited in context, root: " + this.wiki + ", page=" + this );
      this.inherited = null;
    }else{
      this.inherited = this.wiki.parentWiki.lookupPage( this.name)
    }
  }
  if( ctx.draft ){
    this.context_de&&bug( "restore draft" )
    this.draft()
    this.body = ctx.draft.toString()
  }
  if( ctx.timeVisited
  &&  (!this.timeLastSession || ctx.timeVisited > this.timeLastSession)
  ){
    // I overwrite info about last visitor when no more recent access occured
    this.timeLastSession = ctx.timeVisited
    this.lastVisitorName = ctx.visitor
  }
  if( ctx.writer
  //&& (!this.lastWriter() || ctx.timeModified > this.timeLastModified)
  ){
    this.setWriter( ctx.writer)
    // Note: this changes .timeLastModified but I restore it, see below
  }    
  if( ctx.timeModified
  //&& (!this.timeLastModified || ctx.timeModified > this.timeLastModified)
  ){
    // Time of modification override whatever was known because modifications
    // imply that context is saved (unless draft modification, but in that
    // case I believe the date of the non draft modification matters more)
    this.timeLastModified = ctx.timeModified
  }
  // Restore info about backlinks, but only when starting the wiki.
  // ToDo: don't always use backlinks at page level, its duplicated and out of
  // synch information sometimes... but I don't know how to detect this.
  var backlinks = ctx.backlinks
  // backlink info is valid at page level only for "cold" pages.
  // backlink info is stored in PrivateContext when page isn't cold.
  if( backlinks && (source == "wiki") || this.isCold() ){
    var item
    var referer_name
    var referer_page
    for( item in backlinks ){
      referer_name = backlinks[item]
      De&&mand( referer_name)
      referer_page = this.wiki.lookupPage( referer_name)
      referer_page.trackLinkTo( this)
      this.wiki.trackBacklink( this, referer_page)
    }
  }
  this.timeCreated
  = ctx.timeCreated || this.timeLastModified || this.timeLastSession
  || 12949143000000 // jan 13th 2011
  this.creatorName = ctx.creator || ctx.writer || Sw.name
}

exports.Page = Page;
// section: end pagectx.js