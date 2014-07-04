// section: date.js

var Session = require( "./session.js" ).Session;
var SessionProto = Session.prototype;

Session.dateTooltip = function( strdate ){
// Return a readable text for an ISO date
// ToDo: should be client side when possible
// ToDo: See also https://github.com/zachleat/Humane-Dates/blob/master/src/humane.js
// & http://www.zachleat.com/web/2008/03/23/yet-another-pretty-date-javascript/
  // I cache some results, based on date & time, without the last digit
  // 2010-09-20T23:45:5xxxxxxxxx, xxxxxx is ignored
  var cname = this.config.lang + strdate.substr( 0, 18)
  var tip = Sw.cachedDateTooltips[cname]
  if( tip )return tip
  // From Paul SOWDEN, http://delete.me.uk/2005/03/iso8601.html
  var regexp = "([0-9]{4})(-([0-9]{2})(-([0-9]{2})"
  +  "(T([0-9]{2}):([0-9]{2})(:([0-9]{2})(\.([0-9]+))?)?"
  + "(Z|(([-+])([0-9]{2}):([0-9]{2})))?)?)?)?"
  var d = strdate.match( new RegExp( regexp, "i"))
  if( !d ){
    this.de&&bug( "Invalid date:", strdate)
    return "???"
  }
  var offset = 0
  var date = new Date( d[1], 0, 1)
  if( d[ 3] ){ date.setMonth( d[3] - 1) }
  if( d[ 5] ){ date.setDate( d[5])      }
  if( d[ 7] ){ date.setHours( d[7])     }
  if( d[ 8] ){ date.setMinutes( d[8])   }
  if( d[10] ){ date.setSeconds( d[10])  }
  if( d[12] ){ date.setMilliseconds( Number( "0." + d[12]) * 1000) }
  if( d[14] ){
    offset = (Number( d[16]) * 60) + Number( d[17])
    offset *= ((d[15] == '-') ? 1 : -1)
  }
  offset -= date.getTimezoneOffset()
  var time = (Number( date) + (offset * 60 * 1000))
  tip = this.timeLabel( Number( time))
  // If recent change color, color fades aways as time passes
  var age = Sw.timeNow - time
  if( age < (36 * 3600 * 1000) ){		// 36 hours
    tip += '" class="recent'
  }else if( age > (45 * 84600 * 1000) ){	// 45 days
    tip += '" class="old'
  }
  // Cache anything older then one hour, cache is cleared every hour
  // ToDo: implement cache clear
  if( age > 3600 * 1000 ){
    Sw.cachedDateTooltips[cname] = tip
  }
  return tip
}

Session.timeLabel = function( time, with_gmt ){
// Returns a sensible text info about time elapsed.
  with_gmt || (with_gmt = this.isCurator)
  var delta = ((Sw.timeNow + 10 - time) / 1000) // + 10 to avoid 0/xxx
  var day_delta = Math.floor( delta / 86400)
  if( isNaN( day_delta) )return ""
  if( day_delta < 0 ) return this.i18n( "in the future")
  var gmt = !with_gmt ? "" : ((new Date( time)).toGMTString() + ", ")
  return gmt
  + (day_delta == 0
  && ( delta < 5     
      && this.i18n( "just now")
    || delta < 60
      && this.i18n( "il y a ") + Math.floor( delta )
      + this.i18n( " seconds ago")
    || delta < 120
      && this.i18n( "1 minute ago")
    || delta < 3600
      && this.i18n( "il y a ") + Math.floor( delta / 60 )
      + this.i18n( " minutes ago") 
    || delta < 7200
      && this.i18n( "about an hour ago")
    || delta < 86400
      && this.i18n( "il y a ") + Math.floor( delta / 3600 )
      + this.i18n( " hours ago")
  ) 
  || day_delta == 1
    && this.i18n( "yesterday")
  || day_delta < 7
    && this.i18n( "il y a ") + day_delta
    + this.i18n( " days ago") 
  || day_delta < 31
    && this.i18n( "il y a ") + Math.ceil( day_delta / 7 )
    + this.i18n( " weeks ago")
  || day_delta >= 31
    && this.i18n( "il y a ") + Math.ceil( day_delta / 30.5 )
    + this.i18n( " months ago")
  ).replace( /^ /, "") // Fix double space issue with "il y a "
}

// section: end date.js

Session.userLabelTooltip = function( page, with_less ){
// Assuming page is the "name" of a user, a @twitter
// this method returns that name plus some user label about it, if such
// information is available.
// If the page is about a guest, returns the guest's entry point in the wiki.
// Else, returns the page's name, maybe i18ned.
// Returns less informations if "with_less"
  var name = page.name
  if( name.includes( "Guest") ){
    if( with_less ){
      return this.i18n( "a guest")
    }
    return this.i18n( "a guest") + " (" + name.replace( "Guest", "") + ")"
  }
  if( with_less )return this.i18n( name)
  var user_label = this.wiki.findUserLabel( name)
  if( !user_label )return this.i18n( name)
  return name + " (" + user_label + ")"
}


Session.tooltip = function( page, with_user_label ){

  NDe&&bug( "Building tooltip for link to page ", page)
  // ToDo: improve S/N ratio

  var title = []

  if( with_user_label ){
    with_user_label = this.userLabelTooltip( page)
    if( with_user_label != page.name ){
      title.push( with_user_label)
    }
  }else{
    with_user_label = ""
  }

  if( page.isStamps() && this.userName().starts( page.name) ){
    title.push( this.i18n( "your changes"))
  }else

  if( page.isHome() ){
    if( this.wiki.name == "@" + this.twitterName ){
      title.push( this.i18n( "your personal wiki"))
    }
    if( this.wiki.name == this.wikiId + "-wiki" ){
      title.push( this.i18n( "a wiki of yours"))
    }
    var label = this.wiki.getTitle()
    label = this.wiki.fullname().replace( /\/$/, "")
    + (!label ? "" : " (" + label + ")")
    title.push( label)
  }else

  if( page.isUser() ){
    if( page.name == this.usernamize( this.userName()) ){
      if( page.name == "UserSome" ){
        title.push( this.i18n( "anonymous"))
      }else{
        title.push( this.i18n( "your personal page"))
	if( this.wiki.name == "@" + this.twitterName ){
          title.push( this.i18n( "in your personal wiki"))
        }else if( this.wiki.name == this.wikiId + "-wiki" ){
          title.push( this.i18n( "in a wiki of yours"))
        }
      }
    }else
    if( /User\[|User@|@$/.test( page.name) ){
      if( !"UserRestore".starts( page.name) ){
        title.push(
          this.i18n( "the personal page of ")
          + page.name.substr( "User".length)
        )
      }
    }
  }

  if( page.wasIncarned() && page.isVoid() ){
    title.push( this.i18n( "an empty page"))
  }

  if( page.wasDeleted() ){
    title.push( this.i18n( "a deleted page"))
  }

  if( page.isDraft() ){
    title.push( this.i18n( "a draft"))
  }

  var user

  if( page.isCode() && (user = page.getFirstUser()) ){
    user = user.replace( "Curator", "")
    title.push( this.i18n( "'invitation code' for ") + user)
  }

  // Info for members only, not guests
  if( !this.isGuest() ){

    var writer = page.lastWriter()
    if( writer ){
      NDe&&bug( "Link to ", page, ", writer: ", writer)
      if( writer != this.userName() || this.isGuest() ){
        title.push( this.i18n( "by ")
        + this.userLabelTooltip( this.lookup( writer), !with_user_label)
        + (!page.timeModified()
          ? ""
          : " " + this.timeLabel( page.timeModified()))
        )
      }
    }
  
    // If the page is associated to a session... tell some info about it
    var session = page.session()
    if( session ){
      // If "myself", signal it, usefull to double check current identity
      // why: user can be logged in with many identities, this can be confusing
      if( session == this && !this.isCurator ){
        if( !this.isGuest() ){
          title.push( this.i18n( "about you"))
        }
      }else{
        // Don't display this in the DoVisits page, it's confusing
        if( !this.getCurrentPage().isDo() ){
          var is_guest = session.isGuest()
          title.push(
            (this.i18n( is_guest ? "a guest" : "a member")),
            this.i18n( "active") + " " 
            + session.timeLabel( session.timeLastAccess)
          )
          // If user is gone recently, probably explicitely, signal it
          // why: adding "gone" is useless if timeLastAccess is obviously old
          if( session.isGone ){
            // Auto logout or manual logout?
            var age  = Sw.timeNow - session.timeLastAccess
            var auto = age > (is_guest ? SW.awayDelay : SW.logoutDelay)
            if( !auto ){
              title.push( this.i18n( "gone"))
            }
          }
        }
      }
    }
  
    var visitor = page.lastVisitor()
    // About visitor, unless same as last writer or session
    if( !session
    &&  visitor
    && (visitor != writer || page.timeVisited() != page.timeModified())
    ){
      // Filter out noise about current visitor
      if( visitor != this.userName()
      || (this.isGuest()
        && (Sw.timeNow -  page.timeVisited()) > 1000)
      ){
        if( visitor != writer ){
          if( visitor != "SomeGuest" ){
            title.push(
              this.i18n( "a page last visited by ")
              + this.userLabelTooltip( this.lookup( visitor), !with_user_label)
            )
          }else{
            title.push( this.i18n( "a page visited "))
          }
          title.push( " " + this.timeLabel( page.timeVisited()))
        }
      }else{
        // title.push( "a page last visited by you")
      }
    }

  } // if not guest

  // Remove dirty artefact
  title = title.join( ", ").trim()
  .replace( /, , /g, ", ")
  .replace( /  /g,   " ")
  .replace( /^, /,   "")
  .replace( / ,/g,   ",")
  .replace( /,,/g,   ",")
  .replace( /\.,/g,  ",")

  if( NDe && title ){ this.de&&bug( "Title of ", page, ": ", title) }
  return title
}


exports.Session = Session;
