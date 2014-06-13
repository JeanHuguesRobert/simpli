// section: pagestore.js, export
// Class PageStore
//
// This is how I store pages.
// The default implementation here is directory/file based.
// Note: default implemention includes a "transient" mode, for test purposes.
//
// Scalability issue:
// Some pages, user pages typically, cannot be stored in memory, because the
// root wiki is managed by multiple processes. For this reason, they should
// be cached somewhere else, in some memcache probably.

function PageStore( wiki, dir, is_transient ){
// Class for page storage. Each wiki has its own.
// "wiki" is owner wiki, for statistics only.
// "dir" is relative to global SW.dir
  this.wiki = wiki
  dir || (dir = "")
  De&&mand( !dir || "/".ends( dir) )
  // replace all / into .dir/ because a page name can collide with a dir name
  dir = dir.replace( /\//g, ".dir/")
  var sep = (SW.wd || "." ) + "/" + ( SW.dir ? ( SW.dir + "/") : "" )
  this.path = sep + dir
  // The directory name is like the path minus the terminating /
  this.dir  = this.path.substr( 0, this.path.length - 1)
  this.backup = sep + "Backup/"
  if( "test".starts( dir) ){ is_transient = true }
  this.mayNeedMkdir = !is_transient
  // It's only when some access is tried that dir existence can be asserted
  this.reallyNeedsMkdir = false
  var that = this
  // If transient (memory only), then I have mock system calls
  this.isTransient = !!is_transient
  this.fs = !is_transient
  ? Fs
  : { 
    readFile:  function( n, f, cb ){
      that.test_de&&bug( "schedule transient read:", n)
      setTimeout( function(){
        that.test_de&&bug( "transient read:", n)
        cb.call( that, that.allPages[n] ? 0 : 1, that.allPages[n])
      }, 1)
    },
    writeFile: function( n, d, cb ){
      that.test_de&&bug( "schedule transient write:", n)
      setTimeout( function(){
        that.test_de&&bug( "transient write:", n)
        that.allPages[n] = d
        cb.call( that, 0)
      }, 1)
    }
  }
  // Create directory if needed
  if( !is_transient ){
    // Actual creation is postponed, until first page is written
    // This way there is less garbadge empty wikis
  // If memory only, then init list of page, using param if appropriate
  // Note: this is not used yet, it is intended for tests
  }else{
    this.allPages = (is_transient === true) ? {} : is_transient
  }
}
var PageStoreProto = PageStore.prototype = {};
MakeDebuggable( PageStore, "PageStore")

PageStoreProto.assertIsPageStore = function(){ return true }

PageStoreProto.toString = function(){
  return "<Store " + this.wiki.fullname() + ">"
}

PageStoreProto.getPath = function( name ){
  // Encode weird names to get a decent file name
  if( name.includes( "[") ){
    name = encodeURIComponent( name)
  }
  var pathname = this.path + name
  return pathname
}


PageStoreProto.getUrl = function( name ){
  if( SW.dir == "wiki" ){
    // "wiki" is generic, assume it means ".", remove it, including /
    return "file:" + this.getPath( name).substr( SW.dir.length + 1)
  }else{
    return "file:" + this.getPath( name)
  }
}


PageStoreProto.get = function( name, cb ){
// Get page from store, async. calls cb( err, body)
  var pathname = this.getPath( name)
  var that     = this
  // true => check that dir exists only
  return this.withDir( true, function( err ){
    // If directory is known to be inexistent, there no use it trying further
    if( that.reallyNeedsMkdir ){
      return cb.call( that, 1)
    }
    if( err ){
      return cb.call( that, err)
    }
    // ToDo: Lookup on external source, i.e. S3, CouchDB...
    // S3: https://github.com/LearnBoost/knox
    // Note: also at fs level with http://www.subcloud.com
    // SimpleDB
    // https://github.com/rjrodger/simpledb
    this.store_de&&bug( "fromStore:", pathname)
    this.fs.readFile(
      pathname,
      "utf8",
      function( err, data){
        that.isTransient || that.wiki.countPageReads++
        if( !err ){
          that.isTransient || (that.wiki.countPageReadBytes += data.length)
          that.store_de&&bug( "Read:", pathname,
            "data:", data.substr( 0, 30),
            "length:", data.length
          )
          if( !data ){
            that.bug_de&&bug( "BUG? null data in file:", pathname)
            data = "ERROR"
          }
        }else{
          that.isTransient || that.wiki.countPageMisses++
          that.store_de&&bug( "ReadError:", pathname, "err:", err)
          // ToDo: look in monthly snapshoots    
        }
        // Check if error is due to missing directory, helps avoid future attempts
        if( err && that.mayNeedMkdir && err.toString().includes( "ENOTDIR") ){
          that.reallyNeedsMkdir = true
        }
        cb.call( that, err, err ? null : data.toString())
      }
    )
  }) 
  return this
}

PageStoreProto.withDir = function( check_only, cb ){
  var that = this
  // Create parent directory first
  // This is a ugly hack because it depends on the actual implementation
  // of the parent wiki's page store...
  if( this.wiki.parentWiki
  &&  this.wiki.parentWiki.pageStore.mayNeedMkdir
  && !check_only
  ){
    return this.wiki.parentWiki.pageStore.withDir( check_only, function( err ){
      if( err ){
        that.wiki.error( "failure with parent directory creation:", err)
        return cb.call( that, err)
      }
      return that.withDir( check_only, cb)
    })
  }
  // ToDo: if check_only I should not create the dir, just check that it exists
  // however, if it does not exits, the .get() will fail anyway
  // Check/Create directory if not done successfully already
  if( this.mayNeedMkdir && !check_only ){
    Fs.mkdir( this.dir, parseInt( "755", 8 ), function( err ){
      // If creation ok
      if( !err ){
        that.store_de&&bug( "newWikiDirectory:", that.dir)
        that.isTransient || that.wiki.countWikiCreates++
        that.mayNeedMkdir     = false
        that.reallyNeedsMkdir = false
        return cb.call( that, 0)
      }
      // If already exists
      if( err && err.errno === 47 ){
        that.store_de&&bug( "existingWikiDirectory:", that.dir)
        that.mayNeedMkdir     = false
        that.reallyNeedsMkdir = false
        return cb.call( that, 0)
      }
      // Can't create
      that.wiki.error( "mkdir:", that.dir, "err: ", Sys.inspect( err))
      // ToDo: should remember error to avoid trying again uselessly later
      return cb.call( that, err)
    })
    return
  }else{
    return cb.call( that, 0)
  }
}

PageStoreProto.put = function( name, data, cb ){
// Put page in store, async. Calls cb( err)
  // ToDo: Update on external source, S3, CouchDB...
  var that = this
  this.de&&mand( data || data === "" )
  var pathname = this.getPath( name)
  // Create dir first if needed
  this.withDir( false, function( err ){
    if( err ){
      return cb.call( that, err)
    }
    this.store_de&&bug( "toStore:", pathname)
    this.deep_store_de&&bug( "Write, data:", data.substr( 0, 30))
    this.fs.writeFile(
      pathname,
      data,
      once( function page_store_put_cb( err ){
        if( that.isTransient ){ return cb.call( that, err) }
        if( !err ){
          that.wiki.countPageWrites++
          that.wiki.countPageWriteBytes += data.length
        }else{
          that.wiki.error( "write:", pathname, "err:", err)
        }
        cb.call( that, err)
        // Have a backup until out of beta, in ./Backup/ directory
        if( that.wiki.config.backupWrites ){
          var bak = that.backup
          // Note: flat names, / expands into .. (used to be .)
          + pathname.replace( /\//g, "..")
          + "~" + Sw.timeNow
          // However, keep less copies of context, +/- 1/day for 10 last days
          if( bak.includes( "PrivateContext") ){
            bak = bak.replace( /~.*(\d)\d\d\d\d\d\d\d\d$/, "~$1")
          }
          that.store_de&&bug( "backup:", bak)
          that.fs.writeFile( bak, data, function( err ){
            if( err ){
              that.wiki.error( "backup: ", bak, "err:", err)
            }
          })
        }else{
          that.store_de&&bug( "no backup")
        }
      })
    )
  })
  return this
}

PageStoreProto.open = function( cb ){
// Not used yet
  if( this.allPages == {} ){
    var that = this
    // Load some test pages
    Fs.readFile(
      this.path + "pages.json",
      "utf8",
      function( err, data ){
        if( !err ){
          that.allPages = JSON.parse( data)
          return cb( 0)
        }
        cb( 1)
      }
    )
  }
  cb( 0)
  return this
}

PageStoreProto.flush = function( cb ){
  if( this.allPages ){
    // Save test pages
    Fs.writeFile(
      this.path + "pages.json",
      JSON.stringify( that.allPages),
      function(){ cb( 0) }
    )
    return 
  }
  cb( 0)
  return this
}

PageStoreProto.close = function( cb ){
  this.flush( cb)
  return this
}

require( "./globals" ).inject( PageStore , exports );
// section: end pagestore.js
