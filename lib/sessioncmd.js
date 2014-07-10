// section: sessioncmd.js

var Session = require( "./session.js" ).Session;
var SessionProto = Session.prototype;

Session.doPageCommands = {
  Noop: function( cmd, cb ){ return cb( "Noop") }
}

Session.doPageCommands.Bye = function( cmd, cb ){
// Logs user out of current session & go back to index.html
  this.logout( "bye")
  return cb( {body:"Bye bye", redirect:true})
}

Session.doPageCommands.ByeBye = function( cmd, cb ){
// Logs user out of all sessions & go back to index.html, aka "hard logout"
  this.logout( "bye")
  // Forget dropbox credentials
  if( this.dropbox ){
    this.dropbox.password = "empty"
    this.dropbox.client   = null
  }
  // ToDo: debug this, it does not work
  this.byebye = true
  return cb( {body:"Bye bye bye", redirect:true})
}

Session.getAllWikiPageNames = function( without_empty ){
// Returns sorted list of wiki page names.
// Page that the user cannot read are skipped.
  var all_pages = this.wiki.getAllPages()
  var that      = this
  var pages     = []
  all_pages.forEach( function( page ){
    if( !that.mayRead( page) )return
    if( page.wasIncarned() && !that.canRead( page, true)     )return
    if( page.wasIncarned() && without_empty && page.isNull() )return
    pages.push( page.name)
  })
  pages = pages.sort()
  return pages
}

Session.getAllWikiPages = function( without_empty ){
// Returns sorted list of wiki pages
// Page that the user cannot read are skipped.
  var all_pages = this.wiki.getAllPages()
  var that      = this
  var pages     = []
  all_pages.forEach( function( page ){
    if( !that.mayRead( page) )return
    if( page.wasIncarned() && !that.canRead( page, true)     )return
    if( page.wasIncarned() && without_empty && page.isNull() )return
    pages.push( page)
  })
  pages = pages.sort( function( a, b ){
    return (a.name > b.name) ? 1 : (a.name == b.name) ? 0 : -1
  })
  return pages
}

Session.doPageCommands.ListReferences = function( cmd, cb ){
  var buf       = []
  var all_pages = this.getAllWikiPages()
  var npages    = 0
  var that      = this
  all_pages.forEach( function( page ){
    var links     = page.getLinks()
    var backlinks = page.getBacklinks( this.isCurator) // with_private
    // Remove some noise
    if( (links.length + backlinks.length) < 2 )return
    if( backlinks.length < 1 )return
    // Skip help pages, unless root wiki
    if( !(that.wiki.isRoot() && that.isCurator)
    && (("CategoryHelp" in backlinks)
     || ("CategoryCurator" in backlinks && !that.canCurator))
    )return
    npages++
    buf.push( "\n+++" + page.name)
    if( backlinks.length ){
      buf.push( "  "  + backlinks.join( "\n  "))
    }
    if( false && links.length ){
      buf.push( "out:\n  " + links.join( "\n  "))
    }
  })
  buf = "Pages: " + npages + "\n" + buf.join( "\n")
  return cb( buf)
}

Session.doPageCommands.Profile = function( cmd, cb ){
// Builds the "Your wikis" page

  var that = this
  var buf  = []

  // Some helpers
  function respond(){
    push( "\nSignIn, DoBye, DoByeBye, DoListLogin\n")
    if( that.isInTheJungle() ){
      if( that.isFearless() ){
        push( "DoTheLionNot HelpJungle")
      }else{
        push( "DoTheLion HelpJungle")
      }
    }
    cb( buf.join( "\n"))
  }
  function push( msg ){ buf.push( msg) }

  // Display user name and name of login page
  push( this.userName() )
  push( this.loginPage.name)

  // Either guest or member of the currently visited wiki
  if( this.isGuest() ){
    push( this.i18n( "guest in")  + " " + this.wiki.fullname( SW.name, true))
  }else{
    push( this.i18n( "member of") + " " + this.wiki.fullname( SW.name, true))
  }

  // Display list of wikis the user is currently logged in
  var logins = this.getLogins()
  var code
  var nwikis = 0
  var buf2 = [];
  var now_displayed = false;
  for( var wiki in logins ){
    nwikis++
    code = logins[wiki]
    if( code == wiki ){
    }else{
      if( !now_displayed ){
        now_displayed = true;
        push( "\nNow:" );
      }
      var id = "http://" + SW.domain + "/" + (wiki || "HomePage")
      buf2.push( "[" + (wiki || SW.name) + "](" + id + ")")
    }
  }
  if( buf2.length ){
    push( buf2.sort().join( "\n"))
    if( nwikis > 1 ){
      push( "DoByeBye")
    }
  }

  if( !this.user ){
    return respond()
  }

  // List list of visited wikis
  var visited = {}
  function dump_user( user, visited ){

    if( visited[user] )return
    visited[user] = true

    buf2 = []
    var msg
    var id
    var ids;
    for( var item in user.id ){
      ids  = user.id[item]
      for( var idx in ids ){
        msg = ""
        id = ids[idx]
        if( item == "Twitter" ){
          id = User.extractName( id)
          msg += " [@" + id
          + " wiki](http://" + SW.domain + "/@" + id + ")"
        }else
        if( item == "Wiki" ){
          id = User.extractId( id)
          msg += " [" + id
          + " wiki](http://" + SW.domain + "/" + id + ")"
        }else
        if( item == "User" ){
          msg += " [" + that.i18n( "private wiki")
          + "](http://" + SW.domain + "/user/f" + user.getId() + ")"
        }
        buf2.push( msg)
      }
    }
    
    push( that.i18n( "Yours"))
    push( buf2.sort().join( "\n"))

    // Display visits
    var list = []
    var visit // see User.trackVisit()
    var wiki
    var title
    var name
    var time
    var ii
    var entry
    for( item in user.visits ){
      visit =  user.visits[item]
      wiki  = visit.wiki // fullname, '/' terminated unless "" root
      title = Wiki.sanitizeTitle( visit.title)
      name  = visit.name
      time  = visit.time
      // Patch old format (v 0.04)
      if( !wiki || "/".ends( wiki) ){
        if( (ii = item.lastIndexOf( "/")) >= 0 ){
          wiki  = item.substr( 0, ii + 1)
        }else{
          wiki  = item ? (item + "/") : ""
        }
      }
      entry = ""
      + time
      + (name == that.userName() ? "" : " " + name)
      + " - ["
      + (!title ? wiki.replace( /\/$/, "") : title).replace( /\//g, " ")
      + "](http://" + SW.domain + "/"
      + encodeURI( wiki )
      + ")"
      //+ "\n  "   + user.visits[item].name
      list.push( entry)
    }
    if( list.length ){
      buf.push( that.i18n( "\nVisits") + that.i18n( ": "))
      list = list.sort().reverse()
      buf = buf.concat( list)
    }
    if( user.conflict ){
      buf.push( that.i18n( "\nOlder profile:"))
      dump_user( user.conflict, visited)
    }
  }

  push( "" )
  dump_user( this.user, visited )
  respond()
}

Session.doPageCommands.ListLogin = function( cmd, cb ){
  // ToDo: should include .Profile(). Why: "information at a glance"
  return cb(
    this.loginLogList.join( "\n")
    + "\n\nDoProfile, SignIn" + (!this.isGuest() ? ", DoBye, DoByeBye" : "")
  )
}

Session.doPageCommands.TheLion = function( cmd, cb ){
  if( !this.isInTheJungle() ){
    return cb( "This is not the jungle. HelpJungle")
  }
  if( this.isFearless() ){
    return cb( "Already a lion! HelpJungle")
  }
  this.isNotLion = false
  this.isLion    = true
  this.notify( "Welcome to the jungle!")
  this.notify( "Safe mode: DoTheLionNot")
  this.notify( "HelpJungle")
  return cb( "You're a lion now, be carefull. DoTheLionNot HelpJungle")
}

Session.doPageCommands.TheLionNot = function( cmd, cb ){
  if( !this.isFearless() ){
    return cb( "Already safe. HelpJungle")
  }
  this.isNotLion = true
  if( !this.isInTheJungle() ){
    return cb( "OK. But this is is not the jungle. HelpJungle")
  }
  return cb( "OK. Safe now. DoTheLion HelpJungle")
}

Session.doPageCommands.Cloud = function( cmd, cb ){
// ToDo: "Mind map", see https://github.com/kennethkufluk/js-mindmap
  
  var buf = ["HTML"]

  // Initialy from http://rive.rs/projects/tumblr-tag-clouds
  buf.push( this.htmlScript( 
  function sw_tag_cloud( config, all_tags_and_visits ){

    // console.log( "sw_tag_cloud")
    if( !config )return
  
    // Extract tag names and visit count out of combined list
    var all_tags   = []
    var all_visits = {}
    var a_tag
    var limit      = all_tags_and_visits.length
    var ii         = 0
    for( ii = 0 ; ii < limit ; ii++ ){
      a_tag = all_tags_and_visits[ii]
      all_tags.push( a_tag)
      ii++
      all_visits[a_tag] = all_tags_and_visits[ii]
    }

    function sortNum( a, b ){ return (a - b) }

    function sortByValue( keyArray, valueMap ){
      return keyArray.sort(
        function( a, b ){ return valueMap[a] - valueMap[b] }
      )
    }

    function getProperties( obj ){
      var properties = []
      for( var property in obj ){
        properties.push( property) 
      }
      return properties
    }

    function getCloud(){

      var start      = 0
      var tag_counts = []
      var cloud      = {}
      var url_base = !config.url
      ? ('http://' + document.domain + '/')
      : (config.url + '/')

      // Count occurences
      $(all_tags).each( function( i, tag ){
        cloud[tag] = (cloud[tag] ? cloud[tag] + 1 : 1);
      })

      var raw_cloud = {}
      for( var tag in cloud ){
        raw_cloud[tag] = cloud[tag]
      }

      if( config.math == 'log' ) {
        for( tag in cloud ){
          cloud[tag] = Math.log( cloud[tag])
        }
      }

      if( config.order == 'frequency' ){
        var cloudSorted = {}
        var cloudKeys   = getProperties(cloud);
        var sortedTags  = sortByValue( cloudKeys, cloud).reverse()
        for (k in sortedTags) {
          cloudSorted[sortedTags[k]] = cloud[sortedTags[k]];
        }
        cloud = cloudSorted;

      } else if( config.order == 'alphabetical' ){
        var cloudSorted = {}
        var cloudKeys = getProperties( cloud);
        var sortedTags = cloudKeys.sort( function( x, y ){
          var a = String( x).toUpperCase()
          var b = String( y).toUpperCase()
          if( a > b ){ return 1  }
          if( a < b ){ return -1 }
          return 0
        })
        for( k in sortedTags ){
          cloudSorted[sortedTags[k]] = cloud[sortedTags[k]]
        }
        cloud = cloudSorted

      } else if( config.order == 'popularity' ){
        var cloudSorted = {}
        var cloudKeys   = getProperties( cloud)
        var sortedTags  = sortByValue( cloudKeys, all_visits).reverse()
        for( k in sortedTags ){
          cloudSorted[sortedTags[k]] = all_visits[sortedTags[k]]
        }
        cloud = cloudSorted
      }

      size_range = config.maxsize - config.minsize

      // Find range of occurrence count (or number of visits)
      for( j in cloud ){
        tag_counts.push( cloud[j])
      }
      // Sort collected value to extract min and max
      tag_counts.sort( sortNum)
      var min_count = tag_counts[0]
      var max_count = tag_counts[tag_counts.length - 1]
      de&&bugC( "Range, min:" + min_count + ", max: " + max_count)
      var slope = size_range / (max_count - min_count)

      var count = 0
      var in3d = false // Fun but way too slow & ugly...
      var obuf = [in3d ? '<div style="position:relative;"><ul>' : ""]
      for( tag in cloud ){
        count++
        if( typeof( config.limit ) != "undefined"
        && config.limit != 'none'
        && count > config.limit
        ){
          break
        }
        var font_size = Math.round(slope*cloud[tag]-(slope*min_count-config.minsize))
        var title = "->" + all_visits[tag] + " <-> " + raw_cloud[tag]
        // (raw_cloud[tag] == 1 ? raw_cloud[tag] + ' link' : raw_cloud[tag] + ' links');
        var link
        = '<a href="'
        + url_base + tag
        + '" title="' + title
        + '">' + tag + '</a>'
        var output
        = (in3d ? '<li ' : '<span ') 
        + ' style="font-size:' + font_size + '%;">'
        + link
        +(in3d ? ' </li>' : ' </span>');
        obuf.push( output)
      }
      obuf.push( in3d ? "</ul></div>" : "")
      $("#sw_cloud_list").append( obuf.join( ""))

      // 3D effect, way too slow
      if( in3d ){
        var element = $('#sw_cloud_list a');
        $('#sw_cloud_list ul').add( $('#sw_cloud_list li'))
        .css({
          "list-style":"none",
          margin:0,
          padding:0
        })
        var offset = 0; 
        var stepping = 0.03;
        var list = $('#sw_cloud_list');
        var $list = $(list)
        $list.mousemove( function(e){
           var topOfList = $list.eq(0).offset().top
           var listHeight = $list.height()
           stepping = (e.clientY - topOfList) 
           /  listHeight * 0.2 - 0.1;
        });
        for (var i = element.length - 1; i >= 0; i--)
        {
          element[i].elemAngle = i * Math.PI * 2 / element.length;
        }
        setInterval(render, 20);
      }
      function render(){
        for (var i = element.length - 1; i >= 0; i--){
          var angle = element[i].elemAngle + offset;
          x = 120 + Math.sin(angle) * 30;
          y = 45  + Math.cos(angle) * 40;
          size = 1 - Math.sin(angle)
          var elementCenter = $(element[i]).width() / 2;
          var leftValue = ((sw_content_width/2) * x / 100 - elementCenter) + "px"
          $(element[i]).css("position", "absolute")
          $(element[i]).css("fontSize", (size * 100) + "%");
          $(element[i]).css("opacity", size * 0.6);
          $(element[i]).css("zIndex" , 1000 + size * 500);
          $(element[i]).css("left" ,leftValue);
          $(element[i]).css("top", y + "%");
        }
        offset += stepping;
      }
    }
  
    $(document).ready( function(){
      getCloud()
    })
  
  }))

  var all_pages  = this.wiki.getAllPages()
  var all_tags   = []
  var config     = {}
  config.minsize = 50
  config.maxsize = 200
  config.math = 'log'
  var tags_only = "Tags".ends( cmd)
  all_pages.forEach( function( page ){
    if( page.wasInherited() )return
    if( tags_only && !page.isTag() )return
    var links     = page.getLinks()
    var backlinks = page.getBacklinks( this.isCurator) // with_private
    // Remove some noise
    if( (links.length + backlinks.length) < 2 )return
    if( backlinks.length < 2 )return
    all_tags = all_tags.concat( [page.name], links, backlinks)
  })

  if( "Frequencies".ends( cmd) ){
    config.order = "frequency"
  }else if( "Pages".ends( cmd) ){
    config.order = "alphabetical"
  }else if( "Visits".ends( cmd) ){
    config.order = "popularity"
  }

  config.url = Wiki.htmlizeAttr(
    this.permalinkTo( this.wiki.homePage).replace( "HomePage", "")
  )
  buf.push( '<div id="sw_cloud_list"></div>')
  // Add visit count to all tags
  var new_list = []
  var a_page
  for( var ii in all_tags ){
    a_page = this.lookup( all_tags[ii])
    new_list.push( a_page.name, a_page.countVisits)
  }
  buf.push( this.script( "sw_tag_cloud", config, new_list))
  cb( buf.join( "\n"))
}

// Same code, different name => different behavior
Session.doPageCommands.CloudTags
= Session.doPageCommands.Cloud
Session.doPageCommands.CloudFrequencies
= Session.doPageCommands.Cloud
Session.doPageCommands.CloudPages
= Session.doPageCommands.Cloud
Session.doPageCommands.CloudVisits
= Session.doPageCommands.Cloud

Session.doPageCuratorCommands = {}
Session.doPageCuratorCommands.Curatoring = function( cmd, cb ){
  this.isCurator = this.canCurator
  this.notify( "You are now in 'curator' mode")
  cb( this.i18n( "DoNoCurator") )
}
Session.doPageCuratorCommands.Curator = function( cmd, cb ){
  this.isCurator = this.canCurator
  this.notify( "You are now in 'curator' mode")
  cb( this.i18n( "DoNoCurator") )
}
Session.doPageCuratorCommands.NoCuratoring = function( cmd, cb ){
  this.isCurator = false
  this.notify( "You are now in 'normal' mode")
  cb( this.i18n( "DoCuratoring") )
}
Session.doPageCuratorCommands.NoCurator = function( cmd, cb ){
  this.isCurator = false
  this.notify( "You are now in 'normal' mode")
  cb( this.i18n( "DoCurator") )
}

Session.doPageAdminCommands = {}

Session.doPage = function( cmd, cb ){
// Handles special "builtin" pages, including shell scripts.
// aka "Do commands"
// ToDo: Use "switch" ! ;-) 

  var that = this
  var wiki = this.wiki
  var sync = !cb
  if( sync ){
    cb = function( err, data ){ return data }
  }
  
  // Hash based dispatch
  var cmdcmd = Session.doPageCommands[cmd]
  if( cmdcmd ){
    return cmdcmd.call( that, cmd, cb)
  }

  if( cmd == "History" ){
    return cb( this.wikiHistory.join( "\n"))
  }

  if( cmd == "Drafts" ){
    // Display list of draft pages.
    // Guest don't see draft users, disturbing
    var buf        = []
    var bufusers   = []
    that.wiki.forEachDraft(
      function( page ){
        (page.isUser() ? bufusers : buf)
        .push( 
          page.name
          + " - "
          + that.tooltip( page, true).replace( that.i18n( "a draft") +", ", "")
        )
      },
      true // ToDo: with draft users?
    )
    // Set a flag so that "drafts" stays on top menu for a while
    // Why: because when one visit drafts it is unpleasant to have to get back
    // to the home page in order to have access to the "drafts" option.
    that.visitingDrafts = 7
    return cb(
      buf.join( "\n")
      + (!that.isGuest() && bufusers.length
        ? "\n\nUsers:\n" + bufusers.join( "\n")
        : ""
      )
      + "\n" + "RecentStamps"
    )
  }
  
  if( cmd == "ClearAllDrafts" && that.canCurator ){
    that.wiki.forEachDraft( function( page ){ page.trash() })
    that.notify( that.i18n( "Done, all draft pages were cleared"))
    return cb( that.i18n( "\nDoDrafts"))
  }

  if( cmd == "Visits" ){
    // Display visits, with some classification
    var buf0 = []
    var buf1 = []
    var buf11 = []  
    var buf2 = []
    var buf3 = []
    var buf4 = []
    var buf5 = []
    var msg
    var n = 0
    var name
    var names = {}
    wiki.forEachSession( function( session ){
      name = session.userName()
      names[name] = true
      // Skip bots
      if( session.isBot )return
      if( true || that.isCurator || !session.isCurator ){
        (session.isRecent()
        ? buf0
        : (session.isGuest()
          ? (session.isAway() ? buf4 : buf3)
          : (session.isGone ? buf2 : (session.isAway() ? buf11 : buf1))
        ))
        .push( "- " + session.userName() + " - "
          + session.wikiHistory.join( " ")
          + " " + session.dateLastAccess.toISOString()
        )
      }
      // At most 200 visits
      if( n++ > 200 )return false
    })
    // ToDo: A nice map?
    // see https://github.com/stagas/maptail
    // Add recent identified guests
    for( var ii in wiki.recentGuestVisitors ){
      name = wiki.recentGuestVisitors[ii]
      if( names[name] )continue
      buf5.push( name)
    }
    // ToDo: i18n
    return cb( [
      buf0.length  ? "Now:\n" + buf0.sort().join( "\n") : "",
      buf1.length  ? "\n\nRecent:\n" + buf1.sort().join( "\n") : "",
      buf11.length ? "\n\nAway members:\n" + buf11.sort().join( "\n") : "",
      buf2.length  ? "\n\nGone members:\n" + buf2.sort().join( "\n") : "",
      buf3.length  ? "\n\nRecent guests:\n" + buf3.sort().join( "\n") : "",
      buf4.length  ? "\n\nGuests:\n" + buf4.sort().join( "\n") : "",
      buf5.length  ? "\n\nOlder guests:\n" + buf5.join( "\n") : ""
    ].join( ""))
  }
  
  if( cmd == "Members" ){
    var buf1 = []
    var buf2 = []
    wiki.forEachMember( function( session, code ){
      (session.isAway() ? buf2 : buf1)
      .push( session.userName() + (session.canCurator ? "!" : "") 
        + " - " + session.dateLastAccess.toISOString()
        + (that.canCurator ? " - Code" + code : "")
       )
    })
    return cb( [
      "Recent:\n  ",
      buf1.sort().join( "\n  "),
      "\n\nOther:\n  ",
      buf2.sort().join( "\n  ")
    ].join( ""))
  }
  
  if( cmd == "Clones" ){
    var buf = []
    var bu2
    wiki.forEachClone( function( clone ){
      buf2 = [
        '"' + clone.name + '"',
        "  " + wiki.getRoot().name + ":" + clone.fullname() + "HomePage"
      ]
      if( !that.loginPage.isHome() ){
        buf2.push(
          "  " + wiki.getRoot().name + ":" + clone.fullname() + that.loginPage.name
        )
      }
      buf.push( buf2.join( "\n"))
    })
    return cb(
      buf.sort().join( "\n")
      + (that.canCurator ? "\n\nPrivateCodes" : "")
    )
  }

  // Search
  if( "Search".starts( cmd ) ){
    var pattern = cmd.substr( "Search".length)
    if( !pattern ){
      pattern = that.doPage.name
    }
    var user_pattern = pattern
    if( /\[.*\]/.test( pattern) ){
      pattern = pattern.substr( 1, pattern.length - "[]".length)
      user_pattern = pattern
      if( pattern != that.wikinamize( pattern) ){
        pattern = pattern.replace( /[^A-Z_0-9#@-]/gi, "_")
      }
    }
    // Sanitize pattern, only * & ? are ok
    var unsane = new RegExp( "[({[^$+\\\]})]", "g")
    var pattern = pattern
    .replace( unsane, "\\$1")
    .replace( /\?/g, ".")
    .replace( /\*/g, ".+")
    .replace( /\_/g, ".\\s*")
    that.de&&bug( "Search, pattern:", pattern)
    // .\s.+j.\s.+h.\s.+r.\s.+
    pattern = new RegExp( ".*" + pattern + ".*", "i")
    // Now I should look for pattern in all accessible content
    // But I will only look at content that is already in memory
    // because otherwise... that would consume too much CPU
    // ToDo: things would be different if I had a special tool for plain text
    // search, ie some database
    var found = []
    // First, let's look in page names
    var all_pages = that.getAllWikiPageNames()
    var a_page
    var nfound = 0
    for( var ii in all_pages ){
      a_page = all_pages[ii]
      if( pattern.test( a_page) ){
        found.push( a_page)
        if( a_page.includes( "DoSearch") ){
          nfound++
        }
      }
    }
    // If not found in names, look in content
    if( !nfound ){
      for( ii in all_pages ){
        if( nfound >= 200 )break
        a_page = that.lookup( all_pages[ii])
        if( pattern.test( a_page.getBody())
        || (a_page.isDraft() && pattern.test( a_page.getNondraftBody()))
        ){
          nfound++
          found.push( a_page.name)
        }
      }
    }
    // Now display the results
    var buf = []
    buf.push( "" + nfound + " " + user_pattern + "\n")
    buf = buf.concat( found.sort())
    return cb( buf.join( "\n"))
  }

  // Angular applications
  // See http://www.angularjs.org/Main_Page
  if( "Angular".starts( cmd) ){
    var app = cmd.substr( "Angular".length)
    app = that.lookup( cmd)
    var content = app.isDraft() ? app.getNondraftBody() : app.getBody()
    // Remove the Yaml section
    content = that.wiki.injectBasicYaml( content)
    // Get rid of \n, they don't play well in the container, they do like <br>
    // ToDo: that's not a good idea. I need to change the style
    return cb( 'HTML<div class="angular">' + content + '</div>')//.replace( /\n/g, ""))
  }

  // HTML pages
  if( "Html".starts( cmd) ){
    var app = cmd.substr( "Html".length)
    app = that.lookup( cmd)
    var content = app.isDraft() ? app.getNondraftBody() : app.getBody()
    // Remove the Yaml section
    content = that.wiki.injectBasicYaml( content)
    return cb( "HTML" + content.replace( /\n/g, ""))
  }

  // Set display mode, ie number of rows and cols
  var mode  = null
  var cfg = this.config
  if( "Display".starts( cmd) ){
    this.de&&bug( "Set display mode ", cmd)
    mode = cmd.substr( "Display".length)
  }
  if( mode == "Rfc" ){
    cfg.cols = 72
    cfg.rows = 58
  }
  if( mode == "Narrower" ){ cfg.cols = Math.floor( cfg.cols * 2/3)
  }
  if( mode == "Narrow" ){   cfg.cols = 40
  }
  if( mode == "Medium" ){   cfg.cols = 50
                            cfg.rows = 30
  }
  if( mode == "Tv" ){       cfg.cols = 40
                            cfg.rows = 20
  }
  if( mode == "HdTv" ){     cfg.cols = 50
                            cfg.rows = 40
  }
  if( mode == "Phone" ){    cfg.cols = 30
                            cfg.rows = 10
  }
  if( mode == "Wide" ){     cfg.cols = 60
  }
  if( mode == "Wider" ){    cfg.cols = Math.floor( cfg.cols * 4/3)
  }
  if( mode == "Tall" ){     cfg.rows = 60
  }
  if( mode == "Short" ){    cfg.rows = 20
  }
  if( mode == "Taller" ){   cfg.rows = Math.floor( cfg.rows * 4/3)
  }
  if( mode == "Shorter" ){  cfg.rows = Math.floor( cfg.rows * 2/3)
  }
  if( mode == "Bigger"){    cfg.cols = Math.floor( cfg.cols * 4/3)
                            cfg.rows = Math.floor( cfg.rows * 4/3)
  }
  if( mode == "Smaller"){   cfg.cols = Math.floor( cfg.cols * 2/3)
                            cfg.rows = Math.floor( cfg.rows * 2/3)
  }
  if( mode == "Thiner"){    cfg.cols = Math.floor( cfg.cols * 2/3)
                            cfg.rows = Math.floor( cfg.rows * 4/3)
  }
  if( mode == "Stronger"){  cfg.cols = Math.floor( cfg.cols * 4/3)
                            cfg.rows = Math.floor( cfg.rows * 2/3)
  }
  if( mode == "Fluid" ){    cfg.rows = 0
  }
  if( "Custom".starts( mode) ){
    var param = this.doDecodeParameters( mode.substr( "Custom".length))
    cfg.rows = parseInt( param.p0)
    cfg.cols = parseInt( param.p1)
  }
  if( mode == "DisplayCurrent" ){}
  if( mode ){
    if( cfg.cols < 10 ){        cfg.cols = 10
    }else if( cfg.cols > 200 ){ cfg.cols = 200
    }
    if( cfg.rows > 0 && cfg.rows < 5 ){
                                cfg.rows = 5
    }else if( cfg.rows > 200 ){ cfg.rows = 200
    }
    var msg = cfg.rows
    if( cfg.rows == 0  ){
      msg = "Fluid"
    }
    this.adjustColumns()
    return sync ? "" : cb(
      "Display mode is "
      + cmd.substr( "Display".length)
      + "\n  number of columns: " + that.config.cols
      + "\n  number of rows: " + that.config.rows
      + "\n\nSee also DisplayModes"
    )
  }
  
  // The other pages are non guest only
  if( this.isGuest() ){
    this.de&&bug( "Do, not for guest")
    return cb( this.i18n( "err:locked"))
  }

  if( cmd == "ClearHistory" ){
    this.wikiHistory = []
    return sync ? "" : cb( "History was cleared. HomePage")
  }
  
  if( cmd == "ExportHtmlPage" ){
    var resultpage = that.wiki.lookupPage(
      that.isCurator 
      ? "HtmlPage"
      : that.wikinamize( "Html" + that.userName()
    ))
    this.doOnPage.read( function( err, page ){
      that.putPage(
        resultpage,
        that.wikify( page.getBody(), page, "permalinks"),
        function(){ cb( resultpage.name) }
      )
    })
    return resultpage.name
  }
  
  if( cmd == "ExportHtmlPages" ){
    var buf = []
    var root = this.canCurator ? this.doOnPage : this.lookup( this.userName())
    this.wiki.forEachPage( root, this, function( page ){
      if( page ){
        if( that.mayEdit( page)
        && (that.isCurator
          || ( !page.isUser()
            && !page.isSecret()
            && !page.isMap())
          )
        ){
          page.read( function( err, page ){
            buf.push( [
              '\n<div>\n<a name="' + page + '">' + page + '</a>\n<pre><tt>',
               that.wikify( page.getBody(), page, true),
               '</tt></pre>\n</div>\n'
            ].join( ""))
          })
        }
      }else{
        // ToDo: change into user pages
        that.putPage(
          that.lookup(
            that.isCurator 
            ? "HtmlPages"
            : that.wikinamize( "Html" + that.userName())
          ),
          '<div>\n<a href="#' + root + '">Home<a>\n</div><hr>\n'
          + buf.sort().join( "<hr>\n"),
          function(){
            cb( 
              that.isCurator
              ? "HtmlPages"
              : that.wikinamize( "Html" + that.userName())
            )
          }
        )
      }
    })
    return "HtmlPages"
  }
  
  // The other pages are for curators only
  if( !this.canCurator ){
    this.de&&bug( "Do for curators only")
    return cb( this.i18n( "err:locked"))
  }

  // Hash based dispatch
  cmdcmd = Session.doPageCuratorCommands[cmd]
  if( cmdcmd ){
    return cmdcmd.call( this, cmd, cb)
  }
  
  // Display this wiki's config, format compatible with "AboutWiki"
  if( cmd == "Config" ){
    var buf = []
    buf.push( "---")
    var config = this.config
    var option
    var val
    for( option in config ){
      val = config[option]
      buf.push( "  " + option + ": " + Sys.inspect( val))
    }
    return cb( buf.join( "\n"))
  }

  if( cmd == "ListPrefetch" ){
    return cb( this.wiki.aboutwikiPage.get( "fetch") || "nothing")
  }
    
  // The other pages are for curators only
  if( !this.canCurator ){
    this.de&&bug( "Do for curators only")
    return cb( this.i18n( "err:locked"))
  }
  
  // page AboutWiki management
  var regex = /^(.*)Wiki$/
  var match
  if( match = cmd.match( regex) ){
    cmd = match[1]
    if( ["", "Open", "Curator", "Closed"].indexOf( cmd) >= 0 ){
      if( (cmd == "Curator" || cmd == "Closed")
      && !that.canCurator
      ){
        return cb( "Curator")
      }
      that.lookup( "AboutWiki").read( function( err, page ){
        if( err ){
          // ToDo: better err handling
          return 
        }
        that.putPage(
          page,
          "Private" + cmd + "Wiki\n" + page.getBody().butFrontLine(),
          function( err, page ){
          if( err ){
            // ToDo: better err handling
          }
        })
      })
      return cb( "AboutWiki")
    }else{
      return cb( that.i18n( "Unknown config: ") + match[1])
    }
  }
  
  if( cmd == "HttpVisits" ){
    var buf = []
    var msg = []
    wiki.forEachSession( function( session ){
      msg = []
      msg.push(
        "id: "       + session.sessionId,
        "name: "     + session.loginName,
        "date: "     + session.dateLogin.toISOString(),
        "last: "     + session.dateLastAccess.toISOString(),
        "duration: "
        + Math.floor( (session.timeLastAccess - session.timeLogin) / 1000),
        "page: "     + session.getCurrentPage(),
        "host: "     + session.httpLogin.headers.host,
        "url: "      + session.httpLogin.url,
        "referer: "  + session.httpLogin.headers.referer,
        // ToDo: handle reverse proxy, in that case remoteAddress is local
        "remote: "   + session.httpLogin.connection.remoteAddress,
        ""
      )
      buf.push( msg.join( "\n"))
    })
    return cb( buf.join( "\n"))
  }

  if( cmd == "Pages" ){
    var all = []
    this.wiki.forEachPage( null, null, function( page ){
      if( page ){
        all.push( page.name)
      }else{
        return cb( all.sort().join( "\n"))
      }
    })
    return
  }
  
  // The other pages are debug & management
  if( !this.isAdmin && !this.isDebug ){
    this.de&&bug( "Do, debug only")
    return cb( this.i18n( "err:locked"))
  }
  
  // Bultins
  if( cmd == "Shutdown" ){
    process.exit( 1)
    return ""
  }
  if( cmd == "DumpConfig" ){
    return cb( Sys.inspect( this.wiki.config))
  }
  if( cmd == "DumpProcess" ){
    var data = {
      file: __filename,
      dir: __dirname,
      cwd: process.cwd(),
      argv: process.argv,
      pid: process.pid,
      uid: process.getuid(),
      gid: process.getgid(),
      umask: process.umask(),
      platform: process.platform,
      memoryUsage: process.memoryUsage()
    };
    return cb( Sys.inspect( data));
  }
  if( cmd == "DumpSession" ){
    return cb( Sys.inspect( this));
  }
  if( cmd == "DumpSessions" ){
    return cb( Sys.inspect( wiki.allSessions));
  }
  if( cmd == "DumpPages" ){
    return cb( Sys.inspect( wiki.allPages));
  }
  if( cmd == "DumpErrors" ){
    var buf = ["Errors:"]
    var err
    while( err = this.wiki.pullError() ){
      buf.push( err.msg)
    }
    buf = buf.join( "\n")
    return cb( buf)
  }
  if( cmd == "DumpCounters" ){
    var c0 = this.lastSampleCounters || this.wiki.lastSampleCounters
    var c1 = this.wiki.sampleCounters()
    this.lastSampleCounters = c1
    var dc = c0 ? this.wiki.diffCounters( c0, c1) : c1
    return cb( Sys.inspect( dc))
  }

  if( cmd == "DumpAlarms" ){
    var buf = ["Alarms:"]
    var item
    var list = this.wiki.getAllSignaledWikis()
    for( item in list ){
      item = item[item]
      buf.push( item.name + ": " + item.errorQueueLength())
      item.clearChildError()
    }
    buf = buf.join( "\n")
    return cb( buf)
  }

  else // DoDebugInspector
  if( cmd == "DebugInspector" ){
    return cb( "HTML" + that.inspector( that))
  }

  else // DoTraceXxxxx
  if( "Trace".starts( cmd) ){
    cmd = cmd.substr( "Trace".length)
    if( cmd == "On" ){
      De = true;
      return cb( "Debug is On. DoDebugOff");
    }
    if( cmd == "Off" ){
      De = false;
      return cb( "Debug is Off. DoDebugOn");
    }
    if( cmd == "Domains" ){
      var buf = ["Domains:"]
      var list_on  = []
      var list_off = []
      buf.push( "\n  Global is " + (global.de ? "On" : "Off")
        + "  - DoTraceToggle"
      )
      var item
      for( item in TraceDomains ){
        (TraceDomains[item] ? list_on : list_off).push( 
          " " + item.replace( "deep_", "Zdeep_")
          + "   - DoTraceToggle_" + item
        )
      }
      list_on  = list_on.sort().join( "\n")
      list_off = list_off.sort().join( "\n")
      buf.push( "\nOn:")
      buf.push( list_on)
      buf.push( "\nOff:")
      buf.push( list_off)
      buf  = buf.join( "\n").replace( /Zdeep_/g, "+ ")
      return cb( buf)
    }
    var on = "none"
    if( "On".starts( cmd) ){
      on  = true
      cmd = cmd.substr( "On".length)
    }
    if( "Off".starts( cmd) ){
      on  = false
      cmd = cmd.substr( "Off".length)
    }
    if( "Toggle_".starts( cmd) ){
      on  = "toggle"
      cmd = cmd.substr( "Toggle_".length)
    }
    else if( "Toggle".starts( cmd) ){
      on  = "toggle"
      cmd = ""
    }
    var domain = cmd
    this.deep_misc_de&&bug( "DEBUG, on:", on, "domain:", domain)
    if( domain ){
      if( on === true ){
        global.traceDomain( domain)
      }else if( on === false ){
        global.ntraceDomain( domain)
      }else if( on == "toggle" ){
        global.toggleDomain( domain)
      }
    }else{
      if( on === true ){
        global.debug_mode( true );
      }else if( on === false ){
        global.debug_mode( false );
      }else if( on == "toggle" ){
        global.toggleDebug()
      }
    }
    return this.doPage( "TraceDomains", cb)
  }
  // Shell scripts
  var shellcmd = (SW.wd || "." ) + "/" + (SW.dir || ".") + "/PrivateShell " + cmd;
  shellcmd = shellcmd.replace( "ShellShell", "Shell");
  if( cmd == "DebugTail" ){
    // ToDo: Linux's tail does not support -r to reverse
    shellcmd = "tail -n1000 log/debug.txt";
  }
  if( cmd == "DumpEnv" ){
    shellcmd = "env";
  }
  De&&bug( "Exec: " + shellcmd);
  ChildProcess.exec( shellcmd, function( err, out, serr)
  {
    var msg = err
    ? "Error " + Sys.inspect( err) + "\n\n" + serr
    : out;
    return cb( msg);
  })
  return "Do" + cmd
}

Session.inspectorForm = function( req, target, seen ){
  var msg = this.inspector( target, false, seen)
  // Switch momentary to fluid layout to avoid width limitation & wrapping
  var fluid = this.config.rows
  this.config.rows = 0
  // Build as if login page but with custom html content
  var page = this.loginPage
  msg = this.htmlLayout( page, this.toolForm( page), msg)
  + this.footerForm(   page, true) // True => includes tools
  this.config.rows = fluid
  this.respond( req, this.html(
    page,
    "Inspector",
    msg
  ))
}

Session.inspector = function( target, short_form, seen ){
// This is a basic object browser
try{

  // I manage an identity hash to avoid recursive loops
  seen || (seen = [])
  var track = function( obj ){
    var ii
    // Very ineffecient, but it works
    // Note: I cannot use seen[obj] directly because JavaScript {}
    // looks like a true hashtable but actually relies on toString()
    // to hash the keys...
    // Note: I could cache some results, those for keys that don't
    // collide. I would need a cache hash in addition to the seen table
    for( ii in seen ){
      if( seen[ii].obj === obj )return ii
    }
    // I remember the seen object and I later attach the closure to view it
    seen.push( {obj: obj, closure: null})
    // The unique id is basically the index position where object was inserted
    return seen.length - 1
  }
  track( target)
  
  var esc = function( str ){
    return Wiki.htmlize( str
    .replace( /\"/g, '\\"')
    .replace( /\n/g, '\\n'))
  }
  
  var frag = function( str, n ){
    str = str.toString()
    n || (n = 30)
    if( str.length <= n )return '"' + esc( str) + '"'
    return '"' + esc( str.substr( 0, n)) + "..."
  }
  
  var that = this
  var link = function( key ){
    var closure
    var id = track( key)
    closure = seen[id].closure
    if( !closure && that.registerClosure ){
      closure = that.registerClosure( function( it ){
        it.inspectorForm( this, key, seen)
      })
    }else{
      closure = "fake"
    }
    seen[id].closure = closure
    return that.button ? that.button( "+" + track( key), closure) : ""
  }
  
  // Javascript's typeof is deeply broken, fix that
  var type = function( obj ){
    var t = typeof obj
    if( t === "object") {
      if( obj === null) return "null"
      if( obj.classLabel )return obj.classLabel
      if( obj.constructor === (new Array).constructor    )return "Array"
      if( obj.constructor === (new Date).constructor     )return "Date"
      if( obj.constructor === (new RegExp).constructor   )return "RegExp"
      if( obj.constructor === (new String).constructor   )return "String"
      if( obj.constructor === (new Function).constructor )return "Function"
      try{ return /(\w+)\(/.exec( obj.constructor.toString())[1] // ) scite issue
      }catch( err ){ return "object" }
    }
    return t
  }
  
  var buf = []
  var its_type = type( target)
  if( its_type === "string" ){
    return frag( target)
  }
  if( its_type === "number" ){
    // Auto detect "time" type of value
    var delta = target - Sw.timeNow
    if( delta > (-2 * 365 * 24 * 3600 * 1000)	// 2 years ago
    &&  delta < (2 * 3600 * 1000)		// within 2 hours
    ){
      return target.toString() + " - " + this.timeLabel( target)
    }
    return target.toString()
  }
  if( its_type === "undefined" ){
    return "undefined"
  }
  if( its_type === "boolean" ){
    return target ? "true" : "false"
  }
  if( its_type === "function" && short_form ){
    return link( target) + "()" + frag( target)
  }
  if( its_type === "null" ){
    return 'null'
  }
  if( its_type === "Date"){
    return "" + target + " - " + this.timeLabel( target.getTime())
  }
  if( target === null ){
    return "Null"
  }
  if( target === true ){
    return "True"
  }
  if( target === false ){
    return "False"
  }
  if( short_form ){
    var has_attr = false
    var item
    for( item in target ){
      has_attr = true
      break
    }
    if( has_attr ){
      item = frag( target.toString())
      its_type = "&lt;" + its_type + "&gt;"
    }else{
      item = Array.isArray( target) ? "[]" : "{}"
      if( (Array.isArray( target) && its_type == "Array")
      || its_type == "Object"
      ){
        its_type = ""
      }
    }
    return link( target) + its_type + item
  }
  
  buf.push( "type: " + its_type)
  buf.push( "oid: "  + track( target))
  buf.push( "toString() => "  + frag( target.toString()))
  buf.push( "constructor: " + this.inspector( target.constructor, true, seen))
  buf.push( "prototype: "   + this.inspector( target.prototype, true, seen))
  buf = [buf.join( "<br>")]
  try{
    var key
    var val
    var fns = []
    var attrs = []
    var proto_attrs = []
    var is_array = Array.isArray( target) // Mozilla feature implemented in V8
    if( is_array ){
      buf.push( "length => " + frag( target.length))
    }
    for( key in target ){
      // Filter out debugging stuff, ie xxx_de stuff
      if( /^\w*_de$/.test( key) )continue
      var key_label = this.inspector( key, true, seen)
      val = target[key]
      var val_label = this.inspector( val, true, seen)
      if( !is_array
      && !isNaN( parseInt( key, 10)) // if key is a stringified number
      && (type( val) == "Function" || type( val) == "function")
      ){
        fns.push( {label: key_label, def: val_label})
      }else{
        if( is_array || target.hasOwnProperty( key) ){
          attrs.push( "<li>" + key_label + " = " + val_label + "</li>")
        }else{
          proto_attrs.push( "<li>" + key_label + " = " + val_label + "</li>")
        }
      }
    }
    // Iterate over idempotent predicates (see MakeDebuggable)
    if( target.allIdempotentPredicates ){
      var pred
      var val
      buf.push( "<hr>predicates:<br><ul>")
      for( pred in target.allIdempotentPredicates ){
        pred = target.allIdempotentPredicates[pred]
        val = target[pred]()
        // Some filtering, display only "true" predicates
        if( val ){
          buf.push( "<li>" + pred + ": " + val + "</li>")
        }
      }
      buf.push( "</ul>")
    }
    // Iterate over idempotent getters
    if( target.allIdempotentGetters ){
      var getter
      var val
      buf.push( "<hr>getters:<br><ul>")
      for( pred in target.allIdempotentGetters ){
        getter = target.allIdempotentGetters[pred]
        val = target[getter]()
        // Some filtering, display only "true" and non empty values
        if( val
        &&  val != {}
        &&  val != []
        ){
          buf.push( "<li>" + getter + ": " 
            + this.inspector( val, true, seen) + "</li>"
          )
        }
      }
      buf.push( "</ul>")
    }
    buf.push( "<hr>attributes:<br>")
    if( !is_array ){
      attrs = attrs.sort()
    }
    buf.push( is_array ? "<ul>" : "<ol>")
    buf.push( attrs.join( "\n"))
    buf.push( is_array ? "</ul>" : "</ol>")
    if( proto_attrs.length ){
      buf.push( "<hr>prototype:<br><ol>")
      proto_attrs = proto_attrs.sort()
      buf.push( proto_attrs.join( "\n"))
      buf.push( "</ol>")
    }
    if( fns.length ){
      buf.push( "<hr>methods:<br>")
      fns = fns.sort() // ToDo: fix
      buf.push( "<ul>")
      for( key in fns ){
        key = fns[key]
        buf.push( "<li>" + key.label + ": " + key.def + "</li>")
      }
      buf.push( "</ul>")
    }
  }catch( err ){ buf.push( "Error:" + err)}
  return link( target) + "<p>" + buf.join( "\n")
  //+ "<p>" + Wiki.htmlize( 
  //  Sys.inspect( target, true, 0)
  //)
}catch( err ){
  return err.toString()
}
}


exports.Session = Session;
// section: end sessioncmd.js
