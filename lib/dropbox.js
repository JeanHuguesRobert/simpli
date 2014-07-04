// -------------------
// section: dropbox.js
//
// npm dropbox

var Session = require( "./session" ).Session;
var SessionProto = Session.prototype;

// Try to install support for Dropbox
var Dropbox = null;
try{
  Dropbox = require( "dropbox")
  trace( "dropbox module loaded")
  if( !SW.dbkey ){
    trace( "No Dropbox key (SW.dbkey)")
    Dropbox = null
  }
  if( !SW.dbsecret ){
    trace( "No Dropbox secret (SW.dbsecret)")
    Dropbox = null
  }
  // ToDo: fix dropbox support
  trace( "Disable Dropbox support, broken " );
  Dropbox = null;
}catch( err ){
  trace( "No Dropbox support, needs npm dropbox")
  trace( "err: " + Sys.inspect( err))
  //trace( "Current 'require.paths' is " + require.paths)
  Dropbox = null
}


Session.dropboxConnect = function( email, password, cb ){
// Tries to get a token from Dropbox and then invoke cb( err, dropbox_object)
// If email or password are not provided, I reuse whatever was last provided
  var that = this
  if( !that.dropbox ){ that.dropbox = {} }
  // Try to reuse existing of user if valid
  if( that.user && that.user.dropbox && that.user.dropbox.token ){
    that.dropbox = that.user.dropbox
  }
  email || (email = this.dropbox.email)
  // Reuse previous client if any, unless user REALLY want a new one
  if( that.dropbox.client ){
    if( "REALLY".starts( email) ){
     // ToDo: UI. What a hack, REALLY!!!
    }else{
      if( that.user && !that.user.dropbox ){
        that.user.dropbox = that.dropbox
      }
      return cb.call( that, 0, that.dropbox.client)
    }
  }
  // See https://www.dropbox.com/developers/docs
  // https://www.dropbox.com/home#:::
  var dropbox = new Dropbox.DropboxClient( SW.dbkey, SW.dbsecret)
  // Reuse previous token if any, unless user REALLY want a new one
  var token = that.dropbox.token
  if( token ){
    if( "REALLY".starts( email) ){
      // ToDo: do I love hacking?
    }else{
      // Token has 2 parts, one is a local secret, the other one is public
      // ToDo: decrypt token? I don't think it can be used without knowledge of
      // SW.dbkey and SW.dbsecret, ie it is already encrypted
      var ii = token.indexOf( "_")
      var public_key = token.substr( 0, ii)
      var secret_key = token.substr( ii + 1)
      // So much for data hiding, I patch the DropboxClient... HACK HACK HACK
      dropbox.access_token        = public_key
      dropbox.access_token_secret = secret_key
      that.dropbox.client = dropbox
      that.dropbox.time   = SW.timeNow
      if( that.user ){
        that.user.dropbox = that.dropbox
      }
      that.dropbox_de&&bug( "Reuse, secretKey:", secret_key, "publicKey:", public_key)
      return cb.call( that, 0, dropbox)
    }
  }
  that.dropbox_de&&bug( "Attempt, key:", SW.dbkey, "email:", email)
  dropbox.getAccessToken( email, password, function db_gettok( err, t, s ){
    if( err ){
      that.dropbox_de&&bug( "Fail, key:", SW.dbkey, "email:", email, "err:", err)
      that.dropbox.client = null
      that.dropbox.token  = ""
      that.dropbox.time   = 0
      return cb.call( that, err, null)
    }
    that.dropbox.email = email
    that.dropbox.client = dropbox
    // ToDo: encrypt this token?
    that.dropbox.token  = t + "_" + s
    that.dropbox.time   = Sw.timeNow
    // Remember last connected dropbox at user level if possible
    if( that.user ){
      that.user.dropbox = that.dropbox
    }
    that.dropbox_de&&bug( "Success, key:", SW.dbkey, "email:", email,
      "secret:", s, "token:", t)
    return cb.call( that, 0, dropbox) // ToDo: that.dropbox instead of dropbox
  })
}


Session.dropboxInfo = function( email, password, cb ){
// Get account info
// optional email && password
  var that = this
  // Connect or reuse previous token
  this.dropboxConnect( email, password, function dropboxconn( err, dropbox ){
    if( err ){ return cb.call( that, err, null) }
    dropbox.getAccountInfo( function( err, data ){
      if( !err ){
        // Hum... let's collect the mail, this may help reconnect the user if
        // she lose her wiki's web address, invitation code, etc, etc 
        var newmail = Wiki.sanitizeMail( data.email)
        if( !newmail ){
          that.dropbox_de&&bug( "Weird email:", data.email)
          that.trackServiceUser( "Dropbox", that.dropbox.token)
        }else{
          that.trackServiceUser( "Mail", newmail, function( err ){
            if( err ){
              // ToDo: err handling
              return 
            }
            that.trackServiceUser( "Dropbox", that.dropbox.token)
          })
        }
      }
      cb.call( that, err, data)
    })
  })
}


// Patch dropbox-node -- Kudos to him! :)
// From https://github.com/evnm/dropbox-node/blob/master/lib/dropbox-node/index.js
// Uploads contents of a file specified by path argument, relative to
// application's directory.
// PATCH: can specify a name for the file in Dropbox (versus reusing "file")
// PATCH2: can specify data to avoid .readFile()
if( Dropbox ){
Dropbox.DropboxClient.prototype.putWikiFile
= function( file, path, optargs, cb ){ // PATCH, added a "name" option
    // PATCH, inline some vars
    var CONTENT_API_URI = 'https://api-content.dropbox.com/0'
    // END PATCH
  if (typeof optargs == 'function') cb = optargs, optargs = {};
  var boundary = 'sAxIqse3tPlHqUIUI9ofVlHvtdt3tpaG',
      content_type = 'multipart/form-data; boundary=' + boundary,
      self = this;
  function put(err, data) { // PATCH, name it
    if (err) return cb(err);
    // Build request body.
    // path = escapePath(path); // PATCH, I inline escapePath()
    NDe&&bug( "dropbox optargs is:", Sys.inspect( optargs))
    NDe&&bug( "dropbox optargs.name is:", optargs.name)
    NDe&&bug( "dropbox (optargs.name || file) is:",  (optargs.name || file))
    De&&bug( "file is:", file)
    file = encodeURIComponent( optargs.name || file)

    path = encodeURIComponent(path).replace(/%2F/g, '/');
    var body = '--' + boundary + '\r\n' +
               'Content-Disposition: form-data; name=file; filename=' + file +
               '\r\n' + 'Content-type: application/octet-stream\r\n' +
               '\r\n' + data + '\r\n' + '--' + boundary + '--';
    self.oauth.post(CONTENT_API_URI + '/files/dropbox/' + path +
                    '?file=' + file,
                    optargs.token || self.access_token,
                    optargs.secret || self.access_token_secret,
                    body, content_type,
                    function(err, data, res) {
                      if (err) cb(err);
                      else cb(null, JSON.parse(data));
                    });
  }
  if( optargs.data )return put( 0, optargs.data) // PATCH handle "data" option
  require('fs').readFile(file, put);
}
}

Session.dropboxPut = function( page, cb ){
// Put the content of page into user's dropbox
// ToDo: ?optional email && password
// Note: no acl, I assume it was checked before
// File naming scheme:
//   DDD/WWW/PPP.sii
// where DDD is SW.name, ie "SimpliWiki"
// where WWW is the full name of the wiki, with / in it maybe
// where PPP is the page name, with some encoding:
//   "normal" are left unchanged
//   pages with [ in them are percent encoded (see that term)
// Special case: if page is "Public" I put a copy in the dropbox's public area.
// However that copy is a ".txt" with all meta information removed.

  var that = this
  that.dropboxConnect( null, null, function dropbox_conn( err, dropbox ){
    if( err ){
      that.dropbox_de&&bug( "could not get token, err:", err)
      return cb.call( that, err, page)
    }
    // Hack, I rebuilt the page's fullname in the File base PageStore.
    // I do so because dropbox-node needs a filename
    // ToDo: well... I patched .putFile(), now it does not need a file anymore
    var url = page.getStoreUrl()
    // Assume file: protocol
    // ToDo: extend to other protocols
    if( !"file:".starts( url) ){
      that.dropbox_de&&bug( "Bad protocol, can't export, url:", url)
      return cb.call( that, 3, page)
    }
    var file     = url.substr( "file:".length)      
    var pathname = SW.name + "/" + file
    // Restore "wiki" generic directory
    // ToDo: this is hacky
    if( SW.dir == "wiki" ){
      file = SW.dir + "/" + file
    }
    function put( file, pathname, data ){
    // Put file in Dropbox using my patched .putFile() name .putWikiFile()
      // Split pathname into path + name
      var ii = pathname.lastIndexOf( "/")
      var name = pathname.substr( ii + 1)
      // Apparently Dropbox does not like "weird" names
      // I do some encoding but is it brutal and far from perfect
      // Dropbox is case insensitive, that's problematic for wiki words...
      // so I prefix all uppercase letters with a _
      // I hope that this scheme is reasonnably loseless to some extend while
      // still "readable"
      name = Wiki.toAscii( name)
      .replace( /([A-Z_])/g,      "_$1")
      .replace( /@/g,             "_At_")
      .replace( /#/g,             "_Hash_")
      .replace( /^_+/,            "")  // Don't start with _
      .replace( /_+$/,            "")  // Don't end with _
      .replace( /[^a-z0-9_.-]/gi, "_")
      + ".sii"
      var path = pathname.substr( 0, ii)
      that.dropbox_de&&bug(
      "putFile, page:", page, "file:", file, "path:", path, "name:", name)
      dropbox.putWikiFile(
        file,
        path,
        {name:name, data:data},
        function db_put( err, data ){
          if( err ){
            that.dropbox_de&&bug( "Err, page:", page, "err:", Sys.inspect( err))
          }else{
            that.dropbox_de&&bug( "OK, page:", page)
          }
          cb.call( that, err, page)
        }
      )
    }
    return page.read( function( err, page){
      if( err ){ return cb.call( that, err, page) }
      put( file, pathname, page.getBody())
    })
    // Never reached
    // This is "old" code, before I added a "data" option to .putWikiFile()
    // Special case for "virtual" & "proxy" pages, I need a tmp file first
    if( page.isVirtual() || page.isProxy() ){
      page.read( function( err, page ){
        if( err ){
          that.dropbox_de&&bug( "can't read, page:", page, "err:", err)
          return cb.call( that, err, page)
        }
        var tmp = "/tmp/" + file
        that.dropbox_de&&bug( "tmpFile:", tmp)
        Fs.writeFile(
          tmp,
          page.getBody(),
          function( err ){
            if( err){
              that.dropbox_de&&bug( "can't write, tmpFile:", tmp, "err:", err)
              return cb.call( that, err, page)
            }
            put( tmp, pathname)
          }
        )
      })
    }else{
      put( file, pathname)
    }
  })
}


Session.doPageCommands.ExportToDropbox = function( cmd, cb ){
// This is the "DoExportToDropbox" special Do page of the wiki.
// This will copy some pages of the wiki into a Dropbox directory.
// Three phases: 1st collect pages to export, 2nd do the export, 3rd show rslt
// The parameters for the command comes from the current .doOnPage page's data
// ToDo: would be fun to import from posterous
// See http://apidocs.posterous.com/pages/postly

  // Save the current Session, for use in callbacks
  var that = this

  // Output will be built out of this buffer
  var buf = []

  // This is the "referer" page, user invoked the command from this page
  var on_page = that.doOnPage
  that.de&&mand( on_page)

  // Asynchronous feedback is provided in this page
  var phase2_pagename
  = (that.isCurator ? "ToDoDropboxPages" : ("ToDoDropbox" + that.userName()))
  var phase2_page // Don't look it up now, wait until it's really needed

  // Helpers to push content to be displayed
  function push( msg ){ buf.push( msg) }

  // Helper to provide command's result to the framework, using buf[]
  function done(){ cb( buf.join( "\n")) }

  // Helper to provide "some error" result
  function err(){
    push()
    push( "Please provide both 'email' and 'password'")
    push()
    // I provide a link to the "offending" page
    push( on_page.name)
    // It is a good idea to provide some help, let's hope these pages exist
    push( "Help" + cmd)
    push( "Help" + on_page.name)
    return done()
  }

  // Helper to provide asynchronous result to the user, in a different page
  function async_done(){
  // Push result into some page where the user will find them
    // ToDo: change into user pages
    // ToDo: I REALLY need to implement some kind of "transient" pages
    that.putPage(
      that.lookup( phase2_pagename),
      "DoExportToDropbox\n\n" + buf.join( "\n"),
      Sw.noop
    )
  }

  // Let's check if dropbox support was installed at startup time
  if( !Dropbox ){
    push( "Sorry, no DropBox")
    // At this point user is unhappy, email/password was entered for nothing
    // ToDo: better UX
    return done()
  }

  // Cannot first connect to dropbox account as guest, security issue
  // Why: in the jungle you don't want somebody to change your dropbox id
  if( !that.dropbox && !this.wiki.isRoot() && that.isGuest() ){
    push( "Sorry, please connect to DropBox elsewhere")
    return done()
  }

  // Get email/password from invokation page's data
  var password = that.getSessionData( "password", on_page)
  // OK, let's forget the password ASAP
  that.setSessionData( "password", "empty", on_page)
  var email = that.getSessionData( "email", on_page)

  // that.de&&bug( "email:", email, "password:", password)

  push( "DropBox, dropbox.com")
  push()
  push( "Using: " + on_page.name)

  // Don't run until previous export is done
  if( this.exportToDropboxInProgress ){
    push( "In progress...")
    return done()
  }

  // I no email, try to figure out one
  if( !email || email == "empty" ){
    email = (that.dropbox && that.dropbox.email) || ""
  }
  if( !password || password == "empty" || password == "OK" ){
    password = (that.dropbox && that.dropbox.token) || ""
  }

  // that.de&&bug( "2, email:", email, "password:", password)

  // If no email, try to get one from user's profile
  if( !email && this.user ){
    email = this.user.getMailId()
    that.de&&bug( "user email:", email)
  }

  // that.de&&bug( "3, email:", email, "password:", password)

  // Sanitize email
  email = Wiki.sanitizeMail( email)

  // that.de&&bug( "4, email:", email, "password:", password)

  push( "  email:    " + (email || "empty"))
  push( "  password: " + (password ? "OK" : "empty"))
  push()

  // Don't go further without both email & password
  if( !email || !password ){ return err() }

  // Export goes with 2 phases. 1st collect pages to export, 2nd export them
  // I know about the second phase thanks to a hint that I put during phase1
  var now = that.getSessionData( "now", on_page)

  // If this is phase2 then page's content is list of page to export
  // Jump to phase2 directly if command is DropboxArchive vs ExportToDropbox
  if( now || cmd == "DropboxArchive" ){

    // Provide some immediate feed back, some more comes later
    if( now ){
      that.setSessionData( "now", null, on_page)
      push( "Phase 2...\n")
    }
    push( "Connecting... See results in " + phase2_pagename)
    done()

    // See https://www.dropbox.com/developers/docs
    // https://www.dropbox.com/home#:::

    // Get a fresh token or reuse some previous one
    that.dropboxInfo( email, password, function db_getinfo( err, data ){

      // Restart from blank, result will go in phase2_page
      buf = []
      phase2_page = that.lookup( phase2_pagename)

      // If bad email/password
      if( err && err.statusCode == 401 ){
        push( "DropBox is not happy, please retry.")
        //push( "DropBox, can't get token.")
        push()
        push( email)
        push( on_page.name)
        return async_done()
      }

      // If some other error
      if( err ){
        that.de&&bug( "DropBox, error:", err)
        push( "DropBox, cannot get account info, sorry")
        that.de&&push( "Err: " + Sys.inspect( err))
        return async_done()
      }

      if( true ){

        // Provide the user's display name, to make user confortable
        push( "DropBox of " + data.display_name + " (" + data.email + ")")

        // If just connecting (versus exporting), provide more final & it's all
        if( cmd == "DropboxArchive" ){
          push()
          push( SW.domain + "/synced_with_dropbox.png")
          push( "OK. When you edit a page, 'Archive' will now copy DropBox")
          // Defensive
          if( !that.dropbox ){
            push( "... not true, we had a problem...")
          }
          return async_done()
        }

        // Now I collect the list of pages to export. I got them from the page
        push()
        var list = []
        var lines = on_page.getBody().split( "\n")
        var line
        var ii
        for( ii in lines ){
          line = lines[ii]
          if( !SW.wikiword.test( line) )continue
          if( "Do".starts(       line) )continue
          list.push( line)
        }
        // OK. Let's the fun begin. It's all asychronous
        that.exportToDropboxInProgress = true
        var nfiles = list.lines
        push( "Files: " + nfiles)
        var nok = 0
        var nko = 0
        var seen = {}
        var loop = function( seen ){
          var pagename = list.shift()
          // When done with the list, write result in feedback page
          if( !pagename ){
            push()
            if( nok ){
              push( "OK: " + nok + "/" + nfiles)
            }
            if( nko ){
              push( "KO: " + nko + "/" + nfiles)
            }
            that.exportToDropboxInProgress = false
            return async_done()
          }
          // Detect duplicates, skip them
          if( seen[pagename] ){
            return loop( seen)
          }
          seen[pagename] = true
          that.dropboxPut( that.lookup( pagename), function( err, page ){
            if( err ){
              push( "KO " + page.name)
              nko++
            }else{
              push( "ok " + page.name)
              nok++
            }
            loop( seen)
          })
        }
        // Let's do it
        loop( {})
      }
    })
    return
  }

  // If this is phase1, collect pages to export, async
  phase2_page = that.lookup( phase2_pagename)
  push( "List: " + phase2_pagename) 

  // Big hack...
  phase2_page.body = "In progress... please refresh"
  done()

  // This runs asynch
  if( !now ){
    var buf = []
    var root
    = this.canCurator ? this.wiki.homePage : this.lookup( this.userName())
    var export_list = function( list ){
      that.exportToDropboxInProgress = false
      buf = list.sort()
      push()
      push( "DoIt")
      that.setData( phase2_page, "email",     email, false)
      // false => don't write now, putPage() will do it
      // Don't write password, use OK instead
      that.setData( phase2_page, "password", "OK",   false) 
      // Store in Session instead
      // ToDo: should encrypt it to avoid insiders attacks
      that.dropbox.password = password
      // Signal that phase 1 is done
      that.setData( phase2_page, "now",      "true", false)
      // ToDo: should be some kind of "transient" page
      that.putPage(
        phase2_page,
        "DoExportToDropbox\n\nDoIt " + root + '\n\n' + buf.join( "\n"),
        function(){}
      )
    }
    //export_list( [root.name]); return
    this.wiki.forEachPage( root, this, function process( page ){
      if( page ){
        if( that.mayEdit( page)
        && !page.isNull()
        && (that.isCurator
          || ( !page.isUser()
            && !page.isSecret()
            && !page.isMap())
          )
        ){
          push( page.name)
        }
      // if End of iterator
      }else{
        export_list( buf)
      }
    }) //, true) // true => only already incarned pages
    return
  }
}

// Same code but different name => different behaviour
Session.doPageCommands.DropboxArchive
= Session.doPageCommands.ExportToDropbox;

exports.Session = Session;
// section: end dropbox.js