// -------------------
// section: user.js
// Class User
//
// There are two kinds of users, local and proxy users. Proxy users are
// users of some external service like twitter, mail...
//
// A "local" User has:
//  an id, a 3Code
//  a "user" user, if some user object merging occured
//  a "premium" flag for premium users
//  a default username, that can be overriden on a per wiki basis
//  a default userlabel, equal to the username unless otherwise specified
//  a personnal wiki, named after the id
//  a list of wikis that the user has had some interaction with, with a date
//  an associated primary Twitter proxy user, maybe
//    & secondary Twitter proxy users, maybe
//  an associated primary Mail proxy user, maybe
//    & secondary Mail proxy users, maybe
//
//
// A Twitter user has:
//  a twitter id
//  a username, @ prefixed
//  a userlabel, equal to the user's name unless specified otherwise
//  an associated simpliwiki "local" user
//
// A Mail user has:
//  a mail address as id
//  a username equal to [mail address] (a free link)
//  a userlabel, equal to the user's name unless specified otherwise
//  an associated simpliwiki "local" user
//
// The associations are bidirectionnal. They are stored as data in pages named
// using the service name + Id + the service id.
//
// ToDo: copy name & label of all services into the local user, to avoid
// reading the proxy user object to access these informations.
//
// Additional data can be stored in the user's homepage in his/her personnal wiki.


function User( wiki, service, id, username, userlabel ){
  this.de&&mand( wiki.isRoot() )
  this.de&&mand( service )
  this.de&&mand( id )
  this.wiki = wiki
  this.id = {}
  this.service = service
  this.id[service] = [id]
  if( username ){
    if( service == "Mail" ){
      this.name = "[" + username + "]"
    }else if( service == "Twitter" ){
      this.name = "@" + username
    }else{
      this.name = username
    }
  }else{
    // Don't inherit prototype's name property. ie. Function objects
    this.name = null
  }
  if( userlabel || (userlabel = this.name) ){
    this.label = userlabel
    if( userlabel ){
      this.test_de&&bug(
      "label:", userlabel, "username:", username, "name:", this.name)
    }
  }
  this.isLocal = (service == "User")
  this.local = this.isLocal ? this : null
  this.page = wiki.lookupPage( service + "Id" + id)
  this.page.user = this
  if( this.isLocal ){
    this.page.localUser = this
  }
  this.user_de&&bug( "New User")
}
var UserProto = User.prototype = {};

MakeDebuggable( UserProto, "User")

UserProto.assertIsUser = function(){ return true }

UserProto.toString = function(){
  return "<U "
  + this.service.substr( 0, 1)
  + this.id[this.service][0]
  + ">"
}

UserProto.dump = function(){
  var buf = [this.toString()]
  for( var item in this.id ){
    buf.push( item + "=" + this.id[item].join( " "))
  }
  return buf.join( ",")
}

UserProto.saveContext = function(){
  var ctx = {
    id: this.id,
    name: this.name,
    label: this.label,
    service: this.service
  }
  return ctx
}

UserProto.reset = function(){
  this.user_de( "reset()")
  this.wiki  = null
  this.id    = null
  if( this.local ){ this.local.reset() }
  this.local = null
  this.page.user = null
  this.page.localUser = null
  this.page = null
  if( this.homepage ){
    this.homepage.user = null
    this.homepage = null
  }
}

User.lookup = function( wiki, service, id ){
// static
// Returns a page in the wiki for the user.
// returned page's user property points on the User object.
// This is synchronous, as a result there is no guarantee that the content
// of the page was fetch, idem for the associated object.
// So, one need to use .read() and .load() before accessing the content,
// .read() for the page object, .load() for the User object.
// In most case, it is the "local" User object that is needed, it is
// accessible using .getLocal().
  // User objects are stored in the root wiki only (for now)
  this.de&&mand( service )
  this.de&&mand( id )
  wiki = wiki.getRoot()
  var page = wiki.lookupPage( service + "Id" + id)
  if( !page.user ){
    new User( wiki, service, id)
    page.user.deep_user_de&&bug( "first lookup")
  }
  this.de&&mand( page.user.page == page )
  page.user.deep_user_de&&bug( "lookup")
  return page
}

UserProto.lookupByPage = function( wiki, page ){
  var service = page.getService()
  var id      = page.getId()
  if( !service || !id )return null
  return User.lookup( wiki, service, id)
}

UserProto.getId = function(){
// Returns the string id of this user, local to the service she/he belongs to.
// If user is a local user, id is a 3Code.
// If user is a proxy, id is a twitter name if user is a twitter user, a mail
// if user is a mail user, etc
  return this.id[this.service][0]
}

UserProto.getName = function(){
// Returns the twitter screen name if possible, or else the facebook screen
// or else whatever I can.
// Note: this name is not unique, unless twitter or facebook of course.
  if( !this.isLocal && this.local )return this.local.getName()
  var name
  var service
  var id
  var best_found = false // Best is non digit twitter screen name
  for( service in this.id ){
    if( best_found )break
    id = this.id[service]
    if( service == "Twitter" ){
      // best is non digit twitter id
      if( !/\d*/.test( name.replace( "@", "")) ){
        name = "@" + id
        best_found = true
      // Better a new name than nothing or digits
      }else if( !name
      || /\d*/.test( name)
      ){
        name = "@" + id
      }
    }else if( service == "Wiki" ){
      // Better a name than none, better a new name than digits
      if( !name ){
        name = User.extractName( id)
      }
    }else if( service == "Mail" ){
      // Better a name than none, better a new name than digits
      if( !name
      || /\d*/.test( name.replace( "@", ""))
      ){
        var ii = id.indexOf( "@")
        if( ii >= 0 ){
          name = "[" + id.substr( 0, ii) + "]"
        }else{
          name = "[" + id + "]"
        }
      }
    }else{
      // Not really expected
      if( !name ){
        this.de&&bug( "Unexpected service:", service, "id:", id)
        name = "[" + id + "]"
      }
    }
  }
  if( name )return name
  if( this.label ){
    return "[" + this.label + "]"
  }
  return this.name
}

UserProto.getServiceId = function(){
// Returns the service name concatenated with the id
// Format: sssssIdiiii
  return this.service + "Id" + this.id[this.service][0]
}

UserProto.getService = function(){
// Return which service this user belongs to.
// ie. returns "Twitter" if twitter user, "Mail" if mail user, etc
  return this.service
}

UserProto.getName = function(){
  return this.user
}

UserProto.getLabel = function(){
  this.test_de&&bug( "getLabel:", this.label)
  return this.label
}

UserProto.setLabel = function( label ){
  if( label != this.label ){
    this.label = label
    this.touch()
  }
}

UserProto.getLocalId = function(){
  return this.isProxy()
  ? this.getPrimaryId( "User")
  : this.id["User"][0]
}

UserProto.getWikiId = function(){
  return this.isWiki()
  ? this.id["Wiki"][0]
  : this.getPrimaryId( "Wiki")
}

UserProto.getTwitterId = function(){
  return this.isTwitter()
  ? this.id["Twitter"][0]
  : this.getPrimaryId( "Twitter")
}

UserProto.getFacebookId = function(){
  return this.isFacebook()
  ? this.id["Facebook"][0]
  : this.getPrimaryId( "Facebook")
}

UserProto.getLinkedInId = function(){
  return this.isLinkedIn()
  ? this.id["LinkedIn"][0]
  : this.getPrimaryId( "LinkedIn")
}

UserProto.getMailId = function(){
  return this.isMail()
  ? this.id["Mail"][0]
  : this.getPrimaryId( "Mail")
}

UserProto.getDropboxId = function(){
  return this.isDropbox()
  ? this.id["Dropbox"][0]
  : this.getPrimaryId( "Dropbox")
}

UserProto.isLocalOnly = function(){
  this.de&&mand( !this.isProxy() )
  return !this.getTwitterId()
  && !this.getWikiId()
}

UserProto.isReady = function(){
// User is "ready" when the corresponding local user is identified.
  return !!(this.local)
}

UserProto.isPremium = function(){
  return this.premium
}

UserProto.logout = function( loop ){
  var session = this.session
  var user
  this.de&&mand( !loop )
  if( session ){
    user = session.user
    if( user == this ){
      user.session = null
      session.user = null
    }else if( user.session == session ){
      this.session = null
      user.logout( true)
    }
  }
}

UserProto.trackVisit = function( session ){
  this.user_de&&bug( "trackVisit:", session)
  this.de&&mand( !this.isProxy() )
  if( session.isGuest() && !session.wiki.isVeryOpen() ){
    this.user_de&&bug( "Don't track guest:", session)
    return
  }
  if( session.isGone ){
    // ToDo: maybe I should track, better late than never
    this.user_de&&bug( "Don't track gone session:", session)
    return
  }
  // Do nothing if user is already bound to the session
  if( this.session == session ){
    this.user_de&&bug( "Don't track seen session:", session)
    return
  }
  // Create/Update info about visit
  this.session = session
  this.visits || (this.visits = {})
  // Date of visit is persisted for first visit and anything premium
  var key = session.wiki.fullname() + session.loginPage.name
  if( this.visits[key] ){
    // While in beta, I track all visit as if premium
    // ToDo: track premium only if too expensive otherwise
    if( true || this.isPremium() || session.wiki.isPremium() ){
      this.touch()
    }	    
  }else{
    this.touch()
  }
  this.visits[key] = {
    wiki:  session.wiki.fullname(),
    title: session.wiki.getTitle( session),
    login: session.loginPage.name,
    name:  session.loginName,
    time:  Sw.dateNow.toISOString()
  }
  this.save( function( err ){
    if( err ){
      // ToDo: err
    }
  })
}

UserProto.getVisits = function(){
// Returns the hash that contains the visits
  this.de&&mand( !this.isProxy() )
  return this.visits
}

UserProto.getSortedVisits = function(){
  var visits = this.getVisits()
  if( !visits )return []
  var item
  var time
  var buf = []
  for( item in visits ){
    buf.push( item, {name: item, time: visits[item]})
  }
  buf = buf.sort( function( a, b ){
    return a.time > b.time ? 1 : (a.time == b.time ? 0 : -1) }
  )
  visits = []
  for( item in buf ){
    visit.push( buf[item].name)
  }
  return visits
}

UserProto.isProxy = function(){
// A "proxy" user is a user that belongs to either Twitter or mail.
  return !this.isLocal
}

UserProto.isDeprecated = function(){
// A local user becomes deprecated after a merging due to a conflict
  this.de&&mand( this.isLocal )
  return !!this.update
}

UserProto.is = function( service ){
  return this.service == service
}

UserProto.getPrimaryId = function( service ){
  return this.isProxy()
  ? this.local.getPrimaryId( service)
  : this.id[service] ? this.id[service][0] : ""
}

UserProto.getIds = function( service ){
  return this.isProxy()
  ? this.local.getIds( service)
  : this.id[service] ? this.id[service].slice( 0) : []
}

UserProto.getOwnIds = function( service ){
  return this.id[service] ? this.id[service].slice( 0) : []
}

UserProto.setOwnIds = function( service, list ){
  this.id[service] = list
}

UserProto.hasId = function( service, id, as_primary ){
  this.de&&mand( service )
  this.de&&mand( id )
  if( this.service == service )return this.id[service][0] == id
  var ids = this.getIds( service)
  if( as_primary ){
    return ids[0] == id
  }
  return ids.indexOf( id) >=  0
}

UserProto.hasOwnId = function( service, id, as_primary ){
  if( this.service == service )return this.id[service][0] == id
  var ids = this.getOwnIds( service)
  if( as_primary ){
    return ids[0] == id
  }
  return ids.indexOf( id) >=  0
}

UserProto.getSecondaryIds = function( service ){
  return this.getIds( service).slice( 1)
}

UserProto.setPrimaryId = function( service, id ){
  this.de&&mand( !this.isProxy() )
  this.de&&mand( service )
  this.de&&mand( id )
  var ids = this.getIds( service)
  var ii = ids.indexOf( ids)
  if( ii < 0 ){
    this.id[service] = [id].concat( ids)
    return this
  }
  if( ii == 0 )return this
  ids.splice( ii, 1)
  this.id[service] = [id].concat( ids)
  return this
}

UserProto.addId = function( service, id ){
// Add an id for the specified service, it becomes the new primary id.
  this.de&&mand( service )
  this.de&&mand( id )
  var ids = this.getOwnIds( service)
  var ii = ids.indexOf( id)
  if( ii >= 0 ){
    if( ii == 0 ){
      this.deep_user_de&&bug( "already primary, service:", service, "id:", id)
      return this
    }
    // Already present id becomes the new "primary"
    var tmp = ids[0]
    ids[0]  = id
    ids[ii] = tmp
    this.deep_user_de&&bug( "New primary, service:", service, "id:", id)
    this.setOwnIds( service, ids)
    return this
  }
  this.deep_user_de&&bug( "Adding, service:", service, "id:", id)
  ids.push( id)
  // Make sure it is the new primary
  if( ids.length > 1 ){
    var tmp = ids[0]
    ids[0] = id
    ids[ids.length - 1] = tmp
  }
  this.setOwnIds( service, ids)
  return this
}

UserProto.clearId = function( service, id ){
  this.de&&mand( !this.isProxy() )
  this.de&&mand( service )
  this.de&&mand( id )
  var ids = this.getOwnIds( service)
  var ii = ids.indexOf( id)
  if( ii < 0 )return this
  ids.splice( ii, 1)
  this.id[service] = ids
  return this
}

UserProto.clearSecondaryId = function( service, id ){
  this.de&&mand( !this.isProxy() )
  this.de&&mand( id != this.getPrimaryId( id) )
  return this.clearId( service, id)
}

UserProto.clearPrimaryId = function( service ){
  this.de&&mand( !this.isProxy() )
  return this.clearId( this.getPrimaryId( service))
}

UserProto.getAllOtherIds = function(){
// Returns all the ids for all the other services
// Returns { s2[id1, id2, ...], s3...}
// For proxies, delegates to local user
  this.de&&mand( !this.isProxy() )
  var ids = SW.copyHash( this.id)
  delete ids[this.service]
  return ids
}

UserProto.getOtherIds = function( service ){
// Returns the ids in other (non local) services, as a list
// Returns null if none
  return this.getAllOtherIds[service]
}

UserProto.isEmpty = function(){
// A User is empty if it does not reference some other user
  var size = 0
  for( var key in this.id ){
    size++
    // Not empty if at least 2 services
    if( size > 1)return false
  }
  return true
}

UserProto.assertLocalNotEmpty = function(){
  if( !this.isProxy() && !this.isEmpty() )return
  if( this.isProxy() ){
    this.bug_de&&bug( "unexpected proxy user:" + this)
  }
  if( this.isEmpty() ){
    this.bug_de&&bug( "unexpected empty user:" + this)
  }
  this.bug_de&&bug( "User:", this, "dump:", this.dump())
  this.de&&mand( false )
}

UserProto.assertProxyNotEmpty = function(){
  if( this.isProxy()
  && !this.isEmpty()
  && this.id["User"]
  && this.id["User"][0]
  )return
  if( !this.isProxy() ){
    this.bug_de&&bug( "Not the expected proxy, localUser:", this)
  }else if( !this.id["User"] ){
    this.bug_de&&bug( "No id for local service")
  }else if( !this.id["User"][0] ){
    this.bug_de&&bug( "Empty primary id for local service")
  }else if( this.isEmpty() ){
    this.bug_de&&bug( "Empty proxy User")
  }
  this.bug_de&&bug( "User:", this, "dump:", this.dump())
  this.de&&mand( false )
}

UserProto.isWiki = function(){
// True if user is a "Wiki" type of proxy 
  return this.isProxy() && this.service == "Wiki"
}

UserProto.isTwitter = function(){
// True if user is a proxy that belongs to Twitter
  return this.isProxy() && this.service == "Twitter"
}

UserProto.isMail = function(){
// True if user is a proxy that has a mail address
  return this.isProxy() && this.service == "Mail"
}

UserProto.isDropbox = function(){
// True if user is a proxy that has a Dropbox token
  return this.isProxy() && this.service == "Dropbox"
}

UserProto.touch = function(){
// Track a change so that .save() knows it has to persist it.
  this.deep_user_de&&bug( "touched")
  this.isDirty = true
}

UserProto.load = function( cb ){
// Incarn the user's page and then invoke cb( err, user, page).
// Sets page.user to reference This.
// Invokes cb( 0, user, page) or cb( err, user, page) on error.
  var that = this
  function loaded( err, page ){
    that.page = page
    page.user = that
    if( that.isLocal ){
      page.localUser = that
    }
    if( !that.isLoaded && !that.isDirty ){ that.restoreUserContext() }
    cb.call( that, err, that, page)
  }
  this.page.read( loaded)
}

UserProto.restoreUserContext = function(){
// Called when page is loaded. This method reads data from the page in order
// to retrieve the various ids of the user on various services.
// This method is expected to be called once only.
  this.de&&mand( this.page )
  if( this.isDirty ){
    this.bug_de&&bug( "Restore context while dirty, dump:", this.dump())
    this.de&&mand( !this.isDirty )
  }
  this.de&&mand( !this.isLoaded, "already loaded" )
  this.de&&mand_eq( this.service, this.page.getService(), "bad service" )
  var service
  var true_id = this.id[this.service][0]
  var ids = this.page.get( "Ids")
  if( ids ){
    this.id      = JSON.parse( ids)
    this.name    = this.page.get( "Name")
    this.label   = this.page.get( "Label")
    this.premium = this.page.get( "Premium")
  }
  var visits = this.page.get( "Visits")
  if( visits ){
    this.visits = JSON.parse( visits)
  }
  this.de&&mand( this.id[this.service][0] == true_id )
  this.user = this.page.get( "User")
  this.isDirty = false
  this.isLoaded = true
}

UserProto.save = function( cb ){
// Persists changes, if any, into the user's page.
// If user is a proxy, local user is saved too if it is know.
// Invokes cb( 0, user, page) or cb( err, user, page) on error.
  var that = this
  // There is no point in saving an half baked user
  this.de&&mand( !this.isEmpty(), "half baked" )
  function saved( err, page ){
    that.deep_user_de&&bug( "saved")
    that.isDirty = !!err
    if( that.isProxy() && that.local ){
      that.deep_user_de&&bug( "saving local")
      return that.local.save( function( lerr, luser, lpage ){
        that.deep_user_de&&bug( "saved local, err:", lerr)
        cb.call( that, lerr || err, that, that.page)
      })
    }  
    cb.call( that, err, that, page)
  }
  this.de&&mand_eq( this.service, this.page.getService(), this.page )
  if( !this.isDirty ){
    this.deep_user_de&&bug( "Useless save, not dirty")
    return saved( 0, this.page)
  }
  this.page.set( "Ids",          JSON.stringify( this.id))
  this.page.set( "User",         this.user)
  this.page.set( "Name",         this.name)
  this.page.set( "Label",        this.getLabel())
  if( !this.isProxy() ){
    this.page.set( "Visits",     JSON.stringify( this.visits))
    if( this.isPremium() ){
      this.page.set( "Premium", "true")
    }
  }
  var text = "User " + Sw.dateNow.toISOString()
  this.user_de&&bug( "saving")
  this.page.write( text, saved)
}

UserProto.set = function( key, value ){
  this.de&&mand( this.isLoaded )
  this.de&&mand( this.page.wasIncarned() )
  var old_value = page.get( key)
  if( value != old_value ){
    page.set( key, value)
    this.deep_user_de&&bug( "set:", key, "to:", value)
    this.isDirty = true
  }
}

UserProto.get = function( key ){
  return this.page.get( key)
}

UserProto.trackServiceId = function( service, id, cb ){
// Remembers the id of the user in another service.
// This information is stored in the local user if This belongs to some
// other service.
// The information is stored in the proxy user too. It is bidirectionnal.
// Invoke cb( err, local_user, service_user)
// Note: the user's id cannot change for his/her own service. ie the twitter
// id of a twitter proxy cannot change, ie ids are immutable.
  this.de&&mand( service != this.service || id == this.id[this.service][0] )
  var that = this
  that.deep_user_de&&bug( "track, service:", service, "id:", id)
  // First, load the user
  this.load( function track_load_cb( err, user ){
    that.deep_user_de&&bug( "track, loadedUser:", user)
    // Add service id if needed (ie either new or not primary id)
    if( !user.hasOwnId( service, id, true) ){	// true => as primary
      user.user_de&&bug( "track new primary, service:", service, "id:", id)
      user.addId( service, id)
      user.touch()
    }
    // Update bidirectional relationship. If no other User, create a new one
    if( user.isEmpty() ){
      // If proxy user id is missing... it is beeing created by whoever called me
      if( that.id["User"] && that.id["User"][0] ){
        // User will be saved later, when not empty
        user.de&&mand( !user.isDirty )
        that.deep_user_de&&bug( "track, half baked")
        return cb.call( that, 1, user, user)
      }else{
        // No local user yet, set one, random. ToDo: collision avoidance
        var random = Wiki.random3Code()
        that.user_de&&bug( "new local random id:", random)
        user.addId( "User", random)
        user.touch()
      }
    }
    user.save( function( serr, saved_user, page ){
      that.deep_user_de&&bug( "track, savedUser:", user)
      de&&mand( serr || saved_user == user )
      user.de&&mand( serr || !user.isDirty, "dirty" )
      // Create a bi-directional relationship
      var otheruser
      if( user.isLocal ){
        otheruser = User.lookup( that.wiki, service, id).user
      }else{
        de&&mand( user.id["User"])
        otheruser = User.lookup( that.wiki, "User", user.id["User"][0]).user
      }
      user.deep_user_de&&bug( "track other:", otheruser)
      // If no other user, done
      if( user == otheruser ){
        user.deep_user_de&&bug( "track same other:", otheruser)
        return cb.call( that, err || serr, user, user)
      }
      user.de&&mand( user != otheruser, "same user")
      otheruser.load( function( serr1 ){
        // ToDo: err handling
        that.deep_user_de&&bug( "track, otherLoadedUser:", otheruser)
        if( !otheruser.hasOwnId( user.getService(), user.getId(), true) ){
          otheruser.user_de&&bug( "track back new primary other:", user)
          otheruser.addId( user.getService(), user.getId())
          otheruser.touch()
        }
        otheruser.deep_user_de&&bug( "saving other")
        otheruser.save( function( serr2, _, page ){
          otheruser.deep_user_de&&bug( "saved, invoked callback, err:", serr2)
          otheruser.de&&mand( serr2 || !otheruser.isDirty, "dirty" )
          if( user.isLocal ){
            otheruser.de&&mand( !otheruser.isLocal )
            otheruser.local = user
            user.deep_user_de&&bug( "otherUser:", otheruser, "cb:", cb.name)
            cb.call( that, err || serr || serr1 || serr2, user, otheruser)
          }else{
            otheruser.de&&mand( otheruser.isLocal )
            user.local = otheruser
            otheruser.deep_user_de&&bug( "user:", user, "cb:", cb.name)
            cb.call( that, err || serr || serr1 || serr2, otheruser, user)
          }
        })
      })
    })
  })
}

User.extractName = function( id ){
// Returns name part of name=id
  var ii = id.indexOf( "=")
  if( ii < 0 )return ""
  return id.substr( 0, ii)
}

User.extractId = function( id ){
// Returns id part of name=id
  var ii = id.indexOf( "=")
  if( ii < 0 )return id
  return id.substr( ii + 1)
}

// For Wiki ids, where wiki=code forms the full id
UserProto.extractWikiName = User.extractName
UserProto.extractCode     = User.extractId

UserProto.trackTwitterId = function( name, id, cb ){
// Track the user's twitter id
  this.trackServiceId( "Twitter", name + "=" + id, cb)
}

UserProto.trackWikiId = function( wiki, code, cb ){
// Track the user's wiki id
// Note: order is reverse than usual, ie id first and then screenname
// because id is a wiki name & screenname is actually a code/secret
  this.trackServiceId( "Wiki", wiki + "=" + code, cb)
}

UserProto.trackMailId = function( id, cb ){
// Track the user's mail id
  this.trackServiceId( "Mail", id, cb)
}

UserProto.trackDropboxId = function( id, cb ){
// Track the user's dropbox id
  this.trackServiceId( "Dropbox", id, cb)
}

UserProto.trackLocalId = function( id, cb ){
// Associate a proxy user with it's local user account
  this.trackServiceId( "User", id, cb)
}

UserProto.getLocal = function( cb, seen, proxy_user, loop ){
// Get the local user, works on proxy users.
// Invokes cb( 0, local_user), cb( err, local_user) on error.
// When the callback is called, the User object is fully loaded(), ie. .load()
// was invoked.
  if( loop ){
    this.bug_de&&bug( "Loop in User.getLocal()")
    return cb( 1, this)
  }
  var that = this
  this.de&&mand( this.page.user == this )
  // First, load whatever proxy or local object we have
  this.load( function get_local_load_cb( err, userpage ){
    seen || (seen = {})
    // If loaded object is local, almost done
    if( that.isLocal ){
      if( that.page ){
        that.page.localUser = that
      }
      // Deal with corrupted empty local object
      // This may happen, when a SimpliWikiIdXxxx page gets empty by accident.
      // What accident? I'm not sure... but I've seen it
      if( proxy_user ){
        proxy_user.assertProxyNotEmpty()
        if( !that.hasId( proxy_user.getService(), proxy_user.getId()) ){
          that.bug_de&&bug( "Fix broken one way relation, from:", proxy_user,
          "to:", that)
          return that.trackServiceId(
            proxy_user.getService(),
            proxy_user.getId(),
            function fix_corruption_save_the_world_cb( err, lusr, pusr ){
              that.de&&mand( lusr  == that,       "bad local:" + lusr + "!=" + that)
              that.de&&mand( puser == proxy_user, "bad proxy:" + pusr + "!=" + proxy_user)
              lusr.assertLocalNotEmpty()
              puser.assertProxyNotEmpty()
              if( err ){
                // ToDo: err handling...
                that.bug_de&&bug( "Unhandled error in User.getLocal()")
                return cb.call( that, err, that, that)
              }
              // Let's retry, once
              return that.getLocal( cb, null, null, true) // true => loop
            }
          )
        }
      }
      // Deal with deprecated local users (after merging)
      if( that.update ){
        if( seen[that.update] ){
          that.bug_de&&bug( "Loop with user")
          return cb.call( that, err, that, that)
        }
        var valid_user = User.lookup( that.wiki, "User", that.update)
        that.de&&mand( valid_user.isLocal )
        valid_user.getLocal( cb)
      }
      return cb.call( that, err, that, that) 
    }
    // Loaded object is a proxy, let's see how to get to the local User
    // When no local User, allocate one
    if( !that.id["User"] || !that.id["User"][0] ){
      // that.de&&mand( false, "missing local id")
      // No local user yet, set one, random. ToDo: collision avoidance
      var random = Wiki.random3Code()
      that.user_de&&bug( "new local random id:", random)
      // ToDo: remember that this is a new random id in order to avoid a
      // useless read in the store
      that.trackServiceId( "User", random, function localcb( err, local_user){
        that.de&&mand( local_user.isLocal)
        if( that.page ){
          that.page.localUser = local_user
        }
        that.user_de&&bug( "new local id tracked, local:", local_user)
        return cb.call( that, err, local_user)
      })
      return
    }
    that.de&&mand( that.id["User"],    "no ids for User")
    that.de&&mand( that.id["User"][0], "no id 0 for User")
    // There is an existing "local" User object, let's get it
    if( !that.local ){
      that.local = User.lookup( that.wiki, "User", that.id["User"][0]).user
    }
    that.local.de&&mand( !that.local.isProxy() )
    that.local.getLocal( cb, null, that)
  })
}

UserProto.getHomepage = function( cb ){
// Returns the "HomePage" of the user, inside the user's personnal wiki.
// cb is cb( err, page, user, local_user)
// This is a fairly powerfull function as it can start from a proxy User,
// load the local User, init her wiki and then read the HomePage right
// before calling the cb... !
  // Do nothing if homepage was accessed before
  if( this.homepage ){ cb.call( this, this.homepage.err, this, user) }
  var that = this
  // Load local User
  this.getLocal( function( err, user ){
    if( err ){ return cb.call( that, err, null, that, user) }
    that.de&&mand( user.isLocal )
    if( that.homepage ){ cb.call( that, that.homepage.err, that, user) }
    // Fire user's wiki
    user.wiki.lookupWiki( "user/f" + user.getId() + "/x", function( wiki ){
      if( !wiki ){ return cb.call( that, 1, null, that, user) }
      wiki.de&&mand( wiki.isUserWiki() )
      // Read homepage
      wiki.lookupPage( "HomePage").read( function( err, page ){
        if( err ){ return cb.call( that, err, page, that, user) }
        page.user     = user
        user.homepage = page
        cb.call( that, 0, page, that, user)
      })
    })
  })
}

UserProto.mergeWith = function( other ){
// Called to merge two local users in one
// Returns the one that is considered the "main" user
// The other one gets an addition property: "user" that reference the
// main user.
// Because Facebook policy is to require "true" persons, the user that
// has a facebook identity tends to become the main one.
// If both user have a different Facebook identity... then I refuse to
// merge, as I don't feel competent about multiple identities disorter.
  this.de&&mand( this.isLocal() )
  other.de&&mand( other.isLocal() )	
  return this
}

UserProto.test = function(){

  var that = this
  function p(){ that.test_de&&bug .apply( that, arguments) }
  function a(){ that.test_de&&mand.apply( that, arguments) }
  function eq( v1, v2, msg ){
    if( v1 == v2 )return
    p( "!!! not equal, ", Sys.inspect( v1), " and ", Sys.inspect( v2),
    "" + (msg ? msg : ""))
    a( v1 == v2 )
  }
  function neq( v1, v2, msg ){
    if( v1 != v2 )return
    p( "!!! equal, ", Sys.inspect( v1), " and ", Sys.inspect( v2),
    "" + (msg ? msg : ""))
    a( v1 != v2 )
  }
  
  p( "Starting User.test()")
  var testuser
  var testuserpage
  var testfbuser
  var wiki = TheRootWiki
  
  wiki.lookupWiki( "", function lookup_wiki_cb( wiki ){
    p( "The Root Wiki is up:", wiki)
    wiki.assertIsWiki()
    eq( wiki.lookupPage( "Test"), wiki.lookupPage( "Test") )

    wiki.setTestPage( "UserId" + "333333333")
    wiki.setTestPage( "FacebookIdFbtest1")
    wiki.setTestPage( "TwitterIdTwtest1")

    testuserpage = User.lookup( wiki, "User", "333333333")
    p( "Here is the test user's page:", testuserpage)
    testuserpage.assertIsPage()
    eq( testuserpage, User.lookup( wiki, "User", "333333333") )

    testuser = testuserpage.user
    p( "Here is the User object:", testuser)
    testuser.assertIsUser()

    testuser.getLocal( function get_local_cb( err, localuser ){
      localuser.assertIsUser()
      p( "Local user is the same user:", localuser)
      localuser.assertIsUser()
      eq( localuser, testuser )
            
      testuser.getHomepage( function homepage_cb( err, page, user, localuser ){
        p( "User has a homepage:", page, ", wiki:", page.wiki)
        page.assertIsPage()
        eq( page.wiki.parentWiki.name, "user")
        eq( user, localuser, "user should be equal to localuser" )
        eq( page.wiki.name, "f" + localuser.getId() )
        eq( page.name, "HomePage" )
        a( err, "page should not exist on store" )

        user.trackFacebookId( "Fbtest1",
        function track_fb_id_cb( err, localuser, fbuser ){
          p( "trace facebook id's err:", err)
          a( !err )
          p( "localuser:", localuser, ", fb id was set")
          localuser.assertIsUser()
          eq( localuser, user, "user should be local user" )
          a( fbuser.isFacebook(), "should be a fb user")
          eq( user.getFacebookId(), "Fbtest1",
          "wrong fb id: " + user.getFacebookId() )
          testfbuser = fbuser
          var fbidpage = wiki.lookupPage( "FacebookIdFbtest1")
          fbidpage.assertIsPage()
          p( "content of ", fbidpage, " is: ", fbidpage.getBody())
          p( fbidpage.dump())
          a( !fbuser.isDirty, "dirty " + fbuser)
          eq( fbuser.getLabel(), null, "bad label")
          fbuser.setLabel( "fb test1 label")
          eq( fbuser.getLabel(), "fb test1 label" )
          a( fbuser.isDirty, "should be dirty")
          fbuser.save( function( err ){
            a( !err, "issue with save")
          })
          user.trackTwitterId( "Twtest1", "1",
          function track_tw_id_cb( err, localuser, twuser ){
            p( "Test with User.test() is a success")
            a( !twuser.isDirty, "dirty " + twuser )
            test2()
          })
        })
      })
    })
  })
  
  function test2(){
     p( "Starting User.test() 2")
     var fbidpage = wiki.lookupPage( "FacebookIdFbtest1")
     fbidpage.assertIsPage()
     p( "content of ", fbidpage, " is: ", fbidpage.getBody())
     p( "user of ", fbidpage, " is: ", fbidpage.user)
     eq( fbidpage.getService(), "Facebook", "bad service")
     var xuserpage = User.lookup( wiki, fbidpage.getService(), fbidpage.getId())
     p( "xuserpage: ", xuserpage)
     p( "xuser.user:", xuserpage.user)
     var xuser = xuserpage.user
     p( "testfbuser:", testfbuser)
     p( "testfbuser.page:", testfbuser.page)
     eq( testfbuser.page, xuser.page )
     eq( testfbuser, xuser )
     p( "test User.test2() is a success")
     test3()
  }
  
  function test3(){
    var ses = new Session()
    ses.wiki = wiki
    ses.twitterId = "Twtest1"
    ses.twitterName = "test"
    ses.twitterLabel = "Test label"
    ses.loginName = "@test"
    ses.loginPage = ses.lookup( "HomePage")
    ses.trackTwitterUser( function( err, s, luser ){
      eq( ses, s, "sessions should be the same")
      a( !luser.isProxy(), "should not be a proxy: " + luser )
      eq( luser.getTwitterId(), "Twtest1", "bad id")
      p( "test User.test3() is a success")
      test4()
    })
  }
  
  function test4(){
    MockRequest.get( Sw.handler, "/",
    function( event, data, rsp, req ){
      neq( event, 'timeout' )
      eq( rsp.writeCode, 200, "bad code")

      MockRequest.get( Sw.handler, "/test/HomePage",
      function( event, data, rsp, req ){
        eq( event, 'end')
        eq( rsp.writeCode, 200, "bad code")
        var session = req.session
        eq( session.wiki.name, "test" )
        a( session.isAnonymous() )
        p( "User:", session.userName() )
        eq( session.userName(), "SomeGuest" )
        eq( session.getCurrentPage().name, "HomePage")
        p( "test User.test4() is a success")
      })
    })
  }
}


require( "./globals" ).inject( User, exports );
// section: end user.js
