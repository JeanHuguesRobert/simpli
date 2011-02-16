#!node
// main.js
//   hacked wiki engine using nodejs
//   https://github.com/JeanHuguesRobert/simpli
//
// March 22 2010, JeanHuguesRobert, based on earlier work
//
// 27/03/2010, JHR, Initial v001
// 09/05/2010, JHR, Back to work, refactor into classes
// 24/08/2010, JHR, Ditto, on AWS, after 2 months stall
// 03/11/2010, JHR, Ditto, after 10 days holliday stall
// 12/11/2010, JHR, refactoring, cleaning, etc
// 14/11/2010, JHR, fb@, v 0.04
// 17/11/2010, JHR, sectionize
// 22/11/2010, JHR, class User
// 21/12/2010, JHR, v 0.05
// 05/01/2011, JHR, v 0.06
// 12/01/2011, JHR, v 0.07, embedded
// 19/01/2011, JHR, v 0.08, API
// 21/01/2011, JHR, v 0.09, simplijs & hooks.js
// 29/01/2011, JHR, v 0.10, dropbox & ToDo pages
// 05/02/2011, JHR, v 0.11, cosmetic, shareaholic
// 11/02/2011, JHR, v 0.12, loadfire + linkedid
//
// section: vanitylicense.txt, export
// License : VanityLicence
// (C) Copyright Virteal Jean Hugues Robert.
// ----
// http://virteal.com/VanityLicense
// Vanity License: You may take the money but I keep the glory.
// ----
// section: end vanitylicense.txt
//
// This is a Wiki engine that I wrote to experiment closure style programming
// in a non blocking event style in NodeJS.
// It eventually became bigger, but I decided to keep everything almost in a
// single file, just as an experiment about "bad practices"
//
// *Q* Why is everthing (almost) in a single file?
// *A* It makes it much easier to navigate in the source file when editing.
// I could define "sections" and then dispatch the one big file
// content into multiple files, for those who prefer it that way. But
// at the end of day does it really matter?
//
// *Q* Does this scale?
// *A* I don't think so. That's the reason why I did eventually develop the
// Section.ize tool, to sectionize my "onebigfile" into smaller files but
// with a twist, see below. The onebigfile was almost 13 000 LOC at
// that time.
//
// I intend to develop other tools to make it easier to navigate the source
// code.
//
// *Q* What is "literate programming*?
// *A* It's a style of programming where comments comes first and code comes
// next. The basic idea is that "reading" the source code is more fun if the
// writer designed it to be like a tutorial about the system described.
// 
// *Q* Why do you call your code "a hack"?
// *A* It's because I do "ad hoc programming". This is a style of programming
// where you don't plan things, things just happen. And when the same thing
// happens many time, a pattern emerge. Then you know it's time to refactor
// your code.
//
// *Q* If you keep "refactoring" the code, how do you avoid bugs?
// *A* Tests! Preferably "automatized tests". But I don't usually write tests
// ahead, I write them when things "stabilize".
//
// *Q* You code is full of bugs!
// *A* That's because it is young. When it will mature there will be more
// tests and hopefully less bugs.
//
// *Q* Why NodeJS?
// I wanted to build something that could eventually scale to millions of
// wikis. NodeJS is reasonnably fast.
//
// ----
//
// Class Wiki
//  has a PageStore
//  has Page objects
//    some of which are User objects
//  manages Session objects...
//    ...that the http server invokes to manage http requests
//
//  Each session is associated to a user, either a guest or
//  a "member". Some members have mentorship rights (ie wiki admin).
//
// Wikis are cheap and created on fly when visited.
//
// ToDo: tests, functionnal, see http://sodajs.com/


// -----------------
// section: debug.js
//   Because debugging is the most important activity, alas
// 
// Misc, debug stuff, primitive, that's my De&&bug darling, ultrafast because
// the trace message is not evaluated when not used.
//
// There are (at least) 3 types of logging activities.
// Traces -- for the ones who code
// Alarms -- for the ones who monitor
// Logs   -- for the ones who shoot problems
//
// These different activities, performed by people with different skills, require
// different tools.

// I use a weirdly named "De" global variable.
// Then I can do De&&bug( ...) or De&&mand( ...)
var De = true 

// NDe is alway false. It makes it easy to turn off a trace, just add N before De.
// This is for trace message that you add while debugging a piece of code and then
// don't leave there once the code works reasonnably well.
// Note: it is often a good idea to leave trace messages, complex code is fragile,
// what was hard to debug may be hand to debug again if something changes.
var NDe  = false  // Constant, MUST be false

bugScript = function bug(){
// Client side version
  if( !window.console )return
  if( !console.log    )return
  var list = []
  for( var item in arguments ){
    item = arguments[item]
    item = item ? item.toString() : "null"
    list.push( item)
  }
  if( list.length > 1 ){
    console.log( list.join( " "))
  }else{
    console.log( arguments[0])
  }
}

bug = function bug(){
// Usage: De&&bug(...) and NDe&&bug(...)
// Server side version
  var list = []
  var with_sid = false
  for( item in arguments ){
    if( item == 0 && arguments[item] === (global.Sw && Sw.currentSession) ){
      with_sid = true
    }
    item = arguments[item]
    item = item ? item.toString() : "null"
    list.push( item)
  }
  // Get name of caller function
  var caller
  try{
    $_buggy_$ // Raises an exception, intentional
  }catch( err ){
    caller = err.stack.split( "\n")[2]
    .replace( / \(.*/, "")
    .replace( "   at ", "")
    .replace( "Function.", "")
    .replace( /\/.*/, "")
    .replace( "<anonymous>", "?")
    .replace( / /g, "")
    // I don't think this is useful but that was an attempt to get a
    // meaningfull name in some cases where first attempt fails for reasons
    // I need to investigate. ToDo: investigate...
    if( caller == "?" ){
      // ToDo: DRY
      caller = err.stack.split( "\n")[3]
      .replace( / \(.*/, "")
      .replace( "   at ", "")
      .replace( "Function.", "")
      .replace( /\/.*/, "")
      .replace( "<anonymous>", "?")
      .replace( / /g, "")
    }
  }
  // Handle this.xxx_de&&bug() type of traces.
  // xxx_de getters do set global "TraceDomainTarget" as a side effect. That's
  // how I can know what object the trace is about.
  // This is not perfect, but it works ok because there are no threads in NodeJs.
  if( global.TraceDomainTarget ){
    // If TraceDomainTarget is was by some xxx_de getter, show "O:xxx"
    if( TraceDomainTarget !== global
    &&  TraceDomainTarget !== Sw.currentSession
    ){
      // I add it "upfront"
      try{
        list.unshift( "O:" + TraceDomainTarget)
      }catch( err ){
        // Deals with case where .toString() bombs on target object         
        list.unshift( "O:???")
      }
    }
    // Add "F:xxx" if caller function's name was found
    if( caller ){
      list.unshift( "F:" + caller)
    }
    // Add "D:" to describe what "domain" the trace is about
    var domain
    if( domain = TraceDomainTarget.pullDomain() ){
      list.unshift( "D:", domain)
    }
    // "Consume" the target
    TraceDomainTarget = null

  // Handle De&&bug() type of traces, where no target object is described
  }else{
    if( caller ){
      list.unshift( "F:" + caller)
    }
  }

  // Pretty print somehow
  var msg = list.join( ", ")
  if( global.Sw && Sw.currentSession && !with_sid ){
    var s = Sw.currentSession
    if( s.loginName ){
      msg = "S" + (s.isBot ? "b" : s.isGuest() ? "g" : s.canMentor ? "!" : "")
      + ":" + s.id + ", " + msg
    }else{
      msg = "S:" + s.id + ", " + msg
    }
  }
  msg = msg
  .replace( /: , /g, ":")
  .replace( /, , /g, ", ")
  .replace( / , /g,  ", ")
  .replace( /: /g,   ":")
  .replace( /:, /g,  ":")

  // ToDo: log to a file
  require( "sys").puts( msg)

  // Log into buffer displayed in HTML
  if( global.Sw && Sw.currentSession ){
    // ToDo: traces include confidential informations, that's bad
    if( Sw.currentSession.isDebug ){
      Sw.currentSession.logTrace( msg)
    }
  }
}

function ndebug(){
// Very global method to disable all traces. This can be usefull when testing
// the code's "speed".
  De&&bug( "Turn off debugging traces")
  De = false
}

function debug(){
// Very global method to restore disabled traces.
// Note: This does not work if program was stared with traces initially
// disabled. It works only if traces were initially enabled and momentary
// disabled using ndebug()
  if( !De ){
    De = true
    bug( "Turn on debugging traces")
  }
}

// Some additional tools, Bertrand Meyer's style

function mand( bool, msg ){
// Usage: De&&mand( something true )
// This is like the classical assert() macro
// Usage: de&&mand( some_assert_clause )
  if( !bool ){
    bug( "BUG: Assert failure ", require( "sys").inspect( arguments.callee))
    if( msg ){
      bug( "Assert msg:", msg)
    }
    // Turn maximal debugging until process dies, nothing to lose
    if( global.assert_de ){
      De = true
      var item
      for( item in TraceDomains ){
        traceDomain( item)
      }
      throw new Error( "Assert failure")
    }else{
      try{ 
         $_buggy_assert_$ // Intentionally raised exception 
      }catch( err ){
        err.stack.split( "\n").map( function( line ){
          bug( "Stack:", line)
        })
        throw err
      }
    }
  }
}

function mand_eq( a, b, msg ){
  if( a == b )return
  msg = (msg ? "(" + msg + ")" : "") + " != '" + a + "' and '" + b + "'"
  mand( false, msg)
}

// Even more assert style stuff, for things that bite me

function once( cb ){
// Assert that cb is called once only
// In debug mode, add a check about cb not reentered
// In ndebug mode, return cb unchanged
// With NodeJs event + callback style, it is easy to forget to "return" from
// a function after calling some other code with a callback style continuation.
// In such cases, strange bugs happen where code seems to be called from
// nowhere, once() helps catch such bugs.
  if( !De )return cb
  var entered
  return function once_cb(){ 
    if( entered ){
      De&&bug( "Reentering callback:", cb.name)
      // cb.apply( this, arguments)
      throw new Error( "reentered callback:" + cb.name) 
    }
    entered = true 
    return cb.apply( this, arguments) 
  } 
}

// section: end debug.js


// ----------------------
// section: sectionize.js, export
// sectionize.js
//   split a big file into sections, bidirectional
//
// November 17th, 2010, by JeanHuguesRobert
// 2010/11/17, JHR
//
// section: vanitylicense.txt, import, once
// section: end
//
// This is an editing tool that makes it easier to edit multiple files at once
//
// The sectioned file contains "directives" about other files that specify how
// these other files are included and/or updated.
//
// The directives are
// // section: file[,opt1, opt2, ...] -- begin mark of a section
// // section: end [file]             -- end mark of a section
//
// valid options after the begin mark are:
//  export    -- export only
//  append    -- ToDo, like export but append instead of replace
//  cc: targt -- ToDo: carbon copy into additional target
//    if target ends with /, concat base name of source file
//    if target ends with /*, idem but remove path from base name
//  import    -- include only, never overwrite
//  optional  -- ToDo: silent ignore if import fails
//  once      -- as in "import, once", to avoid multiple inclusions
//  fat       -- "fat", include content in lean version also
//  keep      -- ToDo, after import, keep original, commented out
//  merge     -- ToDo, using diff
//  resolve   -- ToDo, remove some content after merge + manual edit
//  skip      -- ToDo, skip to end of section
//  include   -- ToDo, turns section into $include( file)
//  map       -- ToDo, map types, ie .html into .json
//  render    -- ToDo, intelligent export
//  end       -- ToDo, for one liner directives
//
// The basic idea is to help grow a software from a single file to a well
// modularized set of files, incrementaly.
//
// Initially everything is in "onsourcefile".
//
// As the file gets bigger, one can add sections.
//
// When a section stabilizes, one can use $include( file)
//
// If the section is turned into a CommonJS module, one can maybe start using
// require().
//
// The tool also works with non javascript files.
//
// A typical path is to first extract html out from javascript into .html.json
// sections (idem with css content)
//
// The next step is to turn the .html.json file into a .html file.
//
// The same process can be applied for other types of files, thanks to
// "mappers" than can map from one format to another format.
//
// .json is the preferred "pivot" format.
//
// If multiple files are modified during an editing session, the tool detects
// it and refuses to overwrite a section file that is more recent than the file
// that contains a copy of it, assuming the file is the true original source.
//
// It is up to the developper to either use the directive "import" or manually
// copy the file into it's container. Another option is to delete the copy from
// the container and start using $include() instead.
//
// If valid edits were done on both copies, one can use merge to merge the
// edits into the container. Then, using resolve, one can consolidate the
// edits, removing the conflicting ones.
//
// This is the edit/merge/resolve/run/edit... cycle. If one keeps editing the
// main container, the "onesourcefile", the cycle is the usual edit/run/edit...
//
// ToDo: a "watch" tool that would detect changes in source files impacting a
// running process, with the option of restarting it.

// Class section

function Section( container, content, directive, stats ){
// Return either a new leaf with specified content or a container
// Usage:
//  var root = new Section( null, null, filename+directives)
//  var container = new Section( root, null, filename+directives)
//  var leaf = new Section( container, "content")
  // A container section contains a list of sections
  // either just one leaf, if not sectionized
  // or [leaf,leaf-begin,container,leaf-end] for each subsection
  // where leaf-begin & leaf-end constains the begin/end marks
  // with the final leaf-end beeing optional
  this.isRoot      = !container
  if( this.isRoot ){
    this.countLines = 2 // 1 for missing first \n, 1 for 1 based index
  }
  this.root        = this.isRoot ? this : container.root
  this.isLocal     = !!(content || stats)
  this.isLeaf      = !!content
  this.isContainer = !this.isLeaf
  this.line        = this.root.countLines
  if( this.isLeaf ){
    this.content  = content
    this.filename = directive
    var lc = content.split( '\n').length - 1
    Section.debug( "add " + lc + " line(s)"
      + ", starting with " + content.replace( /\n/g, "\\n").substr( 0, 40)
    )
    this.root.countLines += lc
  }else{
    this.sections = []
    Section.parseDirective( directive, this)
    var signature = this.filename + ", " + this.directives.join( ", ")
    this.signature = signature
    // Issue a warning if same signature appeared already
    if( Section.all[signature]
    && !this.directive['append']
    && !this.directive['once']
    ){
      Section.warning( "duplicate section " + this.signature)
    }
    // Section.puts( "Info: new section " + this.signature)
    Section.all[signature] = this
    this.previous = Section.all[this.filename]
    Section.all[this.filename] = this
    // Determine file's type based on file extension
    var ii = this.filename.lastIndexOf( ".")
    if( ii < 0 ){
      this.type = ''
    }else{
      this.type = this.filename.substr( ii + 1)
    }
    Section.checkDirective( this)
    // Get file's content and stats from file system
    if( !this.directive['skip'] ){
      var fs = require( "fs")
      try{ this.filebody = fs.readFileSync( this.filename, 'utf8')
      }catch( err ){ Section.info( "no file " + this.filename) }
    }else{
      if( this.directive['skip'] ){
        Section.warning( "skipping " + this.filename)
      }
    }
    if( !stats ){
      try{ this.stats = fs.statSync( this.filename)
      }catch( err ){
        if( this.filebody ){ Section.fatal( "stat on " + this.filename, err) }
        this.stats = {mtime:""} // looks old
      }
    }
  }
  this.wasParsed = false
  // Add section to container if there is one
  if( this.container = container ){
    container.sections.push( this)
  }
}
Section.prototype = Section

Section.toString = function(){
  if( this.isLeaf )return this.container.toString() + ":" + this.line
  return this.filename
}

Section.ize = function( file, dump, options ){
// This is the tool itself, it processes a file. It shall be invoked very
// early one when a process starts.
// If the file gets changed due to the processing, it throws an error.
// This is done to stop running the outdated version of the program.
// If it does not throw an exception, then it means the file is up to date.
// "file" is optional, default is to use process.argv[1]
// "dump" is optional, default is to check that processing works.
//    "test" extracts sections into ".test" files.
//    "export" extracts sections into their respective files.
//    "lean" produces "lean" files, wihtout duplicate content.
//    "import" includes files in their containers, never export anything.
//       Note: throws an exception if main file gets changed.
//    "merge" updates both the main file & its sections.
//       Note: throws an exception if main file gets changed.
// Individual section's directives may sometimes override the default behaviour,
// i.e. some sections can be export only or import only.
// Optional {} "options":
//   silent:  true => no messages at all
//   verbose: true => info messages
//   debug:   true => very verbose
//   markers: {begin:b,end:e}, default is to depend on file type.
// ToDo: markers depending on file type beyond .js & .json
  file || (file = process.argv[1]) // ToDo: should use __filename?
  options || (options = {silent: false, debug: false, verbose: false})
  var markers = options.markers
  Section.silentFlag = options.silent
  if( Section.infoFlag = options.verbose ){
    Section.silentFlag = false
  }
  if( Section.debugFlag = options.debug ){
    Section.silentFlag = false
    Section.infoFlag   = true
  }
  // Forget results from previous run
  Section.all    = {}
  Section.writes = []
  // Restart with fresh root container
  var section = new Section( null, null, file)
  markers || (markers = { begin: "// section: ", end: "// section: end" })
  Section.markers = markers
  try{ section.parse( markers)
  }catch( err ){ Section.fatal( "cannot parse " + file, err) }
  if( dump ){
    Section.info( "dump " + dump)
    try{ section.collectContent( markers, {}, dump)
    }catch( err ){ Section.fatal( "cannot dump " + file, err) }
  }
  if( Section.writes.length ){
    Section.warning( "updated files: " + Section.writes.join( " "))
    if( dump == "import" || dump == "merge" ){
      if( !options.noexit )process.exit( 1)
    }
    return null
  }
  Section.oneBigFile  = file
  Section.oneBigBody  = section.filebody
  Section.rootSection = section
  return section
}

Section.sys = require( 'sys')
Section.fs  = require( 'fs')

Section.puts = function( msg ){
  if( Section.silentFlag )return
  Section.sys.puts( "sectionize.js, " + msg)
}

Section.debug = function( msg ){
  if( !Section.debugFlag )return
  Section.puts( "Debug: " + msg)
}

Section.info = function( msg ){
  if( !Section.infoFlag  )return
  Section.puts( "Info: " + msg)
}

Section.warning = function( msg ){
  Section.puts( "Warning: " + msg)
}

Section.error = function( msg ){
  Section.puts( "Error: " + msg)
}

Section.fatal = function( msg, err ){
  Section.puts( "Fatal: " + msg)
  if( !err )throw "sectionize error: " + msg
  Section.puts( "Exception: " + err)
  if( err.stack ){ Section.puts( "Stack: " + err.stack) }
  throw err
}

Section.checkDirective = function( section ){
  var o
  function bad( msg ){
    Section.fatal( "bad directive " + o + " (" + msg + ")"
      + " about " + section.filename
    )
  }
  function has( key ){ return section.directive[key] }
  function no(  key ){ return !has( key) }
  function check( key ){ return o = has( key) }
  // Some options are mutually exclusive
  check( 'import')   && has( 'export') && bad()
  check( 'merge')    && has( 'export') && bad()
  // Some options requires another option
  check( 'optional') && no( 'import')  && bad()
  check( 'end')      && no( 'include') && no( 'import') && bad()
}

Section.buildMarkers = function( markers ){
// markers are detected at the beginning of lines.
// Defaults to ----
  if( !markers ){ markers = { begin: "----" } }
  if( markers.begin.substr( 0, 1) != '\n' ){
    markers.begin = '\n' + markers.begin
  }
  if( !markers.end ){ markers.end = markers.begin }
  if( markers.end.substr( 0, 1) != '\n' ){
    markers.end = '\n' + markers.end
  }
  Section.info( "markers: " + Section.sys.inspect( markers))
  return markers
}

Section.parseDirective = function( directive, obj ){
  // The directive is made of comma separated options, insignificant spaces
  obj.directives = directive.replace( /\s/g, "").split( ',')
  // The first option is special, it is the file name
  obj.filename = obj.directives.shift()
  // Remember this name for use in optional "cc" directive
  obj.basename = obj.filename
  // Expand name with path, relative to root container
  if( obj.filename && obj.filename.substr( 0, 1) != "/" ){
    var path = obj.root.filename.lastIndexOf( '/')
    if( path > -1 ){
      path = obj.root.filename.substr( 0, path + 1)
      Section.debug( "resolve " + obj.filename
        + " into " + (path + obj.filename)
      )
      obj.filename = path + obj.filename
      // ToDo: handle ../ and ./ better
    }else{
      Section.fatal( "bad root " + obj.root.filename)
    }
  }else if( obj.filename ){
    Section.warning( "line " + obj.root.countLines)
    Section.warning( "absolute path " + obj.filename)
  }
  // Turn directives array into hash for easy access
  obj.directive  = {}
  var directive
  for( var ii in obj.directives ){
    var directive = obj.directives[ii]
    // Either boolean or key:value
    if( directive.indexOf( ':') == -1 ){
      obj.directive[directive] = true
    }else{
      obj.directive[directive.substr( 0, directive.indexOf( ':') - 1)]
      = directive.substr( directive.indexOf( ':') + 1)
    }
  }
  // The options's order is relevant for section's signature
  obj.directives = obj.directives.sort()
  return obj
}

Section.parse = function( markers, text ){
  if( this.wasParsed )return this
  if( this.isLeaf ){
    Section.fatal( "Must not parse leaf in " + this.container.filename)
  }
  text || (text = this.filebody)
  markers = Section.buildMarkers( markers)
  var mem1 = process.memoryUsage()
  Section.debug( "mem1: " + Section.sys.inspect( mem1))
  this.parseRest( markers, text)
  try{ Section.debug( "dump\n" + this.collectContent( markers, {}, "dump"))
  }catch( err ){ Section.fatal( "collect", err) }
  var mem2 = process.memoryUsage()
  Section.debug( "mem1: " + Section.sys.inspect( mem1))
  Section.debug( "mem2: " + Section.sys.inspect( mem2))
  Section.debug( "rebuild")
  var rebuilt_content = this.collectContent( markers, {})
  if( rebuilt_content != text ){
    Section.fatal( "buggy software"
      + ", length " + rebuilt_content.length
      + " versus expected "   + text.length
    )
  }else{
    Section.info( "successful parsing of " + this.filename )
  }
  var mem3 = process.memoryUsage()
  Section.debug( "mem1: " + Section.sys.inspect( mem1))
  Section.debug( "mem2: " + Section.sys.inspect( mem2))
  Section.debug( "mem3: " + Section.sys.inspect( mem3))
  return this
}

Section.visit = function( visitor, seen ){
  if( this.isLeaf )return visitor( 'leaf', this)
  seen || (seen = {})
  if( seen[this.filename] ){
    if( this.directive['once'] )return
    return visitor( 'duplicate', this)
  }
  visitor( 'begin', this)
  for( var ii in this.sections ){
    this.sections[ii].visit( visitor, seen)
  }
  visitor( 'end', this)
  return this
}

Section.collect = function( collector, visitor ){
  var stack = []
  var buf = []
  return this.visit( function( class, section ){
    switch( class ){
    case 'leaf':
      return buf.push( collector( section))
    case 'begin':
      stack.push( buf)
      buf = []
      return
    case 'end':
      visitor( section, buf.join( ''))
      buf = stack.pop()
    }
  })
}

Section.build = function( lean ){
  return this.collect(
    function( leaf ){ return leaf.content },
    function( container, content ){ container.content = lean ? "" : content }
  )
}

Section.update = function( collector, updator ){
  return this.collect(
    collector,
    function( section, content ){
      // Don't update if current content depends on more recent stuff
      if( section.mtime() > section.ownTime() ){
        Section.fatal( "update, "
          + section.dependencies().recent.source()
          + " is more recent than "
          + section.source()
        )
      }
      // Don't update if already up to date
      if( section.filebody == content )return
      updator( section, content)
    }
  )
}

Section.export = function(){
  this.build()
  return this.update(
    function( section ){ return section.content },
    function( section, content ){
      // Don't update main file
      if( section.isRoot )return
      // Update only if export directive
      if( !section.directive['export'] )return
      section.write( null, content)
    }
  )
}

Section.lean = function(){
  this.build( true)
  return this.collect(
    function( section ){ return section.content },
    function( section, content ){
      section.write( "lean." + section.filename)
    }
  )
}

Section.write = function( target, content ){
  target  || (target = this.filename)
  content || (content = this.content)
  // Never empty a file
  if( !content )return Section.warning( "avoid emptying " + target)
  Section.writes.push( target)
  Fs.writeFileSync( target, content, "utf8")
  // Update stats
  this.stats.mtime = (new Date()).toISOString()
}

Section.dump = function(){
  buf = []
  function push( msg ){ buf.push( msg) }
  this.visit( function( class, section ){
    switch( class ){
    case 'leaf':
      return push( "\nlen: " + section.content.length 
      + ", " + section.content.substr( 0, 60).replace( /\n/g, '\\n'))
    case 'duplicate':
      return push( "\n!!! duplicated section " + section.filename + ' !!!\n')
    case 'begin':
      return push( "\nbegin new sections for " + section.signature)
    case 'end':
      return push( "\nend of sections for " + section.signature)
    }
  })
  return buf.join( '')
}

Section.collectContent = function( markers, seen, dump ){
  Section.debug( "collect " + this)
  if( this.wasParsed && !dump )return this.content
  if( !dump ){ this.wasParsed = true }
  if( this.isLeaf ){
    return (dump == "dump")
    ? ("\nlen: " + this.content.length 
      + ", " + this.content.substr( 0, 60).replace( /\n/g, '\\n')
      )
    : this.content
  }
  // Detect duplicate references
  if( seen[this.filename] ){
    if( this.directive['once'] )return ""
    Section.warning( "line " + this.line)
    Section.warning( "duplicated " + this.signature)
    return "\n!!! duplicated section " + this.filename + ' !!!\n'
  }
  seen[this.filename] = this
  var section
  var buf = []
  var str
  if( dump == "dump" ){
    buf.push( "\nbegin new sections for " + this.signature)
  }
  for( var ii in this.sections ){
    section = this.sections[ii]
    str = section.collectContent( markers, seen, dump)
    if( dump != "lean" ){
      buf.push( str)
    }else if( section.isLeaf ){
      buf.push( str)
    }else if( section.directive['fat'] ){
      buf.push( str)
    }else{
      // Remove unneeded fat
    }
  }
  if( dump == "dump" ){
    buf.push( "\nend of sections for " + this.signature)
    return buf.join( '')
  }
  this.content = buf.join( '')
  if( !dump )return this.content
  if( dump == "test"
  ||  dump == "export"
  ||  dump == "lean"
  ){
    var target = this.filename
    if( dump == "test" || dump == "lean" ){
      target = target.replace( /([^\/]*)$/, dump + ".$1")
    }
    if( dump == "export" && this.isRoot ){
      Section.info( dump + " ok")
      return this.content
    }
    if( !this.directive['import']
    &&  !this.directive['skip']
    &&  !this.directive['merge']
    ){
      var old_body
      if( Section.all[target]
      && (old_body = Section.all[target].filebody) == this.content
      ){
        // Skip writing if file is known to be already up to date
      }else{
        // Don't export if current content depends on more recent stuff
        if( this.mtime() > this.ownTime() ){
          Section.fatal( "export, "
            + this.dependencies().recent.source()
            + " is more recent than "
            + this.source()
          )
        }
        Section.warning( "write " + dump  + ' ' + target)
        if( old_body ){
          Section.warning( "new length " + this.content.length
            + " versus old length " + old_body.length
          )
        }
        this.write( target)
      }
    }
    return this.content
  }
  Section.fatal( "bad dump format, " + dump)
}

Section.parseRest = function( markers, text ){
// Parse arbitrary additional text
  if( !text )return this
  // Look for begin and end markers in text
  var ibegin = text.indexOf( markers.begin)
  var iend   = text.indexOf( markers.end)
  // If an end marker comes first
  if( iend >= 0 
  && (ibegin < 0 || iend <= ibegin)
  ){
    // Add a leaf for what is before the end mark
    if( iend > 0 ){
      new Section( this, text.substr( 0, iend))
      text = text.substr( iend)
    }
    return this.parseEnd( markers, text)
  }
  // If there is a begin mark
  if( ibegin >= 0 ){
    // Add a leaf for what is before the begin mark
    if( ibegin > 0 ){
      new Section( this, text.substr( 0, ibegin))
      text = text.substr( ibegin)
    }
    return this.parseBegin( markers, text)
  }
  // no additional section, we're done
  // Add leaf with what remains
  new Section( this, text)
  return this
}

Section.parseBegin = function( markers, text ){
// Parse section definition
  // text starts with \n// section: ...
  var ii = text.substr( 1).indexOf( '\n') + 1
  var directive = ii ? text.substr( 0, ii) : text
  Section.info( "line " + this.root.countLines)
  Section.info( "parse begin " + directive.substr( 1))
  // Add a leaf for the directive itself
  new Section( this, directive)
  // Add a non leaf section, also check the directives
  var section = new Section( this, null, 
    directive.substr( markers.begin.length)
  )
  // Move forward in text, skipping the directive
  text = text.substr( directive.length)
  // Move forward in new section, unless one liner
  if( section.directive['end'] ){
    return this.parseRest( markers, text)
  }else{
    return section.parseRest( markers, text)
  }
}

Section.parseEnd = function( markers, text ){
  // text starts with \n// section: end
  var ii = text.substr( 1).indexOf( '\n') + 1
  var directive = ii ? text.substr( 0, ii) : text
  Section.info( "line " + this.root.countLines)
  Section.info( "parse end " + directive.substr( 1))
  // end marker is valid after begin marker only
  if( !this.container ){
    Section.error( "line " + this.root.countLines)
    Section.fatal( "unexpected end in " + this.filename + ", " + directive)
  }
  // Add leaf for directive itself in container
  new Section( this.container, directive)
  // Check the end directive, file name should match if provided
  directives = Section.parseDirective(
    directive.substr( markers.end.length),
    {root: this.root}
  )
  // If file name is provided, it should match the one after the begin mark
  if( directives.filename && (directives.filename != this.filename) ){
    Section.error( "line " + this.root.countLines)
    Section.fatal( "end mismatch, '"
      + directives.filename
      + "' versus expected '" + this.filename + "'"
    )
  }
  // Move forward in text, skipping the directive
  text = text.substr( directive.length)
  // Move forward, back in container
  return this.container.parseRest( markers, text)
}

Section.dependencies = function( list ){
// Returns new (or increased) list with sections This section depends on.
// This basically all but the "export" sections and sub sections.
// Returns {all:list_sections, recent:section, by_name:hash_sections_by_filename)
  list || (list = { all: [], recent: null, by_name: {} })
  if( this.isLeaf )return list
  if( list.by_name[this.filename] )return list
  if( this.directive.export )return list
  list.all.push( this)
  list.by_name[this.filename] = true
  if( !list.recent || list.recent.ownTime() < this.ownTime() ){
    this.recent = this
  }          
  for( var ii in this.sections ){
    this.sections[ii].dependencies( list)
  }
  return list
}

Section.isLean = function( seen ){
}

Section.mtime = function(){
// time of the last modification among sections and subsections this section
// depends on.
  var recent = this.dependencies().recent
  return recent ? recent.ownTime() : ""
}

Section.ownTime = function(){
  if( this.isLeaf   )return this.container.ownTime()
  if( this.previous )return this.previous.ownTime()
  return this.stats.mtime
}

Section.source = function(){
  if( this.isLeaf )return this.container.source()
  return this.filename
}

// section: include.js
function $include( file, prepand, postpand ){
// Like C's #include to some extend. See also $include_json().
// The big difference with require() is that whatever is declared using
// "var" is visible, whereas with require() local variables are defined in
// some different scope.
// The big difference with #include is that #include can be used anywhere
// whereas $include() can be used only as a statement.
// Please use $include_json() to include an expression.
// file is searched like require() does (if require.resolve() exists).
// File's content is not cached, I trust the OS for doing some caching better
// than myself. As a result, it works great with self modifying code...
// Another big difference is the fact that $include() will fail silently if
// the file cannot be read.
  var data
  var fs      = require( 'fs')
  var ffile   = ""
  var rethrow = false
  try{
    ffile = require.resolve ? require.resolve( file) : file
  }catch( err ){}
  // Silent ignore if file not found
  if( !ffile ){
    Section.sys.puts( "$include: no " + file)
    return
  }
  try{
    data = fs.readFileSync( ffile).toString()
    prepand  && (data = prepand + data)
    postpand && (data = data    + postpand)
    $include.result = undefined
    // Section.sys.puts( "$include() eval of:" + data)
    try{
      eval( data) // I wish I could get better error reporting
    }catch( err ){
      rethrow = true
      throw err
    }
    return $include.result
  }catch( err ){
    Section.sys.puts( "$include: " + file)
    if( true || rethrow ) throw err
  }
}

function $include_json( file ){
// Like C's #include when #include is used on the right side of an assignment
  return $include( file, ";($include.result = (", "));")
}
// section: end include.js

// section: end sectionize.js


// -------------------
// section: globals.js

// Some global constants
var SW = {
  // Needed at startup
  version:  "0.12",
  name:     "SimpliJs",		// Name of the root wiki
  debug:    true,		// Debug mode means lots of traces
  test:     false,		// Test mode
  dir:      "",		        // Local to cwd, where files are, must exist
  port:     1234,		// 80 default, something else if behind a proxy
  domain:   "",			// To build permalinks, empty => no virtual hosting
  static:   "",			// To serve static files, optionnal, ToDo: ?
  protocol: "http://",		// Idem, https requires a reverse proxy
  fbid:     "",                 // Facebook app ID
  twid:     "",			// Twitter app ID
  likey:    "",			// LinkedIn API key
  dbkey:    "",			// Dropbox key
  dbsecret: "",			// Dropbox secret
  shkey:    "",			// Shareaholic key
  scalable: false,		// ToDo: a multi-core/multi-host version
  onload: 			// List of pages loaded at startup
    ["PrivateContext", "AboutWiki", "RecentStamps", "PrivateCodes"],
  style:    "",			// CSS string (or lesscss if "less" is found)
 
  // Patterns for valid page names, please change with great care only
  
  // ~= CamelCase, @#_[ are like uppercase
  wikiwordCamelCasePattern:
    "[@#A-Z_\\[][a-z0-9_.\\[-]{1,62}[@#A-Z_\\[\\]]",
  // 3Code style
  wikiword3CodePattern:
    "3\w\w-\w\w\w-\w\w\w",
  // 4Codes
  wikiword4CodePattern: 
    "4\w\w\w-\w\w\w\w-\w\w\w\w-\w\w\w\w",
  // Twitter hash tag
  wikiwordHashTagPattern:
    "#[a-z_0-9]{3,30}",
  // Twitter name
  wikiwordTwitterPattern:
    "@[a-z_]{3,30}",
  // Facebook username  
  wikiwordFacebookPattern:
    "[a-z][a-z_0-9.-]{4,62}@",
  // Facebook group, ToDo: for further study
  wikiwordFacebookGroupPattern:
    "[a-z][a-z_0-9.-]{4,62}#",
  // LinkedIn screen name
  wikiwordLinkedInPattern:
    "[a-z][a-z_0-9]{4,62}In",
  // email address, very liberal but fast
  wikiwordEmailPattern:
    "[a-z][a-z_0-9.-]{1,62}@[a-z0-9.-]{5,62}",
  // Free links, anything long enough but without / & infamous <> HTML tags
  // ToDo: I also filter out .", = and ' but I should not, but that would break
  wikiwordFreeLinkPattern:
    "[A-Za-z_]*\\[[^.='\"/<>\\]]{3,62}\\]",
  // Suffix, can follow any of the previous pattern
  wikiwordSuffixPattern:
    "(([\.][@#A-Z_a-z0-9-\\[\\]])|([@#A-Z_a-z0-9\\[\\]-]*))*",
  // Prefix, cannot precede a wikiword
  wikiwordPrefixPattern:
    "([^=@#A-Za-z0-9_~\?&\)\/\\\">.:-]|^)",
  // ToDo: Postfix anti pattern, cannot succede a wikiword, non capturing
  wikiwordPostfixAntiPattern: "",

  // Valid chars in 3codes, easy to read, easy to spell
  // 23 chars => 23^8 possibilities, ~= 80 000 000 000, 80 billions
  // 4codes: 23^15 ~= a billion of billions, enough
  valid3: "acefghjkprstuvxyz234678",	// avoid confusion (ie O vs 0...)
  
  // Pattern for dates, ISO format, except I allow lowercase t & z
  datePattern: "20..-..-..[tT]..:..:..\....[zZ]",

  // Delays:
  thereDelay:        30 * 1000,	// Help detect current visitors
  recentDelay:  30 * 60 * 1000,	// Recent vs less recent
  awayDelay:    10 * 60 * 1000,	// Help logout old guests
  logoutDelay: 2 * 3600 * 1000,	// Help logout inactive members
  saveDelay:         30 * 1000,	// Save context delay
  resetDelay: 12 * 3600 * 1000,	// Inactive wikis are unloaded
  hotDelay:  45 * 84600 * 1000,	// Short term memory extend

  // Hooks
  hookSetOption: null, // f( wiki, key, str_val, base) => null or {ok:x,val:y}
  hookStart:     null, // Called right before .listen()

  the: "end" // of the missing comma
}

// String pattern for all valid Wikiwords
SW.wikiwordPattern = "("
  + "("
  +       SW.wikiwordCamelCasePattern
  + "|" + SW.wikiword3CodePattern
  + "|" + SW.wikiword4CodePattern
  + "|" + SW.wikiwordHashTagPattern
  + "|" + SW.wikiwordTwitterPattern
  + "|" + SW.wikiwordFacebookPattern
  + "|" + SW.wikiwordFacebookGroupPattern
  + "|" + SW.wikiwordLinkedInPattern
  + "|" + SW.wikiwordEmailPattern
  + "|" + SW.wikiwordFreeLinkPattern
  + ")"
  // All previous followed by optionnal non space stuff, but not . ending
  + SW.wikiwordSuffixPattern
+ ")"

// From string patterns, let's build RegExps

// Pattern to isolate wiki words out of stuff
SW.wikiwords = new RegExp(
    SW.wikiwordPrefixPattern
  + SW.wikiwordPattern
  + SW.wikiwordPostfixAntiPattern
  , "gm"
)

// Pattern to check if a str is a wikiword
SW.wikiword
  = new RegExp( "^" + SW.wikiwordPattern              + "$")
// Pattern for each type of wikiword
SW.wikiwordCamelCase
  = new RegExp( "^" + SW.wikiwordCamelCasePattern     + "$")
SW.wikiword3Code
  = new RegExp( "^" + SW.wikiword3CodePattern         + "$")
SW.wikiword4Code
  = new RegExp( "^" + SW.wikiword4CodePattern         + "$")
SW.wikiwordHashTag
  = new RegExp( "^" + SW.wikiwordHashTagPattern       + "$")
SW.wikiwordTwitter
  = new RegExp( "^" + SW.wikiwordTwitterPattern       + "$")
SW.wikiwordFacebook
  = new RegExp( "^" + SW.wikiwordFacebookPattern      + "$")
SW.wikiwordFacebookGroup
  = new RegExp( "^" + SW.wikiwordFacebookGroupPattern + "$")
SW.wikiwordLinkedIn
  = new RegExp( "^" + SW.wikiwordLinkedInPattern      + "$")
SW.wikiwordEmail
  = new RegExp( "^" + SW.wikiwordEmailPattern         + "$")
SW.wikiwordFreeLink
  = new RegExp( "^" + SW.wikiwordFreeLinkPattern      + "$")

// Some tests
if( De ){
  // Smoke test
  if( !SW.wikiword.test( "WikiWord") ){
    De&&bug( "Pattern:", SW.wikiwordPattern)
    De&&mand( false, "Failed WikiWord smoke test")
  }
  // Some more tests, because things gets tricky some times
  function test_wikiwords(){
    function test( a, neg ){
      if( !De )return
      !neg && mand(  SW.wikiword.test( a), "false negative " + a)
      neg  && mand( !SW.wikiword.test( a), "false positive " + a)
      var match = SW.wikiwords.exec( " " + a + " ")
      if( !match ){
        mand( neg, "bad match " + a)
      }else{
        mand( match[1] == " ", "bad prefix for " + a)
        match = match[2]
        !neg && mand( match == a, "false negative match: " + a + ": " + match)
        neg  && mand( match != a, "false positive match: " + a + ": " + match)
        match = SW.wikiwords.exec( "~" + a + " ")
        if( match ){
          mand( neg, "bad ~match " + a)
        }
      }
    }
    function ok( a ){ test( a)       }
    function ko( a ){ test( a, true) }
    ok( "WikiWord")
    ok( "WiWi[jhr]")
    ok( "W_W_2")
    ok( "@jhr")
    ko( "@Jhr")
    ko( "@jhr.")
    ok( "@jhr@again")
    ok( "j-h.robert@")
    ko( "jhR@")
    ok( "#topic")
    ko( "#Topic")
    ok( "#long-topic5")
    ko( "Word")
    ko( "word")
    ko( " gar&badge ")
    ok( "UserMe@myaddress_com")
    ko( "aWiki")
    ko( "aWikiWord")
    ok( "_word_")
    ko( "_two words_")
    ok( "[free link]")
    ok( "User[free]")
    ok( "[free]Guest")
    ko( "[free/link]")
    ok( "linkedIn")
    ko( "shrtIn")
    ko( "badLinkIn")
    ok( "info@simpliwiki.com")
  }
  test_wikiwords()
}

// Each wiki has configuration options.
// Some of these can be overridden by wiki specific AboutWiki pages
// and also at session's level (or even at page level sometimes).
SW.config = 
// section: config.json, import, optional, keep
// If file config.json exists, it's content is included, ToDo
{
  lang:           "en",	// Default language
  title:          "",	// User label of wiki, cool for 3xx-xxx-xxx ones
  cols: 50,		// IETF RFCs style is 72
  rows: 40,		// IETF RFCs style is 58
  twoPanes:       false,// Use right side to display previous page
  cssStyle:       "",	// CSS page or url, it patches default inlined CSS
  canScript:      true,	// To please Richard Stallman, say false
  open:           true,	// If true everybody can stamp
  canClone:       true, // If true, clones are allowed
  veryOpen:       false,// If false, members need a mentor stamp
  veryOpenClones: true, // True if clones are very open by default
  premium:        false,// True to get lower Ys back
  noCache:        false,// True to always refetch fresh data
  backupWrites:   SW.debug,	// Log page changes in SW.dir/Backup
  mentorUser:     "",	// default mentor
  mentorCode:     "",	// hard coded default mentor's login code
  mentors:        "",	// Users that become mentor when they log in
  adminIps:       "",	// Mentors from these addresses are admins
  debugCode:      "",	// Remote debugging
  fbLike:         true,	// If true, Like button on some pages
  meeboBar:       "",   // Meebo bar name, "" if none, ToDo: retest
  fetch :         "",   // space separated pages to prefetch at init
}
// section: end config.json

// Local hooks makes it possible to change (ie hack) things on a local install
// This is where one want to define secret constants, ids, etc...
$include( "hooks.js")
if( SW.name != "SimpliJs" ){
  Section.sys.puts( "Congratulations, SimpliJs is now " + SW.name)
  if( SW.dir ){
    Section.sys.puts( "wiki's directory: " + SW.dir)
  }else{
    Section.sys.puts( "wiki is expected to be in current directory")
    Section.sys.puts( "See the doc about 'hooks', SW.dir in 'hooks.js'")
  }
  if( SW.port == "1234" ){
    Section.sys.puts( "default 1234 port")
    Section.sys.puts( "see the doc about 'hooks', SW.port in 'hooks.js'")
  }
}else{
  Section.sys.puts( "Humm... you could customize the application's name")
  Section.sys.puts( "See the doc about 'hooks', SW.name in 'hooks.js'")
}

// Let's compute "derived" constants

SW.idCodePrefix = "code" + "id"

// Global variables
var Sw = {
  interwikiMap: {},	// For interwiki links, actually defined below
  sessionId: 0,         // For debugging
  currentSession: null, // Idem
  requestId: 0,
  timeNow: 0,
  dateNow: 0,
  cachedDateTooltips: {},
  inspectedObject: null
}

Sw.setTimeNow = function(){
// Update Sw.timeNow & Sw.dateNow, called often enought.
// Fast and somehow usefull to correlate traces about the same event.
// ToDo: Use V8/Mozilla Date.now() ?
  this.timeNow = (this.dateNow = new Date()).getTime()
}

Sw.age = function( time_ago ){
// Returns n millisec since time_ago
// Returns 0 if no time_ago
  return time_ago ? (Sw.timeNow - time_ago) : 0
}

// No operation dummy function that does nothing, used as a placeholder
Sw.noop = function noop(){}

// section: end globals.js

// -------------------
// section: depends.js
//
// Some dependencies, nodejs's builtins mainly
//
// npm less
//   to handle .less style of CSS file, see http://lessorg.com
// npm prettyfy
//   google's prettyfier for section.ized .js source files
// npm dropbox
//   dropbox support
//
// These are all optional, if they are not found life goes on without them.
//
// In addition to these modules, SimpliWiki depends on some images.
//
// In the top menu:
//   yanugred16.png
//   facebook_ico.png
//   twitter_ico.png
//   linkedin_ico.png
//   gmail_ico.png
//   yahoo_ico.png
//   dropbox_ico.png
//
// scrollcue, "powered by", shortcut icon, OneBigFile sections, etc:
//   yanugred16.png
//
// Angular support requires an angular.js file, this should be the last
// minimized version preferably (about 60kb as of feb 12 2011). Get it
// from http://angularjs.com
//
// Support for the codemirror editor is more complex to install. You need
// codemirror.js, codemirror_base.js, parsexml.js, parsecss.js,
// tokenizejavascript.js, parsejavascript.js, parsehtmlmixed.js, csscolors.css
// xmlcolors.css & jscolors.cs
// You can get those at http://codemiror.net
// I plan to use v2 some day. https://github.com/marijnh/codemirror2
// 
// ToDo: better handling of these image dependencies, make them configurable,
// auto-detected or optional somehow.

var Sys    = require( 'sys')	// ToDo: move to "util" soon
var Events = require( 'events')
var Http   = require( 'http')
var Fs     = require( 'fs')
var Url    = require( 'url')
var Net    = require( 'net')
var ChildProcess = require( 'child_process')
var QueryString  = require( 'querystring')

var Gzip = null // ToDo: install node-compress require( 'compress').Gzip
// Note: nginx does a good job with gzip.

// section: end depends.js


// ----------------------------------------------------
// Some meta programming, messing with the source file.
//
// Patches some global constants using command line.
// Patches source file using Section.ize()
// Adds source file's path to require.paths
//
// version   -- display SW.name & SW.version and exit( 0)
// ndebug    -- set SW.debug to false
// debug     -- set SW.debug to true, overrides ndebug
// test      -- set SW.test  to true & increment SW.port
// localhost -- set SW.domain to "localhost"
// merge, export & lean -- invoke Section.ize()

;(function(){
  var argv = process.argv
  var file = argv[1] // ToDo: should use __filename?
  var ii = file.lastIndexOf( '/')
  if( ii ){
    require.paths.unshift( file.substr( 0, ii - 1))
  }
  var hargv = {}
  argv.forEach( function( v ){ hargv[v] = v })
  argv = hargv
  De = SW.debug
  if( argv.ndebug ){ SW.debug = false }
  if( argv.debug  ){ SW.debug = true }
  if( SW.debug ){ Section.sys.puts( "DEBUG MODE") }
  if( argv.localhost ){ SW.domain = 'localhost' }
  if( argv.test ){
    Section.sys.puts( "TEST MODE")
    SW.port++
    SW.test  = true
    SW.debug = true
  }
  De = SW.debug
  try{
    if( !argv.merge && Section.ize( file).isLean() ){
       Section.fatal( "lean " + file + " needs a merge")
    }
    if( argv.export ){ Section.ize( file, "export", {debug: false}) }
    if( argv.lean   ){ Section.ize( file, "lean",   {debug: false}) }
    if( argv.merge  ){ Section.ize( file, "merge",  {debug: false}) } 
  }catch( err ){ Section.fatal( file, err) }
  // Exit 0 if displaying version instead of running
  // This is also usefull to check syntax before trying to run
  if( argv.version ){
    Section.sys.puts( "Version: " + SW.name + " " + SW.version)
    process.exit( 0)
  }
})()


// ------------------
// section: string.js, export
// Patch String class. Some people consider it harmful

String.prototype.starts = function( other ){
// True if this string is at the beginning of the other one
  return !!other && other.substr( 0, this.length) == this
}

String.prototype.ends = function( other ){
  // True if this string is at the end of the other one
  if( !other )return false
  var endlen   = this.length
  var otherlen = other.length
  if( !endlen || endlen > otherlen ){ return false }
  // ToDo: should avoid concatenation
  return other.substr( 0, otherlen - endlen) + this == other
}

String.prototype.includes = function( other ){
// True if this string is somewhere inside the other one
  return !!other && this.indexOf( other) != -1
}

String.prototype.frontLine = function(){
// Returns the first line, up to \n (not included), if any
  var ii = this.indexOf( "\n")
  if( ii < 0 ){ return this }
  return this.substr( 0, ii)
}


String.prototype.butFrontLine = function(){
// Returns all but the first line
  var ii = this.indexOf( "\n")
  if( ii < 0 ){ return "" }
  return this.substr( ii + 1)
}


String.prototype.capitalize = function(){
  if( this.length === 0 ) return ""
  return this.substr( 0, 1).toUpperCase() + this.substr( 1)
}

String.prototype.toUtf8 = function(){
// Encode string into UTF-8, something to do before sending a response.
// Unused. I'm not sure about anything regarding encoding
  return unescape( encodeURIComponent( this))
}

String.prototype.fromUtf8 = function(){
// Unused, yet
  return decodeURIComponent( escape( this))
}

// section: end string.js

// ---------------------
// section: contexted.js, export
// My Contexted Darling
// It changes "this" (like jQuery's bind() for example) and
// also the global Contexted.scope

var Contexted = function( scope, f ){
  return function(){
    Contexted.scope = scope
    return f.apply( scope, arguments) 
  } 
}
// section: end contexted.js


// -----------------
// section: fluid.js

// Using Fluid.push(), pop(), level() && reset() one can also manage
// a stack of dynamically scoped variables
// See http://en.wikipedia.org/wiki/Scope_(programming)
// See also "Fluid" in Common Lisp

var Fluid = function( scope, locals, f ){
  var level = Fluid.level( scope)
  try{
    Fluid.push( scope, locals)
    return f.apply( scope)
  }finally{
    Fluid.reset( level)
  }
}

// This is a helper to detect new versus overriden variables
Fluid._undefinedMark = {}

Fluid.push = function( scope, locals ){
// Dynamically declare & assign an additional set of variables
// Returns modified scope, including snapshot of previous values for variables
// Sets Contexted.scope as a nice side effect
// Use "Fluid.push( global, {fluid:'hello'}" to manage "global" variables
  var key
  var save = {}
  var detect_undefined = Fluid._undefinedMark
  for( key in locals ){
    if( typeof scope[key] != 'undefined' ){
      save[key] = scope[key]
    }else{
      save[key] = detect_undefined
    }
    scope[key]  = locals[key]
  }
  // Push one level of scope, remembering previous scope & value of variables
  if( scope.FluidStack ){
    scope.FluidStack.push( save)
  }else{
    scope.FluidStack = [save]
  }
  return Contexted.scope = scope
}


Fluid.pop = function( scope ){
// Remove some dynamically scoped variables
// Use either optionnal scope or last scope saved by push()
// Sets & returns Contexted.scope as a nice side effect
  scope || (scope = Contexted.scope)
  // Pop one level of nested scope
  var safe = scope.FluidStack.pop()
  // Restore value of scoped variable using safe value saved by push()
  var locals = safe || {}
  var key
  var val
  var detect_undefined = Contexted._undefinedMark
  for( key in locals ){
    val = locals[key]
    if( val === detect_undefined ){
      delete scope[key]
    }else{
      scope[key] = locals[key]
    }
  }
  return Contexted.scope = scope
}

Fluid.level = function( scope ){
  return (scope.FluidStack && scope.FluidStack.length) || 0
}

Fluid.reset = function( scope, level ){
// Pop nested dynamically scope variable down to specified level or 0
// Sets & returns Contexted.scope as a nice side effect
  scope || (scope = Contexted.scope)
  ;(level !== null) || (level = 0)
  while( scope.FluidStack
  &&     scope.FluidStack.length > level
  ){
    Fluid.pop( scope)
  }
  return Contexted.scope = scope
}

// section: end fluid.js


// ----------------------
// section: debuggable.js
//  Fine grained debugging trace, per domain & per object/class

var TraceDomains = {}

// Tracks last referenced object is xxx_de&&bug style expressions
var TraceDomainTarget = null

Debuggable = {}

Debuggable.setDeId = function( id ){
  this.deId = id
}

Debuggable.debug = function(){
// Enables tracing
  if( this === global ){
    De = true
  }
  this.__defineGetter__( "de", function(){
    TraceDomainTarget = this
    return De
  })
} 
Debuggable.ndebug = function(){
// Disable tracing on the target object
// Target can be null => disable all tracing
// Or it can be a specific object or a specific class.
// See usage in code where I disable traces for requests from robots.
  if( this === global ){
    De = false
  }
  this.__defineGetter__( "de", Sw.noop)
}

Debuggable.toggleDebug = function(){
  this.de ? this.ndebug() : this.debug()
}

Debuggable.traceDomainIsOn = function( name ){
  var named = name + "_de"
  return this[named] ? true : false
}

Debuggable.traceDomain = function( name ){
  var named = name + "_de"
  // Sys.puts( "traceDomain for " + name)
  De = true
  //this[named]&&bug( "TurningOn, domain: ", name)
  if( this === global ){
    TraceDomains[name] = name
    global.__defineGetter__( named, function(){
      return De && (this.domain = TraceDomains[name])
    })
  }else{
    this.__defineGetter__( named, function(){
      // Sys.puts( "GETTER " + named + " ON " + this)
      TraceDomainTarget = this
      return De && this.de && (this.domain = TraceDomains[name])
    }) 
  }
  //this[named]&&bug( "TurnedOn, domain: ", name)
  if( "deep_".starts( name) ){
    this.traceDomain( name.substr( "deep_".length))
  }
}

Debuggable.pullDomain = function(){
// Get and clear the last checked domain, usually to display it
  var ret = this.domain
  this.domain = null
  return ret || ""
}

Debuggable.ntraceDomain = function( name ){
  var named = name + "_de"
  this[named]&&bug( "TurningOff, domain: ", name)
  if( this === global ){
    // Sys.puts( "ntraceDomain for " + name)
    TraceDomains[name] = null
    global.__defineGetter__( named, Sw.noop)
  }else{
    // Inherit from global domains
    this.__defineGetter__( named, function(){
      TraceDomainTarget = this
      return De && (this.domain = TraceDomains[name]) // global[named]
    })
  }
  this[named]&&bug( "TurnedOff, domain: ", name) // Should not display
  if( !"deep_".starts( name) ){
    this.ntraceDomain( "deep_" + name)
  }
}

Debuggable.toggleDomain = function( name ){
  if( TraceDomains[name] ){
    this.ntraceDomain( name)
    De&&mand( !this.traceDomainIsOn( name))
    if( this === global ){
      De&&mand( !TraceDomains[name] )
    }else{
      De&&mand( this[name = "_de"] == TraceDomains[name])
    }
  }else{
    this.traceDomain( name)
    De&&mand( this.traceDomainIsOn( name))
    if( this === global ){
      De&&mand( TraceDomains[name] == name )
    }else{
      De&&mand( this[name + "_de"] == name )
    }
  }
}

Debuggable.declareIdempotentPredicate = function( name ){
  this.allIdempotentPredicates.push( name)
  // Keep it sorted alphabetically
  this.allIdempotentPredicates = this.allIdempotentPredicates.sort()
}

Debuggable.isIdempotentPredicate = function( name ){
// Tell if a method is an idempotent predicate
  var ii
  for( ii = 0 ; ii < this.allIdempotentPredicates.length ; ii++ ){
    if( this.idemPotentPredicates[ii] == name )return true
  }
  return false
}

Debuggable.declareIdempotentGetter = function( name ){
  this.allIdempotentGetters.push( name)
  // Keep it sorted alphabetically
  this.allIdempotentGetters = this.allIdempotentGetters.sort()
}

Debuggable.isIdempotentGetter = function( name ){
// Tell if a method is an idempotent getter
  var ii
  for( ii = 0 ; ii < this.allIdempotentGetters.length ; ii++ ){
    if( this.allIdempotentGetters[ii] == name )return true
  }
  return false
}

function MakeDebuggable( target, class_label, msg ){
// Instrumentalize a class (or object) to make debugging easier
  // Initialize list of idempotent predicates and getters
  target.allIdempotentPredicates = []
  target.allIdempotentGetters    = []
  if( !De ){
    target.declareIdempotentGetter
    = target.declareIdempotentPredicate
    = Sw.noop
    return
  }
  // Inject methods from global Debuggable object
  for( item in Debuggable ){
    msg&&De&&bug( msg, "make debuggable, adding method:", item)
    target[item] = Debuggable[item]
  }
  // Inherit domains' states from global value for these domains
  for( item in TraceDomains ){
    msg&&De&&bug( msg, "make debuggable, adding domain:", item)
    var named = item + "_de"
    // Either set or clear depending on global value
    global[named]
    ? target.traceDomain(  item)
    : target.ntraceDomain( item)
    msg&&De&&mand( named in target, "getter " + msg + "." + named)
  }
  msg&&De&&bug( msg, "make debuggable, adding de getter")
  target.debug()
  // Set up a class label that is better looking than basic "typeof"
  if( class_label ){
    target.classLabel = class_label
  }
  De&&mand( target.de)
}

De&&mand( this !== global ) // Watch out!

MakeDebuggable( global)

DeclareTraceDomain = function( name, is_on ){
  is_on ? global.traceDomain( name) : global.ntraceDomain( name)
  if( !"deep".starts( name) ){
    DeclareTraceDomain( "deep_" + name, is_on == "deep")
  }
}

// section: tracedomains.js
if( De ){

DeclareTraceDomain( "ntest",   false)
DeclareTraceDomain( "test",    "deep")
DeclareTraceDomain( "assert",  "deep")	// exit on assert failure?
DeclareTraceDomain( "deep",    "deep")  // traces for hard bugs
DeclareTraceDomain( "cookie",  true)
DeclareTraceDomain( "store",   "deep")
DeclareTraceDomain( "http",    true)
DeclareTraceDomain( "static",  "deep")	// Static files
DeclareTraceDomain( "yaml",    false)
DeclareTraceDomain( "context", true)
DeclareTraceDomain( "config",  false)
DeclareTraceDomain( "f3Code",  "deep")
DeclareTraceDomain( "bot",     false)
DeclareTraceDomain( "misc",    "deep")
DeclareTraceDomain( "option",  "deep")
DeclareTraceDomain( "sane",    "deep")  // Sanitizations
DeclareTraceDomain( "bug",     "deep")
DeclareTraceDomain( "rest",    true)
DeclareTraceDomain( "monit",   "deep")
DeclareTraceDomain( "lang",    "deep")
DeclareTraceDomain( "get",     "deep")
DeclareTraceDomain( "post",    "deep")
DeclareTraceDomain( "send",    "deep")
DeclareTraceDomain( "mail",    "deep")
DeclareTraceDomain( "queue",   "deep")
DeclareTraceDomain( "acl",     "deep")
DeclareTraceDomain( "wiki",    "deep")
DeclareTraceDomain( "init",    "deep")
DeclareTraceDomain( "session", "deep")
DeclareTraceDomain( "login",   "deep")
DeclareTraceDomain( "user",    "deep")
DeclareTraceDomain( "inline",  false)
DeclareTraceDomain( "dropbox", "deep")
// section: end tracedomains.js

MakeDebuggable( global) // With domains this time

// Tests
Debuggable.test = function(){
  De&&bug( "Starting Debuggable.test()")
  De&&mand( global.de,    "global.de")
  De&&mand( de,           "de")
  function TraceTest(){}
  TraceTest.prototype = TraceTest
  TraceTest.hello = function(){ return "hello" }
  MakeDebuggable( TraceTest)
  var TraceTestInstance = new TraceTest()
  De&&mand( TraceTestInstance.hello() == "hello", "TraceTest hello")
  De&&mand( TraceTestInstance.de, "TTI.de" )
  De&&mand( TraceTestInstance.test_de, "TTI.test_de" )
  //Sys.puts( "TraceTest: " + Sys.inspect( TraceTest))
  De&&mand( TraceTest.test_de, "TraceTest.test_de" )
  De&&mand( TraceTest.deep_test_de, "TraceTest.deep_test_de")
  De&&mand( !TraceTest.ntest_de, "!TraceTest.ntest_de" )
  //Sys.puts( "TraceDomains: ", Sys.inspect( TraceDomains))
  //Sys.puts( "ntest_de: " + Sys.inspect( ntest_de))
  De&&mand( !ntest_de,    "!ntest_de")
  De&&mand( test_de,      "test_de")
  De&&mand( deep_test_de, "deep_test_de")
  global.toggleDomain( "test")
  //De&&mand( TraceTestInstance.test_de, "TTI.test_de got lost")
  //TraceTestInstance.toggleDomain( "test")
  TraceTestInstance.test_de&&bug( 
    "Bad TTI.test_de: ", TraceTestInstance.test_de,
    "TraceDomains: ", Sys.inspect( TraceDomains))
  De&&mand( !TraceTestInstance.test_de, "!TTI.test_de")
  De&&mand( !global.tracedomainIsOn( "deep_test") )
  global.pullDomain()
  De&&bug( "Test with Debuggable.test() is a success")
}

if( SW.test ){
  Debuggable.test() 
  global.traceDomain(  "test")
}else{
  global.ntraceDomain( "test")
}

} // end if De

// section: end debuggable.js

  
// ----------------
// section: misc.js, export
//  Misc

function extname( path ){
// Returns extension or "", extension is after last "."
// ToDo: use require( "path").extname()
  var index = path.lastIndexOf( ".")
  return index < 0 ? "" : path.substr( index)
}

// Some value semantic

Sw.copyHash = function( h ){
// Returns a new hash with same content (not a deep copy)
  var nh = {}
  for( var prop in h ){
    nh[prop] = h[prop]
  }
  return nh
}

Sw.equalHash = function( h1, h2 ){
// Returns true if both hash contains the same attributes and if attribute
// values are == equal
  var in_h1 = {}
  var key
  for( key in h1 ){
    if( h1[key] != h2[key] )return false
    in_h1[key] = true
  }
  for( key in h2 ){
    if( !in_h1[key] )return false
  }
  return true
}

Sw.copyArray = function( a ){
// Returns a new array with same content (not a deep copy)
  return a.slice()
}

Sw.randomizeArray = function( a ) {
// "In place" randomizer of array, returns the randomized array
  var ii = a.length
  if( !ii )return this
  while( --ii ){
    var jj = Math.floor( Math.random() * (ii + 1))
    var tempii = a[ii]
    var tempjj = a[jj]
    a[ii] = tempjj
    a[jj] = tempii
  }
  return this
}

// section: end misc.js

// ---------------------
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
// "dir" is relative to global SW.dir, defaults to "."
  this.wiki = wiki
  dir || (dir = "")
  De&&mand( !"/".ends( dir) )
  // ToDo: dir = dir + ".dir", because a page name can collide with a dir name
  // But first I need a migration tool to rename directories
  // Right now the only case where a page name is also a valid directory name
  // is when the page is the name of a facebook user... hence, I patch
  if( "@".ends( dir) ){
    dir += ".dir"
  }
  // this.dir  = "./" + (SW.dir || ".") + "/" + dir
  if( SW.dir ){
    this.dir    = SW.dir + (dir ? "/" + dir : "")
    this.path   = this.dir + "/"
    this.backup = SW.dir + "/Backup/"
  }else{
    this.dir    = dir
    this.path   = dir ? dir + "/" : ""
    this.backup = "Backup/"
  }
  if( "test".starts( dir) ){ is_transient = true }
  this.needMkdir = !is_transient
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
PageStore.prototype = PageStore
MakeDebuggable( PageStore, "PageStore")

PageStore.assertIsPageStore = function(){ return true }

PageStore.toString = function(){
  return "<Store " + this.wiki.fullname() + ">"
}

PageStore.getPath = function( name ){
  // Encode weird names to get a decent file name
  if( name.includes( "[") ){
    name = encodeURIComponent( name)
  }
  var pathname = this.path + name
  return pathname
}


PageStore.getUrl = function( name ){
  if( SW.dir == "wiki" ){
    // "wiki" is generic, assume it means ".", remove it, including /
    return "file:" + this.getPath( name).substr( SW.dir.length + 1)
  }else{
    return "file:" + this.getPath( name)
  }
}


PageStore.get = function( name, cb ){
// Get page from store, async. calls cb( err, body)
  var pathname = this.getPath( name)
  var that     = this
  return this.withDir( function( err ){
    if( err ){
      that.wiki.error( "some issue with mkdir, err:", err)
      return cb.call( that, err)
    }
    // ToDo: Lookup on external source, i.e. S3, CouchDB...
    // S3: https://github.com/LearnBoost/knox
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
        cb.call( that, err, err ? null : data.toString())
      }
    )
  }, true) // true => check that dir exists only
  return this
}

PageStore.withDir = function( cb, check_only ){
  var that = this
  // Create parent directory first
  // This is a ugly hack because it depends on the actual implementation
  // of the parent wiki's page store...
  if( this.wiki.parentWiki
  &&  this.wiki.parentWiki.pageStore.needMkdir
  ){
    return this.wiki.parentWiki.pageStore.withDir( function( err ){
      if( err ){
        that.wiki.error( "failure with parent directory creation:", err)
        return cb.call( that, err)
      }
      return that.withDir( cb)
    }, check_only)
  }
  // ToDo: if check_only I should not create the dir, just check that it exists
  // however, if it does not exits, the .get() will fail anyway
  // Check/Create directory if not done successfully already
  if( this.needMkdir && !check_only ){
    Fs.mkdir( this.dir, 0755, function( err ){
      // If creation ok
      if( !err ){
        that.store_de&&bug( "newWikiDirectory:", that.dir)
        that.isTransient || that.wiki.countWikiCreates++
        that.needMkdir = false
	return cb.call( that, 0)
      }
      // If already exists
      if( err && err.errno == 17 ){
        that.store_de&&bug( "existingWikiDirectory:", that.dir)
        that.needMkdir = false
	return cb.call( that, 0)
      }
      // Can't create
      that.wiki.error( "mkdir:", that.dir, "err: ", Sys.inspect( err))
      return cb.call( that, err)
    })
    return
  }else{
    return cb.call( that, 0)
  }
}

PageStore.put = function( name, data, cb ){
// Put page in store, async. Calls cb( err)
  // ToDo: Update on external source, S3, CouchDB...
  var that = this
  this.de&&mand( data || data === "" )
  var pathname = this.getPath( name)
  this.withDir( function( err ){
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

PageStore.open = function( cb ){
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

PageStore.flush = function( cb ){
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

PageStore.close = function( cb ){
  this.flush( cb)
  return this
}

// section: end pagestore.js

// ----------------
// section: wiki.js, export
// Class Wiki
//
// There is a singleton TheRootWiki and clones maybe

function Wiki( parent, name, options ){

  options || (options = {})

  this.init_de&&bug(
    "newWiki:", name,
    "parent:", parent,
    "options:", Sys.inspect( options)
  )

  this.initializing = true
  // During initialization I cannot handle HTTP requests & cb, I queue them
  // Queued requests and cb are process when wiki's context is fully restored
  this.queuedRequests = []

  // Initialize/refresh global Sw.timeNow
  Sw.setTimeNow()

  // All wikis, but the root wiki, have a parent wiki, they inherit pages
  this.parentWiki = parent

  // Name defaults to statically configured one if root, random if not
  this.name = name ? name : (!parent ? SW.name : this.random3Code( "-"))
  if( this.name == "sandbox" || this.name == "entrainement" ){
    this.isSandbox = true
  }

  // Sets a seed for &cid= closure ids, usefull on restarts
  this.idSalt = Sw.timeNow % 100000

  // Initialize login ids
  this.countLogins = 0

  // Remember all sessions
  this.allSessions = []

  // Remember last session that involved this wiki
  this.lastSession = null
  this.dateLastSession = Sw.dateNow

  // Remember last login of a session (ie new user)
  this.lastLogin = null

  // Remember last login that is for a guest
  this.lastGuestLogin = null

  // Remember last login that is for a member
  this.lastMemberLogin = null

  // List of all pages, both existing and referenced, by name
  this.allPages = {}

  // Remember all valid login names
  this.allLoginNames = {}

  // List draft pages
  this.allTransientPages = {}

  // Size of allTransientPages minus codes & users (a stupid optimization?)
  this.countDrafts = 0

  // List "hot" pages, the pages that were modified
  this.allHotPages = {}

  // Remember last session attached to some user name
  this.allSessionsByName = {}

  // Remember all User objects by User id. See .logAuthenticUser()
  this.allUsersById = {}

  // Remember last session attached to some User
  this.allSessionsById = {}

  // Remember last session attached to some login code
  this.allSessionsByCode = {}

  // List of all "about" page, they have a data member, a hash
  this.allDataPages = {}

  // Total number of members that have visited the wiki (not guests)
  this.countMembers = 0

  // Only the Root wiki dispatches closures (ie HTTP req with cid query param)
  if( !parent ){
    this.allClosures = [null]
  }

  // List all clones of this wiki (clones "inherit" pages from "parent")
  this.allClones = {}

  // List of all backlinks for all pages, entries are hashes with name:Page
  this.allBacklinksByPage = {}

  // Each wiki has a config, copied from parent or global SW.config for root
  this.config = parent ? Sw.copyHash( parent.config) : SW.config

  // This new wiki is very open if parent say so
  if( parent && parent.config.veryOpenClones ){
    this.config.veryOpen = true
    this.config.open = true
  }

  // A little treat to myself
  if( name == "virteal" || name == "jhr" ){
    this.config.premium = true
  }

  // The config is modified using the options
  var key
  for( key in options ){
    this.config[key] = options[key]
  }

  // Some tests, because things gets tricky some times
  if( !parent ){
    function test( a, neg ){
      if( !De )return
      !neg && mand(  SW.wikiword.test( a), "false negative " + a)
      neg  && mand( !SW.wikiword.test( a), "false positive " + a)
      var match = SW.wikiwords.exec( " " + a + " ")
      if( !match ){
        mand( neg, "bad match " + a)
      }else{
        mand( match[1] == " ", "bad prefix for " + a)
        match = match[2]
        !neg && mand( match == a, "false negative match: " + a + ": " + match)
        neg  && mand( match != a, "false positive match: " + a + ": " + match)
        match = SW.wikiwords.exec( "~" + a + " ")
        if( match ){
          mand( neg, "bad ~match " + a)
        }
      }
    }
    function ok( a ){ test( a)       }
    function ko( a ){ test( a, true) }
    ok( "WikiWord")
    ok( "WiWi[jhr]")
    ok( "W_W_2")
    ok( "@jhr")
    ko( "@Jhr")
    ko( "@jhr.")
    ok( "@jhr@again")
    ok( "j-h.robert@")
    ko( "jhR@")
    ok( "#topic")
    ko( "#Topic")
    ok( "#long-topic5")
    ko( "Word")
    ko( "word")
    ko( " gar&badge ")
    ok( "UserMe@myaddress_com")
    ko( "aWiki")
    ko( "aWikiWord")
    ok( "_word_")
    ko( "_two words_")
    ok( "[free link]")
    ok( "User[free]")
    ok( "[free]Guest")
    ko( "[free/link]")
    ok( "linkedIn")
    ko( "shrtIn")
    ko( "badLinkIn")
  }

  // Some metaprogramming (not very useful so far)
  this.protoGuest = Session // Temporary, needed to make Page objects
  Session.wiki = this
  this.allPages["Page"]  = this.lookupPage( "Page")
  this.allPages["Class"] = this.lookupPage( "Class")
  this.allPages["Class"].proto = this.allPages["Page"]
  Session.wiki = null

  // The homepage
  this.homePage = this.lookupPage( "HomePage")

  // Remember user labels associated to service ids
  this.allUserLabelsById = {}
  this.allUserLabels     = [] // Array of {id:xx,label:zz} pairs

  // Context last saved in PrivateContext page (helps to detect changes)
  this.lastSafeContext = ""

  // Some monitoring
  this.updateCounters()
  this.countWikis = 1
  this.timeLastStarted = Sw.timeNow
  if( parent ){ parent.countWikis++ }

  // Map for interwiki links. ToDo: test
  this.interwikiMap = Sw.interwikiMap
  var item
  if( !parent ){
    // Convert lowercase entries because wikify() matches capitalized interlinks
    for( item in Sw.interwikiMap ){
      Sw.interwikiMap[item.toUpperCase()] = Sw.interwikiMap[item]
    }
  }

  this.pageStore = new PageStore( this, this.fullname( "", true)) // No /

  // Test pages, they look like they don't exist before one write them
  this.testPages = {}

  this.dateLastStarted = new Date()
  this.touch()
  Wiki.timeoutAutoreset( this)

  // Create prototypal guest user if root wiki
  //  The prototypal guest session handles method calls that would normally
  //  require some valid session but are at times applied without such a beast
  if( !parent ){
    this.protoGuest = new Session
    this.protoGuest.login( this)
    // I patch the name for the rare cases where it is displayed
    this.protoGuest.loginName = SW.name
    this.protoGuest.logout( "proto")
  // Else reuse Root's proto guest session
  }else{
    // Note: "anonymous" rest requests from sw_api requires a per wiki proto
    // guest, it is create when that happends (lazy)
    this.protoGuest = parent.protoGuest
  }

  // ToDo: handle options

  var that = this
  var done = false

  // Preload some pages, asynchronous
  // I store some of these pages *inside* PrivateContext

  var aboutwiki = this.lookupPage( "AboutWiki")
  this.aboutwikiPage = aboutwiki

  var context   = this.lookupPage( "PrivateContext")
  this.contextPage = context

  var homepage  = this.lookupPage( "HomePage")
  homepage.containerPage = context

  var onload = Sw.copyArray( SW.onload)
  this.init_de&&bug( "Preload:", onload.join( '+'))

  var loaded = {}

  function loader(){
    var pagename
    var page
    if( pagename = onload.shift() ){
      if( !loaded[pagename] ){
        loaded[pagename] = true        	      
        page = that.lookupPage( pagename)
        // Preloaded pages are all contained by the "context" page
        if( page != context ){ page.containerPage = context }
        page.read( function( err, page ){
          if( err ){
            that.init_de&&bug( "Err on load:", page) // , ",", err)
          }else{
            that.init_de&&bug( "loaded:", page)
            // AboutWiki also contains a "fetch" list, as a string, 
            if( page == aboutwiki ){
              var more = that.config.fetch
              if( more ){
                that.init_de&&bug( "load more:", more)
                onload = onload.concat( more.split( /\s+/))
              }
            }
          }
          loader.call( that)
        })
      }else{
        loader.call( that)
      }
    }else if( !done ){
      done = true
      // ToDo: Maybe I should store wiki's config in PrivateContext?
      that.processConfig( aboutwiki)
      // Now restore some context from PrivateContext page
      that.restoreContext( context) // null => default name for context page
    }
  }

  context.read( function( err, page ){
    if( !that.parsePrivateContext( page) ){
      that.error( "malformed context:", page)
      that.lookupPage( page.name + "Backup").read( function( err, page){
        if( !that.parsePrivateContext( page) ){
          that.error( "malformed context:", page)
          return loader.call( that)
        }
        context.write( page.getBody(), function( err, page ){
          if( !that.parsePrivateContext( page) ){
            that.error( "malformed context:", page)
          }
          return loader.call( that)
        })
      })
    }else{
      loader.call( that)
    }	    
  })

  that.init_de&&bug( "newWiki:", "built, initializing")
}

// Turn function into a constructor of Wiki objects.
Wiki.prototype = Wiki	// new Wiki() => new_object.__proto__ === Wiki
// Note: If I wished Wiki to be a sub class of say AbstractWiki I
// would do: Wiki.prototype = new AbstractWiki()
MakeDebuggable( Wiki, "Wiki")

Wiki.assertIsWiki = function(){}

Wiki.toString = function(){
// Helps debugging
// Note: I don't use Wiki.prototype.toString = xxx because every Wiki
// object is setup to have the Wiki function/object as prototype
  return "<W:" + (this.fullname() ? " " + this.fullname() : "") + ">"
}

Wiki.isInitializing = function(){
// When a wiki is created, it is not immediately available, it goes
// thru an initializing phase (some important pages are preloaded)
  return this.initializing
}
Wiki.declareIdempotentPredicate( "isInitializing")

Wiki.isResetting = function(){
// Inactive wikis are removed from memory
// Note: shutting down, closing, going down...
  return this.resetInProgress
}
Wiki.declareIdempotentPredicate( "isResetting")

Wiki.getState = function(){
// "initializing" => "operational" => "resetting"
  if( this.isInitializing() )return "intializing"
  if( this.isResetting()    )return "resetting"
  return "operational"
}
Wiki.declareIdempotentGetter( "getState")

Wiki.reset = function( force ){
// Inactive wikis are removed from memory after a while.
// ToDo: Shell script to auto restart
  De&&bug( "Reset ", this)
  if( this.isResetting() && !force ){
    this.context_de&&bug( "reset already scheduled")
    return
  }
  // Move to "resetting" state
  this.resetInProgress = true
  if( this.parentWiki ){
    this.parentWiki.deregisterClone( this)
  }
  if( this.saveContextScheduled ){
    this.context_de&&bug( "reset postpone until context is safe")
    return
  }
  var clonename
  var clone
  // Reset all clones too
  for( clonename in this.allClones ){
    if( clone = this.allClones[clonename] ){
      clone.reset()
    }
    this.allClones[clonename] = null
  }
  // If reset of root wiki, exit process
  if( this.isRoot() ){
    this.de&&bug( "Exit 0")
    process.exit( 0)
  }
  // ToDo: clean more stuff
  // Or let the garbadge collector do it?
  // reset all sessions
  // reset all known pages
}

Wiki.timeoutAutoreset = function( wiki ){
// After enough inactivity, clone wikis are removed from memory
// Static
  if( wiki.isRoot() )return
  if( (Sw.timeNow - wiki.timeLastTouched) > SW.resetDelay ){
    return wiki.reset()
  }
  setTimeout( Wiki.timeoutAutoreset, SW.resetDelay, wiki)
}

Wiki.lookupWiki = function( pathname, cb, depth ){
// Look for a sub/clone wiki using a aaabcc/cccddd/.. pathname
// Create it if needed.
// Note: new wiki is not immediately available, see isInitializing()
// However, when optionnal cb( wiki) is called, initialization is finished.
        
  this.init_de&&bug( "wikiLookup:", pathname)

  // Get rid of trailing /
  if( "/".ends( pathname) ){
    pathname = pathname.substr( 0, pathname.length - 1)
  }
  var ii = pathname.indexOf( "/")
  var basename = null
  var subname = null
  if( ii >= 0 ){
    // ToDo: Should not deal with encoding here
    basename = Wiki.decode( pathname.substr( 0, ii))
    subname  = pathname.substr( ii + 1)
    if( !subname ){ subname = "HomePage" }
    this.init_de&&bug( "lookupBase: ", basename, "sub:", subname)
  }else{
    basename = ""
  }
  
  var that = this
  function callback( cb ){
    // If cb was provided invoke it now or queue it if wiki is initializing
    if( cb ){
      if( that.isInitializing() ){
        // Queued cb will be invoked once context is restored
        that.init_de&&bug( "initializing, queued cb")
        that.queuedRequests.push( {cb: cb, wiki: that})
      }else{
        cb.call( that, that)
      }
    }
  }
  
  depth || (depth = 0)
  depth++
  if( !basename || !subname || depth > 3 ){
    this.init_de&&bug( "found")
    callback( cb)
    return this
  }
  
  var wiki = null
  var clonename
  for( clonename in this.allClones ){
    if( this.allClones[clonename].name == basename ){
      return this.allClones[clonename].lookupWiki( subname, cb)
    }
  }
  
  this.init_de&&bug( "notFound:", basename)
  // Dynamic creation of clones
  if( this.config.canClone ){
    wiki = this.clone( basename).lookupWiki( subname, cb)
  }else{
    wiki = this
    callback( cb)
  }
  return wiki
}

Wiki.lookupPage = function( pagename, default_name ){
// Returns the unique Page object that references said page.
// That does not mean that the page exists on store, just that it is referenced.
// Note: if no name is provided, a random one is generated.
  pagename || (pagename = (default_name || this.random3Code( "-")))
  return Page.lookup( this, pagename, default_name)
}

Wiki.setTestPage = function( name ){
  this.testPages[name] = true
}

Wiki.isTestPage = function( name ){
  return this.testPages[name]
}

Wiki.consumeTestPage = function( name ){
  delete this.testPages[name]
}

Wiki.processConfig = function( config_page ){
// Change config based on data (& proto data) of some config page.
// Each wiki has an "AboutWiki" page that is processed this way.
// Ignores draft changes, use non draft version only.
  if( config_page.isDraft() ){ config_page = config_page.nondraft }
  this.de_config&&bug( "config:", config_page)
  var config_proto
  // Use proto data first (a template typically)
  if( (config_proto = config_page.proto) && config_proto.data ){
    this.setOptions(
      this.config,
      config_proto.data,
      "wiki",
      config_page,
      null	// session
    )
    this.config_de&&bug( "was updated using data in:", config_proto)
  }else{
    this.bug_de&&bug( "BUG? no proto data in:", config_page)
  }
  // Override with page's local data
  this.setOptions(
    this.config,
    config_page.data,
    "wiki",
    config_page,
    null	// session
  )
}

Wiki.setOptions = function( base, options, about, page, session ){
// ! alters the base hash using options.
// This is how I set up a wiki's config.
// There are some possible side effect on the "AboutWiki" page,
// see prefetched & notPrefetched ; when this happends, we are
// dealing with options for a page that is not "AboutWiki" itself.

  options || (options = {})

  function as_bool(){
    var str = val.toString().toLowerCase()
    var bool = str
    && str != "no"
    && str != "false"
    && str != "f"
    && str != "n"
    && str != "0"
    && str != "[]" // angular style
    return val = (bool ? "true" : false)
  }

  function as_int(){
    var ii = parseInt( val.toString(), 10)
    if( isNaN( ii) ){ ii = 0 }
    return val = ii
  }

  function as_str(){
    return val = val.toString()
  }

  function valid( condition ){
    if( !condition ){ ok = false }
    return ok
  }

  function invalid( condition ){
    return valid( !condition)
  }

  //this.deep_config_de&&bug( "Setting options:", Sys.inspect( options))
  var option
  var val
  var ok
  var virtual
  for( option in options ){

    val     = options[option]
    ok      = true
    virtual = false

    // Wiki or user level options
    if( option == "rows" ){
      as_int()
      invalid( val < 5 || val > 200 )

    }else if( option == "cols" ){
      // ToDo: better val for fluid?
      if( val == "fluid" ){ val = "0" }
      as_int()
      invalid( val < 10 || val > 200 )

    }else if( option == "" ){
      as_bool()

    }else if( option == "prefetched" && about == "page" ){
      as_bool()
      if( val && valid( page && session && session.canMentor ) ){
        var list = (this.aboutwikiPage.get( "fetch") || "").split( /\s+/)
        if( list.indexOf( page.name) < 0 ){
          if( SW.wikiword.test( page.name) ){
            this.config_de&&bug( "prefetched:", page.name, "into:", list.join( " "))
            list.push( page.name)
          }
        }
        list = list.sort()
        session.setData( this.aboutwikiPage, "fetch", list.join( " "))
      }

    }else if( option == "notPrefetched" && about == "page" ){
      as_bool()
      if( val && valid( page && session && session.canMentor
        && (page != this.aboutwikiPage && page != this.contextPage))
      ){
        var list = (this.aboutwikiPage.get( "fetch") || "").split( /\s+/)
        if( list.indexOf( page.name) >= 0 ){
          var list2 = []
          for( var ii in list ){
            if( list[ii] == page.name )continue
            // While I am there, I do some validation, cannot hurt much
            if( SW.wikiword.test( list[ii]) ){
              // Filter out duplicates
              if( list2.indexOf( list[ii]) >= 0 )continue
              list2.push( list[ii])
            }
          }
          list2 = list2.sort()
          session.setData( this.aboutwikiPage, "fetch", list2.join( " "))
        }
      }

    }else if( option == "title" ){
      val = Wiki.htmlize( Wiki.sanitizeTitle( val.substr( 0, 32)))

    }else if( option == "style" ){ // see cssStyle

    }else if( option == "lang" ){
      valid( val == "en" || val == "fr" )

    }else if( option == "veryOpen" && about == "wiki" ){
      // ToDo: add a command line option
      if( true || !this.isRoot() ){
        as_bool()
        // If veryOpen then force openness
        if( val ){
          base["open"] = val
        }
      }else{
        // See PrivateRootConfig hack
        this.config_de&&bug( "Cannot change openess of root wiki")
        ok = false
      }

    }else if( option == "open" && about == "wiki" ){
      if( true || !this.isRoot() ){
        as_bool()
        // If closed then force openness
        if( !val ){
          base["veryOpen"] = false
        }
      }else{
        // See PrivateRootConfig hack
        this.config_de&&bug( "Cannot change openess of root wiki")
        ok = false
      }

    }else if( option == "veryOpenClones" && about == "wiki" ){
      as_bool()

    }else if( option == "pureTransientClones" && about == "wiki" ){
      as_bool()

    }else if( option == "canScript" ){
      as_bool()

    }else if( option == "twoPanes" ){
      as_bool()

    }else if( option == "cssStyle" ){
      as_str()
      // ToDo: more sanitization?
      val = Wiki.htmlize( val)

    }else if( option == "meeboBar" ){
      as_str()
      val = Wiki.htmlize( val)
      // ToDo: more sanitization ?

    }else if( option == "oneTrueFan" ){
      as_bool()

    }else if( option == "fbLike" ){
      as_bool()

    // Session level options

    }else if( option == "email"      && about == "user" ){

    }else if( option == "code"       && about == "user" ){

    }else if( option == "User"       && about == "user" ){

    }else if( "aka".starts( option ) && about == "user" ){

    // Wiki level options
    }else if( option == "domain"     && about == "wiki" ){ // ToDo: sanitize

    }else if( option == "path"       && about == "wiki" ){ // ToDo: sanitize

    }else if( option == "home"       && about == "wiki" ){ // ToDo: implement

    }else if( option == "mentorUser" && about == "wiki" ){

    }else if( option == "mentorCode" && about == "wiki" ){

    }else if( option == "debugCode"  && about == "wiki" && this.isRoot() ){

    }else if( option == "adminIps"   && about == "wiki" && this.isRoot() ){

    }else if( option == "noCache"    && about == "wiki" ){
      as_bool()

    }else if( option == "fetch"      && about == "wiki" ){
      if( val instanceof Array ){
        val = val.sort().join( /\s+/)
      }else{
        val = val.split( /\s+/).sort().join( " ")
      }

    // ToDo: support more options
    }else{
      if( !SW.hookSetOptions ){
        ok = false
      }else{
        var hooked = SW.hookSetOption( this, option, val, base)
        if( hooked ){
          ok  = hooked.ok
          val = hooked.val
        }else{
          ok = false
        }
      }
    }

    if( ok ){
      this.config_de&&bug( "set:", about, "option:", option, "val:", val)
      base[option] = val

    }else{

      // "Virtual" short pages
      if( "Page".starts( option) && about == "wiki" ){
        var pagename = option.substr( "Page".length)
        var page = this.lookupPage( pagename)
        if( page == this.contextPage ){
          page.bug_de&&bug( "Remove old experimental context")
          delete base[option]
        }else if( page.isVirtual() ){
          this.config_de&&bug( "virtual page:", option)
          base[option] = val
        }else{
          if( page.wasIncarned() ){
            page.bug_de&&bug( "newly virtual, yet incarned already")
          }
          if( page.wasStored() ){
            page.bug_de&&bug( "newly virtual, yet stored already")
          }
          base[option] = val
          page.containerPage = this.contextPage
        }

      // Invalid
      }else{
        this.config_de&&bug( "invalid:", about, "option:", option, "val:", val)
        // Also remove option from base set if present, cleaning stuff
        delete base[option]
      }
    }
  }
  return base
}

Wiki.sanitizeTitle = function( title ){
// ToDo: this should do nothing if everthing was escaped properly everywhere
  if( !title )return ""
  // ' may interfere with " enclosed HTML attribute values
  // Ditto for "
  // \n would mess the display anyway
  // / and \ for reasons I don't remember
  return title.replace( /['"\n/\\]/g, "")
}

Wiki.getTitle = function( session ){
// Returns the user defined wiki's title, if any.
// For "user" wikis, returns (localized) "Yours", ignoring title
  session || (session = this.protoGuest)
  // ToDo: better title sanitization. Chrome treats ' as if " ...
  var title = Wiki.sanitizeTitle( this.config.title)
  return title || (this.isUserWiki() ? session.i18n( "Yours") : "")
}
Wiki.declareIdempotentGetter( "getTitle")

Wiki.getLabel = function( session, full ){
// Returns either the wiki's title or its name or fullname, for displaying
  return this.getTitle( session)
  || (full ? this.fullname().replace( /\/$/, "") : this.name)
}
Wiki.declareIdempotentGetter( "getLabel")

Wiki.getRoot = function(){
// Return the root wiki, other wikis are clone children
  return this.parentWiki ? this.parentWiki.getRoot() : this
}
Wiki.declareIdempotentGetter( "getRoot")

Wiki.getAllPages = function(){
  var list = []
  for( var item in this.allPages ){
    list.push( this.allPages[item])
  }
  return list
}

Wiki.isRoot = function(){
// True if not a child wiki (ie, has no parent)
// There is only one such wiki, aka TheRootWiki
  return !this.parentWiki
}
Wiki.declareIdempotentPredicate( "isRoot")

Wiki.isTopLevel = function(){
// Child wikis of the Root wiki are top level wikis
// "user" is a special top level wiki that containt "User" wikis, ie
// the wiki associated to the unique oid of local users.
  return !!(this.parentWiki && this.parentWiki.isRoot())
}
Wiki.declareIdempotentPredicate( "isTopLevel")

Wiki.isUserWiki = function(){
// Each user has her "own" wiki, named using a random 3 code oid.
// that wiki is located under the /user/ path
// User wikis are there just to track the wikis that the user
// is member of, so that she can get back to them easely
  // ToDo: cache in data member at creation
  return !!(this.parentWiki
  && this.parentWiki.isTopLevel()
  && (this.parentWiki.name == "user"))
}
Wiki.declareIdempotentPredicate( "isUserWiki")

Wiki.trackUserLabel = function( service_id, user_label ){
// Remembers the "user label" for a twitter or facebook id.
// That user label is usually the "full name".
// Note: the service id shall include the @ sign, ie "@jhr"
  user_label = Wiki.sanitizeName( user_label)
  if( this.allUserLabelsById[service_id] != user_label ){
    this.allUserLabelsById[service_id] = user_label
    this.allUserLabels.push( {id: service_id, label: user_label})
  }
}

Wiki.findUserLabel = function( service_id ){
// Returns the "user label" associated to some twitter or facebook id or name.
// Note: service_id shall include @ sign, ie "@jhr"
  var found = this.allUserLabelsById[service_id]
  if( found )return found
  if( this.isRoot() )return ""
  found = this.parentWiki.findUserLabel( service_id)
  if( !found )return ""
  // In production I don't want to accumulate too many labels
  if( false && this.isRoot() )return false
  // Remember the user label at this wiki level, self contained
  this.trackUserLabel( service_id, found)
  return found
}

Wiki.getAllUserLabels = function(){
// Return the array of {id:xx,label:zz} of known id/label pairs
  return this.allUserLabels
}

Wiki.isPremium = function(){
  return this.config.premium
}

Wiki.fullname = function( root, no_terminator ){
// Returns fullname, including all parents, "/" terminated.
// Root wiki's fullname is always "" unless "root" parameter says otherwise
// ToDo: should root's fullname be "/" ?
  if( this.isRoot() )return (root || "")
  return this.parentWiki.fullname() + this.name + (no_terminator ? "" : "/")
}
Wiki.declareIdempotentGetter( "fullname")

Wiki.shortname = function(){
// Returns "" or wiki's name if wiki is not a top level wiki
  return this.parentWiki && !this.parentWiki.isRoot()
  ? this.name
  : ""
}
Wiki.declareIdempotentGetter( "shortname")

Wiki.clone = function( wikiname ){
// Create a child wiki
  var clone = new Wiki( this, wikiname)
  this.init_de&&bug( "Register clone ", wikiname)
  this.allClones[wikiname] = clone
  return clone
}

Wiki.deregisterClone = function( clone ){
// Called by .reset() on clone, removes clone from list of clone
  if( this.allClones[clone.name] != clone ){
    this.bug_de&&bug( "Already re initialized?")
    return false
  }
  this.de&&mand( this.allClones[clone.name] == clone )
  delete this.allClones[clone.name]
}

Sw.log = Fs.createWriteStream( "error.txt", {flags:"a"})
Sw.log.write( "\n\nRestart\n")

Wiki.error = function(){
// ToDo: Log error on wiki
// ToDo: this code is untested and incomplete
  this.countErrors++
  if( this.parentWiki ){
    this.parentWiki.signalChildError( this)
  }
  if( !this.allErrors ){
    this.allErrors = []
  }
  var limit = De ? 10 : 100
  if( this.allErrors.length == limit - 1 ){
    this.allErrors.unshift( {timestamp: Sw.timeNow, msg: "Too much!"})
  } else{
    var list = []
    for( item in arguments ){
      list.push( arguments[item])
    }
    list = list.join( "-")
    De&&bug( "ERROR: ", list)
    if( this.allErrors.length < limit ){
      this.allErrors.unshift( {timestamp: Sw.timeNow, msg: list})
    }
    // Append to file error.txt in current directory
    Sw.log.write( Sw.dateNow.toISOString() + " " + list)
    // ToDo: use some "logging" service, like loggly for example
    // See https://github.com/nodejitsu/node-loggly
  }
}

Wiki.warning = function(){
// ToDo: Log warnings
  this.error.apply( this, arguments)
}

Wiki.signalChildError = function( child_wiki ){
  this.countErrors++
  if( !this.allSignaledWikis ){
    this.allSignaledWikis = {}
  }
  this.allSignaledWikis[child_wiki] = child_wiki
}

Wiki.clearChildError = function( child_wiki ){
  if( !this.allSignaledWikis )return
  delete this.allSignaledWikis[child_wiki]
}

Wiki.getAllSignaledWikis = function(){
  if( !this.allSignaledWikis )return []
  var a = []
  for( item in this.allSignaledWikis ){
    a.push( item)
  }
  return a
}
Wiki.declareIdempotentGetter( "getAllSignaledWikis")

Wiki.errorQueueLength = function(){
  if( !this.allErrors )return 0
  return this.allErrors.length
}
Wiki.declareIdempotentGetter( "errorQueueLength")

Wiki.pullError = function(){
// ToDo: get/remove older error message
  if( !this.allErrors )return null
  var err = this.allErrors.shift()
  if( !err ){
    if( this.parentWiki ){
      this.parentWiki.clearChildError( this)
    }
  }
  return err
}

Wiki.timeoutProcessHttpRequest = function( wiki, req ){
// Helper to invoke .processHttpRequest using setTimeout()
// This is usefull for queued requests against a wiki that is resetting
  return wiki.processHttpRequest( req)
}

Wiki.processHttpRequest = function( req ){
// This method is called by the HTTP server when it handles a request.
// Returns false if path is not about a wiki.
// Returns "index.html" when cannot comeback.
//
// When processing a request, I look at the url.
// If it contains a ?cid query parameter then it means that the link was
// (probably) built by the wiki engine while a user was browsing a wiki.
// In that later case, I invoke the function that was registered for that
// purpose.
// Else, I login the user in a new session unless some cookie says differently

  // This function may be called multiple time for the same requests when
  // the "target wiki" is created "on the fly". That's because the wiki is not
  // immediately available, it goes thru an initialization sequence. As a
  // consequence, the request is queued and is processed again when the wiki
  // becomes ready. The same situation occurs when a request is received while
  // the target wiki is resetting. In that case it needs to be reloaded right
  // after it's reset is complete (there is no way to "interrupt" a reset)
  var queued = req.queued
  if( queued ){
    this.http_de&&bug( "reprocessHttpRequest, R:", req.deId)
  }else{
    this.countHttpRequests++
    if( De ){
      this.http_de&&bug( "-----------------\n")
      MakeDebuggable( req)
      req.setDeId( ++Sw.requestId)
    }
  }

  var parsedurl = Url.parse( req.url)
  var pathname = parsedurl.pathname || ""

  this.http_de&&bug( "HTTP:", req.method, "R: ", req.deId,
    "url:", Sys.inspect( req.url), "path:", pathname)
  
  // If wiki is resetting, I can't handle the request, not safe, I queue it
  if( this.isResetting() ){
    // ToDo: I should queue the request somehow I guess, rare, I just replay
    this.init_de&&bug( "Can't handle request while resetting, R:", req.deId)
    if( !this.isRoot() ){
      req.queued = true
      // I will retry in two seconds, in a brand new wiki instance
      setTimeout( Wiki.timeoutProcessHttpRequest, 2000, this.getRoot(), req)
      return true
    }else{
      // When the root wiki is resetting... exit() is near, no need to process
      return false
    }
  }

  // Fix weird encoding
  // ToDo: is this a good idea?
  pathname = decodeURIComponent( pathname)
  
  // static files are not for me (including fake with.google)
  if( /\.(html|png|svg|txt|css|js|json|google)$/.test( pathname) ){
    // embed.js is an exception
    if( "embed.js".ends( pathname) ){
      this.de&&bug( "embed.js")
      pathname = pathname.replace( /embed.js$/, "EmbedJs")
      req.embedjs = true
    }else{
      this.static_de&&bug( "file:", pathname)
      return false
    }
  }

  // Filter out bad names, no space allowed, robot probably
  if( false && pathname.includes( " ") ){
    this.static_de&&bug( "space in path:", pathname)
    return false
  }
  
  // Check for bots
  // ToDo: Figure out what are legitimate robots, per wiki maybe
  if( false && this.isBotRequest( req) ){
    this.bot_de&&bug( "Robotic request, ignore")
    return false
  }

  // ToDo: restore / at end of path?
  
  var query = QueryString.parse( parsedurl.query)
  this.deep_http_de&&bug( "query:", Sys.inspect( query))
  this.deep_http_de&&bug( Sys.inspect( req.headers))
  this.deep_http_de&&bug( "host:" + req.headers.host)
  
  // Time the request. I monitor long requests (it's broken, ToDo: rm)
  Sw.setTimeNow()
  if( !queued ){ req.timeReceived = Sw.timeNow }
  
  // Handle some static routes, /rest & /oembed
  if( pathname == "/oembed" ){
    return this.processOembedRequest( pathname, query, req)
  }else if( "/rest/".starts( pathname) ){
    return this.processRestRequest(   pathname, query, req)
  }
  
  try {
    // This code is closure based, ie session state is stored in memory
    var closure = this.getClosure( query.cid)
    // If no closure, figure out something
    if( !closure ){
      // rest/ is for REST requests. ToDo: implement them!
      // Note: this is for requests that are not bound to a specific session
      // because no valid ?cid was provided.
      // When a valid session is provided, .rest() is invoked for that session
      if( "/rest".starts( pathname) ){
        // Flag as "rest" so that respond() does not redirect on POST
        req.isRest = true
        // If "anonymous" client
        if( !query.cid ){
          this.rest_de&&bug( "REST anonymous request, R:", req.deId)
          // Delegate to prototypal guest session of this wiki
          closure = this.getRestClosure()
        // If weird cid, err?
        }else{
          // Delegate to prototypal guest session of root wiki
          closure = this.getRoot().getClosure(
            this.protoGuest.restClosure,
            true // true => Don't mind if session was logged out
          )
        }
      // If not rest, I need to figure out a Session to handle the request
      }else{
        closure = this.lookupSession( pathname, query, req)
      }
      if( closure === false ){
        this.login_de&&bug( "Not a login, R:", req.deId, "pathname:", pathname)
        return false
      }else if( closure === "index.html" ){
	this.protoGuest.redirect( req)
	return false
      }
    }
    // OK, I probably get a closure, let's invoke it
    // Switch to debug mode for session if &debug=xxx valid query parameter
    if( De 
    && closure
    && query.debug
    && (query.debug == this.getRoot().config.debugCode || SW.test)
    ){
      if( !closure.session.isDebug ){
        this.de&&bug( closure.session, "setDebug")
        closure.session.isDebug = true
        closure.session.setDeId( closure.session.id)
      }
    }
    this.invokeClosure( closure, req )
    return true
  }catch( err ){
    De&&bug( Sys.inspect( err))
    this.error( "Error ", Sys.inspect( err))
    if( De ){
      throw err
    }
  }finally{
    // Monitor long requests. ToDo: does not work as is
    if( false && req.timeReceived ){
      Sw.setTimeNow()
      var how_long = Sw.timeNow - req.timeReceived
      if( how_long > 5 && how_long > this.durationLongestRequest ){
        this.monit_de&&bug( "Longest request so far: ", req.deId)
        if( De || how_long > 100 ){
          this.error( closure ? closure.session : this,
            ", longRequest: ", how_long, " msec",
            ", url: ", Sys.inspect( parsedurl),
            ", headers: ", Sys.inspect( req.headers)
          )
        }
        this.durationLongestRequest = how_long
      }
    }
  }
}

Wiki.processOembedRequest = function( path, query, req ){
// As per http://www.oembed.com/
// URL scheme: http://*.simpliwiki.com/*
// API endpoint: http://simpliwiki.com/oembed/
// We got here from processHttpRequest() because path is /oembed
  var that = this
  this.de&&bug( "oembed, query:", Sys.inspect( query))
  var url = query.url
  var maxwidth  = query.maxwidth  || "320"
  if( maxwidth == "0" ){ maxwidth = 0 }
  var maxheight = query.maxheight
  if( maxheight == "0" ){ maxheight = 0 }
  var format    = query.format    || "json"
  var callback  = query.callback  || query.jsonp
  if( ".json".ends( url) ){
    format = "json"
    url = url.substr( 0, url.length - ".json".length)
  }else if( ".xml".ends( url) ){
    url = url.substr( 0, url.length - ".xml".length)
  }
  var mime = (format == "json") ? "application/json" : "text/xml"
  var data = {}
  data.type          = "rich"
  data.version       = "1.0"
  data.provider_name = SW.name
  data.provider_url  = SW.protocol + SW.domain
  data.width         = maxwidth
  data.height        = maxheight
  // Avoid some urls
  if( /http:\/\/secret\..*/.test( url) ){
    this.de&&bug( "oembed, secret:", url)
    data.html = this.wiki.random3code()
    return send( data)
  }
  if( /^.*\.com\/?$/.test( url) ){
    this.de&&bug( "oembed, nopage:", url)
    data.html = url
    return send( data)
  }
  // Force maxheight if iframe, unless already specified
  if( /^http:\/\/iframe\./.test( url) ){
    if( !maxheight ){ maxheight = 480 }
  }
  // If maxheight is specified, I provide an iFrame
  if( maxheight ){
    // Add iframe pseudo host if not present, so target knows it is iframed
    if( url.indexOf( "//iframe." < 0) ){
      url = url.replace( "http://", "http://iframe.")
    }
    this.de&&bug( "oembed, iframe:", url)
    data.html
    = '<iframe src="' + url   + '"'
    + ' width="'  + maxwidth  + '"'
    + ' height="' + maxheight + '"'
    + ' border="0" style="border:none;"'
    + ' allowTransparency="true"'
    + '></iframe>'
    return send( data)
  }
  // If no max height, I provide a big div
  // Note: it is not currently possible to include more than one wiki this way
  var mock = new MockRequest()
  mock.oembed   = true
  // Add embed pseudo domain if not present, so target knows it is embedded
  if( url.indexOf( "//embed.") < 0 ){
    url = url.replace( "http://", "http://embed.")
  }
  // Extract host part of url to fill "HOST" header
  url = url.replace( "http://", "")
  var ii = url.indexOf( "/")
  if( ii < 1 ){
    data.html = url
    return send( data)
  }
  var host = url.substr( 0, ii)
  url = url.substr( ii + 1)
  mock.url = url
  mock.headers.host = host
  mock.response = mock
  mock.addListener( 'send', function(){
    data.html = mock.writeData
    send( data)
  })
  this.processHttpRequest( mock) 
  function send( data ){
    if( format = "json" ){
      data = JSON.stringify( data)
      if( callback ){
        data = callback + "(" + data + ")"
      }
    }else{
      buf = [
        '<?xml version="1.0" encoding="utf-8" standalone="yes"?>',
        '<oembed>'
      ]
      for( var key in data ){
        buf.push(
          "<" + key + ">"
          + this.protoGuest.htmlize( data[key])
          + "</" + key + ">"
        )
      }
      buf.push( '<oembed>')
      data = push.join( "\n")
    }
    that.protoGuest.respond( req, data, mime, true) // true => nocookies
    return true
  }
  return true
}

Wiki.processRestRequest = function( path, query, req ){
// We got here from processHttpRequest because path starts with /rest/
  return false
}

Wiki.invokeClosure = function( closure, req ){
  if( !closure ){
    this.bug_de&&bug( "R:", req.deId, "closure:none yet", "url:", req.url)
    return
  }
  // Attach session and request
  var session = closure.session
  req.session = session
  session.req = req
  if( De ){
    Sw.currentSession = session
  }
  // ToDo: this should be somewhere else, ie where name changes
  this.allSessionsByName[session.userName()] = session
  session.touch()
  // Inside the closure, This is the request to handle
  // ToDo: maybe I could req.closure = closure
  closure.call( req, session, closure)
}
  

Wiki.isClosed = function(){
// Closed wikis require membership to access "normal" pages
// "User" wikis are always closed
  return !this.config.open || this.isUserWiki()
}
Wiki.declareIdempotentPredicate( "isClosed")

Wiki.isOpen = function(){
// Open wikis allow guest access to "normal" pages
  return !this.isClosed()
}
Wiki.declareIdempotentPredicate( "isOpen")

Wiki.isVeryOpen = function(){
// Very open wikis let members auto register, no prior mentor is needed
  return this.isOpen() && this.config.veryOpen
}
Wiki.declareIdempotentPredicate( "isVeryOpen")


Wiki.isVeryOpenByDefault = function(){
  if( !this.isVeryOpen() )return false
  var config = this.lookupPage( "AboutWiki")
  if( config.proto && config.proto.name == "PrivateWiki" ){
    return true
  }
  return false
}
Wiki.declareIdempotentPredicate( "isVeryOpenByDefault")


Wiki.logUser = function( session ){
// Called whenever a user logs in

  session.wiki_de&&bug( "logUser, W:", this)
  De&&mand( session.wiki == this )
  
  // Associate session with login code
  if( true ){
    if( session.loginCode ){
      if( !this.allSessionsByCode[session.loginCode] ){
      }
      session.login_de&&bug( "logCode:", session.loginCode)
      this.allSessionsByCode[session.loginCode] = session
      De&&mand( session.wiki == this, "bad session.wiki")
    }
  }
  
  // If member
  if( !session.isGuest() ){
    session.login_de&&bug( "logMember:", session.loginName)
    if( !this.allLoginNames[session.loginName] ){
      this.countMembers++
    }  
    this.allLoginNames[session.loginName] = true
    // If same user already logged in, restore context
    var old = this.allSessionsByName[session.loginName]
    if( old && old != session && old.wiki == this && !old.isGuest() ){
      if( !old.isGone ){
        session.login_de&&bug( "Restore session:", old) 
        session.restoreSession( old)
      }else{
        session.login_de&&bug( "comingBack:", session.loginName)
        // old.logout( "relog")
      }
    }
    this.allSessionsByName[session.userName()] = session

  // If guest
  }else{
    session.login_de&&bug( "logGuest:", session.userName())
    this.allSessionsByName[session.userName()] = session
  }

  // "Follow" stuff
  if( !session.isBot ){
    this.lastSession = session
    this.lastLogin   = session
    if( session.isGuest() ){
      this.lastGuestLogin = session
    }else{
      this.lastMemberLogin = session
    }
  }

  //session.trackUser()
}

Wiki.logAuthenticUser = function( session ){
// This method gets called when a User object is bound to the session.
// This happens in Session.userFoundEvent() due to some previous call
// to Session.trackUser().
// Each User has a unique id, the "id code" (aka "owner code").
// This method updates global data so that further call to getUserById()
// will retrieve the user, given an id.
// It also get rid of the draft code if any.
  var id = session.user.getId()
  this.allUsersById[id]    = session.user
  this.allSessionsById[id] = session
  // Also at root level
  if( !this.isRoot ){
    this.getRoot().logAuthenticUser( session)
  }
  // If member was given a random code, she can as well use her own id
  var code = session.loginCode
  if( !session.loginWithCode
  && "F3".starts( code)
  && (code.length == "F3xxxxxxxx".length)
  ){
    session.setLoginCode( id)
  }
}

Wiki.lookupUser = function( session ){
// Given a session, try to retrieve it's User object
// Side effect: memorize it
  
  var that = this

  // Nothing to do is already done
  if( session.user )return session.user

  // Does the loginCode help us?
  var user = this.allUsersById[session.getIdCodeId( session.loginCode)]
  if( user ){
    session.login_de&&bug( "Found user using loginCode")
    return user
  }

  // Let's try using the "authentic" names
  var all_pages = this.allPages
  function check( service, id ){
    if( !id )return null
    var page = all_pages[service + "Id" + id]
    that.de&&mand( !page || !page.localUser || page.localUser.isLocal )
    return page && page.localUser
  }

  user = (
     check( "Twitter",  session.twitterName)
  || check( "Twitter",  session.twitterId)
  || check( "Facebook", session.facebookName)
  || check( "Facebook", session.facebookId)
  || check( "LinkedIn", session.linkedindName)
  || check( "LinkedIn", session.linkedinId)
  || (this.dropbox && this.dropbox.token 
    && check( "Dropbox", this.dropbox.token))
  )

  if( user ){
    this.login_de&&bug( "Found user using an authentic name")
    this.de&&mand( user.isLocal )
    session.user = user
    return user
  }
  
  // Try with root also
  return this.isRoot ? null : this.getRoot().lookupUser( session)

}


Wiki.logout = function( session ){
// Called whenever a user is logged out
  session.wiki_de&&bug( "logout, W:", this)
}

Wiki.isKnownUser = function( name ){
// Returns true if user previously logged in
  return this.allLoginNames[name]
}

Wiki.getSession = function( name ){
// Get session associated to user's login name
  return this.allSessionsByName[name]
}

Wiki.timeoutCheckGoneSession = function( session ){
// This static method checks if a session shows some activity, if it does not
// then the session is logged out
// This method is called once when the session is created, then it calls
// itself, with a delay, as long as the session is still active
// ToDo: should be a Session method, not a Wiki method
  session.isAway()
  // Reschedule unless session is gone
  if( !session.isGone ){
    setTimeout( Wiki.timeoutCheckGoneSession, SW.awayDelay, session)
  }
}

Wiki.decode = function( str ){
// onxxxx becomes #xxx
  if( !str ) return str
  var ii
  var path = ""
  if( (ii = str.lastIndexOf( "/")) >= 0 ){
    path = str.substr( 0, ii + 1) + "/"
    str = str.substr( ii + 1)
  }
  if( "on_".starts( str) ){
    page = "#" + Wiki.decode( str.substr( "on_".length))
  }
  return path + str
  if( "at_".starts( str) ){
    str = "@" + wiki.decode( str.substr( "at_".length))
  }else if( "_at_".starts( str) ){
    str = Wiki.decode( str.substr( '_at_'.length)) + "@"
  }else if( "in_".starts( str) ){
    str = Wiki.decode( str.substr( 'in_'.length)) + "In"
  }else{
    str = decodeURIComponent( str)
  }
  return path + str
}

Wiki.encode = function( pagename ){
// #xxxx becomes onxxxx
  // Twitter hashtag
  if( '#'.starts( pagename) ){
    pagename = 'on' + Wiki.encode( pagename.substr( 1))
  }
  return pagename
  // Twitter username
  if( '@'.starts( pagename) ){
    pagename = 'at_' + Wiki.encode( pagename.substr( "@".length))
  // Facebook username
  }else if( '@'.ends(   pagename) ){
    pagename = '_at_' + Wiki.encode(
     pagename.substr( 0, pagename.length - "@".length)
   )
  // LinkedIn username
  }else if( 'In'.ends(   pagename) ){
    pagename = 'in_' + Wiki.encode(
      pagename.substr( 0, pagename.length - "In".length)
    )
  }else{
    pagename = encodeURIComponent( pagename)
  }
  return pagename
}

Wiki.encodePath = function( list ){
// Encode in a format where path is made of valid characters.
  var buf = []
  for( var ii in list ){
    buf.push( Wiki.encode( list[ii]))
  }
  var result = proto + buf.join( "/")
  return result
}

Wiki.decodePath = function( path ){
// Decode from the format used to encode, typically from a GET's path
// Get rid of front and last potential /
// Note: I don't expect http:// nor ? query parameters
// Returns a list
  var list = path.split( "/")
  var buf = []
  for( var ii in list ){
    buf.push( Wiki.decode( list[ii]))
  }
  return buf
}

Wiki.codeCookieName = function( prefix ){
// Build name of code cookie, depends on wiki's fullname
// ToDo: signed cookies, https://github.com/jed/cookie-node
  // Encode _ into __ et / into _
  // minor bug: both _/ and /_ becomes ___, both __ and /_/ become ____, etc
  // ToDo: use encodeURIComponent()
  prefix || (prefix = "code")
  return "sw_" + prefix + encodeURIComponent(
    this.fullname().replace( /_/g, "__").replace( /\//g, "_")
  )
}
Wiki.declareIdempotentGetter( "codeCookieName")


// ---------------------
// section: wikilogin.js

Wiki.lookupSession = function( path, query, req ){
// This function is called by processHttpRequest() when
// a potentially "new" user visits a page (ie, no valid cid closure in query).
// It returns a closure if it manage to retrieve one or if a brand new Session
// was started.
// It returns false if this is a not a request for a wiki (ie static file).
// It returns "index.html" when path is "/comeback" but there is no cookie.
// It returns null if further processing (async) is engaged.
// That later case occurs when a wiki is created "on the fly". Once the wiki
// is created, processHttpRequest() is automatically re-entered in order to
// complete the processing of the request.

  // There is already a session attached when a parent wiki did some login
  var session = req.session
  
  // Some traces in that case
  if( De && session ){
    session.login_de&&bug( "Rid:", req.deId, "lookupClone:", path)
    if( session.wiki != this ){
      session.login_de&&bug(
        "login in new sub wiki, sourceWiki:", session.wiki
      )
    }else{
      session.bug_de&&bug( "BUG? already logged, why?")
    }
  }else{
    this.deep_login_de&&bug( "Rid:", req.deId, "sessionRootLogin:", path)
  }

  // First I try to figure out what is the target wiki
  // Then I look for cookied code and associated session
  // If no valid session, I create a new one to log the user in
  
  // Handle virtual hosting for Wiki pages
  var custom    = false
  var subdomain = ""
  if( session ){
    // Don't recompute if done by parent wiki
    subdomain = session.subdomain
    custom    = session.custom
  }else{
    var host = req.headers.host // This is the target host
    if( host
    && SW.domain
    && host != SW.domain
    && !(/^[\d.]+$/.test( host)) // Not with numerical ip addresses
    ){
      this.login_de&&bug(
        "host:", host,
        "SW.domain:", SW.domain,
        "path:", path
      )
      // If target host is subdomain of configured domain
      if( SW.domain.ends( host) ){
        // Extract the subdomain part
        subdomain = host.substr(
          0,
          host.length - SW.domain.length
        )
        subdomain = subdomain.split( ".")
        subdomain = subdomain.reverse().join( "/") + "/"
        if( subdomain == "/" ){
          subdomain = ""
        }else{
          // ie "/somedomain/"
          this.login_de&&bug( "subdomain:", subdomain)
          req.subdomain = subdomain
        }
      // If target host is a whole different beast, custom domain
      }else{
        if( host.indexOf( ":") < 0 && !"localhost".starts( host) ){
          // I turn xxx.yyy.top into top_yyy_xxx/
          subdomain = host.split( ".").reverse().join( "_") + "/"
          // If SW.domain pseudo host, get rid of it, implicit
          var local_domain = SW.domain.split( ".").reverse().join( "_")
          if( local_domain.starts( subdomain) ){
            subdomain = subdomain.substr(
              0,
              subdomain.length - local_domain.length
            )
          }
          // Special treat for .com domain
          if( "com_".starts( subdomain) ){
            subdomain = subdomain.substr( "com_".length)
          }
          custom = true
          this.login_de&&bug( "custom, subdomain:", subdomain)
          req.custom = subdomain
          // See robots.txt handling, crawling is ok for custom domains only
        }
      }
    }
    // Handle "new" & "secret" pseudo domains, redirect to random wiki
    if( subdomain == "/new/" || subdomain == "/secret/" ){ // ToDo: i18n
      this.login_de&&bug( "Redirect to new random wiki")
      this.protoGuest.redirect(
        req,
        SW.protocol + SW.domain + (SW.test ? ":" + SW.port : "")
        + "/" + this.random3Code( "-")
      )
      return false
    }
    // Handle "embed" & "iframe" pseudo domains
    if( /_?embed\/$/.test(  req.subdomain)
    ||  /_?iframe\/$/.test( req.subdomain)
    ){
      req.iframe    = req.subdomain.includes( "iframe/")
      req.oembed    = req.subdomain.includes( "embed/")
      req.subdomain = req.subdomain
      .replace( /_?iframe/g, "")
      .replace( /_?embed/g, "")
      .replace( "//", "")
      if( req.iframe ){
        this.de&&bug( "iframed, subdomain:", req.subdomain, "path:", path)
      }
      if( req.oembed ){
        this.de&&bug( "oembed, subdomain:", req.subdomain, "path:", path)
      }
      subdomain = req.subdomain
    }
  } // end of virtual hosting handling
  
  NDe&&bug( "Referrer: " + (req.headers.referrer || req.headers.referer))
    
  // Handle special encoded # prefix
  var wikipath = Wiki.decode( path)
  wikipath = (subdomain + path).replace( "//", "/")
  this.deep_login_de&&bug( "wikipath:", wikipath)
  wikipath = this.sanitizePath( wikipath)
  De&&mand( wikipath !== null ) // Seen once
  this.deep_login_de&&bug( "saneWikipath:", wikipath)
  
  // For subdomains, defaults to home page, instead of index.html
  if( subdomain && ("/" + wikipath + "/") == subdomain ){
    wikipath += "/HomePage"
  }

  var page = wikipath
  this.login_de&&bug( session || this, "loginPage:", page)
  
  // Look for wiki/page in cookies if /comeback or /in
  // simpliwiki.com/comeback "relogs" the user where she was
  // whereas simpliwiki.com/in logs the user out of all known wikis
  var cookies = req.headers.cookie
  if( cookies && (page == "comeback" || page == "in") ){
    this.cookie_de&&bug( "cookies:", cookies)
    var cookied_page
    var match = cookies.match( /sw_page=[^;]*/)
    if( match ){
      cookied_page = match[0].substr( "sw_page=".length)
      this.cookie_de&&bug( "cookiedPage:", cookied_page)
      if( page == "in" ){
        this.login_de&&bug( "hard logout")
        page = cookied_page.replace( /[^\/]*$/, "DoByeBye")
      }else{
        page = cookied_page
      }
    // ToDo: I should "redirect" to index.html
    }else if( page == "in" ){
      return false
    }else if( page == "comeback" ){
      return "index.html"
    }
  }
  
  // Query specified page overrides the url or cookie
  if( query && query.page ){
    page = this.sanitizePath( query.page)
    this.login_de&&bug( session || this, "queryPage:", page)
  }
  // Facebook specific. I don't know what it is about
  if( query && query.fb_page_id ){
    page = "fbpage/id" + query.fb_page_id + "/HomePage"
  }
  
  // Debug? debug cookie's (or query param) must match config defined value
  var is_debug = false
  var configdebug = this.getRoot().config.debugCode
  if( query && query.debug ){  
    this.login_de&&bug( "debugQuery:", query.debug, "debugConfig: ", configdebug)
    is_debug =  !configdebug || query.debug == configdebug
  }else if( cookies ){
    var cookied_debug
    var match = cookies.match( /sw_debug=[^;]*/)
    if( match ){
      cookied_debug = match[0].substr( "sw_debug=".length)
      this.cookie_de&&bug( "cookiedDebug:", cookied_debug)
      is_debug =  !configdebug || cookied_debug == configdebug
      if( !is_debug ){
	this.login_de&&bug( "no debug, debugConfig:", configdebug)
      }
    }
  }

  // index.html if no better page was found
  if( !page )return false

  // Filter out some erroneous requests
  if( /\/in\/|\/rest\/|\/comeback\//.test( "/" + page + "/") ){
    return false
  }
 
  // Extract base name, after last / if any, that's a page name inside a wiki
  var basename = ""
  var ii = page.lastIndexOf( "/")
  if( ii >= 0 ){
    basename = page.substr( ii + 1)
  }else{
    basename = page
  }
  basename = Wiki.decode( basename)
  this.login_de&&bug( "page:", page, "basename:", basename)

  // If basename is special "secret", create a new wiki
  if( basename == "secret" ){
    // I attach a secret to the request to retrieve it once wiki is created
    basename = req.secret || (req.secret = this.random3Code( "-"))
    page = page.replace( /secret$/, basename)
  }

  // If basename isn't a Wikiword, assume its the name of a wiki, add HomePage
  // Idem if page is a Twitter, Facebook & co screen name
  // Note: for linkedin, it's the screen name + "in" (in lowercase)
  // Idem if fbgroup/ or fbpage/ prefix
  // Idem for user/ prefix
  // Idem for two letters country code
  // Idem if full path is all lower case (works for 3 codes)
  if( basename
  && (!SW.wikiword.test( basename)
    || ( page == basename
      && (
          (("@".starts( basename) || "@".ends( basename))
          && (basename.toLowerCase() == basename))
        || (
          "in".ends( basename)
          && (basename.toLowerCase()
            == basename.substr( 0, basename.length - 2) + "in")
        )
      ))
    || page == "fbgroup/" + basename
    || page == "groups/"  + basename	// facebook groups
    || page == "fbpage/"  + basename
    || page == "pages/"   + basename	// facebook pages
    || page == "user/"    + basename	// local users
    || ((page.length == basename.length + 3) // fr/ is 3 chars long
      && !"c2".starts( page)
      && basename.toLowerCase() == basename)
    || (  page == basename		// 3 codes probably
      && basename.toLowerCase() == basename
      && !basename.includes( "[")
      && !basename.includes( "_")
      && !basename.includes( "."))
    )
  ){
    this.login_de&&bug( "basename is wiki:", basename, "page:", page)
    // Get rid of starting @ from Twitter
    // Note: security issue, ie one can create a twitter account to
    // become the "owner" of an existing wiki. But it's convenient.
    // Also convert to lowercase, needed for virtual hosting
    basename = basename.replace( /^@/, "").toLowerCase()
    if( ii >= 0 ){
      page = page.substr( 0, ii + 1) + basename + "/HomePage"
    }else{
      page = basename + "/HomePage"
    }
    basename = "HomePage"
  }

  // Look for target wiki based on page's name with path in it (or session's)
  var done = false
  var once = false
  var query_code = false
  while( !done ){ // I loop only when /comeback lead to an invalid session
  done = true
  var wiki = session ? this : (page ? this.lookupWiki( page) : this)
  page = basename
  
  // If the wiki is initializing, I must queue the request
  if( wiki.isInitializing() ){
    wiki.login_de&&bug( session, "initializing, postpone request")
    req.queued = true
    wiki.queuedRequests.push( {req: req, wiki: this})
    // I return "null", a special value that means "please do nothing yet"
    return null
  }
  
  var code = ""
  // If session was processed by parent wiki
  if( session ){
    // I login with the same code if it worked, ie child inherit from parent
    if( !session.isGuest() && !session.isAnonymous() ){
      code = session.loginCode
      session.loginLog( "inherit Code" + code)
    }
    // Else I will login using a code cookie named after the wiki's name
  }

  // If no code known so far, try to find one in request
  if( !code ){
  
    // Look for code, in query parameters first
    var code = ""
    if( query && query.code ){
      code = query.code
      query_code = true
      this.login_de&&bug( "queryCode:", code)
    }
    // next try is in page name
    if( !code
    && "code".starts( page.toLowerCase()) ){
      code = page.substr( "code".length).replace( "Mentor", "")
    }
    NDe&&bug( "Host: " + req.headers.host)
    NDe&&bug( "Referrer: " + (req.headers.referrer || req.headers.referer))
    // next try is in cookies
    if( !code && req.headers.cookie ){
      // I look for a cookie whose name depends on the wiki's name
      // ie, there exist typically one cookie per wiki the user is connected to
      var match = cookies.match( 
        new RegExp( wiki.codeCookieName() + "=[^;]*")
      )
      if( match ){
        code = match[0].substr( (wiki.codeCookieName() + "=").length)
        this.login_de&&bug( "cookieCode:", code)
      // If not found...
      // If root wiki, look for some sub wiki code (last one)
      // but only if /comeback special page was asked for, once only
      }else if( !once
      && page == "comeback"
      && wiki.isRoot()
      && (match = cookies.match( /sw_code([^=]+)=([^;]*)(?!; sw_code)/))
      ){
        page = match[1]
        page = decodeURIComponent( page)
        // ToDo: DRY this
        .replace( /^com_/, "")
        .replace( /_/g, "/")    // _ means / in original
        .replace( /\/\//g, "_") // __ means _ in original
        .replace( /\/$/, "/HomePage")
        code = match[2]
        this.login_de&&bug( "otherWikiCode:", code, "wiki:", page)
        // Will lookup wiki again, unless there is a session for this code
        done = false
        once = true
      // If no local code for this wiki, try last global code
      // but do it as a last chance, ie not when twitter or facebook id
      // ToDo: is this still usefull?
      }else if( !cookies.includes( "sw_twitter_id")
      &&        !cookies.includes( "sw_facebook_id")
      &&        !cookies.includes( "sw_linkedin_id")
      && (match = cookies.match( /sw_last_code=[^;]*/))
      ){
        code = match[0].substr( "sw_last_code=".length)
        this.login_de&&bug( "cookieLastCode:", code)
      }
      // ToDo: Check against "stolen" cookie
      // see http://jaspan.com/improved_persistent_login_cookie_best_practice
      // Remember that code comes from cookie, for further security check
      this.cookiedCode = code
      // ToDo: cipher/decipher code
    }
    // Look for session associated to code
    if( code && (done || !once || query_code) ){
      code = code.toLowerCase().capitalize()
      this.login_de&&bug( "capitalizedCode:", code)
      session = wiki.allSessionsByCode[code.replace( "Mentor", "")]
      if( session ){
        wiki.login_de&&bug( "found session associated to code:", session)
        session.loginLog( "(session retrieved, Code" + code + ")")
        if( page ){0
          session.setCurrentPage( wiki.lookupPage( page))
        }
        done = true
      }
    }
  }
  }

  var referer = req.headers.referrer || req.headers.referer
  // ToDo: infer code from referer sometimes?
  // If coming from index.html, assume we need a new session
  // ToDo: why why why?
  if( referer && referer.includes( "index.html") ){
    if( false && session ){
      session.logout( "index.html")
      session = null
    }
  }
  
  // If no valid session, create a new one or reuse current from parent wiki
  if( !session
  || (session.isAway() && session.isGone)
  || session.wiki != wiki // reuse from login in parent wiki
  || session.checkIntrusion( req)
  ){
    // index.html default is handled elsewhere
    if( wiki.isRoot() && (!page || page == "/") )return false
    // Maybe there is a session with the parent wiki?
    if( session && session == req.session && session.wiki != wiki ){
      this.login_de&&bug( session, "reuseInChildWiki: ", wiki)
      // ToDo: partial logout?, ToDo: move this into session.login()
      session.logout( "reuse")
    // Else, I need a new session object
    }else{
      if( !session ){
        wiki.login_de&&bug( "R:", req.deId, "\n\nnewLoginOn:", page)
      }else if( session.isGone ){
        session.login_de&&bug( "R:", req.deId, "goneFor: ", page)
      }else{
        session.bug_de&&bug( "BUG? need new session?, R:", req.deId)
      }
      req.session = session = new Session()
      wiki.login_de&&bug( "newSession:", session, "R:", req.deId)
      if( code ){
        session.loginLog( "(using retrieved Code" + code + ")")
      }
    }
    if( is_debug ){
      wiki.dee&&bug( "debugMode: ", is_debug)
      session.isDebug = true
      session.setDeId( session.id)
    }
    return session.login( wiki, subdomain, custom, page, code, query, req)
  }
  
  // If valid session, put the visitor back to where she was
  De&&mand( session.wiki == wiki )
  var closure_f = wiki.getClosure( session.postClosureId, true)
  wiki.login_de&&bug( "returningSession:", session, "userloginId:", 
    session.loginId, "name:", session.userName())
  if( !closure_f ){
    De&&bug( "Bad session: ", session)
    De&&bug( "dumpSession: ", session.dump())
  }
  De&&mand( closure_f, "null closure")
  return closure_f
}

// section: end wikilogin.js

Wiki.registerClosure = function( f ){
// Remember a closure, and its session. Returns a printable unique id.
  var id
  // ToDo: Try a random id and check if it's user is still there,
  // or else... memory leaks pretty quickly I'm afraid
  id = this.getRoot().allClosures.length
  this.getRoot().allClosures[id] = f
  id = (id + this.getRoot().idSalt).toString()
  f.id = id
  return id
}

Wiki.deregisterClosure = function( f ){
  var id = parseInt( f.id, 10) - this.getRoot().idSalt
  // ToDo: should I "delete" instead?
  this.getRoot().allClosures[id] = null
}

Wiki.getClosure = function( closure_id, gone_is_ok ){
  NDe&&bug( "?Wiki closure " + closure_id )
  if( !closure_id ){ return null }
  closure_id = parseInt( closure_id, 10) - this.getRoot().idSalt
  // Closure ids are global, ie registered at the root wiki level only
  var closure_f = this.getRoot().allClosures[closure_id]
  // Check if the closure is about a gone session, if so, filter out
  if( closure_f
  && !gone_is_ok
  && closure_f.session
  && closure_f.session.isAway()
  && closure_f.session.isGone
  ){
    delete this.getRoot().allClosures[closure_id]
    closure_f = null
  }
  return closure_f
}


Wiki.getRestClosure = function(){
// When some "anonymous" rest request is received, it is forwarded to a fake
// guest session. That fake session is created only when a first such request
// is received, to avoid some overhead.
  var guest = this.protoGuest
  if( !this.isRoot() && this.protoGuest.wiki != this ){
    this.login_de&&bug( "Create local proto guest")
    this.protoGuest = new Session
    this.protoGuest.login( this)
    // I patch the name for the rare cases where it is displayed
    this.protoGuest.loginName = SW.name
    this.protoGuest.logout( "proto")
    guest = this.protoGuest
  }
  var closure_id = guest.restClosure
  return this.getClosure( closure_id, true) // true => don't mind if gone
}


Wiki.trackBacklink = function( page, referer, is_private ){
// Remember some back link from referer to page
// Returns true iff such link if first encountered
  return this.backlinkName( page.name, referer, is_private)
}

Wiki.backlinkName = function( pagename, referer, is_private ){
// Remember some back link from referer to page
  De&&mand( pagename)
  var bag = this.allBacklinksByPage[pagename]
  if( !bag ){
    this.allBacklinksByPage[pagename] = bag = {}
  }
  if( !bag[referer.name] ){
    bag[referer.name] = {page: referer, isPrivate: is_private}
    //this.de&&bug( "tracked link, referer:", referer, "target:", pagename)
    return true
  }else{
    return false
  }
}

Wiki.forEachBacklink = function( page, with_private, cb ){
// Iterates backlinks of a page. calls cb( referrer_page, page, is_private )
// Side effect: delete obsolete links when referrer does not link to page
// anymore.
  var bag = this.allBacklinksByPage[page.name]
  if( !bag ) return false
  var referer_info
  var referer_name
  var referer
  var to_delete = {}
  var r
  for( referer_name in bag ){
    referer_info = bag[referer_name]
    referer = referer_info.page
    // I check that the other page still references this page
    // If the other page was not incarned, assume no change
    if( !referer.wasIncarned()
    ||  (referer.linksTo( page) && !referer.isNull())
    ){
      if( with_private || !referer_info.isPrivate ){
        r = cb.call( this, referer, page, referer_info.isPrivate)
        if( r === false )break
      }
    // Delete old references
    }else{
      to_delete[referer_name] = referer
    }
  }
  for( var referer_name in to_delete ){
    referer = bag[referer_name].page
    this.de&&mand( referer, "bad referer")
    if( De ){
      if( !referer.linksTo( page) ){
        this.de&&bug( "delete backlink, referer:", referer, "target:", page)
      }else{
        this.de&&bug( "delete blank, referer:", referer, "target:", page)
      }
    }
    delete bag[referer_name]
    // Also forget all links to empty pages?
    if( false && referer.isNull() ){
      delete this.allBacklinksByPage[referer_name]
    }
  }
  return true
}

Wiki.forEachPage = function( home, session, cb, already_incarned_only ){
// Iterate all reacheable pages from some root page.
//  However, don't visit new seen pages if "alreay_incarned_only" is set.
// Defauts to "HomePage" root.
// Callback is called with some page name.
// Callback's page name is null when last called.
  var that = this
  var visited = {}
  var page
  var to_visit = []
  var match
  var total_size = 0
  to_visit.push( home ? home.name : "HomePage")
  var visit = function(){
    var pagename
    if( (pagename = to_visit.pop())
    && (page = session.lookup( pagename)) // Always true, but I need "page"
    && (!session || session.mayRead( page))
    && (!already_incarned_only || page.wasIncarned())
    ){
      NDe&&bug( "Visiting ", pagename)
      page.read( function( err, page ){
        if( !err ){
          var content = page.isDraft() ? page.getNondraftBody() : page.getBody()
          total_size += content.length
          var reg = new RegExp( SW.wikiwords)
          var word
          var referer = page // that.lookupPage( page)
          cb.call( that, referer)
          while( match = reg.exec( content) ){
            NDe&&bug( "Match: ", Sys.inspect( match))
            if( (word = match[2]) ){
              if( !"Do".starts( word)
              // Avoid #xxxx in CSS pages & Angular pages
              &&  (!"#".starts( word)
                || !(page.isCss() || page.isAngular() || page.isToDo()))
              ){
                word = word.substr( 0, 99)
                NDe&&bug( "word ", word)
                that.backlinkName( word, referer)
                if( !visited[word] ){
                  visited[word] = true
                  to_visit.push( word)
                }
              }
            }else{
              De&&bug( "Broken loop in forEachPage()")
              //De&&mand( false)
            }
          }
        }
        // This is recursive, because it is asynchronous
        // ToDo: could be faster, maybe, if not sequential...
        visit()
      })
    }else{
      if( true || !session ){
        De&&bug( "Wiki total size: ", total_size)
      }
      
      cb.call( that, null)
    }
  }
  visit()
}


Wiki.trackDraftPage = function( page ){
// Remembers if a page is a draft page
  if( !page.isDraft() )return this.trackNondraftPage( page)
  if( this.allTransientPages[page.name] ){
    De&&bug( "Already a draft:", page)
    De&&mand( page.nondraft )
    return
  }
  this.touch()
  // Keep count of draft pages, for speed. Ignore some pages, they confuse
  if( !page.isCode() && !page.isUser() ){ this.countDrafts++ }
  this.allTransientPages[page.name] = page
}


Wiki.trackNondraftPage = function( page ){
// Forgets that a page is in draft mode
// Note: this does not restore the non draft version of the page,
// it actually forget about it. It is up to the caller to use
// the non draft version to restore, if that's what's needed.
  // Note: cache is not written to store
  if( !this.allTransientPages[page.name] ){
    De&&bug( "notDraftPage:", page)
    De&&mand( !page.nondraft )
    return false
  }
  De&&mand( !page.nondraft, "draft version" )
  this.touch()
  De&&bug( "Wiki is stamping (or clearing) a draft")
  if( !page.isCode() && !page.isUser() ){ this.countDrafts-- }
  delete this.allTransientPages[page.name]
  var p = this.allPages[page.name]
  De&&mand( p === page )
  return true 
}


Wiki.draftsCount = function( with_codes ){
// Returns the number of draft pages, with or without draft codes (and users)
  if( !with_codes )return this.countDrafts
  // That was fast, but it gets slower if I need draft codes too
  var size = 0
  var key
  for( key in this.allTransientPages ){
    size++
  }
  return size
}

Wiki.isEmpty = function(){
// ToDo: this does not work well
  return this.countPageWrites ==  0 && this.draftsCount() == 0
}
Wiki.declareIdempotentPredicate( "isEmpty")


Wiki.forEachDraft = function( cb, with_codes ){
// Iterates draft pages, with or without draft code/user pages
  var name
  var page
  var r
  for( name in this.allTransientPages ){
    page = this.allTransientPages[name]
    if( with_codes || !page.isCode() || !page.isUser() ){
      r = cb.call( this, this.allTransientPages[name])
      if( r === false )break
    }
  }
}

Wiki.stampsCount = function(){
// Returns the number of entries in "RecentStamps"
  var page = this.allPages["RecentStamps"]
  if( !page ) return 0
  // ToDo: Better regexp?
  var nstamps = page.getBody().split( 
    new RegExp( SW.datePattern, "i")
  ).length
  if( nstamps > 0 ){ nstamps-- }
  return nstamps
}
Wiki.declareIdempotentGetter( "stampsCount")

Wiki.forEachSession = function( cb ){
// Iterate over all sessions, there can be a lot
  var id
  var session
  var sessions = this.allSessions
  // Sort, young sessions firsts
  sessions = sessions.sort( function( a, b ){
    return b.timeLogin - a.timeLogin 
  })
  var r
  for( id in sessions ){
    session = this.allSessions[id]
    if( session != this.protoGuest ){
      r = cb.call( this, session)
    }
    if( r === false )break
  }
}

Wiki.recentSessionsCount = function(){
  return this.allSessions.length
}
Wiki.declareIdempotentGetter( "recentSessionsCount")

Wiki.forEachMember = function( cb ){
// Iterate over members that logged in since start up.
// This does not include guest users, they're not "members".
  var code
  var session
  var r
  // ToDo: I should iterate over allSessionsByName
  for( code in this.allSessionsByCode ){
    session = this.allSessionsByCode[code]
    if( !session.isGuest() ){
      r = cb.call( this, session, code)
      if( r === false )break
    }
  }
}

Wiki.forEachClone = function( cb ){
  var name
  var wiki
  var r
  for( name in this.allClones ){
    wiki = this.allClones[name]
    r = cb.call( this, wiki)
    if( r === false )break
  }
}

Wiki.clonesCount = function(){
  var sum = 0
  var name
  for( name in this.allClones ){
    sum++
  }
  return sum
}
Wiki.declareIdempotentGetter( "clonesCount")

Wiki.membersCount = function(){
// Returns total number of members who logged in since start up.
  return this.countMembers
}
Wiki.declareIdempotentGetter( "membersCount")

Wiki.recentMembersCount = function(){
  return this.countMembers
  // Alternative:
  var sz = 0
  this.forEachMember( function(){ sz++ })
  return sz
}



Wiki.putPage = function( page, body, cb ){
// Put page in store (unless draft) and cache, asynchronous
  page.de&&mand( !page.isDraft(), "cannot put draft page")
  // this is a create if some failed attempt to get page from store occured.
  // I also assume it is a creation if no attempts to get from store, this
  // is not 100% safe but I believe that it is almost always correct
  var is_create = !page.wasIncarned() || page.err  // err => does not exist
  // Side effect on body, see fixProto() for side effect on proto
  if( page.isPending() ){
    // ToDo: how should I handle concurrent writes to the same file?
    this.bug_de&&bug( "concurrentWrite:", page)
  }
  page.de&&mand( !page.isVirtual(), "bad virtual:" + page )
  page.incarnBody( body, "pending")
  var that = this
  // Recently modified pages are "hot"
  if( !page.isPrivate() ){ page.setHot() }
  // Update proto if page say so, then store, unless draft
  that.fixProto( page, once( function wiki_put_page_fix_proto_cb(){
    // Draft pages stay in memory until stamped/approved
    if( page.isDraft() ){
      cb.call( that, 0, page)
    // Non draft pages are written to disk
    }else{
      var body = Wiki.injectContext( page)
      that.consumeTestPage( page.name)
      that.pageStore.put(
        page.name,
        body, 
        once( function wikiputpage_cb( err ){
          if( err ){
            // ToDo: handle error
            if( !page.isPending() ){
              // ToDo: how should I handle concurrent writes to the same file?
              this.bug_de&&bug( "concurrentWriteErrCb:", page, "err:", err)
            }		  
          }else{
            if( is_create ){
              that.countPageCreates++
            }
            if( !page.isPending() ){
              // ToDo: how should I handle concurrent writes to the same file?
              this.bug_de&&bug( "concurrentWriteCb:", page)
            }
          }
          page.incarnErr( err)
          cb.call( that, err, page)
        })
      )
    }
  }))
}

Wiki.fixProto = function( page, cb ){
// Does nothing for most pages, just calls cb().
// "About" pages have "proto" data that are the data
// of a page whose name is on the first line of the page.
// One such page is the very special "AboutWiki" page, a page that tells about
// the configuration of a wiki.
// Must never be called against a draft page.  
  page.assertIsPage()
  if( !page.isAbout() ){
    //this.deep_store_de&&bug( "no proto, Invoke cb:", Sys.inspect( cb))
    return cb()
  }
  page.de&&mand( !page.isDraft() )
  var proto_name = page.getBody().frontLine().replace( /\s/g, "")
  this.deep_store_de&&bug( "fixProto:", page.name, "body:", 
    page.getBody().substr( 0, 40).replace( /\n/g, "\\n") + "..."
  )
  if( proto_name ){
    this.store_de&&bug( "fixProto:", page.name, "with:", proto_name)
    // The root wiki has a special default config for security reasons
    if( this.isRoot() && proto_name == "PrivateWiki" ){
      proto_name = "PrivateRootWiki"
    }
    var that = this
    that.lookupPage( proto_name).read(
      function fix_proto_cb( merr, datapage ){
        if( merr ){	  
        }else{
          page.proto = datapage
          // If page is special page "AboutWiki", then I need to update the wiki
          if( page.name == "AboutWiki" ){
            // Note: processConfig() uses the non draft version of the page
            that.processConfig( page)
          }
        }
        this.deep_store_de&&bug( "fetchProto:", datapage, "invoke cb")
        return cb()
      }
    )
    return
  }
  cb()
}


Wiki.extractContext = function( body, page ){
// Returns {body:str,context:obj_or_null}
  var ctx = null
  var ii
  var sep = "\r\n__ctx__\r\n"
  if( body && (ii = body.lastIndexOf( sep)) != -1 ){
    ctx  = body.substr( ii)
    body = body.substr( 0, ii)
    try{
      ctx = JSON.parse( ctx.substr( sep.length))
    }catch( err ){
      this.error(
        "JSON, page.name:", page.name,
        "err:", Sys.inspect( err),
        "ctx:", ctx.substr( 0, 4).replace( "\n", "\\n")
      )
      ctx = null
    }
  }
  return { body: body, context: ctx }
}

Wiki.injectContext = function( page ){
  var ctx  = JSON.stringify( page.saveContext())
  var body = page.body	// ToDo: getBody()?
  body = Wiki.extractContext( body, page).body
  body = body.replace( /\r/, "") + "\r\n__ctx__\r\n" + ctx
  return body
}


Wiki.fetchPage = function( name, cb ){
// Get page in store, asynchronous
// If page is draft, get non draft version incarned
// Calls cb( err, page)
// This method is called by Page.read() only
  
  // ToDo: DRY, this code is repeated in Page.read()
  var page = this.lookupPage( name)

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
  && !this.isRoot()
  && ("Original" == cached.body.frontLine()
    || (page.wasInherited() && page.wasDeleted())
  )

  // Also force reload if config says so
  var cacheable = !this.config.noCache

  if( !need_original
  &&  cacheable && cached && cached.wasIncarned()
  // If draft, make sure non draft page was incarned, ToDo: remove
  && (!page.nondraft || page.nondraft.wasIncarned())
  ){
    return !cb ? page.body : cb.call( this, page.err, page)
  }
  var that = this

  // Once fetched, create or update cache
  var fixproto = function fetchfixproto( page, body, inherited, err ){ 
    // Double check that fetching was really needed, for it's costly
    if( !need_original && cached && cached.body ){
      if( page.wasIncarned() && !page.nondraft ){
        // For whatever reason the page was incarned in parallel
        that.bug_de&&bug( "Fetched page already incarned, page:", page)
      }
      if( page.nondraft && page.nondraft.wasIncarned() ){
        that.bug_de&&bug( "Fetched non draft already incarned, page:", page)
      }
      //De&&mand( !page.wasIncarned() || page.nondraft )
      //De&&mand( !page.nondraft      || !page.nondraft.wasIncarned() )
    }
    var nondraft = page.incarnRestore( body, inherited, err)
    return that.fixProto( nondraft, once( function fixproto_cb(){ 
      return cb.call( that, err, page)
    }))    
  }
  
  // Import from Ward's wiki
  if( this.name == "c2" ){
    var page = that.lookupPage( name)
    if( !page.isSpecial()
    && !page.isSensitive()
    && !page.isStamps()
    ){
      return this.fetchC2( name, cb)
    }
  }
  // Handle #rfcnnnn 
  if( "#rfc".starts( name) ){
    var rfc = name.substr( "#rfc".length)
    return this.fetchRfc( rfc, cb)
  }
  // Get from store. unless previous failure
  if( cached && cached.err ){
    this.store_de&&bug( "Useless refetch avoided, err:", err)
    return !cb ? cached.body : cb.call( this, cached.err, cached)
  }
  if( cached && cached.isPending() ){
    // I should be reading from local cache...
    // I could use de&&mand(), but I prefer to take the hit
    page.bug_de&&bug( "Unexpected read during ongoing write")
  }
  var that = this
  function fake_test_get( name, cb ){
    that.consumeTestPage( name)
    cb.call( 1, null )
  }

  var get = this.isTestPage( name) ? fake_test_get : this.pageStore.get
  get.call( this.pageStore, name, function fetchget_cb( err, body ){

    page = that.lookupPage( name)

    if( page.isPending() ){
      // I am checking that the PageStore() deal with this correctly
      if( body != page.body ){
        // This should never happen with the default file based PageStore
        page.bug_de&&bug( "write during ongoing read, mismatch")
      }
    }
    if( !err && body ){
      NDe&&bug( "Body is ", Sys.inspect( body))
    }

    // If no content or Original required, try to get from the parent wiki
    if( err || !body || need_original || body.frontLine() == "Original" ){
      // Inherit, but "HomePage", this one is always local, less confusing
      // Stamps are local too & so are PrivateCodes and PrivateContext
      // ToDo: for scalability reasons it is not good to try to inherit from
      // the root wiki, most of the time it will fail.
      // A better solution is to preload some pages in the root wiki and
      // inherit root wiki pages only if they are in memory.
      // "Parent" page inherit from a non parent page
      var true_name = name
      if( page.isParent() ){
        name = page.getParentPageName()
      }
      if( that.parentWiki
      && (name != "HomePage" || true_name == "ParentHomePage") 
      && !page.isCopy()
      && !page.isStamps()
      && !page.isDeletion()
      && name != "PrivateCodes"
      && !"PrivateContext".starts( name)
      ){
        // Inherit page from parent, get the non draft version
        return that.parentWiki.lookupPage( name).read( function( err, ipage ){
          ipage.assertIsPage()
          that.de&&bug( "inheriting:", ipage.name, "draft:", page.isDraft(),
          "err:", err)
          // ToDo: get rid of this, body is not needed
          var body = ipage.body
          if( ipage.isDraft() ){
            if( ipage.nondraft ){
              body = ipage.getNondraftBody()
            // If no non draft version to inherit... something is weird
            }else{
              that.bug_de&&bug(
                "BUG? inherited draft but no nondraft, page:", ipage)
              body = ""
            }
          }
          if( !err && ipage.isNull() ){
            that.de&&bug( "pointlessInheritance:", ipage.name)
          }
          if( err ){
            page.bug_de&&bug( "inherited page, err:", err)
            fixproto( page, null, false, err)
          }else{
            fixproto(
              page,
              body,
              ipage, // inherited
              err
            )
          }
        })
      }
      // No inherit
      fixproto( page, body, false, err)
    // If valid content and not Original required
    }else{
      fixproto( page, body, false, err)
    }
  })
  return this
}

Wiki.resetInheritedPage = function( page ){
// Need to be followed by a call to fetchPage()
  De&&mand( page.wasInherited(), "not inherited" )
  page.body = "Original"
  return this
}

Wiki.putPageSync = function( page, body ){
// ToDo: this is hack, get rid of it somehow
  page.body = body.toString()
  return this
}


Wiki.extractBasicYaml = function( text ){
// Some Yaml style subset to extract data from raw text.
// "---" mark the start of the parsed data. A hash.
// "name: value" syntax, value is always a string, optional ""
// If optional "" then enclosed \" become "
// whitespaces are ok before name.
// ONE space is needed after ":"
// Empty line or malformed name mark the end of the parsed data.
// Returns null or hash with name/value pair.
  if( !text )return null
  var ii = text.indexOf( "\n---\n")
  if( ii < 0 ){
    if( !"---\n".starts( text) ) return null
    text = text.substr( "---\n".length)
  }else{
    text = text.substr( ii + "\n---\n".length)
  }
  var lines = text.split( "\n")
  var line
  var vals = {}
  var size = 0
  var name
  var val
  for( line in lines ){
    line = lines[line]
    if( (ii = line.indexOf( ": ")) < 0 )break
    name = line.substr( 0, ii).replace( /\s/g, "")
    if( !/\w+/.test( name) )break
    val = line.substr( ii + 2)
    if( '"'.starts( val) ){
      try{
        val = JSON.parse( val)
      }catch( err ){
        this.de_bug&&bug( "Malformed JSON:", name, "val:", val)
      }
    }
    this.yaml_de&&bug( "found:", name, "val:", val)
    vals[name] = val
    size++
  }
  // ToDo: handle case where there are multiple Yaml sections
  return size ? vals : null
}

Wiki.injectBasicYaml = function( text, hash, at_the_end ){
// Replaces old basic Yaml in text by new one built from data hash.
  // Make sure text is \n terminated
  if( text && text.charAt( text.length - 1) != "\n" ){
    text += "\n"
  }
  hash || (hash = {})
  // Compute what to insert
  var insert = ["\n---"]
  var item = null
  var value
  var new_size = 0
  for( item in hash ){
    if( value = hash[item] ){
      value = value.toString()	
      if( value.indexOf( '"') >= 0 || value.indexOf( '\n') >= 0 ){
        value = JSON.stringify( value)
      }
      new_size++
      insert.push( item + ": " + value)
    }
  }
  insert.push( "")
  // Inserted stuff is \n delimited on both sides
  insert = insert.join( "\n") + "\n"
  // "Add" if no previous Yaml section
  var ii = text.search( /\n---\n/) // indexOf( "\n---\n")
  if( ii < 0 ){
    if( new_size ){
      text = text.replace( /\n*$/, "\n") + insert
      this.yaml_de&&bug( "newSection:", insert)
    }
  // "Replace" if some previous Yaml section
  }else{
    var head = text.substr( 0, ii)
    var tail = text.substr( ii + "\n---\n".length)
    // Detect end of yaml on first non matching line
    // ToDo: improve the pattern, this one eats lines with : in them
    ii = tail.search( /^[^:]*$/m)
    if( ii < 0 ){
      tail = ""
    }else{
      tail = tail.substr( ii + 1)  // + 1 to eat the terminating \n
    }
    if( new_size ){
      // Insert at the end or in place?
      // ToDo: Handle case where there are multiple Yaml sections
      // ie. each attribute should be replaced where it previously was
      // new attributes should be added in last section
      // and of course removed attributes should be removed from all sections
      if( at_the_end ){
        text = [head, tail, insert].join( "")
      }else{
        text = [head, insert, tail].join( "")
      }
    }else{
      text = head + tail
    }
    this.yaml_de&&bug( "Yaml section:", insert)
  }
  // Post-condition: new text contains desired hash
  if( De ){
    var new_hash = Wiki.extractBasicYaml( text)
    // ToDo: bombs when flasy value are removed, should not
    // De&&mand( Sw.equalHash( new_hash, hash) )
  }
  return text
}

// section: wikifetch.js

Wiki.fetchRfc = function( id, cb ){
  var that = this
  var name = "#rfc" + id
  var url = '/rfc/rfc' + id + '.txt'
  De&&bug( "Fetching RFC ", url)
  var rfceditor = Http.createClient( 80, 'www.rfc-editor.org')
  var request = rfceditor.request(
    'GET',
    url,
    {
      "Host": 'www.rfc-editor.org',
      "User-Agent": "NodeJS HTTP Client"
    }
  )
  var body = ""
  request.addListener( 'response', function( response ){
    De&&bug( "fetchRfc status", response.statusCode)
    // JSON.stringify( response.headers)
    // response.setEncoding( 'utf8')
    response.addListener( 'data', function( chunk ){
      NDe&&bug( "Fetched some chunk, length: ", chunk.length)
      body += chunk
    })
    response.addListener( 'end', function(){
      De&&bug( "Fetched, length: ", body.length)
      var page = that.lookupPage( name).incarnFetch( body, null, false, 0)
      return !cb ? name : cb.call( that, 0, page) 
    })
  })
  //request.writeHead( [["Host",'www.rfc-editor.org']])
  try{ // Nodejs 1.9 vs 1.8
    request.end()
  }catch( e ){
    De&&bug( "No .end(), revert to .close()")
    request.close()
  }
  NDe&&bug( "Resquest sent: ", Sys.inspect( request))
  return this
}


Wiki.fetchRemotePage = function( url, pagename, cb ){
// Returns false if bad url, or else returns true and later calls the callback
  var that = this

  // Split url into protocol/domain/port/uri
  var protocol = ""
  var ii  = url.indexOf( "://")
  var uri = url
  if( ii > 0 ){
    protocol = url.substr( 0, ii)
    uri  = url.substr( ii + "://".length)
  }
  var domain = uri
  var jj = uri.indexOf( "/")
  if( jj > 0 ){
    domain = uri.substr( 0, jj)
    uri    = uri.substr( jj)
  }else{
    uri    = "/"
  }
  var port   = "80"
  ii = domain.indexOf( ":")
  if( ii > 0 ){
    port   = domain.substr( ii + 1)
    domain = domain.substr( 0, ii)
  }

  // If there is no dot nor : in the domain, let's assume localhost is desired
  if( ii < 0 && domain.indexOf( ".") < 0 ){
    uri    = domain + uri
    domain = "localhost"
    port   = SW.port
  }

  this.de&bug(
    "fetchRemote:", url,
    "protocol:",    protocol,
    "domain:",      domain,
    "port:",        port,
    "uri:",         uri
  )

  // If "simpliwiki://" then use the SimpliWiki "rest" API
  if( protocol == "simpliwiki" ){
   var api = Session.apiScript
   // ToDo: this is not efficient at all. I should allocate a singleton api object
   // and use some setUrl() method to change the url
   ii = uri.lastIndexOf( "/")
   var rest = "/rest"
   if( ii >= 0 ){
     pagename = uri.substr( ii + 1)
     rest = uri.substr( 0, ii) + rest
   }else{
     pagename = uri     
   }
   api = api( "anonymous", "http://" + domain + ":" + port + rest, null)
   api.clearPageCache( pagename)
   this.de&&bug( "api.getPage, page:", pagename)
   api.getPage( pagename, function( result, t, x){
     this.de&&bug( "api result:", Sys.inspect( result))
     var body = result.body
     // ToDo: handle result.status && result.data
     body = "result-" + url + "\n\n" + (body || result.status)
     var page = that.lookupPage( "Proxy" + pagename).incarnFetch( body, null, false, 0)
     return !cb ? "Proxy" + pagename : cb.call( that, 0, page)
   })
   this.de&&bug( "apo.getPage() done")
   return true

  // If "http://" then the HTTP protocol
  }else if( protocol == "http" ){
    // ToDo: ENOTFOUND when domain is not found
    var http = Http.createClient( port, domain)
    var request = http.request(
      "GET",
      uri,
      {
        "Host": domain,
        "User-Agent": "SimpliWiki HTTP Client"
      }
    )
    var body = ""
    request.addListener( 'response', function( response ){
      response.addListener( 'data', function( chunk ){
        NDe&&bug( "Fetched some remote chunk, length: ", chunk.length)
        body += chunk
      })
      response.addListener( 'end', function(){
        De&&bug( "Fetched, remote, length: ", body.length)
        // Scrap content, getting rid of all \r
        var headers = ""
        for( var key in response.headers ){
          headers += key + ": " + response.headers[key] + "\n"
        }
        // ToDo: maybe I should keep the page intact and put the result in the 
        // page whose name is without Proxy (with "Remote" instead for example)
        // But then it means that the callback would get a different page...
        // This may confuse quite a lot of exiting code, to be checked
        body = "response-" + url
        + "\nstatus: " + response.statusCode
        + "\nheaders:\n" + headers
        + "\nbody:\n"
        + body.replace( /\r/g, "")
        var page = that.lookupPage( pagename).incarnFetch( body, null, false, 0)
        return !cb ? pagename : cb.call( that, 0, page)
      })
    })
    .addListener( 'error', function(){
      // ToDo: better error handling
      this.de&&bug( "ERROR on HTTP Client, domain:", domain, "port:", port, "uri:", uri)
      return cb.call( that, 1)
    })
    request.end()
    //this.de&&bug( "Request sent: ", Sys.inspect( request))
    return true
  }

  // If unknown protocol..
  return false
}


Wiki.fetchC2 = function( pagename, cb ){
// Fetch a page from Ward's C2 wiki
  var that = this
  var url = '/cgi/wiki?edit=' + pagename
  De&&bug( "Fetching C2 ", url)
  var c2 = Http.createClient( 80, 'c2.com')
  var request = c2.request(
    'GET',
    url,
    {
      "Host": 'c2.com',
      "User-Agent": "NodeJS HTTP Client"
    }
  )
  var body = ""
  request.addListener( 'response', function( response ){
    De&&bug( "fetchC2 status", response.statusCode)
    // JSON.stringify( response.headers)
    // response.setEncoding( 'utf8')
    response.addListener( 'data', function( chunk ){
      NDe&&bug( "Fetched some C2 chunk, length: ", chunk.length)
      body += chunk
    })
    response.addListener( 'end', function(){
      De&&bug( "Fetched, C2, length: ", body.length)
      // Scrap content
      body = body
      .replace( /[\s\S]*TEXTAREA.*>([\s\S]*)<\/TEXTAREA[\s\S]*/g, "$1")
      .replace( /&quot;/g, '"')
      .replace( /&lt;/g, '<')
      .replace( /&gt;/g, '>')
      .replace( /&amp;/g, '&')
      .replace( /'''''(.*)'''''/g, '"$1"')
      .replace( /''''(.*)''''/g, '_$1_')
      .replace( /''''''/g, '/')
      .replace( /'''(.*)'''/g, '*$1*')
      .replace( /''(.*)''/g, '"$1"')
      .replace( /''/g, '"')
      .replace( /""/g, '"')
      .replace( /"'/g, '/')
      .replace( /'"/g, '/')
      //.replace( /^ ( *)(.*)$/gm, ' $1/ $2 /')
      .replace( /----/g, " ----------")
      + "\n\n"
      + "The original C2's page is c2.com/cgi/wiki?" + pagename
      + "\n\n\n\n"
      var page = that.lookupPage( pagename).incarnFetch( body, null, false, 0)
      return !cb ? pagename : cb.call( that, 0, page)
    })
  })
  request.end()
  NDe&&bug( "Resquest sent: ", Sys.inspect( request))
  return this
}

// section: end wikifetch.js


Wiki.getPageLastSession = function( pagename ){
  return this.lookupPage( pagename).lastSession
}

Wiki.isAnonymous = function(){
// A wiki is anonymous if its name is a random FreeCode, unless som
// config based title was given
  return !this.config.title && /3\w\w\-\w\w\w\-\w\w\w$/.test( this.name)
}
Wiki.declareIdempotentPredicate( "isAnonymous")

Wiki.isGuest = function( name ){
// Tells if a user is a "guest" user (vs a "member" user)
  if( name.includes( "Guest") ) return true
  if( this.isVeryOpen() ) return false // ToDo: keep this?
  if( this.allTransientPages[this.protoGuest.usernamize( name)] ){
    return true
  }
  return false
}

Wiki.unshiftTest3Code = function( code ){
// Determine what Wiki.random3Code() will return, for tests.
  Wiki.testRandom3Codes || (Wiki.testRandom3Codes = [])
  Wiki.testRandom3Codes.unshift( code)
}

Wiki.random3Code = function( sep ){
// I use auto generated names for wiki names and invitation codes sometimes.
// And also for User unique ids.
// They are 3xx-xxx-xxx style usually, I call them FreeCodes
// There is a small chance of collision, I take it (fixable)
  if( Wiki.testRandom3Codes ){
    var test3Code = Wiki.testRandom3Codes.shift()
    if( Wiki.testRand3Codes.length == 0 ){
      Wiki.testRandom3Codes = null
    }
    return test3Code.split( '-').join( sep)
  }
  var str = "3"
  var max = SW.valid3.length
  for( var ii = 0 ; ii < 8 ; ii++ ){
    str += SW.valid3[Math.floor( Math.random() * max)]
    if( sep && (ii == 1 || ii == 4) ){
      str += sep
    }
  }
  this.f3Code_de&&bug( "Random 3Code:", str)
  return str
}

Wiki.random4Code = function( sep ){
// I will use auto generated names for wiki names and invitation codes sometimes.
// And also for User unique ids.
// They are 4xxx-xxxx-xxxx style usually, I call them FreeCodes
// There is a small chance of collision, I take it (fixable)
  if( Wiki.testRandom4Codes ){
    var test4Code = Wiki.testRandom4Codes.shift()
    if( Wiki.testRand4Codes.length == 0 ){
      Wiki.testRandom4Codes = null
    }
    return test4Code.split( '-').join( sep)
  }
  var str = "4"
  var max = SW.valid3.length
  for( var ii = 0 ; ii < 15 ; ii++ ){
    str += SW.valid3[Math.floor( Math.random() * max)]
    if( sep && (ii == 2 || ii == 6) ){
      str += sep
    }
  }
  this.f3Code_de&&bug( "Random 4Code:", str)
  return str
}

Wiki.redize = function( str ){
  if( !str )return ""
  return "<em>" + str.substr( 0, 1) + "</em>" + str.substr( 1)
}

Wiki.htmlizeMap = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;"
}

Wiki.htmlize = function( txt ){
// Per HTML syntax standard, &, < and > must be encoded in most cases, <script>
// CDATA and maybe <textarea> are the exceptions.
  // Protect pre-encoded i18n stuff, unless "HTML" in text tells differently
  if( txt.indexOf( "HTML") < 0 ){
    txt = txt.replace( /&([a-z]{2,7};)/, "\r$1")
  }
  var map = Wiki.htmlizeMap
  txt = txt.replace( /[&<>]/g, function( ch ){ return map[ch] })
  // Restore pre-encoded i18n stuff
  txt = txt.replace( /\r([a-z]{2,7};)/, "&$1")
  return txt
}

Wiki.htmlizeAttrMap = {
  "&": "&amp;",
  '"': "&quot;",
  "'": "&#39;"
}

Wiki.htmlizeAttr = function( txt ){
// HTML syntax dictactes that attribute cannot contain " and, that's a bit
// suprizing ' and &... they must be encoded.
// Google Chrome specially does not like ' in attributes... it freeezes in
// some cases.
  var map = Wiki.htmlizeAttrMap
  return txt.replace( /[&"']/g, function( ch ){ return map[ch] })
}

Wiki.dehtmlizeAttrMap = {
  "&amp;": "&",
  "&quot;": '"',
  "&#39;": "'"
}

Wiki.dehtmlizeAttr = function( txt ){
// HTML syntax dictactes that attribute cannot contain " and, that's a bit
// suprizing ' and &... they must be encoded.
// Google Chrome specially does not like ' in attributes... it freeezes in
// some cases.
  var map = Wiki.dehtmlizeAttrMap
  return txt.replace( /(&.*;)/g, function( ch ){ return map[ch] })
}


Wiki.host = function(){ return SW.domain }
Wiki.declareIdempotentGetter( "host")

// ToDo: https://secure.wikimedia.org/wikipedia/en/wiki/Percent-encoding
// I suspect I don't handle weird page names (ie chinese, russian, arabic,
// etc) so well...
Wiki.permalink = function( pagename, code, fullname ){
  return SW.protocol
  + this.host()
  + "/" 
  + (fullname || (!this.isRoot() ? this.fullname() : ""))
                    //Wiki.encodeUrl( this.fullname()) : "")
  + Wiki.encode( pagename) // Wiki.encodeUrlPagename( pagename)
  + (code ? "?code=" + encodeURIComponent( code) : "")
}


Wiki.htmlA = function( label, page, title ){
// Returns "<a ...." with permalink to page. title is optional.
// Neither page nor title need to be encoded
  return HtmlA(
    label,
    this.permalink( page),
    title // title is encoded by HtmlA()
  )
}

Wiki.interwiki = function( moniker ){
// See http://meatballwiki.org/wiki/InterMap
  if( moniker == SW.name ){
    return SW.protocol + this.host() + (SW.test ? ":" + SW.port : "") + "/"
  }
  if( moniker == "SimpliWiki" ){
    return "http://simpliwiki.com/"
  }
  var map = Sw.interwikiMap
  if( map ){
    var match = map[moniker]
    if( match ){
      return match
    }
  }
  map = this.interwikiMap
  if( !map ){
    De&&bug( "No InterWiki Map")
    return moniker + ":"
  }
  if( match = map[moniker] ){
    return match
  }
  De&&bug( "no interwiki:", moniker)
  return moniker + ":"
}

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

Wiki.saveContext = function( that ){
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
  if( that.isEmpty() ){
    if( that.touchedHard ){
      that.bug_de&&bug( "empty but touched hard")
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

Wiki.saveContext1 = function( that, context, pages ){
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

Wiki.saveContext2 = function( context ){
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
      this.bug_de&&bug( "no change, yet touched hard")
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

Wiki.saveContext3 = function(){
// Final step
  this.timeSaveContextStarted = 0
  // If reset in progress, complete reset
  if( !this.saveContextScheduled && this.isResetting() ){
    if( this.touchedHard ){
      this.bug_de&&bug( "Can't reset, still touched hard")
      this.scheduleSaveContext()
    }else{
      this.reset( true) // force
    }
  }
}

Wiki.sampleCounters = function( nhttpreqs ){
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

Wiki.updateCounters = function( context ){
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

Wiki.parsePrivateContext = function( page ){
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

Wiki.restoreContext = function( page ){
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

Wiki.restoreContext1 = function( that, context, pages ){
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

Wiki.restoreContext2 = function( context ){
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

Wiki.contextInfo = function( context ){
  if( !NDe )return
  var counters = this.sampleCounters()
  De&&bug( "Counters: ", Sys.inspect( counters))
  NDe&&bug( "Pages: ", context.countPages)
  NDe&&bug( "Size: ", context.totalSize)
  NDe&&bug( "Average: ", context.totalSize / context.countPages)
  NDe&&bug( "Context size: ", this.lastContext.length)
}

Wiki.scheduleSaveContext = function(){
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

Wiki.touch = function( hard ){
// Basic change management, time based
  this.timeLastTouched = Sw.timeNow
  if( !this.saveContextScheduled ){
    this.scheduleSaveContext()
  }
  // I don't 100% the context diff mechanism, better save twice than none
  if( hard ){
    this.touchedHard = hard
  }
}


// section: end wikictx.js


Wiki.isBotRequest = function( req ){
  De&&mand( req.response, "no response" )
  var useragent = req.headers["user-agent"]
  var langs = req.headers["accept-language"]
  if( !langs && (!useragent || !useragent.includes( "X11")) ){
    if( "/rest".starts( req.url) )return false
    this.bot_de&&bug( "detected on ", req.url)
    this.bot_de&&bug( "no accept-language ", Sys.inspect( req.headers))
    return true
  }
  // ToDo: config about bots ok or not
  return false
}


Wiki.asciiMap = {
  "\xC0": "A", // acute
  "\xE0": "a", // acute
  "\xC2": "A", // circumflex
  "\xE2": "a", // circumflex
  "\xC6": "A", // AE ligature
  "\xE6": "a", // ae ligature
  "\xC7": "C", // cedilla
  "\xE7": "c", // cedilla
  "\xC8": "E", // grave
  "\xE8": "e", // grave
  "\xC9": "E", // acute
  "\xE9": "e", // acute
  "\xCA": "E", // circumflex
  "\xEA": "e", // circumflex
  "\xCB": "E", // umlaut
  "\xEB": "e", // umlaut
  "\xCE": "I", // circumflex
  "\xEE": "i", // circumflex
  "\xCF": "I", // umlaut
  "\xEF": "i", // umlaut
  "\xD4": "O", // circumflex
  "\xF4": "o", // circumflex
  "\xD9": "U", // grave
  "\xF9": "u", // grave
  "\xDB": "U", // circumflex
  "\xFB": "u", // circumflex
  "\xDC": "U", // umlaut
  "\xFC": "u", // umlaut
  "\x80": "E", // Euro
  "\u0152": "O",// OE ligature
  "\u0153": "o",// oe ligature
  "\u20A3": "F" // Franc
}

Wiki.toAscii = function( txt ){
// Converts some weird characters into a decent ASCII equivalent.
// Other characters are left unchanged.
  var map = Wiki.asciiMap
  txt = txt.replace(
  /[\xC0\xE0\xC2\xE2\xC6\xE6\xC7\xE7\xC8\xE8\xC9\xE9\xCA\xEA\xCB\xEB\xCE\xEE\xCF\xEF\xD4\xF4\xD9\xF9\xDB\xFB\xDC\xFC\x80\u0152\u0153\u20A3]/g
  , function( ch ){ return map[ch] })
  return txt
}

Wiki.sanitizePath = function( str ){
// Figure out a decent path for a page.
// Each item in the path will be either an almost valid wikiname
// or a "sanitized" string, ie: weird chars encodeURIComponent()
// All but last item are made lowercase with front @ removed.
// ie: @jhr/HomePage => jhr/HomePage
//     MyWiki/HomePage => mywiki/HomePage
// Rationnal: I want the path to be made of valid hostnames so
// that I can handle virtual hosting.
// As a result "mywiki.simpliwiki.com/HomePage" is equivalent to
// simpliwiki.com/MyWiki/HomePage
// Note: see also Wiki.encodePath() && Wiki.decodePath() that deal with with
// @ and "In" at the end of a name.
// ToDo: Encoding is a mess at this point.
  // Get rid of ctrl chars
  var path = (str || "").replace( /[\x00-\x1f]/g, "" )
  // At most 255 chars (max for a FQDN, RFC 2181)
  path = path.substr( 0, 255)
  // Split in parts, / separated
  var items = path.split( "/")
  var item
  var list = []
  var depth_credit = 2
  var last_item_idx = items.length - 1
  // Collect sanitized items
  for( var itemidx in items ){
    item = items[itemidx]
    // At most 63 characters, per rfc 2181
    item = item.substr( 0, 63)
    // If item is a "simple" wikiname, keep it that way
    if( SW.wikiword.test( item)
    &&  !SW.wikiwordEmail.test( item)
    &&  !SW.wikiwordFacebookGroup.test( item)
    &&  !SW.wikiwordFreeLink.test( item)
    ){
      // but get rid of @ if it is part of the wiki's name
      // This is for twitter names
      // ToDo: fix the mess with at_ & @
      if( "@".starts( item) && (itemidx != last_item_idx) ){
        item = item.substr( 1).toLowerCase()
      }
      if( "at_".starts( item) && (itemidx != last_item_idx) ){
        item = item.substr( "at_".length).toLowerCase()
      }
      // lowercase directory/hostname
      if( itemidx != last_item_idx ){
        item = item
        .replace( /[@#_.\[\]'" ]/g, "-")
        .replace( /^-/g, "")
        .replace( /-$/g, "")
        item = Wiki.toAscii( item).toLowerCase()
        || "anonymous"
      }else{
	item = item
      }
      list.push( item)
    // Else convert to lower case "orthodox" chars
    }else{
      if( item ){
        if( itemidx != last_item_idx ){
          item = item
          .replace( /[@#_.\[\]'" ]/g, "-")
          item = Wiki.toAscii( item)
          .toLowerCase()
          .replace( /[^a-z0-9-]/g, "")
          || "anonymous"
          list.push( item)
        }else{
          list.push( item)
        }
      }
    }
  }
  path = list.join( "/") || ""
  this.misc_de&&bug( "sanitizedPath:", path, "for:", str)
  return path
}

Wiki.sanitizeMail = function( mail ){
// Return null or figure out a somehow valid mail address
  // Get rid of spaces
  mail = mail.replace( /\s/g, "")
  // If there is a wiki name prefix, get rid of it
  var slash = mail.lastIndexOf( "/")
  if( slash != - 1 ){
    mail = mail.substr( slash + 1)
  }
  // Some limit on length
  mail = mail.substr( 0, 320)
  // Some regex, I guess better ones exist
  var r = /^([a-zA-Z0-9_.-])+@(([a-zA-Z0-9-])+.)+([a-zA-Z0-9]{2,4})+$/
  if( r.test( mail) ) return mail
  return null
}

Wiki.sanitizeName = function( name ){
// Returns the sanitized version of a user "name".
// I basically remove weird characters that may interfere with HTML
// or display formatting. I also remove [ and ] so that the
// result would be a free link if [] enclosed.
// If @ starts or ends the name, I convert it to lowercase.
// ToDo: See also https://github.com/chriso/node-validator/tree/master/lib
// ToDo: Chinese...
  if( ("@".starts( name) || "@".ends( name))
  && !name.includes( "[")
  ){
    name = name.toLowerCase()
  }
  return name.replace( /[\r\n<>="\[\]]/g, "")
  return name.replace( /[^A-Za-z_0-9 ']/g, "")
}

Wiki.changeDefaultToMentorConfig = function(){
// Change content of "AboutWiki" page to use "PrivateMentorWiki"
// instead of default "PrivateWiki".
// This basically switches from "very open" to just "open".
// This method gets called when some ownership can be asserted regarding
// the wiki, i.e. either because a twitter/fb user logs in or because
// some user used an invitation page.
  if( !this.config.veryOpen )return
  this.de&&bug( "change ownership")
  var config = this.lookupPage( "AboutWiki")
  // ToDo: I should call isVeryOpenByDefault()
  var proto_page = this.lookupPage( config.frontLine())
  if( proto_page.name != "PrivateWiki" ){
    if( proto_page.name != "PrivateOpenWiki" ){
      this.bug_de&&bug( "weird, not open yet config was changed:", proto_page)
    }
  }else{
    this.config.veryOpen = false
    var that = this
    config.write(
      config.getBody().replace( "PrivateWiki", "PrivateMentorWiki"),
      Contexted( this, function( err ){
        if( err ){
          that.error( "cannot write:", config)
        }else{
          that.de&&bug( "success in changing ownership")
        }
      })
    )
  }
}

Wiki.wikinamize = function( name, prefix, postfix ){
// Turn a text into a valid, "nice to read", wiki name
// ToDo: Refactor into multiple methods, this one is too complex
  // If in cache, cool
  var cached
  if( !prefix && !postfix && (cached = Sw.wikinamizeCache[name]) ){
    return cached
  }
  // If already a valid wiki word, no need to dig further
  if( SW.wikiword.test( name) ){	  
    if( !prefix && !postfix ){
      Sw.wikinamizeCache[name] = name
    }
    return name
  }
  NDe&&bug( "Wikinamize ", name, ", prefix: ", prefix, ", suffix: ", postfix)  
  var text = name
  // Get rid of invalid characters, slightly brutal...
  text = text.replace( /[^#@A-Za-z_0-9]/g, "_")
  if( De && text != name ){
    this.de&&bug( "Became:", text)
  }
  if( !text ){
    text = "WikiWord"
  }
  // Turn first character to uppercase when appropriate
  text = text.substr( 0, 1).toUpperCase() + text.substr( 1)
  // Turn next character in lowercase when appropriate
  if( !SW.wikiword.test( text) && text.length > 1 ){
    text = text.substr( 0, 1)
    + text.substr( 1, 1).toLowerCase()
    + text.substr( 2)
  }
  // If that is not enough, get rid of embedded @# & add some postfix
  if( !SW.wikiword.test( text) ){
    this.de&&bug( "Not enough:", text)
    // ToDo: do I really want to get rid of @, # and -, not sure...
    //text = text.replace( /@/g, "At")
    //.replace( /#/g, "Hash")
    //.replace( /-/g, "_")
    if( !SW.wikiword.test( text) ){
      this.de&&bug( "Still not enought: ", text)
      text = text.toLowerCase().capitalize() + (postfix ? postfix : "Page")
      if( !SW.wikiword.test( text) ){
        // That is enough, give up
        De&&bug( "Cannot wikinamize name:", name, ", not valid:", text)
        text = "WikiWord"
      }
    }
  }
  // Add prefix to now valid wiki word
  if( prefix && !prefix.starts( text) ){
    // If # twitter hashtag, turn into classic wikiword first
    if( false && text.substr( 0,1) == "@" ){
      text = text.substr( 1).capitalize()
    }else if( text.substr( 0, 1) == "#" ){
      text = text.substr( 1).capitalize()
    }
    text = prefix + text
  }else{
  }
  // Should be ok by now, restrict max length however and recheck
  // 320 is limit for a valid email address length
  if( text.length > 320 ){
    text = this.wikinamize( name.substr( 0, name.length - 1), prefix, postfix)
  }
  if( !prefix && !postfix ){
    Sw.wikinamizeCache[name] = text
  }
  if( De && text != name ){
    this.de&&bug( "Wikinamized ", name, " into ", text,
    ", prefix: ", prefix, ", suffix: ", postfix)
  }
  return text
}

// section: end wiki.js


// --------------
// section: scrollcue.js

// scrollcue.js
//
// JQuery plugin effect to make the screen easier to read when it is scrolled.
// It provides a visual clue that delimits the newly visible content.
//
// 09/29/2010, JeanHuguesRobert, based on previous work
// 10/09/2010, JHR, renamed from hotscroll to scrollcue
// 10/15/2010, JHR, with Jean Vincent, zIndex & image
//
// ToDo: it would be nice to be able to attach the effect to any element,
// not just the global window.
//
// License : VanityLicence
// (C) Copyright Virteal Jean Hugues Robert.
// ----
// http://virteal.com/VanityLicense
// Vanity License: You may take the money but I keep the glory.
// ----
//
// git://gist.github.com/639187.git
// http://gist.github.com/639187

Wiki.scrollcueScript = function sw_scrollcue( start ){

// New scope, it encloses everything
(function( $ ){

// Global options, default values
var ScrollCue = {

  // Color of the effect, that's rgba()'s first 3 parameters, last is computed
  color: "128, 128, 128", // Gray. Sorry, #AABBCC is not ok.

  // Maximal opacity of the effect. Effect fades away from this maximum to 0.
  opacity: 0.1, // Max is 1, for 100% opacity, very intruising
  
  // Duration of the effect, millisec
  duration: 1500,
  
  // Optional selector for elements to fade away when scrolling starts
  fade: null,	// I simply call .fadeTo( 0, 0) on these elements
  
  // max height of the visual cue. if none, goes up to top or down to bottom
  maxHeight: "3px",	// "px" preferred (see ToDo)
  
  // optional image, can be null
  image: "http://virteal.com/yanugred16.png",
  
  // optional zIndex (if you want the effect to not obscure some content)
  zIndex: null,
  
  // Version, read only
  version: "0.3"

}

// Global variables
var Visible     = false	// True until scrollTop stops moving
var StillTop    = 0	// Value of scrollTop when it started moving
var ScrollDelta = 0	// Current scrollTop delta with StillTop
var Generation  = 0	// Increases whenever effect starts or stops
var ClueDiv     = null	// Effect is a semi transparent horizontal div


// My debug darling, see http://virteal.com/DebugDarling
var de = false	// Please use true to display debug traces
var bug = window.bugC
|| (window.console && console.log 
  && function bug( m ){ console.log( "ScrollCue: " + m)})
|| (de = false)


function scroll(){
// This is the handler attached to the global window's scroll event

  // Init stuff first time we're called
  if( !ClueDiv ){
    // I create a rectangular div whose height may vary
    ClueDiv = document.createElement( "div")
    ClueDiv.style.position = "fixed";
    ClueDiv.style.left     = "0px"
    ClueDiv.style.width    = "100%"
    if( ScrollCue.zIndex ){
      ClueDiv.style.zIndex   = "-1"
    }
    if( ScrollCue.image ){
      ClueDiv.innerHTML = '<img src="' + ScrollCue.image + '"'
      + ' border="0" vspace="0" hspace="0">'
    }
    // Height is either up to top or down to bottom, unless there is a limit
    if( ScrollCue.maxHeight ){
      ClueDiv.style.maxHeight = ScrollCue.maxHeight
    }
    // During the effect the div is a semi transparent layer over content
    ClueDiv.style.display = "none"
    document.body.appendChild( ClueDiv)
  }
  
  // Where did the document scrolled to?
  var new_top = document.documentElement.scrollTop || document.body.scrollTop
  
  // What difference does it make with when document was still
  var new_delta = new_top - StillTop
  
  de&&bug( "still top: " + StillTop
    + ", new top: "      + new_top
    + ", old delta: "    + ScrollDelta
    + ", new delta: "    + new_delta
    + ", visible: "      + (Visible ? "true" : "false")
  )
  
  // If top was moving & there is a change in direction, abort previous effect
  if( Visible
  && ( (new_delta > 0 && ScrollDelta < 0)
    || (new_delta < 0 && ScrollDelta > 0))
  ){
    ScrollCue.abort()
    new_delta = ScrollDelta + new_delta
    de&&bug( "Scroll direction changed")
  }
  
  ScrollDelta = new_delta
  de&&bug( "top: " + new_top + ", ScrollDelta: " + ScrollDelta)
  
  // If motion starting...
  if( !Visible ){
    // Fade away things that don't need to be seen during scrolling
    if( ScrollCue.fade ){
      $(ScrollCue.fade).fadeTo( 0, 0)
    }
    // ToDo: should I "unfade" when effect is done?
  }
  
  // start/restart the effect (old generation effect will abort itself)
  effect_loop( (new Date().getTime()), ++Generation)
  
  function effect_loop( time_started, effect_generation ){
  
    // If a new effect was started, abort this one
    if( Generation != effect_generation )return

    // Adjust opacity as time passes, ends up transparent
    var new_time = (new Date()).getTime()
    var duration = new_time - time_started
    var opacity  = (ScrollCue.duration - duration) / 500

    // Are we done with the effect? is the document still again?
    // de&&bug( "opacity: " + opacity)
    if( opacity <= 0 ){
      ScrollCue.abort()
      // Set a new new start position for future effect
      StillTop = new_top
      de&&bug( "Still again, top: " + StillTop)
      return
    }

    // I display a semi opaque layer over some of the content
    if( ScrollDelta < 0 ){
      // Some new content appeared on the top of the screen
      if( ScrollCue.maxHeight ){
	// ToDo: should always substract the px height of maxHeight from top
	// but I don't know how to convert maxHeight into px units
	if( ScrollCue.maxHeight.substr( ScrollCue.maxHeight.length - 2)
	== "px"
	){
	 // Easy, px units, I adjust top
	  ClueDiv.style.top = ""
	  + ( -ScrollDelta 
	    - parseInt( ScrollCue.maxHeight.replace( "px", ""), 10))
	  + "px"
	}else{
	  // Not easy. I don't ajust top as I should...
          ClueDiv.style.top = "" + -ScrollDelta + "px"
	}
	ClueDiv.style.height = "" + -ScrollDelta + "px"
      // If no maxHeight, I display up to top of screen
      }else{
        ClueDiv.style.top = "0px"
        ClueDiv.style.height = "" + -ScrollDelta + "px"
      }
    }else{
      // Some new content appeared at the bottom of the screen
      var scr_h = window.innerHeight ? window.innerHeight : $(window).height()
      ClueDiv.style.top = "" + (scr_h - ScrollDelta) + "px"
      // I display down to bottom, unless Div's maxHeigth told otherwise
      ClueDiv.style.height = "" + ScrollDelta + "px"
    }

    ClueDiv.style.backgroundColor
    = "rgba(" + ScrollCue.color + "," + (ScrollCue.opacity * opacity) + ")"

    // Display layer if it was not visible already
    if( !Visible ){
      ClueDiv.style.display = ""
      Visible = true
      de&&bug( "visible")
    }

    // Keep the effect running, next step in 50 ms
    setTimeout( effect_loop, 50, time_started, effect_generation)
  }
}


ScrollCue.abort = function(){
// Abort the current ongoing effect.
// Note: this does not stop future effects on new scroll events
// ToDo: method to detach effect
  if( Visible ){
    // Hide semi transparent layer
    ClueDiv.style.display = "none"
    Visible = false
    de&&bug( "hidden")
  }
  // Tell ongoing effect() to stop asap
  ++Generation
  return ScrollCue
}


ScrollCue.start = function( options ){
// Attach the effect to the global window
  if( options ){ $.extend( ScrollCue, options) }
  ScrollCue.abort()
  // On the global window only
  $(window).scroll( scroll)
  return ScrollCue
}

// Exports scrollCue() jQuery method
$.scrollCue = ScrollCue.start

// End of scope
})( jQuery )

// Usage:
start && $.scrollCue() // {fade:".fade"})

} // end of Wiki.scrollcueScript()

// section: end scrollcue.js


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

Page.prototype = Page
MakeDebuggable( Page, "Page")

Page.assertIsPage = function(){
  // Help migrate from pagename strings to Page objects
  return true
}

Page.toString = function(){
  return this.name
  // return "<Page " + this.wiki.fullname() + " " + this.name + ">"
}

Page.fullname = function(){
  return this.wiki.fullname() + this.name
}

Page.getStore = function(){
  return this.wiki.pageStore
}

Page.getStoreUrl = function(){
  return this.getStore().getUrl( this.name)
}

Page.dump = function( sep ){
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

Page.get = function( key, visited ){
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

Page.set = function( key, value ){
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

Page.incarnFetch = function( body, proto, inherited, err ){
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
    De&&bug( this.wiki, ", inheritedIncarn: " + this.name)
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

Page.incarnRestore = function( body, inherited, err ){
// This method gets called when the raw body content of a page is fetched
// from the PageStore.
// It updates the non draft version of the page using that raw body.
// The raw body container a __ctx__ section.
// Returns either This or the non draft page if there is one.
  var page = this
  // Process context data
  var body_and_ctx = Wiki.extractContext( body, page)
  body = body_and_ctx.body
  var ctx = body_and_ctx.context
  // Always restore in the nondraft page if there is draft version now
  var was_draft = !!page.nondraft
  if( page.nondraft ){
    page.de&&bug( "Draft, restoreContext")
  }else{
    page.de&&bug( "restoreContext")
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
        page.de&&bug( "was draft, restoreContext, isn't anymore")
      }
    }else{
      if( page.nondraft ){
        page.de&&bug( "wasn't draft, restoreContext, became draft")
      }
    }
  }
  if( page.nondraft ){
    page.de&&bug( "Draft, incarned nondraft version")
    nondraft = page.nondraft
    De&&mand( page.nondraft.wasIncarned() )
    De&&mand( page.isDraft() )
  }else{
    page.de&&bug( "Incarned")
    nondraft = page
    De&&mand( page.wasIncarned() )
    De&&mand( !page.isDraft() )
  }
  return nondraft
}

Page.incarnBody = function( body, err ){
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

Page.incarnErr = function( err ){
  this.err = err
}

Page.incarnDraft = function(){
  this.de&&mand( !this.isDraft() )
  var page = this.nondraft = new Page( this.wiki, this.name)
  page.de&&mand( !page.isDraft() )
  page.incarnFromPage( this)
}

Page.incarnFromPage = function( from, with_body ){
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

Page.incarnUpdate = function( from ){
// If page is a draft, reincarn it using fresh data from store
// "from" defaults to current non draft page
// Note: draft body is kept of course
  if( !this.isDraft() )return
  this.incarnFromPage( from || this.nondraft)
}

Page.wasStored = function(){
// Returns true if page is known to exists in store, presumably with
// same content as local body.
// Returns false if page is not in synch with store, ie when page is dirty.
// Returns false if some error occured when last read or write was attempted.
// Returns true if page is beeing synchronized with store, ie isPending()
// Note: this is optimistic, but anyway there is nothing sane to do until the
// pending result is delivered.
  return !!(this.body && (!this.err || this.isPending()))
}
Page.declareIdempotentPredicate( "wasStored")

Page.isDirty = function(){
// Returns true if local content is not in synch with store
  return this.err == "dirty"
}

Page.setDirty = function(){
  this.err = "dirty"
}

Page.isPending = function(){
// Returns true if some IO is going on (read or write) with the result pending
  return this.err == "pending"
}

Page.setPending = function(){
  this.err = "pending"
}	

Page.dequeueCb = function( err ){
  if( this.queuedRequest.length == 0 ){
    this.err = err
    return
  }
  var cb = this.queuedRequest.shift()
  cb.call( this)
}

Page.isVirtual = function(){
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

Page.isVirtualStore = function(){
// A virtual store page is a page that contains other pages, so called virtual
// page. These page are either small or frequently accessed page associated to
// the wiki. This includes all the pages that are preloaded when a wiki is
// is initialized.
  return this.isContainer
}

Page.getVirtualBody = function( name ){
// Return the (JSON) content of a virtual page
  this.isContainer = true
  return this.get( "Page" + name)
}

Page.setVirtualBody = function( name, body ){
// Set the (JSON) content of a virtual page
  this.isContainer = true
  return this.set( "Page" + name, body)
}

Page.devirtualize = function( cb ){
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

Page.virtualize = function( container, cb ){
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

Page.read = function( cb, local ){
// Get content from store or cache, then call cb( err, page)
// If page is a draft, content is put in the attached non draft page

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

Page.write = function( body, cb ){
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
    this.store_de&&bug( "Virtual write, into:", this.containerPage)
    var ctx = this.saveContext()
    var jsonbody = JSON.stringify( Wiki.injectContext( this))
    this.containerPage.setVirtualBody( this.name, jsonbody)
    // Deal with "AboutXxxx" proto data
    return this.wiki.fixProto( this, function(){
      // If content is stored in PrivateContext, writes are buffered
      if( that.containerPage == that.wiki.contextPage ){
        that.containerPage.touch()
        that.wiki.touch( that.containerPage) // hard. ToDo: understand bug
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

Page.wasIncarned = function(){
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
Page.declareIdempotentPredicate( "wasIncarned")

Page.isVoid = function(){
// Returns true if page is empty
// Returns false if page's body is unknown because page was never incarned
// See also .isNull()
  return this.wasIncarned() && this.getBody().length === 0
}
Page.declareIdempotentPredicate( "isVoid")

Page.wasDeleted = function(){
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
Page.declareIdempotentPredicate( "wasDeleted")

Page.isNull = function(){
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
Page.declareIdempotentPredicate( "isNull")

Page.resetLinks = function(){
// Forget about links from this page to other pages.
// This is called when the page is displayed, prior to calls to
// Session.trackBacklink(), that in turn calls Page.trackLinkTo()
  this.links = {}
}

Page.getLinks = function(){
  var list = []
  for( var item in this.links ){
    list.push( item)
  }
  return list.sort()
}

Page.getBacklinks = function( with_private ){
  var list = []
  this.wiki.forEachBacklink( this, with_private, function( referer ){
    list.push( referer.name)
  })
  return list.sort()
}

Page.trackLinkTo = function( otherpage ){
// Track link from this page to some other page. Does not track the
// corresponding back link.
// Private. Called by Session.trackBacklink( page, referer)
  this.links[otherpage.name] = otherpage
}

Page.linksTo = function( otherpage ){
// Check if there is a known link in this page to the other page
// Note: this is based on what was tracked when the page was last displayed
  return !!this.links[otherpage.name]
}

Page.trackVisit = function( from_page ){
  
}

Page.getBody = function( nondraft ){
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

Page.getNondraftBody = function(){
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
Page.declareIdempotentGetter( "getNondraftBody")

Page.touch = function(){
  this.wiki.touch()
  return 
}

Page.isParent = function(){
  return this.kindIs( "Parent")
}
Page.declareIdempotentGetter( "isParent")


Page.getParentPageName = function(){
  if( !this.isParent() )return this.name
  return this.name.substr( "Parent".length)
}
Page.declareIdempotentGetter( "getParentPageName")

Page.wasInherited = function(){
  return !!this.inherited
}
Page.declareIdempotentPredicate( "wasInherited")

Page.isDraft = function(){
// Returns true if page is a "draft"
// Note: all draft pages have a "nondraft" property
  return !!this.nondraft
}
Page.declareIdempotentPredicate( "isDraft")

Page.draft = function(){
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
  this.de&&bug( "draft original is kept")
  if( !p.nondraft.wasIncarned() ){
    this.de&&bug( "not incarned original, page:", p)
  }else{
    this.de&&bug( "incarned original, page:", p)
  }
  this.wiki.trackDraftPage( this)
  De&&mand( page.nondraft )
  De&&mand( this.isDraft() )
  return this
}

Page.stamp = function(){
// Forget "non draft" version of a page.
  if( !this.isDraft() )return false
  this.nondraft = null
  this.wiki.trackDraftPage( this)
  return true
}

Page.undraft = function(){
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

Page.setVisitor = function( session ){
  this.setLastSession( session)
  return this
}
  
Page.session = function(){
// Returns user session if page is a user name
  return this.wiki.getSession( this.name)
}
Page.declareIdempotentGetter( "session")

Page.setLastSession = function( session ){
  if( session.isBot )return
  if( session != this.lastSession ){
    this.countVisits++
  }
  this.lastSession = session
  this.timeLastSession = Sw.timeNow
  this.touch()
  return this
}

Page.lastVisit = function(){
  return this.lastSession
}
Page.declareIdempotentGetter( "lastVisit")

Page.visitCount = function(){
  return this.countVisits
}
Page.declareIdempotentGetter( "visitCount")

Page.lastVisitor = function(){
// Returns userName() of last visitor
  var session = this.lastVisit()
  return session ? session.userName() : this.lastVisitorName
}
Page.declareIdempotentGetter( "lastVisitor")

Page.timeVisited = function(){
  return this.timeLastSession
}
Page.declareIdempotentGetter( "timeVisited")

Page.setWriter = function( username ){
  NDe&&bug( "Set writer on ", this, " to ", username)
  this.lastWriterName = username
  this.timeLastModified = Sw.timeNow
  this.touch()
}

Page.lastWriter = function(){
  return this.lastWriterName
}
Page.declareIdempotentGetter( "lastWriter")

Page.timeModified = function(){
  return this.timeLastModified
}
Page.declareIdempotentGetter( "timeModified")

Page.isHot = function( ignore_sessions ){
// A page is "hot" when some activity occured about it recently
// Note: hot => !cold but the inverse is not true because in addition
// to not beeing "hot" a "cold" page must also have received no visitors
// for some time.
  var session = this.session()
  // User page have .session attached, if session is alive, page is hot
  if( !ignore_sessions && session && !session.isAway() ){ return true }
  return !!this.wiki.allHotPages[this.name]
}
Page.declareIdempotentPredicate( "isHot")

Page.setHot = function( restore ){
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

Page.clearHot = function(){
  if( !this.wiki.allHotPages[this.name] )return false
  delete this.wiki.allHotPages[this.name]
  return true
}

Page.isCold = function(){
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
Page.declareIdempotentPredicate( "isCold")

Page.trash = function(){
// Get rid of "draft" content, get back to previous stamped page
  if( this.isDraft() ){
    this.undraft() 
    return true
  }
  return false
}

Page.kindIs = function( kind ){
  if( !this.cachedKinds ){ this.cachedKinds = {} }
  var cached // = this.cachedKinds[kind]
  if( cached === true || cached === false )return cached
  return this.cachedKinds[kind] = (kind.starts( this.name)
  && ( this.name.substr( kind.length, 1)
    == this.name.substr( kind.length, 1).capitalize()
    || "@".ends( this.name)  // Facebook name, as in Usertest@
    || "In".ends( this.name) // LinkedIn name, as in UsertestIn
    || (this.name.includes( "@") && this.name.includes( ".")) // MailIdx@y.z
    || this.name.includes( "_") // DropboxIdssssssss_pppppppp
  ))
}

Page.getKinds = function(){
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

Page.isPublic = function(){
  return this.kindIs( "Public")
}
Page.declareIdempotentPredicate( "isPublic")

Page.isUser = function(){
  return this.kindIs( "User")
  || this.kindIs( "CopyUser")
}
Page.declareIdempotentPredicate( "isUser")

Page.userName = function(){
  return this.kindIs( "User") ? this.name.substr( "User".length) : ""
}

Page.isUserId = function(){
// Returns true if page describes a User (see that class)
  return this.kindIs( SW.name + "Id")
  ||     this.kindIs( "TwitterId")
  ||     this.kindIs( "FacebookId")
  ||     this.kindIs( "LinkedInId")
  ||     this.kindIs( "MailId")
  ||     this.kindIs( "DropboxId")
}

Page.getService = function(){
// Returns the service that the user id page references.
// Returns "" if page is not a user id page.
  if( !this.isUserId() ){
    this.bug_de&&bug( "Attempt to get service on non user id page")
    return ""
  }
  var ii = this.name.indexOf( "Id")
  return this.name.substr( 0, ii)
}

Page.getId = function(){
// Returns the id part of a user id page. This is the unique id local to
// the service. For "Mail", this is the mail address.
  if( !this.isUserId() )return ""
  var ii = this.name.indexOf( "Id")
  return this.name.substr( ii + "Id".length)
}

Page.isShortName = function(){
  return this.isTwitterUser()
}

Page.isName = function(){
  return this.isShortName()
  ||     this.isFacebookUser()
  ||     this.isLinkedInUser()
  ||     this.isUserId()
}

Page.getName = function(){
  return this.isName() ? this.name : ""
}

Page.isTwitterUser = function(){
  if( this.isSpecial() )return false
  var is_it = !!this.name.match( /^@[^@#-]*$/)
  // ToDo: cache
  return is_it
}

Page.isFacebookUser = function(){
  if( this.isSpecial() )return false
  var is_it = !!this.name.match( /^[^@#-]*@$/)
  // ToDo: cache
  return is_it
}

Page.isLinkedInUser = function(){
  if( this.isSpecial() )return false
  var is_it = !!this.name.match( /^[^@#-]*In$/)
  // ToDo: cache
  return is_it
}

Page.isTag = function(){
  if( this.name.charAt( 0) === "#" )return true
  return this.kindIs( "Tag") || this.kindIs( "Category")
}
Page.declareIdempotentPredicate( "isTag")

Page.isBot = function(){
  return "BotGuest".ends( this.name) || "Bot".ends( this.name)
}
Page.declareIdempotentPredicate( "isBot")

Page.frontLine = function( alternate_text ){
  return (!this.wasIncarned() || this.isVoid() || this.wasDeleted())
  ? ""
  : (this.getBody() || alternate_text).frontLine() 
}

Page.getUsers = function( alternate_text ){
// Returns the space separated list of user names that
// is the content of the first line of the page.
// Only "User" and "Code" pages contains such a list. 
  if( !this.isUser() && !this.isCode() ){ return "" }
  return this.frontLine( alternate_text)
  .trim().replace( /,/g, " ").replace( /"  "/g, " ")
}
Page.declareIdempotentGetter( "getUsers")

Page.getFirstUser = function(){
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
Page.declareIdempotentGetter( "getFirstUser")

Page.isMentorCode = function(){
  if( !this.isCode() )return false
  return this.getUsers().includes( "Mentor")
}
Page.declareIdempotentPredicate( "isMentorCode")

Page.getSource = function(){
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
Page.declareIdempotentGetter( "getSource")

Page.isCopy = function(){
  return this.kindIs( "Copy")
}
Page.declareIdempotentPredicate( "isCopy")

Page.isRestore = function(){
  return this.kindIs( "UserRestore")
}
Page.declareIdempotentPredicate( "isRestore")

Page.isPrivate = function(){
  return this.kindIs( "Private")
  || this.kindIs( "Mentor")
  || this.kindIs( "CopyPrivate")
  || this.kindIs( "CopyMentor")
}
Page.declareIdempotentPredicate( "isPrivate")

Page.isMember = function(){
  return this.kindIs( "Member")
  || this.kindIs( "Membre")
  || this.kindIs( "CopyMember")
  || this.kindIs( "CopyMembre")
}
Page.declareIdempotentPredicate( "isMember")

Page.isDeletion = function(){
  return this.kindIs( "Deleted")
}
Page.declareIdempotentPredicate( "isDeletion")

Page.isAbout = function(){
// "about" pages are pages with "proto" data about them
// The data comes from another page, specified on the first line
  return (this.kindIs( "About") && this.name != "AboutUs")
  ||      this.kindIs( "Super")
}
Page.declareIdempotentPredicate( "isAbout")

Page.isSecret = function(){
  return this.kindIs( "Secret")
  || this.kindIs( "CopySecret")
}
Page.declareIdempotentPredicate( "isSecret")

Page.isMap = function(){
  return this.kindIs( "Map")
  || this.kindIs( "Carte")
  || this.kindIs( "CopyMap")
  || this.kindIs( "CopyCarte")
}
Page.declareIdempotentPredicate( "isMap")

Page.isToc = function(){
  return this.kindIs( "Toc")
}
Page.declareIdempotentPredicate( "isToc")

Page.isLocal = function(){
  return this.kindIs( "Local")
}
Page.declareIdempotentPredicate( "isLocal")

Page.isYour = function(){
  return this.kindIs( "Your")
  ||     this.kindIs( "Tu")
}
Page.declareIdempotentPredicate( "isYour")

Page.isThis = function(){
  return this.kindIs( "This")
  ||     this.kindIs( "Ista")
}
Page.declareIdempotentPredicate( "isThis")

Page.isRead = function(){
  return this.kindIs( "Read")
  ||     this.kindIs( "Lire")
}
Page.declareIdempotentPredicate( "isRead")

Page.isDo = function(){
  return this.kindIs( "Do")
  ||     this.kindIs( "Op")
}
Page.declareIdempotentPredicate( "isDo")

Page.isToDo = function(){
  return this.kindIs( "ToDo")
  ||     this.kindIs( "OpOp")
}
Page.declareIdempotentPredicate( "isToDo")

Page.getToDo = function(){
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
Page.declareIdempotentGetter( "getToDo")

Page.isHelp = function(){
  return this.kindIs( "Help")
  || this.kindIs( "Aide")
}
Page.declareIdempotentPredicate( "isHelp")

Page.isCode = function(){
  return "Code".starts( this.name)
}
Page.declareIdempotentPredicate( "isCode")

Page.getCode = function(){
  if( !this.isCode() ){ return "" }
  return this.name.substr( "Code".length)
}
Page.declareIdempotentGetter( "getCode")

Page.isHtml = function(){
  return this.kindIs( "Html")
}
Page.declareIdempotentPredicate( "isHtml")

Page.isHome = function(){
  return this === this.wiki.homePage
}
Page.declareIdempotentPredicate( "isHtml")

Page.isGuest = function(){
  return this.kindIs( "Guest")
  ||     this.kindIs( "Visiteur")
}
Page.declareIdempotentPredicate( "isGuest")

Page.isStamps = function(){
  return "Stamps".ends( this.name)
}
Page.declareIdempotentPredicate( "isStamps")

// ToDo: Chat pages
// See long polling https://github.com/yojimbo87/minotaur
// Or Video Chat maybe, http://code.google.com/p/tokboxapi/wiki/CallWidget
Page.isChat = function(){
  return "Chat".ends( this.name)
}
Page.declareIdempotentPredicate( "isChat")

Page.isSpecial = function(){
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
Page.declareIdempotentPredicate( "isSpecial")

Page.isSensitive = function(){
  return this.isUser()
  || this.isCode()
  || this.isMap()
  || this.isSecret()
  || this.isPrivate()
  || this.isCopy()
  || this.isDeletion()
}
Page.declareIdempotentPredicate( "isSensitive")

Page.isTweet = function(){
  return this.name.includes( "Tweet")
}
Page.declareIdempotentPredicate( "isTweet")

Page.isAngular = function( with_to_do ){
// Is angular if name says so unless data says otherwise
  if( this.kindIs( "Angular") )return true
  if( this.data && this.data.isNotAngular )return false
  if( this.data && this.data.isAngular    )return true
}
Page.declareIdempotentPredicate( "isAngular")

Page.needsAngular = function(){
// DoAngular pages need angular.js when run, but ToDo do too
  if( this.kindIs( "DoAngular") )return true
  if( !this.kindIs( "ToDo")     )return false
  if( this.data && this.data.isNotAngular )return false
  if( this.data && this.data.isAngular    )return true
  return true
}
Page.declareIdempotentPredicate( "needsAngular")

Page.isCss = function(){
// Is CSS if name says so unless data says otherwise
  return (
    (this.name.includes( "Style") && !(this.data && this.data.isNotCss))
    || (this.data && this.data.isCss)
  )
}
Page.declareIdempotentPredicate( "isCss")

Page.isLessCss = function(){
  return this.data && this.data.isLess
}

Page.isMarkdown = function(){
  if( typeof( this.withMarkdown) !== "undefined" ){
    if( this.data && this.data.isNotMarkdown ){
      this.withMarkdown = false
      return false
    }
    return this.withMarkdown
  }
  if( this.data && this.data.isNotMarkdown )return false
  if( (this.data && this.data.isMarkdown)
  || (this.getBody() && (this.getBody().indexOf( "mrkdwn") >= 0))
  ){
    this.withMarkdown = true
    return true
  }else{
    this.withMarkdown = false
    return false
  }
}

Page.isProxy = function(){
  return this.kindIs( "Proxy")
}
Page.declareIdempotentPredicate( "isProxy")

Page.getProxy = function(){
  return this.isProxy() ? this.frontLine() : ""
}


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

Page.saveContext = function(){
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

Page.restoreContext = function( ctx, source ){
// This method gets called when a page is loaded from store or when a
// wiki is started (source == "wiki").
// It restore some informations about the page, when it was accessed,
// who last changed it, when, etc...
// It uses context information that was injected into the page's body when
// the page is stored or some other source (PrivateContext).
// This is done to bufferize changes and avoid writes to too many pages.
  if( !ctx )return
  this.deep_context_de&&bug( "restoreContext:", Sys.inspect( ctx))
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
    this.inherited = this.wiki.parentWiki.lookupPage( this.name)
  }
  if( ctx.draft ){
    this.context_de&&bug( "restore draft")
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

// section: end pagectx.js

// section: end page.js

// -------------------
// section: user.js
// Class User
//
// There are two kinds of users, local and proxy users. Proxy users are
// users of some external service like twitter, mail, facebook...
//
// A SimpliWiki user, aka a "local" user, has:
//  an id, a 3Code
//  a "user" user, if some user object merging occured
//  a "premium" flag for premium users
//  a default username, that can be overriden on a per wiki basis
//  a default userlabel, equal to the username unless otherwise specified
//  a personnal wiki, named after the id
//  a list of wikis that the user has had some interaction with, with a date
//  an associated primary Facebook proxy user, maybe
//    & secondary Facebook proxy users, maybe
//  an associated primary LinkedIn proxy user, maybe
//    & secondary LinkedIn proxy users, maybe
//  an associated primary Twitter proxy user, maybe
//    & secondary Twitter proxy users, maybe
//  an associated primary Mail proxy user, maybe
//    & secondary Mail proxy users, maybe
//
// A Facebook user has:
//  a facebook id
//  a username maybe, @ terminated
//  a userlabel, that is the user's full name usually
//  an associated simpliwiki "local" user
//
// A LinkedIn user has:
//  a linkedin id
//  a username maybe, In terminated
//  a userlabel, that is the user's first name + last name
//  an associated simpliwiki "local" user
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
    }else if( service == "Facebook" ){
      this.name = username + "@"
    }else if( service == "LinkedIn" ){
      this.name = username + "In"
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
  this.isLocal = (service == SW.name)
  this.local = this.isLocal ? this : null
  this.page = wiki.lookupPage( service + "Id" + id)
  this.page.user = this
  if( this.isLocal ){
    this.page.localUser = this
  }
  this.user_de&&bug( "New User")
}
MakeDebuggable( User, "User")
User.prototype = User

User.assertIsUser = function(){ return true }

User.toString = function(){
  return "<U "
  + this.service.substr( 0, 1)
  + this.id[this.service][0]
  + ">"
}

User.dump = function(){
  var buf = [this.toString()]
  for( var item in this.id ){
    buf.push( item + "=" + this.id[item].join( " "))
  }
  return buf.join( ",")
}

User.saveContext = function(){
  var ctx = {
    id: this.id,
    name: this.name,
    label: this.label,
    service: this.service
  }
  return ctx
}

User.reset = function(){
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

User.lookupByPage = function( wiki, page ){
  var service = page.getService()
  var id      = page.getId()
  if( !service || !id )return null
  return User.lookup( wiki, service, id)
}

User.getId = function(){
// Returns the string id of this user, local to the service she/he belongs to.
// If user is a local user, id is a 3Code.
// If user is a proxy, id is a twitter name if user is a twitter user, a mail
// if user is a mail user, etc
  return this.id[this.service][0]
}

User.getName = function(){
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
    }else if( service == "Facebook" ){
      // Better a name than none, better a new name than digits
      if( !name
      || /\d*/.test( name.replace( "@", ""))
      ){
        name = id + "@"
      }
    }else if( service == "LinkedId" ){
      // Better a name than none, better a new name than digits
      if( !name
      || /\d*/.test( name.replace( /In$/, ""))
      ){
        name = id + "In"
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

User.getServiceId = function(){
// Returns the service name concatenated with the id
// Format: sssssIdiiii
  return this.service + "Id" + this.id[this.service][0]
}

User.getService = function(){
// Return which service this user belongs to.
// ie. returns "Twitter" if twitter user, "Mail" if mail user, etc
  return this.service
}

User.getName = function(){
  return this.user
}

User.getLabel = function(){
  this.test_de&&bug( "getLabel:", this.label)
  return this.label
}

User.setLabel = function( label ){
  if( label != this.label ){
    this.label = label
    this.touch()
  }
}

User.getLocalId = function(){
  return this.isProxy()
  ? this.getPrimaryId( SW.name)
  : this.id[SW.name][0]
}

User.getTwitterId = function(){
  return this.isTwitter()
  ? this.id["Twitter"][0]
  : this.getPrimaryId( "Twitter")
}

User.getFacebookId = function(){
  return this.isFacebook()
  ? this.id["Facebook"][0]
  : this.getPrimaryId( "Facebook")
}

User.getLinkedInId = function(){
  return this.isLinkedIn()
  ? this.id["LinkedIn"][0]
  : this.getPrimaryId( "LinkedIn")
}

User.getMailId = function(){
  return this.isMail()
  ? this.id["Mail"][0]
  : this.getPrimaryId( "Mail")
}

User.getDropboxId = function(){
  return this.isDropbox()
  ? this.id["Dropbox"][0]
  : this.getPrimaryId( "Dropbox")
}

User.isLocalOnly = function(){
  this.de&&mand( !this.isProxy() )
  return !this.getTwitterId()
  && !this.getFacebookId()
  && !this.getLinkedInId()
}

User.isReady = function(){
// User is "ready" when the corresponding local user is identified.
  return !!(this.local)
}

User.isPremium = function(){
  return this.premium
}

User.logout = function( loop ){
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

User.trackVisit = function( session ){
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
    code:  (session.loginWithCode ? session.loginCode : ""),
    time:  Sw.dateNow.toISOString()
  }
  this.save( function( err ){
    if( err ){
      // ToDo: err
    }
  })
}

User.getVisits = function(){
// Returns the hash that contains the visits
  this.de&&mand( !this.isProxy() )
  return this.visits
}

User.getSortedVisits = function(){
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

User.isProxy = function(){
// A "proxy" user is a user that belongs to either Twitter, Facebook or mail.
  return !this.isLocal
}

User.isDeprecated = function(){
// A local user becomes deprecated after a merging due to a conflict
  this.de&&mand( this.isLocal )
  return !!this.update
}

User.is = function( service ){
  return this.service == service
}

User.getPrimaryId = function( service ){
  return this.isProxy()
  ? this.local.getPrimaryId( service)
  : this.id[service] ? this.id[service][0] : ""
}

User.getIds = function( service ){
  return this.isProxy()
  ? this.local.getIds( service)
  : this.id[service] ? this.id[service].slice( 0) : []
}

User.getOwnIds = function( service ){
  return this.id[service] ? this.id[service].slice( 0) : []
}

User.hasId = function( service, id ){
  this.de&&mand( service )
  this.de&&mand( id )
  if( this.service == service )return this.id[service][0] == id
  var ids = this.getIds( service)
  return ids.indexOf( id) >=  0
}

User.hasOwnId = function( service, id ){
  if( this.service == service )return this.id[service][0] == id
  var ids = this.getOwnIds( service)
  return ids.indexOf( id) >=  0
}

User.getSecondaryIds = function( service ){
  return this.getIds( service).slice( 1)
}

User.setPrimaryId = function( service, id ){
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

User.addId = function( service, id ){
// Add an id for the specified service.
// If this is the first id added for that service, it is the primary id.
// Else, it is a secondary id.
  this.de&&mand( service )
  this.de&&mand( id )
  var ids = this.getOwnIds( service)
  var ii = ids.indexOf( id)
  if( ii >= 0 )return this
  this.deep_user_de&&bug( "Adding, service:", service, "id:", id)
  ids.push( id)
  this.id[service] = ids
  return this
}

User.addSecondaryId = function( service, id ){
// Add a secondary id for the specified service.
// The specified id must no be the existing primary id.
  this.de&&mand( !this.isProxy() )
  this.de&&mand( id != this.getPrimaryId( service) )
  return this.addId( service, id)
}

User.clearId = function( service, id ){
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

User.clearSecondaryId = function( service, id ){
  this.de&&mand( !this.isProxy() )
  this.de&&mand( id != this.getPrimaryId( id) )
  return this.clearId( service, id)
}

User.clearPrimaryId = function( service ){
  this.de&&mand( !this.isProxy() )
  return this.clearId( this.getPrimaryId( service))
}

User.getAllOtherIds = function(){
// Returns all the ids for all the other services
// Returns { s2[id1, id2, ...], s3...}
// For proxies, delegates to local user
  this.de&&mand( !this.isProxy() )
  var ids = SW.copyHash( this.id)
  delete ids[this.service]
  return ids
}

User.getOtherIds = function( service ){
// Returns the ids in other (non local) services, as a list
// Returns null if none
  return this.getAllOtherIds[service]
}

User.isEmpty = function(){
// A User is empty if it does not reference some other user
  var size = 0
  for( var key in this.id ){
    size++
    // Not empty if at least 2 services
    if( size > 1)return false
  }
  return true
}

User.assertLocalNotEmpty = function(){
  if( !this.isProxy() && !this.isEmpty() )return
  this.bug_de&&bug( "unexpected empty user")
  this.de&&mand( false )
}

User.isTwitter = function(){
// True if user is a proxy that belongs to Twitter
  return this.isProxy() && this.service == "Twitter"
}

User.isFacebook = function(){
// True if user is a proxy that belongs to Facebook
  return this.isProxy() && this.service == "Facebook"
}

User.isLinkedIn = function(){
// True if user is a proxy that belongs to Facebook
  return this.isProxy() && this.service == "LinkedIn"
}

User.isMail = function(){
// True if user is a proxy that has a mail address
  return this.isProxy() && this.service == "Mail"
}

User.isDropbox = function(){
// True if user is a proxy that has a Dropbox token
  return this.isProxy() && this.service == "Dropbox"
}

User.touch = function(){
// Track a change so that .save() knows it has to persist it.
  this.deep_user_de&&bug( "touched")
  this.isDirty = true
}

User.load = function( cb ){
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

User.restoreUserContext = function(){
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

User.save = function( cb ){
// Persists changes, if any, into the user's page.
// If user is a proxy, local user is saved too if it is know.
// Invokes cb( 0, user, page) or cb( err, user, page) on error.
  var that = this
  // There is no point in saving an half baked user
  this.de&&mand( !this.isEmpty(), "half baked" )
  function saved( err, page ){
    that.isDirty = !!err
    if( that.isProxy() && that.local ){
      return that.local.save( function( lerr, luser, lpage ){
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

User.set = function( key, value ){
  this.de&&mand( this.isLoaded )
  this.de&&mand( this.page.wasIncarned() )
  var old_value = page.get( key)
  if( value != old_value ){
    page.set( key, value)
    this.deep_user_de&&bug( "set:", key, "to:", value)
    this.isDirty = true
  }
}

User.get = function( key ){
  return this.page.get( key)
}

User.trackServiceId = function( service, id, cb ){
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
    // Add service id if needed
    if( !user.hasOwnId( service, id) ){
      user.user_de&&bug( "track new other, service:", service, "id:", id)
      user.addId( service, id)
      user.touch()
    }
    // Update bidirectional relationship. If no other User, create a new one
    if( user.isEmpty() ){
      // If proxy user id is missing... it is beeing created by whoever called me
      if( that.id[SW.name] && that.id[SW.name][0] ){
        // User will be saved later, when not empty
        user.de&&mand( !user.isDirty )
        that.deep_user_de&&bug( "track, half baked")
        return cb.call( that, 1, user, user)
      }else{
        // No local user yet, set one, random. ToDo: collision avoidance
        var random = Wiki.random3Code()
        that.user_de&&bug( "new local random id:", random)
        user.addId( SW.name, random)
        user.touch()
      }
    }
    user.save( function( serr, saved_user, page ){
      de&&mand( saved_user == user )
      user.de&&mand( serr || !user.isDirty, "dirty" )
      // Create a bi-directional relationship
      var otheruser
      if( user.isLocal ){
        otheruser = User.lookup( that.wiki, service, id).user
      }else{
        de&&mand( user.id[SW.name])
        otheruser = User.lookup( that.wiki, SW.name, user.id[SW.name][0]).user
      }
      user.deep_user_de&&bug( "track other:", otheruser)
      // If no other user, done
      if( user == otheruser ){
        return cb.call( that, err || serr, user, user)
      }
      user.de&&mand( user != otheruser, "same user")
      otheruser.load( function( serr1 ){
        if( !otheruser.hasOwnId( user.getService(), user.getId()) ){
          otheruser.user_de&&bug( "track back new other:", user)
          otheruser.addId( user.getService(), user.getId())
          otheruser.touch()
        }
        otheruser.save( function( serr2, _, page ){
          otheruser.de&&mand( serr2 || !otheruser.isDirty, "dirty" )
          if( user.isLocal ){
            otheruser.de&&mand( !otheruser.isLocal )
            otheruser.local = user
            cb.call( that, err || serr || serr1 || serr2, user, otheruser)
          }else{
            otheruser.de&&mand( otheruser.isLocal )
            user.local = otheruser
            cb.call( that, err || serr || serr1 || serr2, otheruser, user)
          }
        })
      })
    })
  })
}


User.trackTwitterId = function( id, cb ){
// Track the user's twitter id
  this.trackServiceId( "Twitter", id, cb)
}

User.trackFacebookId = function( id, cb ){
// Track the user's facebook id
  this.trackServiceId( "Facebook", id, cb)
}

User.trackLinkedInId = function( id, cb ){
// Track the user's linkedin id
  this.trackServiceId( "LinkedIn", id, cb)
}

User.trackMailId = function( id, cb ){
// Track the user's mail id
  this.trackServiceId( "Mail", id, cb)
}

User.trackDropboxId = function( id, cb ){
// Track the user's dropbox id
  this.trackServiceId( "Dropbox", id, cb)
}

User.trackLocalId = function( id, cb ){
// Associate a proxy user with it's local user account
  this.trackServiceId( SW.name, id, cb)
}

User.getLocal = function( cb, seen ){
// Get the local user, works on proxy users.
// Invokes cb( 0, local_user), cb( err, local_user) on error.
// When the callback is called, the User object is fully loaded(), ie. .load()
// was invoked.
  var that = this
  this.de&&mand( this.page.user == this )
  // First, load whatever proxy or local object we have
  this.load( function get_local_load_cb( err, userpage ){
    seen || (seen = {})
    // If loaded object is local, almost done
    if( that.isLocal ){
      // Deal with deprecated local users (after merging)
      if( that.update ){
        if( seen[that.update] ){
          that.bug_de&&bug( "Loop with user")
          return cb.call( that, err, that, that)
        }
        var valid_user = User.lookup( that.wiki, SW.name, that.update)
        that.de&&mand( valid_user.isLocal )
        valid_user.getLocal( cb)
      }
      if( that.page ){
        that.page.localUser = that
      }
      return cb.call( that, err, that, that) 
    }
    // Loaded object is a proxy, let's see how to get to the local User
    // When no local User, allocate one
    if( !that.id[SW.name] || !that.id[SW.name][0] ){
      // that.de&&mand( false, "missing local id")
      // No local user yet, set one, random. ToDo: collision avoidance
      var random = Wiki.random3Code()
      that.user_de&&bug( "new local random id:", random)
      that.trackServiceId( SW.name, random, function( err, local_user){
        that.de&&mand( local_user.isLocal)
        if( that.page ){
          that.page.localUser = local_user
        }
        return cb.call( that, err, local_user)
      })
      return
    }
    that.de&&mand( that.id[SW.name],    "no ids for "  + SW.name )
    that.de&&mand( that.id[SW.name][0], "no id 0 for " + SW.name )
    // There is an existing "local" User object, let's get it
    if( !that.local ){
      that.local = User.lookup( that.wiki, SW.name, that.id[SW.name][0]).user
    }
    that.local.de&&mand( !that.local.isProxy() )
    that.local.getLocal( cb )
  })
}

User.getHomepage = function( cb ){
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

User.mergeWith = function( other ){
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

User.test = function(){

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

    wiki.setTestPage( SW.name + "Id" + "333333333")
    wiki.setTestPage( "FacebookIdFbtest1")
    wiki.setTestPage( "TwitterIdTwtest1")

    testuserpage = User.lookup( wiki, SW.name, "333333333")
    p( "Here is the test user's page:", testuserpage)
    testuserpage.assertIsPage()
    eq( testuserpage, User.lookup( wiki, SW.name, "333333333") )

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
          user.trackTwitterId( "Twtest1",
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
    ses.loginCodePage = wiki.lookupPage( "CodeF333333333")
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

// section: end user.js


// -------------------
// section: session.js
// Class Session
//
// A session object tracks the connection between a web browser user and
// SimpliWiki. The same web browser can be involved in multiple session,
// typically with multiple wikis. Sometimes the user behing the web browser
// is identified, or even authenticated (twitter, facebook), sometimes she
// just provided some comment about her, not enough to uniquely identify
// her, sometimes the user is totally anonymous.
//
// During the life time of a session, the amount of information about the
// identity can change, usually it increases.
//
// Sessions are not persisted on disk, they stay in memory. However, using
// some cookie, it is to some extend possible to recreate a new session that
// has some similarities with the old one, like what is the wiki involved for
// example, or even what is the code page of the user (from which it is
// easy to retrieve the user's "login name" and "userpage").
//
// Session terminate either due to inactivity or due to explicit user logout.

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
  var prefix = "<S"
  if( this.loginName ){
    if( this.isBot ){
      prefix += "b"
    }else if( this.isGuest() ){
      prefix += "g"
    }
    if( this.canMentor ){
      prefix += "!"
    }
  }
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
  = "id wiki loginId loginName loginCode isGone canMentor postClosureId"
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

// ------------------------
// section: sessionlogin.js
//
// Login in SimpliWiki is a rather complex process, with multiple inputs
// involved.

Session.login = function( wiki, subdomain, custom, path, code, query, req ){
// Called by Wiki.lookupSession() when it could not connect an HTTP request
// with an existing session.
// Also .login() multiple times, with .logout( "reuse") between calls. This
// happens when a user logs into a sub wiki, as she is first logged in the
// parent wiki before be logged in the child wiki.

  var that  = this
  var relog = false
  this.wiki = wiki
  this.login_de&&bug( "Session.login")
  De&&mand( !wiki.isInitializing() || !req )

  // Detect "relog" (when session logged into the parent wiki typically)
  if( this.config ){
    this.login_de&&bug( "relog")
    relog = true
    this.loginLog( "relog")
  }
  
  // Session inherits config from global wiki's config
  this.config = Sw.copyHash( wiki.config)
  // Parse additional session's config parameters from query string
  if( query && query.length ){
    this.login_de&&bug( "Session.login with query parameters")
    this.wiki.setOptions(
      this.config,
      query,
      "session",
      null, // no page
      this
    )
  }
  
  // Default to HomePage
  var page = path ? path : "HomePage"
  // ToDo: url decode, for e acute style of urls
  
  // Sanitize a little
  page = page.substr( 0, 99)
  if( !page.match( SW.wikiword) ){
    page = page.replace( /\//g, "Slash")
    page = this.wikinamize( page)
    if( !page || page == "WikiWord" ){
      page = "HomePage"
    }
  }
  if( !page ) page = "HomePage"
  if( page == "/" ) page = "HomePage"
  
  this.loginPage = this.lookup( page)
  this.entryPage = this.loginPage

  this.subdomain = subdomain
  this.custom    = custom
  if( !this.loginId ){
    this.loginId = this.wiki.countLogins++
  }

  // If code was provided, use it, unless it's an invalid "id code"
  var intentional = false
  if( code && (!this.codeIsId( code) || this.ownsCode( code)) ){
    this.login_de&&bug( "Session.login with code:", code)
    // Not intentional yet, but will become intentional in codeLoginForm()
    this.setLoginCode( code)
    intentional = true
  // If no code was provided, figure out something
  }else{
    // Reuse previous code if available, or else use something else
    code = this.loginCode
    if( !code ){
      // Use the id code of the user if known or else some random code
      code = this.getIdCode()
      if( code ){
        this.loginLog( "own id Code" + code)
      }else{
        code = ("F" + Wiki.random3Code()).capitalize()
        this.loginLog( "(create Code" + code + ")")
      }
      intentional = false
      this.setLoginCode( code)
    }else{
      this.loginLog( "keep using Code" + code)
      intentional = this.loginWithCode
    }
  }

  // Anonymous Guest by default
  this.isGuestMember = false

  this.allClosures = []
  this.viewClosureCache = {}
  if( !relog ){
    // Name guest using the target page, this will change maybe
    // ToDo: this is disturbing, I need a better way to handle this
    // this.loginName = this.guestnamize( page)
    this.loginName = "SomeGuest"
    // ToDo: look for name= in cookies
    // Login as guest initialy. ToDo: could handle Codexxx page here
    if( this.loginName == "HomePageGuest" ){
      this.loginName = "SomeGuest"
    }
    this.isGone = false
    this.isAuthentic   = false
    this.twitterName   = ""
    this.twitterLabel  = ""
    this.twitterId     = ""
    this.facebookName  = ""
    this.facebookLabel = ""
    this.facebookId    = ""
    this.linkedinName  = ""
    this.linkedinLabel = ""
    this.linkedinId    = ""
  }
  this.isOwner      = false // Authentic fb & twitter users "own" some wikis
  this.isMentor     = false
  this.isAdmin      = false 
  this.canMentor    = false
  if( !relog ){
    this.canScript = this.config.canScript
  }
  this.allVisitsByPage = {} // Sw.timeNow when last visited
  this.allKnownPages   = {}
  this.allVisitedMaps  = {}
  this.allMaps         = {} 
  this.wiki.allSessions[this.loginId] = this // ToDo ?
  this.wikiHistory     = []
  this.wikiPage        = null
  this.setCurrentPage( this.loginPage)
  this.doOnPage        = this.wikiPage
  this.localName       = wiki.name.capitalize()
  this.previousContent = ""
  this.lastFollower    = null
  this.isBehindMap     = false
  if( !relog ){
    this.dateLogin = Sw.dateNow
    this.timeLogin = Sw.timeNow
    this.dataByPage    = {}
  }
  this.httpLogin = req ? req : {headers:{}} // protoGuest has no req
  this.isOembed  = this.httpLogin.oembed
  this.isIframe  = this.httpLogin.iframe

  // Tune display to get bigger characters if embedded
  if( this.isOembed || this.isIframe ){
    this.config.rows = 10
  }
  this.isBot = req && this.wiki.isBotRequest( req)

  // Disable noisy tracing about bots (unless deep bot trace domain is on)
  if( this.isBot && !this.deep_bot_de ){
    this.ndebug()
    this.de&&bug( "THIS IS NOT SUPPOSED TO BE DISPLAYED")
    this.bug_de&&bug( "NEITHER THIS")
  }

  // Start timer about age of session
  this.touch()

  // All sessions are guest session initially
  // ToDo: avoid some useless logUser
  this.wiki.logUser( this)
  var that = this

  // Try to figure out the proper language
  if( req ){
    // ToDo: Some cookie should help override this
    var langs = req.headers["accept-language"]
    if( !langs ){
      langs = "en"
      // A bot?
      var agent = req.headers["user-agent"]
      if( agent ){
        if( agent.includes( "Googlebot") ){
          this.loginName = "GoogleBotGuest"
          this.isBot = true
        }else
        if( agent.includes( "facebook") ){
          this.loginName = "FacebookBotGuest"
          this.isBot = true
        }else
        if( agent.includes( "Pingdom") ){
          this.loginName = "PingdomBotGuest"
          this.isBot = true
        }else{
          this.de&&bug( "Weird user agent: ", agent)
        }
      }
    }
    if( this.config.lang == "en" ){
      if( langs.includes( ",fr") ){
        this.config.lang = "fr"
        this.lang_de&&bug( this, ", a french frog")
        if( langs.includes( "en")
        && langs.indexOf( "en") < langs.indexOf( "fr")
        ){
          this.config.lang = "en"
          this.lang_de&&bug( this, " Frog prefers english")
        }
      }else{
        this.config.lang = langs.substr( 0, 2)
        this.lang_de&&bug( "Auto detect language: ", this.config.lang)
      }
    }else{
      if( this.config.lang.starts( langs)
      || langs.includes( "," + this.config.lang)
      ){
        // OK
      }else{
        // Revert to english
        this.config.lang = "en"
      }
    }
  }

  // Avoid creating useless random invitation codes for robots
  if( this.isBot ){
    code = "Bot" + this.loginName.replace( "BotGuest", "")
    intentional = true
    this.setLoginCode( code, true, true) // true => force
  }

  if( query && query.length ){
    this.login_de&&bug( "loginQuery: ", Sys.inspect( query))
  }
  if( query && query.lang ){
    this.config.lang = query.lang.substr( 0, 2)
    this.lang_de&&bug( "URI specified lang: ", this.config.lang)
  }
  
  if( !relog ){
    this.postClosureId = this.registerClosure( function( that ){
      //De&&bug( Sys.inspect( this))
      that.post_de&&bug( "method:", this.method)
      if( this.method == "POST" ){
        that.processPost( this, that.getCurrentPage())
      }else{
        that.viewForm( this)
      }
      return that
    })
    // ToDo: Manage rest services
    this.restClosure = this.registerClosure( function( that ){
      NDe&&bug( "REST")
      that.rest( this)
      NDe&&bug( "REST done")
    })
    this.byeClosure = this.registerClosure( function( that ){
      // Also logout guest peer user
      if( that.peerSession
      && (!that.isGuest() || that.peerSession.isGuest() )
      ){
        that.peerSession.logout( "peer")
        that.peerSession = null
        return that.viewForm( this)
      }
      // Just get out of "Mentor mode"?
      if( that.isMentor ){
        that.isMentor = false
        return that.viewForm( this)
      }
      // Special case when inside Facebook canvas
      if( that.isAuthentic
      && that.wiki.name == that.facebookName + "@"
      && that.facebookIframe
      //&& that.canMentor
      // ToDo: should I check the login name?
      ){
        // Don't log out session, index.html would autolog back
        that.login_de&&bug( "facebook logout")
        that.redirect( this)
      }
      that.logout( "bye")
      // Redirect to index.html or /in to log out all sessions
      if( that.isAuthentic ){
        that.login_de&&bug( "global logout")
        that.isComingBack = true // see pushCookies()
        that.redirect( this, "/in")
      }else{
        that.login_de&&bug( "local logout")
        that.redirect( this)
      }
      return that
    })
    this.resetClosure = this.registerClosure( function( that ){
      if( that.isMentor ){
        that.de&&bug( "Admin reset")
        that.wiki.reset()
      }
      that.viewForm( this)
    })
  
    // Remember to check session every so often
    Wiki.timeoutCheckGoneSession( this)

    // Don't assume browser can javascript, if it can it will tell us
    if( this.canScript && req ){
      // However, assume iPhone/pod/pad can script
      // I could go much further with mobiles
      // See http://wurfl.sourceforge.net/
      var ua = req && req.headers && req.headers["user-agent"]
      if( (/(iphone|ipod|ipad)/i).test( ua) ){
	this.de&&bug( "this is an iPhone/pod/pad")
	this.canScript = true
	this.isTouch   = true
      // Also assume can script if beeing embedded
      }if( this.isOembed || this.isIframe ){
        this.de&&bug( "this is embedded, assume can script")
        this.canScript = true
      // Also assume can script if sw_can_script cookie was set
      }else if( this.getCookie( "sw_can_script") ){
        this.de&&bug( "sw_can_script")
        this.canScript = true
      // Or else... wait until client's signalModel() tells us (or timeout)
      }else{
        this.canScript = "maybe"
      }
      this.roundTrip = Sw.timeNow
      // If client can script, signalModel() should turn "maybe" into true 
      setTimeout(
        function(){
          if( that.canScript == "maybe" ){
            that.login_de&&bug( "No news, assume session cannot script")
            // BTW, this may help during peak hours
            // BTW, this may help detect robots
            that.canScript = false
          }
        },
        40000 // 40 secs
      )
    }
  }
  
  // Need to return a closure, see  lookupSession()
  // I can also return null if login keeps going on asynchronously
  
  // Some additional stuff if intentional login with an invitation code page
  if( code && intentional ){
    var page = this.lookup( "Code" + code.capitalize())
    this.login_de&&bug( "codePageLogin:", page)
    // I load the code page and I proceed with the login
    page.read( function( err, page ){
      // ToDo: err handling
      that.codeLoginForm( page, intentional, req)
    })
    return null
  }

  // If alreay an identified User object... weird
  if( this.user ){
    this.bug_de&&bug( "Already bound to user:", this.user)
  }

  // Get this.twitterName & id and facebookName & id from cookies
  this.useTwitterNameCookie(  req)
  this.useFacebookNameCookie( req)
  this.useLinkedInNameCookie( req)

  // Some additional stuff if login with one of those
  if( this.twitterName || this.facebookName || this.linkedinName ){
    // I load the desired page and I proceed with the login 
    page = this.lookup( page)
    page.read( function( err, page){
      // ToDo: err handling
      if( that.twitterName ){
        that.login_de&&bug( "Login using twitterScreenName:", this.twitterName)
        // ToDo: err handling
        return that.twitterLoginForm( that.twitterName, page, req) 
      }
      if( that.facebookName ){
        that.login_de&&bug( "Login using facebookScreenName:", this.facebookName)
        return that.facebookLoginForm( that.facebookName, page, req)
      }
      if( that.linkedinName ){
        that.login_de&&bug( "Login using linkedinScreenName:", this.linkedinName)
        return that.linkedinLoginForm( that.linkedinName, page, req)
      }
    })
    return null
  }
  
  // User logged, postclosure will handle the request & render result
  this.wiki.logUser( this)
  var closure_f     =  this.wiki.getClosure( this.postClosureId, true)
  closure_f.session = this
  return closure_f
}

Session.assertIsSession = function(){ return true }

Session.fixTwitterLogin = function( name, req, loop ){
// Checks if twitter user is mentor of the wiki. This is true if the wiki's
// name is equal to the user's screen name or if the wiki's name
// is equal to "@" plus the user's twitter id
// ToDo: what if screen name changes?
  var is_mentor = this.isOwner
  // Don't recheck
  if( is_mentor )return true
  if( !name ){
    name = this.useTwitterNameCookie( req)
  }
  if( (this.wiki.isTopLevel() && name == this.wiki.name)
  ||  (De && this.wiki.isRoot() && name == "jhr")  // In debug I own the root wiki
  ){
    this.login_de&&bug( "ownerTwitteUser:", name, ", mentor of its own wiki")
    is_mentor = true
    // ToDo: move this to loginForm() cause 
    // However: not a mentor if wiki config says so
    if( this.wiki.config.mentor
    &&  this.wiki.config.mentor != "@" + name.replace( /@/g, "")
    ){
      this.login_de&&bug( "notMentorTwitterUser:", name)
      this.loginLog( "owner but not configured mentor, " + name)
      is_mentor = false
    }else{
      this.loginLog( "owner " + name)
      this.isOwner = true
    }
  }
  // If false with name, is it true with id?
  if( !is_mentor
  && isNaN( name)
  && this.twitterId
  && !loop
  ){
    return this.fixTwitterLogin( "@" + this.twitterId, req, true)
  }
  return is_mentor
}

Session.twitterLoginForm = function( name, page, req ){
// Change session's user & right based on authenticated twitter name.
// Called by Session.login()
  this.login_de&&bug( "twitterLogin:", name, "page:", page)
  // If name of user matches name of wiki, make user a mentor, maybe
  var is_mentor = this.fixTwitterLogin( name, req)
  if( is_mentor ){
    this.login_de&&bug( "mentor of twitter user's wiki, user:", name)
  }
  return this.userLoginForm( "@" + name, is_mentor, page, req)
}

Session.fixFacebookLogin = function( name, req, loop ){
// Checks if facebook user is mentor of the wiki. This is true if the wiki's
// name is equal to the user's screen name + "@" or if the wiki's name
// is equal to the user's facebook id + "@"
// Note: rules for twitter are different because I consider the twitter
// screen name to be more "public" than the facebook's name and consequently
// I make it easier to use it, ie without @ at the front. Whereas the
// facebook screen name is less public and must be less conveniently followed
// by a @. Anyways, facebook screen names can include dots and dashes and
// are generally not as short as the twitter ones.
// ToDo: what if screen name changes?
  var is_mentor = false
  if( !name ){
    name = this.useFacebookNameCookie( req)
  }
  if( this.wiki.isTopLevel() && (name + "@") == this.wiki.name ){
    this.login_de&&bug( "ownerFacebookUser:", name, ", mentor of its own wiki")
    is_mentor = true
    // ToDo: move this to loginForm() cause 
    // However: not a mentor if wiki config says so
    if( this.wiki.config.mentor
    &&  this.wiki.config.mentor != name + "@"
    ){
      this.login_de&&bug( "notMentorFacebookUser:", name)
      this.loginLog( "owner but not configured mentor, " + name)
      is_mentor = false
    }else{
      this.isOwner = true
      this.loginLog( "owner " + name)
    }
  }
  // If false with name, is it true with id?
  if( !is_mentor
  && isNaN( name)
  && this.facebookId
  && !loop
  ){
    return this.fixFacebookLogin( this.facebookId, req, true)
  }
  return is_mentor
}


Session.facebookLoginForm = function( name, page, req ){
// Change session's user & right based on authenticated facebook name.
// Called by Session.login()
  this.login_de&&bug( "facebookLogin:", name, "page:", page)
  // If name of user matches name of wiki, make user a mentor
  var is_mentor = this.fixFacebookLogin( name, req)
  if( is_mentor ){
    this.login_de&&bug( "mentor of facebook user's wiki, user:", name)
  }
  return this.userLoginForm( name + "@", is_mentor, page, req)
}

Session.fixLinkedInLogin = function( name, req, loop ){
// Checks if linkedin user is mentor of the wiki. This is true if the wiki's
// name is equal to the user's screen name + "In" or if the wiki's name
// is equal to the user's linkedin id + "In"
// Note: rules for twitter are different because I consider the twitter
// screen name to be more "public" than the other names and consequently
// I make it easier to use it, ie without @ at the front. Whereas the
// linkedin screen name is less public and must be less conveniently followed
// by "In". Anyways, linkedin screen names are generally not as short as the
// twitter ones.
// ToDo: what if screen name changes?
  var is_mentor = false
  if( !name ){
    name = this.useLinkedInNameCookie( req)
  }
  if( this.wiki.isTopLevel() && (name + "In") == this.wiki.name ){
    this.login_de&&bug( "ownerLinkedInUser:", name, ", mentor of its own wiki")
    is_mentor = true
    // ToDo: move this to loginForm() cause 
    // However: not a mentor if wiki config says so
    if( this.wiki.config.mentor
    &&  this.wiki.config.mentor != name + "In"
    ){
      this.login_de&&bug( "notMentorLinkedInUser:", name)
      this.loginLog( "owner but not configured mentor, " + name)
      is_mentor = false
    }else{
      this.isOwner = true
      this.loginLog( "owner " + name)
    }
  }
  // If false with name, is it true with id?
  if( !is_mentor
  && isNaN( name)
  && this.linkedinId
  && !loop
  ){
    return this.fixLinkedInLogin( this.linkedinId, req, true)
  }
  return is_mentor
}


Session.linkedinLoginForm = function( name, page, req ){
// Change session's user & right based on authenticated linkedin name.
// Called by Session.login()
  this.login_de&&bug( "linkedinLogin:", name, "page:", page)
  // If name of user matches name of wiki, make user a mentor
  var is_mentor = this.fixLinkedInLogin( name, req)
  if( is_mentor ){
    this.login_de&&bug( "mentor of linkedin user's wiki, user:", name)
  }
  return this.userLoginForm( name + "In", is_mentor, page, req)
}


Session.userLoginForm = function( user, is_mentor, page, req ){
// This method is called after .login() if there is any information available
// to somehow identify (or even authenticate) the user.
// It is called by either twitterLoginForm() or facebookLoginForm(), ...

  var that = this
  this.login_de&&bug( "userLogin:", user, "mentor:", is_mentor, "page:", page)

  // ToDo: better authentication, it is premature to declare authentic,
  // twitter id or facebook must be checked against their signature in
  // cookies first
  // OTOH there is no signature on LinkedIn
  // Note: so far (feb 14 2011) it's the only place when isAuthentic is set
  that.isAuthentic = true

  // ToDo: is it necessary to do that again?
  that.useTwitterNameCookie(  req)
  that.useFacebookNameCookie( req)
  that.useLinkedInNameCookie( req)
  // ToDo: is this necessary?
  if( false ){
    if( "@".starts( name) ){
      that.twitterName = name.substr( 1)
    }else if( "@".ends( name) ){
      that.facebookName = name.substr( 0, name.length - "@".length)
    }else if( "In".ends( name) ){
      that.linkedinName = name.substr( 0, name.length - "In".length)
    }else{
      that.bug_de&&bug( "Neither Twitter nor Facebook nor LinkedIn:", name)
      that.isAuthentic = false
    }
  }

  // make user a mentor if wiki is very open by default
  var is_very_open_by_default = this.wiki.isVeryOpenByDefault()
  if( is_very_open_by_default ){
    this.login_de&&bug( "identified users are mentors of still very open wiki")
    is_mentor = true
    this.loginLog( "mentor, very open wiki")
  }
  
  var that = this
  var name = user
  var is_config_defined_mentor = false

  // Let's have a better name of the guest
  if( this.loginName == "SomeGuest" ){
    this.loginName = this.guestnamize( user)
    this.loginPage = this.lookup( this.usernamize( this.loginName))
    user = this.loginName
    that.login_de&&bug( "betterName:", this.loginPage)
  }
 
  // OK, now let's find the "User" page of the member
  var userpagename
  var userpage
  if( this.loginWithCode ){
    that.login_de&&bug( "Delayed login, keep code login:", this.loginCode)
    userpagename = this.loginPage.name
    userpage     = this.loginPage
    is_mentor || (is_mentor = this.canMentor)
    page         = this.getCurrentPage()
  }else{
    userpagename = this.usernamize( user)
    userpage = this.lookup( userpagename)
  }
  that.login_de&&bug( "user:", user, ", userpage:", userpagename)
  that.loginLog( "Your page: " + userpagename)

  // If user page does not exists, create, as draft unless wiki is 100% open
  userpage.read( function( err ){
    if( userpage.isNull() ){
      that.login_de&&bug( "brandNewUserPage:", userpage.name)
      // Unless owner or 100% open, some mentor need to stamp the user
      if( !that.wiki.isVeryOpen()
      && !is_very_open_by_default
      && !is_mentor
      ){
        that.login_de&&bug( "newAuthenticUser: ", user,
        ", mentor stamping required for membership, page:", userpage)
        that.draft( userpage)
        that.loginLog( "new user, draft page " + userpagename)
      }else{
        that.wiki_de&&bug( "newAuthenticUser: ", user, ", becomes member of wiki")
        that.loginLog( "new member, " + user)
      }
    // If page exists, extract user name from first line of text, if any
    }else{
      // This means that the user can have a local identity per wiki
      user = userpage.getFirstUser() ? userpage.getFirstUser() : user
      // But cannot pretend to be another Twitter or Facebook user
      if( user != name ){
        that.loginLog( "new name for " + name + ", " + user)
        if( "@".starts( user) || "@".ends( user) || "In".ends( user) ){
          // ToDo: this makes no sense, it is legitimate to use either the
          // twitter or facebook name, iff it is signed with cookies
          that.warnUser( "Bad " + user)
          that.loginLog( "invalid new name")
          user = name
        }else{
          // Set new identity unless new id is a draft
          if( !userpage.isDraft() ){
            that.login_de&&bug(
              "name:", name, 
              "localIdentity:", user,
              "userPage:", userpage.name
            )
          }else{
            that.login_de&&bug(
              "name:", name, 
              "draftLocalIdentity:", user,
              "userPage:", userpage.name
            )
            that.loginLog( "don't change, draft " + userpage)
            user = name
          }
        }
      }else{
        that.loginLog( "welcome " + user)
      }
    }
    // Make sure there is also a way to login with a code
    var code = that.getData( userpage, "code")
    if( !code || code == "Invalid" ){
      code = that.loginCode
      that.wiki_de&&bug( "authenticUser:", user, "newInvitationCode:", code)
    }else{
      code = code.capitalize()
      that.login_de&&bug( "authenticUser:", user, "invitationCode:", code)
      // Let's not keep garbage
      that.loginLog( "Code" + code + " in " + userpage)
      that.setLoginCode( code, true)
    }
    // ToDo: decide later what code to use, not now
    // that.setData( userpage, "code", code)
    // Let's try to retrieve the User object asap
    if( !that.user ){
      that.user = that.wiki.lookupUser( that)
      de&&mand( !that.user || that.user.isLocal )
    }
    // More work
    that.loginForm( user, code, false, is_mentor, page, req)
  })
}

Session.codeLoginForm = function( page, intentional_code, req ){
// Change session's user & rights based on invitation code.
// The "page" parameter is a "Code" page.
// Called when there is a "code" query parameter
// Called when there is a cookie code
// Later called when user enters an invitation code or visit a code page
// ...
// This function is way too complex, it probably needs some refactoring.
// Until this is done, I get back to literate programming
  
  // First let's extract the code from the page's name
  this.login_de&&bug( "codeLoginPage: ", page)
  var code = page.getCode()
  this.deep_login_de&&bug( "secretCode: " + code)
  
  // Now let's try to figure out the user's name
  var user
  
  // Whatever happens, twitter, facebook, linkedin user is mentor of her own wiki
  var is_mentor = false
  if( this.fixTwitterLogin( null, req) ){
    this.login_de&&bug( "also twitter owner is mentor")
    is_mentor = true
  }
  if( this.fixFacebookLogin( null, req) ){
    this.login_de&&bug( "also facebook owner is mentor")
    is_mentor = true
  }
  if( this.fixLinkedInLogin( null, req) ){
    this.login_de&&bug( "also linkedin owner is mentor")
    is_mentor = true
  }

  // If code page does not exists, create, as draft, unless wiki is 100% open
  if( page.isNull() ){
    this.login_de&&bug( "newCodePage: ", page)
    NDe&&bug( this, ", isDraft: ",     page.isDraft())
    NDe&&bug( this, ", wasIncarned: ", page.wasIncarned())
    NDe&&bug( this, ", bodyLengh: ",   (page.body ? page.body.length : "none"))
    NDe&&bug( this, ", deleted: ",     page.wasDeleted())
    NDe&&bug( this, ", inherited: ",   page.inherited)
    // Keep the current name, a guest name, remove Guest part & normalize
    this.login_de&&bug( "membernamize:", this.userName())
    user = this.membernamize( this.wikinamize( this.userName(), null, "One"))
    // However, if name is a CodeXxxxx, revert to "SomeOne"
    if( "Code".starts( user) ){
      // This may happen if someone "creates" a code
      this.login_de&&bug( "Fix anonymous code")
      user = "SomeOne"
    }
    this.login_de&&bug( "newCodePage:", page, "for user:", user)
    if( !this.wiki.isVeryOpen() && !is_mentor ){
      // Should never draft "SomeOne", this is the default member
      if( user == "SomeOne" ){
        this.bug_de&&bug( "BUG? SomeOne in codeLoginForm")
        user = "SomeGuest"
      }
      this.login_de&&bug( "newDraftCodePage:", page, "for user:", user)
      this.loginLog( "(new draft " + page + " for " + user + ")")
      this.draft( page)
    }else{
      this.loginLog( "new " + page + " for member " + user)
    }
    // Some help
    var init = user + "\n\nDraftCode\n"
    // If own wiki or very open but just created, user will be a mentor
    if( is_mentor || this.wiki.isVeryOpenByDefault() ){
      if( !is_mentor ){
        this.login_de&&bug( "open by default, make mentor, user:", user)
        is_mentor = true
      }
      if( false && page.isDraft() ){
        this.bug_de&&bug( "BUG? draft user page in new wiki, page:", page)
        this.stamp( page, false)
	init = user
      }
      this.putPage( page, "Mentor" + init, function( err ){
        // ToDo: err handling
      })
    }else{
      this.putPage( page, init, function( err ){
        // ToDo: err handling
      })
    }
  // If page exists, extract user name from first line of text
  }else{
    user = page.getFirstUser()
    this.login_de&&bug( "codePageUser:", user, "page:", page)
    this.loginLog( "" + page.name + " " + user)
    // If "Mentor" qualifier, notice
    if( page.isMentorCode() ){
      // Note: loginForm() will confirm that this is valid
      is_mentor = true
    }
  }
  // If the current page is not a code page, it is the page to display
  // This happens at login typically
  if( !this.getCurrentPage().isCode() ){
    this.login_de&&bug( "codeLoginDesiredPage:", page)
    page = this.getCurrentPage()
  }
  this.loginForm( user, code, intentional_code, is_mentor, page, req)
}

Session.setLoginCode = function( code, intentional, force ){
// This method is called whenever a code is assigned to the session.
// It get rid of a potential previous draft code.
// It this happens, the draft code is "erased" and method returns true.
// Returns false if the draft code is actually still usefull.
// "force" helps with robots, they are guests and cannot have a valid code.
// "not_intentional" is true when user somehow explicitely used a code.

  var old_code        = this.loginCode
  var old_code_page   = this.loginCodePage
  var was_intentional = this.loginWithCode

  this.loginCode     = code
  this.loginCodePage = this.lookup( "Code" +code)

  if( old_code || !old_code_page || code == old_code ){
    if( intentional ){
      this.loginWithCode = true
      // If change in intention, log it
      if( !was_intentional ){
        this.loginLog( "(intentional Code" + code + ")")
      }
    }
    return false
  }

  if( intentional ){
    // Note: I change the value only to go from non intentional to intentional
    // Not when going from intentional to non intentional, which, btw, is
    // questionable
    this.loginWithCode = true
    this.loginLog( "new intentional Code" + code)
  }else{
    this.loginLog( "(Code" + code + (was_intentional ? " implicit)" : ")"))
  }

  // Forget useless old random code when appropriate
  if( was_intentional && !force ){
    if( old_code_page.isDraft() ){
      this.loginLog( "keep intentional draft " + old_code_page)
    }
    this.login_de&&bug( "keep login code:", old_code_page)
    return
  }

  if( !old_code_page.isDraft() ){
    this.login_de&&bug( "keep non draft code:", old_code_page)
    return
  }

  if( !("F3".starts( old_code) && (old_code.length == "F3xxxxxxxx".length))
  && !force
  ){
    // Play safe
    this.login_de&&bug( "keep non random code:", old_code_page)
    return
  }

  if( this.isGuest() && !force ){
    // Play safe
    this.loginLog( "(keep guest " + old_code_page + ")")
    return
  }
  
  this.loginLog( "(forget " + old_code_page + ")")
  old_code_page.undraft()

}

Session.loginForm = function( user, code, intentional, has_mentor, page, req ){
// This method gets called by codeLoginForm() and userLoginForm()
// to handle the login, usually just after a new session is created.
// It may also be called later, see "delayed login".
// It is also called when an anonymous guest sets her name on a
// very open by default new wiki or when an anonymous member sets
// her name.
// It is WAY too complex.

  this.login_de&&bug( "loginForm, user:", user, 
    "code:", code,
    "intentional:", intentional,
    "mentor: ", has_mentor,
    "page:", page,
    "R:", req ? req.deId : "none"
  )

  // Check abuses on "id codes"
  if( this.codeIsId( code) && !this.ownsCode( code) ){
    this.login_de( "id code abuse, code:", code)
    this.loginLog( "invalid " + code)
    code = "CodeInvalid"
  }
    
  // If this is the config defined code, force the user name
  var is_config_defined_mentor = false
  if( this.wiki.config.mentorCode
  &&  this.wiki.config.mentorUser
  &&  code == this.wiki.config.mentorCode.capitalize()
  ){
    user = this.wiki.config.mentorUser
    this.login_de&&bug( this, "configDefinedMentor:", user)
    this.loginLog( "using configured mentor code, " + user)
    is_mentor = true
    is_config_defined_mentor = true
  }
  if( !user ){
    user = "SomeOne"
    this.login_de&&bug( "no user, fallback:", user)
    this.loginLog( "fallback to SomeOne")
  }else{
    this.login_de&&bug( "foundUser:", user)
  }

  // Make sure the name is valid
  if( "@".starts( user) ){	// ToDo: is this still needed?
    user = this.wikinamize( user, null, "One")
  }else{
    user = this.usernamize( user).substr( "User".length)
    user = this.wikinamize( user, null, "One")
  }
  this.login_de&&bug( "managedUser:", user)

  // Is it a guest or a registered member?
  var is_guest = user.includes( "Guest")
  this.de&&bug( "user:", user, "isSoFar:", is_guest ? "Guest" : "Member")
  
  // A guest can never be a mentor
  if( is_guest && has_mentor ){
    this.de&&bug( "badGuestMentor:", user)
    has_mentor = false
  }
    
  // OK, now let's find the "User" page of the member, default content is provided
  var userpage = this.lookup( this.usernamize( user))
  if( userpage.isDraft() ){
    this.deep_login_de&&bug( "draftUserPage:", userpage)
    // this.loginLog( "draft " + userpage)
  }
  
  // There must be no draft user page on just created very open wikis
  var is_very_open_by_default = this.wiki.isVeryOpenByDefault()
  if( is_very_open_by_default ){
    if( userpage.isDraft() ){
      this.bug_de&&bug( "BUG? user page is draft, page:", userpage)
      this.stamp( userpage)
      this.loginLog( "auto stamp " + userpage)
    }
  }
  
  // Get the user page
  var that = this

  // If authentic user's wiki, make sure user is not a draft
  if( that.isOwner && userpage.isDraft() ){
    that.bug_de&&bug( "Fix draft user page of owner")
    that.loginLog( "fix draft " + userpage)
    userpage.undraft()
  }

  // OK, let's get the page, it may not actually exist
  userpage.read( function( err, userpage ){
  
  // Check if member is a guest because user page is a draft or was deleted
  if( (!is_guest && !is_config_defined_mentor)
  && ( userpage.isDraft()
    || userpage.isNull()
    || (page.isCode() && page.isDraft() )
  )
  ){
    // If page is empty, it should contain the user name
    if( userpage.isNull() ){
      that.login_de&&bug( "Initialize user page:", userpage)
      userpage.incarnBody( user)
      userpage.de&&mand( !userpage.isNull() )
      // Note: I don't "write" the page, useless
      //that.putPage( userpage, user, function( err ){
      //  // ToDo: err handling
      //})
    }
    // However, on very open wikis, auto stamp the user
    // Idem if code page is ok or if user is the owner
    if( that.wiki.isVeryOpen()
    ||  is_very_open_by_default
    ||  (page.isCode() && !page.isDraft())
    ||  that.isOwner
    ){
      that.de&&bug( "user:", user, "accepted as a member")
      // ToDo: I could actually ignore the "draft" status in very open wikis
      if( userpage.isDraft() ){
        that.de&&bug( "stamp owner: ", user, ", page: ", userpage.name)
        that.stamp( userpage)
        that.loginLog( "owner, auto stamp " + userpage.name)
      }
      if( page.isCode() && page.isDraft() ){
        that.stamp( page)
        that.loginLog( "owner, auto stamp " + page.name)
      }
    // Else the user's page is not ok, revert member status to guest
    }else{
      that.login_de&&bug( "draftMember:", user, "page:", userpage)
      that.loginLog( "not a member, " + user)
      if( true || that.de ){
        if( page.isCode() ){
          if( page.isDraft()      ){
            that.loginLog( "because " + page +   " is a draft")
          }
          if( page.isVoid()       ){
            that.loginLog( "because " + page +   " is empty")
          }
          if( page.wasDeleted()   ){
            that.loginLog( "because " + page +   " was deleted")
          }
        }
        if( userpage.isDraft()    ){
          that.loginLog( "because " + userpage + " is a draft")
        }
        if( userpage.isVoid()     ){
          that.loginLog( "because " + userpage + " is empty")
        }
        if( userpage.wasDeleted() ){
          that.loginLog( "because " + userpage + " was deleted")
        }
      }
      user = that.guestnamize( user)
      is_guest   = true
      has_mentor = false
      if( userpage.name != "UserSome" ){
        // This is not an anonymous guest however
        that.isGuestMember = true
        // User page is made a draft, this  marks user as a guest
        if( !userpage.isDraft() ){
          that.login_de&&bug( "force guest, draft page:", userpage)
          that.draft( userpage, true) // true => force
        }
      }else{
        that.bug_de&&bug( "BUG? weird guest, page:", userpage)
      }
    }
  }
  // Paranoid sanitize
  user = that.wikinamize( user, null, is_guest ? "Guest" : "One")
  that.de&&bug( "loginForm(), found wikinamized user ", user)
  
  // Now, let's determine mentorship privileges
  var is_mentor = false

  // Check if user is a config defined mentor...
  if( !has_mentor
  && (" " + that.wiki.config.mentors + " ").includes( " " + user + " ")
  ){
    that.de&&bug( that, "configDefinedMentor:", user)
    that.loginLog( "configured mentor")
    has_mentor = true
  }

  // Everybody is a mentor in a very open wiki
  if( !has_mentor
  &&  that.wiki.isVeryOpen()
  ){
    that.de&&bug( "mentorOfOpenWiki:", user)
    has_mentor = true
    that.loginLog( "mentor owner")
  }

  // Now let's determine if mentor is a valid member
  if( has_mentor ){
    // A guest cannot be a mentor, only members can
    is_mentor = !is_guest
    // If AboutWiki defined mentorUser, reject other mentors
    if( is_mentor
    && that.wiki.config.mentorUser
    && that.wiki.config.mentorUser != SW.config.mentorUser // Ignore default
    && user != that.wiki.config.mentorUser
    ){
      that.de&&bug(
        "mentorName:",     user,
        "configMismatch:", that.wiki.config.mentorUser
      )
      is_mentor = false
      that.loginLog( "not the configured mentor")
    }
    if( is_mentor
    && that.wiki.config.mentorCode
    && that.wiki.config.mentorCode != SW.config.mentorCode.capitalize()
    && code != that.wiki.config.mentorCode.capitalize()
    ){
      that.de&&bug( "Mentor code does not match config defined one")
      // ToDo: facebook
      if( true || !that.twitterName ){
        that.loginLog( "not the configured mentor code")
        is_mentor = false
      }else{
        that.login_de&&bug( "ignoreCode:", code, "twitter:", that.twitterName)
      }
    }
    that.login_de&&bug( "Will be Mentor:", is_mentor ? "mentor" : "not mentor")
  }
  
  // Done, we know the user's name & its "guest" vs "member" status
  that.login_de&&bug( "Login, user:", user)
  that.loginName     = user
  that.loginLog(
    "(" + user + " Code" + code 
    + (intentional ? " intentional)" : ")")
  )
  that.setLoginCode( code, intentional)
  // If now member, forget transient name set while becoming member
  if( !is_guest ){
    that.isGuestMember = false
  }
  
  // If member or will be member, make sure a code page exists
  // and then remember the member's "user" page (aka "login page")
  if( !is_guest || that.isGuestMember ){
    // Fill code page if empty or new name
    var codepage = that.lookup( "Code" + code.capitalize())
    // There can be no draft codepage on very open wikis
    if( that.wiki.isVeryOpen()
    || is_very_open_by_default
    ){
      if( codepage.isDraft() ){
        that.bug_de&&bug( "Draft codepage on very open wiki:", codepage)
        that.stamp( codepage, true) // true => don't write, useless
      }
    }
    // ToDo: this runs in //, potential race condition, to double check
    codepage.read( function(){
      if( !codepage.wasIncarned()
      || codepage.isVoid()
      || codepage.wasDeleted()
      || codepage.getFirstUser() != that.loginName
      ){
        that.login_de&&bug( "initial code page:", codepage,
        "user:", that.loginName)
        if( !that.wiki.isVeryOpen()
        &&  !is_very_open_by_default
        &&  !this.isOwner
        ){
          that.deep_login_de&&bug( "draft initial code page:", codepage)
          that.draft( codepage)
          that.loginLog( "initial draft " + codepage)
        }else{
          that.loginLog( "initial " + codepage)
        }
        // If wiki is very open because of default config, make sure user is a mentor
        var codename = that.loginName
        if( that.isOwner ){
          codename = "Mentor" + codename
        }else if( is_very_open_by_default ){
          if( codepage.isDraft() ){
            that.stamp( codepage, false)
            that.bug_de&&bug( "BUG? draft in new wiki, page:", codepage)
          }
          codename = "Mentor" + codename
        }
        that.login_de&&bug( "write initialCodePage:", codepage, "user:", codename)
        that.putPage(
          codepage,
          codename + "\n"
          + userpage.name			// convenient
          + "\n\n" + codepage.getBody(),	// safe
          function(){}
        )
        // If wiki was just created, make sure code page is not a draft
        if( is_very_open_by_default ){
          if( codepage.isDraft() ){
            that.bug_de&&bug( "BUG? draft on very open wiki, codePage:", codepage)
            that.stamp( codepage)
          }
        }
        // ToDo: Should add a link in the member's wiki so that
        // whoever manages to log into a wiki can retrieve it
      }
    })
    
    that.login_de&&bug( "loginPage:", userpage)
    userpage.de&&mand( !userpage.isNull(), "empty userpage" )
    that.loginPage = userpage
    // Remember what code to use to login
    if( userpage.name != "UserSome" 
    && user != "SomeOne"
    && !is_very_open_by_default // Don't interfere with user page's creation
    && !userpage.isDraft()      // Don't confuse user
    ){
      // ToDo: error handling + this should be asynchronous
      that.login_de&&bug( "setData, page:", userpage, "code:", that.loginCode)
      userpage.de&&mand( !userpage.isNull(), "empty userpage" )
      that.setData( userpage, "code", that.loginCode)
    }
  }

  that.login_de&&bug( "log login, user:", user, "code:", code)
  that.logCode()
  
  // Set access right depending on mentorship
  if( req && (is_mentor || that.isDebug) ){
    // I get special privileges when I am invited in a wiki
    if( De && (that.loginName == "@jhr" || that.twitterName == "jhr") ){
      that.de&&bug( "@jhr connects")
      that.isAdmin = is_mentor
    }
    if( req.remoteAddress == "127.0.0.1"
      && (!req.headers || !req.headers["x-real-ip"])
    ){
      that.login_de&&bug( "Local browser connects")
      that.isAdmin = is_mentor
    }else if( that.wiki.config.adminIps.includes( req.remoteAddress)
    || (req.remoteAddress == "127.0.0.1"
      && req.headers && req.headers["x-real-ip"]
      && that.wiki.config.adminIps.includes( req.headers["x-real-ip"]))
    ){
      that.de&&bug( "Authorized host connects")
      that.isAdmin = is_mentor      
    }
    that.canMentor = is_mentor
  }else if( req ){
    that.canMentor = false
    that.isMentor  = false
  }
  
  // Close default very open wiki when first non anonymous member logs in
  if( is_very_open_by_default
  &&  that.canMentor
  &&  that.userName() != "SomeOne"
  ){
    if( that.isAdmin ){
      that.login_de&&bug( "Avoid closing wiki because of admin access")
    }if( !that.loginWithCode && !that.user ){
      that.login_de&&bug( "Avoid closing wiki, neither authentic nor code")
    }else{
      that.login_de&&bug( that.wiki, "ownerBecomes:", that.userName())
      that.wiki.changeDefaultToMentorConfig()
    }
    // Add a link in the owner's wiki, whoever creates wikis can retrieve them
    if( that.user ){
      // ToDo: what if user is found later? should logCode then
      that.newWikiTracked = true
      that.login_de&&bug( "logCodeInOwnerWiki:", that.user)
      that.wiki.getRoot().lookupWiki(
        "user/f" + that.user.getId() + "/x",
        function( wiki ){
          wiki.de&&mand( wiki.isUserWiki() )
          wiki.protoGuest.logCode(
            "Code" + that.loginCode.capitalize(),
            that.loginName,
            that.wiki
          )
        }
      )
    }
  }
  
  // Reset page history? ToDo: don't forget visit?
  that.wikiHistory = []
  
  // Move user to her login page if she's login using her code
  if( that.getCurrentPage().isCode() ) {
    that.setCurrentPage( that.loginPage)
  }
  if( page.isCode() ){
    that.setCurrentPage( that.loginPage)
    page = that.loginPage
  // Else, move to the desired page
  }else{
    that.setCurrentPage( page)
  }
  that.login_de&&bug( "desiredPage:", page, "currentPage:", that.getCurrentPage())
  
  // Some checking, debug only
  if( that.de ){
    if( is_guest ){
      if( !that.isGuest() ){
        that.bug_de&&bug( "BUG? should be guest")
      }
    }else{
      if( that.isGuest() ){
        that.bug_de&&bug( "BUG? should be member, user:", that.userName())
        if( that.isGuestMember ){
          that.bug_de&&bug( "BUG? is wrongly guest because guest member")
        }else if( that.userName().includes( "Guest") ){
          that.bug_de&&bug( "BUG? is wrongly guest because Guest in name")
        }else if( userpage.isDraft() ){
          that.bug_de&&bug( "BUG? is wrongly guest because draft user page")
        }else{
          that.bug_de&&bug( "BUG? no clue why is wrongly guest")
        }
      }
    }
    that.de&&mand( !!is_guest ==  !!that.isGuest(), "guest issue" )
  }

  // What happens next is different if user is identified
  var next
  if( that.isAuthentic ){
    that.login_de&&bug( "Track user")
    next = function( do_this ){
      that.trackUser( function( err, session, user ){
       // What is done here is only one part of the story, see .userFoundEvent()
       if( !err ){
         de&&mand( that == session,   "bad session, " + that + " != " + session )
         de&&mand( that.user == user, "bad user, " + that.user + " != " + user )
       }
       do_this()
      })
    }
  }else{
    next = function( do_this ){ do_this() }
  }
  next( function(){
    that.wiki.logUser( that)
    // Proceed with the visit
    if( req ){
      // if login occured during a POST I reprocess the HTTP request
      if( req.method == "POST" ){
        that.login_de&&bug( "Proceed with POST after login")
        // Make it so that processPost() don't discard the post
        that.postExpected = page.name
        that.processPost( req, page)
      // if login from a GET, present the current page
      }else{
        that.viewForm( req)
      }
    }
  })

  }) // End of read() callback
} // end of loginForm()


Session.restoreSession = function( old ){
// Called by wiki.logUser() for returning logged user with code
// ToDo: this happens more often then necessary, after a post for example
  this.login_de&&bug( "restoring")
  this.wikiHistory = old.wikiHistory
  this.loginLogList = old.loginLogList
  this.loginLog( "restored")
  if( !old.isAway() && !old.isGone ){
    this.allKnownPages = old.allKnownPages
    this.allMaps = old.allMaps
    this.isBehingMap = old.isBehindMap
    this.isDebug = old.isDebug
    if( this.canMentor ){
      this.isMentor = old.isMentor
    }
    // Don't jump on problematic page too easely
    if( this.wikiPage.isSensitive()
    // ||  this.wikiPage.isRead()
    ||  this.wikiPage.isHelp()
    ||  this.wikiPage.isHtml()
    ||  this.isBehindMap
    ||  this.canMentor
    ||  this.isDebug
    ){
      this.wikiPage = this.wiki.homePage
    }
    // Restore config & data
    this.config     = old.config
    this.dataByPage = old.dataByPage
    // Restore dropbox credentials
    if( old.dropbox ){
      this.dropbox_de&&bug( "restoreSession")
      this.dropbox = old.dropbox
    }
    // Logout the older session, safer
    old.logout( "restore")
  }
  return this
}

Session.codeIsId = function( code ){
// Returns true if code is an "id code", ie code is the "owner code" of
// some registered User.
// Note: does not check the actual existence of the user, just check the
// syntax of the code.
// Example: codeid3urfc38fs
// Case insensitive, to avoid issues with users using the wrong case.
  return SW.idCodePrefix.starts( code.toLowerCase())
}

Session.getIdCodeId = function( code ){
// Returns "" if code is not an "id code" (ie not an "owner code")
// Returns the id part if syntax is valid
// Example: codeid3urfc38fs => returns 3urfc38fs
  return !this.codeIsId( code)
  ? ""
  : code.substr( SW.idCodePrefix).toLowerCase()
}

Session.getIdCode = function(){
// Return the "id code"/"owner code" of the current user, or "" if no user.
  return this.user ? (SW.idCodePrefix + this.user.getId()) : ""
}

Session.ownsCode = function( code ){
// Checks if this code is actually the "owner code" of the current user.
// The "owner code" is made of "codeid" followed by the unique ID of a user
// of the wiki service.
  return this.getIdCode() == code.toLowerCase()
}

Session.checkIntrusion = function( req ){
// Try to figure out if session id was sniffed and reused by an intruder,
// comparing new req with initial login request
  // ToDo: do this
  // Compare IP
  // Compare user-agent
  // ToDo: regenerate session id. I could set a new session id
  // whenever I send a response. This means that users would detect
  // intrusion by way of beeing unexpectably signed off when the
  // intruder takes over a session. They would fight back by
  // sign in again, login out the intruder, with neither the intruder
  // nor the legitimate user having precedence, until one of them
  // create a new invitation code, something only mentors can do
  // usually.
  // Alternatively I could simply signal the intrusion when I detect
  // it, letting the user figure out what to do, or not do, in
  // cases where it is actually not intrusion and more like a dual
  // co browsing experience...
  // This could be a config parameter, config.collaborative
  return false
}

Session.logGuest = function( guestname ){
  var page = this.lookup( guestname)
  var oldname = this.loginName
  this.loginName = guestname
  if( !this.isGuest() ){
    this.loginName = oldname
    this.login_de&&bug( "cannot log guest, would be a member:", guestname)
    return false
  }
  // Set the login page if guest told us about her name
  if( this.isGuestMember ){
    this.loginPage = this.lookup( this.usernamize( this.userName()))
  }
  this.login_de&&bug( "logGuest, user: ", guestname)
  // Track user's visit to wiki if wiki is somehow secret
  if( this.user && this.wiki.isVeryOpen() ){
    this.user.trackVisit( this)
  }
  return this
}

Session.logMember = function( membername ){
  var page = this.lookup( membername)
  var oldname = this.loginName
  this.loginName = membername
  if( this.isGuest() ){
    this.loginName = oldname
    this.login_de&&bug( "cannot log member, would be a guest:", membername)
    return false
  }
  // Set the login page
  if( !this.isAnonymous() ){
    this.loginPage = this.lookup( this.usernamize( this.userName()))
  }
  this.login_de&&bug( "logMember, user: ", membername)
  // Track user's visits to wikis the user is a member of
  if( this.user ){
    this.user.trackVisit( this)
  }
  return this
}

Session.logout = function( reason ){
  this.login_de&&bug( "logout:", reason)
  if( this.isGone ){ return this }
  // If logging out of parent wiki while login in subwiki
  if( reason == "reuse" ){
    this.wiki.logout( this)
    return this
  }
  this.loginLog( "logout, " + reason)
  this.login_de&&bug( "\n" + this.loginLogList.join( "\n"))
  this.isGone = true
  if( this.user ){
    if( this.user.session == this ){
      this.user.logout()
      this.user = null
    }else{
      this.user_de&&bug( "changedSession:", this.user.session,
      "forUser:", this.user)
      this.user = null
    }
  }
  if( this == this.wiki.protoGuest ){
    this.wiki.logout( this)
    return this
  }
  this.viewClosureCache = {}
  // ToDo: clear stuff in session to avoid leak?
  this.allKnownPages = null
  this.allMaps = null
  this.de&&bug( "Bye ", this)
  var closure
  while( closure = this.allClosures.pop() ){
    this.wiki.deregisterClosure( closure)
  }
  this.allClosures = []
  this.wiki.logout( this)
  // Unless protoGuest
  if( this != this.wiki.protoGuest ){
    // ToDo: figure out what I can delete
    // this.config = null
    // ToDo: cannot null wiki, need it for isGuest()
    // this.wiki = null
  }
  return this
}

Session.age = function(){
// Age of session is time since last HTTP access, in millisec
// ie: session ages only when not used...
  return Sw.timeNow - this.dateLastAccess.getTime()
}
Session.declareIdempotentGetter( "age")

Session.isOlderThan = function( delay ){
  if( this.isGone )return true
  return this.age() > delay
}

Session.isAway = function(){
// Checks age of session to guess if user is away from keyboard.
// Side effect: if away for a long time, then logout() is called.
// Note: isAway() is called from some setTimeout() often enough.
  if( this.isGone ) return true
  var age = this.age()
  // If is away, ie not active for a while...
  if( age > SW.awayDelay ){
    // ... then check if inactive for a long time, enough to log out
    // Note: guest sessions are logged out after SW.awayDelay whereas
    // member sessions are logged out after longer SW.logoutDelay
    if( this.isGuest() || age > SW.logoutDelay ){
      this.login_de&&bug( "Logout inactive, age:", age)
      this.logout( "inactive")
    }
    return true
  }
  return false
}
// The method is not strictly idempotent but it can be called as often
// as one wants without damages
Session.declareIdempotentPredicate( "isAway")

Session.isThere = function(){
// Returns true if a user request was processed very recently
  return !this.isOlderThan( SW.thereDelay)
}
Session.declareIdempotentPredicate( "isThere")
  
Session.isRecent = function(){
// Returns if some activity recently
  return !this.isAway() && this.age() < SW.recentDelay
}
Session.declareIdempotentPredicate( "isRecent")

Session.touch = function(){
// Called often, helps to keep the session alive
  if( this.peerSession
  &&  this.peerSession.isAway()
  &&  this.peerSession.isGone
  ){
    this.peerSession = null
  }
  this.dateLastAccess = Sw.dateNow
  this.timeLastAccess = Sw.timeNow
}

Session.handleChangedLogin = function( page, req ){
// Check current value of twitter, facebook & linkedin name cookies.
// If changed, logout session and redirect to some decent page
// Return false if nothing happened, true if req is beeing processed.
  var oldname = this.twitterName
  var newname = this.useTwitterNameCookie( req)
  var need_tracking = false
  if( oldname ){
    // Logout if cookie disappeared/changed
    if( newname != oldname ){
      this.login_de&&bug( "Twitter cookie gone")
      this.logout( "twitter bye")
      var pagename
      if( page.isSensitive() ){
        pagename = "/HomePage"
      }else{
        pagename = "/" + page.name
      }
      pagename = ("/" + this.wiki.fullname() + pagename).replace( "//", "/")
      this.redirect( req, pagename)
      return true
    }else{
      //this.login_de&&bug( "Twitter name is still", this.twitterName)
    }
  }else{
    if( newname ){
      // If twitter login while guest, try to log with twitter credentials
      if( this.isGuest() ){
        this.login_de&&bug( "Delayed login, twitter")
        this.twitterLoginForm( newname, page, req)
        return true
      // If twitter login while already a member, track wiki membership
      }else{
        need_tracking = true
      }
    }else{
      //this.login_de&&bug( "No twitter name in cookies")
    }
  }
  var oldname = this.facebookName
  var newname = this.useFacebookNameCookie( req)
  if( oldname ){
    // Logout if cookie disappeared/changed
    if( newname != oldname ){
      this.login_de&&bug( "facebook cookie gone")
      this.logout( "facebook bye")
      var pagename
      if( page.isSensitive() ){
        pagename = "/HomePage"
      }else{
        pagename = "/" + page.name
      }
      pagename = ("/" + this.wiki.fullname() + pagename).replace( "//", "/")
      this.redirect( req, pagename)
      return true
    }else{
      //this.login_de&&bug( "Facebook name is still", this.facebookName)
    }
  }else{
    if( newname ){
      if( this.isGuest() ){
        this.login_de&&bug( "Delayed login, facebook")
        this.facebookLoginForm( newname, page, req)
        return true
      }else{
        need_tracking = true
      }
    }else{
      //this.login_de&&bug( "No facebook name in cookies")
    }
  }
  var oldname = this.linkedinName
  var newname = this.useLinkedInNameCookie( req)
  if( oldname ){
    // Logout if cookie disappeared/changed
    if( newname != oldname ){
      this.login_de&&bug( "linkedin cookie gone")
      this.logout( "linkedin bye")
      var pagename
      if( page.isSensitive() ){
        pagename = "/HomePage"
      }else{
        pagename = "/" + page.name
      }
      pagename = ("/" + this.wiki.fullname() + pagename).replace( "//", "/")
      this.redirect( req, pagename)
      return true
    }else{
      //this.login_de&&bug( "Facebook name is still", this.facebookName)
    }
  }else{
    if( newname ){
      if( this.isGuest() ){
        this.login_de&&bug( "Delayed login, linkedin")
        this.linkedinLoginForm( newname, page, req)
        return true
      }else{
        need_tracking = true
      }
    }else{
      //this.login_de&&bug( "No linkedin name in cookies")
    }
  }
  // If new info about user, track wiki membership
  if( need_tracking ){
    this.login_de&&bug( "New login info, track user")
    // Note: this is done in // whereas it is done sequentially when user
    // logs in
    // ToDo: have the caller call trackuser() and deal with potential new
    // User getting bound to session
    this.trackUser()
  }
  return false
}


Session.getPlausibleName = function( page, req ){
// Figure out the "best" way to name the user
  // If registered member, use the login name as set at login
  if( !this.isGuest() ){
    return this.loginName
  }
  // If member provided some name, use it
  if( this.isGuestMember ){
    return this.userName()
  }
  // If some name is known, use it, twitter first
  if( !this.isAnonymous() ){
    return this.twitterName
    || this.facebookName
    || this.linkedinName
    || this.loginName.replace( /Guest$/, "").replace( /^Some$/, "someone")
  }
  // Try to figure out some default name based on cookie
  // and potential twitter, facebook or ... name
  req || (req = this.req)
  if( !req )return ""
  var cookies = req.headers.cookie
  if( !cookies )return ""
  var cookied_name
  var service_name = this.twitterName || this.facebookName || this.linkedinName
  if( service_name ){
    service_name
    = this.twitterName  ? "@" + service_name
    : this.facebookName ? service_name + "@"
    : this.linkedinName ? service_name + "In"
    : service_name
  }
  var guest = ""
  var match = cookies.match( /sw_name=[@A-Z_a-z0-9\-\/]*/)
  if( match ){
    cookied_name = match[0].substr( "sw_name=".length)
    // Filter out buggy garbadge
    if( !cookied_name
    || cookied_name == "undefined"
    || cookied_name == "WikiWord"
    ){
      return null
    }
    this.de_cookie&&bug( "guess name, cookiedName: ", cookied_name)
    guest = cookied_name
    // ToDo: If cookie name is a user name, I should
    // check that the user is actually logged
    // If @ style cookie does not match twitter's, forget it
    // One cannot "stole" the identity of a twitter user
    // Idem for facebook & linkedin
    if( "@".starts( guest) ){
      if( !service_name
      || guest != "@" + service_name
      ){
        guest = ""
      }
    }else if( "@".ends( guest) ){
      if( !service_name
      || guest != service_name + "@"
      ){
        guest = ""
      }
    }else if( "In".ends( guest) ){
      if( !service_name
      || guest != service_name + "In"
      ){
        guest = ""
      }
    }
  }else{
    if( service_name ){
      this.de&&bug( "authenticName:", service_name)
      guest = service_name
    }
  }
  // Get rid of anonymous names
  if( guest == "SomeOne"
  ||  guest.includes( "Guest")
  ){
    if( service_name ){
      guest = service_name
    }else{
      guest = ""
    }
  }
  return guest
}
Session.declareIdempotentGetter( "getPlausibleName")

Session.isGuest = function(){
  // ToDo: implement guest member fully
  return this.isGuestMember || this.wiki.isGuest( this.loginName)
}
Session.declareIdempotentPredicate( "isGuest")

Session.hasUser = function(){
// Returns true if some User object is bound to the session
  return !!(this.user)
}

Session.getUserObject = function(){
// Returns the session's User object if there is one
// See userFoundEvent() where this is set
  return this.user
}

Session.isAnonymous = function(){
  if( this.twitterName            )return false
  if( this.facebookName           )return false
  if( this.linkedinName           )return false
  if( this.user ){
    this.bug_de&&bug( "User object but no authentic name")
  }
  if( this.isGuestMember          )return false
  if( this.isGuest()              )return true
  if( this.loginName == "SomeOne" )return true
  return false
}
Session.declareIdempotentPredicate( "isAnonymous")

//Session.isBot = function(){
//  return "BotGuest".ends( this.loginName)
//}
Session.declareIdempotentPredicate( "isBot")

Session.setCurrentPage = function( page ){
// Set current page and remember history of visited pages.
// Note: this is a local history, it is not the browser's history (the one
// that handles the "back" button).
// Returns page itself

  this.de&&mand( page.assertIsPage(), "not a page" )
  if( page != this.wikiPage ){
    this.previousWikiPage = this.wikiPage
  }
  this.wikiPage = page
  // Don't add to history is some case
  if( page.isCode()
  || page.isHome()
  || page == this.loginPage
  || page.isMap()
  || page.isDo()
  || this.isMentor     // Don't spy mentors
  || this.isBehindMap  // Don't spy visitor visiting secrets
  ){
    return page
  }

  // Add to array unless already there
  var found = false
  var item
  for( item in this.wikiHistory ){
    if( this.wikiHistory[item] == page.name ){
      found = true
      break
    }
  }
  // The previous current page is moved to make room for the new item
  if( !found ){
    // Move item 0 to the end of the list
    if( this.wikiHistory.length ){
      this.wikiHistory.push( this.wikiHistory[0])
    }
  }else{
    // Move item 0 to where new item was found (works if item == 0)
    this.wikiHistory[item] = this.wikiHistory[0]
  }
  // The current page is always at index 0 in history
  this.wikiHistory[0] = page.name

  return page
}

Session.getCurrentPage = function(){
  return this.wikiPage
}
Session.declareIdempotentGetter( "getCurrentPage")


Session.getCookie = function( name, req ){
  req = req || this.req || this.httpLogin
  if( !req ) return null
  var cookie = req.headers.cookie
  if( !cookie ) return null
  return this.getCookieScript( name, cookie)
}

Session.useTwitterNameCookie = function( req ){
// Extract twitter name from cookie set by twitter @anywhere scripts
// Note: twitter name does not include starting @
// Note: side effect on this.twitterId && this.twitterName
  this.twitterId    = null
  this.twitterName  = null
  this.twitterLabel = null
  var twitter_id = this.getCookie( "sw_twitter_id", req)
  if( !twitter_id
  ||  twitter_id == "null" // Dirty cookies, ignore them
  ||  twitter_id == "undefined"
  ){
    return null
  }
  // Should check signature of twitter_id
  //var signature_idx = twitter_id.indexOf( ":")
  //if( signature_idx == - 1 ) return null
  //var signature = twitter_id.substr( signature_idx + 1)
  var id = twitter_id // twitter_id.substr( 0, signature_idx)
  this.twitterId = id
  // ToDo: check signature, see http://dev.twitter.com/anywhere/begin#login-signup
  // Digest::SHA1.hexdigest( id + consumer_secret)
  var name = this.getCookie( "sw_twitter_screenname", req)
  if( !name ){
    this.login_de&&bug( "Some twitter id but not the display name")
    return null
  }
  this.twitterName = name
  // Returning anonymous user
  if( name == "SomeGuest" || name == "null" ){
    this.twitterId = this.twitterName = this.twitterLabel = null
    return null
  }
  if( this.twitterLabel = this.getCookie( "sw_twitter_label", req ) ){
    this.wiki.trackUserLabel( "@" + this.twitterName, this.twitterLabel)
  }
  this.login_de&&bug( "Twitter cookie:", this.twitterName)
  return this.twitterName
}

Session.useFacebookNameCookie = function( req ){
// Extract facebook name from cookie
// Note: facebook name does not include ending @
// Note: side effect on this.facebookId && this.facebookName
  this.facebookId    = null
  this.facebookName  = null
  this.facebookLabel = null
  var facebook_id = this.getCookie( "sw_facebook_id", req)
  if( !facebook_id
  ||  facebook_id == "null"	// Dirty cookies, ignore them
  ||  facebook_id == "undefined"
  ){
    return null
  }
  // Should check signature of facebook_id
  //var signature_idx = twitter_id.indexOf( ":")
  //if( signature_idx == - 1 ) return null
  //var signature = twitter_id.substr( signature_idx + 1)
  var id = facebook_id // twitter_id.substr( 0, signature_idx)
  this.facebookId = id
  // ToDo: check signature, see http://dev.twitter.com/anywhere/begin#login-signup
  // Digest::SHA1.hexdigest( id + consumer_secret)
  var name = this.getCookie( "sw_facebook_screenname", req)
  if( !name ){
    this.login_de&&bug( "Some facebook id but not the display name")
    return null
  }
  this.facebookName = name
  // Returning anonymous user
  if( name == "SomeGuest" || name == "null" ){
     this.facebookId = this.facebookName = this.facebookLabel = null
     return null
  }
  if( this.facebookLabel = this.getCookie( "sw_facebook_label", req) ){
    this.wiki.trackUserLabel( this.facebookName + "@", this.facebookLabel)
  }
  // Detect when I run as a Facebook app in a canvas
  this.facebookIframe = this.getCookie( "sw_facebook_iframe", req)
  this.login_de&&bug( "Facebook cookie:", this.facebookName)
  return this.facebookName
}

Session.useLinkedInNameCookie = function( req ){
// Extract linkedin name from cookie
// Note: linkedin name does not include ending In
// Note: side effect on this.linkedinId && this.linkedinName
  this.linkedinId    = null
  this.linkedinName  = null
  this.linkedinLabel = null
  var linkedin_id = this.getCookie( "sw_linkedin_id", req)
  de&&bug( "linkedin cookie is", linkedin_id)
  if( !linkedin_id
  ||  linkedin_id == "null"	// Dirty cookies, ignore them
  ||  linkedin_id == "undefined"
  ){
    return null
  }
  // Should check signature of linkedin_id but linkedin misses that...
  //var signature_idx = twitter_id.indexOf( ":")
  //if( signature_idx == - 1 ) return null
  //var signature = twitter_id.substr( signature_idx + 1)
  var id = linkedin_id // twitter_id.substr( 0, signature_idx)
  this.linkedinId = id
  // ToDo: check signature, see http://dev.twitter.com/anywhere/begin#login-signup
  // Digest::SHA1.hexdigest( id + consumer_secret)
  var name = this.getCookie( "sw_linkedin_screenname", req)
  if( !name ){
    this.login_de&&bug( "Some linkedin id but not the display name")
    return null
  }
  this.linkedinName = name
  // Returning anonymous user
  if( name == "SomeGuest" || name == "null" ){
     this.linkedinId = this.linkedinName = this.linkedinLabel = null
     return null
  }
  if( this.linkedinLabel = this.getCookie( "sw_linkedin_label", req) ){
    this.wiki.trackUserLabel( this.linkedinName + "In", this.linkedinLabel)
  }
  this.login_de&&bug( "LinkedIn cookie:", this.linkedinName)
  return this.linkedinName
}

Session.userName = function(){
// The true user name
  return this.loginName || SW.name // Defensive ||
}
Session.declareIdempotentGetter( "userName")

Session.userWikiName = function(){
// The wikinamized version of the true user name
  return this.wikinamize( this.userName(), null,
    this.isGuest() ? "Guest" : "One"
  )
}
Session.declareIdempotentGetter( "userWikiName")

Sw.wikinamizeCache = {}

Session.wikinamize = function( name, prefix, postfix ){
  return this.wiki.wikinamize( name, prefix, postfix)
}

Session.capitalnamize = function( name ){
// Canonical form for a name that needs to start with a capital.
// Returns name without leading @ and with first char capitalized
// ToDo: this is broken with facebook xxxxx@ style names.
  return name
/*
  if( "@".starts( name) ){
    return name.substr( 1, 1).toUpperCase() + name.substr( 2)
  }
  if( "@".ends( name ) ){
    this.bug_de&&bug( "Bad facebook name capitalization:", name)
  }
  return name.substr( 0, 1).toUpperCase() + name.substr( 1)
*/
}

Session.usernamize = function( name ){
// Returns "User" + something sensible about the name
  //this.de&&bug( "1, usernamize:", name)
  if( "User".starts( name) ){
    name = name.substr( "User".length)
  }
  if( !"@".ends( name) && !"In".ends( name) ){
    name = this.capitalnamize( name)
  }
  name = this.wikinamize( "User" + name, null, "One")
  //this.de&&bug( "2, usernamize:", name)
  // However "SomeOne" never turns into "UserSome" because that
  // is a bug and it took me hours to find it....
  if( "One".ends( name) && name != "SomeOne" ){
    name = name.substr( 0, name.length - "One".length)
  }else if( "Guest".ends( name) && name != "UserSomeGuest" ){ 
    name = name.substr( 0, name.length - "Guest".length)
  }
  return name
}

Session.membernamize = function( name ){
  name = name.replace( "Guest", "")
  name = this.usernamize( name).substr( "User".length)
  // this.de&&bug( "2, membernamize:", name)
  return this.wikinamize( name, null, "One")
}

Session.guestnamize = function( name ){
// A guest name ends with "Guest", this function turns a name into
// a guest name. See isGuest()
  if( !name )return "SomeGuest"
  if( name.includes( "Guest") )return this.wikinamize( name)
  name = this.wikinamize( name + "Guest")
  return (name == "SomeOne" || name == "SomeOneGuest") ? "SomeGuest" : name
}

Session.trackUser = function( user_found_cb ){
// This method gets called whenever something changes about the twitter or
// facebook id or linkedin id associated to the session.
// It tries to attach a local User object to the session and also tries to
// bind together the ids if multiple ids are provided.
// If some conflict occur, when an id already has a distinct local
// user, the twitter id is prefered, but Session.hasTwoUsers() will return
// true and the conflicting facebook user can be retrieved using
// session.user.conflict
// Note: this occurs asynchroneously
// Optional callback's signature is f( err, Session, User)
// To fix the issue, the user must log to her "personal" wiki using the
// "your wikis" link on her personal page in any wiki.
// ToDo: improve that. 1/ When linkedid is there 2/ When merging is needed

  var that = this

  var ids = {}
  var count_ids = 0
  if( this.twitterId  ){ ids["Twitter"]  = ++count_ids }
  if( this.facebookId ){ ids["Facebook"] = ++count_ids }
  if( this.linkedinId ){ ids["LinkedId"] = ++count_ids }

  // The callback is called once, when User object is found and all
  // ids were processed
  var cb_was_called = false
  var remaining_ids = count_ids

  var first_found_user
  var tracked = function trackeUser_cb( err, session, user ){
  // When all ids are processed, calls the callback
    // ToDo: err handling
    de&&mand( session == that )
    de&&mand( err || user.assertIsUser() )
    // If favor the first found user, twitter before facebook before others
    first_found_user || (first_found_user = user)
    if( cb_was_called ){
      that.bug_de&&bug( "Attempt to reenter user found callback")
      return
    }
    remaining_ids--
    if( remaining_ids ){
      that.login_de&&bug( "remainingIds:", remaining_ids)
      return
    }
    cb_was_called = true
    if( user_found_cb ){
      that.login_de&&bug( "found user, invoke cb")
      user_found_cb.call( that, err, session, first_found_user)
    }
  }

  // If both twitter & facebook, try to link account together & avoid the
  // need for a merge.
  if( this.twitterId && this.facebookId ){
    that.deep_user_de&&bug( "track both twitter & facebook")
    var tpage = User.lookup( this.wiki, "Twitter", this.twitterId)
    var fpage = User.lookup( this.wiki, "Facebook", this.facebookId)
    tpage.user.load( function( terr, tuser ){
      fpage.user.load( function( ferr, fuser ){
        if( terr && ferr ){
          that.deep_user_de&&bug( "dual track, both new, twitter first")
          // I wait for the result of twitter tracking before going further
          that.trackTwitterUser( function( err, session, tw_user ){
            that.deep_user_de&&bug( "dual track, both new, facebook")
            // Now I can track facebook because I know the local user and
            // as a result I am not going to create a duplicate
            // Note: to avoid race condition, I respect this order,
            // twitter first, then facebook.
            that.de&&mand( that.user )
            // Consume one id, don't actually fire
            tracked( 0, that, tw_user)
            // Consume another id, may fire (if no linkedin id)
            that.trackFacebookUser( tracked)
          })
          return
        }else if( terr ){
          that.deep_user_de&&bug( "dual track, twitter new")
          return that.trackFacebookUser( function(){
            that.deep_user_de&&bug( "dual track, bis, twitter new")
            that.trackTwitterUser( tracked)
            // Favor twitter, consume one id
            tracked( 0, that, that.user)
          })
        }else if( ferr ){
          that.deep_user_de&&bug( "dual track, facebook new")
          return that.trackTwitterUser( function( err, session, tw_user){
            that.deep_user_de&&bug( "dual track, bis, facebook new")
            that.trackFacebookUser( tracked)
            // Favor twitter, consume one id
            tracked( 0, that, tw_user)
          })
        }
        // Both pages exists already...
        tuser.getLocal( function( terr, ltuser ){
          fuser.getLocal( function track_local_cb( ferr, lfuser ){
            ltuser.assertLocalNotEmpty() // ToDo: this bombed once, jan 7 2011
            lfuser.assertLocalNotEmpty() // ToDo: this bombed once, feb 16 2011
            // If same local user, perfect!
            if( ltuser == lfuser ){
              that.deep_user_de&&bug( "dual track, same user")
              that.userFoundEvent( ltuser)
              // Consume both ids & fire (unless pending linkedin id)
              tracked( 0, that, ltuser)
              tracked( 0, that, ltuser)
              return
            }
            // Conflict...
            // This happens if user logged once with twitter and then
            // later with facebook, or vice-versa and then with both.
            // To unify thing, user can log with both identity at the
            // same time, or first log with facebook and then with twitter,
            // that's what the UI promotes
            // However, if user first log with facebook, then with twitter
            // and then with both... conflict! that's because two local
            // users were created, and now need to be merged.
            that.deep_user_de&&bug( "dual track, conflict")
            that.deep_user_de&&bug( "local twitter user:", ltuser)
            that.deep_user_de&&bug( "local facebook user:", lfuser)
            that.userFoundEvent( lfuser)
            that.userFoundEvent( ltuser)
            // Favor Twitter account
            tracked( 0, that, ltuser)
            tracked( 0, that, ltuser)
          })
        })
      })
    })
  }else if( this.twitterId ){
    this.deep_user_de&&bug( "track twitter")
    this.trackTwitterUser( tracked)
  }else if( this.facebookId ){
    this.deep_user_de&&bug( "track facebook")
    this.trackFacebookUser( tracked)
  }

  // Sorry but linkedin is a second class citizen for now and as a result
  // if user first logs in with linkedin and then with both linkedin &
  // either fb or twitter, there will be a conflict, needing a "merge". 
  // I apply a delay to avoid race conditions (bad, bad, bad)
  // ToDo: manage conflicts
  var interval
  function track_linkedin_user(){
    that.deep_user_de&&bug( "track linkedin")
    if( remaining_ids > 1 )return
    if( !that.linkedinId ){
      if( ids["LinkedIn"] ){
        that.deep_user_de&&bug( "Oops, no more linkedin id to track")
        // Consume one id, the last one
        tracked( 0, that, that.user)
      }
    }else{
      that.trackLinkedInUser( tracked)
    }
    if( remaining_ids <= 0 ){
      clearInterval( interval)
      interval = null
    }
  }
  if( that.linkedinId ){
    // I poll... when other ids were processed, I process linkedin's
    interval = setInterval( track_linkedin_user, remaining_ids > 1 ? 1000 : 1)
  }
}


Session.trackTwitterUser = function( cb ){
// This function gets called when a Twitter user logs in a wiki.
// It associates a "user" property to the session.
// The corresponding User objects's page are updated on store.
// Calls cb( err, this, localuser)
  var that = this
  var uid = that.twitterId
  this.de&&mand( uid )
  this.trackServiceUser( "Twitter", uid, function( err, local){
    if( cb ){ return cb.call( that, err, that, local) }
  })
}

Session.trackFacebookUser = function( cb ){
// This function gets called when a Facebook user logs in a wiki.
// It associates a "user" property to the session.
// The corresponding User objects's page are updated on store.
// Calls cb( err, this, localuser)
  var that = this
  var uid = that.facebookId
  this.de&&mand( uid )
  this.trackServiceUser( "Facebook", uid, function( err, local ){
    if( cb ){ cb.call( that, err, that, local) }
  })
}

Session.trackLinkedInUser = function( cb ){
// This function gets called when a LinkedIn user logs in a wiki.
// It associates a "user" property to the session.
// The corresponding User objects's page are updated on store.
// Calls cb( err, this, localuser)
  var that = this
  var uid = that.linkedinId
  this.de&&mand( uid )
  this.trackServiceUser( "LinkedIn", uid, function( err, local ){
    if( cb ){ cb.call( that, err, that, local) }
  })
}

Session.trackServiceUser = function( service, id, cb ){
// Track the identity of a user, returns the local user via cb( err, user)
// Optional cb's signature is f( err, Session, User)
  this.deep_user_de&&bug( "track, service:", service, "id:", id)
  var session = this
  // If there is already a local user, then I am going to use it, unless
  // the id is already bound to some other local user, in which case there
  // is a conflict
  var local_user = session.user
  var target_user
  if( !local_user ){
    this.deep_user_de&&bug( "track, no local user yet")
    var service_user_page = User.lookup( session.wiki, service, id)
    var service_user = service_user_page.user
    service_user.de&&mand( service_user.isProxy() )
    target_user = service_user
  }else{
    target_user = local_user
  }
  this.deep_user_de&&bug( "track service:", service, "id:", id,
  "onTargetUser:", target_user)
  return target_user.trackServiceId( service, id,
    function( err, local_user, user ){
      if( err ){
      }else{
        local_user.de&&mand( !local_user.isProxy() )
        session.userFoundEvent( local_user)
        cb && cb.call( err, session, local_user)
      }
    }
  )
}


Session.isPremium = function(){
  // ToDo: manage premiumship
  return true
}

Session.userFoundEvent = function( user ){
// This method gets called when a User object is found that matches the credential
// collected in the session. ie: either a twitterId, facebookId... (from cookies) that
// was turned into a User object somewhere in the login procedure
// It tracks the visit in the user's list of visited wikis.

  // User is mentor on is own "User" wiki
  user.assertLocalNotEmpty()
  if( this.wiki.isUserWiki() && this.wiki.name == "f" + user.getId() ){
    if( this.isGuest() ){
      this.bug_de&&bug( "Cannot mentor User wiki, guest")
    }else{
      if( !this.canMentor ){
        this.login_de&&bug( "owner can mentor User wiki")
        this.canMentor = true
      }
    }
  }

  if( !this.user ){
    this.user_de&&bug( "bindToUser:", user)
    this.user = user
    // Track visit if member of wiki (or if wiki is somehow secret)
    if( !this.isGuest() || this.wiki.isVeryOpen() ){
      this.user.trackVisit( this)
    }
    this.loginLog( "(identified user)")
    // Update association table between users & "id codes"
    this.wiki.logAuthenticUser( this)
  } else if( this.user == user ){
    this.bug_de&&bug( "Bind to same user:", user)
  } else {
    // Need to merge two users...
    this.user_de&&bug( "Merge:", this.user, "with:", user)
    user.de&&mand( user.isLocal )
    this.user.conflict = user
    // this.loginLog( "registered user, merge")
    // ToDo: callback & err management
    this.mergeUsers()
  }

  // Restore dropbox connectivity
  if( this.dropbox ){
    if( user.dropbox ){
      // OK. What dropbox do I use? the youngest one, ie connected recently
      if( this.dropbox.time > user.dropbox.time ){
        user.dropbox = this.dropbox
      }else{
        this.dropbox = user.dropbox
      }
    }else{
      user.dropbox = this.dropbox
    }
  }else{
    this.dropbox = user.dropbox
  }
  // Bind user to its Dropbox account
  var token = this.user.getDropboxId()
  if( this.dropbox && this.dropbox.token && !token ){
    this.trackServiceUser( "Dropbox", this.dropbox.token, Sw.noop)
  }
  if( token ){
    if( this.dropbox ){
      this.dropbox.token = token
    }else{
      this.dropbox = {token:token}
    }
  }
  if( this.dropbox ){
  }

  return this

}


Session.hasTwoUsers = function(){
// A session has two users if twitter id and facebook id refers to different
// local users.
// ToDo: handle LinkedIn too
// See mergeUsers()
  return !!(this.user && this.user.conflict)
}


Session.mergeUsers = function( cb, other_user, visited_users ){
// This method gets called to resolve a conflict regarding local user
// not beeing the same via twitter and via Facebook (or via LinkedIn, ...)
// It extracts content from the other user in order to extend the
// twitter based local user and mark the facebook local user as beeing
// "deprecated". Further reference to the deprecated local user are
// redirected to the valid local user. See class User
// Optional cb's signature is f( err, User, User)
// ToDo: handle visited wikis too + better handling of linkedin?
// ToDo: mark as "deprecated" when previous ToDo is done

  this.de&&mand( this.hasTwoUsers() )

  var that = this
  var a = this.user
  var b = other_user || a.conflict
  b.assertIsUser()

  var id
  var count_ids = 0

  de&&mand( a != b )

  // Avoid infinite loop
  visited_users || (this.mergedUsers = visited_users = {})

  if( visited_users[a] || visited_users[b] ){
    // ToDo: better err handling
    return cb && cb.call( that, 0, a, b)
  }

  visited_users[a] = true
  visited_users[b] = true

  var cb_called = false
  var tracked = function mergeUsers_cb( err ){
    if( count_ids-- > 0 )return
    if( cb_called ){
      that.bug_de&&bug( "Bad, merge should invoke callback once only")
    }else{
      cb_called = true
      cb && cb.call( that, err, a, b)
    }
  }

  // Fake id to avoid premature callback
  count_ids++

  if( id = b.getTwitterId() ){
    count_ids++
    a.trackTwitterId( id, tracked)
  }

  if( id = b.getFacebookId() ){
    count_ids++
    a.trackFacebookId( id, tracked)
  }

  if( id = b.getLinkedInId() ){
    count_ids++
    a.trackLinkedInId( id, tracked)
  }

  if( id = b.getMailId() ){
    count_ids++
    a.trackMailId( id, tracked)
  }

  if( id = b.getDropboxId() ){
    count_ids++
    a.trackDropboxId( id, tracked)
  }

  if( id = b.getDropboxId() ){
    count_ids++
    a.trackDropboxId( id, tracked)
  }

  // Undo fake id to enable callback
  count_ids--

  // Follow the chain of conflicts (domino effect, vive la revolution)
  if( b.conflict ){
    count_ids++
    that.mergeUsers( tracked, b.conflict, visited_users)
    count_ids--
  }
  if( count_ids <= 0 ){ tracked() }

  // ToDo: should merge list of visited wikis
  return

  // Not reached
  a.mergeWith( b, function( err, winner, loser ){
    if( err || !winner ){
      return cb.call( that, err, winner, loser)
    }
    winner.getHomepage( function( err, pwin ){
      if( err ){
        return cb.call( that, err, winner, loser)
      }
      loser.getHomepage( function( err, ploss ){
        if( err ){
          return cb.call( that, err, winner, loser)
        }
        pwin.wiki.mergeWith( ploss.wiki, function( err ){
          cb.call( that, err, winner, loser)
        })
      })
    })
  })
}

// section: end sessionlogin.js

// section: sessionpage.js

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
  page.maxCols = 0 // Will have to be recomputed
  var was_pure_open = this.wiki.config.veryOpen
  var old_content = page.getBody()
  var that = this
  this.session_de&&bug( "putPage: ", page, "data:", txt.substr( 0, 30))
  return page.write( txt, function session_putpage( err, page ){
    if( was_pure_open && !that.wiki.config.veryOpen ){
      that.acl_de&&bug( "Very open wiki should now belong to some visitor")
      // Revert change if user is not a mentor
      if( !that.canMentor ){
        that.warnUser( "Only a mentor can close an open wiki")
        // I cannot assume that the proto data reverts the side effect, I force
        that.wiki.config.veryOpen = true
        that.acl_de&&bug( "Revert change, page:", page)
        return page.write( old_content, cb)
      }
    }
    that.store_de&&bug( "donePutPage: ", page)
    return !cb ? (err ? null : page.getBody()) : cb.call( that, err, page)
  })
  return this
}

Session.canRestore = function( copypage ){
  return !this.isGuest() || this.wiki.config.veryOpen
}

Session.mayEdit = function( page, mayread ){
  page || (page = this.getCurrentPage())
  // Inherited "special pages" cannot be changed
  if( page.inherited
  &&  page.name != "AboutWiki"
  && !page.isHelp() 
  &&  page.isSpecial()
  && !page.isUser() // ie UserSome
  ) return false
  if( NDe&&(this.userName() == "@jhr") )return true
  // On closed wikis, guests can write on Public pages only
  if( this.wiki.isClosed() && this.isGuest() && !page.isPublic() ){
    return false
  }
  if( !(mayread || this.mayRead( page)) ){
    return false
  }
  // Only mentors can rewrite history
  if( (page.isCopy() || page.isPrivate() || page.isDeletion()
    || page.isCode()
    )
  && !this.canMentor
  ){
    return false
  }
  if( page.isDo() || page.isHtml() ){
    return false
  }
  if( page.isSecret() && this.isGuest() ){
    return false
  }
  if( page.isRead() && !this.canMentor ){
    return false
  }
  if( page.kindIs( "Guest") && !this.isGuest() && !this.canMentor ){
    return false
  }
  if( page.kindIs( "UserRestore") ){
    return false
  }
  if( page.isUserId() ){
    return false
  }
  return this.canMentor || !(page.data && page.data.isReadOnly)
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
  if( NDe&&(this.userName() == "@jhr") )return true
  // User ids are invisible, unless debugging
  if( page.isUserId() && !this.isDebug )return false
  if( this.canMentor && !this.wiki.isVeryOpen() ){ return true }
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
  // Only mentors read some pages, unless veryOpen and not an inherited page
  if( (page.isPrivate()
    || page.name == "AboutWiki"
    || page.isDeletion())	// ToDo: quid of copy pages?
  && (!this.wiki.isVeryOpen() || page.wasInherited())
  && !this.canMentor
  ){
    this.acl_de&&bug( "Only mentors can read page:", page)
    return false
  }
  // Access to secret pages
  if( page.isSecret() && !this.canMentor && !this.knows( page) ){
    this.acl_de&&bug( "secure secret page:", page)
    return false
  }
  // If I known the content of the page, I can check further
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
  if( this.canMentor ){ return true }
  
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
    && !(this.twitterName  && validusers.includes( "@" + this.twitterName))
    && !(this.facebookName && validusers.includes( this.facebookName + "@"))
    && !(this.linkedinName && validusers.includes( this.facebookName + "In"))
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
  if( page.data && page.data.isMentorLock && !this.canMentor ){
    this.acl_de&&bug( "Locked, mentors only, page:", page)
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
  //if( "User".starts( page) && !this.isMentor ) returns false
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
  return this.canMentor || !page.isUser()
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
  // No trace in mentoring mode
  if( this.isMentor )return
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

// section: end sessionpage.js

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
  if( !this.config.rows || !this.screenCols || this.isTouch ){
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

// section: sessioncmd.js

Session.doPageCommands = {
  Noop: function( cmd, cb ){ return cb( "Noop") }
}

Session.doPageCommands.Bye = function( cmd, cb ){
// Logs user out of current session
  this.logout( "bye")
  return cb( {body:"Bye bye", redirect:true})
}

Session.doPageCommands.ByeBye = function( cmd, cb ){
// Logs user out of all sessions, up and back to index.html, aka "hard logout"
  this.logout( "bye")
  var target = this.wiki.isRoot() ? "/index.html" : "in"
  // Forget dropbox credentials
  if( this.dropbox ){
    this.dropbox.password = "empty"
    this.dropbox.client   = null
  }
  // ToDo: debug this, it does not work
  return cb( {body:"Bye bye bye", redirect:true, url:"/in"})
}

Session.getAllWikiPageNames = function( without_empty ){
// Return sorted list of wiki page names.
// Page that the user cannot read are skipped.
  var all_pages = this.wiki.getAllPages()
  var that      = this
  var pages     = []
  all_pages.forEach( function( page ){
    if( !that.mayRead( page) )return
    if( page.wasIncarned() && !that.canRead( page, true) )return
    if( page.wasIncarned() && without_empty && page.isNull() )return
    pages.push( page.name)
  })
  pages = pages.sort()
  return pages
}

Session.getAllWikiPages = function( without_empty ){
// Return sorted list of wiki pages
// Page that the user cannot read are skipped.
  var all_pages = this.wiki.getAllPages()
  var that      = this
  var pages     = []
  all_pages.forEach( function( page ){
    if( !that.mayRead( page) )return
    if( page.wasIncarned() && !that.canRead( page, true) )return
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
    var backlinks = page.getBacklinks( this.isMentor) // with_private
    // Remove some noise
    if( (links.length + backlinks.length) < 2 )return
    if( backlinks.length < 1 )return
    // Skip help pages, unless root wiki
    if( !(that.wiki.isRoot() && that.isMentor)
    && (("CategoryHelp" in backlinks)
     || ("CategoryMentoring" in backlinks && !that.canMentor))
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

  var that = this
  var buf  = []

  function respond(){
    push( "\n\nDoProfile, DoListLogin, SignIn, DoBye, DoByeBye\n")
    cb( buf.join( "\n"))
  }
  function push( msg ){ buf.push( msg) }

  push( this.userName() + " Code" + this.loginCode)

  if( this.isGuest() ){
    push( this.i18n( "guest in")  + " " + this.wiki.fullname( SW.name, true))
  }else{
    push( this.i18n( "member of") + " " + this.wiki.fullname( SW.name, true))
  }

  if( !this.user ){
    push( "No login, yet. SignIn")
    return respond()
  }

  function dump_user( user, loop ){

    for( var item in user.id ){
      push( item + that.i18n( " ") + user.id[item])
    }
    push( "\n[" + that.i18n( "private wiki")
      + "](http://" + SW.domain + "/user/f" + user.getId() + " Yours)"
    )
          var list = []
	  var visit // see User.trackVisit()
	  var wiki
	  var title
	  var login
	  var name
	  var code
	  var time
	  var ii
	  var entry
          for( item in user.visits ){
	    visit =  user.visits[item]
	    wiki  = visit.wiki // fullname, '/' terminated unless "" root
	    title = Wiki.sanitizeTitle( visit.title)
	    login = (visit.login || "").replace( /\/$/, "") // ToDo: fix source
	    name  = visit.name
	    code  = visit.code
	    time  = visit.time
	    // Patch old format (v 0.04)
	    if( !wiki || "/".ends( wiki) ){
	      if( (ii = item.lastIndexOf( "/")) >= 0 ){
		wiki  = item.substr( 0, ii + 1)
		login  = item.substr( ii + 1)
	      }else{
		wiki  = item ? (item + "/") : ""
		login = ""
	      }
	    }
	    if( !login ){
	      if( (ii = item.lastIndexOf( "/")) >= 0 ){
		login = item.substr( ii + 1)
	      }
	    }
            entry = ""
            + time
	    + (name == that.userName() ? "" : " " + name)
	    + "\n[" + (!title ? wiki.replace( /\/$/, "") : title)
            + "](http://" + SW.domain + "/"
	    + encodeURI( wiki + login)
	    + (!code  ? "" : "?code=" + encodeURIComponent( code))
            + ")"
            //+ "\n  "   + user.visits[item].name
	    // ToDo: fix this, there should be no /?code
	    entry = entry.replace( "/?code", "?code")
	    list.push( entry)
          }
          if( list.length ){
            buf.push( that.i18n( "\nVisits") + that.i18n( ": "))
            list = list.sort().reverse()
            buf = buf.concat( list)
          }
          if( user.conflict ){
            if( loop ){
              buf.push( "...")
            }else{
              buf.push( that.i18n( "\nUpdated:"))
              // ToDo: better handling of loop, should visit all conflicting
              // users (and avoid infinite loop)
              dump_user( user.conflict, true)
            }
          }
  }

  push( "")
  dump_user( this.user)
  respond()
}

Session.doPageCommands.ListLogin = function( cmd, cb ){
  return cb(
    this.loginLogList.join( "\n")
    + "\n\nDoProfile, SignIn" + (!this.isGuest() ? ", DoBye, DoByeBye" : "")
  )
}


// -------------------
// section: dropbox.js
//
// npm dropbox

// Try to install support for Dropbox
try{
  Dropbox = require( "dropbox")
  Section.sys.puts( "dropbox module loaded")
  if( !SW.dbkey ){
    Section.sys.puts( "No Dropbox key (SW.dbkey)")
    Dropbox = null
  }
  if( !SW.dbsecret ){
    Section.sys.puts( "No Dropbox secret (SW.dbsecret)")
    Dropbox = null
  }
}catch( err ){
  Section.sys.puts( "No Dropbox support, needs npm dropbox")
  Section.sys.puts( "err: " + Sys.inspect( err))
  Section.sys.puts( "Current 'require.paths' is " + require.paths)
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
  = (that.isMentor ? "ToDoDropboxPages" : ("ToDoDropbox" + that.userName()))
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

  // Get email/password from invokation page's data
  var password = that.getSessionData( "password", on_page)
  // OK, let's forget the password ASAP
  that.setSessionData( "password", "empty", on_page)
  var email = that.getSessionData( "email", on_page)

  that.de&&bug( "email:", email, "password:", password)

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

  that.de&&bug( "2, email:", email, "password:", password)

  // If no email, try to get one from user's profile
  if( !email && this.user ){
    email = this.user.getMailId()
    that.de&&bug( "user email:", email)
  }

  that.de&&bug( "3, email:", email, "password:", password)

  // Sanitize email
  email = Wiki.sanitizeMail( email)

  that.de&&bug( "4, email:", email, "password:", password)

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
        function loop( seen ){
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
    = this.canMentor ? this.wiki.homePage : this.lookup( this.userName())
    function export_list( list ){
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
        && (that.isMentor
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

// section: end dropbox.js


Session.doPageCommands.Cloud = function( cmd, cb ){
  
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
        if( typeof( config.limit ) != 'undefined'
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
    var backlinks = page.getBacklinks( this.isMentor) // with_private
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

Session.doPageMentorCommands = {}
Session.doPageMentorCommands.Mentoring = function( cmd, cb ){
  this.isMentor = this.canMentor
  this.notify( "You are now in 'Mentoring' mode")
  cb( this.i18n( "DoNoMentoring"))
}
Session.doPageMentorCommands.NoMentoring = function( cmd, cb ){
  this.isMentor = false
  this.notify( "You are now in 'Normal' mode")
  cb( this.i18n( "DoMentoring"))
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

  if( cmd == "Drafts" || cmd == "DraftsAndCodes" ){
    // Display list of draft pages.
    // Guest don't see draft codes & draft users, disturbing
    // non mentors see codes obscured, they can monitor if mentors manage them
    var buf        = []
    var bufcodes   = []
    var bufusers   = []
    var with_codes = (that.canMentor && cmd == "DraftsAndCodes" || that.isMentor)
    that.wiki.forEachDraft(
      function( page ){
        (page.isCode() ? bufcodes : (page.isUser() ? bufusers : buf))
        .push( 
          ((page.isCode() && !with_codes) ? "DraftCode" : page.name)
          + " - "
          + that.tooltip( page, true).replace( that.i18n( "a draft") +", ", "")
        )
      },
      with_codes 
    )
    // Set a flag so that "drafts" stays on top menu for a while
    // Why: because when one visit drafts it is unpleasant to have to get back
    // to the home page in order to have access to the "drafts" option.
    that.visitingDrafts = 7
    return cb(
      buf.join( "\n")
      + (!that.isGuest() && bufcodes.length
        ? "\n\nCodes:\n" + bufcodes.join( "\n")
        : ""
      )
      + (!that.isGuest() && bufusers.length
        ? "\n\nUsers:\n" + bufusers.join( "\n")
        : ""
      )
      + "\n" + "RecentStamps"
    )
  }
  
  if( cmd == "ClearAllDrafts" && that.canMentor ){
    that.isMentor && that.doPage( "ClearDraftCodes")
    that.wiki.forEachDraft( function( page ){ page.trash() })
    that.notify( that.i18n( "Done, all draft pages were cleared"))
    return cb( that.i18n( "\nDoDrafts\nDoDraftsAndCodes"))
  }
  
  if( cmd == "ClearDraftCodes" && that.canMentor ){
    var user
    var userpage
    that.wiki.forEachDraft( function( page ){
        if( !page.isCode() )return
        user = that.usernamize( page.getFirstUser())
        if( userpage = that.lookup( user) ){
          user = userpage.getFirstUser()
          userpage.trash()
          userpage = that.lookup( that.usernamize( user))
          userpage.trash()
        }
        page.trash()
      },
      true // true => with codes
    )
    that.notify( that.i18n( "Done, all draft codes were cleared"))
    return cb( that.i18n( "\nDoDrafts\nDoDraftsAndCodes"))
  }

  if( cmd == "Visits" ){
    // Display visits, with some classification
    var buf0 = []
    var buf1 = []
    var buf11 = []  
    var buf2 = []
    var buf3 = []
    var buf4 = []
    var msg
    var n = 0
    wiki.forEachSession( function( session ){
      // Skip bots
      if( session.isBot )return
      if( true || that.isMentor || !session.isMentor ){
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
    // ToDo: i18n
    return cb( [
      buf0.length  ? "Now:\n" + buf0.sort().join( "\n") : "",
      buf1.length  ? "\n\nRecent:\n" + buf1.sort().join( "\n") : "",
      buf11.length ? "\n\nAway members:\n" + buf11.sort().join( "\n") : "",
      buf2.length  ? "\n\nGone members:\n" + buf2.sort().join( "\n") : "",
      buf3.length  ? "\n\nRecent guests:\n" + buf3.sort().join( "\n") : "",
      buf4.length  ? "\n\nGuests:\n" + buf4.sort().join( "\n") : ""
    ].join( ""))
  }
  
  if( cmd == "Members" ){
    var buf1 = []
    var buf2 = []
    wiki.forEachMember( function( session, code ){
      (session.isAway() ? buf2 : buf1)
      .push( session.userName() + (session.canMentor ? "!" : "") 
        + " - " + session.dateLastAccess.toISOString()
        + (that.canMentor ? " - Code" + code : "")
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
      + (that.canMentor ? "\n\nPrivateCodes" : "")
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
      that.isMentor 
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
    var root = this.canMentor ? this.doOnPage : this.lookup( this.userName())
    this.wiki.forEachPage( root, this, function( page ){
      if( page ){
        if( that.mayEdit( page)
        && (that.isMentor
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
            that.isMentor 
            ? "HtmlPages"
            : that.wikinamize( "Html" + that.userName())
          ),
          '<div>\n<a href="#' + root + '">Home<a>\n</div><hr>\n'
          + buf.sort().join( "<hr>\n"),
          function(){
            cb( 
              that.isMentor
              ? "HtmlPages"
              : that.wikinamize( "Html" + that.userName())
            )
          }
        )
      }
    })
    return "HtmlPages"
  }
  
  // The other pages are for mentors only
  if( !this.canMentor ){
    this.de&&bug( "Do for mentors only")
    return cb( this.i18n( "err:locked"))
  }

  // Hash based dispatch
  cmdcmd = Session.doPageMentorCommands[cmd]
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
    
  // The other pages are for mentors only
  if( !this.canMentor ){
    this.de&&bug( "Do for mentors only")
    return cb( this.i18n( "err:locked"))
  }
  
  // page AboutWiki management
  var regex = /^(.*)Wiki$/
  var match
  if( match = cmd.match( regex) ){
    cmd = match[1]
    if( ["", "Open", "Mentor", "Closed"].indexOf( cmd) >= 0 ){
      if( (cmd == "Mentor" || cmd == "Closed")
      && !that.canMentor
      ){
        return cb( "Mentor")
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
        "id: "       + session.loginId,
        "name: "     + session.loginName,
        "code: "     + session.loginCode,
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
        global.debug()
      }else if( on === false ){
        global.ndebug()
      }else if( on == "toggle" ){
        global.toggleDebug()
      }
    }
    return this.doPage( "TraceDomains", cb)
  }
  // Shell scripts
  var shellcmd = "./" + (SW.dir || ".") + "/PrivateShell " + cmd;
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
  function track( obj ){
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
  
  function esc( str ){
    return Wiki.htmlize( str
    .replace( /\"/g, '\\"')
    .replace( /\n/g, '\\n'))
  }
  
  function frag( str, n ){
    str = str.toString()
    n || (n = 30)
    if( str.length <= n )return '"' + esc( str) + '"'
    return '"' + esc( str.substr( 0, n)) + "..."
  }
  
  var that = this
  function link( key ){
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
  function type( obj ){
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
    return 'undefined'
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

// section: end sessioncmd.js

// section: wikify.js

// Can I haz Markdown?
Markdown = null
try{
  Markdown = require( "markdown")
}catch( err ){
  Section.sys.puts( "No markdown, see https://github.com/evilstreak/markdown-js")
  Section.sys.puts( "try npm install markdown")
  Section.sys.puts( Sys.inspect( err))
}

Session.wikifyText = function sw_wikify( text, is_rfc ){
// Do the best with few information
// Both client side & server side
//
// ToDo: deep linking: http://open.blogs.nytimes.com/2011/01/11/emphasis-update-and-source/#h%5BWtEIyw,2%5D

  if( !text )return ""

  // ToDo: optimize, see http://jmrware.com/articles/2010/jqueryregex/jQueryRegexes.html
  var client_side = typeof Session === "undefined"

  // Delegate to markdown?
  client_side && de&&bugC( "Wikify!")
  if( text.indexOf( "mrkdwn") >= 0 ){
    // ToDo: delegate
    // https://github.com/evilstreak/markdown-js
    // See also fun http://covertprestige.info/css/remarkdown/remarkdown.css
    text = text.replace( /&lt;/g, "<").replace( /&gt;/g, ">").replace( /&amp;/g, "&")
    if( !client_side && Markdown ){
      return '\n<div class="sw_markdown">\n'
      + Markdown.markdown.toHTML( text)
      + "</div>"
    }
    if( client_side ){
      try{
        de&&bugC( "Markdown!")
        return '\n<div class="sw_markdown">\n'
        + window.markdown.toHTML( text)
        + "</div>"
      }catch( err ){
        text = "!No markdown!\n\n" + text
        .replace( /</g, "&lt;").replace( /&/g, "&amp;").replace( />/g, "&gt;")
      }
    }
  }

  if( text.search( /mdwk/i) ){
    // ToDo: delegate to mediawiki parser (server side only)
    // See http://kiwi.drasticcode.com/
    // A good candidate for C to Javascript compilation!
  }

  // Handle unformatted <code>...</code> sections
  var delimit  = "\n&lt;code&gt;\n"
  var delimit2 = "\n&lt;/code&gt;\n"
  if( false && client_side ){
    delimit  = "\n<code>\n"
    delimit2 = "\n</code>\n"
  }
  var frags = text.split( delimit)
  if( frags.length > 1 ){
    var frag
    var buf = []
    var idx
    for( var frag_id in frags ){
      frag = frags[frag_id]
      if( frag_id > "0" ){
        buf.push( "<code>" + delimit)
        if( (idx = frag.lastIndexOf( delimit2)) >= 0 ){
          idx += delimit2.length
          buf.push( frag.substr( 0, idx) + "</code>")
          buf.push( wikify( frag.substr( idx)))
        }else{
          buf.push( frag + "</code>")
        }
      }else{
        buf.push( wikify( frag))
      }
    }
    return buf.join( "")
  }else{
    return wikify( text)
  }

  // ToDo: handle some safe HTML constructs

  // Big nested function. ToDo: should indent
  function wikify( text ){

  // List management:
  var depths  = [0]
  var closing = ["Pop error"]
  
  function reset_lists(){
  // Close remaining open lists, at end of text
    var buf = "" //+ "-reset-@" + depths[0] + "-"
    while( depths.length > 1 ){ // Ignore 0th item
      depths.shift()
      buf += closing.pop()
    }
    return buf //+ "-ok-@" + depths[0] + "-"
  }
  
  function dolist( line, spaces, stars, rest ){
  // Handle a line that is a list element
    // Avoid interference with time stamped empty log messages
    if( line.match( /\<time/) ){
      return reset_lists() + line
    }
    // empty item resets everything, ie " ."
    if( !rest ){ 
      return reset_lists() + "<dfn>" + spaces + stars + "</dfn>"
    }
    var buf = ""
    var d = spaces.length + stars.length
    //buf += " @" + depths[0] + " " + d + " "
    var is_ordered = (stars.indexOf( "#") >= 0)
    if( is_ordered ){
      stars = stars.replace( /[0-9#]*/, "")
    }
    if( d == depths[0] ){
      return buf + "</li><li><dfn>" + spaces + stars + "</dfn>" + rest
    }
    while( d < depths[0] ){
      buf += closing.pop()
      depths.shift()
    }
    if( d > depths[0] ){
      depths.unshift( d)
      if( d != depths[0] ){ buf += "broken" }
      if( is_ordered ){
        closing.push( "</li></ol>")
        return buf + "<ol><li><dfn>"
        + spaces + stars + "</dfn>" + rest
      }else{
        closing.push( "</li></ul>")
        return buf + "<ul><li><dfn>"
        + spaces + stars + "</dfn>" + rest
      }
    }
    return buf + "</li><li><dfn>" + spaces + stars + "</dfn>" + rest
  }
 
  // ToDo: optimize, see http://jmrware.com/articles/2010/jqueryregex/jQueryRegexes.html
  var client_side = typeof Session === "undefined"
  
  text = text
  // \ Protect
  .replace( /\n\\.*?\n/g, function( line ){
    return "\r" + escape( "\n" + line.substr( "\n\\".length) + "\n") + "\r"
  })
  // Yaml
  .replace( /(\n---\n {0,2}(\w+:.*\n)+)/, '<div class="yaml">$1</div>')
  // !!! ToDo: <ins> & <del>
  .replace( /^!!!(.*?)$/gm,
    '<span class="diff">$1</span>')
  // "xxxxx"
  .replace(    /([^=]|^)"([^"><]{2,}?[^="\s><])"/g,
    "$1&quot;<cite>$2</cite>&quot;")
  // **xxxxx**
  .replace(  /(\s|^)\*\*([^*\s<][^*<]*?[^*<])\*\*/g,
    "$1<dfn>*</dfn><dfn>*</dfn><em>$2</em><dfn>*</dfn><dfn>*</dfn>")
  // *xxxxx*
  .replace( /(\s|^)\*([^*\s<][^*<]*?[^*\s<])\*/g,
    "$1<dfn>*</dfn><b>$2</b><dfn>*</dfn>")
  // /xxxxx/
  .replace( /(\s|^)\/([^\/\s<][^\/<]*?[^\/\s])\//g,
    "$1<dfn>/</dfn><i>$2</i><dfn>/</dfn>")
  // __xxxxx__
  .replace(    /(\s|^)__([^_\s<][^_<]*?[^_<])__/g,
    "$1<dfn>**</dfn><em>$2</em><dfn>**</dfn>")
  // _xxxxx_
  .replace(    /(\s|^)_([^_\s<][^_<]*?[^_\s<])_/g,
    "$1<u>_$2_</u>")
  // [an example link](http://example.com/) -- markdown's style
  // This comes after some wikification done server side, hence <a etc
  .replace(  /<a href="\/\[([^\]]*?)].*?<\/a>\(<a href="([^"]*?)".*?<\/a>\)/g,
    '<a href="$2">$1</a>')
  // ![alt text](/path/to/img.jpg")
  .replace(  /!<a href="\/\[([^\]]*?)].*?<\/a>\(<a href="([^"]*?)".*?<\/a>\)/g,
    '<img src="$2" alt="$1" />')
  // [an example link](http://example.com/ titled)
  .replace(  /<a href="\/\[([^\]]*?)].*?<\/a>\(<a href="([^"]*?)".*?<\/a> (.*)\)/g,
    '<a href="$2" title="$3">$1</a>')
  // ![alt text](/path/to/img.jpg "Title")
  .replace(  /!<a href="\/\[([^\]]*?)].*?<\/a>\(<a href="([^"]*?)".*?<\/a> (.*)\)/g,
    '<img src="$2" title="$3" alt="$1" />')
  // !xxxxx!
  .replace(  /(\s|^)!([^!\s&<][^!\n&<]*?[^!\s&<])!/g,   "$1<dfn>!</dfn><em>$2</em><dfn>!</dfn>")
  // (xxxxx)
  .replace(   /(\s|^)\(([^)\s&<][^)<]*?[^)\s&<])\)/g,  "$1<dfn>($2)</dfn>")
  if( is_rfc )return text
  if( false && client_side ){
    text = text
    .replace( /^(\s+)<([^\/]*)>\s*?$/gm,
      '<div align="center"><var>&lt;</var>$1<var>&gt;</var></div>')
    .replace(   /^(\s+)([^<]*)>\s*?$/gm,
      '<div align="right"> $2<var>&gt;</var></div>')
  }else{
    text = text
    .replace( /^(.*)&lt; (.*) &gt;\s*$/gm,
      '<div align="center">$1<var>&lt;</var>$2<var>&gt;</var></div>')
    .replace( /^(\s+.*) &gt;\s*$/gm,
      '<div align="right">$1<var>&gt;</var></div>')
  }
  text = text
  .replace( /(\s)-([A-Za-z]+)-/g,
    '$1-<strike>$2</strike>-')
  
  // Split in lines to handle nested lists
  var lines = text
  var linetbl = lines.split( "\n")
  for( var ii = 0 ; ii < linetbl.length ; ii++ ){
    text = linetbl[ii]
    // Two consecutive empty lines resets the lists
    if( !text && !linetbl[ii + 1] ){
      text = reset_lists()
    }
    // ----- for hr
    text = text
    .replace( /^( +)(---+)\s*?$/gm,  function( _, spaces, dash ){
      return reset_lists()
      + '<div class="sw_hr"><dfn> </dfn>' + dash + '</div>'
    })
    // ToDo: turn these 5 rules into one, with reset_lists() in it
    .replace( /^\+\+\+\+\+(.*?$)/gm, '<h5><var>+++++</var>$1</h5>')
    .replace( /^\+\+\+\+(.*?)$/gm,   '<h4><var>++++</var>$1</h4>')
    .replace( /^\+\+\+(.*?)$/gm,     '<h3><var>+++</var>$1</h3>')
    .replace( /^\+\+(.*?)$/gm,       '<h2><var>++</var>$1</h2>')
    .replace( /^\+(.*?)$/gm,         '<h1><var>+</var>$1</h1>')
    // Handle nested lists, space and * . or - prefixed, space defined depth
    // ToDo: # for numbered list
    .replace( /^( +)([0-9]*[*.#-]+)(.*)$/gm, dolist)
    linetbl[ii] = text
  }
  text = linetbl.join( "\n")
  
  // Close unclosed lists
  text += reset_lists()

  // ToDo: don't mess with user input, fix css styles instead
  // ... but how, how, how?
  text = text
  .replace( /\n{1,2}<(div|h.)>/g,    "<$1>")  // <div> introduces a break, copy/pasted, rmv it
  .replace( /<\/(div|h.)>\n{1,2}/g, "</$1>")  // Idem for <h1>, <h2>, etc
  // Unprotect
  .replace( /\r(.*)\r/g, function( _, match ){ return unescape( match) })

  return text
  } // end of nest function wikify()
}


Session.angularizeScript = function sw_angularize( $ ){
  if( !$ ){
    sw_text_changed = false
    return
  }
  // If page is not a ToDo page, just compile
  if( !window.sw_page_needs_angularize ){
    angular.compile( window.document).$init() // $text.get()).$init()
    return
  }
  // If page is not angular, angularize before compiling
  var $text  = $('#content_text')
  var html   = $text.html()
  if( !html )return
  var $ta    = $('#textarea_sw')
  var ta_txt = $ta.val()
  // ToDo: should extract the yaml section first
  var regexp = /\n( {0,2})(\w+)(:\s*)[^\n]+/g
  var all_names  = []
  var all_values = {}
  html = html.replace( regexp, function( line, spaces, attr, sep ){
    // Skip some stuff that must not be angularized
    if( attr == "angular" )return line
    // Skip "Note:" for example
    if( attr.charAt( 0).toLowerCase() != attr.charAt( 0) )return line
    // Extract value from textarea, there is no html markup there
    var value
    var patt = "\n" + spaces + attr + sep
    // console.log( "Looking for " + patt)
    var ii = ta_txt.indexOf( patt)
    if( ii < 0 ){
      // Weird
      return line
    }
    value = ta_txt.substr( ii + patt.length)
    var ii = value.indexOf( "\n")
    if( ii < 0 ){
      // Weird
      return line
    }
    value = value.substr( 0, ii)
    // console.log( "angularize " + attr + " is " + value)
    all_names.push( attr)
    all_values[attr] = value
    // Infer type from name and value
    var type = "text"
    function includes( part ){
      return attr.toLowerCase().indexOf( part) >= 0
    }
    if( includes( "mail") ){
      type = "email"
    }
    if( includes( "url") ){
      type = "url"
    }
    if( includes( "color") ){
      type = "color"
    }
    if( includes( "date") ){
      type = "date"
    }
    if( includes( "time") ){
      type = "time"
    }
    if( includes( "datetime") ){
      type = "datetime-local"
    }
    if( includes( "code") || includes( "secret") || includes( "pass") ){
      type = "password"
    }
    function starts_with( part ){
       return attr.substr( 0, part.length) == part
    }
    if( starts_with( "is") || starts_with( "can") || starts_with( "may")
    || starts_with( "no")
    ){
      type = "bool"
    }
    if( value == "false" || value == "no" || value == "f" || value == "[]"
    || value == "true" || value == "yes"
    ){
      type = "bool"
    }
    // Some "predefined" wellknown attributes
    if( attr == "cols" || attr == "rows" ){
      type = "number"
    }
    var buf = '\n'
    + spaces
    + attr
    + sep
    + '<input'
    + ' class="angular_input'
    + '" id="sw_in_' + attr
    + '" name="'     + attr
    + '" value="'    + value
    + '" type="'     + type
    + '"/><span class="angular_output'
    + '" id="sw_out_' + attr
    + '">'
    + ' {{' + attr + '}}'
    + '</span>'
    if( type == "bool" ){
      buf = buf.replace( 'type="bool"', 'ng:format="boolean"')
    }
    if( type == "number" ){
      buf = buf.replace( 'type="number"',
      'ng:format="number" ng:validate="integer"')
    }
    if( type == "email" ){
      buf = buf.replace( 'type=', 'ng:validate="email" type=')
    }
    if( type == "url" ){
      buf = buf.replace( 'type=', 'ng:validate="url" type=')
      buf = buf.replace( '}}', ' | linky}}')
    }
    if( type == "password" ){
      // ToDo: I could display colors,
      // See http://www.binpress.com/app/chroma-hash/53
      buf = buf.replace( / {{.*}}/, "")
    }
    return buf
  })
  var script = html
  $text.html( script)
  // Some CSS style disable the yaml section, restore it
  // ToDo: I should restore it only if some attr come from it
  if( all_names.length ){
    $('.yaml').css( 'display', 'visible')
    // Let's have the magic
    // console.log( "compile")
    // console.log( $text.get())
    angular.compile( window.document).$init() // $text.get()).$init()
  }
  // Define a function that collects current values
  sw_angular_inputs = function sw_angular_inputs(){
    var new_values = {}
    var new_value
    sw_text_changed = false
    for( var attr in all_values ){
      new_value = $('#sw_in_' + attr).val()
      new_values[attr] = new_value
      if( new_value != all_values[attr] ){
        sw_text_changed = attr
        // console.log( "Changed " + attr + " => " + new_value)
      }
    }
    return new_values
  }
}


Session.wikify = function( text, page, format, visited, cb ){
// Process basic markup rendering

  var that = this

  // ToDo: Haml?
  // ToDo: cache?
  NDe&&bug( "Wikify ", page)
  // null defense
  text || (text = "")
  
  // Only custom domain can have raw html content
  // This is to prevent XSS (Cross domain Scripting attacks)
  // ToDo: what about Angular then... !
  // There must be a better way to do this
  if( page && page.isHtml() && this.isCustom ){ return text }

  var is_markdown = page && page.isMarkdown()
  
  var wiki_names = SW.wikiwords

  // Get a restrictive definition of wikiwords when operating on source code
  // why: in source code, to much stuff look like a wikiword that should not
  var is_code = page && (page.isAngular() || page.isCss())
  if( is_code || is_markdown ){
    // Pattern to isolate wiki words out of stuff
    wiki_names = new RegExp(
      "([^=@#A-Za-z0-9_~\?&\)\/\\\">.-]|^)"
      + "([A-Z_][a-z0-9_]+[A-Z_][A-Za-z0-9_]+)" // "Pure" wikiwords
      , "gm"
    )
  }

  var date = new RegExp( "(" + SW.datePattern + ")", "gi")
  var is_rfc = page && "#rfc".starts( page.name)
  
  function tocable( item ){
  }
  // Special "TocAll" page, for members only
  if( !this.isGuest()
  && page
  && page.name == "TocAll"
  && this.wiki.name != "c2"
  ){
    var dofilter
    // ToDo:
    // if( page && page.isFilter() ){
    //   dofilter = page.getFirstLine()
    //   dofilter = this.filterParse( dofilter)
    var list = []
    var item
    var itempage
    for( item in this.wiki.allPages ){
      itempage = this.wiki.allPages[item]
      if( !"Do".starts(   item)
      &&  !"#rfc".starts( item)
      &&  (!"UserRestore".starts( item) || this.isMentor)
      &&  this.mayRead( itempage)
      &&  (this.canMentor || !itempage.isCode() )
      &&  (!(itempage.wasIncarned() && itempage.isVoid()) || this.isMentor)
      &&  (!dofilter || this.passFilter( dofilter, itempage))
      ){
        list.push( item + " " + this.tooltip( itempage, true))
      }
    }
    this.de&&bug( "TocAll: ", list.sort().join( " ; "))
    list = list.sort()
    // ToDo: would be cool to visualize relationshipts as a graph,
    // see http://arborjs.org/reference
    text = text + "\n\n"
    + list.length + " " + this.i18n( "Pages:") + "\n" + list.join( "\n")
  }
  
  // For small pages, it is usefull to check the length of longest line
  // This helps to use a big font on small pages
  if( !is_code ){
    var maxlen = 0
    if( page ){
      delete page.maxCols
    }
    if( !this.twoColumns
    && page
    && !page.isToc()
    && !page.isDo()
    && text.length < 1024
    ){
      NDe&&bug( "Small page, find longest line")
      var lines = text.split( "\n")
      if( lines.length < 32 ){
        for( var ii in lines ){
          if( lines[ii].length > maxlen ){
            maxlen = lines[ii].length
          }
        }
      }
    }
    // In some display configurations I increase the font size
    if( maxlen && maxlen < this.config.cols ){
      NDe&&bug( "Small page, maxCols: ", maxlen)
      page.maxCols = maxlen > 10 ? maxlen : 10
      // Adjust based on width of page's name
      // ToDo: do this in viewForm() I guess
      var label_width = "Page ".length + page.name.length
      if( page.maxCols < label_width ){
        this.de&&bug( "Adjust small page width to match label:", label_width)
        page.maxCols = label_width
      }
    }
  }
  
  // HTML, let's get <,>, & right
  if( !format ){
    // Split parts if twitter style message
    if( (page && page.isTweet())
    && !page.isSensitive()
    && text.length > 140
    ){
      // Add a 140 mark, removed later
      var text140 = text.frontLine().substr( 0, 140)
      var text141 = text.substr( text140.length)
      text = '<span class="twitter">' + Wiki.htmlize( text140) 
      + '</span>'                     + Wiki.htmlize( text141)
    }else{
      text = Wiki.htmlize( text)
    }
  }
  // Don't do much for logs
  if( page && page.name.includes( "DebugTail") ){
    return !cb ? text : cb( text)
  }
  var href = "/"
  if( format ){
    if( format == "permalinks"){
      href = this.wiki.permalink( "")
    }else{
      href = '#'
    }
  }
  // Let's get a Wiki look
  
  // If fluid layout, handle \n to make p or br
  // ToDo: maybe I should use markdown
  if( !this.config.rows ){
    text = text
    .replace( /\n/g, "\n<br/>\n")
    .replace( /\n<br\/>\n\n<br\/>\n/g, "\n<p/>\n")
  }

  // Interwiki links, unless source code page
  if( !is_code && !is_markdown ){
    var text = text.replace(
      // This pattern tends to interfere with urls, hence: some restrictions
      /(\s|^)([A-Z][A-Za-z0-9\-]+?):([\w\//@#.-]{3,})/g,
      function( h, front, m, rest ){
        // De&&bug( "Interwiki match: ", m)
        return front + '<a href="'
        + Wiki.htmlizeAttr(
	  that.wiki.interwiki( m) + rest)
        + '">'
        + m + ":" + rest
        + "</a>" 
      }
    )
  }

  // Soft urls, very soft, xyz.abc style
  // The pattern is tricky, took me hours to debug it
  var surl =
  /([\s>]|^)([^\s:=@#"([)\]>][a-z0-9.-]+\.[a-z]{2,4}[^\sA-Za-z0-9_!.;,<"]*[^\s:,<>"']*[^.@#\s:,<>'"]*)/g
  /*
   *  (([\s>]|^)             -- space or end of previous link or nothing
   *  [^\s:=@#"([)\]>]       -- anything but one of these
   *  [\w.-]+                -- words, maybe . or - separated/terminated
   *  \.[a-z]{2,4}           -- .com or .org or .xxx
   *  [^\sA-Za-z0-9_!.;,<"]* -- ? maybe
   *  [^\s:,<>"']*           -- not some separator, optional
   *  [^.@#\s:,<>'"]*        -- not . or @ or # terminated -- ToDo: broken
   *
   *  ToDo: must not match jh.robert@
   *  but should match simpliwiki.com/jh.robert@
   */
  if( !is_code && !is_markdown ){
    text = text.replace( surl, function( m, p, u ){
      // u = u.replace( /&amp;/g, "&")
      // exclude some bad matches
      if( /[#.]$/.test( u) )return m
      if( u.indexOf( "..") >= 0 )return m
      return p 
      + '<a href="' + Wiki.htmlizeAttr( "http://" + u) + '">'
      + u
      + '</a>'
    })
  }

  // url are htmlized into links
  // The pattern is tricky, change with great care only
  var url = /([^>"\w]|^)([a-ik-z]\w{2,}:[^\s'",!<>)]{2,}[^.\s"',<>)]*)/g 
  // Very tolerant but no javascript, unless... restrictive in source code
  if( is_code ){
    url = /([^>"\w]|^)(http:[^\s'",!<>)]{2,}[^.\s"',<>)]*)/g
  }
  if( !is_markdown ){
    text = text
    .replace( url, function( m, p, u ){
      // exclude some matches
      //if( /[.]$/.test( u) )return m
      // Fix issue with terminating dot
      var dot = ""
      if( ".".ends( u) ){
        u = u.substr( 0, u.length - 1)
        dot = "."
      }
      u = u.replace( /&amp;/g, "&")
      return p + '<a href="' +  Wiki.htmlizeAttr( u) + '">' + u  + '</a>' + dot
    })
  }

  // xxxx@ become links to @xxxx
  //text = text.replace( /([^:\w])(\w{3,}?)\@/g,
  //  '$1<a ma href="' + href + '@$2">$2@</a>'
  //)
  
  // Some RFC specific rules
  if( is_rfc ){
    // ToDo: Handle , separated list
    text = text.replace(
      /Obsoletes:(\s*)(\d+)    /,
      "Obsoletes:$1RFC $2"
    )
    text = text.replace(
      /Updates:(\s*)(\d+)    /,
      "Updates:$1RFC $2"
    )
  }

  // IETF RFCs become links
  if( is_code || is_rfc ){
    text = text.replace( /(\W)(RFC)([ #]*)(\d+)/gm,
      '$1<a href="' + href + 'on_rfc$4">$2$3$4</a>'
    )
  }

  // Wiki words becomes links (and references to closures later, read on)
  if( !is_markdown ){
    text = text
    .replace( wiki_names, '$1<a class="wiki" href="' + href + '$2">$2</a>')
  }

  // Fix some rare issue with nested links, remove them
  text = text.replace( /(<a [^>\n]+?)<a [^\n]+?>([^<\n]+?)<\/a>/g, '$1$2')
  
  // <a href="http://jean.vincent@">jean.vincent@</a>

  // y becomes i, unless premium or "Read" page
  if( !this.wiki.isRoot()
  &&  !this.wiki.config.premium
  &&  (!page || !page.isRead())
  &&  !(is_rfc || is_code || is_markdown)
  ){
    // text = text.replace( /(\b[^"y]*)y /gm,     '$1<em title="y">i</em> ')
    text    = text.replace(  /^([^"y]*)y (.*)$/m, '$1<em title="y">i</em> $2')
  }

  // Date, iso format typically, are emphasized and later complemented
  if( !is_markdown ){
    text = text.replace( date, '<time>$1</time>')
  }
  
  // Some simple markup
  if( format
  || !that.canScript
  // that.canScript === "maybe", optimistic
  ){
    // Wikify, but not source code
    if( !page || !page.isSourceCode ){
      text = Session.wikifyText( text, is_rfc)
    }
  }else{
    // wikifyText() is done client side
  }

  if( format ){
    if( format == "permalinks" ){
      text = text.replace( "/@", "/at").replace( "/#", "/on")
      text = "<pre><tt>" + text + "</tt></pre>"
    }
    return text
  }
  
  // Toc pages transclude their content
  var dotoc
  if( page && page.isToc() ){
    dotoc = true
    ;(visited || (visited = {}))[page] = true
  }
  var toc = []
  
  // Now I inject closures instead of "normal" links
  // Also process "Your" & "This" pages
  var text2 = ""
  var ii
  var jj
  var pagename
  var otherpage
  var label
  var closure
  var pat = '<a class="wiki" href=\"/'
  if( page ){ page.resetLinks() }
  while( (ii = text.indexOf( pat)) >= 0 ){
    text2 = text2 + text.substr( 0, ii)
    text = text.substr( ii + pat.length)
    jj = text.indexOf( "\"")
    pagename = text.substr( 0, jj)
    // ToDo: de htmlizeAttr
    pagename = Wiki.dehtmlizeAttr( pagename)
    otherpage = this.lookup( pagename)
    text  = text.substr( jj)
    jj    = text.indexOf( ">")
    text  = text.substr( jj + 1)
    jj    = text.indexOf( "</a>")
    label = text.substr( 0, jj)
    text  = text.substr( jj + 4)
    // Backlinks management, manages both directions actually
    if( page ){
      this.trackBacklink( otherpage, page)
    }
    // Handle local, my and this pages
    if( page && otherpage.isLocal() ){
      pagename = this.localName + pagename.substr( "Local".length)
    }
    if( page && (otherpage.isYour()  || pagename == "YourPage") ){
      if( pagename == "YourPage" ){
        pagename = this.usernamize( this.userName())
      }else{
        var is_own = "YourOwn".starts( pagename)
        var property = pagename.substr( "Your".length)
        if( is_own ){
          property = property.substr( "Own".lenght)
       }
        if( this.loginPage.get( property) ){
          pagename = this.loginPage.get( property)
          // ToDo: should sanitize
        }else{
          pagename = this.userName() + pagename.substr( "Your".length)
          if( is_own ){
            pagename = this.usernamize( pagename)
          }
        }
      }
    }
    if( page && otherpage.isThis() ){
      if( "Wiki".starts( otherpage.name.substr( "This".length)) ){
        pagename = this.wiki.name + pagename.substr( "ThisWiki")
      }else if( "Parent".starts( otherpage.name.substr( "This".length)) ){
        pagename = "Parent" + page
      }else{
        pagename = page + pagename.substr( "This".length)
      }
    }
    if( page && otherpage.isDo() ){
      if( otherpage.name == "DoIt" ){
        pagename = page.getToDo()
        this.doOnPage = page
      }
    }
    this.de&&mand( pagename )
    // Update otherpage accordingly
    if( otherpage.name != pagename ){
      otherpage = this.lookup( pagename)
      this.trackBacklink( otherpage, page)
    }
    // Show link only for pages that are maybe readable
    if( this.mayRead( otherpage) ){
      // CodeSecret => dynamic secret
      if( otherpage.isCode() && otherpage.name == "CodeSecret" ){
        text2 += HtmlA(
          "CodeSecret",
          this.hrefPathname( "CodeF" + this.wiki.random3Code( ""))
        )
      // SecretSecret => dynamic secret
      }else if( otherpage.isSecret()
      && otherpage.name == "SecretSecret"
      ){
        text2 += HtmlA(
          "SecretSecret",
          this.hrefPathname( "SecretF" + this.wiki.random3Code( ""))
        )
      }else if( pagename == "WikifyIt" ){
        var wikify_page  = page.getBody().frontLine()
        var wikify_label = "" 
        if( this.wikinamize( wikify_page) == wikify_page ){
          if( wikify_page == "WikifyIt" ){
            wikify_label = page.isHome() ? this.wiki.getLabel() : page.name
            wikify_page  = page
          }else{
            wikify_label = wikify_page
            wikify_page = this.lookup( wikify_page)
          }
        }else{
          wikify_label = this.wiki.getLabel()
          wikify_page  = this.loginPage
        }
        text2 += '\n\\<a href="javascript:('
        + Wiki.htmlizeAttr(
          this.wikifyItScript.toString()
          .replace(
             SW.domain,
             SW.domain + this.hrefPath( wikify_page)
          )
          .replace( / +/g, " ")
          .replace( /\n/g, ""))
        + ')() || void( 0)" title="' + this.i18n( "drag this") + '">'
        + this.i18n( "Wikify " + wikify_label)
        + "</a>\n"
      }else{
        text2 += this.linkPage( pagename, label)
        // Remember pages to transclude, but don't transclude RFCs
        if( dotoc
        && !"#rfc".starts( pagename)
        ){
          toc.push( pagename)
        }
      }
    }else{
      // Hide secrets a little, still visible in edit mode
      if( otherpage.isSecret() ){
        // SecretSecret => dynamic secret
        if( otherpage.name == "SecretSecret" ){
          text2 += HtmlA(
            "SecretSecret",
            this.hrefPathname( "SecretF" + this.wiki.random3Code( ""))
          )
        }else{
          text2 += (new Array( pagename.length)).join( "X")
        }
      }else{
        text2 += pagename
      }
    }
  }
  if( text ) text2 += text;

  
  // ToDo: if paired, cobrowsing on http links
  
  var text3 = text2 // ToDo: get rid of those

  // Include images
  // querystring: (?:\\?[^#<>\\s]*)?(?:#[^<>\\s]*)?
  if( !is_code && !is_markdown ){
    var text4 = text3.replace(
    /(<a href=")([^"]*?)(\.gif|\.png|\.jpg|\.jpeg|\.svg)((?:\?[^"]*)?">)(.*?)(<\/a>)/gi,
      // ToDo: get rid of <a>..</a>
      function( _, a1, u, e, a2, a3, a4 ){
        return a1 + u + e + a2
        + '<img src="' + u + e + a2
        + '<var>' + a3 + '</var>'
        + a4
      }
    )
  }else{
   text4 = text3
  }

  // Adjust timezone of dates, well, actually tells time since date
  // ToDo: client side when possible
  var text5
  if( is_markdown ){
    text5 = text4
  }else{
    text5 = text4.replace(
      /<time>(.*?)<\/time>/g,
      function( e, time ){
        return '<time title="' + that.dateTooltip( time) + '">'
        + (time
          // "hide" noise but keep it to make copy/paste work as expected
          .replace( "T", '<i>T</i>')
          .replace( ".", '<i>.')
          .replace( "Z", 'Z</i>')
        )
        + '</time>'
      }
    )
  }
  
  // Done, unless Toc page
  // ToDo: It would be nice to be able to transclude in anypage, syntax?
  if( !dotoc ){
    return !cb ? text5 : cb( text5)
  }
  
  // Inject content of toc
  var subpage
  var subpagecontent
  var dofound = false
  var subcontent = []
  this.doOnPage = page
  if( !cb ){
    while( subpage = toc.shift() ){
      subpage = this.lookup( subpage)
      if( !dofound ){ dofound = subpage.isDo() }
      if( !visited[subpage.name] && !subpage.isSensitive() ){
        // ToDo: asynchrous
        subpagecontent = subpage.getBody()
        if( false && !subpagecontent && !subpage.isDo() && !dofound ){
          subpagecontent = subpage.name
        }
        if( subpagecontent ){
          // ToDo: look for some code that would break the page in two parts,
          // with only the first part displayed and a "read more" link added
          if( !dofound ){
            subcontent.push( "\n--------------------")
            subcontent.push( "Page " + this.link( subpage))
            subcontent.push( "")
          }
          subcontent.push( this.wikify(
            subpagecontent,
            subpage,
            null,
            visited
          ))
        }
      }
      visited[subpage.name] = true
    }
    text5 += subcontent.join( "\n")
    return text5
  }
  // Idem but asychronous
  var that = this
  this.de&&bug( "Toc: ", toc.join( " "))
  var loop = function( list, fn ){
    var item = list.shift()
    fn( item, function(){
      if( item ){ loop( list, fn) }
    })
  }
  loop( toc, function( subpage, next ){
    if( !subpage){ return cb( text5 + subcontent.join( "\n")) }
    subpage = that.lookup( subpage)
    dofound || (dofound = subpage.isDo())
    if( !visited[subpage.name] && !subpage.isSensitive() ){
      visited[subpage.name] = true
      return that.getPage( subpage, function( err, subpage ){
        subpagecontent = subpage.getBody()
        if( !subpagecontent && !subpage.isDo() ){
          subpagecontent = subpage.name
        }
        if( !subpagecontent ){ return next() }
        if( !dofound ){
          subcontent.push( "\n--------------------")
          subcontent.push( "Page " + that.link( subpage))
          subcontent.push( "")
        }
        return that.wikify(
          subpagecontent,
          subpage,
          null, // format
          visited,
          function ( wikitext ){
            subcontent.push( wikitext)
            return next()
          }
        )
      })
    }
    visited[subpage.name] = true
    return next()
  })
  return this
}

// section: end wikify.js

// section: date.js

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
  with_gmt || (with_gmt = this.isMentor)
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
// Assuming page is the "name" of a user, a @twitter, facebook@ or linkednn
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
    if( this.wiki.name == this.facebookName + "@" ){
      title.push( this.i18n( "your personal Facebook wiki"))
    }else
    if( this.wiki.name == "@" + this.twitterName ){
      title.push( this.i18n( "your personal Twitter wiki"))
    }else
    if( this.wiki.name == this.linkedinName + "In" ){
      title.push( this.i18n( "your personal LinkedIn wiki"))
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
        if( this.wiki.name == this.facebookName + "@" ){
  	  title.push( this.i18n( "in your personal Facebook wiki"))
        }else if( this.wiki.name == this.linkedinName + "In" ){
  	  title.push( this.i18n( "in your personal LinkedIn wiki"))
        }else if( this.wiki.name == "@" + this.twitterName ){
	  title.push( this.i18n( "in your personal Twitter wiki"))
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
    user = user.replace( "Mentor", "")
    title.push( this.i18n( "'invitation code' for ") + user)
  }

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
    if( session == this && !this.isMentor ){
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


// ----------------
// section: html.js

Session.linkPage = function( name, label, title ){
// Like link() but with a page name instead of a Page object
  return this.link( this.lookup( name), label, title)
}


Session.hrefPathname = function( name ){
// Returns the pathname to a page. ie /somewiki/HomePage if no subdomain
  // ToDo: I should allow / in page's name, ie in free links
  var path = "/" + this.wiki.fullname()
  if( this.subdomain ){
    path = path.substr( this.subdomain.length)
  }
  return path + Wiki.encode( name)
}

Session.hrefPath = function( page ){
// Returns the pathname to a page. ie /somewiki/HomePage if no subdomain
  return this.hrefPathname( page.name)
}

Session.href = function( page ){
// Return the pathname to a page together with a query parameter to the
// closure that display that page
  return this.hrefPath( page)
  + "?cid=" + this.getViewClosure( page)
  + "&time=" + Sw.timeNow // ToDo: better "no cache" handling
}

Session.link = function( page, label, title ){
// Returns <a xxx></a> code that link to a page using it's view closure
// neither page nor title need to be encoded.
  label = label || page.name
  label = this.i18n( label)

  if( !title || title == "" ){
    title = this.tooltip( page)
  }
  // User friendly xxxx(guest) instead of ugly xxxxGuest
  // Or just "a guest" maybe?
  if( "Guest".ends( label) ){
    label 
    //= label.substr( 0, label.length - "Guest".length) + this.i18n( "(guest)")
    = "a guest"
  }
  return HtmlA(
    this.i18n( label),
    Wiki.htmlizeAttr( this.href( page))
    + (page.isDraft()
      ? '" class="wiki hothot'
      : (page.isHot() ? '" class="wiki hot' : '" class="wiki')
    ),
    Wiki.htmlizeAttr( this.i18n( title)),
    true // => dont_htmlize, because I did it here
  )
}

Session.button = function( label, closure_id, title ){
  return HtmlA( 
    this.i18n( label),
    this.hrefPath( this.getCurrentPage())
    + "?cid=" + closure_id
    + "&time=" + Sw.timeNow, // ToDo: better "no cache" handling,
    this.i18n( title)
  )
}

// -----------
function HtmlA( label, href, title, dont_htmlize ){
// Makes a A element
// ToDo: make into SW.htmlA()
  href = href || label
  // ToDo: if type of ref is closure...
  return '<a href="'
  +  (dont_htmlize ? href : Wiki.htmlizeAttr( href))
  + (title
    ? '" title="' + (dont_htmlize ? title : Wiki.htmlizeAttr( title))
    : '')
  + '">'
  + label
  + '</a>'
}

// section: end html.js

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
  var cookie = cookie || document.cookie
  var ii = cookie.indexOf( name += "=") // ToDo: delimeter issue?
  if( ii < 0 ) return null
  cookie = cookie.substr( ii + name.length)
  ii = cookie.indexOf( ";")
  if( ii >= 0 ){ cookie = cookie.substr( 0, ii) }
  return cookie
}

Session.configScript = function( page, other, editclosure ){
// Client side setup, dynamic, different for each page
  if( !this.canScript ) return ""
  other = !!other
  // Adjust number of cols on page actual size if possible
  NDe&&bug( "config script for ", page, " ", page.maxCols)
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
  var needs_onetruefan = this.needsOneTrueFan
  this.needsOneTrueFan = false
  var config      = Sw.copyHash( this.config)
  var wiki_config = Sw.copyHash( this.wiki.config)
  // Remove "sensitive" stuff from config
  var blacklist = "mentorCode adminIps debugCode".split( " ")
  for( var ii in blacklist ){
    delete config[blacklist[ii]]
    delete wiki_config[blacklist[ii]]
  }
  // Remove empty/false entries
  for( ii in wiki_config ){ if( !wiki_config[ii] ){ delete wiki_config[ii] } }
  for( ii in      config ){ if( !     config[ii] ){ delete      config[ii] } }
  return [
    //this.htmlScript( this.getCookieScript, true), // true => sync
    '\n<script type="text/javascript">',
    this.getCookieScript,
    '/* <![CDATA[ */',
    // ToDo: I should put all of these into a big sw_session object I guess
    'var sw_domain = "'      + SW.domain + '"',
    'var sw_fbid = "'        + SW.fbid + '"',
    'var sw_twid = "'        + SW.twid + '"',
    'var sw_likey = "'       + SW.likey + '"',
    (needs_onetruefan ? "var sw_onetruefan = true" : ""), // (this.config.oneTrueFan ? "true" : "false")
    'var sw_login = "'       + this.loginName + '"',
    'var sw_is_source = '    + (page.isSourceCode ? "true" : "false"),
    'var sw_wiki_config = '  + JSON.stringify( wiki_config),
    'var sw_config = '       + JSON.stringify( config),
    'var sw_user = '         + JSON.stringify( this.user && this.user.saveContext()),
    'var sw_user_data = '    + JSON.stringify( this.user && this.user.dataByPage),
    'var sw_session_data = ' + JSON.stringify( this.dataByPage),
    'var sw_page = "'        + page.name + '"',
    'var sw_page_data = '    + JSON.stringify( page.data),
    'var sw_page_ctx = '     + JSON.stringify( page.saveContext()),
    'var sw_traces = "'      + traces + '"',
    'var sw_can_cache = '    + page.isDo(),
    'var sw_config_cols = '  + this.config.cols,
    'var sw_cols = '         + maxcols,
    'var sw_rows = '         + this.config.rows,
    'var sw_scroll_to = '
    + (page.isDo() ? 0 : this.getCookie( "sw_scroll_to") || 0),
    'var sw_can_script = "'  + this.canScript + '"',
    'var sw_rest_cid = "'    + this.restClosure + '"',
    'var sw_is_anonymous = ' + (this.isAnonymous() ? "true" : "false"),
    'var sw_visitors = '     + this.wiki.recentSessionsCount(),
    'var sw_lang = '         + this.lang,
    'var sw_oembed = '       + !!this.isOembed,
    'var sw_iframe = '       + !!this.isIframe,
    'var sw_previous_content = ' + other,
    'var sw_previous_content_displayed = false',
    // Helper to detect "back" button, don't apply to Do pages
    'var sw_time_built = '   + (new Date()).getTime(),
    'var sw_time_offset = 0',
    // Browser local time is unreliable, need to evaluate offset
    'var sw_edit_closure = ' + (editclosure || "null"),
    'var sw_editing = false',
    'var sw_edit_had_focus = false',
    'var sw_touch_device = "createTouch" in document;', // IE needs ;
    'var sw_meebo_bar = "'   + this.wiki.config.meeboBar + '"', 
    'var sw_address = '
    + 'decodeURIComponent( "' + encodeURIComponent( path) + '")',
    'var De  = ' + !!De,
    'var NDe = false',
    'var de  = ' + !!De,
    'var bugC = (window.console && console.log '
    + '&& function bug( m ){ console.log( "' + SW.name + ': " + m)})'
    + ' || (de = false)',
    'de&&bugC( "loading " + sw_domain + "/" + sw_page)',
    'var sw_ready = true',
    // I can as well hide the body to avoid some flicker until .ready()
    'document.getElementsByTagName( "body")[0].style.display = "none"',
    '/* ]]> */',
    '</' + 'script>\n',
    !this.wiki.config.meeboBar ? "" : this.script( this.meeboScript),
    !needs_onetruefan ? "" : '<script src="http://e.onetruefan.com/js/widget.js"></script>'
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
  if( !this.canScript ) return ""
  var args = Array.prototype.slice.call( arguments)
  return Session.htmlScript( [
    '(',
    args[0].toString(),
    ').apply( window,', JSON.stringify( args.slice( 1)), ')'
  ].join( "\n"))
}

Session.scriptlet = function( name, fn ){
 if( !this.canScript ) return ""
// ToDo: submit to remote COMET if not building a page
  return this.htmlScript( "var " + name + " = " + fn)
}


// --------------------
// section: loadfire.js

// loadfire.js
//   Dynamic loading of javascript resources with progress and dependencies
//   management (and parallel execution on modern browsers, and nodejs too).
//
//   6 feb 2011 by @jhr, v 0.1, in simplijs.com
//
//   License: VanityLicense, see http://virteal.com/VanityLicense
//   Credits: got some nice inspiration from getify & headjs, same need,
//   different solutions, there is more than one way to do it.
//   See http://blog.getify.com/2010/12/on-script-loaders/
//   See also: http://www.c2.com/cgi/wiki?LazinessImpatienceHubris
//
// API: All verbs are methods of the global "loadfire" singleton. Most
// verbs return it (for easy chaining) ; boolean checkers returns it if
// true and "undefined" if false.
//
// .load( script(s) )
//   Registers scripts to load, each script is a "goal", described using an
//   url (or a path name, when running server side).
//
// .signal( goal(s) )
//   Registers goals, each goal is an arbitrary string.
//
// .ready( fn )
//   Registers a callback called when all goals are ready, all scripts loaded.
//
// .event( fn )
//   Registers an event listener called whenever something happens regarding
//   goals, including the passing of time (to handle timeouts).
//
// .waits( goal(s) )
//   Checks if goals were registered (non blocking).
//
// .does( goal(s) )
//   Alias for .waits()
//
// .did( goal(s) )
//   Checks if goals were reached. If goals are scripts, checks if scripts
//   were loaded.
//
// .any()
//   Changes checking logic from "all" to "any".
//
// .all()
//   Restores default checking logic.
//
// .test()
//   Runs the test suite.
//
// Note:
//   "script(s)" means either "ascript" or ["script1","script2",...]
//   Idem for goals.
//   Checking is done using .indexOf(), it is not necessary to repeat the full
//   url/path of a script to check if it got loaded.
//   Idem for goals.
//
// Usage:
//
//   // Load a script, asynchronous when possible
//   loadfire( "myscript")
//
//   // Load a script, do stuff when it's loaded (the hacky way)
//   loadfire( "myscript; myinit()")
//
//   // Load scripts in parallel, do stuff when they are all loaded
//   // Note: scripts are executed in sequential order in older browsers
//   // and required in sequential order too when running in nodejs.
//   loadfire( "myscript")
//   .load( "myotherscript")
//   .ready( function(){ de&&bug( "All ready!" })
//
//   // Load scripts, execute in sequential order
//   loadfire()
//   .load( "myfirst", true)	// true => not asynchronous
//   .load( "sync mysecond")	// "sync" shortcut syntax
//
//   // jQuery friendly
//   loadfire
//   .load( "myscript")
//   .load( "http://mysite.com/myjquery.js")
//   .load( "jquery")
//   $(document).ready( function(){ de&&bug( "$ & all ready!" })
//
//   // jQuery + Google friendly (gets latest stable jQuery, 1.5)
//   loadfire( "jquery", "google")
//   $().ready( function(){ de&&bug( "Got $ from Google" })
//
//   // Microsoft too
//   loadfire( "jquery", "microsoft")
//   $( function(){ de&&bug( "Got $ from Microsoft" })
//
//   // Postpone jQuery
//   loadfire( "jquery")
//   $().ready( function(){ de&&bug( "jQuery loaded") })
//   ... later, if ever ...
//   loadfire( "http://mysite.com/myjquery.js")
//
//   // Gentle parallel loading & progress management
//   loadfire( "myscript")
//   .load( "myotherscript")
//   .event( function( fire ){
//     if( fire.did( ["myscript", "myotherscript"] ){
//       myinit()
//       return true // deregister
//     }
//     if( fire.did( "5 seconds") && !load.did( "patient") ){
//       de&&bug( "Let's be patient...")
//       fire.fire( "patient")
//     }
//     if( fire.did( "patient") ){
//       var very_patient = "it's been " + Math.floor( done.age / 1000) + "seconds"
//       if( !fire.did( very_patient) ){
//         de&&bug( very_patient)
//         fire.fire( very_patient)
//       }
//     }
//     if( fire.age > 10000 ){
//       de&&bug( "Can't wait any longer.")
//       return true	// deregister
//     }
//   })
//
//   // When mixing yours, theirs and other arbitrary achievements
//   loadfire.event( function( fire ){
//     // fires every 500ms, when something got loaded & on major events
//     if( fire.any( ["myscript","theirscript"])
//     && !fire.waits( "show progress")
//     ){
//       fire.signal( "show progress")
//     }
//     if( !fire( "show progress") && fire.waits( "show progress") ){
//       de&&bug( "Some progress")
//       fire.fire( "show progress")
//     }
//     if( fire.did( "myscript") && !fire.did( "theirscript" ){
//       de&&bug( "they slow me down! " + fire.age + " ms...")
//     }
//     if( fire.all( ["myscript", "theirscript"] ){
//       de&&bug( "they did it, let's proceed")
//       fire.load( "myotherscript")
//     }
//     if( fire.did( "myotherscript") ){
//       de&&bug( "Ready, all done, it took " + done.age + " ms")
//       return true // deregister
//     }
//     if( !fire.did( "been there") ){
//       de&&bug( "First & last time I get here")
//       fire.fire( "been there")
//     }
//   }
//
//   Undocumented:
//     "async", "sync", "__raw__",
//     .timeStarted, .scriptQueue, .scripts, .callbacks, .readyCallbacks
//
//   Bonus: de&&bug( "fast")
//
//   Note: using .waits() one can check if loadfire was asked to deal with a
//   script. As a result scripts have the ability not only to check if
//   other scripts were loaded but also the ability to check if other
//   scripts were or were not required yet. They can then decide to load these
//   script (or adjust their behaviour). This is supposedly enought to
//   implement a decent dependencies manager. See also require() in CommonJS
//
//   Note: using .signal() one can define any goal, not just loading a script.
//   State machine for a goal: void -> signaled -> fired. A goal is either
//   a script to load or an arbitrary string (that sets the name of the goal)

function loadfire( src, not_async ){
// src is url to script.
// When true, not_async means I use ".async = false" on my <script> elements.
// "src" can override default "not_async" if it includes "async" or "sync"
// ... unless it includes "__raw__"
// Anything after ; is "eval()" evaled when script gets loaded.

  // What is interesting
  var me = loadfire

  var client_side = (typeof window !== "undefined")
  var scope = client_side ? window : global

  // First time called? init some stuff
  if( !me.initialized ){

    // I won't init twice
    me.initialized = true

    // Versionning
    me.version = "0.1"

    // Array of pending scripts to load
    me.scriptQueue = []

    // Track when loading started
    me.timeStarted = (new Date()).getTime()

    // Will track "age"
    me.age = 0

    // Track all callbacks, fired whenever something happens
    me.callbacks = []

    // Track all "ready" callbacks, fired when all queued scripts got loaded
    me.readyCallbacks = []

    // Track all scripts, entry is false at first, turns to age when loaded
    me.scripts = {}

    // Track failure... the day browsers permit
    me.scriptFailures = {}

    // And or Or logic for constraints, .ie .all() & .any()
    me.oring = false

    // "did" or "does" logic for constraints
    me.doesing = false

    // CDN sources
    me.jQueryGoogle    = "http://ajax.googleapis.com/ajax/libs/jquery/1.5.0/jquery.min.js"
    me.jQueryMicrosoft = "http://ajax.aspnetcdn.com/ajax/jQuery/jquery-1.5.min.js"

    // Bonus, my de&&bug darling, see http://virteal.com/DebugDarling
    var de_def = false
    if( !scope.de ){
      de     = true
      de_def = true
    }
    bugC = (scope.console && console.log
      && function bug( m ){ console.log( "de&&bug: " + m)})
    || (de = false)
    if( !client_side ){
      bugC = require( "sys").puts
    }
    if( de && !scope.bug ){
      bug = bugC
    }else if( de_def ){
      de = false
    }

    // de&&scribe() local traces
    function scribe( msg ){
      bugC( "loadfire: " + msg + " @" + me.age)
    }

    // I will fire every 500ms, so that timeouts can be handled by callbacks
    // Note: callbacks may also display some progress bar
    function start_timeout(){
      if( me.interval )return
      me.interval = setInterval( function(){
        // Update age
        me.age = (new Date()).getTime() - me.timeStarted
        var signal = "fire " + Math.floor( me.age / 1000) + " seconds"
        if( false && de && me.did( signal) ){
          de&&scribe( "Done " + signal)
          return
        }
        me.fire( signal)
      }, 500)
    }
    function stop_timeout(){
      if( !me.interval )return
      clearInterval( me.interval)
      me.interval = null
    }

    // Define loadfire.event(), the function to register callbacks
    me.event = function loadfire_event( cb ){
    // Register a callback called when a script gets loaded.
    // The callback shall return true to deregister itself.
    // It is called once immediately and then on multiple occasions.
      me.callbacks.push( cb)
      return me.fire()
    }

    // Def loadfire.ready() that registers callbacks called when all is loaded
    me.ready = function loadfire_ready( fn ){
      me.readyCallbacks.push( fn)
    }

    // Define loadfire.fire(), that calls all registered callbacks
    me.fire = function loadfire_fire( script, does ){
      // If a script name was provided, it means that the script got loaded
      // Note: I abuse this to track any achievements / reached states / goals
      if( script ){
        if( typeof script == 'object' ){
          for( var ii in script ){
            de&&scribe( '"' + script[ii] + '"' + (does ? " starting" : " firing"))
            me.scripts[script[ii]] = !does ? (me.age || 1) : false
          }
        }else{
          if( de && script.indexOf( " seconds") < 0 ){
            de&&scribe( '"' + script + '"' + (does ? " starting" : " firing"))
          }
          me.scripts[script] = !does ? (me.age || 1) : false
          if( window.jQuery && !me.did( "jQuery") ){
            me.fire( "jQuery")
          }
        }
      }
      // Invoke all callbacks, deregister when they ask or bug
      var some_callback = false
      for( var ii in me.callbacks ){
        var callback = me.callbacks[ii]
        if( !callback )continue
        some_callback = true
        // Update age
        me.age = (new Date()).getTime() - me.timeStarted
        // Don't risk reentering callback, will register it again if needed
        me.callbacks[ii] = null
        var deregister = false
        try{
          // Callback will return true to get deregistered
          deregister = callback( me, script)
        }catch( err ){
          de&&bugC( "error in loadfire callback")
          de&&bugC(  err)
          deregister = true
        }
        if( !deregister ){
          me.callbacks[ii] = callback
        }
      }
      // If all scripts were loaded, invoke the "ready" callbacks
      var all_loaded = true
      for( key in me.scripts ){
        if( !me.scripts[key] ){
          all_loaded = false
          break
        }
      }
      // I run periodic checks as long as some callback remain
      if( some_callback ){
        start_timeout()
        // Issue warning if it's been more than 30 seconds
        // Please use .rejuvenate() to avoid it
        if( !me.did( "loadfire_warning") ){
          if( me.age > 30000 ){
            de&&bugC( "loadfire, 30 secs, rejuvenate?")
            me.dump()
            me.fire( "loadfire_warning")
          }
        }
      }else if( all_loaded ){
        de&&scribe( "ready!")
        stop_timeout()
      }
      // If ready, invoke all "ready" callbacks, each one once only
      if( !all_loaded )return me
      for( ii in me.readyCallbacks ){
        var callback = me.readyCallbacks[ii]
        if( !callback )continue
        // "Ready" callbacks are invoked once only
        me.readyCallbacks[ii] = null
        // Update age
        me.age = (new Date()).getTime() - me.timeStarted
        try{
          callback( me, script)
        }catch( err ){
          de&&bugC( "error in loadfire ready callback")
          de&&bugC(  err)
        }
      }
      // Auto rejuvenate, if no callback remain
      if( !some_callback ){
        de&&scribe( "born again")
        me.rejuvenate()
      }
      return me
    }

    // Define loadfire.signal() that declares pending achievements / goals
    me.signal = function loadfire_signal( script ){
      return me.fire( script, true)
    }

    function check_done( script ){
    // Returns true if script (or [scripts]) was (were) loaded
    // Note: you don't need to provide the full script "src", I use indexOf()
      // Assume it's an array if it's not a string
      // ToDo: handle Regexp
      if( !script )return me
      var doesing = me.doesing
      var oring   = me.oring
      if( typeof script == 'object' ){
        var found = true
        for( var ii in script ){
          var ok = check_done( script[ii])
          if( !ok ){
            if( !oring )return
            found = false
          }else{
            if( oring )return me
            found = true
          }
        }
        // All scripts are ok, return something true
        return found ? me : undefined
      }
      // Look for scripts, if found check state
      var any = false
      for( var key in me.scripts ){
        if( key.indexOf( script) != -1 ){
          any = true
          var ok = (me.scripts[key] || doesing)
          if( ok ){
            // Any ok will do if "any"
            if( oring )return me
          }else{
            // Any !ok will do if "all"
            if( !oring )return
          }
        }
      }
      // It's a match if all checks were ok, if at least one check occured
      return any ? me : undefined
    }

    // Define loadfire.did(), the easy way to check what scripts got loaded
    me.did = function loadfire_did( script ){
      me.oring   = false
      me.doesing = false
      return check_done( script)
    }

    // Define loadfire.does(), the easy way to check what scripts are handled
    me.does = function loadfire_does( script ){
      me.oring   = false
      me.doesing = true
      return check_done( script)
    }

    // Define loadfire.all(), to chain constraints
    me.all = function loadfire_all( script ){
      me.oring = false
      return check_done( script)
    }

    // Define loadfire.any(), to chain constraints
    me.any = function loadfire_any( script ){
      me.oring = true
      return check_done( script)
    }

    // Define loadfire.failed(), checks if one script failed to load
    // ToDo: works server side only so far, client side must use timeouts
    me.failed = function( script ){
      return me.scriptFailures[script] ? me : undefined
    }

    // Define loadfire.fail(), asserts that a goal failed
    me.fail = function( goal ){
      me.scriptFailures[goal] = true
      return me.fire()
    }

    // Define loadfire.rejuvenate() that reset the age
    me.rejuvenate = function(){
      me.timeStarted = (new Date()).getTime()
      return me
    }

    // Define load.dump() that list goals on the console in debug mode
    me.dump = function(){
      de&&bugC( "loadfire, dump all scripts & states")
      for( var key in me.scripts ){
        de&&bugC( "loadfire " + key + " " + me.scripts[key])
      }
      // Returns undefined on purpose, as this is used in the console
    }

    // Let's be professional, have some tests
    me.test = function loadfire_test(){
      function assert( ok, msg ){
        if( ok )return
        de&&bugC( "Assert failure, " + msg)
        throw "loadfire assert failure " + msg
      }
      assert( me.did(),             "did()")
      assert( me.does(),            "does()")
      assert( !me.did( "t"),        "did t")
      assert( !me.does( "t"),       "does t")
      assert( !me.any( "t"),        "any t")
      me.signal( "--t1--")
      assert( me.does( "t1"),       "does t1")
      assert( me.any().does( "t1"), "any does t1")
      assert( !me.did( "t1"),       "!did t1")
      me.fire( "--t1--")
      assert( me.does( "t1"),       "now does t1")
      assert( me.did( "t1"),        "did t1")
      me.signal( "--t2--")
      assert( !me.did( "t"),        "!did test")
      assert( me.any( "t"),         "any test")
      me.fire( "--t2--")
      assert( me.did( ["t1","t2"]), "did t1, t2")
      assert( me.did( "t"),         "did t")
      var fired = false
      me.event( function(){ return fired = true })
      assert( fired,                "fired")
      fired = false
      var ready = false
      me.signal( "--t3--")
      assert( !fired,               "!fired")
      me.ready( function(){ ready = true })
      assert( !ready,               "!ready")
      me.fire( "--t3--")
      assert( ready,                "ready")
    }

    // Credit: as per @getify
    // required: shim for FF <= 3.5 not having document.readyState
    if( client_side && document.addEventListener ){
      if( document.readyState === null ){
        document.readyState = "loading"
      }
      document.addEventListener( "DOMContentLoaded", handler = function (){
        document.removeEventListener( "DOMContentLoaded", handler, false)
        if( document.readyState == null ){ 
          document.readyState = "complete";
        }
        me.fire()
      }, false);

    }

    // Ad nauseum easy chaining (it's trendy)
    me.load
    = me.did.load        = me.does.load
    = me.fire.load       = me.signal.load
    = me.event.load      = me.ready.load
    = me.any.load        = me.all.load
    = me.failed.load     = me.fail.load
    = me.rejuvenate.load = me.dump.load
    = me
    // To please Steve Jobs AND Bill Gates
    me.load.load = me.bing = me.me = me
    // To please Richard Stallman & Richard Hawking
    me.free = me.all.me = me.bing.bang = me
    // Enought, let's get back to some "real" work

    // Some aliases
    me.waits = me.does

    start_timeout()

  } // end of init stuff

  function doit( what, not_async ){
    var script = (client_side && document.createElement( 'script')) || {}
    var cb   = ""
    var body = ""
    var src  = what
    if( src.indexOf( "__raw__") < 0 ){
      src = src.replace( / *async +/, function(){
        not_async = false
        return ""
      })
      src = src.replace( / *sync +/, function(){
        not_async = true
        return ""
      })
      // > to specify a body for the script tag (weird, linkedin needs this)
      // Note: I use [\S\s]* because .* would not work with \n (sic)
      src = src.replace( / *\>[\S\s]*/, function( m ){
        body = m.substr( m.indexOf( ">") + 1)
        return ""
      })
      // ; to specify the name of a callback
      src = src.replace( / *;.*$/, function( m ){
        cb = m
        return ""
      })
    }
    // The order is important, body first, type last
    body && (script.text = body)
    script.async  = !not_async
    script.src    = src
    script.type   = 'text/javascript'
    var done = false
    script.onreadystatechange = script.onload = function(){
      var ready_state = script.readyState
      // de&&bugC( "loadfire did " + src + ", state:" + ready_state)
      if( done ){
        me.fire()
        return
      }
      if( !ready_state || /loaded|complete/.test( ready_state) ){
        done = true
        me.fire( what)
        // Evil eval, so cool
        if( cb ){
          // de&&bugC( src + ", eval " + cb)
          eval( cb)
        }
      }
    }
    me.fire( what, true) // true => starting
    if( !client_side ){
      try{
        // ToDo: the day an asynchronous require() appears...
        require( src)
        script.onload()
      }catch( err ){
        me.scriptFailures[src] = true
        de&&scribe( "can't require() " + src + ", err: " + err)
      }
      return
    }
    // I will add <script> element to the <head>
    var head = document.documentElement.getElementsByTagName( "head")
    if( head ){
      head = head[0]
    // Fallback to <body>. ToDo: Can this really happen?
    // ToDo: worse, I need to "wait" for <head> to be there...
    }else{
      head = document.documentElement.getElementsByTagName( "body")[0]
    }
    head.appendChild( script)
  }

  // jquery friendly, batteries included
  if( src == "jquery" ){
    src = ""
    // Define a fake $ if not already defined by jQuery
    if( !me.did( "friend-jquery") && !window.$ ){
      var my$ = function loadfire$( fn ){
        if( !fn || fn === document )return $
        $.ready( fn)
      }
      $ = my$
      $.ready = function( fn ){
        bugC( "my$.ready invoked")
        me.event( function(){
          // I wait until jQuery redefines $
          if( $ == my$ )return
          bugC( "jQuery $ defined")
          // ToDo: ? I wait until all scripts get loaded
          //me.ready( function(){
            // Then I register the callback with the "true" jQuery
            $().ready( fn)
          //})
          return true // deregister
        })
      }
      me.fire( "friend-jquery")
    }
    if( not_async == "google"    ){ me.load( me.jQueryGoogle)    }
    if( not_async == "microsoft" ){ me.load( me.jQueryMicrosoft) }
  }

  // Add script to queue (unless duplicate)
  if( src ){
    // ToDo: should track not_async I maybe?
    if( !(src in me.scripts) ){
      // de&&bugC( "loadfire does " + src)
      me.scripts[src] = false
      me.scriptQueue.push( src)
      // Cheap assert
      de && (me.does( src) || broken)
    }
  }

  // Better more fire than not enough
  me.fire()

  // Add <script> element (also deal with backlog)
  if( me.initialized ){
    while( src = me.scriptQueue.shift() ){
      // ToDo: not_async per script for queued scripts?
      doit( src, not_async)
    }
  }

  // Better more fire than not enough
  me.fire()

  // Chainable now, viral tomorrow
  return me
}

// section: end loadfire.js

// Let's do some tests of client side code... on the server side
window   = global
document = {}
loadfire().test()

Session.loadScript = loadfire

Session.htmlScript = function( javascript, not_async ){
// Called while building an HTML page.
// "javascript" is either a Function object or a string.
// Returns HTML text for javascript code, either inlined or src referenced.
// src is for static code only, not variable code.

  // I support client without any javascript, sounds crazy these days...
  if( this.canScript === false ) return ""

  // The name of the "static" file is based on the name of the function
  var filename = javascript.name

  // Convert Function object to string
  javascript = javascript.toString()

  // If code is a function, with a name, function gets called when file is
  // loaded. The function is called without any parameters, this may help
  // it figure out it is called for the first time.
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
      return '<script src="' + filename + '"></script>'
    }
    javascript = 'loadfire( "' + filename + '")'
    // return '<script src="' + filename + '"></script>'
  }

  // When not including a Function or in "inline" trace mode, embed the script
  return [
    '<script>',
    javascript,  // ToDo: some encoding here?
    '</' + 'script>'
  ].join( "")
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
    $.getScript( "/rest?cid=" + sw_rest_cid
      + "&do=debug&msg=" + encodeURIComponent( msg)
    )
  }

  // The "top menu" is hidden sometime, to remove "distraction"
  var shown          = true	// actual state
  var shown_desired  = false	// desired state
  var scheduled_show = 0	// a timeout registered function, or null

  window.sw_fade = function schedule_fade( desired, now ){
  // Like jQuery's fadeTo() somehow, but slightly defered maybe

    // Remove previous timeout function if any, I will install a new one maybe
    if( scheduled_show ){
      clearTimeout( scheduled_show)
    }

    // The goal is to have the state eventually reach the "desired" state
    shown_desired = desired

    // Hide within 3.5 sec, unless some change happens, unless "now" asked
    var delay = now ? 0 : (desired ? 0 : 3500)

    function do_it(){
    // Makes it so that actual state matches the desired state
      if( shown == shown_desired && shown )return
      if( shown_desired ){
        $(".fade").fadeTo( 0, 1)
        // Footer is also shown, this may trigger some stuff at first
        if( window.onFooterDisplay ){ window.onFooterDisplay( true) }
      }else{
        $(".fade").fadeTo( 0, 0)
      }
      shown = shown_desired     
    }
    
    // Change state, either now or maybe later
    if( delay ){
      scheduled_show = setTimeout( function(){
        scheduled_show = 0
        do_it()
      }, delay)
    }else{
      do_it()
    }
  }

  var redraw = function( item, rows, recur ){ try{
  // This function gets called when page loading is ready.
  // It is also called if the window's size changed.
  // It recomputes the size of the font when in monospace mode, so
  // that the width of the content is just enough to hold the desired number
  // of characters.
  // Note: I could make it work with proportional fonts, I would have to use
  // a better "sizer" trick to compute the "average" width of characters.

    // #content is the element that matters (#previous_content comes next)
    t0 = document.getElementById( "content")

    // I use an "hidden" div with the letter "M" in it, I measure its px size
    var sz = document.getElementById( "sizer")

    // Let's figure out what is the total height of the window, as we
    // will to make it so that cols x rows of characters fit in it
    var h =  window.innerHeight ? window.innerHeight : $(window).height()
    var w = $(window).width()

    // On iPhone I think that screen.width is more accurate
    if( sw_touch_device && screen && screen.width ){
      w = Math.min( screen.width, w)
    }

    // Remember that because I needed it somewhere else
    sw_width  = w
    sw_height = h

    // If "fluid" layout (or source code), don't change font, just make visible
    if( !sw_rows || sw_is_source ){
      t0.style.display = "inherit"
      document.body.style.visibility = "visible"
      document.body.style.display    = "inherit"
      // ToDo: issue with padding and margin I think
      sw_content_width = sw_width
      sw_hpx = sz.clientHeight
      sw_wpx = sz.clientWidth
      return
    }

    // In "two panes" mode, there is a #previous_content to ajust too.
    // It use a font that is 60% of the first pane, so as to look "far".
    // why: this convey some sense that the content is "older", because it is
    // "behind". It's like if the user was moving away from it whenever new
    // content is displayed one the left column. All of this is done to
    // improve navigation in the wiki, something notoriouly complex.
    t1 = document.getElementById( "previous_content")

    // Avoid flicker while I compute stuff
    document.body.style.visibility = "hidden"
    document.body.style.display    = "inherit"

    // The number of rows to display defaults to what user configured
    rows = rows || sw_rows

    // If number of columns is negative, it means we go proportional
    // ToDo: this is not fully implemented, far from it.
    var proportional = (sw_cols < 0)

    // Compute exact number of desired rows & columns
    // On small screens I relax the user expectation regarding rows
    var r = rows + (sw_touch_device ? -rows + 2 : 2)
    var c = proportional ? -sw_cols : sw_cols

    // Adjust that if I want margins
    // ToDo: margin is set to 1, this should be configurable somehow
    if( !sw_touch_device && !sw_oembed && !sw_iframe ){
      c += t1 ? 4 : 2 // twice for margins if two panes, two columns
    }

    // Make a guess about the font size
    var px = Math.floor( Math.min(
      w / (c * 0.6), // Apparently width is 60% of height for monospace fonts
      h / (r * (sw_touch_device ? 1 : 1.35)) // 1.35em in css
    )) + 1 // + 1 to increase "guess" to avoid beeing too small

    // Set some limit
    if( px < 1 ){ px = 1 }

    // Based on the guess, I look for the biggest font that fits, going downward
    while( px ){

      // Change the font size, either for whole page or just content (!header)
      ((sw_touch_device || px > 30 || px < 8 || recur )
      ? document.getElementById( "container")
      : document.body)
      .style.fontSize = px + "px"

      // If super big or super small font, set a limit for the header & footer
      if( !sw_touch_device && (px > 30 || px < 8) ){
        document.body.style.fontSize = (px > 30 ? "30px" : "7px")
      }

      // I changed the font's size, but what I ask for is not what happens exactly.
      // Force "recompute" of lineHeight
      // ToDo: I force 1.35em, this should be configurable
      // ToDo: I should reduce that when fontSize gets big, it matters less
      if( !sw_touch_device ){
        document.getElementById( "container").style.lineHeight = "1.35em"
      }else{
        // When the screen is small, I drastically reduce the line height
        // ToDo: is this a good idea?
        if( false && sw_height < 600 ){
          document.getElementById( "container").style.lineHeight = "1em"
        }else{
          document.getElementById( "container").style.lineHeight = "1.35em"
        }
      }

      // Now I can get the "actual" size of characters, thanks to the sizer
      // ToDo: should I use display instead of visibility?
      sz.style.lineHeight = "inherit" // force recompute
      sz.style.visibility = "visible"
      var ch = sz.clientHeight
      var cw = sz.clientWidth
      sz.style.visibility = "hidden"

      // Does enough character fits in each line?
      if( cw * c <= w ){
        NDe&&bug( "px ", px,
          " h ", h, " r ", r, " ch ", ch, " r*ch ", r * ch, 
          " w ", w, " c ", c, " cw ", cw, " c*cw ", c * cw
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
    t0.style.width = t0.style.minWidth = t0.style.maxWidth
    = "" + (sw_content_width = (sw_cols * cw)) + "px"
    t0.style.lineHeight = "inherit"

    // If there is a second pane, ajust its size too
    if( t1 ){

      // Make it 60% of the size of the "near" pane, it then look "distant"
      sz.style.fontSize   = "0.6em";
      sz.style.lineHeight = "inherit" // force recompute
      sz.style.visibility = "visible"
      var fch = sz.clientHeight
      var fcw = sz.clientWidth
      sz.style.visibility = "hidden"

      // I set the width to match "exactly" what is needed
      t1.style.width = t1.style.minWidth = t1.style.maxWidth
      = "" + (sw_cols * fcw) + "px"
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
      .removeClass( "fade")

      // Remember that some previous content is displayed in the second pane
      sw_previous_content_displayed = true

    // If there is just one pane
    }else{

      // I get rid of any padding if I want to maximize the size
      if( sw_touch_device || sw_oembed || sw_iframe ){
        t0.style.padding = "0px"
      }
      t0.style.display = "inherit"

      // Remember that there is content in one pane only
      sw_previous_content_displayed = false

      // Reduce number of rows if content does not fill available space
      // ToDo: Figure out a way to do this in a less disturbing way
      var doch = $("#container").height()
      var deltar = ((h * 0.8) - doch) / ch * 0.7
      deltar = Math.floor( deltar + 0.51)
      // console.log( "doch: ", doch, " deltar:", deltar)
      // ToDo: improve this
      if( rows > 5 && deltar >= 1 && !sw_touch_device ){
        if( deltar < 3 ){ deltar = 1 }
        if( deltar > rows ){ deltar = 1 }
        rows -= deltar
        if( rows < 5 ){ rows = 5 }
        return redraw( item, rows, true)
      }
    }

    // Restore document visibility
    document.body.style.visibility = "visible"
    document.body.style.display   = "inherit"

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
          ||  Math.floor( 8 * sw_width       / sw_cols / sw_wpx)
            > Math.floor( 8 * signaled_width / sw_cols / sw_wpx)
          ||  sw_wpx != signaled_px
          ){
            $.getScript( "/rest"
              + "?cid="    + sw_rest_cid
              + "&do=resize"
              + "&height=" + (signaled_height = sw_height)
              + "&width="  + (signaled_width  = sw_width)
              + "&wpx="    + (signaled_px     = sw_wpx)
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
  $(document).ready( function sw_when_ready(){

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

    // ToDo: http://www.spoiledmilk.dk/blog/?p=1922 to change address in browser
    // Reload page on "back" button
    // ToDo: https://developer.mozilla.org/en/DOM/Manipulating_the_browser_history
    var sw_time_last_page = sw_cookie( "sw_time_last_page")
    if( !sw_can_cache && sw_time_last_page && !sw_touch_device
      && parseInt( sw_time_last_page) > sw_time_built
    ){
      window.location = ""
      window.location.reload( true)
    }else{
       document.cookie = "sw_time_last_page=" + sw_time_built
    }

    // Set the url to match the displayed page, HTML5, thanks to Jean Vincent
    if( window.history.replaceState ){
      window.history.replaceState( null, sw_page, sw_address)
    }

    // Turn Yaml attributes into Angular
    // Note: I need to do it first or else my nicer tooltips don't show up,
    // for reasons I have no time to investigate further.
    loadfire.event( function( fire ){
      if( !fire.does( "angular.js") ){
        if( window.sw_page_uses_angular ){
          de&&bugC( "Weird, page uses angular but angular.js is not loading")
          fire.load( "angular.js")
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
    if( sw_touch_device ){
      // Setting maxWidth helps to avoid auto zooming artifacts
      var w = sw_width = Math.min( screen.width, $(window).width())
      document.body.style.maxWidth = w + "px"
      // document.body.style.lineHeight = "1em;"
      var header = document.getElementById( "header").style
      header.maxWidth = sw_width + "px"
      header.position = "relative"
      header.fontSize = "140%"
      var container = document.getElementById( "container").style
      container.position = "relative"
      container.align    = "left"
      var footer = document.getElementById( "footer").style
      footer.maxWidth = sw_width + "px"	    
      footer.position = "relative"
      footer.fontSize = "120%"
      window.scrollTo( 0, 1)
    }

    // If embeded or iframed or small screen, I remove margins
    if( sw_oembed || sw_iframe || sw_touch_device ){
      document.body.style.margin  = "0px;"
      $("#content").css( "border", "none")
      document.getElementById( "header_content").style.margin = "0px"
    }

    // Do some wikification that was purposedly not done server side
    if( typeof sw_wikify !== "undefined" ){
      // console.log( "wikification started")
      var is_rfc = sw_page.substr( 0, 4) === "#rfc"
      var html   =  $("#content_text").html()
      // Force display if wikification may take a while
      if( html && html.length > 30000 ){ redraw() }
      if( !sw_is_source ){ html = sw_wikify( html, is_rfc) }
      $("#content_text").html( html)
      html = $("#previous_content").html()
      if( html ){
        if( html && html.length > 30000 ){ redraw() }
        html = sw_wikify( html, is_rfc)
        $("#previous_content").html( html)
      }
      // console.log( "wikification done")
    }

    // Initial "re" draw
    redraw()

    // Show notifications, click to hide
    $('#sw_notifications').show().click( function( e ){
      $('#sw_notifications').hide()
    })
    if( sw_touch_device ){
      $('#sw_notifications').css( "position", "relative")
    }

    // Hide login buttons, they need a click to show up
    if( sw_page != "SignIn" ){
      $('#login-buttons').hide()
      $('#login').click( function( event ){
        // If click on "SignIn" when div is open, go to that page
        // Idem if no login buttons
        var $buttons = $('#login-buttons')
        if( !$buttons.size() || $buttons.is(":visible") )return
        // Avoid loading "SignIn"
        event.preventDefault();
        $('#login-buttons').show()
        onFooterDisplay( true, true)
      })
    }

    if( sw_traces && !sw_touch_device ){
      $("#traces").append( sw_traces + "<br><br><br><br><br><br><br><br><br>")
    }

    // Unless it's a touch device, I "hide" the top menu & footer to some extend
    if( !sw_touch_device ){

      // I show them when mouse moves to where they are
      $(".fade").mouseenter( function() {
        sw_fade( true, true) // show, now
      })

      if( false && sw_is_anonymous ){
        $("#header").removeClass( "fade") // Less confusing at first
        $("#footer").removeClass( "fade")
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
      //  $(".fade").fadeTo( 0, 1)
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
          //$("#header").removeClass( "fade")
          //$("#footer").removeClass( "fade")
	}
      })

      // Hide them when mouse leaves window, quiet
      $('html').mouseleave( function(){
        $("#header").addClass( "fade")
        // $("#footer").addClass( "fade")
        // if( window.onFooterDisplay ){ window.onFooterDisplay( true) }
        sw_fade()
      })

      // Provide a visual cue during scrolling, asap
      loadfire.event( function( fire ){
        if( !window.sw_scrollcue )return
        sw_scrollcue( true)
        return true
      })

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
      var $tooltip
      loadfire.event( function( fire ){
        // Don't do that on opera, issue, div & clippling
        if( window.opera )return true
        // Wait until angularize did it's job, else some tooltip don't show up
        // for reasons I have to investigate. ToDo: investigate.
        if( fire.does( "angular") && !window.sw_angularize )return
        // ToDo: on Touch devices, I should use long tap or tap&move,
        // see https://github.com/dotmaster/Touchable-jQuery-Plugin
	$("body").append( '<div id="sw_tooltip"></div>')
        var $tooltip = $('#sw_tooltip')
        var tooltip_width
	function tooltip(){
	  var title = $(this).attr( "title")
	  if( !title )return
          // I will adjust the X position so that the tooltip stays in screen
          var title_width
	  $(this).hover(
	    function( e ){
	      $(this).attr( "title", "")
	       $tooltip						
	      .css( "display", "none")
	      .html( title)
              tooltip_width = $tooltip.outerWidth()
              var x = e.pageX - tooltip_width / 2
              if( x < 0 ){
                x = 0
              }else if( e.pageX + tooltip_width > sw_width ){
                x = sw_width - tooltip_width
              }
              $tooltip
	      .css( "position", "absolute")
              // Set initial position, will follow mouse
              // ToDo: there is an issue with changing font sizes
	      .css( "top",  (e.pageY + 1 * sw_hpx) + "px")
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
	    .css( "top",  (e.pageY + 1 * sw_hpx) + "px")
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
	    /([A-Z]+)/g, "<strong>$1</strong>"
	    //function( ch ){ return "<strong>" + ch + "</strong>" }
	  )
          if( new_text != text ){
            // de&&bugC( "UPPERIZED " + new_text)
            that.html( new_text)
          }
	//}, 1)
      })
    }
    
    // If screen is tall enough, I embed stuff
    if( sw_height > 500 ){

      // Embedded wikis & other stuff
      if( true ){

        // Embed wikis, unless current page is inappropriate
        if( sw_page != "DoProfile"
        &&  sw_page != "PrivateCodes"
        &&  sw_page != "DoClones"
        ){ setTimeout(
          function(){
	    $("#content_text a")
            .each( function( item ){
              // Don't recurse if embedded
              if( sw_oembed || sw_iframe )return false
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
	  $("#content_text a").embedly( {
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
    if( sw_can_script == "maybe" ){ signalModel() }

    if( sw_meebo_bar ){ Meebo( "domReady"); }

    // Install "Click to edit" asap
    if( window.sw_been_here_before_to_install_click_to_edit ){
      de&&bugC( "WEIRD, sw_been_here_before_to_install_click_to_edit")
    }else{
      sw_been_here_before_to_install_click_to_edit = true
    }
    // Call sw_grow( "init") asap
    loadfire.event( function( fire ){
      if( !window.sw_grow )return
      sw_grow( "init")
      return true
    })
    // Call sw_edit() asap
    if( loadfire.does( "sw_edit") ){
      loadfire.event( function( fire ){
        if( window.sw_grow && window.sw_edit && window.sw_edit_closure ){
          de&&bugC( "sw_edit() & sw_edit_closure, calling sw_edit()")
          if( window.sw_must_not_call_edit_again ){
            de&&bugC( "WEIRD, sw_must_not_call_edit_again")
            return true
          }
          sw_must_not_call_edit_again = true
          sw_edit( window.sw_edit_closure)
          return true
        }
      })
    }

    // Monitor changes in screen size
    $(window).resize( function(){
      redraw()
      signalModel()
    })

    // Scroll back to where user was before edit
    if( sw_scroll_to ){
      $('body').scrollTop( sw_scroll_to)
      sw_scroll_to = 0
      document.cookie = "sw_scroll_to=0"
    }

    // Some measures. One can only optimize what one can measure
    sw_ready_duration = ((new Date()).getTime() - sw_time_loaded)
    de&&bugC( "ready in: " + sw_ready_duration + "ms")
  })
  // console.log( "onready() done")
}


Session.editScript = function sw_edit( editclosure ){
// Client side
// sw_edit() defines a listener in order to detect "edit on click"
// That listener is sw_onclick(). It is installed by sw_grow( "init")
// which is called when sw_edit() calls loadfire.fire()

  // If just loaded, do nothing, cannot rely on loading order, need loadfire
  if( !editclosure ){ return }

  // Do nothing if job was done before
  if( window.sw_onclick ){
    de&&bug( "Weird, sw_edit() while window.sw_onclick is there already")
    return
  }

  // I track the location not to mess with browser default behaviour
  var loc = window.location.href

  // First time textarea has focus, some special stuff occur
  sw_edit_had_focus = false

  // Def function installed on the #content div, for click & mousedown events
  window.sw_onclick = function( e ){

        var content = document.getElementById( "content_text")

        e = e || window.event
        var target = e.target || e.srcElement
        var $link = $(target).closest( "a")

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
          return
        }

        // If click on a <input xx>, ignore
        if( $(target).closest( "input").size() ){ return }

        // Filter out embed.ly content
	if( $(target).closest( "object").size() ){ return }

        // If cannot switch to edit mode...
        // This happens when a new page is about to be loaded, on touch devices
        // and if, obviously, edit mode is alreay active
        if( (window.location.href != loc
          && window.location.href.indexOf( sw_address) < 0)
        || sw_editing
        || sw_touch_device
        ){
          // If already editing, manage some "macros", when I can
          if( sw_editing
          && window.sw_get_input_selection
          && !window.sw_codemirror
          ){
            window.sw_editmode_onclick( e)
          }
	  // Either I can't, I already switched, or browser is loading a page
	  return
	}

	// Load edit page in some cases, when there is no "content_editable" div
	// or some stuff I don't remember about cols... comment, comment, comment
	var edit = document.getElementById( "content_editable")
        if( !edit
        || sw_cols != sw_config_cols
        ){
          // This is how I ask the browser to load a new page. Note: I don't
          // provide the path to the page, because I reference a closure in the
          // server, a closure that will provide an "edit form" for the proper
          // page (ie the page that was the "current page" when the closure was
          // created).
          window.location.href= sw_address + "?cid=" + editclosure;
	  return
	}

        // Use inputs from user, angularize related
        update_ta()

        // Refetch content if page is somehow old
        // ToDo: Commet style notification from other writer would be better
        var time_now = (new Date()).getTime()
        var age = time_now - sw_time_loaded
        // console.log( "click to edit, age: " + age)
        if( (sw_visitors > 1 && age > 5000)
        ||  age > 20000
        ){
          // ToDo: this can be avoided if there are no other active user in the wiki
          // Safe old style ? reload page
          if( false && true ){
            window.location.href= sw_address + "?cid=" + editclosure;
	    return
          }
          // New API based style
          // console.log( "update content")
          sw_do.getPage( sw_page, function( result ){
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
        if( sw_previous_content_displayed ){
          var pc = document.getElementById( "previous_content")
          if( pc && pc.style.display != "none" ){
            pc.innerHTML = '\n\n' + content.innerHTML
          }
          $("#previous_content").fadeTo( 0, 1).removeClass( "fade")
	}
	// Move footer at the end of the page
	// ToDo: not usefull anymore I guess
        document.getElementById( "footer").style.position = "relative"
	// We start editing, give focus to properly sized textarea asap
        sw_editing = true
	loadfire.event( function( fire ){
          if( !window.sw_grow )return
          de&&bugC( "Calling sw_grow() from sw_onclick() due to a user click")
          window.sw_grow()
          return true
        })
        // Copy submit buttons to the top menu
        window.sw_header_buttons()
        // I show them now
        sw_fade( true, true) // show, now
        // sw_fade()
        // Let the menu & footer "stick"
        $("#header").removeClass( "fade")
        $("#footer").removeClass( "fade")

        var text = document.getElementById( "textarea_sw").value

        // Tell user when she may leave without saving changes
        // ToDo: do something similar in Edit pages
        window.onbeforeunload = function( e ){
          // ToDo: does not work in Chrome, see http://code.google.com/p/chromium/issues/detail?id=4422
          // ToDo: does not work in Opera
          if( !sw_editing
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
          sw_editing            = false
          window.onbeforeunload = null
        })
        return false
  }
  // Fire so that sw_grow( "init") notices asap if it is waiting
  loadfire.fire()
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
  head.push(
    '<div id="container">'
  )

  // On load, resize font and hide previous content if needed
  // ToDo: memorize it instead of recompute on each load
  if( this.canScript && !fluid ){
    head.push( '\n<div id="sizer">M</div>\n')
  }

  if( other ){
    head.push( "<table><tbody><tr>")
  }
  
  if( previous_first && other ){
    body.push(
      '<td class=" fade" id="previous_content">\n',
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
      '\n</td><td class="content fade" id="previous_content">',
      other
    )
  }
  
  if( other ){
    tail.push( "</td></tr></tbody></table></div>\n")
  }else{
    tail.push( "</div></div>\n")
  }
  
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
  if( this.isMentor &&  page.name != "AboutWiki" ){
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

  // Check login/logout with twitter, facebook...
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

  // Signal mentoring
  if( this.isMentor && !page.isDo() ){
    this.notify( "Mentoring, DoNoMentoring")
  }
  
  // Let's get page content and render it.
  this.getPage( page, function viewform_getPage( err, page )
  {
  var data = page.getBody()
  
  // Set some default content for user pages
  if( !data && page.isUser() && page.name != "UserSome" ){
    // Use user's name as default content for user pages, unless mentor
    if( !that.canMentor  ){
      data = this.userName()
    // If mentor, maybe help register new facebook or twitter users
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

  // CodeXxxxx pages manage logins
  if( page.isCode() && !page.isDraft() ){
    // unless already logged mentor or coming from a User page (NewMember)
    // Note: however mentors can login with another code, but only from their
    // login page. Why: this way I know it's "on purpose", not "by accident".
    if( (!that.canMentor || this.previousWikiPage == that.loginPage)
    &&  !(that.previousWikiPage
      && that.previousWikiPage.isUser()
      && that.previousWikiPage != that.loginPage)
    ){
      if( !that.wiki.isVeryOpen()
      && page.getCode() != that.loginCode
      ){
        that.login_de&&bug( "Delayed login, with intentional code:", page)
        return that.codeLoginForm( page, true, req)
      }
      // Anyone that knowns about a valid code with mentorship rights...
      if( page.isMentorCode() ){
        // ... becomes a mentor (until the session's gone)
        that.login_de&&bug( "Becomes mentor by reading code:", page)
        that.canMentor = true
      }
      // If code is login code and page is empty... first visit
      if( page.getCode() == that.loginCode
      && !data
      && !that.isAnonymous()
      ){
        data = that.membernamize( that.loginName)
        // Unless wiki is very open, some mentor validation is needed
        if( !that.wiki.isVeryOpen() ){
          that.draft( page)
          data += "\nDraftCode\n"
        }
        that.putPage( page, data)
        // I assume that if user visit her code, mentors would like to know it
        that.logCode( page.name, that.membernamize( that.loginName))
      }
    }
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
  && !that.isMentor
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
  var may_edit =  that.mayEdit( page)
  if( page.isNull()
  && !page.isUser()
  && may_edit
  && !(that.isGuest() && that.wiki.isClosed())
  ){
    return that.editForm( req, false)
  }

  // Set default content for pages. User pages default to current user
  if( page.isNull() ){
    if( page.isUser() && !that.isMentor ){
      data = that.userName()
      if( !data ){
        data = ""
      }
    }
  }
  if( (page.isUser() || page.isCode())
  && "Deleted".starts( data) && !that.isMentor
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
  
  if( "Deleted".starts( data) && !this.isMentor ){
    data = ""
  }
  
  // Tool? (this is the "top" menu)
  var tools = ""
  if( !page.isHtml() ){
    // ToDo: I should at least have a "Bye", even on "read" pages
    if( (true || !page.isRead()) || that.canMentor ){
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
  }, this.isMentor) // .read() is "local" if mentoring, see "Proxy" pages
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

  // Check login/logout with twitter, facebook, ...
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
        : that.pageLabel( page, false, that.i18n( "Edit ")))
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
  }, that.isMentor) // "local" fetch if mentoring
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

Session.wikiLabel = function(){
// Returns nice looking "label" for the wiki.
// Returns i18n'ed "Anonymous" or the wiki's name (or title)
  if( this.wiki.isUserWiki() )return this.i18n( "Yours")
  var homelabel
  var it = this
  var wiki = this.wiki
  var title
  if( title = wiki.getTitle( this) ){
    homelabel = title
  }else{
    homelabel = wiki.name || SW.name
    // If wiki name matches user's name
    if( homelabel        == it.userName().toLowerCase()
    || ("@" + homelabel) == it.userName().toLowerCase()
    ){
      homelabel = it.i18n( "Home")
    // If custom domain
    }else if( it.custom ){
      // Get rid of trailing /
      homelabel = it.subdomain.substr( 0, it.subdomain.length -1)
    // "Anonymous" case
    }else if( wiki.isAnonymous() ){
      homelabel = it.i18n( "Anonymous")
    // "normal" case
    }else{
      homelabel = homelabel.replace( /.*_/, "")
    }
  }
  if( wiki.isVeryOpen() ){
    homelabel += it.i18n( "(open)")
  }
  return homelabel
}
Session.declareIdempotentGetter( "wikiLabel")

// jhr
// xuor     e     l      na     i      r    b
// xno\u0279\u01dd\u0283 u\u0250\u0131\u0279q

Session.autogrowScript = function sw_grow( e ){
// Client side
// ToDo: see http://tpgblog.com/2011/01/02/bettergrow/
// This function basically does two things (which is too much).
// 1/ when called with a "init" parameter it attaches an event listener
// to detect "click to edit". That listener (ws_onclick) is defined by
// sw_edit() (or locally if sw_edit.js is not loaded, ie in "edit" pages)
// 2/ else it makes sure the normal text is hidden, the editable text is
// shown, the textarea size is big enough and is given the focus if it
// it never had it so far.

  // de&&bugC( "sw_grow() called")
  // If called before global $(document).ready(), do nothing
  // This happens when sw_grow.js gets loaded, and on some other rare
  // bad cases also, maybe
  if( !window.sw_document_ready ){
    de&&bugC( "sw_grow() call is premature, ignored")
    return
  }

  var ta    = document.getElementById( 'textarea_sw')
  var $ta   = $(ta)
  var $txt  = $('#content_text')
  var $edit = $('#content_editable')

  // Define some stuff first time we're called
  if( !window.sw_get_input_selection ){

  // http://stackoverflow.com/questions/3053542/how-to-get-the-start-and-end-points-of-selection-in-text-area/3053640#3053640
  function getInputSelection( el ) {
    var start = 0
    var end   = 0
    var normalizedValue
    var range
    var textInputRange
    var len
    var endRange
    if (typeof el.selectionStart == "number" && typeof el.selectionEnd == "number") {
        start = el.selectionStart
        end   = el.selectionEnd
    } else {
        range = document.selection.createRange();

        if (range && range.parentElement() == el) {
            len = el.value.length;
            normalizedValue = el.value.replace(/\r\n/g, "\n");

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
            } else {
                start = -textInputRange.moveStart("character", -len);
                start += normalizedValue.slice(0, start).split("\n").length - 1;

                if (textInputRange.compareEndPoints("EndToEnd", endRange) > -1) {
                  end = len;
                } else {
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
    window.sw_submit = function( verb, guest, text, action ){
      var sw_form = document.getElementById( "edit_form")
      var form    = document.createElement( "div")
      var query   = window.location.href
      if( window.sw_codemirror ){
        window.sw_codemirror.save()
      }
      text || (text = ta.value)
      // Save bandwidth & improve speed
      if( action == "Cancel" || action == "Revenir" ){
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
      form.firstChild.children[1].value = sw_page
      form.firstChild.children[2].value = guest
      form.firstChild.action = action || sw_form.action
      // console.log( "submit"); console.log( form)
      window.onbeforeunload = null
      // ToDo: should also set cookie when submit is in original form
      if( sw_scroll_to ){
        document.cookie = "sw_scroll_to=" + sw_scroll_to
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
    window.sw_editmode_onclick = function( e ){
      e = e || window.event
      var target = e.target || e.srcElement
            if( target == ta ){
              var pos = window.sw_get_input_selection( ta)
              // console.log( "click in textarea, start:" + pos.start + ", end: " + pos.end)
              var val = ta.value.replace( /\r\n/g, "\n")
              // If 
              if( pos.start != pos.end ){
                var action = val.slice( pos.start, pos.end)
                var limit = pos.end + val.substr( pos.end).indexOf( "\n") + 1
                // console.log( "action:'" + action + "'")
                if( action == "SendNow" ){
                  window.sw_submit( "Send", "", val)
                }else if( action == "DoIt" ){
                  window.sw_submit( "DoIt", "", val)
                }else if( action == "CancelNow" ){
                  window.sw_submit( "Cancel", "", val)
                }else if( action == "SortNow" || action == "ReverseNow" ){
                  var front = val.substr( 0, limit)
                  var tail  = val.substr( limit)
                  tail = ("\n" + tail + "\n").replace( /\n+/g, "\n")
                  var list = tail.split( "\n")
                  list = (action == "SortNow") ? list.sort() : list.sort().reverse()
                  tail = list.join( "\n")
                  tail = ("\n" + list.join( "\n") + "\n").replace( /\n+/g, "\n")
                  ta.value = front + tail
                }else if( action == "TimeNow" ){
                  // console.log( "insert ISO date")
                  ta.value = val.substr( 0, pos.start)
                  + (new Date()).toISOString() + "\n" + action
                  + val.substr( pos.end)
                 }else if( action == "DateNow" ){
                  // console.log( "insert local date")
                  ta.value = val.substr( 0, pos.start)
                  + (new Date()).toLocaleString() + "\n" + action
                  + val.substr( pos.end)
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
      buf.push( '<a href="#edit">...</a>')
      $("#top_center").html( buf.join( "|"))
    }

    // In "edit" pages sw_edit.js is not included, hence no sw_onclick()
    // So... I provide a definition here.
    if( !loadfire.does( "sw_edit") ){
      de&&bugC( "Edit page")
      window.sw_onclick = window.sw_editmode_onclick
      window.sw_header_buttons()
    }

  } // if grow() called for the first time

  // "init" is called once, to attach a "onclick" track over the "content" area
  if( e == "init" ){
    // Install click handler ("Click to edit" unless "edit" page already) asap
    loadfire.event( function( fire ){
      // Needs sw_onlick() (which sometimes is sw_editmode_onclick)
      if( !window.sw_onclick )return
      // Got it, install it on "content" area
      $("#content").click( window.sw_onclick)
      // Dragging something also triggers the edit mode
      // Works on Chrome. ToDo: does not work on FF & Opera... :(
      .bind( "dragenter",  function( event ){
        $(this).unbind( event)
        window.sw_onclick()
      })
      return true
    })
    return
  }

  // If called while not editing, whatever the reason, do nothing more
  if( !window.sw_editing ){
    de&&bugC( "sw_grow() called while not editing, skipped")
    return
  }

  // Make sure there is always a terminating lf, usefull for drops
  var val = ta.value.replace( /\r\n/g, "\n")
  if( typeof sw_textarea_was_empty === "undefined" ){
    sw_textarea_was_empty = !val
  }
  if( !val ){ sw_textarea_was_empty = true }
  if( !sw_textarea_was_empty
  && val.charAt( val.length - 1) != "\n"
  ){
    // ToDo: this works poorly if user is writting at the end
    // I detect if the caret is at the end
    var pos = getInputSelection( ta)
    pos = (pos.start > pos.end) ? pos.start : pos.end
    // console.log( "val length: " + val.length + ", pos:" + pos + "ch:" + val.charAt( val.length - 1))
    if( pos < val.length ){
      // console.log( "add extra \\n")
      // ToDo: unfortunately this moves the caret to the end of the text area
      // ta.value = val + "\n"
    }
  }

  if( !sw_edit_had_focus ){
    var scroll_top = $('body').scrollTop( scroll_top)
    // de&&bugC( "height:" + scroll_delta)
    $txt.hide()
    $edit.show()
  }

  // Adjust height
  ta.style.width = ta.style.maxWidth = (sw_cols * sw_wpx) + 'px'
  var ch = ta.offsetHeight
  var sh = ta.scrollHeight
  // sh is bad... needs ta.style.height = 0 first,
  // on some browsers, to update scrollHeight, quirks.
  // but unfortunately it has bad side effect on scroll.
  // Workaround: create a clone just to get the height.
  // See http://james.padolsey.com/javascript/jquery-plugin-autoresize/
  // Many thanks James, it's been hard without you
  var clone  = window.sw_grow_clone
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
    window.sw_grow_clone = clone = $ta.clone()
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

  // Give focus, but once only, because I don't control the
  // caret position (that should follow the mouse I wish) and
  // as a result the caret position determines the scroll top of
  // the text area...
  if( !sw_edit_had_focus ){
    sw_edit_had_focus = true
    if( !sw_iframe ){
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
            sw_scroll_to = scroll_top
            scroll_top = 0
          }, 50)
        }
      })
      $ta.focus()
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
      window.sw_grow()
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
    .change(     function(){ window.sw_grow() })
    .mouseleave( function(){ window.sw_grow() })
    .mouseenter( function(){ window.sw_grow() })
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
  || (page.wasDeleted() && !this.isMentor)
  ){
    // "User" pages content default to the current user's name
    if( page.isUser() ){
      // Unless mentor is apparently creating a user
      if( that.canMentor
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
    // "Code" pages default to the current user's name too
    }else if( page.isCode() ){
      data = that.userName() + "\n"
      // Unless user is coming from a user page, ie creating her code
      if( this.previousPage && this.previousPage.isUser() ){
        // In that case, the content is that user's name
        var user = this.previousPage.getUser()
        // But only if that user is not a guest
        if( !user.includes( "Guest") ){
          data = user + "\n" + Sw.dateNow.toISOString() + "\n" + data
        }
      }
      // ToDo: quid if previous page is a Map?
    // "HomePage" defaults to some welcome message for brand new secret wikis
    }else if( page.isHome()
    && that.wiki.isAnonymous()
    && !page.wasDeleted()
    ){
      data = that.i18n( "Welcome to your new secret wiki")
    }else{
      data = ""
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
  if( needs_codemirror = is_angular || is_css ){
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
       (!page.isSensitive() || that.canMentor)
    && (!page.isCode()      || that.canMentor)
    && !that.wiki.isEmpty() // Don't confuse new comers
    && !empty
    && !page.isDraft()
    && submit( "Draft", "send a draft version");
    // Stamp
       page.isDraft()
    && (!page.isCode() || that.canMentor)
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
        window.sw_codemirror = CodeMirror.fromTextArea( 'textarea_sw', {
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
  var isuser = page.isUser()
  var with_code = false

  // Login form? (twitter & facebook & linkedin & SignIn)
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
  
  // Login form? (twitter & facebook & SignIn)
  if( with_code ){
    foot.push( that.serviceLoginForm())
  // Else, just SignIn
  }else{
    if( page.name != "SignIn" ){
      foot.push(
        '<div id="login">',
        this.link(  this.lookup( "SignIn"), this.i18n( "SignIn"), "click"),
        '</div>'
      )
    }
  }

  // Arrow to scroll to the top & anchor referenced in toolForm()
  foot.push(
    '<div id="gotop"><a name="footer"></a><a href="#top">&uarr;</a></div>'
  )

  // Visits
  if( tools
  && !with_code
  //&& that.wikiHistory.length
  && !that.wiki.isEmpty()
  ){
    var list  = []
    var first_seven = that.wikiHistory.slice( 0, 7)
    var a_page
    for( var ii in first_seven ){
       a_page = this.lookup( first_seven[ii])
       list.push( that.link( a_page, Wiki.redize( a_page.name)))
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
  if( tools && !with_code && !page.isHome() ){
    var buf = "<br>" + that.i18n( "Links:")
    var list = []
    that.wiki.forEachBacklink( page, that.canMentor, function( apage ){
      list.push( " " + that.link( apage, Wiki.redize( apage.name)))
    })
    // Don't display as is if empty or too much, avoid some noise
    if( list.length ){
      // If long list not about a tag,I pick 7, randomly
      if( (list.length > 7) && !page.isTag() && !that.isMentor ){
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
    if( !that.isGuest()
    && page.isUser()
    && page == that.loginPage
    && !plink.includes( "?code=")
    ){
      plink += "?code=" + that.loginCode
      if( this.isDebug ){
        plink += "&debug=" + this.wiki.getRoot().config.debugCode
      }
    }
    var label = that.i18n( "drag this")
    // On "user" page, display "SECRET!" to help the user get back
    // to her personal page.
    if( isuser ){
      var users = page.getUsers()
      // Don't display "SECRET" when some guests may read the page
      if( !users.includes( "Guest") ){
        label = "<em>" + that.i18n( "SECRET!") + "</em>"
      }
    }
    foot.push( "<br>"
      + that.i18n( "Web address: ")
      + HtmlA(
	label,
	Wiki.htmlizeAttr( plink) // Wiki.decodeUrl( plink))
      )  
    )
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
      // No comments on user, private and code pages,
      // useless & may compromize privacy by broadcasting secrets
      if( page.isUser() || page.isPrivate() || page.isCode() ){
        fb_like = false
      }
      // No comments if embeded, takes too much space
      if( that.isOembed ){
        fb_like = false
      }
    }

    // OneTrueFan widget
    if( (is_safe && that.config.oneTrueFan)
    || (page.data && page.data.isOneTrueFan)
    ){
      page.de&&bug( "with OneTrueFan")
      this.needsOneTrueFan = true // ToDo: intefere with with_code ?
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
        + that.i18n( "Invitation code") + '" value="" />'
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
        fb += '<div class="shr-publisher-page"></div><br>'
        + '<script type="text/javascript">'
        + '\n/* <![CDATA[ */\n'
        + "var SHRSB_Settings = " + Wiki.htmlize( JSON.stringify( SHRSB_Settings))
        + '\n/* ]]> */\n'
        + "</script>"
      }
      // ToDo: http://simpliwiki.com/jeanhuguesrobert@ should open my wiki
      // versus SimpliWiki root wiki as of today.
      //plink = plink.replace( "/HomePage", "/")
      // ToDo: compute a better width
      if( !that.facebookId ){
        if( !that.isIframe ){
          // ToDo: figure out a way to do that only when footer is displayed
	  fb += '<div id="sw_fb_like_button"></div>'
          + '<script>var sw_fb_like_button_href = "'
          + Wiki.htmlizeAttr( plink)
          + '"</script>'
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
        ? "" // Force display of footer on SignIn page
        : Session.htmlScript(
          "loadfire.event( function( fire ){"
          +  "if( !window.onFooterDisplay )return;"
          +  "window.onFooterDisplay( true, true);"
          +  "return true})"
        )
      )
    }
    foot.push( fb)
    // ToDo: QR code? http://chart.apis.google.com/chart?cht=qr&chs=150x150&chl='
    // +encodeURIComponent(top.location.href)+'&chld=H|0','qr','width=155,height=155')
  }

  // page info
  if( that.isMentor ){
    function info( page, msg ){
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
  if( !De || that.isMentor || that.isDebug ){
    cpu = " ("
    + (((new Date()).getTime() - that.dateLastAccess.getTime()) / 1000)
    + " secs)"
  }
  if( true || !that.isPremium() ){
    foot.push(
      '<div id="powered">'
      // + that.i18n( "powered by ")
      + '<a href="http://simpliwiki.com">'
      +   '<img src="/yanugred16.png"/>'
      +   ' <strong>Simpl<em>i</em>Wiki</strong>'
      + '</a>'
      + '<a href="http://chartaca.com/c5e0f38e-a3e2-427f-9d4b-654865bd6300">'
      + '<img src="http://chartaca.com/point/c5e0f38e-a3e2-427f-9d4b-654865bd6300/s.gif">'
      + '</a>'
      + cpu
      + ' <a href="http://simpliwiki.com/with.google">'
      +   "Google"
      + "</a>"
      + "</div>"
    )
    // Add some br, so that menu does not "stick" by accident too much
    for( var ii = 10 ; ii-- ; ){ foot.push( "") }
  }
    
  return [
    '\n<div class="fade" id="footer"><div id="footer_content">\n',
    foot.join( "\n"),
    "</div></div>\n"
  ].join( "")
}

Session.permalinkTo = function( page, isuser ){
  page || (page = this.getCurrentPage())
  if( !page.isDo()
  &&  (isuser || !page.isUser() )
  &&  (isuser || this.mayRead( page)) // Was this.protoGuest.mayRead()...
  ){
    var plink = this.wiki.permalink(
      page.name, 
      (isuser && !this.isAnonymous()) ? this.loginCode : ""
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

Session.follows = function( session ){
  return this.peerSession == session
}

Session.pairs = function( session ){
  session = session ? session : this.peerSession
  return !!(session && this.follows( session) && session.follows( this))
}
Session.declareIdempotentPredicate( "pairs")

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
      HtmlA(
        "Wiki",
        Wiki.encode( pagename) + "/HomePage",
        //Wiki.encodeUrl( pagename + "/HomePage"),
        "Another micro wiki, maybe"
      )
    )
  }
  
  // parent wiki
  if( !it.wiki.isRoot()
  &&  !it.wiki.parentWiki.isRoot()
  &&  (!it.isAnonymous() || it.wiki.parentWiki.name.length > 2) // /fr, etc
  ){
    tool( HtmlA(
      it.wiki.parentWiki.name,
      it.parentLinkTo( it.wiki.homePage),
      it.i18n( "Original wiki")
    ))
  }

  // Wiki's home
  var homelabel = Wiki.htmlize( this.wikiLabel())
  tool( it.link(
    this.wiki.homePage,
    "<em>" + homelabel + "</em>",
    it.i18n( "This micro wiki's home page")
    + (" ("
      + it.wiki.fullname().replace( /\/$/, "")
    + ")").replace( " ()", "")
  ))
  
  // Mentor
  if( (page == it.loginPage || page.isCode())
  && it.canMentor
  && !it.isMentor
  && !it.wiki.isUserWiki()
  ){
    var mentorclosure = it.registerClosure( function(){
      if( it.canMentor ){ it.isMentor = true }
      it.notify( it.i18n( "You are now in 'Mentoring' mode"))
      it.notify( "AboutWiki")
      it.notify( "DoDrafts")
      it.notify( "DoDraftsAndCodes")
      it.notify( "PrivateCodes")
      it.notify( "DoMembers")
      it.viewForm( this)
    })
    tool( it.button(
      "mentor",
      mentorclosure,
      "switch to mentoring mode"
    ))
  }
  
  // "AboutWiki"
  if( !it.wiki.isUserWiki()
  && ( it.isMentor
    || it.isDebug)
  ){
    tool( it.linkPage(
      "AboutWiki",
      it.i18n( "AboutWiki")
    ))
  }
  
  // Reset
  if( it.isMentor && it.isDebug ){
    tool( it.button(
      "Reset",
      it.resetClosure,
      "Reboot!"
    ))
  }
  
  // Tools
  if( it.isMentor ){
    var mentordo = it.registerClosure( function( it ){
      it.doOnPage = page
      it.setCurrentPage( it.wiki.lookupPage( "PrivateTools"))
      it.viewForm( this)
    })
    tools.push( it.button(
      "tools",
      mentordo,
      "Some tools for power users"
    ))
  }
  
  // changes & drafts
  if( page == "DoVisits"
  || (true  && page.isHome())
  || (false && page.isUser())
  || it.canMentor
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
    var with_codes = it.isMentors
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
          it.canMentor	// => with draft codes & draft users
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
      it.i18n( "Some active cloned micro wikis")
    ))
  }

  // Visits
  if( (page.name == "RecentStamps"
    || (page.isHome() && !it.isAnonymous()))
  && it.wiki.recentSessionsCount() > 1
  ){
    var nvisits = 0
    // ToDo: optimize this?
    wiki.forEachSession( function( session ){
      // Skip bots
      if( session.isBot )return
      nvisits++
    })
    if( nvisits > 1 ){
      tools.push( it.linkPage(
        "DoVisits",
        nvisits + " " + it.i18n( "visits"),
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

  // Codes, display PrivateCodes, unless almost empty
  if( page.isCode()
  && (it.canMentor || it.wiki.isVeryOpen())
  && data.split( "Code:").length > 1
  ){
    tools.push( it.linkPage(
      "PrivateCodes",
      it.i18n( "codes"),
      it.i18n( "Some invitation codes")
    ))
  }

  // Unfollow
  if( it.peerSession ){
    it.peerSession.lastFollower = it
    // ToDo: store in session
    var unfollowclosure = it.registerClosure( function( it ){
      if( it.peerSession && !it.peerSession.isGone ){
        it.peerSession.lastFollower = it
        it.peerSession = null
      }
      it.wiki.lastSession = it
      it.viewForm( this)
    })
    var peername = it.peerSession.userName()
    // Display user & visited page, unless user is alone in a map/code
    tools.push( it.button( 
      (it.i18n( it.pairs() ? "Unpair" : "Unfollow"))
      + " "
      + it.linkPage( 
          peername,
          null, 
          it.i18n( "Some peer, last seen ")
            + it.timeLabel( it.peerSession.timeLastAccess)
        )
      + ((it.pairs()
          || (!it.peerSession.getCurrentPage().isMap()
            && !it.peerSession.getCurrentPage().isCode()
            && it.mayRead( it.peerSession.getCurrentPage())
            && !it.peerSession.isBehindMap
          )
        )
        ? " " + it.link( it.peerSession.getCurrentPage(), null, "Some page")
        : ""),
      unfollowclosure
    ))
  }
 
  // Follow, last viewer/user/follower/other
  if( !it.peerSession && !it.isAnonymous() ){
    var peer = false
    || it.mayFollow( wiki.getSession( pagename), true)
    || it.mayFollow( wiki.getPageLastSession( pagename))
    || it.mayFollow( it.lastFollower)
    || it.mayFollow( wiki.lastMemberLogin)
    || it.mayFollow( wiki.lastGuestLogin)
    || it.mayFollow( wiki.lastSession)
    if( peer && !peer.isBot ){
      var followclosure = it.registerClosure( function( it ){
        if( !peer.isGone ){
          it.peerSession = peer
          NDe&&bug( "Following " + peer.userName())
          peer.lastFollower = it
        }
        it.wiki.lastSession = it
        it.viewForm( this)
      })
      tools.push( it.button(
        (it.i18n( peer.follows( it) ? "Pair" : "Follow"))
        + " " + it.linkPage(
            peer.userName(), null,
            it.i18n( "Some peer, last seen ")
              + it.timeLabel( peer.timeLastAccess)
          )
        + ( (pagename == peer.userName() 
            && !peer.getCurrentPage().isMap()
            && !peer.getCurrentPage().isCode()
            && it.mayRead( peer.getCurrentPage())
            && !peer.isBehindMap
          )
          ? " " + it.link( peer.getCurrentPage(), null, "Some page")
          : "" ),
        followclosure
      ))
    }else{
      NDe&&bug( "No one to follow, " + peer)
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
      tools.push( it.button(
        '<img src="/ueb16.png" alt="edit">',
        editclosure, 
        "write your text on the page"
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
      "restore page content using this copy"
    ))
  }
  
  // Stamp
  // ToDo always allow stamping, but meaning should vary
  if( canedit
  && !it.isAnonymous()  
  && (page.isHome() || page.isCode() || !page.isSensitive())
  && (!it.isMentor || page.isDraft())
  && !page.isDo()
  && !(it.isGuest() && page == it.loginPage)
  && !page.isCode() // Processed with "Invite/Block", see above
  && !page.isVoid()
  ){
    tools.push( it.button(
      "stamp",
      it.registerClosure( function( it ){
        // This is a hack, to reuse code in postForm()
        it.postForm( this, page, null, null, it.i18n( "Stamp"))
      }),
      "add your name to this page"
    ))
  }

  // Trash
  if( page.isDraft()
  // && canedit
  // && !page.isCode() -- anybody can undraft a code, ie restore broken access
  && (!page.isUser() || canedit)
  ){
    tools.push( it.button(
      "trash",
      it.registerClosure( function( it ){
        it.trash( page)
        it.viewForm( this)
      }),
      "remove draft changes, restore stamped original page"
    ))
  }

  // Do, for #! content
  if( it.isMentor && data && "#!".starts( data) ){
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
  //  page += " | " + HtmlA( "Html", htmlname);
  
  // bookmark! Reminds user on how to come back
  if( page.isCode()
  && !it.loginWithCode
  && !it.user
  && page.getCode() == it.loginCode
  ){
    tools.push( "<em>" + it.i18n( "bookmark this page") + "</em>")
  }

  // Invite/Block members
  if( page.isCode()
  && (it.canMentor || it.wiki.isVeryOpen())
  ){
    var member = page.getFirstUser()
    if( member ){
      var membername = member.replace( "Guest", "")
      membername = it.wikinamize( membername, null, "One")
      var memberpage = it.lookup( it.usernamize( membername))
      var is_draft = page.isDraft() || memberpage.isDraft()
      var inviteclosure = it.registerClosure( function( it ){
        var req = this
        it.acl_de&&bug( "Inviting member:", member)
        if( page.isDraft() || "Guest".ends( member) ){
          it.stamp( page, false) // false => don't write, putPage() comes next
          it.putPage(
            page,
            (page.isMentorCode() ? "Mentor" : "") + membername + "\n"
	    + it.userName() + "\n\n"
	    + page.getBody(),
            function( err ){
              if( err ){
                it.wiki.error( "Could not properly invite, member:", member,
                  ", page:", page)
              }
            }
          )
        }
        if( memberpage.isDraft() || membername != member ){
	  var should_stamp = true // To avoid double write
          if( membername != "SomeOne" && memberpage.name != "UserSome" ){
            it.acl_de&&bug( "Invite:", membername, "code:", memberpage)
	    it.stamp( memberpage, false) // false => don't write, putPage will
	    should_stamp = false
            it.putPage( memberpage,
              membername + "\n"
	      + it.userName() + "\n\n"
	      + memberpage.getBody(),
              function( err ){
              if( err ){
                it.wiki.error( "Could not properly invite, member:", member,
                  ", page:", memberpage)
              }
            })
          }
          if( should_stamp ){
	    it.stamp( memberpage)
	  }
        }
        if( membername != "SomeOne" ){
          it.setCurrentPage( memberpage)
        }
        it.viewForm( req)
      })
      var blockclosure = it.registerClosure( function( it ){
        var req = this
        it.acl_de&&bug( "Blocking member:", member)
        it.stamp( page, false) // Don't write yet
        it.stamp( memberpage, false) // Don't write yet
        // If anonymous guest, forget about all this stuff, don't write pages
        // because will login as guest anyway
        if( "Guest".ends( member) ){
          it.acl_de&&( "No need to write, already a guest:", member)
          return it.viewForm( req)
        }
	// ToDo: I should check if a non draft version exits
	// If not, I can just trash the code
	// Else... I turn the code into an invitation to be a guest
        // User will be able to login with code, but as a guest
        it.putPage(
          page,
          it.guestnamize( membername) + "\n"
	  + it.userName() + "\n\n"
	  + page.getBody(),
          function( err, page ){
            if( err ){
              it.wiki.error( "Cannot guestize user:", member,
                "page:", page, "err:", err)
              it.draft( page)
              it.draft( memberpage)
            }
            // Don't overwrite the anonymous member
            if( memberpage.name == "SomeOne" ){
              it.acl_de&&( "No need to write, anonymous SomeOne")
              return it.viewForm( req)
            }
            if( memberpage.name != "UserSome" ){
              it.putPage(
                memberpage,
                it.userName() + "\n\n"
		+ memberpage.getBody(),
                function( err ){
                  if( err ){
                    it.wiki.error( "Cannot guestize user:", member,
                      "page:", memberpage, "err:", err)
                    it.draft( page)
                    it.draft( memberpage)
                  }
                  return it.viewForm( req)
                }
              )
            }else{
              return it.viewForm( req)
            }
          }
        )
      })
      if( is_draft || "Guest".ends( member) ){
        tools.push( it.button(
          it.i18n( "invite")
          + " " 
          + it.link( memberpage, member, it.i18n( "A guest so far")),
          inviteclosure,
          it.i18n( "Make member of this wiki")
        ))
        if( is_draft || !"Guest".ends( member) ){
          tools.push( it.button(
            it.i18n( "block"),
            blockclosure,
            it.i18n( "Do not invite")
          ))
        }
      }
      if( !is_draft && !"Guest".ends( member) ){
        // Don't block yourself nor guests
        if( memberpage != it.loginPage ){
          tools.push( it.button(
            it.i18n( "block")
            + " " 
            + it.link( memberpage, member, it.i18n( "A member so far")),
            blockclosure,
            it.i18n( "Cancel invitation")
          ))
        }
      }
    }
  }

  // Code of member, on member pages typically
  if( it.canMentor
  || it.wiki.isVeryOpen()
  ){
    var member_session = it.wiki.allSessionsByName[page.name]
    // But not for current user herself, there is "secret", see below
    // Providing the info twice would be confusing
    if( member_session && member_session != it ){
      tools.push( it.linkPage(
        "Code" + member_session.loginCode.capitalize(),
        "code",
        it.i18n( "This visitor's invitation code")
      ))
    } 
  }
  
  // Compress changes, on stamp pages
  if( page.isStamps() ){
    var show_compress = true
    // Compress "RecentStamps" is for mentors only unless very open
    if( page.name == "RecentStamps" && !it.canMentor ){
      show_compress = it.wiki.isVeryOpen()
    }
    // Don't show the option if small changes, disturbing at first
    if( show_compress && !it.isMentor ){
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
  
  // Trash all (for mentors only)
  if( page.name == "DoDrafts"
  && (it.isMentor
    || (it.canMentor && it.wiki.draftsCount()))
  ){
    tools.push( it.linkPage(
      "DoClearAllDrafts",
      it.i18n( "clear all drafts")
    ))
  }
  
  // Trash all codes, if any & mentor
  if( page.name == "DoDraftsAndCodes" && it.canMentor ){
    // Only if some draft pages are code page (or user pages)
    if( it.wiki.draftsCount() < it.wiki.draftsCount( true) ){
      tools.push( it.linkPage(
        "DoClearDraftCodes",
        it.i18n( "block all codes",
        "Don't invite recent visitors")
      ))
    }
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
	+ (!it.isMentor ? "" : it.i18n( ". Older: ") + hot.name + ", "
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
      "Some pages you changed recently in this micro wiki"
    ))
    // ToDo: my wiki
  }
  
  // Your wikis
  if( (true || page == it.loginPage || it.wiki.isUserWiki())
  && it.hasUser()
  ){
    // Signal User conflict, only in mentoring mode, can be frightening
    var conflict = (it.hasTwoUsers() && it.isMentor) ? "!" : ""
    var label = it.getPlausibleName()
    tools.push( it.linkPage(
      "DoProfile",
      conflict +  '<img src="/yanugred16.png" alt="wikis">',
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
      '<img src="/dropbox_ico.png" alt="dropbox">',
      it.i18n( "Your dropbox") + " (" +  label + ")"
    ))
  }

  // Secret, on member pages of sub wikis mainly
  if( (!it.wiki.isRoot() || !it.isGuest())
  && !it.wiki.isEmpty()
  && !it.wiki.isSandbox // Don't confuse new visitors
  ){
    if( it.getData( page, "code") ){
      if( !page.isUser() ){
        it.bug_de&&bug( "Code in non user page:", page)
      }
      tools.push( it.linkPage(
        "Code" + it.getData( page, "code").capitalize(),
        "secret",
        it.i18n( "Your invitation code")
      ))
    }else if( page == it.loginPage
    //&& !it.loginWithCode
    && !it.user // Don't bother user if she can comeback from DoProfile
    ){
      if( !page.isUser() ){
        it.deep_login_de&&bug( "non user loginPage:", page, "user:", it.loginName)
      }else{
        tools.push( it.linkPage(
          "Code" + it.loginCode.capitalize(),
          "secret",
          it.i18n( "Your invitation code")
        ))
      }
    }
  }

  // Twitter icon
  var twitter = this.user && this.user.getTwitterId()
  if( twitter ){
    // ToDo: I don't know the url to get to twitter with an ID, I use
    // the display name instead
    var name = this.twitterName
    name && tool( HtmlA(
      '<img src="/twitter_ico.png" alt="twitter">',
      'http://twitter.com/' + name,
      it.i18n( "Your Twitter account") + " (" + name + ")"
    ))
  }

  // Facebook icon
  var facebook = this.user && this.user.getFacebookId()
  if( facebook ){
    var name = this.facebookName
    name && tool( HtmlA(
       '<img src="/facebook_ico.png" alt="facebook">',
       'http://www.facebook.com/profile.php?id=' + facebook,
       it.i18n( "Your Facebook account") + " (" + name + ")"
    ))
  }

  // LinkedIn icon
  var linkedin = this.user && this.user.getLinkedInId()
  if( linkedin ){
    // ToDo: I don't know the url to get to linkedin with an ID, I use
    // the display name instead
    var name = this.linkedinName
    name && tool( HtmlA(
      '<img src="/linkedin_ico.png" alt="linkedin">',
      'http://www.linkedin.com/profile/in/' + name,
      it.i18n( "Your LinkedIn account") + " (" + name + ")"
    ))
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
        HtmlA(
         '<img src="/' + provider_ico + '_ico.png" alt="' + provider + '">',
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
    tools.push( it.linkPage( "SignIn"))
  // If special user wiki, display twitter or facebook name
  }else if( it.wiki.isUserWiki() && !it.isDebug ){
    // Some /user/Fxxxx wiki, use twitter name, fb fallback
    var name = it.twitterName || it.facebookName || it.linkedinName || "???"
    if( name ){
      tools.push( "<em>" + name + "</em>" )
    }
  // If "normal" case, display either login name or "home" for entry page
  }else if( !it.isAnonymous() 
  || it.getCurrentPage() != it.loginPage
  ){
    // Display name and link to login page
    var label = it.isAnonymous()
    ? it.i18n( "home") // ToDo: '<img src="/home.png" alt="home">')
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

  // Bye
  tools.push( it.button(
    it.isMentor ? "mentor bye" : "bye",
    it.byeClosure,
    it.isGuest()
    ? SW.domain
    : it.i18n( "sign out") + " (" + it.i18n( it.loginName) + ")"
  ))
  
  // Aa, unless fluid mode or touch device
  if( !it.config.rows == 0
  && !it.isTouch
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
          "A",
          shorterclosure,
          "zoom in (" + it.config.rows + "x" + it.config.cols + ")"
        ))
      }
    }
    if( !page.maxCols || !it.twoColumns ){
      if( it.config.rows < 100 ){
        tools.push( it.button(
          "a",
          tallerclosure,
          "zoom out (" + it.config.rows + "x" + it.config.cols + ")"
        ))
      }
    }
  }
  
  // Help
  if( true || it.isGuest() || page.isHome() || page == it.loginPage ){
    var help_page = it.lookup( "Help" + page.name, "Help" + SW.name)
    tools.push( it.link( 
      help_page,
      "?",
      "Some help, maybe")
    )
  }

  var sep = (it.canScript === true) ? "&#149;" : "|" // "&thinsp;" "&puncsp;" "&ensp;"
  return [
    '\n<div class="header fade" id="header"><div id="header_content">',
    '<div class="top_left">\n',
    tools.join(
      "|"
    ).replace(
      "|center|",
      '</div>\n<div class="top_center" id="top_center">|'
    ).replace(
      "|right|",
      '|</div>\n<div class="top_right">'
    ).replace( /\|/g, sep),
    '\n<a href="#footer">&darr;</a></div></div></div>\n',
    '<div id="unfadder">Menu<a name="top"></a></div>'
  ].join( "")
}


Session.mayFollow = function( peer, away ){
// Tells if This could start following some peer
  if( this.peerSession ){ return false }
  if( !peer ){ return false }
  NDe&&bug( "mayFollow? ", this, " => ", peer)
  if( this == peer ){ return false }
  if( this.follows( peer) ){ return false }
  if( !peer.isThere() && !away ){
    NDe&&bug( "Not there now")
    return false
  }
  if( peer.isAway() && peer.isGone ){
    NDe&&bug( "Gone")
    return false
  }
  if( peer.follows( this) ){ return peer }
  if( peer.isMentor && !this.isMentor ){ return false }
  if( peer.userName() == this.userName() ){ return false }
  return peer
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
  this.post_de&&bug( "Listen for POST, R:", req.deId, " body")
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
    } else if( query.postpage != page.name ){
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
  || (age < 20000 // Protect "attractive" pages even more
    && " SignIn ".includes( " " + page.name + " "))
  ){
    is_spam = true
    page = this.setCurrentPage( this.lookup( "SpamPage"))
    text = text + "\n\n" + "HTTP request:" + Sys.inspect( req.url)
    + "\nHeaders: " + Sys.inspect( req.headers)
  }
  if( that.wiki.name == "c2" ){
    is_spam = true
  }

  var pagename = page.name
  this.fixVisit( page)
  if( !this.canRead( page) ){
    this.bug_de&&bug( "user:", this.userName(), "cannot read:", page)
    this.setCurrentPage( this.lookup( "SignIn"))
    return this.viewForm( req)
  }
  
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
  
  if( !verb || verb_is_cancel ){
    that.setCurrentPage( page)
    return that.viewForm( req)
  }
  
  // ToDo: figure out a better way to discard old post requests
  if( !is_spam
    && this.postExpected != page.name 
    && this.postExpected === false
    && !verb_is_enter
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
    this.de&&bug( "query:", Sys.inspect( query))
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
  
  // Invitation code, either to login or to access a map, or to create a new wiki
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
        if( text !=  "secret"
	&& ( "@".starts( that.userName())
	  || "@".ends(   that.userName())
	  || "In".ends(  that.userName()))
        ){
          text = that.userName()
        }else{
          text = Wiki.random3Code( "-")
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
    that.de&&bug( "verb:", verb, "text:", text)
    // If entering a wiki, defaut to its homepage
    if( verb_is_wiki ){
      if( text && text.indexOf( "/") < 0 ){
        text += "/HomePage"
        // Sanitize again to remove @ in last part of subwiki's name
        text = that.wiki.sanitizePath( text)
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
          this.setData( page, "code", this.loginCode)
        }else{
          // Look for a 3Code. ToDo: idem without separator
          var match = text.match( /3\w\w\.\w\w\w\.\w\w\w$/)
          if( match ){
	    text = match[0]
	    text = text.substr( 0, 3) + text.substr( 4, 7) + text.substr( 8)
            text = "CodeF" + text
            that.setCurrentPage( that.wiki.lookupPage( 
              text ? that.wikinamize( text) : "HomePage"
            ))
            text = ""
	  }else if( "code" == text.substr( 0, "code".length).toLowerCase() ){
	    text = "Code" + text.substr( "code".length).capitalize()
	    that.setCurrentPage( that.wiki.lookupPage( that.wikinamize( text)))
            text = ""
          // Else, maybe it is a Map or a valid page name
          }else{
            if( /\d/.test( text)
            && text.toLowerCase() == text
            ){
              that.setCurrentPage( that.wiki.lookupPage( 
                text ? that.wikinamize( text, "Map") : "HomePage"
              ))
              text = ""
            }
          }
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
                var code = that.getData( userpage, "code")
                // Sanitize
                code = that.wikinamize( "Code" + code.capitalize())
                var to = text
                De&&bug( "Should sent mail here to ", to, ": ", code)
                // ToDo: change to proper "from"
                var from = "info@" + SW.domain
                var subject = that.i18n( "Code")
                var body = [
                  code,
                  firstuser,
                  that.wiki.permalink( userpagename, code),
                  that.wiki.permalink( "HomePage", code),
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
        // Or this is a code
        if( text ){
          // Case insensitive if invitation code
          if( "code". starts( text.toLowerCase()) ){
            text = "Code" + text.substr( "Code".length).capitalize()
          // its a code or a search unless it's a valid page name
          }else if( text != that.wikinamize( text) ){
            var code = "Code" + text.toLowerCase().capitalize()
            // It's not a code if some uppercase letter or no digit
            // Why: good code should be easy (no upper) & safe (digit)
            // ... or weird input with */? maybe
            if( text.toLowerCase()      == text
            && text.replace( /\d/g, "") == text
            && that.wikinamize( code)   == code
            && !/\*?/.test( text)
            ){
              text = "Code" + text.toLowerCase().capitalize()
            // Humm... maybe the user is looking for something... search
            }else{
              text = "DoSearch" + "[" + text + "]"
            }
          }
        }
        that.setCurrentPage( that.wiki.lookupPage(
          text ? that.wikinamize( text) : "HomePage"
        ))
      }
      return that.viewForm( req)
    }
    
    // If sub wiki
    De&&bug( "Go to subwiki ", targetwiki, " on page ", text)
    // ToDo: should logout?
    // I need to warn processHttpRequest() about the fact that the request
    // was partially processed already. This is specially needed
    // for "POST" requests, because the content of body must not
    // be expected twice from the network, it is sent once only obviously
    De&&mand( req.wiki != targetwiki )
    req.wiki = targetwiki
    // req.session = null // However a new session is needed
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
  
  // Use provided name if guest or anonymous mentor
  }else if( !req.logAgain
  && !verb_is_delete
  && ( this.shouldAskForName( page)
    || this.shouldAskForNewMember( page)
    || (!that.isMentor
      && (page.name == "NewPage" || page.name == "NouvellePage"))
    )
  ){
    that.de&&bug( "Looking for a name")
    // Use cookie as default if user blanked the name
    if( !guest && !this.shouldAskForNewMember( page) ){
      var cookies = req.headers.cookie
      if( cookies ){
        var cookied_name
        var match = cookies.match( /sw_name=[@A-Z_a-z0-9\-\/]*/)
        if( match ){
          cookied_name = match[0].substr( "sw_name=".length)
          that.cookie_de&&bug( "cookiedName:", cookied_name)
          if( cookied_name
          &&  cookied_name != "undefined"
          &&  cookied_name != "WikiWord"
          ){
            guest = cookied_name
          }
        }
      }
    }
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
      // Don't handle twitter & facebook names here, too complex, ToDo
      if( "@".starts( guest) || "@".ends( guest) || "In".ends( guest) ){
        // Unless it's the "NewMember" special page
        if( !this.shouldAskForNewMember( page) ){
          guest = "[" + guest.replace( /@/g, "") + "]"
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
              .loginForm( guest, this.loginCode, false, this.canMentor, page, req)
            }else{
              this.de&&bug( "Avoid loop with guest name:", guest)
            }
          }
        }
        guest = ""
      // When anonymous mentor (ie SomeOne) sets her name
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
            return this.loginForm( guest, this.loginCode, false, this.canMentor, page, req)
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
    // Restore deleted page (mentor only)
    De&&bug( "Restore on ", page)
    if( (page.isDeletion() || "Deleted".starts( page.getBody().frontLine()))
    && that.isMentor
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
  
  // I don't want ToDo pages to be modified permanently (unless mentoring)
  if( verb_is_doit ){
    // Let's save the data that the "Do" page needs
    var doit_data = Wiki.extractBasicYaml( text)
    if( doit_data && !that.isMentor && !page.isDraft() ){
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
  // Mentors leave a trace only when stamping a non draft page and
  // doing no other change. i.e. explicitly stamping of stamped page
  if( that.isMentor
  && !(verb_is_stamp && !wasdraft && text == old_text) 
  ){
    should_log = false
    that.deep_session_de&&bug( "No log while mentoring")
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
    if( true // that.canMentor
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
  if( page.isUser() && !that.isMentor && !page.isDraft() ){
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
  // Non user pages (or mentor mode), update data, unless draft
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
    var as_mentor = guest.includes( "Mentor")
    if( as_mentor ){
      guest.replace( / *Mentor */g, "")
    }
    guest = that.usernamize( guest)
    text = text + "\n" + guest + " - " + guest.substr( "User".length)
    var new_user_page = that.lookup( guest)
    if( !that.canMentor ){
      // Create as draft if not mentor
      that.draft( new_user_page, true) // true => force
    }else{
      // OTOH, stamp page if mentor and if page already exists as draft
      if( new_user_page.isDraft() ){
        that.de&&bug( "Stamping new member:", new_user_page)
        that.stamp( new_user_page, true) // true => don't write, putPage will
      }
      // If mentor creating a mentor, add to new mentor to "AboutWiki" page
      if( as_mentor ){
        var mentors = that.getData( wiki.aboutwikiPage, "mentors")
        mentors = (mentors + " " + guest).replace( /^ /, "")
        that.setData( wiki.aboutwikiPage, "mentors", mentors)
        that.wiki.setOptions(
          that.wiki.config,
          {mentors: mentors},
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
      }else{
        that.setCurrentPage( page)
      }
    }
    if( should_log && !that.isGuest() && !page.isDraft() ){
      that.logStamp( page, should_log)
    }
    // Unless draft or "DoIt", add to copy page if asked for
    // or if not done for a long time or if new writer
    // or "big" reduction in page's size, maybe an "error" by the user
    if( (!verb_is_doit && !page.isDraft())
    && (verb_is_copy
      || !age
      || (age > 24 * 60 * 60 * 1000) // Daily
      || page.lastWriter() != that.userName()
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
        that.viewForm( req)
      })
    }else{
      that.viewForm( req)
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
  // Code obfuscation
  msg       = msg.replace(      / Code[A-Z_a-z0-9@#-]+/g, "ObfuscatedCode")
  shouldlog = shouldlog.replace( /Code[A-Z_a-z0-9@#-]+/g, "ObfuscatedCode")
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
  && !page.isCode() // Don't log "secret" codes in RecentStamps!
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
// Also sort by date, recent changes first
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
      // Don't log if mentor or if user is compressing her own changes
      if( !that.isMentor && page.name != that.userName() + "Stamps" ){
        that.logStamp( page, logmsg)
      }
      return cb( err, page)
    })
  })
}

Session.logCode = function( page, name, wiki ){
// Log invitation code in "PrivateCodes" page
// ToDo: should be also a Wiki method
  page = page || "Code" + this.loginCode
  name = name || this.loginName
  wiki = wiki || this.wiki
  // Filter out anonymous guests, too much noise
  // ToDo: should also filter out non anonymous guests?
  // Log inherited code in their wiki, cause subwiki mentors should not see it
  if( !page.includes( ":") && wiki.lookupPage( page).inherited ){
    wiki = wiki.lookupPage( page).inherited.wiki
  }
  if( "Guest".ends( name) )return
  wiki.lookupPage( "PrivateCodes").read( function( err, codepage ){  
    var txt = codepage.getBody()
    if( txt.includes( 
        "Code: " + page
      + "\nMember: " + name
      + "\nDate:"
    )) return
    txt = "Code: " + page
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
      wiki.protoGuest.logCode(
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
  try{
    var loc = window.location
    if( loc.indexOf( "/in") >= 0 ){
      window.sw_comeback = true
    }
  }catch( err ){} 
}

Session.signinScript = function sw_signin(){
// This is client code side that deals with Twitter, Facebook ... signin.
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

window.sw_set_id_cookies = function( srv, id, name, label ){
  sw_set_cookie( srv, "id",         id),
  sw_set_cookie( srv, "screenname", name)
  sw_set_cookie( srv, "label",      label)
}

// Signal to server that client can script all requests
sw_set_cookie( "", "can_script", true)

window.install_signout = function( srv, e ){
  e.append(
    ' <button id="signout' + srv +'" type="button">'
    + "Bye" // Session.i18n( "Sign out")
    + '</button>'
  ).fadeIn( 1500)
  $("#signout" + srv).click( function () {
    if( srv == "tw" ){
      try{ twttr.anywhere.signOut(); }catch( e ){}
      try{ update_tw_login() }catch( e ){}
    }else
    if( srv == "fb") {
      try{ FB.logout() }catch( e ){}
      try{ update_fb_login() }catch( e ){}
    }else
    if( srv = "li") {
      try{ IN.User.logout() }catch( e ){}
      try{ update_li_login() }catch( e ){}
    }
  })
  // Only index.html defines a Session object
  if( typeof Session === 'undefined' )return
  if( Session.config.lang == "fr" ){
    $("#1st").html( "hello !")
    //$("#2nd").empty().append( "&agrave; pr&eacute;sent...")
  }else{
    $("#1st").html( "hello!")
    // $("#2nd").empty().append( "now...")
  }
}

window.install_signin = function(){
  // Only index.html defines a Session object
  if( typeof Session === 'undefined' )return
  if( Session.config.lang == "fr" ){
    $("#1st").html( "optionnel") // "se connecter (optionnel)")
    $("#2nd").html( "") // "puis...")
  }else{
    $("#1st").html( "optional") //"maybe tell who your are (optional)")
    $("#2nd").html( "") // "then...")
  }
}

window.update_tw_login = function( T ){
  
  var is_in = !!T.isConnected()
  // Do nothing if no change (note the !==, important at init time)
  if( is_in === window.sw_logged_in_twitter )return

  var id
  var screenName
  var label
  var profileImage = ""

  if( is_in ){
    id         = T.currentUser.data( 'id_str') || T.currentUser.data( 'id')
    screenName = T.currentUser.data( 'screen_name').toLowerCase()
    label      = T.currentUser.data( 'name')
    sw_set_id_cookies( "twitter", id, screenName, label)
    // ToDo: signature
    // Display image on index.html only, too much noise otherwise
    if( window.sw_is_index ){
      profileImage = T.currentUser.data( 'profile_image_url')
      profileImage = "<img src='" + profileImage + "'/> "
    }
    install_signout( "tw", $('#tw-login').fadeOut( 0).html( ""
      + profileImage
      + '@<a href="/' + screenName + '">' + screenName + "</a>"
      // + " (" + label + ")"
    ))
    // ToDo: Should set the value of the "wiki!" form to @xxxx
  }else{
    sw_set_id_cookies( "twitter")
    // Empty div but avoid flicker, 26px is the height of Twitter's button
    $("#tw-login").html( '<span style="min-height:26px"> </span>')
    T( "#tw-login").connectButton()
    install_signin()
  }

  // ToDo: I need to reload the page?
  if( typeof window.sw_logged_in_twitter === 'undefined' ){
    // Initial display
  }else{
    if( window.sw_logged_in_twitter != is_in ){
      // Changed
      if( is_in && typeof Session === 'undefined' && sw_is_anonymous ){
        // Reload the page to provide up to date view, unless index.html
        window.location = ""
        location.reload( true)
      }
    }
  }
  window.sw_logged_in_twitter = is_in
}

window.sw_twitterOnLoad = function sw_twitterOnLoad(){
  twttr.anywhere( function( T ){ 
    T.bind( "authComplete", function( e, user ) {
      // triggered when auth completed successfully
      update_tw_login( T)
    })
    T.bind("signOut", function (e) {
      // triggered when user logs out
      update_tw_login( T)
    })
    update_tw_login( T)
  })
}


window.update_fb_login = function( S ){
// See http://fbrell.com/

  S || (S = FB.getSession())
  var is_in = !!S
  // Do nothing if no change (note the !==, important at init time)
  if( is_in === window.sw_logged_in_facebook )return

  var screenName
  var label
  var async_reload = false

  if( is_in ){
    FB.api( "/me", function( response ){
      var link = response.link
      if( !link ){
        window.console && console.log
        && console.log( "No link in response") && console.log( response)
        return
      }
      var ii = link.lastIndexOf( "/")
      screenName = link.substr( ii + 1).toLowerCase()
      // For user without a profile
      if( (ii = screenName.indexOf( "id=")) >= 0 ){
        screenName = "id" + screenName.substr( ii + "id=".length)
      }
      label = response.name
      sw_set_id_cookies( "facebook", response.id, screenName, label)
      if( window.sw_is_iframe
      &&  window.sw_is_index
      && !window.sw_comeback
      && !window.sw_logged_in_twitter // Avoid landing with bad id
      ){
        // I get here when user logs in using the SimpliWiki fb canvas app
        // ToDo: and also when using /with.google
	sw_set_cookie( "facebook", "iframe", "true")
        // console.log( "fb reload:" + window.location)
	try{
	  window.location = "/" + screenName + "@/User" + screenName + "@"
	  // window.location.reload( true) -- don't do that, breaks
	  return
	}catch( err ){
	  De&&bug( "Can't change location, err: " + err)
	}
      }
      if( async_reload ){
         // Reload the page to provide up to date view
         // console.log( "asynch reload")
         window.location = ""
         window.location.reload( true)
	 return
      }
      install_signout( "fb", $('#fb-login').fadeOut( 0).html( ""
        + (window.sw_is_index
          ?   '<fb:profile-pic uid="loggedinuser" linked="true">'
	    + '</fb:profile-pic> '
          : "")
	+ '<a href="/' + screenName + '@">' + screenName + '@</a>'
	//+ " (" + label + ")"
      ))
      FB.XFBML.parse() // document.getElementById( 'fb-login'))
    })

  }else{
    sw_set_id_cookies( "facebook")
    $("#fb-login").html(
      '<fb:login-button size="medium" autologoutlink="true">'
      + 'Connect with Facebook' // Session.i18n( 'Connect with Facebook')
      + '</fb:login-button>'
    )
    install_signin()
    FB.XFBML.parse( document.getElementById( 'fb-login'))
  }

  // ToDo: I need to reload the page
  if( typeof window.sw_logged_in_facebook === 'undefined' ){
    // Initial display
  }else{
    if( window.sw_logged_in_facebook != is_in ){
      // Changed
      if( is_in && typeof Session === 'undefined' && sw_is_anonymous ){
        // I will reload the page to provide an up to date view
        async_reload = true
      }
    }
  }
  window.sw_logged_in_facebook = is_in
}

window.fbAsyncInit = function() {
  // $("#fb-login").html( '<fb:login-button></fb:login-button>')
  // update_fb_login( FB.getSession())
  FB.init({
    appId  : sw_fbid,
    status : true, // check login status
    cookie : true, // enable cookies to allow the server to access the session
    xfbml  : false, // parse XFBML, false, done in update_fb_login
    // ToDo: double check Expires headers and caching by browser
    channelUrl  : 'http:/'+'/simpliwiki.com/channel.html'  // custom channel
  })
  FB.Event.subscribe( 'auth.sessionChange', function( response ){
    update_fb_login( response.session)
  })
  FB.getLoginStatus( function( response ){
    update_fb_login( response.session)
  })
}


// LinkedIn

IN = {}

window.update_li_login = function(){
// See http://fbrell.com/

  var is_in = IN.isIn && IN.User.isAuthorized()
  // Do nothing if no change (note the ===, important with "undefined")
  if( IN.isIn === window.sw_logged_in_linkedin )return

  var id
  var screen_name
  var label
  var async_reload = false

  if( is_in  ){
    IN.API.Profile( "me").fields(
      "id", "firstName", "lastName", "pictureUrl",
      "public-profile-url"
      // ToDo: "twitter-accounts"?
    ).result( function( result ){
      var user = result.values[0]
      id          = user.id
      screen_name = user["publicProfileUrl"] || ("/id" + id)
      var ii = screen_name.lastIndexOf( "/")
      screen_name = screen_name.substr( ii + 1).toLowerCase()
      label       = user.firstName + " " + user.lastName
      sw_set_id_cookies( "linkedin", id, screen_name, label)
      if( window.sw_is_iframe
      &&  window.sw_is_index
      && !window.sw_comeback
      && !window.sw_logged_in_twitter // Avoid landing with bad id
      ){
        // I get here when user logs in using the SimpliWiki fb canvas app
        // ToDo: and also when using /with.google
	sw_set_cookie( "linked", "iframe", "true")
        // console.log( "fb reload:" + window.location)
	try{
	  window.location = "/" + screen_name + "In/User" + screen_name + "In"
	  // window.location.reload( true) -- don't do that, breaks
	  return
	}catch( err ){
	  De&&bug( "Can't change location, err: " + err)
	}
      }
      if( async_reload ){
         // Reload the page to provide up to date view
         // console.log( "asynch reload")
         window.location = ""
         window.location.reload( true)
	 return
      }
      install_signout( "li", $('#li-login').fadeOut( 0).html( ""
        + (window.sw_is_index
          ?   '<img src="' + user["pictureUrl"] + '"/>'
          : "")
	+ '<a href="/' + screen_name + 'In">' + screen_name + 'In</a>'
	//+ " (" + label + ")"
      ))
      // Manage tags. ToDo: parse less
      IN.parse( document.body)
    })

  }else{
    sw_set_id_cookies( "linkedin")
    $("#li-login").html(
      '<script type="IN/Login"'
      + ' data-onAuth="sw_linkedinIn" data-onLogout="sw_linkedinOut"'
      + '></script>'
    )
    install_signin()
    // Manage tags. ToDo: parse less
    IN.parse( document.body)
  }

  // ToDo: I need to reload the page
  if( typeof window.sw_logged_in_linkedin === 'undefined' ){
    // Initial display
  }else{
    if( window.sw_logged_in_linkedin != is_in ){
      // Changed
      if( is_in && typeof Session === 'undefined' && sw_is_anonymous ){
        // I will reload the page to provide an up to date view
        async_reload = true
      }
    }
  }
  sw_logged_in_linkedin = is_in
}

window.sw_linkedinOnLoad = function sw_linkedinOnLoad(){
  // de&&bugC( "linkedin loaded") 
  IN.isIn = false
  IN.Event.on( IN, "auth",   sw_linkedinIn)
  IN.Event.on( IN, "logout", sw_linkedinOut)
  update_li_login()
}
window.sw_linkedinIn = function(){
  // de&&bugC( "linkedin login")
  IN.isIn = true
  update_li_login()
}
window.sw_linkedinOut = function(){
  // de&&bugC( "linkedin logout")
  IN.isIn = false
  update_li_login()
}


var sw_footer_was_displayed         = false
var sw_login_buttons_were_displayed = false

window.onFooterDisplay = function( force, brutal ){
// Inits stuff about facebook & twitter that are better avoided at first
// Called when footer part of page may become visible.
// Also called in index.html

  // If brutal, I show the footer and make it stay visible
  // This is usefull in the "SignIn" page
  if( brutal ){
    $('#footer').fadeTo( 0, 1).removeClass( "fade")
  }

  // Do stuff once only
  if( sw_footer_was_displayed
  && sw_login_buttons_were_displayed
  )return

  // Code to load some scripts, async, after a small delay, maybe
  (  sw_fbid
  || sw_twid
  || sw_likey
  || window.sw_onetruefan
  || window.sw_shareaholic
  || window.sw_fb_like_button_href)
  && setTimeout( function(){
    // If still visible, load
    if( !force && !$("#footer").is(":visible") )return
    // If login buttons are visible, load (always load when in index.html)
    var $buttons = $('#login-buttons')
    de&&bugC( "buttons: " +  $buttons.size())
    if( $buttons.size()
    && ($buttons.is(":visible") || brutal)
    ){
      // Load twitter connect
      sw_twid && loadfire.event( function( fire ){
        if( !window.sw_twitterOnLoad )return
        fire.load(
          "http://platform.twitter.com/anywhere.js?id=" + sw_twid + '&v=1'
        ).event( function( fire ){
          // Call sw_twitterOnLoad once loaded
          if( !window.twttr )return
          sw_twitterOnLoad()
          return true
        })
        return true
      })
      // Load facebook connect
      if( typeof sw_lang === "undefined" ){ sw_lang = "en" }
      var lang = (sw_lang == "fr") ? "fr" : "en_US"
      // Will call fbAsyncInit() when loaded
      sw_fbid && loadfire( document.location.protocol
        + '/' + '/connect.facebook.net/' + lang + '/all.js'
      )
      // Load linkedin connect
      sw_likey && loadfire.event( function( fire ){
        if( !window.sw_linkedinOnLoad )return
        var content = "\n  api_key: " + sw_likey
        + "\n  onLoad: sw_linkedinOnLoad\n  authorize: true\n"
        // Will call sw_linkedinOnLoad when loaded
        fire.load( "http://platform.linkedin.com/in.js>" + content)
        var found = false
        return true
      })
      sw_login_buttons_were_displayed = true
    }
    if( !sw_footer_was_displayed ){
      // Load ontruefan
      window.sw_onetruefan
      && loadfire( "http://e.onetruefan.com/js/widget.js")
      // Load shareaholic
      window.sw_shareaholic
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
      sw_footer_was_displayed = true
    }
  }, brutal ? 1 : 1000) // setTimeout()
}

}

Session.xfbmlScript = function sw_xfbml(){

window.fbAsyncInit = function() {
  // $("#fb-login").html( '<fb:login-button></fb:login-button>')
  // update_fb_login( FB.getSession())
  FB.init({
    appId  : sw_fbid,
    status : true, // check login status
    cookie : true, // enable cookies to allow the server to access the session
    xfbml  : true, // parse XFBML
    // ToDo: double check Expires headers and caching by browser
    channelUrl  : 'http:/'+'/' + sw_domain + "/channel.html"  // custom channel
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
  (sw_fbid
  || sw_likey
  || window. sw_onetruefan
  || window.sw_shareaholic
  || window.sw_fb_like_button_href)
  && setTimeout( function(){
    if( !force && !$("#footer").is(":visible") )return
    sw_footer_was_displayed = true
    // Load facebook connect (for fb_like button only)
    if( typeof sw_lang === "undefined" ){ sw_lang = "en" }
    var lang = (sw_lang == "fr") ? "fr" : "en_US"
    sw_fbid && loadfire( document.location.protocol
    + '/' + '/connect.facebook.net/' + lang + '/all.js')
    // Load ontruefan
    window.sw_onetruefan
    && loadfire( "http://e.onetruefan.com/js/widget.js")
    // Load shareaholic
    window.sw_shareaholic
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
// Return html code to login using a secret code (or twitter/facebook)
// Return "" if client can't script or current page is inadequate

  page = (page || this.getCurrentPage())

  // This does not play well with angular, the login-buttons are displayed,
  // as if user had clicked on "SignIn", so... avoid the section altogether
  // when page uses angular. ToDo: figure out what is happening
  if( page.needsAngular() )return ""

  var buf            = '<div id="login">'
  var postclosure_id = this.postClosureId

  // Don't inject "SignIn" if alreay on that page. As a result the buttons
  // don't get hidden when page loads and onFooterDisplay() loads the proper
  // javascript scripts.
  var sign_in_page = this.lookup( "SignIn")
  if( page != sign_in_page ){
    buf += this.link( sign_in_page, this.i18n( "SignIn"), "click")
  }

  // If either known to be able to script or even "maybe"
  if( this.canScript ){
    buf += '<div id="login-buttons">'
    SW.fbid  && (buf += '<div id="fb-login">Facebook... <img src="/facebook.gif" /></div>')
    SW.twid  && (buf += '<div id="tw-login">Twitter... <img src="/twitter.gif" /></div>')
    SW.likey && (buf += '<div id="li-login">LinkedIn... <img src="/linkedin.gif" /></div>')
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
  var title
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
  if( !this.isMentor ){ content += "\n" + logmsg }
  NDe&&bug( "Restore ", page, ", using ", content)
  var that = this
  this.putPage( page, content, function( err ){
    if( !this.isMentor ){
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
  
  var verb   = query["do"]
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

  function respond(){
    that.respond( req, result, "text/javascript")
  }

  function respondJson(){
    result = JSON.stringify( result)
    if( query.jsonp ){
      result =  query.jsonp + "(" + result + ")"
    }
    respond()
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

// ---------------
// section: api.js

Session.apiScript = function sw_api( cid, url, _$ ){
// Client side OR server side (NodeJS)
// ToDo: make it cross domain, see http://saunter.org/janky.post/

  // ToDo: avoid global scope
  var scope = (typeof window !== "undefined" && window) || global

  // No JSON? I get by, it's only about a hash of strings
  var json = JSON
  if( !json.parse ){
    json = {
      parse: function( x ){ return eval( "(" + x + ")") }
      ,stringify: function( hash ){
        var buf = []
        for( var key in hash ){
           buf.push(
             strings[key]
             + ':"'
             + hash[key]
               .replace( /\//g, '\\')
               .replace( /"/g,  '\"')
               .replace( /\n/g, "\\n")
             + '"'
           )
        }
        // Et voila
        return "{" + buf.join( ",") + "}"
      }
    }
  }

  // Cache to avoid useless reads
  scope.sw_page_cache = {}

  url || (url = "/rest")
  if( cid == "anonymous" ){
    cid = 0
  }else if( !cid ){
    if( typeof sw_rest_cid !== "undefined" ){
      cid = sw_rest_cid
    }else{
      cid = 0
    }
  }

  function my$(){
    _$ || (_$ = (typeof $ !== "undefined" && $))
    if( _$ && _$.get )return _$
    // If no asynchronous getter... provide one, basic, server side only
    // ToDo: handle success/error
    //De&&bug( "Defining _$, with a .get()")
    _$ = { get: function( url, req, cb ){
      De&&bug( "_$.get() called, url:", url)
      // Split url into protocol/domain/port/uri
      var protocol = ""
      var ii  = url.indexOf( "://")
      var uri = url
      if( ii > 0 ){
        protocol = url.substr( 0, ii)
        uri  = url.substr( ii + "://".length)
      }
      var domain = uri
      var jj = uri.indexOf( "/")
      if( jj > 0 ){
        domain = uri.substr( 0, jj)
        uri    = uri.substr( jj)
      }else{
        uri    = "/"
      }
      var port   = "80"
      ii = domain.indexOf( ":")
      if( ii > 0 ){
        port   = domain.substr( ii + 1)
        domain = domain.substr( 0, ii)
      }
      // ToDo: this works on nodejs only...
      uri += "?" + require( "querystring").stringify( req)
      De&&bug( "sw_api, domain:", domain, "port:", port, "uri:", uri)
      // ToDo: use new Http Client library, v 0.4
      var http = require( "http").createClient( port, domain)
      var request = http.request(
        "GET",
        uri,
        {
          "Host": domain,
          "User-Agent": "SimpliWiki HTTP Client"
        }
      )
      var body = ""
      request.addListener( 'response', function( response ){
        response.addListener( 'data', function( chunk ){
          NDe&&bug( "Fetched some remote chunk, length: ", chunk.length)
          body += chunk
        })
        response.addListener( 'end', function(){
          body = body.replace( /\r/g, "")
          De&&bug( "sw_api, response:", body)
          cb( body, 200)
        })
      })
      .addListener( 'error', function(){
        // ToDo: better error handling
        return cb( '{"status":500}', 500)
      })

      request.end()
    } }
    return _$
  }

  function parse_result( d, name ){
    try{
      d = json.parse( d)
      if( name ){
        scope.sw_page_cache[name] = d
      }
      if( d.data ){
        d.data = json.parse( d.data)
      }
    }catch( err ){
      d = {status: 500}
    }
    return d
  }

  var api = {

  getPageRequest: function sw_getPageRequest( name ){
    return {
      url: url,
      cid: cid,
      do: "getPage",
      name:name
    }
  },

  putPageRequest: function sw_putPageRequest( name, body, data ){
    return {
      url:  url,
      cid:  cid,
      do:   "putPage",
      name: name,
      body: body,
      data: data ? json.stringify( data) : null
    }
  },

  appendPageRequest: function sw_putPageRequest( name, body, data ){
    return {
      url:  url,
      cid:  cid,
      do:   "appendPage",
      name: name,
      body: body,
      data: data ? json.stringify( data) : null
    }
  },

  getPage: function sw_getPage( name, cb ){
    var cache = scope.sw_page_cache[name]
    var that  = this
    if( cache ){
      this.de&&bug( "_$.get(), cached:", name)
      setTimeout( function(){
        cb.call( that, cache)
      }, 1)
      return
    }
    var req = api.getPageRequest( name)
    var url = req.url
    delete req.url
    this.de&&bug( "_$.get()...")
    return my$().get( url, req, function( d, t, x ){ 
      cb.call( that, parse_result( d, name), t, x)
    })
  },

  clearPageCache: function( name ){
    if( name ){
      delete scope.sw_page_cache[name]
    }else{
      scope.sw_page_cache = {}
    }
  },

  putPage: function sw_putPage( name, body, data, cb ){
    var that = this
    var req  = api.putPageRequest( name, body, data)
    var url  = req.url
    api.clearPageCache( name)
    delete req.url
    return my$().get( url, req, function( d, t, x ){
      cb.call( that, parse_result( d, name), t, x)
    })
  },

  appendPage: function sw_putPage( name, body, cb ){
    var that = this
    var req  = api.appendPageRequest( name, body)
    var url  = req.url
    api.clearPageCache( name)
    delete req.url
    return my$().get( url, req, function( d, t, x ){
      cb.call( that, parse_result( d, name), t, x)
    })
  },

  getSession: function sw_getSession(){
    if( typeof sw_login === "undefined" ){
      sw_rest_cid = 0
      return sw_session = {
        login: "ApiCLientGuest",
        cid: 0,
        anonymous: true
      }
    }
    return sw_session = {
      login:     sw_login,
      page:      sw_page,
      lang:      sw_lang,
      cols:      sw_cols,
      rows:      sw_rows,
      cid:       sw_rest_cid,
      anonymous: sw_is_anonymous,
      visitors:  sw_visitors,
      oembed:    sw_oembed,
      iframe:    sw_iframe,
      address:   sw_address,
      debug:     De
    }
  }
  }
  return sw_do = api
}

// section: end api.js


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

  // If session is closed, I actually clear all these cookies
  var age = this.isGone ? 0 : 365 * 24 * 60 * 60
  var lasts = ""
  + ";expires=" + (new Date( Sw.timeNow + age * 1000)).toGMTString()
  + ";max-age=" + age
  + ";domain=" + "." + SW.domain // ToDo: handle premium domains
  + ";path=/;HttpOnly" // Prevent some XSS attacks

  // Don't clear cookies about anonymous wikis that are difficult to retrieve
  if( this.isGone ){
    if( !this.user
    && this.canMentor
    && !this.wiki.isEmpty()
    && this.wiki.isAnonymous()
    )return
  }

  function push_cookie( name, value ){
    if( !age ){ value = "null" }
    http_headers.push( ["Set-Cookie", name + '=' + value + lasts])
  }
  
  // Per wiki code
  // ToDo: cipher code
  push_cookie( this.wiki.codeCookieName(), this.loginCode)
  // Last code, makes it easier to move from wiki to wiki with same code
  // ToDo: is this still usefull?
  push_cookie( "sw_last_code", this.loginCode)
  // Title, when available
  var title = this.wiki.getTitle( this)
  if( title ){
    push_cookie(
      "sw_title_" + this.wiki.codeCookieName(),
      encodeURIComponent( title)
    )
  }
  // Page, for /comeback
  // Don't make it easy to get back to special pages, this is disturbing
  // ToDo: fix this when user comes back, not here
  push_cookie( "sw_page", this.wiki.fullname() + this.getCurrentPage().name)
  // Name, usefull to provide a plausible name when anonymous user posts
  if( !age || !this.isAnonymous() ){
    push_cookie( "sw_name", this.userName())
  }
  // ToDo: If logging out, forget the twitter & facebook names and ids?
  // If I clear these cookies, this interferes with other sessions that used them.
  // ie, when user gets back to such a session she is detected as not logged in and
  // is logged again but as a guest, because the script that could restore the cookies
  // has had no opportunity to run on the client side yet...
  // See the handling of /in special page.
  if( !age && !this.isComingBack ){
    this.cookie_de&&bug( "Removing cookies about facebook & twitter")
    push_cookie( "sw_twitter_screenname")
    push_cookie( "sw_twitter_id")
    push_cookie( "sw_twitter_label")
    push_cookie( "sw_facebook_screenname")
    push_cookie( "sw_facebook_id")
    push_cookie( "sw_facebook_label")
    push_cookie( "sw_linkedin_screenname")
    push_cookie( "sw_linkedin_id")
    push_cookie( "sw_linkedin_label")
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
  
  // For logged user, we keep the login code in a cookie for a little while...
  if( !nocookies ){ this.pushCookies( headers) }
  
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

Session.html = function( page, title, body, editclosure ){
// Build THE html page

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
    '<meta name="viewport" content="width=device-width">', // iPhone
    "<title>", title, "</title>"
  )

  // Styles
  if( !ishtml ){
    head && buf.push(
      '<link rel="shortcut icon" href="/yanugred16.png" type="image/png"/>'
    )
    // Google fonts
    head && stylesheets.push(
      'http://fonts.googleapis.com/css?family=Droid+Sans|Droid+Sans:bold',
      'http://fonts.googleapis.com/css?family=Droid+Sans+Mono|Droid+Sans+Mono:bold'
    )
    // CSS, default, inlined in "inline" debug mode
    if( this.inline_de ){
      stylesheettxt.push( Sw.style)
    }else{
      stylesheets.push( "/simpliwiki.css")
    }
    // If config specified additionnal style, at wiki or user level
    var style = this.wiki.config.cssStyle
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
        this.de&&bug( "user config cssStyle:", style)
      }
      if( style ){
        this.de&&bug( "css:", style)
      }
    }
    if( style && style != "noStyle" && !this.isMentor ){
      if( !SW.wikiword( style) ){
        this.de&&bug( "external css, url:", style)
        style = Wiki.htmlizeAttr( style)
        if( is_less ){
          // Check if lesscss.org was installed
          if( !Less ){
            that.de&&bug( "Cannot Less on url:", style)
          }else{
            buf.push( 
              "<link "
              + 'rel="stylesheet/less" href="', style,'" type="text/css"'
              + "/>"
            )
            javascript.push( "less.js")
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
                this.de&&bug( "css, first visit, name:", style_page)
              })
            }
            // Use default, will use config specified next time if possible
            // See also "fetch" option in setOptions()
            // ToDo: I could add the page to the fetch option automatically...
            style = null
          }else{
            this.de&&bug( "using css, page:", style)
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
          this.de&&bug( "no css for page:", page)
          style = null
        }
      }
    }
  }

  // Markdown?
  if( page && page.isMarkdown() ){
    javascript.push( "markdown.js")
  }

  // Angular's script loading?
  var is_angular    = !this.isMentor && page && page.isAngular()
  var needs_angular = !this.isMentor && page && page.needsAngular()
  var sync_jquery   = needs_angular

  // If I load angular.js before jQuery, it does not work well
  // That's probably because of some bad interaction with Angular's
  // own definition of $ via some jQueryLite trickery
  // ToDo: I added sync_jquery since that
  function sw_load_angular(){
    if( sw_page_needs_angularize ){ loadfire( "sw_angularize.js") }
    loadfire().event( function( fire ){
      if( !fire.did( "jQuery") )return
      fire.load( "angular.js")
      return true
    })
  }
  // On DoAngular page, ToDo pages and "angular" tagged pages
  if( needs_angular ){
    // Load angular && maybe sw_angularize(), will run when in .ready()
    javascripttxt.push(
      "var sw_page_uses_angular = true\n"
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
      '<div><a href="http://virteal.com/">&copy;2006-2011 Virteal</a></div>',
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
      '<!-- Copyright (c)2006 Site Meter --></div>',
      '<script src="http://track3.mybloglog.com/js/jsserv.php?mblID=2007020914290638"></script> ',
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
    !needs_angular && javascript.push( "sw_api.js; sw_api()")
    if( true || !this.isTouch ){
      // My scroll cue hack
      javascript.push( "sw_scrollcue.min.js")
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
      javascript.push( "codemirror.js")
    }
    // Shareaholic script configuration
    if( shrsb ){
      // This one will dynamically load jquery.shareaholic-publishers-api.min.js
      // which is a copy of
      // http://blog.shareaholic.com/wp-content/plugins/sexybookmarks/spritegen/media/
      // ... /js/jquery.shareaholic-publishers-api.min.js
      // ToDo: I should to this only when footer is shown
      // ToDo: ?use http://code.google.com/apis/loader/ or head.js

      stylesheets.push( "/shr-style.css")
      javascripttxt.push(
        'var SHRSB_Globals = {src:""}, SHRSB_Settings = {};',
        'var sw_shareaholic = true'
      )
      // ToDo: I should do that in onFooterDisplay, as I may never need it
      false && javascript.push( "shareaholic-publishers.min.js")
    }
    // Do some wikify client side when possible
    if( !"on_rfc".starts( page.name) ){
      javascript.push( "sw_wikify.js")
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
      '<script src="sw_load.js"></script>',
      '<script type="text/javascript">',
      'var sw_time_loaded = (new Date()).getTime()',
      javascripttxt.join( "\n"),
      sync_jquery
      ? '</script>\n<script src="'
       + 'https://ajax.googleapis.com/ajax/libs/jquery/1.5.0/jquery.min.js'
       + '"></script>\n<script type="text/javascript">'
       + 'loadfire.fire( "jQuery")'
      : '\nloadfire( "jquery", "google")',
      !needs_angular ? ""
      : '</script>\n<script src="'
       + 'sw_api.js'
       + '"></script>\n<script type="text/javascript">'
       + 'loadfire.fire( "sw_api")'
    )
    javascript.forEach( function( src ){
      buf.push( '.load("' + src.replace( /"/g, '\\"') + '")')
    })
    buf.push( '</script>')
  }
  if( head ){
    buf.push( '</head><body', visible, '>')
  }else{
    buf.push( '<div id="simpliwiki">')
  }

  // Add pending notifications & "in page" notifications ("notify" directive)
  var notifications = this.pullNotifications()
  var in_page_notifications = page.data && page.data.notify
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
    var last_wikified
    for( var ii in notifications ){
      var msg = notifications[ii]
      // Skip details
      if( "(".starts( msg) && !this.isDebug )continue
      count++
      list.push(
          "<li>"
        + (last_wikified = this.wikify( notifications[ii]))
        + "</li>"
      )
    }
    if( count > 1 ){
      buf.push( 
       '<div id="sw_notifications" class="sw_boxed"><ul>'
       + list.join( "\n").replace( "<li></li>", "</ul><br><ul>")
       + "</ul></div>"
      )
    }else if( count ){
      buf.push(
        '<div id="sw_notifications" class="sw_boxed">'
        + last_wikified
        + "</div>"
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


// section: i18n.js

Sw.i18n = {
  en: {
    "Original wiki": "The origine of this cloned micro wiki",
    "SomeGuest":  "a visitor",
    "Some(guest)": "a visitor",
    "SomeOne":    "a member",
    "UserSome":   "someone",
    "SignIn":     "sign in",
    "AboutWiki": "wiki settings",
    "il y a ":    " ",
    "il y a environ ": "about ",
    "HomePage":   "Welcome",
    "DoVisits":   "Recent visits",
    "DoMembers":  "Members",
    "DoDrafts":   "Drafts",
    "DoDraftsAndCodes":
                  "Drafts & draft codes",
    "DoProfile":  "Your wikis",
    "PrivateCodes":
                  "Invitation codes",
    "DoBye":      "Sign off (from this wiki only)",
    "DoByeBye":   "Sign off (from all wikis)",
    "DoListLogin": "Session's history",
    "UserSomeGuest": "Welcome visitor",
    "trash":      "restore",
    " stamps":    " changes",
    "stamps":     "changes",
    "Invitation code": "invitation code or page's name", // "email address",
    //"err:locked":  "HelpLockedPage",
    "err:locked":  "SignIn",
    "err:read":    "HelpReadError",
    "err:write":   "HelpWriteError",
  },
  fr: {
    "HomePage":     "Acceuil",
    "home":         "acceuil",
    "SomeGuest":    "un quidam",
    "Some(guest)":  "un quidam",
    "SomeOne":      "un membre",
    "UserSome":     "un visiteur",
    "UserSomeGuest": "Acceuil visiteur",
    "AboutWiki":    "options wiki",
    "DoVisits":     "Visites r&eacute;centes",
    "DoMembers":    "Membres",
    "DoDrafts":     "Ebauches",
    "DoDraftsAndCodes":
                    "Ebauches & codes temporaires",
    "DoProfile":    "Vos wikis",
    "PrivateCodes": "Codes d'entr&eacute;e",
    "DoListLogin":  "Diagnostic de connexion",
    "DoBye":        "D&eacute;connexion (de ce wiki seulement)",
    "DoByeBye":     "D&eacute;connexion (de tous les wikis)",
    "InvitationCode": "Code d'entr&eacute;e",
    "RecentStamps": "Changements r&eacute;cents",
    "il y a ":      "il y a ",
    ":":            " : ",      // French rule
    "Original wiki":"Wiki d'origine",
    "Help":         "Aide",
    "SignIn":       "connexion",
    "sign in":      "connexion",
    "Some help, maybe": "Un peu d'aide, sans garantie",
    "LookedPage":   "Page ferm&eacute;",
    "SignIn":       "Signer",
    "Cancel":       "Revenir",
    "edit":         "&eacute;crire",
    "Edit ":        "Changer ",
    "Draft":        "Ebauche",
    "a draft":      "une &eacute;bauche",
    "trash":        "r&eacute;tablir",
    "Come back":    "Revenir",
    "Delete":       "Vider",
    "History":      "Historique",
    "Restore":      "R&eacute;tablir",
    "restore":      "r&eacute;tablir",
    "<em>Restore</em>":      "<em>R&eacute;tablir</em>",
    "Invitation code": "Code d'entr&eacute;e ou nom d'une page", // "adresse email",
    "sign out":     "partir",
    "Enter":        "Entrer",
    "switch to 'mentoring' mode": "passer en mode 'Mentor'",
    "Some tools for power users":
      "Quelques outils 'avanc&eacute;s'",
    "just now":     "juste maintenant",
    "This wiki's title maybe: ": "Le titre de ce wiki peut-&ecirc;tre : ",
    "Your name maybe: ": "Votre nom peut-&ecirc;tre : ",
    "by ":          "par ",
    "you":          "vous",
    "an empty page":"une page vide",
    "about you":    "vous concernant",
    "a guest":      "un visiteur",
    " members":     " membres",
    "1 member":     "un membre",
    "by ":          "par ",
    "Some active cloned micro wikis":
    "Quelques autres micro wiki actifs",
    "Some recent visitors": "Quelques visiteurs r&eacute;cents",
    "Some recent visiting members":
    "Quelques membres visiteurs",
    "a member":     "un membre",
    "gone":         "parti",
    "active":       "actif",
    "visits":       "visites",
    "Visits:":      "Visites :",
    " seconds ago": " secondes",
    "1 minute ago": "il y a une minute",
    " minutes ago": " minutes",
    "about an hour ago":   "il y a une heure et quelque",
    " hours ago":   " heures",
    "yesterday":    "hier",
    " days ago":    " jours",
    " weeks ago":   " semaines",
    " months ago":  " mois",
    "a page last visited by ": "une page visit&eacute;e par ",
    "a page visited ": "une page visit&eacute;e ",
    "Send":        "Envoie",
    "Guest":       "Visiteur",
    "guest":       "visiteur",
    "(guest)":     "(visiteur)",
    "Copy":        "Copie",
    "Archive":     "Archiver",
    "Visit ":      "Visite : ",
    "Go to previous page": "Retour vers la page d'avant",
    "back":        "retour",
    "Links:":      "Liens : ",
    "Web address: ": "Adresse web : ",
    "drag this":   "faire glisser",
    "Share:":       "Partager :",
    "Comment: ":    "Commmentaire : ",
    "Comment":      "Commmenter",
    "write your text on the page": "&eacute;crire sur la page",
    ", maybe":     ", qui sait ?",
    "Another micro wiki, maybe": "Un autre micro wiki ?",
    "Another micro wiki, your personal one, maybe":
    "Un autre micro wiki, le votre ?",
    "Home":        "Acceuil",
    "This micro wiki's home page": "La page d'acceuil de ce wiki",
    "stamp":       "signer",
    "stamps":      "modifs",
    " stamps":     " modifs",
    "Some recently stamped pages":
    "Quelques pages sign&eacute;es r&eacute;cemment",
    " drafts":     " &eacute;bauches",
    "1 draft":     "1 &eacute;bauche",
    "Some recent draft changes":
    "Quelques pages chang&eacute;es r&eacute;cemnent",
    "zoom in":    "afficher en plus gros",
    "zoom out":   "afficher en plus petit",
    "Some pages you changed recently in this micro wiki":
    "des pages que vous avez modifi&eacute;es r&eacute;cemment"
    + " dans ce micro wiki",
    "Follow":      "Suivre",
    "Pair":        "A deux",
    "Some page":   "Une page",
    "Some peer, last seen ": "Un autre visiteur, actif ",
    "a draf":      "une &eacute;bauch",
    "an empty page": "une page blanche",
    "blank page":  "page blanche",
    "Unpair":      "Quitter",
    "Unfollow":    "Quitter",
    "add your name to this page": "ajouter votre nom sur cette page",
    "remove draft changes, restore stamped original page":
      "enlever les modifications, revenir vers l'original",
    "restore page content using this copy":
      "r&eacute;tablir le contenu de la page en utilisant cette copie",
    "your personal page": "votre page personnelle",
    "Your personal page in this wiki":
      "Votre page dans ce wiki",
    "'invitation code' for ":
      "'code d'entr&eacute;e' pour ",
    "Your invitation code":
      "Votre code d'entr&eacute;e",
    "in your personal Facebook wiki":
      "dans votre wiki Facebook personnel",
    "in your personal LinkedIn wiki":
      "dans votre wiki LinkedIn personnel",
    "in your personal Twitter wiki":
      "dans votre wiki Twitter personnel",
    "the personal page of ":
      "la page personnelle de ",
    "bookmark this page":
      "ajoutez cette page &agrave; vos favoris",
    "your personal Facebook wiki":
      "dans votre wiki Facebook personnel",
    "your personal LinkedIn wiki":
      "dans votre wiki LinkedIn personnel",
    "your personal Twitter wiki":
      "dans votre wiki Twitter personnel",
    "Your entry page": "Votre page d'entr&eacute;e",
    "your changes":  "vos modifications",
    "Your private wiki:": "Votre wiki priv&eacute; :",
    "Go to page: ": "Page: ",
    "Screen name:": "Pseudo",
    "Identity on": "Votre identifiant sur",
    //"err:locked":  "HelpInaccessible",
    "err:locked":  "SignIn",
    "err:read":    "HelpErreurEnLecture",
    "err:write":   "HelpErreurEnEcriture",
    "Previous ":   "",
    "compress":    "comprimer",
    "Keep last changes only": "Garder les derniers changements seulement",
    "Anonymous":   "Anonyme",
    "(open)":      "(ouvert)"
  }
}

Session.i18n = function( msg ){
// Returns the i18n version of the msg.
// "msg" is usually the "en" version of the message, with the translated
// version in "per language" tables.
// Sometimes "msg" is a "fake" msg that is not needed in english but is
// needed in some other languages. "il y a" is an example of such messages.
  var lang = this.config.lang
  NDe&&bug( "lang: ", lang)
  if( !Sw.i18n[lang] ){
    this.de&&bug( "newLanguage:", lang)
    Sw.i18n[lang] = {}
  }
  // Lang specific msg, or default "en" msg, or msg itself if no translation
  return Sw.i18n[lang][msg]
  || Sw.i18n["en"][msg]
  || msg
}

// section: end i18n.js


// Unfortunately one cannot login from the bar... useless to me
Session.meeboScript = function(){
  if (typeof Meebo == 'undefined') {
    Meebo=function(){(Meebo._=Meebo._||[]).push(arguments)};
    (function(_){
      var d=document, b=d.body,c;
      if(!b){
           c=arguments.callee;
           return setTimeout(function(){c(_)},100)
      }
      var a='appendChild',c='createElement',
      m=b.insertBefore(d[c]('div'),
      b.firstChild),
      n=m[a](d[c]('m')),
      i=d[c]('iframe');
      m.style.display='none';
      m.id='meebo';
      i.frameBorder="0";
      n[a](i).id="meebo-iframe";
      function s(){
        return[
          '<body onload=\'var d=document;d.getElementsByTagName("head")[0].',
          a,
          '(d.',
          c,
          '("script")).src="http',_.https?'s':'','://',_.stage?'stage-':'',
          'cim.meebo.com',
          '/cim?iv=2&network='
          ,_.network,
          _.lang?'&lang='+_.lang:'',
          _.d?'&domain='+_.d:'',
          '"\'></bo',
          'dy>'
        ].join('')
      }
      try{
        d = i.contentWindow.document.open();
        d.write(s());
        d.close()
      }catch(e){
        _.d = d.domain;
        i.src = 'javascript:d=document.open();d.write("'
        + s().replace(/"/g,'\\"')
        + '");d.close();'
      }
    })({ network: sw_meebo_bar, stage: false }) 
    Meebo("makeEverythingSharable"); 
  }
  // Meebo("domReady");
}

// ----------------
// section: mail.js

Session.sendMail = function( to, subject, body ){
// Minimal tool to send mails, using local SMTP daemon.
// Very naive implementation using fixed delays for synchronization.
// ToDo: cb( err/ok) I guess
// ToDo: Could use a service like http://mailgun.net/
// ToDo: Or https://github.com/voodootikigod/postmark.js
  this.de&&bug(
    "Mail to: ",   to,
    ", subject: ", subject,
    ", body: ",    Sys.inspect( body)
  )
  var conn25 = Net.createConnection( 25)
  var broken = false
  conn25.setEncoding( "utf8")
  var cmds = []
  var send = function(){
    var cmd = cmds.shift()
    if( broken || !cmd ){ return conn25.end() }
    conn25.write( cmd)
    setTimeout( send, 2000)
  }
  conn25.addListener( "connect", function(){
    // ToDo: Should wait for 220 here...
    setTimeout( function(){
      cmds.push( "helo localhost\r\n")
      cmds.push( "mail from: " + "info@simpliwiki.com" + "\r\n")
      cmds.push( "rcpt to: " + to + "\r\n")
      cmds.push( "data\r\n")
      cmds.push( "From: " + "info@simpliwiki.com" + "\r\n")
      cmds.push( "To: " + to + "\r\n")
      cmds.push( "Subject: " + subject + "\r\n")
      cmds.push( "Content-Type: text/plain\r\n")
      cmds.push( body  + "\r\n")
      cmds.push( ".\r\n")
      cmds.push( "quit\r\n")
      send()
    }, 10000)
  })
  var that = this
  conn25.addListener( "data", function( msg ) {
    that.de&&bug( "Mailer response: ", msg)
    if( msg.includes( "554 SMTP") ){
      broken = true
    }
  })
}

Session.registerMailAddress = function( text ){
  // ToDo: should sent mail, both to previous and new address
  var match = text.match( /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,4}/gi)
  if( !match )return ""
  text = match[0]
  this.sendMail( text, "Code", this.loginCode)
  var usermailpage = this.lookup( this.usernamize( text))
  // Flag guest's userpage as a draft, until mentor stamps it
  if( this.isGuest() ){
    this.draft( usermailpage, true)
  }
  var that = this
  this.putPage(
    usermailpage,
    this.userName(),
    function( err, usermailpage ){
      this.de&&bug( "Mail page ", usermailpage.name,
      " of ", that.userName() )
    }
  )
  return text
}

// section: end mail.js

// section: end session.js

// -------------------
// section: mockreq.js
// Class MockRequest
//
// I use mock HTTP requests (and responses) for tests.
// In some situations, I also use them in production.
//
// The MockRequest object actually implements both the ServerRequest and
// the ServerResponse inferfaces.
//
// It is an EventEmitter with some additional events:
// 'data' when emitData() is invoked.
// 'end'  when emitEnd() is invoked.
// 'headers' when writeHead() is invoked.
// 'write' when write() is invoked.
// 'send' is emitted when end() is invoked.

function MockRequest( response ){
  Events.EventEmitter.call( this)
  this.uniqueId = MockRequest.id++
  if( !response ){
    this.model = "ServerRequest"	  
    this.url = ""
    this.headers = {}
    this.method = "GET"
    this.connection = {}
  }else{
    this.model = "ServerResponse"
  }
}

// MockRequest.prototype = MockRequest
// See http://blog.nodejitsu.com/using-sys-inherits-in-node-js
Sys.inherits( MockRequest, Events.EventEmitter)
MakeDebuggable( MockRequest, "MockRequest")

MockRequest.id = 0

MockRequest.prototype.toString = function(){
  return "<M " + this.uniqueId + " " + this.model + ">"
}

MockRequest.prototype.emitData = function( data ){
  this.emittedData = data
  this.emit( 'data', data)
}

MockRequest.prototype.emitEnd = function(){
  this.emittedEnd = true
  this.emit( 'end')
}

MockRequest.prototype.end = MockRequest.prototype.emitEnd

MockRequest.prototype.writeHead = function( code, headers ){
  this.writeCode = code
  this.writeHeaders = headers
  this.emit( 'headers')
}

MockRequest.prototype.write = function( body, encoding ){
  this.writeData = body
  this.writeEncoding = encoding
  this.emit( 'write', body, encoding)
}

MockRequest.prototype.end = function(){
  this.emittedSend = true
  this.emit( 'send')
}

MockRequest.get = function( handler, url, cb, timeout_t ){
// Invoke HTTP handler.
// Calls cb( 'end', data, rsp, req) or cb( 'timeout', data, rsp, req)
  var req = new MockRequest()
  req.method = "GET"
  req.url = url
  req.process( handler, cb, timeout_t)
  return req
}

MockRequest.post = function( handler, url, data, cb, timeout_t ){
// Invoke HTTP handler.
// Calls cb( 'end', data, rsp, req) or cb( 'timeout', data, rsp, req)
  var req = new MockRequest()
  req.method = "POST"
  req.url = url
  req.process( handler, cb, timeout_t)
  req.emitData( data)
  req.emitEnd()
  return req
}

MockRequest.prototype.process = function( handler, cb, timeout_t ){
  var that = this
  var rsp = new MockRequest( true)
  timeout_t || (timeout_t = 10000)
  var done = false
  rsp.addListener( 'end', function(){
    if( done )return
    done = true
    cb.call( that, 'end', rsp.writeData, rsp, that)
  })
  setTimeout(
    function(){
      if( done )return
      cb.call( that, 'timeout', rsp.writeData, rsp, that)
    },
    timeout_t
  )
  handler.call( this, this, rsp)
  return this
}


// section: end mockreq.js


// ---------------
// section: css.js
// This is a dynamically generated css definition that is embedded in all pages.
// ToDo: split in two part: static & dynamic, so that static part is cached in
// browser. This is easy because, so far, the "dynamic" part is rather static too,
// it is defined once, at startup, here.
// ToDo: reset?, see http://meyerweb.com/eric/thoughts/2011/01/03/reset-revisited/


// This seems to be the "minimum" to have some desired effects:
// - menu that fades
// - textarea that overlaps normal content exactly
// The main trick is about using a monospace font. Without it, the font
// resizing basically fails.
Sw.minimumStyle = "\
#sw_tooltip {z-index:+2;background-color:white;}\n\
#unfadder {position:fixed;top:0;background-color:white;}\n\
#header {position:fixed;top:0;z-index:+1;background-color:white;}\n\
#header_content>div{display:inline;}\n\
#container {margin:2em auto;font-family: monospace;}\n\
#sizer {font-family:monospace;position:absolute;}\n\
.content {text-wrap:unrestricted;word-wrap:break-word;white-space:pre-wrap;}\n\
#content_editable {display:none;}\n\
#previous_content{display:none;}\n\
textarea {font-size:1em;text-wrap:unrestricted;white-space:pre-wrap;overflow:hidden;width:inherit;\
line-height:inherit;border:0;padding:0;outline:none;}\n\
p {word-wrap: break-word;}\n\
pre {white-space: pre-wrap;}\n\
"

Sw.padding = 'padding: 0px 1em 0px 1em;'
Sw.font
= 'font-family: "Droid Sans", Verdana, Arial, sans-serif;'
Sw.monofont
= 'font-family: "Droid Sans Mono", Monaco, Consolas, "Lucida Console", monospace;'

// ToDo: reset?
// See http://meyerweb.com/eric/tools/css/reset/
Sw.style = [
'',

'html {',
  'font-size: 100%;',
  'overflow-y: scroll;',	// Force scrollbar to avoid "centering jumps"
'}',

'body {',
  //'background-color:#fff;',
  'margin:0px;',		// Becomes 0px on touch devices
  Sw.font,
  'line-height: 1.35em;',	// Becomes 1em on touch devices
  'color: #444;',
  'text-shadow: #DDD -0.03em -0.03em 0.05em;',	// Very light
  //'position: relative;',
  //'cursor: default;',
'}',

'#sw_tooltip {',
  'display: none;',
  'background: white;',
  'padding: 0px 0.5em 0px 0.5em;',
  'color: #444;',
  'border: 2px solid lightgray;',
  'max-width: 20em;',
  'word-wrap: break-word;',
  'z-index: 20;', // overlap content & header. Note: +2 breaks lesscss.org
'}',


'#unfadder {',
  'position: fixed;',
  'top: 0;',
  'margin: 0px 0.3em;',
  'padding: 0px 0.3em;',
  //'font-weight: bold;',
  //'color:#942;',
  'background-color: #FFBABA;',
  '-moz-border-radius: 0.3em;',
  '-webkit-border-radius: 0.3em;',
  '-khtml-border-radius: 0.3em;',
  'border-radius: 0.3em;',
'}',

// The header of page is the "top menu"
// ToDo: rename #topmenu
'#header {',
  'position: fixed;',
  'top: 0;',
  'width: 100%;',
  'border-bottom: 1px solid #BBB;',
  // http://www.color-hex.com/color/99CCFF
  // LIGHTSKYBLUE, Very light azure
  // http://www.colourlovers.com/palette/1332459/SL_cloud
  'background-color: #9CF;',
  'color: #BBB;',
  'line-height: 1.35em;',
  'text-wrap: normal;',
  'word-wrap: break-word;',
  '-moz-user-select:none;',
  '-webkit-user-select:none;',
  'cursor:default;',
  'z-index: 10;', // Overlap content
'}',

// The top menu is made of a list of inlined div enclose in the #header_content div
'#header_content{',
  'margin: 0px 0.3em;',
  'text-align: center;',
'}',

'#header_content>div{',
  'display: inline;',
'}',

// Inside the top menu, items on the left are about the current wiki
'.top_left {',
  'float:left;',
  'border-bottom: 1px dotted blue;',
  'text-align: left;',
'}',

// Inside the top menu, items on the center are about the current page
'.top_center {',
  // 'border-bottom: 1px dotted white;',
  //'width: auto;',
  //'margin-left:auto;',
  //'margin-right:auto;',
  //'text-align: center;',
'}',

// Inside the top menu, items on the right are about the current user
'.top_right {',
  'float:right;',
  'border-bottom: 1px dotted red;',
  'text-align: right;',
'}',

'.hide {',
  'display: none',
'}',

'#header a {',
  'color: #333;',
'}',
'#header a:hover {', 
  'border-radius: 0.3em;',
  '-moz-border-radius: 0.3em;',
  '-webkit-border-radius: 0.3em;',
  '-khtml-border-radius: 0.3em;',
  'box-shadow: 0px 0px 10px #666;',
  '-moz-box-shadow: 0px 0px 10px #666;',
  '-webkit-box-shadow: 0px 0px 10px #666;',
  'color: #942;',
  'background-color: #FFBABA;', // pale red
  'text-decoration: none;',
'}',

'#container {',
  'margin: 2em auto;',
  Sw.monofont,
'}',

'#sizer {',
  'position: absolute;',
  Sw.monofont,
  'font-size: 1em;',
  'left:0px;',
  'top: 0px;',
  'padding: 0px 0px 0px 0px;',
  'margin: 0px 0px 0px 0px;',
  'color: transparent;',
  'line-height: inherit;',
  'text-shadow: none;',
'}',

'table {',
  'border-spacing: 0px 0px;',
  'margin: auto;',
'}',

'.content {',
  // I really want text to look exactly as typed in the textarea, with
  // wrapping breaking long word like long urls for example
  'text-wrap: unrestricted;',
  'word-wrap: break-word;',
  //'word-break: break-all;',
  'white-space: pre-wrap;',
  'border: 2px solid lightgray;',
  'border-top-style: none;',
  'border-bottom-style: none;',
  'margin: auto;',
  'text-align:left;',
  'vertical-align: top;',
  Sw.padding,
  'min-height: 240px;',
  'background-color: #fdfdfa;',
'}',

'.sw_markdown {',
  'white-space: normal;',
  Sw.font,
'}',

'.angular {',
  'white-space: normal;',
'}',

'.content a {',
  '/* matrix color: lightgreen;*/',
  '/*text-decoration: underline;*/',
'}',

'#content_header {',
  'margin-bottom: 1em;',
'}',

'#content_text {',
  'display: inherit;',
'}',

'#content_edit {',
  'display: inherit;',
  'background-color: #F0F0F0;',
'}',

'#content_editable {',
  'display: none;',
  'background-color: #F0F0F0;',
'}',

'textarea {',
  Sw.monofont,
  'font-size: 1em;',
  'line-height: inherit;',
  'width: inherit;',
  'text-wrap:unrestricted;',
  'white-space: pre-wrap;',
  'border: 0px solid transparent;',	// ToDo: 1 px border?
  'outline: none;',
  'padding: 0px 0px 0px 0px;',
  'margin: 0px 0px 0px 0px;',
  'background-color: transparent;',
  'overflow: hidden;',
'}',

'#previous_content{',
  'border: 2px solid lightgray;',
  'border-top-style: none;',
  'border-bottom-style: none;',
  Sw.padding,
  'display: none;',
'}',

'#previous_content_header {',
  'display: inherit;',
  'margin-bottom: 2em;',
'}',

'#sw_traces {',
  'font-size: 9px;',
  'background-color: #000;',
  'color: #eee;',
'}',

'#sw_notifications {',
  'font-size: 1em;',
  'background-color: #EEF;',
  'color: #9CF;',
  'position: fixed;',
  'top: 0px;',
  'right: 0px;',
  'margin-right: 1em;',
  'margin-top: 2em;',
  'margin-left: auto;',
'}',

'.sw_boxed {',
  '-webkit-box-shadow: #EEE 0px 0px 6px;',
  '-moz-box-shadow: #EEE 0px 0px 6px;',
  '-box-shadow: #EEE 0px 0px 6px;',
  'border-color: initial;',
  'border-style: initial;',
  'border-bottom-left-radius: 1em 0.5em;',
  'border-bottom-right-radius: 1em 3em;',
  'border: 1px solid #CCC;',
  'border-top-left-radius: 1em 3em;',
  'border-top-right-radius: 1em 0.5em;',
  'margin: 0px auto;',
  'max-width: 30em;',
  'width: auto;',
  'padding: 0.5em;',
'}',

'.sw_boxed ul {',
  '-webkit-padding-start: 1em;',
  'list-style-type: disc;',
'}',

'#footer {',
  //'position: fixed;',
  //'bottom: 0;',
  'width: 100%;',
  'min-height: 400px;',
  'border-top: 1px solid #BBB;',
  'border-bottom: 1px solid #BBB;',
  //'background-color: #EEE;',
  'color: #999;',
  'word-wrap: break-word;',
  '-moz-user-select:none;',
  '-webkit-user-select:none;',
  'cursor:default;',
  'line-height: 1.2em;',
'}',

'#footer_content {',
  'margin: 0px 0.3em;',
'}',

'#gotop {',
 'float: right;',
'}',

'#login {',
  //'vertical-align: text-top;',
  'text-align: right;',
'}',

// Avoid flicker
'#tw-login {',
  'min-height: 26px;',
'}',
'#li-login {',
  'min-height: 26px;',
'}',
'#fb-login {',
  'min-height: 26px;',
'}',
'.fb_iframe_widget {',
  'min-height: 187px;',
'}',
	
'#footer_content a {',
  'color: #777;',
'}',

'#powered {',
  'text-align: right;',
  'font-size: 60%;',
  Sw.monofont,
'}',

'#footer_content a:hover {',
  'border-radius: 0.3em;',
  '-moz-border-radius: 0.3em;',
  '-webkit-border-radius: 0.3em;',
  '-khtml-border-radius: 0.3em;',
  'box-shadow: 0px 0px 10px #666;',
  '-moz-box-shadow: 0px 0px 10px #666;',
  '-webkit-box-shadow: 0px 0px 10px #666;',
  'color: #942;',
  'background-color: #FFBABA;',	// pale red
  'text-decoration: none;',
'}',

// Avoid hover box shadow on Shareaholic links
'#footer_content ul.socials a:hover {',
  'border-radius: 0;',
  '-moz-border-radius: 0;',
  '-webkit-border-radius: 0;',
  '-khtml-border-radius: 0;',
  'box-shadow: none;',
  '-moz-box-shadow: none;',
  '-webkit-box-shadow: none;',
'}',

'input {',
  'background-color: transparent;',
  Sw.font,
  'font-size: 1em;',
  'color: #555;',
  'margin: 0.3em 0px 0px 0px;',
  'border: 1px solid #AAA;',
  '-moz-border-radius: 0.3em;',
  '-webkit-border-radius: 0.3em;',
  '-khtml-border-radius: 0.3em;',
  'border-radius: 0.3em;',
'}',

'input:hover {',
  'color: #942;',
  'background-color: #FFBABA;',
  'text-decoration: none;',
  'border-radius: 0.3em;',
  '-moz-border-radius: 0.3em;',
  '-webkit-border-radius: 0.3em;',
  '-khtml-border-radius: 0.3em;',
  'box-shadow: 0px 0px 10px #666;',
  '-moz-box-shadow: 0px 0px 10px #666;',
  '-webkit-box-shadow: 0px 0px 10px #666;',
'}',

'input:focus {',
  'background-color: transparent;',
'}',

'#send {',
  'color: red;',        // "Send" button, very visible
'}',

'p {',
  'word-wrap: break-word;',
'}',

'img {',
  'border-top-color: #000000;',
  'border-left-color: #000000;',
  'border-right-color: #000000;',
  'border-bottom-color: #000000;',
  'border-top-width: 0;',
  'border-left-width: 0;',
  'border-right-width: 0;',
  'border-bottom-width: 0;',
  'border-top-style: none;',
  'border-left-style: none;',
  'border-right-style: none;',
  'border-bottom-style: none;',
  'vertical-align: middle;',
'}',

'a {',
  'color:#33A;',	// Classic blue
  'text-decoration:none;',
'}',

'a:visited {',
  'color:#33A;',	// Classic blue
  //'text-decoration:none;',
'}',
'a:link.hot {',
  'color: #942;',	// Very visible, dark red
'}',
'a:link.hothot {',
  'color: red;',	// Very very very visible
'}',
'a:visited.hot {',
  'color: #942;',	// Very visible, dark red
'}',
'a:visited.hothot {',
  'color: #942;',	// ToDo: does not work, due to &time= in url
'}',
/*
'a:hover {',
  'color: #942;',
  'background-color: #FF9900;',
  'text-decoration: none;',
'}',*/
'a:hover, a.hover {',
  'text-decoration: underline;',
'}',

'b {',
  'color: #222;',	// Slightly more visible
'}',

'i {',
  'font-style: italic;',
  // Droid Sans has no italics on Opera... revert to Mono that has them...
  Sw.monofont,
'}',

'em {',
  'font-style: normal;',
  //'font-weight: bold;',
  'color: #942;',	// Very very visible, dark red
'}',

'strong {',
  'font-weight: normal;',	// Bold is to "heavy"
  //'color: #000;',
  //'text-shadow: 0px 0px 2px;',	// strange "bold", ToDo: 1px?
  'text-shadow: 0px 0px 2px #666;',	// #666, else... transparent in webkit
'}',

'cite {',
  'color: #222;',
  'font-style: italic;',
  //'font-weight: bold;',	// italic+bold would be too much
  Sw.monofont,
'}',

// Markup language
'dfn {',
  'color: #BBB;',	// Much less visible
'}',
'dfn:hover {',
  'color: #555;',	// Visible
'}',

'var {',
  'font-size: 0px;',
  'color: #FFF;',
'}',

'code {',
  'font-family: monospace;',
  'font-size: 80%;',
  'line-height: 1.4em;',
  'color: #004600;',
'}',

'code.sw_markdown {',
  'font-family: monospace;',
  'font-size: 100%;',
  'line-height: 1.35em;',
  'color: #004600;',
'}',

'span.twitter {',
  'background-color: #9AE4E8;',
'}',

'span.diff {',
  'background-color: yellow;',
'}',

'div.yaml {',
  'color: #CCC;',		// Less visible
'}',
'div.yaml:hover {',		// Dark green
  'color: #004600;',
'}',

'time {',
  'color: #BBB;',		// Less visible
  'font-style: italic;',        // "hint" for user, ISO format matters
  'text-transform: lowercase;', // Lessen noise (when visible)
'}',

// Hide ISO noise, but keep content copy/paste friendly
'time > i {',
  'color: transparent;',
  'text-shadow: none;',		// Hide shadow too...
'}',
'time:hover {',
  'color: #555;',
'}',

// for <time>
'.recent {',
  'color: #B99;',
'}',

// for <time>
'.old {',
  'color: #DDD;',
'}',

'h1, h2, h3, h4, h5 {',
  SW.font,
  'margin: 0.9em 0px 0.3em;',
  'padding: 0px;',
  'line-height: 135%;',
'}',
'h1, h2, h3 {',
  'letter-spacing: -0.05em;',
'}',
'h1 {',
  'font-size: 280%;',
  'font-weight: bolder;',
'}',
'h2 {',
  'font-size: 140%;',
  'font-weight: bold;',
  //'margin-bottom: 0px;',
'}',
'h3 {',
  'font-size: 110%;',
  'font-weight: bold;',
  //'margin-bottom: 0px;',
'}',
'h4 {',
  'font-size: 85%;',
  //'margin-bottom: 0px;',
'}',
'h5 {',
  'font-size: 60%;',
  'line-height: 1.2em;',  // vs 1.35
  'font-weight: normal;',
'}',

'hr {',
  'color: #333;',
  'background-color: #333;',
  'height: 1px;',
  'border-style: solid;',
  'border-width: 0px;',
  //'border-top: 1px solid #333;',
  'width: 100%;',
  'margin: 0.5em 0px;',
'}',

'.sw_hr {',
  'text-align: center;',
  'color: #BBB;',
'}',

// This is needed to handle "click to edit" scrolltop management
'.sw_pre_edit h1, .sw_pre_edit h2, .sw_pre_edit h3, \
 .sw_pre_edit h4, .sw_pre_edit h5 {',
  'font-size: 200%;', // This to compensate for the removed \n in wikify()
  'line-height: 1.35em;',
  'margin: 0px 0px 0px 0px;',
'}',

'pre {',
  'line-height: inherit;',
  'white-space: pre-wrap;',
  'margin: 0px 0px 0px 0px;',
  'font-family: inherit;',
'}',

'form {',
  'padding: 0px 0px 0px 0px;',
  'margin: 0px 0px 0px 0px;',
  'border: 0px 0px 0px 0px;',
  'outline: 0px 0px 0px 0px;',
'}',

'ul {',
  'margin: 0;',
  '-webkit-padding-start: 2em;', // revert default
  '-moz-padding-start: 2em;', // revert default
  //'padding-left: 1em;',
  'list-style-type: none;',
  Sw.font,
'}',

'ol {',
  'margin: 0;',
  '-webkit-padding-start: 3em;', // revert default
  '-moz-padding-start: 3em;', // revert default
  //'padding-left: 1em;',
  'list-style-type: decimal;',
  'font-family: inherit;', // Mono, unless inside UL
'}',

// http://codemirror.net/
'.CodeMirror-line-numbers {',
  'width: 2.2em;',
  'color: #aaa;',
  'background-color: #eee;',
  'text-align: right;',
  'padding-right: .3em;',
  'padding-top: .4em;',
  Sw.monofont,
  'font-size: 100%;',
  'line-height: 1.35em;',
'}',

'.sw_codemirror {',
  Sw.monofont,
  'font-size: 100%;',
  'line-height: 1.35em;',
'}',

'#sw_fb_like_button {',
  'min-height: 21px;',
'}',
'.sw_fb_like_iframe {',
  'border:none;',
  'overflow:hidden;',
  'height:21px;',
'}',

'.editbox {',
  Sw.monofont,
  'font-size: 100%;',
  'line-height: 1.35em;',
'}',


''
].join( "\n")

// Hook: SW.style
if( SW.style ){
  Sw.style = SW.style
}

// See http://lesscss.org/
// npm install less

var Less = null
try {
  Less = require( "less")
}catch( err ){
  Section.sys.puts( "No less, see lesscss.org")
  Section.sys.puts( Sys.inspect( err))
}

if( Less ){
  try{
    Less.render( Sw.style, function( e, css ){
      if( e )throw e
      Sw.style = css
    })
  }catch( err ){
    Section.sys.puts( "Is less broken? err:" + Sys.inspect( err))
    Less = null
  }

// If less than less, I use the strict minimum
}else{
  // ToDo: Less is currently broken, I keep to my style
  // Sw.style = SW.style || Sw.minimumStyle
}

// See https://github.com/mishoo/UglifyJS
// npm install uglify
// ToDo: install & test
Uglify = null


// section: end css.js

// ------------------
// section: server.js

// Singleton root wiki dispatches requests to child wikis
var TheRootWiki = new Wiki( null, "", null)

// I cache static files
var StaticFileCache = {}

Sw.fileIsCached = function( file ){
  file = "/" + file
  return !!StaticFileCache[file]
}

Sw.cacheFile = function( file, mime, data ){
// Add a "pseudo" file to the static file cache
  file = "/" + file
  StaticFileCache[file] = {
    mimetype: mime,
    code:     200,
    encoding: "utf8",
    data:     data
  }
}

Sw.cacheHtmlFile = function( name, content ){
// Like SW.cacheFile() but with one less parameter
// ToDo: some compression?
  return Sw.cacheFile( name, "text/html", content)
}

Sw.cacheCssFile = function( name, content ){
// Like SW.cacheFile() but with one less parameter
// ToDo: some compression?
  return Sw.cacheFile( name, "text/css", content)
}

Sw.cacheTxtFile = function( name, content ){
// Like SW.cacheFile() but with one less parameter
// ToDo: some compression?
  return Sw.cacheFile( name, "text/plain", content)
}

Sw.cacheJsFile = function( name, content ){
// This is a special version of SW.cacheFile() that deals with .js files.
// When posible, it caches two versions, the normal version and the Uglified
// version. However, even when the Uglify package is not there, the normal
// version is "slightly" uglified, some comments are removed (I hope this is
// safe).

  // Comments removal
  content = content.toString().replace( /[^\\:]\/\/.*(?=[\n\r])/g, '')
  Sw.cacheFile( name, "text/javascript", content)

  // If no Uglify, copy "normal" version in .min
  if( !Uglify ){
    Sw.cacheFile(
      name.replace( /.js$/, ".min.js"),
      "text/javascript",
      content
    )
  }

  // Let's get ugly

}

// I add some "pseudo" files in the cache

// Credits: https://github.com/brianleroux/Google-Code-Prettyfy-for-NodeJS
Prettyfy = null
try{
  Prettyfy = require( "prettyfy")
}catch( err ){
  Section.sys.puts( "npm prettyfy to get prettyfied source code")
}

// Style for Google's Prettyfy
Sw.cacheFile(
  "prettyfy.css",
  "text/css",'\
body { font-family: monospace; }\n\
/* google code prettyfy classes */\n\
.str{color:#008}\
.kwd{color:#800}\
.com{color:#000}\
.typ{color:#606}\
.lit{color:#066}\
.pun{color:#660}\
.pln{color:#444}\
.tag{color:#040}\
.atn{color:#606}\
.atv{color:#080}\
.dec{color:#606}\
pre.prettyprint{padding:2px;border:1px solid #888}\
@media print{.str{color:#060}.kwd{color:#006;font-weight:bold}.com{color:#600;font-style:italic}.typ{color:#404;font-weight:bold}.lit{color:#044}.pun{color:#440}.pln{color:#000}.tag{color:#006;font-weight:bold}.atn{color:#404}.atv{color:#060}}\n\
'
)

// My OneBigFile darling
Sw.cacheTxtFile( "onebig.txt", Section.oneBigBody)
Sw.cacheJsFile(  "onebig.js",  Section.oneBigBody)
// And also the smaller parts, lean mode, see buildSectionsHtml() below

// Build "sections.html" && prettified html pages for all sections
Sw.buildSectionsHtml = function(){
  var all_src_files =
  '<html><head><title>OneBigFile sections</title>\n\
  <link rel="shortcut icon" href="/yanugred16.png" type="image/png" />\n\
  </head><body><a href="onebig.js">onebig.js</a><ol>\n'
  // Walk all sections, two visitors: 1/ a collector 2/ a consumer
  Section.rootSection.build( true).collect(
  // 1 - Collector
  function( section ) { return section.content },
  // 2 - Consumer
  function( section, content ){
    // de&&bug( "Caching " + section.basename)
    var file = section.basename
    // Main file has a fully qualified name, get the base name
    if( file.includes( "main.js") ){ file = "main.js" }
    all_src_files
    += '<li><a href="' + file + '.html">' + file + '</a>'
    +  ' <a href="' + file + '">_</a></li>'
    content =
        '// section: '  + file
    + '\n// instance: ' + SW.name
    + '\n// domain: '   + SW.domain
    + '\n// version: '  + SW.version
    + '\n// date: '     + Sw.dateNow.toGMTString()
    + '\n// visit http://simplijs.com'
    + '\n\n'
    + content
    // Regular version
    Sw.cacheJsFile( file, content)
    // Prettyfy print into html file
    if( Prettyfy ){
      var htmlized   = Wiki.htmlize( content)
      var prettyfied = Prettyfy.prettyPrintOne( htmlized, "lang-js")
      de&&bug( "Prettyfied " + file)
      prettyfied = "<html><head><title>" + file + "</title>"
      + '<link rel="stylesheet" type="text/css" href="prettyfy.css">'
      + "</head><body>" + prettyfied + "</body></html>"
      Sw.cacheFile( file + ".html", "text/html", prettyfied)
    }
  })
  Sw.cacheHtmlFile( "sections.html", all_src_files + '\n</ol></body></html>')
}
Sw.buildSectionsHtml()

// Prefetch a bunch of files in the cache
Sw.cacheCssFile( "simpliwiki.css",   Sw.style)
Sw.cacheCssFile( "minimum.css",      Sw.minimumStyle)
Sw.cacheJsFile(  "sw_load.js",       Session.loadScript)
Sw.cacheJsFile(  "sw_api.js",        Session.apiScript)
Sw.cacheJsFile(  "sw_angularize.js", Session.angularizeScript)
Sw.cacheJsFile(  "sw_scrollcue.js",  Wiki.scrollcueScript)
Sw.cacheJsFile(  "sw_wikify.js",     Session.wikifyText)

// Goodies
Sw.cacheHtmlFile( "with.google",
  '<html>'
+ '<head>'
+ '<title>' + SW.name + '</title>'
+ '<link rel="shortcut icon" href="/yanugred16.png" type="image/png" />'
+ '</head>'
+ '  <frameset cols="25%,*"> '
+ '    <frame src="comeback"/>'
+ '    <frame src="http://google.com"/>'
+ '  </frameset>'
+ '</html>'
)
Sw.cacheHtmlFile( "avec.google", StaticFileCache["/with.google"].data)

Sw.cacheHtmlFile( "simpliwiki.html",
  '<html>'
+ '<head>'
+ '<title>' + SW.name + '</title>'
+ '<link rel="shortcut icon" href="/yanugred16.png" type="image/png" />'
+ '</head>'
+ '  <frameset cols="*,*"> '
+ '    <frame src="comeback"/>'
+ '    <frame src="http://simpliwiki.com"/>'
+ '  </frameset>'
+ '</html>'
)


// Here comes the HTTP handler
Sw.nr = 0
Sw.handler = function handler( req, res ){
// ToDo: Factor out file management
  this.deep_http_de&&bug( "HTTP request; req:" + Sys.inspect( req))
  Sw.nr++
  if( req.headers.referer
  && !req.headers.referer.includes( "simpliwiki.com")
  && !req.headers.referer.includes( "virteal.com")
  ){
    bug(
      "r:", Sw.nr,
      "referer:", req.headers.referer,
      "url:", req.url
    )
  }
  // Attach response to request, I don't get why nodejs don't do that by dflt
  req.response = res
  // Experimental, global context
  Contexted.scope ={req: req}
  if( TheRootWiki.processHttpRequest( req) )return
  var pathname = Url.parse( req.url).pathname;
  TheRootWiki.deep_http_de&&bug( "HTTP pathname: " + pathname)
  // Basic web server for static files
  // Note: "in" works with DoByeBye for hard logouts
  if( pathname == "/" || pathname == "/in" ){ pathname = "/index.html" }
  // Get rid of directory names, static files are in current working directory
  var ii = pathname.lastIndexOf( "/")
  if( ii > 0 ){ pathname = pathname.substr( ii) }
  // In production, I shall usually serve static pages using nginx
  // See also /etc/nginx/sites-available/SimpliWiki
  // Static files are small, I keep them in memory
  var cached = StaticFileCache[pathname]
  // Compute encoding & mimetype based on file extension
  var mimetype
  var encoding
  if( cached ){
    mimetype = cached.mimetype
    encoding = cached.encoding
  }else{
    mimetype = "text/plain"
    encoding = "binary"
    var ext = extname( pathname);
    if( ext == ".css"  ){ mimetype = "text/css" }
    if( ext == ".html" ){ mimetype = "text/html" }
    if( ext == ".png"  ){ mimetype = "image/png" }
    if( ext == ".gif"  ){ mimetype = "image/gif" }
    if( ext == ".jpg"  ){ mimetype = "image/jpeg" }
    if( ext == ".js"   ){ mimetype = "text/javascript" }
    NDe&&bug( "Mimetype: " + mimetype);
    if( "text".starts( mimetype) ){
      encoding = "utf8"
    }else{
      encoding = "binary"
    }
  }
  var send = function( code, data ){
    NDe&&bug( "Request headers: ",  Sys.inspect( req.headers))
    NDe&&bug( "Response headers: ", Sys.inspect( headers))
    var cache_data    = data
    var cache_control = (De ? "300" : "" + 30 * 24 * 3600)
    // Some hand tuning
    if( De
    && "/1.png /2.png /yanugred64.png /yanugred16.png".includes( pathname)
    ){
      cache_control = "" + 30 * 24 * 3600
    }
    cache_control = "max-age=" + cache_control // + ", public", useless?
    // index.html is half static, half dynamic... nice hack
    if( pathname == "/index.html"
    ||  pathname == "/simpli.html"
    ){
      // Include cookie data to log in back in previous wikis
      // I do that because client side I get nothing in document.cookie
      data = data.replace(
	'<div id="sw_comeback"></div>',
	'<script>var sw_cookies = "'
	+ encodeURIComponent( req.headers.cookie)
        + '" </script>\n'
      )
      // Don't cache and don't even store, codes...
      cache_control = "no-store"
    }
    var headers = [
      ["Server",         "SimpliWiki"],
      ["Content-Type",   mimetype],
      ["Content-Length", data.length],
      ["Cache-Control",  cache_control]
    ]
    res.writeHead( code, headers)
    res.write(     data, encoding)
    res.end();
    // Update cache
    // ToDo: limit size of cache?
    StaticFileCache[pathname] = {
      mimetype: mimetype,
      code:     code,
      encoding: encoding,
      data:     cache_data
    }
  }
  // Disallow robots unless custom domain
  // ToDo: Should be handled by the target wiki, not here
  if( pathname == "/robots.txt" ){
    De&&bug( "robot: ", pathname)
    return send(
      200,
      'User-agent: *\n'
      + 'Allow: /index.html\n'
      + 'Allow: /\n'
      + 'Disallow:' + (req.custom ? "\n" : " /.\n")
    )
  }
  if( cached ){
    var data = cached.data
    send( cached.code, data)
    return
  }
  // Not cached, read from filesystem
  Fs.readFile( "." + pathname, encoding, function( err, data ){
    var code = 200
    if( err ){
      code = 404
      data = "Not Found: ." + pathname
      encoding = "utf8"
      mimetype = "text/plain"
    }
    De&&bug( "readFile:", pathname, "code:", code)
    // Patch index.html
    var is_index
    =  (pathname == "/index.html")
    || (pathname == "/simpli.html")
    if( code == 200 || is_index ){
      // Patch index.html
      if( is_index ){
        // Provide a default index.html if none was found
        if( code != 200 ){
          code = 200
          mimetype = "text/html"
          // Minimal valid operational index.html
          data = '<!DOCTYPE HTML>'
          + '<html><body style="font-family: monospace;">'
          + '<script type="text/javascript"'
          + 'src="http://ajax.googleapis.com/ajax/libs/jquery/1.5.0/jquery.min.js">'
          + '</' + 'script>'
          + '<script type="text/javascript" src="sw_load.js"></script>'
          //+ 'id=' + SW.twid + '&v=1" type="text/javascript"></script>')
          + '<script type="text/javascript">'
          + 'var De = ' + (De ? "true" : "false") + ';'
          + 'var Session = {i18n: function( m ){return m},config:{}};'
          + 'var sw_fbid = "' + SW.fbid + '", sw_twid = "' + SW.twid + '";'
          + 'var sw_likey = "' + SW.likey + '";'
          + (SW.oneTrueFan ? "var sw_onetruefan =true;" : "")
          + '</script>'
          + '<div id="login-buttons">'
          + '<div id="fb-login"></div>'
          + '<div id="tw-login"></div>'
          + '<div id="li-login"></div>'
          + '<div id="fb-root"></div>'
          + '</div>'
          + '<div id="sw_comeback"></div>'
          + '<a href="/HomePage">' + SW.name + '</a>'
          + '<hr><a href="http://simpliwiki.com">'
          +   '<img src="http://simpliwiki.com/yanugred16.png"/>'
          +   " <strong>Simpl<em>i</em>Wiki</strong>"
          + "</a>"
          + '</body></html>'
        }
        // Include Twitter, Facebook & co code
        data = data.replace(
	  '<div id="fb-root"></div>',
	  '<div id="fb-root"></div>'
          + Session.htmlScript( 
            'var sw_fbid = "'   + SW.fbid
            + '", sw_twid = "'  + SW.twid
            + '", sw_likey = "' + SW.likey + '";'
          )
          + Session.htmlScript( Session.signinScript, true) // sync
          + Session.htmlScript(
            "loadfire.event( function( fire ){"
            + "if( !window.onFooterDisplay ) return;"
            + "onFooterDisplay( true, true); return true })"
          )
        )
        // Include code to log in back in previous wikis
        data = data.replace(
	  '<div id="sw_comeback"></div>',
	  '<div id="sw_comeback"></div>'
	  + Session.htmlScript( Session.comebackScript)
        )
      }
      // Some basic minification, hopefully harmless, remove comments (// comment)
      if( ".js".ends( pathname) ){
        data = data.replace( /[^\\:]\/\/ .*(?=[\n\r])/g, '')
      }
    }
    send( code, data)
  })
}

var Server = Http.createServer( Sw.handler)
// ToDo
// HttpsServer = https://tootallnate.net/setting-up-free-ssl-on-your-node-server

if( !De ){
  process.on( "uncaughtException", function( err ){
    bug( "uncaughtException, err:", Sys.inspect( err))
    TheRootWiki.error( "BUG: Some serious error: ", Sys.inspect( err))
    // throw err
  })
}
// Capture SIGINT to avoid rare truncated files
// ToDo: this does not seem to work, I don't see the trace
// Well... maybe it works somehow. But as a result Ctrl-C does not stop the
// process if it entered an infinite loop...
// kill -9 works better in that later case...

Sw.sigint = false
process.on( "SIGINT", function siginting(){
  if( Sw.sigint ){
    // Panic
    process.exit( 2)
  }
  Sw.sigint = true
  setTimeout( function defered_exit(){
    bug( "SimpliWiki, bye bye")
    process.exit( 0)
  }, 100)
})

// section: end server.js


// -----------------
// section: start.js

// Now I can run. But I first kill the previous process
var previous_pid
var previous_pid_file = "./simpliwiki.pid"
if( SW.test ){
  previous_pid_file   = "./simpliwiki.test.pid"
}

var start = function start(){
  // Honor "start" hook
  if( SW.hookStart ){
    SW.hookStart( TheRootWiki)
  }
  NDe&&bug( "SimpliWiki starting at http://127.0.0.1:", SW.port);
  Server.listen( SW.port);
  bug( "SimpliWiki running at http://127.0.0.1:", SW.port);
  // Write PID to file, useful on restart to kill previous process
  if( !SW.test ){
    Fs.writeFileSync( previous_pid_file, process.pid.toString());
  }
  if( SW.test ){
    User.test()
  }
}

try{
  previous_pid = Fs.readFileSync( previous_pid_file)
}catch( err ){}

if( previous_pid ){
  // I kill AND wait, or else Server.listen() may not be able bind the port
  var cmd = "kill " + previous_pid + "; wait " + previous_pid
  De&&bug( "Kill previous SimpliWiki process")
  // Exec command and then start server
  ChildProcess.exec( cmd, start)
}else{
  start()
}

// section: end start.js


// ---------------------
// section: debugvars.js
if( De ){
// Monitor the global scope, to make sure all local variables are declared
// Thanks to  Jorge <jo...@jorgechamorro.com> in Nodejs Google Group, august 23
(function(){
 var global = this
 var saved  = Object.getOwnPropertyNames( global)
 ;(function globalsMonitor( current, symbols ){
  current = Object.getOwnPropertyNames( global)
  if( current.length !== saved.length ){
   symbols = []
   current.forEach( function( v,i,o ){
    if( saved.indexOf(v) < 0 ){
     symbols.push( v + " ["+ typeof global[v]+ "] : " + global[v] + "\n")
    }
   })
   De&&bug( "NEW GLOBALS: ", symbols.length + " new globals :\n" + symbols)
   saved = current
  }
  setTimeout( globalsMonitor, 1000)
 })()
})()
}
// section: end debugvars.js


// --------------
//  Big constants

// ---------------------
// section: yanug.png.js
// The YanUg, 16px
Sw.YanUg = 'data:image/png,%89PNG%0D%0A%1A%0A%00%00%00%0DIHDR%00%00%00%10'
+ '%00%00%00%10%08%06%00%00%00%1F%F3%FFa%00%00%00%04sBIT%08%08%08%08%7C'
+ '%08d%88%00%00%00%09pHYs%00%00%00z%00%00%00z%01%95%0C%A9%7F%00%00%00'
+ '%19tEXtSoftware%00www.inkscape.org%9B%EE%3C%1A%00%00%020IDAT8%8D%8DS'
+ '%5DH%93Q%18~%CE%F96\'%AD%B0b%25%0Cf%5El6%B2%11%85%14uQ%11%CD0%22%15%AA'
+ '%AB%82%C0%E8%22%A4%9BA%A0%08%15F%81%15uc%D1%20%0Bv%B1%10%22%8AY%D0%0F'
+ '%D2%1F%5E%A5%04%23%A3E%7C%E0%1A%0B%B2%D1t%F6%9D%EF%E7%BC%5DL%FD6%DB%A4%07'
+ '%CE%C5y%9E%F7y%CFs%5Ex%19%11%A1%14%C6%DB%AB%9B%A5%FAn%80%E6~m%02%C8C%22%CFa'
+ '%193%BC%3E4%C6%DC%9E%8B5%ED%B7%26J%EBYi%03m(%FCP%AA%EF%3Ba%FEa%A8%04%C5EJ%20'
+ '%1C%B3'
+ '%3E'
+ '\''
+ 'N%AE%B8%5C42%22%C2%5C%2FSx%A0uR%A6%9E%07*%1A%97%807%EEN%D5%9E~%DD%04%00%1C'
+ '%00%B8%BF5%FE%BFf%00%90%EA%9B%806%14%8E%03%00%13%CF%CEm1%C7%06'
+ '\''
+ '%94%D01%A64w%00b%16%94Sa%8C%F6%03%A6%B6L%0C'
+ '\''
+ '%9C%7B%7BC%0E%CA%A9%7D5G%EE1G%E8h%B9%EE%DF%0F%11k%07f%B3Ub%18%90%99%F1~%CE'
+ '%BD%5B%3DK%CD%00%A0%F8%B6%C3%B9%B3%7B%F9%AF%E4%D4%16%CE%7D%3B%BC%0B%84%FE%F2'
+ '%02%B4%E8%1E%3BE%E0%40%99%C1%D5%F5%0A%CE%83%D7m%C2%D4%D6rV%E7%136C%60%2B%EB'
+ '%ED%06%DEm%40%CD*%FB%C5%9F_%40%BF%D3v%B9%5E%E0%CC%CA%26c%BC%BE%F9x%B5%98%22'
+ '%D6%01k%F2qE%8D7%ECJq%EB%EB%8BtEu%1E%CEC7%01%F7%FA%7Fx%25x%18%DC%1FNp%98%E2'
+ '%B6%CC%7F%AF2j%80%AFiDm%F78%94%96.0%CFF%F0%A668%F6%9D%87%B3m%E0%07%E5%D3w'
+ '%40D0%3E%DC%3F%25%0DADDd%E8%24%12%D7H%8A%02-%C0%9AJ%92xzc%F1.%0DA%FA%E8%953D'
+ '%04%10%11%0A%3D%E0%FA%D8%60%5CJY%2C%98N%936%DCG%E2%D1%25%D2%86%FBH%1F%BDKd'
+ '%19E%CD%14%D2%F8%F8%20Z%E8%99%DF%23%22Z%3Cb%24%12%B1%B2%C9%0CU%815%FDmJ%8CD'
+ '%CE%96z%CA%B6%11%00%F4'
+ '\''
+ '%DD%1B%D8%EA%86%13%AC%CE%17d%EEuA%00Db%E6%13%CDf%9323%11wuF%CB%86%FE%17Y'
+ '%8CH6%E1%CFE%D8%00%00%00%00IEND%AEB%60%82'
// section: end yanug.png.js

// ---------------------
// section: interwiki.js
// From http://meta.wikimedia.org/wiki/Interwiki_map
// I got rid of some entries, like dbdump & IMDB, because non cannonical
// I added SimpliWiki. ToDo: add it by code
// ToDo: issue with moniker starting with lowercase, should move to uppercase

Sw.interwikiMap = {
AbbeNormal	: "http://ourpla.net/cgi/pikie?",
Acronym	: "http://www.acronymfinder.com/af-query.asp?String=exact&Acronym=",
Advisory	: "http://advisory.wikimedia.org/wiki/",
Advogato	: "http://www.advogato.org/",
Aew	: "http://wiki.arabeyes.org/",
Airwarfare	: "http://airwarfare.com/mediawiki-1.4.5/index.php?",
AIWiki	: "http://www.ifi.unizh.ch/ailab/aiwiki/aiw.cgi?",
AllWiki	: "http://allwiki.com/index.php/",
Appropedia	: "http://www.appropedia.org/",
AquariumWiki	: "http://www.theaquariumwiki.com/",
arXiv	: "http://arxiv.org/abs/",
AtmWiki	: "http://www.otterstedt.de/wiki/index.php/",
BattlestarWiki	: "http://en.battlestarwiki.org/wiki/",
BEMI	: "http://bemi.free.fr/vikio/index.php?",
BenefitsWiki	: "http://www.benefitslink.com/cgi-bin/wiki.cgi?",
betawiki	: "http://translatewiki.net/wiki/",
BibleWiki	: "http://bible.tmtm.com/wiki/",
BluWiki	: "http://www.bluwiki.org/go/",
BLW	: "http://britainloveswikipedia.org/wiki/",
Botwiki	: "http://botwiki.sno.cc/wiki/",
Boxrec	: "http://www.boxrec.com/media/index.php?",
BrickWiki	: "http://brickwiki.org/index.php?title=",
bugzilla	: "https://bugzilla.wikimedia.org/show_bug.cgi?id=",
bulba	: "http://bulbapedia.bulbagarden.net/wiki/",
buzztard	: "http://buzztard.org/index.php/",
Bytesmiths	: "http://www.Bytesmiths.com/wiki/",
C2	: "http://c2.com/cgi/wiki?/",
C2find	: "http://c2.com/cgi/wiki?FindPage&value=",
Cache	: "http://www.google.com/search?q=cache:",
CanyonWiki	: "http://www.canyonwiki.com/wiki/index.php/",
CANWiki	: "http://www.can-wiki.info/",
CEJ	: "http://esperanto.blahus.cz/cxej/vikio/index.php/",
CellWiki	: "http://cell.wikia.com/wiki/",
CentralWikia	: "http://community.wikia.com/wiki/",
ChEJ	: "http://esperanto.blahus.cz/cxej/vikio/index.php/",
ChoralWiki	: "http://www.cpdl.org/wiki/index.php/",
Citizendium	: "http://en.citizendium.org/wiki/",
CKWiss	: "http://ck-wissen.de/ckwiki/index.php?title=",
CNDbName	: "http://cndb.com/actor.html?name=",
CNDbTitle	: "http://cndb.com/movie.html?title=",
Comixpedia	: "http://www.comixpedia.org/index.php?title=",
Commons	: "http://commons.wikimedia.org/wiki/",
CommunityScheme	: "http://community.schemewiki.org/?c=s&key=",
comune	: "http://rete.comuni-italiani.it/wiki/",
CorpKnowPedia	: "http://corpknowpedia.org/wiki/index.php/",
CrazyHacks	: "http://www.crazy-hacks.org/wiki/index.php?title=",
CreativeCommons	: "http://www.creativecommons.org/licenses/",
CreativeCommonsWiki	: "http://wiki.creativecommons.org/",
CreaturesWiki	: "http://creatureswiki.net/wiki/",
CxEJ	: "http://esperanto.blahus.cz/cxej/vikio/index.php/",
Dcc	: "http://www.dccwiki.com/",
DCDatabase	: "http://www.dcdatabaseproject.com/wiki/",
DCMA	: "http://www.christian-morgenstern.de/dcma/",
DejaNews	: "http://www.deja.com/=dnc/getdoc.xp?AN=",
Delicious	: "http://del.icio.us/tag/",
Demokraatia	: "http://wiki.demokraatia.ee/index.php/",
Devmo	: "http://developer.mozilla.org/en/docs/",
Dictionary	: "http://www.dict.org/bin/Dict?Database=*&Form=Dict1&Strategy=*&Query=",
Dict	: "http://www.dict.org/bin/Dict?Database=*&Form=Dict1&Strategy=*&Query=",
Disinfopedia	: "http://www.sourcewatch.org/wiki.phtml?title=",
distributedproofreaders	: "http://www.pgdp.net/wiki/",
distributedproofreadersca	: "http://www.pgdpcanada.net/wiki/index.php/",
dmoz	: "http://www.dmoz.org/",
dmozs	: "http://www.dmoz.org/cgi-bin/search?search=",
DocBook	: "http://wiki.docbook.org/topic/",
DOI	: "http://dx.doi.org/",
doom_wiki	: "http://doom.wikia.com/wiki/",
download	: "http://download.wikimedia.org/",
DRAE	: "http://buscon.rae.es/draeI/SrvltGUIBusUsual?LEMA=",
Dreamhost	: "http://wiki.dreamhost.com/index.php/",
DrumCorpsWiki	: "http://www.drumcorpswiki.com/index.php/",
DWJWiki	: "http://www.suberic.net/cgi-bin/dwj/wiki.cgi?",
EceI	: "http://www.ikso.net/cgi-bin/wiki.pl?",
EcheI	: "http://www.ikso.net/cgi-bin/wiki.pl?",
EcoReality	: "http://www.EcoReality.org/wiki/",
EcxeI	: "http://www.ikso.net/cgi-bin/wiki.pl?",
ELibre	: "http://enciclopedia.us.es/index.php/",
EmacsWiki	: "http://www.emacswiki.org/cgi-bin/wiki.pl?",
Encyc	: "http://encyc.org/wiki/",
EnergieWiki	: "http://www.netzwerk-energieberater.de/wiki/index.php/",
EoKulturCentro	: "http://esperanto.toulouse.free.fr/nova/wikini/wakka.php?wiki=",
Ethnologue	: "http://www.ethnologue.com/show_language.asp?code=",
EvoWiki	: "http://wiki.cotch.net/index.php/",
Exotica	: "http://www.exotica.org.uk/wiki/",
FanimutationWiki	: "http://wiki.animutationportal.com/index.php/",
FinalEmpire	: "http://final-empire.sourceforge.net/cgi-bin/wiki.pl?",
FinalFantasy	: "http://finalfantasy.wikia.com/wiki/",
Finnix	: "http://www.finnix.org/",
FlickrUser	: "http://www.flickr.com/people/",
FloralWIKI	: "http://www.floralwiki.co.uk/wiki/",
'FlyerWiki-de'	: "http://de.flyerwiki.net/index.php/",
Foldoc	: "http://www.foldoc.org/",
ForthFreak	: "http://wiki.forthfreak.net/index.cgi?",
Foundation	: "http://wikimediafoundation.org/wiki/",
FoxWiki	: "http://fox.wikis.com/wc.dll?Wiki~",
FreeBio	: "http://freebiology.org/wiki/",
FreeBSDman	: "http://www.FreeBSD.org/cgi/man.cgi?apropos=1&query=",
FreeCultureWiki	: "http://wiki.freeculture.org/index.php/",
Freedomdefined	: "http://freedomdefined.org/",
FreeFeel	: "http://freefeel.org/wiki/",
FreekiWiki	: "http://wiki.freegeek.org/index.php/",
Freenode	: "irc://irc.freenode.net/",
ganfyd	: "http://ganfyd.org/index.php?title=",
GaussWiki	: "http://gauss.ffii.org/",
'Gentoo-Wiki'	: "http://gentoo-wiki.com/",
GenWiki	: "http://wiki.genealogy.net/index.php/",
GlobalVoices	: "http://cyber.law.harvard.edu/dyn/globalvoices/wiki/",
GlossarWiki	: "http://glossar.hs-augsburg.de/",
GlossaryWiki	: "http://glossary.hs-augsburg.de/",
Golem	: "http://golem.linux.it/index.php/",
Google	: "http://www.google.com/search?q=",
GoogleDefine	: "http://www.google.com/search?q=define:",
GoogleGroups	: "http://groups.google.com/groups?q=",
GotAMac	: "http://www.got-a-mac.org/",
GreatLakesWiki	: "http://greatlakeswiki.org/index.php/",
GuildWarsWiki	: "http://www.wiki.guildwars.com/wiki/",
Guildwiki	: "http://guildwars.wikia.com/wiki/",
gutenberg	: "http://www.gutenberg.org/etext/",
gutenbergwiki	: "http://www.gutenberg.org/wiki/",
H2Wiki	: "http://halowiki.net/p/",
HammondWiki	: "http://www.dairiki.org/HammondWiki/index.php3?",
heroeswiki	: "http://heroeswiki.com/",
HerzKinderWiki	: "http://www.herzkinderinfo.de/Mediawiki/index.php/",
HRWiki	: "http://www.hrwiki.org/index.php/",
HRFWiki	: "http://fanstuff.hrwiki.org/index.php/",
HupWiki	: "http://wiki.hup.hu/index.php/",
IMDbName	: "http://www.imdb.com/name/nm/",
IMDbTitle	: "http://www.imdb.com/title/tt/",
IMDbCompany	: "http://www.imdb.com/company/co/",
IMDbCharacter	: "http://www.imdb.com/character/ch/",
Incubator	: "http://incubator.wikimedia.org/wiki/",
infoAnarchy	: "http://www.infoanarchy.org/en/",
Infosecpedia	: "http://infosecpedia.org/wiki/",
Infosphere	: "http://theinfosphere.org/",
IRC	:"irc://irc.freenode.net/",
ircrc	:"irc://irc.wikimedia.org/",
rcirc	:"irc://irc.wikimedia.org/",
'ISO639-3'	: "http://www.sil.org/iso639-3/documentation.asp?id=",
Iuridictum	: "http://iuridictum.pecina.cz/w/",
JamesHoward	: "http://jameshoward.us/",
JavaNet	: "http://wiki.java.net/bin/view/Main/",
Javapedia	: "http://wiki.java.net/bin/view/Javapedia/",
JEFO	: "http://esperanto-jeunes.org/wiki/",
JiniWiki	: "http://www.cdegroot.com/cgi-bin/jini?",
JspWiki	: "http://www.ecyrd.com/JSPWiki/Wiki.jsp?page=",
JSTOR	: "http://www.jstor.org/journals/",
Kamelo	: "http://kamelopedia.mormo.org/index.php/",
Karlsruhe	: "http://ka.stadtwiki.net/",
KerimWiki	: "http://wiki.oxus.net/",
KinoWiki	: "http://kino.skripov.com/index.php/",
KmWiki	: "http://kmwiki.wikispaces.com/",
KontuWiki	: "http://kontu.merri.net/wiki/",
KoslarWiki	: "http://wiki.koslar.de/index.php/",
Kpopwiki	: "http://www.kpopwiki.com/",
LinguistList	: "http://linguistlist.org/forms/langs/LLDescription.cfm?code=",
LinuxWiki	: "http://www.linuxwiki.de/",
LinuxWikiDe	: "http://www.linuxwiki.de/",
LISWiki	: "http://liswiki.org/wiki/",
LiteratePrograms	: "http://en.literateprograms.org/",
Livepedia	: "http://www.livepedia.gr/index.php?title=",
Lojban	: "http://www.lojban.org/tiki/tiki-index.php?page=",
Lostpedia	: "http://lostpedia.wikia.com/wiki/",
LQWiki	: "http://wiki.linuxquestions.org/wiki/",
LugKR	: "http://lug-kr.sourceforge.net/cgi-bin/lugwiki.pl?",
Luxo	: "http://toolserver.org/~luxo/contributions/contributions.php?user=",
Mail	: "https://lists.wikimedia.org/mailman/listinfo/",
mailarchive	: "http://lists.wikimedia.org/pipermail/",
Mariowiki	: "http://www.mariowiki.com/",
MarvelDatabase	: "http://www.marveldatabase.com/wiki/index.php/",
MeatBall	: "http://www.usemod.com/cgi-bin/mb.pl?",
MediaZilla	: "https://bugzilla.wikimedia.org/",
MemoryAlpha	: "http://memory-alpha.org/wiki/",
MetaWiki	: "http://sunir.org/apps/meta.pl?",
MetaWikiPedia	: "http://meta.wikimedia.org/wiki/",
Mineralienatlas	: "http://www.mineralienatlas.de/lexikon/index.php/",
MoinMoin	: "http://moinmo.in/",
Monstropedia	: "http://www.monstropedia.org/?title=",
MosaPedia	: "http://mosapedia.de/wiki/index.php/",
MozCom	: "http://mozilla.wikia.com/wiki/",
MozillaWiki	: "http://wiki.mozilla.org/",
MozillaZineKB	: "http://kb.mozillazine.org/",
MusicBrainz	: "http://musicbrainz.org/doc/",
MW	: "http://www.mediawiki.org/wiki/",
MWOD	: "http://www.merriam-webster.com/cgi-bin/dictionary?book=Dictionary&va=",
MWOT	: "http://www.merriam-webster.com/cgi-bin/thesaurus?book=Thesaurus&va=",
NKcells	: "http://www.nkcells.info/wiki/index.php/",
NoSmoke	: "http://no-smok.net/nsmk/",
Nost	: "http://nostalgia.wikipedia.org/wiki/",
OEIS	: "http://www.research.att.com/~njas/sequences/",
OldWikisource	: "http://wikisource.org/wiki/",
OLPC	: "http://wiki.laptop.org/go/",
OneLook	: "http://www.onelook.com/?ls=b&w=",
OpenFacts	: "http://openfacts.berlios.de/index-en.phtml?title=",
Openstreetmap	: "http://wiki.openstreetmap.org/wiki/",
OpenWetWare	: "http://openwetware.org/wiki/",
OpenWiki	: "http://openwiki.com/?",
Opera7Wiki	: "http://operawiki.info/",
OrganicDesign	: "http://www.organicdesign.co.nz/",
OrthodoxWiki	: "http://orthodoxwiki.org/",
OTRS	: "https://ticket.wikimedia.org/otrs/index.pl?Action=AgentTicketZoom&TicketID=",
OTRSwiki	: "http://otrs-wiki.wikimedia.org/wiki/",
OurMedia	: "http://www.socialtext.net/ourmedia/index.cgi?",
OutreachWiki	: "http://outreach.wikimedia.org/wiki/",
Panawiki	: "http://wiki.alairelibre.net/wiki/",
PatWIKI	: "http://gauss.ffii.org/",
PerlNet	: "http://perl.net.au/wiki/",
PersonalTelco	: "http://www.personaltelco.net/index.cgi/",
PHWiki	: "http://wiki.pocketheaven.com/",
PhpWiki	: "http://phpwiki.sourceforge.net/phpwiki/index.php?",
PlanetMath	: "http://planetmath.org/?op=getobj&from=objects&id=",
pyrev	: "http://svn.wikimedia.org/viewvc/pywikipedia?view=rev&revision=",
PythonInfo	: "http://www.python.org/cgi-bin/moinmoin/",
PythonWiki	: "http://www.pythonwiki.de/",
PyWiki	: "http://c2.com/cgi/wiki?",
psycle	: "http://psycle.sourceforge.net/wiki/",
Quality	: "http://quality.wikimedia.org/wiki/",
rev	: "http://www.mediawiki.org/wiki/Special:Code/MediaWiki/",
RFC	: "http://tools.ietf.org/html/rfc",
RheinNeckar	: "http://wiki.rhein-neckar.de/index.php/",
RoboWiki	: "http://robowiki.net/?",
ReutersWiki	: "http://glossary.reuters.com/index.php/",
RoWiki	: "http://wiki.rennkuckuck.de/index.php/",
rtfm	:"ftp://rtfm.mit.edu/pub/faqs/",
S23Wiki	: "http://s23.org/wiki/",
Scholar	: "http://scholar.google.com/scholar?q=",
SchoolsWP	: "http://schools-wikipedia.org/wiki/",
Scores	: "http://imslp.org/wiki/",
Scoutwiki	: "http://en.scoutwiki.org/",
Scramble	: "http://www.scramble.nl/wiki/index.php?title=",
SeaPig	: "http://www.seapig.org/",
SeattleWiki	: "http://seattlewiki.org/wiki/",
SeattleWireless	: "http://seattlewireless.net/?",
SLWiki	: "http://wiki.secondlife.com/wiki/",
'semantic-mw'	: "http://www.semantic-mediawiki.org/wiki/",
SenseisLibrary	: "http://senseis.xmp.net/?",
silcode	: "http://www.sil.org/iso639-3/documentation.asp?id=",
Slashdot	: "http://slashdot.org/article.pl?sid=",
SMikipedia	: "http://www.smiki.de/",
SourceForge	: "http://sourceforge.net/",
spcom	: "http://spcom.wikimedia.org/wiki/",
Species	: "http://species.wikimedia.org/wiki/",
Squeak	: "http://wiki.squeak.org/squeak/",
stable	: "http://stable.toolserver.org/",
Strategy	: "http://strategy.wikimedia.org/wiki/",
StrategyWiki	: "http://strategywiki.org/wiki/",
Sulutil	: "http://toolserver.org/~vvv/sulutil.php?user=",
Swtrain	: "http://train.spottingworld.com/",
svn	: "http://svn.wikimedia.org/viewvc/mediawiki/",
SVGWiki	: "http://wiki.svg.org/index.php/",
SwinBrain	: "http://mercury.it.swin.edu.au/swinbrain/index.php/",
SwingWiki	: "http://www.swingwiki.org/",
TabWiki	: "http://www.tabwiki.com/index.php/",
Tavi	: "http://tavi.sourceforge.net/",
TclersWiki	: "http://wiki.tcl.tk/",
Technorati	: "http://www.technorati.com/search/",
TESOLTaiwan	: "http://www.tesol-taiwan.org/wiki/index.php/",
Testwiki	: "http://test.wikipedia.org/wiki/",
Thelemapedia	: "http://www.thelemapedia.org/index.php/",
Theopedia	: "http://www.theopedia.com/",
ThinkWiki	: "http://www.thinkwiki.org/wiki/",
TibiaWiki	: "http://tibia.erig.net/",
Ticket	: "https://ticket.wikimedia.org/otrs/index.pl?Action=AgentTicketZoom&TicketNumber=",
TMBW	: "http://tmbw.net/wiki/",
TmNet	: "http://www.technomanifestos.net/?",
TMwiki	: "http://www.EasyTopicMaps.com/?page=",
Tools	: "http://toolserver.org/",
tswiki	: "http://wiki.toolserver.org/view/",
translatewiki	: "http://translatewiki.net/wiki/",
'Trash!Italia'	: "http://trashware.linux.it/wiki/",
Turismo	: "http://www.tejo.org/turismo/",
TVIV	: "http://tviv.org/wiki/",
TVtropes	: "http://www.tvtropes.org/pmwiki/pmwiki.php/Main/",
TWiki	: "http://twiki.org/cgi-bin/view/",
TyvaWiki	: "http://www.tyvawiki.org/wiki/",
Unreal	: "http://wiki.beyondunreal.com/wiki/",
Urbandict	: "http://www.urbandictionary.com/define.php?term=",
USEJ	: "http://www.tejo.org/usej/",
UseMod	: "http://www.usemod.com/cgi-bin/wiki.pl?",
usability	: "http://usability.wikimedia.org/wiki/",
ValueWiki	: "http://www.valuewiki.com/w/",
Veropedia	: "http://en.veropedia.com/a/",
Vinismo	: "http://vinismo.com/en/",
VLOS	: "http://www.thuvienkhoahoc.com/tusach/",
VKoL	: "http://kol.coldfront.net/thekolwiki/index.php/",
VoIPinfo	: "http://www.voip-info.org/wiki/view/",
Webisodes	: "http://www.webisodes.org/",
wg	: "http://wg.en.wikipedia.org/wiki/",
'Wiki'	: "http://c2.com/cgi/wiki?",
Wikia	: "http://www.wikia.com/wiki/c:",
WikiaSite	: "http://www.wikia.com/wiki/c:",
Wikibooks	: "http://en.wikibooks.org/wiki/",
Wikichat	: "http://www.wikichat.org/",
WikiChristian	: "http://www.wikichristian.org/index.php?title=",
Wikicities	: "http://www.wikia.com/wiki/",
Wikicity	: "http://www.wikia.com/wiki/c:",
WikiF1	: "http://www.wikif1.org/",
WikiFur	: "http://en.wikifur.com/wiki/",
wikiHow	: "http://www.wikihow.com/",
WikiIndex	: "http://wikiindex.com/",
WikiLemon	: "http://wiki.illemonati.com/",
Wikilivres	: "http://wikilivres.info/wiki/",
'WikiMac-de'	: "http://apfelwiki.de/wiki/Main/",
Wikimedia	: "http://wikimediafoundation.org/wiki/",
Wikinews	: "http://en.wikinews.org/wiki/",
Wikinfo	: "http://www.wikinfo.org/index.php/",
Wikinvest	: "http://www.wikinvest.com/",
Wikipaltz	: "http://www.wikipaltz.com/wiki/",
Wikipedia	: "http://en.wikipedia.org/wiki/",
WikipediaWikipedia	: "http://en.wikipedia.org/wiki/Wikipedia:",
Wikiquote	: "http://en.wikiquote.org/wiki/",
Wikischool	: "http://www.wikischool.de/wiki/",
wikisophia	: "http://wikisophia.org/index.php?title=",
Wikisource	: "http://en.wikisource.org/wiki/",
Wikispecies	: "http://species.wikimedia.org/wiki/",
Wikispot	: "http://wikispot.org/?action=gotowikipage&v=",
Wikitech	: "http://wikitech.wikimedia.org/view/",
WikiTI	: "http://wikiti.denglend.net/index.php?title=",
WikiTravel	: "http://wikitravel.org/en/",
WikiTree	: "http://wikitree.org/index.php?title=",
Wikiversity	: "http://en.wikiversity.org/wiki/",
betawikiversity	: "http://beta.wikiversity.org/wiki/",
WikiWikiWeb	: "http://c2.com/cgi/wiki?",
Wiktionary	: "http://en.wiktionary.org/wiki/",
Wipipedia	: "http://www.londonfetishscene.com/wipi/index.php/",
WLUG	: "http://www.wlug.org.nz/",
wmau	: "http://wikimedia.org.au/wiki/",
wmcz	: "http://meta.wikimedia.org/wiki/Wikimedia_Czech_Republic/",
wmno	: "http://no.wikimedia.org/wiki/",
wmrs	: "http://rs.wikimedia.org/wiki/",
wmru	: "http://ru.wikimedia.org/wiki/",
wmse	: "http://se.wikimedia.org/wiki/",
wmuk	: "http://uk.wikimedia.org/wiki/",
Wm2005	: "http://wikimania2005.wikimedia.org/wiki/",
Wm2006	: "http://wikimania2006.wikimedia.org/wiki/",
Wm2007	: "http://wikimania2007.wikimedia.org/wiki/",
Wm2008	: "http://wikimania2008.wikimedia.org/wiki/",
Wm2009	: "http://wikimania2009.wikimedia.org/wiki/",
Wm2010	: "http://wikimania2010.wikimedia.org/wiki/",
Wm2011	: "http://wikimania2011.wikimedia.org/wiki/",
Wmania	: "http://wikimania.wikimedia.org/wiki/",
Wmteam	: "http://wikimaniateam.wikimedia.org/wiki/",
WMF	: "http://wikimediafoundation.org/wiki/",
Wookieepedia	: "http://starwars.wikia.com/wiki/",
World66	: "http://www.world66.com/",
WoWWiki	: "http://www.wowwiki.com/",
Wqy	: "http://wqy.sourceforge.net/cgi-bin/index.cgi?",
WurmPedia	: "http://www.wurmonline.com/wiki/index.php/",
ZRHwiki	: "http://www.zrhwiki.ch/wiki/",
ZUM	: "http://wiki.zum.de/",
ZWiki	: "http://www.zwiki.org/",
'ZZZ Wiki'	: "http://wiki.zzz.ee/index.php/"
}
// section: end interwiki.js
//

