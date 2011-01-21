#!node
// main.js
//   hacked wiki engine using nodejs
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
    Section.infoFlag = true
  }
  // Forget results from previous run
  Section.all = {}
  Section.writes = []
  // Restart with fresh root container
  var section = new Section( null, null, file)
  markers || (markers = { begin: "// section: ", end: "// section: end" })
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
}

Section.collect = function( collector, visitor ){
  var stack = []
  var buf = []
  this.visit( function( class, section ){
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
  this.collect(
    function( leaf ){ return leaf.content },
    function( container, content ){ container.content = lean ? "" : content }
  )
}

Section.update = function( collector, updator ){
  this.collect(
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
  this.update(
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
  this.collect(
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
  var fs = require( 'fs')
  var ffile = require.resolve ? require.resolve( file) : file
  var rethrow = false
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
  version:  "0.08",
  name:     "SimpliJs",		// Name of the root wiki
  debug:    true,		// Debug mode means lots of traces
  test:     false,		// Test mode
  dir:      "wiki",		// Local to cwd, where files are, must exist
  port:     1234,		// 80 default, something else if behind a proxy
  domain:   "",			// To build permalinks, empty => no virtual hosting
  static:   "",			// To serve static files, optionnal, ToDo: ?
  protocol: "http://",		// Idem, https requires a reverse proxy
  scalable: false,		// ToDo: a multi-core/multi-host version
  onload: 			// List of pages loaded at startup
  ["PrivateContext", "AboutWiki", "RecentStamps", "PrivateCodes"],
 
  // Pattern for valid page names, please change with great care only
  wikiwordPattern: "("
    + "("
    // ~= CamelCase, @#_[ are like uppercase
    + "[@#A-Z_\\[][a-z0-9_.\\[-]{1,62}[@#A-Z_\\[\\]]"
    // 3codes
    + "|3\w\w-\w\w\w-\w\w\w"
    // 4codes
    + "|4\w\w\w-\w\w\w\w-\w\w\w\w-\w\w\w\w"
    // Twitter hash tag
    + "|#[A-Z_a-z0-9]{3,30}"
    // Twitter name  
    + "|@[A-Za-z_]{3,30}"
    // Facebook username  
    + "|[A-Za-z][A-Z_a-z0-9.-]{4,62}@"
    // Facebook group, ToDo: for further study
    + "|[A-Za-z][A-Z_a-z0-9.-]{4,62}#"
    // Free links, anything long enough but without / & infamous <> HTML tags
    // ToDo: I also filter out .", = and ' but I should not, but that would break
    + "|[A-Za-z_]*\\[[^.='\"/<>\\]]{3,62}\\]"
    + ")"
    // All previous followed by optionnal non space stuff, but not . ending
    + "(([\.][@#A-Z_a-z0-9-\\[\\]])|([@#A-Z_a-z0-9\\[\\]-]*))*"
  + ")",
  
  // Valid chars in 3codes, easy to read, easy to spell
  // 23 chars => 23^8 possibilities, ~= 80 000 000 000, 80 billions
  // 4codes: 23^15 ~= a billion of billions, enough
  valid3: "acefghjkprstuvxyz234678",	// avoid confusion (ie O vs 0...)
  
  // Pattern for dates, ISO format, except I allow lowercase t & z
  datePattern: "20..-..-..[tT]..:..:..\....[zZ]"
}
// Pattern to isolate wiki words out of stuff
SW.wikiWords = new RegExp(
  "([^=@#A-Za-z0-9_~\?&\)\/\\\">.-]|^)"
  + SW.wikiwordPattern
  + "", "gm"
)
// Pattern to check if a str is a wikiword
SW.wikiWord = new RegExp( "^" + SW.wikiwordPattern + "$")

// Each wiki has configuration options.
// Some of these can be overridden by wiki specific AboutWiki pages
// and also at session's level (or even at page level sometimes).
SW.config = 
// section: config.json, import, optional, keep
// If file config.json exists, it's content is included, ToDo
{
  lang:           "en",	// Default language
  title:          "",	// User label for wiki, cool for 3xx-xxx-xxx ones
  cols: 50,		// IETF RFCs style is 72
  rows: 40,		// IETF RFCs style is 58
  twoPanes:       false,// Use right side to display previous page
  cssStyle:       "",	// CSS page or url, patches default inlined CSS style
  canScript:      true,	// To please Richard Stallman, say false
  open:           true,	// If true everybody can stamp
  canClone:       true, // If true, clones are allowed
  veryOpen:       false,// If false, members need a mentor stamp
  veryOpenClones: true, // True if clones are very open by default
  premium:        false,// True to get lower Ys back
  backupWrites:   true,	// Log page changes in /Backup/ sub directory
  mentorUser:     "",	// default mentor
  mentorCode:     "",	// hard coded default mentor's login code
  mentors:        "",	// Users that become mentor when they log in
  adminIps:       "",	// Mentors from these addresses are admins
  debugCode:      "",	// Remote debugging
  fbLike:         true,	// If true, Like button on some pages
  meeboBar:       "",   // Meebo bar name, "" if none, ToDo: retest
  // Delays:
  thereDelay:        30 * 1000,	// Help detect current visitors
  recentDelay:  30 * 60 * 1000,	// Recent vs less recent
  awayDelay:    10 * 60 * 1000,	// Help logout old guests
  logoutDelay: 2 * 3600 * 1000,	// Help logout inactive members
  saveDelay:         30 * 1000,	// Save context delay
  resetDelay: 12 * 3600 * 1000,	// Inactive wikis are unloaded
  hotDelay:  45 * 84600 * 1000	// Short term memory extend
}
// section: end config.json

// Local hooks makes it possible to change (ie hack) things on a local install
// This is where one want to define secret constants, ids, etc...
$include( "hooks.js")
if( SW.name != "SimpliJs" ){
  Section.sys.puts( "Congratulations, SimpliJs is now " + SW.name)
}else{
  Section.sys.puts( "Humm... you could customize the application's name")
  Section.sys.puts( "see the doc about 'hooks', SW.name in 'hooks.js'")
}

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
// Some dependencies, nodejs's builtins only

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
  try{
    if( !argv.merge && Section.ize( file).isLean() ){
       Section.fatal( "lean " + file + " needs a merge")
    }
    if( argv.export ){ Section.ize( file, "export", {debug: false}) }
    if( argv.lean   ){ Section.ize( file, "lean",   {debug: false}) }
    if( argv.merge  ){ Section.ize( file, "merge",  {debug: false}) } 
  }catch( err ){ Section.fatal( file, err) }
})()

// -----------------
// section: debug.js
// Misc, debug stuff, primitive, that's my De&&bug darling, ultrafast because
// the trace message is not evaluated when not used.

var De   = SW.debug
var NDe  = false  // Constant

function bug(){
// Usage: De&&bug(...) and NDe&&bug(...)
  var list = []
  var with_sid = false
  for( item in arguments ){
    if( item == 0 && arguments[item] == Sw.currentSession ){
      with_sid = true
    }
    item = arguments[item]
    item = item ? item.toString() : "null"
    list.push( item)
  }
  // Get name of caller function
  var caller
  try{ buggy
  }catch( err ){
    caller = err.stack.split( "\n")[2]
    .replace( / \(.*/, "")
    .replace( "   at ", "")
    .replace( "Function.", "")
    .replace( /\/.*/, "")
    .replace( "<anonymous>", "?")
    .replace( / /g, "")
    // I don't think this is usefull but that was an attempt to get a
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
  // Handle this.xxx_de&&bug() type of traces
  if( DebugDomainTarget ){
    // DebugDomainTarget is set by the xxx_de getters
    if( DebugDomainTarget !== global
    &&  DebugDomainTarget !== Sw.currentSession
    ){
      try{ list.unshift( "O:" + DebugDomainTarget)
      }catch( err ){
        list.unshift( "O:???")
      }
    }
    if( caller ){
      list.unshift( "F:" + caller)
    }
    var domain
    if( domain = DebugDomainTarget.pullDomain() ){
      list.unshift( "D:", domain)
    }
    // Consume the target
    DebugDomainTarget = null
  // Handle De&&bug() type of traces
  }else{
    if( caller ){
      list.unshift( "F:" + caller)
    }
  }
  // Pretty print
  var msg = list.join( ", ")
  if( Sw.currentSession && !with_sid ){
    msg = "S: " + Sw.currentSession.id + ", " + msg
  }
  msg = msg
  .replace( /: , /g, ":")
  .replace( /, , /g, ", ")
  .replace( / , /g,  ", ")
  .replace( /: /g,   ":")
  .replace( /:, /g,  ":")
  // ToDo: log to a file
  Sys.puts( msg)
  // Log into buffer displayed in HTML
  if( Sw.currentSession ){
    // ToDo: traces include confidential informations, that's bad
    if( Sw.currentSession.isDebug ){
      Sw.currentSession.logTrace( msg)
    }
  }
}

function ndebug(){
  De&&bug( "Turn off debugging traces")
  De = false
}

function debug(){
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
    bug( "BUG: Assert failure ", Sys.inspect( arguments.callee))
    if( msg ){
      bug( "Assert msg: ", msg)
    }
    // Turn maximal debugging until process dies, nothing to lose
    if( global.assert_de ){
      De = true
      var item
      for( item in DebugDomains ){
        global.debugDomain( item)
      }
      throw new Error( "Assert failure")
    }else{
      try{ buggy 
      }catch( err ){
        err.stack.split( "\n").map( function( line ){
          bug( "Stack:", line)
        })
      }
    }
  }
}

function mand_eq( a, b, msg ){
  if( a == b )return
  msg = (msg ? "(" + msg + ")" : "") + " != " + a + " and " + b
  mand( false, msg)
}

// Even more assert style stuff, for things that bite me

function once( cb ){
// Assert that cb is called once only
// In debug mode, add a check about cb not reentered
// In ndebug mode, return cb unchanged
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

var DebugDomains = {}

// Tracks last referenced object is xxx_de&&bug style expressions
var DebugDomainTarget = null

Debuggable = {}

Debuggable.setDeId = function( id ){
  this.deId = id
}

Debuggable.debug = function(){
  De = true
  this.__defineGetter__( "de", function(){
    DebugDomainTarget = this
    return De
  })
} 
Debuggable.ndebug = function(){
  De = false
  this.__defineGetter__( "de", Sw.noop)
}

Debuggable.toggleDebug = function(){
  this.de ? this.ndebug() : this.debug()
}

Debuggable.debugDomainIsOn = function( name ){
  var named = name + "_de"
  return this[named] ? true : false
}

Debuggable.debugDomain = function( name ){
  var named = name + "_de"
  // Sys.puts( "debugDomain for " + name)
  De = true
  //this[named]&&bug( "TurningOn, domain: ", name)
  if( this === global ){
    DebugDomains[name] = name
    global.__defineGetter__( named, function(){
      return De && (this.domain = DebugDomains[name])
    })
  }else{
    this.__defineGetter__( named, function(){
      // Sys.puts( "GETTER " + named + " ON " + this)
      DebugDomainTarget = this
      return De && (this.domain = DebugDomains[name])
    }) 
  }
  //this[named]&&bug( "TurnedOn, domain: ", name)
  if( "deep_".starts( name) ){
    this.debugDomain( name.substr( "deep_".length))
  }
}

Debuggable.pullDomain = function(){
// Get and clear the last checked domain, usually to display it
  var ret = this.domain
  this.domain = null
  return ret || ""
}

Debuggable.ndebugDomain = function( name ){
  var named = name + "_de"
  this[named]&&bug( "TurningOff, domain: ", name)
  if( this === global ){
    // Sys.puts( "ndebugDomain for " + name)
    DebugDomains[name] = null
    global.__defineGetter__( named, Sw.noop)
  }else{
    // Inherit from global domains
    this.__defineGetter__( named, function(){
      DebugDomainTarget = this
      return De && (this.domain = DebugDomains[name]) // global[named]
    })
  }
  this[named]&&bug( "TurnedOff, domain: ", name) // Should not display
  if( !"deep_".starts( name) ){
    this.ndebugDomain( "deep_" + name)
  }
}

Debuggable.toggleDomain = function( name ){
  if( DebugDomains[name] ){
    this.ndebugDomain( name)
    De&&mand( !this.debugDomainIsOn( name))
    if( this === global ){
      De&&mand( !DebugDomains[name] )
    }else{
      De&&mand( this[name = "_de"] == DebugDomains[name])
    }
  }else{
    this.debugDomain( name)
    De&&mand( this.debugDomainIsOn( name))
    if( this === global ){
      De&&mand( DebugDomains[name] == name )
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
    msg&&De&&bug( msg, ", make debuggable, adding method: ", item)
    target[item] = Debuggable[item]
  }
  // Inherit domains' states from global value for these domains
  for( item in DebugDomains ){
    msg&&De&&bug( msg, ", make debuggable, adding domain: ", item)
    var named = item + "_de"
    // Either set or clear depending on global value
    global[named]
    ? target.debugDomain(  item)
    : target.ndebugDomain( item)
    msg&&De&&mand( named in target, "getter " + msg + "." + named)
  }
  msg&&De&&bug( msg, ", make debuggable, adding de getter")
  target.debug()
  // Set up a class label that is better looking than basic "typeof"
  if( class_label ){
    target.classLabel = class_label
  }
  De&&mand( target.de)
}

De&&mand( this !== global ) // Watch out!

MakeDebuggable( global)

DeclareDebugDomain = function( name, is_on ){
  is_on ? global.debugDomain( name) : global.ndebugDomain( name)
  if( !"deep".starts( name) ){
    DeclareDebugDomain( "deep_" + name, is_on == "deep")
  }
}

// section: debugdomains.js
if( De ){

DeclareDebugDomain( "ntest",   false)
DeclareDebugDomain( "test",    "deep")
DeclareDebugDomain( "assert",  "deep")	// exit on assert failure?
DeclareDebugDomain( "deep",    "deep")  // traces for hard bugs
DeclareDebugDomain( "cookie",  true)
DeclareDebugDomain( "store",   "deep")
DeclareDebugDomain( "http",    true)
DeclareDebugDomain( "static",  "deep")	// Static files
DeclareDebugDomain( "yaml",    false)
DeclareDebugDomain( "context", true)
DeclareDebugDomain( "config",  false)
DeclareDebugDomain( "f3Code",  "deep")
DeclareDebugDomain( "bot",     "deep")
DeclareDebugDomain( "misc",    "deep")
DeclareDebugDomain( "option",  "deep")
DeclareDebugDomain( "sane",    "deep")  // Sanitizations
DeclareDebugDomain( "bug",     "deep")
DeclareDebugDomain( "rest",    true)
DeclareDebugDomain( "monit",   "deep")
DeclareDebugDomain( "lang",    "deep")
DeclareDebugDomain( "get",     "deep")
DeclareDebugDomain( "post",    "deep")
DeclareDebugDomain( "send",    "deep")
DeclareDebugDomain( "mail",    "deep")
DeclareDebugDomain( "queue",   "deep")
DeclareDebugDomain( "acl",     "deep")
DeclareDebugDomain( "wiki",    "deep")
DeclareDebugDomain( "init",    "deep")
DeclareDebugDomain( "session", "deep")
DeclareDebugDomain( "login",   "deep")
DeclareDebugDomain( "user",    "deep")
DeclareDebugDomain( "inline",  false)
// section: end debugdomains.js

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
  //Sys.puts( "DebugDomains: ", Sys.inspect( DebugDomains))
  //Sys.puts( "ntest_de: " + Sys.inspect( ntest_de))
  De&&mand( !ntest_de,    "!ntest_de")
  De&&mand( test_de,      "test_de")
  De&&mand( deep_test_de, "deep_test_de")
  global.toggleDomain( "test")
  //De&&mand( TraceTestInstance.test_de, "TTI.test_de got lost")
  //TraceTestInstance.toggleDomain( "test")
  TraceTestInstance.test_de&&bug( 
    "Bad TTI.test_de: ", TraceTestInstance.test_de,
    "DebugDomains: ", Sys.inspect( DebugDomains))
  De&&mand( !TraceTestInstance.test_de, "!TTI.test_de")
  De&&mand( !global.debugDomainIsOn( "deep_test") )
  global.pullDomain()
  De&&bug( "Test with Debuggable.test() is a success")
}

if( SW.test ){
  Debuggable.test() 
  global.debugDomain(  "test")
}else{
  global.ndebugDomain( "test")
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
  dir || (dir = ".")
  De&&mand( !"/".ends( dir) )
  // ToDo: dir = dir + ".dir", because a page name can collide with a dir name
  // But first I need a migration tool to rename directories
  // Right now the only case where a page name is also a valid direcotry name
  // is when the page is the name of a facebook user... hence, I patch
  if( "@".ends( dir) ){
    dir += ".dir"
  }
  this.dir  = "./" + SW.dir + "/" + dir
  this.path = this.dir + "/"
  this.backup = "./" + SW.dir + "/Backup/"
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

PageStore.get = function( name, cb ){
// Get page from store, async. calls cb( err, body)
  // Encode weird names to get a decent file name
  if( name.includes( "[") ){
    name = encodeURIComponent( name)
  }
  var pathname = this.path + name
  var that     = this
  return this.withDir( function( err ){
    if( err ){
      that.wiki.error( "some issue with mkdir, err:", err)
      return cb.call( that, err)
    }
    // ToDo: Lookup on external source, i.e. S3, CouchDB...
    // S3: https://github.com/LearnBoost/knox
    // ToDo: Dropbox, https://github.com/evnm/dropbox-node
    this.store_de&&bug( "fromStore:", name, "in:", this.path)
    this.fs.readFile(
      pathname,
      "utf8",
      function( err, data){
        that.isTransient || that.wiki.countPageReads++
        if( !err ){
          that.isTransient || (that.wiki.countPageReadBytes += data.length)
          that.store_de&&bug( "Read:", name,
            "data:", data.substr( 0, 30),
            "length:", data.length
          )
          if( !data ){
            that.bug_de&&bug( "BUG? null data in file:", pathname)
            data = "ERROR"
          }
        }else{
          that.isTransient || that.wiki.countPageMisses++
          that.store_de&&bug( "ReadError:", name, "err:", err)
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
  // Encode weird names to get a decent file name
  if( name.includes( "[") ){
    name = encodeURIComponent( name)
  }
  this.withDir( function( err ){
    if( err ){
      return cb.call( that, err)
    }
    this.store_de&&bug( "toStore:", name)
    this.deep_store_de&&bug( "Write, data:", data.substr( 0, 30))
    this.fs.writeFile(
      this.path + name,
      data,
      once( function page_store_put_cb( err ){
        if( that.isTransient ){ return cb.call( that, err) }
        if( !err ){
          that.wiki.countPageWrites++
          that.wiki.countPageWriteBytes += data.length
        }else{
          that.wiki.error( "write:", that.path + name, "err:", err)
        }
        cb.call( that, err)
        // Have a backup until out of beta, in ./Backup/ directory
        if( that.wiki.config.backupWrites ){
          var bak = that.backup
          // Note: flat names, / expands into .. (used to be .)
          + that.wiki.fullname().replace( /\//g, "..")
          + name + "~" + Sw.timeNow
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
      !neg && mand(  SW.wikiWord.test( a), "false negative " + a)
      neg  && mand( !SW.wikiWord.test( a), "false positive " + a)
      var match = SW.wikiWords.exec( " " + a + " ")
      if( !match ){
        mand( neg, "bad match " + a)
      }else{
        mand( match[1] == " ", "bad prefix for " + a)
        match = match[2]
        !neg && mand( match == a, "false negative match: " + a + ": " + match)
        neg  && mand( match != a, "false positive match: " + a + ": " + match)
        match = SW.wikiWords.exec( "~" + a + " ")
        if( match ){
          mand( neg, "bad ~match " + a)
        }
      }
    }
    test( "WikiWord")
    test( "WiWi[jhr]")
    test( "W_W_2")
    test( "@jhr")
    test( "@jhr.", true)
    test( "@jhr@again")
    test( "j-h.robert@")
    test( "#topic")
    test( "#long-topic5")
    test( "Word", true)
    test( "word", true)
    test( " gar&badge ", true)
    test( "UserMe@myaddress_com")
    test( "aWiki", true)
    test( "aWikiWord", true)
    test( "_word_")
    test( "_two words_", true)
    test( "[free link]")
    test( "User[free]")
    test( "[free]Guest")
    test( "[free/link]", true)
  }
  // Some metaprogramming
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
    this.protoGuest = parent.protoGuest
  }
  // ToDo: handle options
  var that = this
  var done = false
  // Preload some pages, asynchronous
  // ToDo: I should store these pages *inside* PrivateContext
  var aboutwiki = this.lookupPage( "AboutWiki")
  this.aboutwikiPage = aboutwiki
  var context   = this.lookupPage( "PrivateContext")
  this.contextPage = context
  var homepage  = this.lookupPage( "HomePage")
  homepage.containerPage = context
  var onload = Sw.copyArray( SW.onload)
  this.init_de&&bug( "Preload:", onload.join( '+'))
  var loaded = {}
  var loader = function(){
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
            that.init_de&&bug( "loaded: ", page)
          }
          loader.call( that)
        })
      }else{
        loader.call( that)
      }
    }else if( !done ){
      done = true
      // ToDo: Maybe I should store wiki's config in PrivateContext?
      var config = that.allPages["AboutWiki"]
      that.processConfig( config)
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
  if( (Sw.timeNow - wiki.timeLastTouched) > wiki.config.resetDelay ){
    return wiki.reset()
  }
  setTimeout( Wiki.timeoutAutoreset, wiki.config.resetDelay, wiki)
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

Wiki.lookupPage = function( pagename ){
// Returns the unique Page object that references said page.
// That does not mean that the page exists on store, just that it is referenced.
// Note: if no name is provided, a random one is generated.
  pagename || (pagename = this.random3Code( "-"))
  return Page.lookup( this, pagename)
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
    this.setOptions( this.config, config_proto.data, "wiki")
    this.config_de&&bug( "was updated using data in:", config_proto)
  }else{
    this.bug_de&&bug( "BUG? no proto data in:", config_page)
  }
  // Override with page's local data
  this.setOptions( this.config, config_page.data, "wiki")
}

Wiki.setOptions = function( base, options, about ){
// ! alters the base hash using options
// This is how I set up a wiki's config.
  options || (options = {})
  //this.deep_config_de&&bug( "Setting options:", Sys.inspect( options))
  var option
  var val
  var ok
  var virtual
  for( option in options ){
    val = options[option]
    ok = true
    virtual = false
    // Wiki or user level options
    if( option == "rows" ){
      val = parseInt( val, 10)
      if( isNaN( val) || val < 5 || val > 200 ){
        ok = false
      }	
    }else if( option == "cols" ){
      // ToDo: better val for fluid?
      if( val == "fluid" ){ val = "0" }
      val = parseInt( val, 10)
      if( isNaN( val) || val < 10 || val > 200 ){
        ok = false
      }
    }else if( option == "title" ){
      val = Wiki.htmlize( Wiki.sanitizeTitle( val.substr( 0, 32)))
    }else if( option == "style" ){
    }else if( option == "lang" ){
      if( val != "en" && val != "fr" ){
        ok = false
      }
    }else if( option == "veryOpen" && about == "wiki" ){
      // ToDo: add a command line option
      if( true || !this.isRoot() ){
        val = val.toString()
        val = (val != "false") && (val != "No")
        // If veryOpen then force openness
        if( val ){
          base["open"] = true
        }
      }else{
        // See PrivateRootConfig hack
        this.config_de&&bug( "Cannot change openess of root wiki")
        ok = false
      }
    }else if( option == "open" && about == "wiki" ){
      if( true || !this.isRoot() ){
        val = val.toString()
        val = (val != "false") && (val != "No")
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
      val = val.toString()
      val = (val != "false") && (val != "No")
    }else if( option == "pureTransientClones" && about == "wiki" ){
      val = val.toString()
      val = (val != "false") && (val != "No")
    }else if( option == "canScript" ){
      val = val.toString()
      val = (val != "false") && (val != "No")
    }else if( option == "twoPanes" ){
      val = val.toString()
      val = (val != "false") && (val != "No")
    }else if( option == "cssStyle" ){
      val = val.toString()
      // ToDo: more sanitization?
    }else if( option == "meeboBar" ){
    }else if( option == "fbLike" ){
      val = val.toString()
      val = (val != "false") && (val != "No")
    // Session level options
    }else if( option == "Mail"       && about == "user" ){
    }else if( option == "Code"       && about == "user" ){
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
    // ToDo: support more options
    }else{
      ok = false
    }
    if( ok ){
      this.config_de&&bug( "set:", about, "option:", option, "val:", val)
      base[option] = val
    }else{
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
    // Append to error.txt in current directory
    Sw.log.write( Sw.dateNow.toISOString() + " " + list)
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
// When processing a request, I look at the url.
// If it contains a ?cid query parameter then it means that the link was
// (probably) built by the wiki engine while a user was browsing a wiki.
// In that later case, I invoke the
// function that was registered for that purpose.
// Else, I login the user in a new session unless some cookie says differently

  var queued = req.queued
  if( queued ){
    this.http_de&&bug( "reprocessHttpRequest, R:", req.deId)
  }else{
    this.countHttpRequests++
    this.http_de&&bug( "\n")
    if( De ){
      MakeDebuggable( req)
      req.setDeId( ++Sw.requestId)
    }
  }
  this.http_de&&bug( "HTTP:", req.method, "R: ", req.deId,
    "url:", Sys.inspect( req.url))
  var parsedurl = Url.parse( req.url)
  var pathname = parsedurl.pathname || ""
  this.deep_http_de&&bug( "requestPath:", pathname)
  
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
  if( /\.(html|png|svg|txt|css|js|google)$/.test( pathname) ){
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
      if( "rest".starts( pathname) ){
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
          closure = this.getRoot().allClosures[this.protoGuest.restClosure]
        }
      // If not rest, I need to figure out a Session to handle the request
      }else{
        closure = this.lookupSession( pathname, query, req)
      }
      if( closure === false ){
        this.login_de&&bug( "Not a login, R:", req.deId)
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
  data.provider_url  = SW.protocol + "//" + SW.domain
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
  var session = closure.session
  req.session = session
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

  this.wiki_de&&bug( "logUser, S:", session)
  De&&mand( session.wiki == this )
  
  // Associate session with login code
  if( true ){
    if( session.loginCode ){
      if( !this.allSessionsByCode[session.loginCode] ){
      }
      this.login_de&&bug( "session:", session,
        "logCode:", session.loginCode)
      this.allSessionsByCode[session.loginCode] = session
      De&&mand( session.wiki == this, "bad session.wiki")
    }
  }
  
  // If member
  if( !session.isGuest() ){
    this.login_de&&bug( "session:", session,
      "logMember:", session.loginName)
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
        this.login_de&&bug( "comingBack: ", session.loginName)
        // old.logout( "relog")
      }
    }
    this.allSessionsByName[session.userName()] = session

  // If guest
  }else{
    this.login_de&&bug( "logGuest: ", session.userName())
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

  session.trackUser()
}

Wiki.logout = function( session ){
// Called whenever a user is logged out
  this.wiki_de&&bug( "logout, S:", session)
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
    setTimeout( Wiki.timeoutCheckGoneSession, session.wiki.config.awayDelay, session)
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
    pagename = 'at_' + Wiki.encode( pagename.substr( 1))
  // Facebook username
  }else if( '@'.ends(   pagename) ){
    pagename = '_at_' + Wiki.encode( pagename.substr( 0, pagename.length - 1))
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
// It returns a closure if it manage to retrieve one or if a brand new
// Session was started.
// It returns false if this is a not a request for a wiki (ie static file).
// It returns "index.html" when path is "/comeback" but there is no cookie.
// It returns null if further processing (async) is engaged.
  
  // There is already a session attached when parent wiki did some login
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
  // Facebook specific. I don't know what is it about
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

  // If basename isn't a WikiWord, assume its the name of a wiki, add HomePage
  // Idem if page is a Twitter or Facebook screen name
  // Idem if fbgroup/ or fbpage/ prefix
  // Idem for user/ prefix
  // Idem for two letters country code
  // Idem if full path is all lower case (works for 3 codes)
  if( basename
  && (!SW.wikiWord.test( basename)
   || ( page == basename
     && ("@".starts( basename) || "@".ends( basename))
     && basename.toLowerCase() == basename)
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
      && !cookies.includes( "sw_facebook_id")
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
        if( page ){
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
  if( referer && referer.includes( "index.html") ){
    if( session ){
      session.logout( "index.html")
      session = null
    }
  }
  
  // If no valid session, create a new one or reuse current
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
    }
    if( is_debug ){
      De&&bug( wiki, ", debugMode: ", is_debug)
      session.isDebug = true
      session.setDeId( session.id)
    }
    return session.login( wiki, subdomain, custom, page, code, query, req)
  }
  
  // If valid session, put the visitor back to where she was
  De&&mand( session.wiki == wiki )
  var closure = wiki.getRoot().allClosures[session.postClosure]
  wiki.login_de&&bug( "returningSession:", session, "userloginId:", 
    session.loginId, "name:", session.userName())
  if( !closure ){
    De&&bug( "Bad session: ", session)
    De&&bug( "dumpSession: ", session.dump())
  }
  De&&mand( closure, "null closure")
  return closure
}

// section: end wikilogin.js

Wiki.registerClosure = function( f ){
// Remember a closure, and its session. Returns a printable unique id.
  var id
  // ToDo: Try a random id and check if it's user is still there,
  // or else... memory leaks pretty quickly I'm afraid
  id = this.getRoot().allClosures.length
  this.getRoot().allClosures[id] = f
  f.id = id
  return id
}

Wiki.deregisterClosure = function( f ){
  this.getRoot().allClosures[f.id] = null
}

Wiki.getClosure = function( closureid ){
  NDe&&bug( "?Wiki closure " + closureid )
  if( !closureid ){ return null }
  closureid = parseInt( closureid, 10)
  // Closure ids are global, ie registered at the root wiki level only
  var closure = this.getRoot().allClosures[closureid]
  // Check if the closure is about a gone session, if so, filter out
  if( closure
  && closure.session
  && closure.session.isAway()
  && closure.session.isGone
  ){
    delete this.getRoot().allClosures[closureid]
    closure = null
  }
  return closure
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
  return this.getRoot().allClosures[closure_id]
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

Wiki.forEachPage = function( home, session, cb ){
// Iterate all reacheable pages from some root page.
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
    && (!session || session.mayRead( page = session.lookup( pagename)))
    ){
      De&&bug( "Visiting ", pagename)
      page.read( function( err, page ){
        if( !err ){
          var content = page.isDraft() ? page.getNondraftBody() : page.getBody()
          total_size += content.length
          var reg = new RegExp( SW.wikiWords)
          var word
          var referer = page // that.lookupPage( page)
          cb.call( that, referer)
          while( match = reg.exec( content) ){
            NDe&&bug( "Match: ", Sys.inspect( match))
            if( (word = match[2]) ){
              if( !"Do".starts( word) ){
                word = word.substr( 0, 99)
                De&&bug( "word ", word)
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
        visit()
      })
    }else{
      if( true || !session ){
        De&&bug( "Wiki total size: ", total_size)
      }
      
      cb.call( this, null)
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
// Must never be called against a draft page.  
  page.assertIsPage()
  if( !page.isAbout() ){
    this.deep_store_de&&bug( "no proto, Invoke cb:", Sys.inspect( cb))
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
  && "Original" == cached.body.frontLine()
  if( !need_original
  &&  cached && cached.wasIncarned()
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
    if( err || !body || need_original ){
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
  return size ? vals : null
}

Wiki.injectBasicYaml = function( text, hash ){
// Replaces old basic Yaml in text by new one built from data hash.
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
  insert = insert.join( "\n") + "\n"
  // "Add" if no previous Yaml section
  var ii = text.search( /\n+---\n/) // indexOf( "\n---\n")
  if( ii < 0 ){
    if( new_size ){
      text = text.replace( /\n*$/, "\n") + insert
      this.yaml_de&&bug( "newSection:", insert)
    }
  // "Replace" if some previous Yaml section
  }else{
    var head = text.substr( 0, ii + 1)
    var tail = text.substr( text.indexOf( "\n---\n") + "\n---\n".length)
    // Detect end of yaml on first non matching line
    // ToDo: improve the pattern, this one eats lines with : in them
    ii = tail.search( /^[^:]*$/m)
    if( ii < 1 ){
      tail = ""
    }else{
      tail = tail.substr( ii - 1)
    }
    if( !new_size ){ insert = "" }
    // Insert at the end
    text = [head, tail, insert].join( "")
    this.yaml_de&&bug( "Yaml section:", insert)
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
  this.f3Code_de&&bug( "Random 3Code: ", str)
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
  if( moniker == SW.name ){
    return SW.protocol + "//" + SW.name
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
    this.bug_de&&bug( "still touched hard despite save & no changes")
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
    this.parentWiki.queuedRequests.push(
      {cb: function( wiki ){ wiki.restoreContext2 }, wiki:this}
    )
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
  var delay = this.isResetting() ? 0 : this.config.saveDelay
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
    this.touchedHard = true
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
    // If item is a wikiname, keep it that way 
    if( SW.wikiWord.test( item) ){
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
        item = item.toLowerCase()
      }else{
	item = item
      }
      list.push( item)
    // Else convert to lower case "orthodox" chars
    }else{
      if( item ){
        if( itemidx != last_item_idx ){
          list.push( item.toLowerCase())
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
  if( SW.wikiWord.test( name) ){	  
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
  if( !SW.wikiWord.test( text) && text.length > 1 ){
    text = text.substr( 0, 1)
    + text.substr( 1, 1).toLowerCase()
    + text.substr( 2)
  }
  // If that is not enough, get rid of embedded @# & add some postfix
  if( !SW.wikiWord.test( text) ){
    this.de&&bug( "Not enough:", text)
    // ToDo: do I really want to get rid of @, # and -, not sure...
    //text = text.replace( /@/g, "At")
    //.replace( /#/g, "Hash")
    //.replace( /-/g, "_")
    if( !SW.wikiWord.test( text) ){
      this.de&&bug( "Still not enought: ", text)
      text = text.toLowerCase().capitalize() + (postfix ? postfix : "Page")
      if( !SW.wikiWord.test( text) ){
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
  this.inherited = inherited
  if( inherited ){
    wiki.deep_de&&bug( "inheritedNewPage:", name)
    De&&mand( this.body == inherited.body
      || (inherited.nondraft && this.body == inherited.nondraft.body),
      "inherited new body mismatch"
    )
  }
  // Code pages are contained by the wiki's PrivateContext page
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
// Write access to property of page.
// This does not update the page in store
  this.data || (this.data = {})
  if( this.data[key] != value ){
    this.touch()
  }
  if( value ){
    this.data[key] = value
  }else{
    delete this.data[key]
  }
  return value
}

Page.lookup = function( wiki, pagename ){
// Static
  De&&mand( wiki )
  De&&mand( pagename )
  pagename = pagename.toString()
  // __defineGetter__, __proto__, etc... can't be redefined...
  if( "_" === pagename.charAt( 1) && "_" === pagename.charAt( 0) ){
    if( pagename === "__defineGetter__" ){
      pagename = "__Buggy_defineGetter__"
    }else if( pagename === "__proto__" ){
      pagename = "__Buggy_proto__"
    }
  }
  // If page was already signaled, return it
  var page = wiki.allPages[pagename]
  if( page ){
    De&&mand( page.name, "no name for " + pagename )
    return page
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
  this.body = body
  this.err  = err
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
  page.resetLinks()
  page.err = page.err
}

Page.incarnUpdate = function( from ){
// If page is a draft, reincarn it using fresh data from store
// "from" defaults to current non draft page
// Note: draft body is kept
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

Page.read = function( cb ){
// Get content from store or cache, then call cb( err, page)
// If page is a draft, content is in the attached non draft page
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
  && "Original" == cached.body.frontLine()
  if( !need_original
  &&  cached && cached.wasIncarned()
  // If draft, make sure non draft page was incarned, ToDo: remove
  && (!page.nondraft || page.nondraft.wasIncarned())
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
      var body = page.getVirtualBody( that.name)
      // Fall back to store if container does not contain specified page
      if( !body || need_original ){
        page.store_de&&bug( "virtual read, not in container, try store")
        return that.wiki.fetchPage( that.name, function( err, page ){
          // Update draft if any
          that.incarnUpdate()
          // Make sure next write will put in container
          that.de&&mand( that.containerPage )
          cb.call( that, err, that)
        })
      }
      // OK, I got the content from the container
      try{
        body = JSON.parse( body)
      }catch( err ){
	that.bug_de&&bug( "virtual body, JSON err:", err, "body:", body)
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
        that.wiki.touch()
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
// Returns true if page was deleted
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
  if( this == this.wiki.aboutWikiPage )return false
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
  if( this.timeVisited() > Sw.timeNow - this.wiki.hotDelay ){
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
  ))
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
  ||     this.kindIs( "MailId")
}

Page.getService = function(){
// Returns the service that the user id page references.
// Returns "" if page is not a user id page.
  if( !this.isUserId() )return ""
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
  : (alternate_text || this.getBody()).frontLine()
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

User.reset = function(){
  this.user_de( "reset()")
  this.wiki  = null
  this.id    = null
  if( this.local ){ this.local.reset() }
  this.local = null
  this.page.user = null
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

User.getMailId = function(){
  return this.isMail()
  ? this.id["Mail"][0]
  : this.getPrimaryId( "Mail")
}

User.isLocalOnly = function(){
  this.de&&mand( !this.isProxy() )
  return !this.getTwitterId() && !this.getFacebookId()
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

User.isMail = function(){
// True if user is a proxy that has a mail address
  return this.isProxy() && this.service == "Mail"
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
    user.save( function( serr, user, page ){
      user.de&&mand( serr || !user.isDirty, "dirty" )
      // Create a bi-directional relationship
      var otheruser
      if( user.isLocal ){
        otheruser = User.lookup( that.wiki, service, id).user
      }else{
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

User.trackMailId = function( id, cb ){
// Track the user's facebook id
  this.trackServiceId( "Mail", id, cb)
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
      return cb.call( that, err, that, that) 
    }
    // If loaded object is a proxy, let's see how to get to the local User
    that.de&&mand( that.id[SW.name] && that.id[SW.name][0] )
    // When no local User, allocate one
    if( !that.id[SW.name] || !that.id[SW.name][0] ){
      // that.de&&mand( false, "missing local id")
      // No local user yet, set one, random. ToDo: collision avoidance
      var random = Wiki.random3Code()
      that.user_de&&bug( "new local random id:", random)
      that.trackServiceId( SW.name, random, function( err, local_user){
        return cb.call( that, err, local_user)
      })
      return
    }
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
}

Session.prototype = Session
MakeDebuggable( Session, "Session")

Session.toString = function(){
// Debug label for object
  return "<S:" + this.id + " "
  + this.loginName + " "
  + (this.wiki ? this.wiki.fullname() : "New ")
  + this.getCurrentPage()
  + ">"
}

Session.dump = function( sep ){
  var buf = ["Session"]
  var that = this
  var attr = "id wiki loginId loginName loginCode isGone canMentor"
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
// .login() multiple times, with .logout( "reuse") between calls. This
// happens when a user logs into a sub wiki, as she is first logged in the
// parent wiki before be logged in the child wiki.

  var that = this
  var relog = false
  this.wiki = wiki
  this.login_de&&bug( "Session.login")
  De&&mand( !wiki.isInitializing() || !req )

  // Detect "relog"
  if( this.config ){
    this.login_de&&bug( "relog")
    relog = true
  }
  
  // Session inherits config from global wiki's config
  this.config = Sw.copyHash( wiki.config)
  // Parse additional session's config parameters from query string
  if( query && query.length ){
    this.login_de&&bug( "Session.login with query parameters")
    this.wiki.setOptions( this.config, query, "session")
  }
  
  // Default to HomePage
  var page = path ? path : "HomePage"
  // ToDo: url decode, for e acute style of urls
  
  // Sanitize a little
  page = page.substr( 0, 99)
  if( !page.match( SW.wikiWord) ){
    page = page.replace( /\//g, "Slash")
    page = this.wikinamize( page)
    if( !page || page == "WikiWord" ){
      page = "HomePage"
    }
  }
  if( !page ) page = "HomePage"
  if( page == "/" ) page = "HomePage"
  
  this.loginPage = this.lookup( page)
  this.subdomain = subdomain
  this.custom    = custom
  if( !this.loginId ){
    this.loginId = this.wiki.countLogins++
  }
  if( code ){
    this.login_de&&bug( "Session.login with code: ", code)
    this.loginCode     = code
    this.loginWithCode = true
  }else{
    if( !this.loginCode ){
      this.loginCode = (code || "F" + Wiki.random3Code()).capitalize()
      this.loginWithCode = false
    }
  }
  this.loginCodePage = this.lookup( "Code" + this.loginCode)
  this.isGuestMember = false // Anonymous Guest by default
  this.allClosures = []
  this.viewClosureCache = {}
  if( !relog ){
    // Name guest using the target page, this will change maybe
    this.loginName = this.guestnamize( page)
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
  }
  this.httpLogin = req ? req : {headers:{}} // protoGuest has no req
  this.isOembed  = this.httpLogin.oembed
  this.isIframe  = this.httpLogin.iframe
  // Tune display to get bigger characters if embedded
  if( this.isOembed || this.isIframe ){
    this.config.rows = 10
  }
  this.isBot     = req && this.wiki.isBotRequest( req)
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
        }else
        if( agent.includes( "facebook") ){
          this.loginName = "FacebookBotGuest"
        }else
        if( agent.includes( "Pingdom") ){
          this.loginName = "PingdomBotGuest"
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
  if( query && query.length ) this.login_de&&bug( this, ", loginQuery: ", Sys.inspect( query))
  if( query && query.lang ){
    this.config.lang = query.lang.substr( 0, 2)
    this.lang_de&&bug( "URI specified lang: ", this.config.lang)
  }
  
  if( !relog ){
    this.postClosure = this.registerClosure( function( that ){
      //De&&bug( Sys.inspect( this))
      this.post_de&&bug( ", method: " + this.method)
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
  var closure
  
  // Some additional stuff if login with an invitation code page
  if( code ){
    var page = this.lookup( "Code" + code.capitalize())
    that.login_de&&bug( this, ", codePageLogin: ", page)
    // I load the code page and I proceed with the login
    page.read( function( err, page ){
      // ToDo: err handling
      that.codeLoginForm( page, req)
    })
    return null
  }

  // If identified User object... weird
  if( this.user ){
    this.bug_de&&bug( "Already bound to user:", this.user)
  }
  if( true ){
    // Get this.twitterName & id and facebookName & id from cookies
    this.useTwitterNameCookie(  req)
    this.useFacebookNameCookie( req)

    // Some additional stuff if login with a twitter name
    if( this.twitterName ){
      that.login_de&&bug( "Login using twitterScreenName:", this.twitterName)
      // I load the desired page and I proceed with the login 
      page = this.lookup( page)
      page.read( function( err, page){
        // ToDo: err handling
        that.twitterLoginForm( that.twitterName, page, req)
      })
      return null
    }
    // Some additional stuff if login with a facebook name
    if( this.facebookName ){
      that.login_de&&bug( "Login using facebookScreenName:", this.facebookName)
      // I load the desired page and I proceed with the login 
      page = this.lookup( page)
      page.read( function( err, page){
        // ToDo: err handling
        that.facebookLoginForm( that.facebookName, page, req)
      })
      return null
    }
  }
  
  // User logged, postclosure will handle the request & render result
  this.wiki.logUser( this)
  closure =  this.wiki.getRoot().allClosures[this.postClosure]
  closure.session = this
  return closure
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
      is_mentor = false
    }else{
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
  // If name of user matches name of wiki, make user a mentor
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
      is_mentor = false
    }else{
      this.isOwner = true
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


Session.userLoginForm = function( user, is_mentor, page, req ){
// This method is called after .login() if there is any information available
// to somehow identify (or even authenticate) the user.
// It is called by either twitterLoginForm() or facebookLoginForm()

  this.login_de&&bug( "userLogin:", user, "mentor:", is_mentor, "page:", page)

  // make user a mentor if wiki is very open by default
  var is_very_open_by_default = this.wiki.isVeryOpenByDefault()
  if( is_very_open_by_default ){
    this.login_de&&bug( "identified users are mentors of still very open wiki")
    is_mentor = true
  }
  
  var that = this
  var name = user
  var is_config_defined_mentor = false

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
      }else{
        that.wiki_de&&bug( "newAuthenticUser: ", user, ", becomes member of wiki")
      }
    // If page exists, extract user name from first line of text, if any
    }else{
      // This means that the user can have a local identity per wiki
      user = userpage.getFirstUser() ? userpage.getFirstUser() : user
      // But cannot pretend to be another Twitter or Facebook user
      if( user != name ){
        if( "@".starts( user) || "@".ends( user) ){
          // ToDo: this makes no sense, it is legitimate to use either the
          // twitter or facebook name, iff it is signed with cookies
          that.warnUser( "Bad " + user)
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
            user = name
          }
        }
      }
    }
    // Make sure there is also a way to login with a code
    var code = that.getData( userpage, "Code")
    if( !code || code == "Invalid" ){
      code = that.loginCode
      that.wiki_de&&bug( "authenticUser:", user, "newInvitationCode:", code)
    }else{
      code = code.capitalize()
      that.login_de&&bug( "authenticUser:", user, "invitationCode:", code)
    }
    // ToDo: decide later what code to use, not now
    // that.setData( userpage, "Code", code)
    // ToDo: better authentication, it is premature to declare authentic,
    // twitter id or facebook must be checked against their signature in
    // cookies first
    that.isAuthentic = true
    that.useTwitterNameCookie(  req)
    that.useFacebookNameCookie( req)
    // ToDo: is this necessary?
    if( "@".starts( name) ){
      that.twitterName = name.substr( 1)
    }else if( "@".ends( name) ){
      that.facebookName = name.substr( 0, name.length - 1)
    }else{
      that.bug_de&&bug( "Neither Twitter nor Facebook:", name)
    }
    // More work
    that.loginForm( user, code, is_mentor, page, req)
  })
}

Session.codeLoginForm = function( page, req ){
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
  
  // Whatever happens, twitter or facebook user is mentor of her own wiki
  var is_mentor = false
  if( this.fixTwitterLogin() ){
    this.login_de&&bug( "also twitter owner is mentor")
    is_mentor = true
  }
  if( this.fixFacebookLogin() ){
    this.login_de&&bug( "also facebook owner is mentor")
    is_mentor = true
  }
  
  // If code page does not exists, create, as draft, unless wiki is 100% open
  if( page.isNull() ){
    this.login_de&&bug( "newCodePage: ", page)
    NDe&&bug( this, ", isDraft: ", page.isDraft())
    NDe&&bug( this, ", wasIncarned: ", page.wasIncarned())
    NDe&&bug( this, ", bodyLengh: ", (page.body ? page.body.length : "none"))
    NDe&&bug( this, ", deleted: ", page.wasDeleted())
    NDe&&bug( this, ", inherited: ", page.inherited)
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
      this.draft( page)
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
  this.loginForm( user, code, is_mentor, page, req)
}

Session.loginForm = function( user, code, has_mentor, page, req ){
// This method gets called by codeLoginForm() and userLoginForm()
// to handle the login, usually just after a new session is created.
// It may also be called later, see "delayed login".
// It is also called when an anonymous guest sets her name on a
// very open by default new wiki or when an anonymous member sets
// her name.

  this.login_de&&bug( "loginForm, user:", user, 
    "code:", code, "mentor: ", has_mentor,
    "page:", page, "R:", req ? req.deId : "none")
    
  // If this is the config defined code, force the user name
  var is_config_defined_mentor = false
  if( code == this.wiki.config.mentorCode.capitalize() ){
    user = this.wiki.config.mentorUser
    this.login_de&&bug( this, "configDefinedMentor:", user)
    is_mentor = true
    is_config_defined_mentor = true
  }
  if( !user ){
    user = "SomeOne"
    this.login_de&&bug( "no user, fallback:", user)
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
  }
  
  // There must be no draft user page on just created very open wikis
  var is_very_open_by_default = this.wiki.isVeryOpenByDefault()
  if( is_very_open_by_default ){
    if( userpage.isDraft() ){
      this.bug_de&&bug( "BUG? user page is draft, page:", userpage)
      this.stamp( userpage)
    }
  }
  
  // Get the user page
  var that = this

  // If twitter or facebook user wiki, make sure user is not a draft
  if( that.isOwner && userpage.isDraft() ){
    that.bug_de&&bug( "Fix draft user page of owner")
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
    // However, on very open wikis, auto stamp the user    // Idem if code page is ok or if user is the owner
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
      }
      if( page.isCode() && page.isDraft() ){
        that.stamp( page)
      }
    // Else the user's page is not ok, revert member status to guest
    }else{
      that.login_de&&bug( "draftMember:", user, "page:", userpage)
      if( that.de ){
        if( page.isCode() ){
          if( page.isDraft()      )bug( "because ", page,     " is a draft")
          if( page.isVoid()       )bug( "because ", page,     " is void")
          if( page.wasDeleted()   )bug( "because ", page,     " was deleted")
        }
        if( userpage.isDraft()    )bug( "because ", userpage, " is a draft")
        if( userpage.isVoid()     )bug( "because ", userpage, " is void")
        if( userpage.wasDeleted() )bug( "because ", userpage, " was deleted")
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
    De&&bug( that, "configDefinedMentor:", user)
    has_mentor = true
  }

  // Everybody is a mentor in a very open wiki
  if( !has_mentor
  &&  that.wiki.isVeryOpen()
  ){
    that.de&&bug( "mentorOfOpenWiki:", user)
    has_mentor = true
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
    }
    if( is_mentor
    && that.wiki.config.mentorCode
    && that.wiki.config.mentorCode != SW.config.mentorCode.capitalize()
    && code != that.wiki.config.mentorCode.capitalize()
    ){
      that.de&&bug( "Mentor code does not match config defined one")
      // ToDo: facebook
      if( true || !that.twitterName ){
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
  that.loginCode     = code
  that.loginCodePage = that.lookup( "Code" + code)
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
      that.setData( userpage, "Code", that.loginCode)
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
  
  that.wiki.logUser( that)

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
  }) // End of read() callback
} // end of loginForm()


Session.restoreSession = function( old ){
// Called by wiki.logUser() for returning logged user with code
  this.login_de&&bug( "restoring")
  this.wikiHistory = old.wikiHistory
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
    // Logout the older session, safer
    old.logout( "restore")
  }
  return this
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
  this.login_de&&bug( "logout: ", reason)
  if( this.isGone ){ return this }
  // If logging out of parent wiki while login in subwiki
  if( reason == "reuse" ){
    this.wiki.logout( this)
    return this
  }
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
  var config = this.wiki.config
  // If is away, ie not active for a while...
  if( age > config.awayDelay ){
    // ... then check if inactive for a long time, enough to log out
    // Note: guest sessions are logged out after config.awayDelay whereas
    // member sessions are logged out after longer config.logoutDelay
    if( this.isGuest() || age > config.logoutDelay ){
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
  return !this.isOlderThan( this.wiki.config.thereDelay)
}
Session.declareIdempotentPredicate( "isThere")
  
Session.isRecent = function(){
// Returns if some activity recently
  return !this.isAway() && this.age() < this.wiki.config.recentDelay
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
// Check current value of twitter name cookie & facebook name cookie
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
  // If new info about user, track wiki membership
  if( need_tracking ){
    this.login_de&&bug( "New login info, track user")
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
    || this.loginName.replace( /Guest$/, "").replace( /^Some$/, "someone")
  }
  // Try to figure out some default name based on cookie
  // and potential twitter or facebook name
  var cookies = req.headers.cookie
  if( !cookies )return ""
  var cookied_name
  var service_name = this.twitterName || this.facebookName
  if( service_name ){
    service_name = this.twitterName ? "@" + service_name : service_name + "@"
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
    // Idem for facebook
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
  if( this.user ){
    this.bug_de&&bug( "User object but neither twitter nor facebook name")
  }
  if( this.isGuestMember          )return false
  if( this.isGuest()              )return true
  if( this.loginName == "SomeOne" )return true
  return false
}
Session.declareIdempotentPredicate( "isAnonymous")

Session.isBot = function(){
  return "BotGuest".ends( this.loginName)
}
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
  req = req || this.httpLogin
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
  return this.facebookName
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
// Returns "User" + the capitalized name, unless name was wikinamized with
// an added "One" or "Guest" at the end, in which case I remove it when
// appropriate
  //this.de&&bug( "1, usernamize:", name)
  if( "User".starts( name) ){
    name = name.substr( "User".length)
  }
  // ToDo: I should not capitalize facebook @ terminated names
  // But there is an issue with Page.kindIs( "User") because it expects
  // a capital after User...
  name = this.capitalnamize( name)
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

Session.trackUser = function(){
// This method gets called whenever something changes about the twitter or
// facebook id associated to the session.
// It tries to attach a local User object to the session and also tries to
// bind together both ids if both exist.
// If some conflict occur, when each id already has a distinct local
// user, the twitter id is prefered, but Session.hasTwoUsers() will return
// true and the conflicting facebook user can be retrieved using
// session.user.conflict
// Note: this occurs asynchroneously
// To fix the issue, the user must log to her "personal" wiki using the
// "your wikis" link on her personal page in any wiki.
  var that = this
  if( this.twitterId && this.facebookId ){
    that.deep_user_de&&bug( "Dual ids case")
    var tpage = User.lookup( this.wiki, "Twitter", this.twitterId)
    var fpage = User.lookup( this.wiki, "Facebook", this.facebookId)
    tpage.user.load( function( terr, tuser ){
      fpage.user.load( function( ferr, fuser ){
        if( terr && ferr ){
          that.deep_user_de&&bug( "dual track, both new, twitter first")
          // I wait for the result of twitter tracking before going further
          that.trackTwitterUser( function(){
            that.deep_user_de&&bug( "dual track, both new, facebook")
            // Now I can track facebook because I know the local user and
            // as a result I am not going to create a duplicate
            // Note: to avoid race condition, I respect this order,
            // twitter first, then facebook.
            that.de&&mand( that.user )
            that.trackFacebookUser()
          })
          return
        }
        if( terr ){
          that.deep_user_de&&bug( "dual track, twitter new")
          return that.trackFacebookUser( function(){
            that.deep_user_de&&bug( "dual track, bis, twitter new")
            that.trackTwitterUser()
          })
        }if( ferr ){
          that.deep_user_de&&bug( "dual track, facebook new")
          return that.trackTwitterUser( function(){
            that.deep_user_de&&bug( "dual track, bis, facebook new")
            that.trackFacebookUser()
          })
        }
        // Both pages exists already...
        tuser.getLocal( function( terr, ltuser ){
          fuser.getLocal( function track_local_cb( ferr, lfuser ){
            ltuser.assertLocalNotEmpty() // ToDo: this bombed once, jan 7 2011
            lfuser.assertLocalNotEmpty()
            // If same local user, perfect!
            if( ltuser == lfuser ){
              that.deep_user_de&&bug( "dual track, same user")
              that.userFoundEvent( lfuser)
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
            that.userFoundEvent( ltuser)
            that.userFoundEvent( lfuser)
          })
        })
      })
    })
    return
  }
  if( this.twitterId ){
    this.deep_user_de&&bug( "track, just twitter")
    this.trackTwitterUser()
  }
  if( this.facebookId ){
    this.deep_user_de&&bug( "track, just facebook")
    this.trackFacebookUser()
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

Session.trackServiceUser = function( service, id, cb ){
// Track the identity of a user, returns the local user via cb( err, user)
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
        cb.call( session, err, local_user)
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
// collected in the session. ie: either a twitterId or a facebookId (from cookies) that
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
    return this
  }
  if( this.user == user ){
    this.bug_de&&bug( "Bind to same user:", user)
    return this
  }
  // Need to merge two users...
  this.user_de&&bug( "Merge:", this.user, "with:", user)
  user.de&&mand( user.isLocal )
  this.user.conflict = user
  
  return this
}

Session.hasTwoUsers = function(){
// A session has two users if twitter id and facebook id refers to different
// local users.
// See mergeUsers()
  return !!(this.user && this.user.conflict)
}

Session.mergeUsers = function( cb ){
// This method gets called to resolve a conflict regarding local user
// not beeing the same via twitter and via Facebook.
// It extract content from the facebook user in order to extend the
// twitter based local user and mark the facebook local user as beeing
// "deprecated". Further reference to the deprecated local user are
// redirected to the valid local user. See class User
  this.de&&mand( this.hasTwoUsers() )
  var a = this.user
  var b = a.conflict
  a.mergeWith( b, function( err, winner, loser ){
    if( err || !winner ){
      return cb.call( err, winner, loser)
    }
    winner.getHomepage( function( err, pwin ){
      if( err ){
        return cb.call( err, winner, loser)
      }
      loser.getHomepage( function( err, ploss ){
        if( err ){
          return cb.call( err, winner, loser)
        }
        pwin.wiki.mergeWith( ploss.wiki, function( err ){
          cb.call( err, winner, loser)
        })
      })
    })
  })
}

// section: end sessionlogin.js

// section: sessionpage.js

Session.lookup = function( pagename ){
// Look for / make a Page object to reference said page
  return this.wiki.lookupPage( pagename)
}

Session.setData = function( page, name, val, dont_put ){
// Set Yaml data on page and then write page to store in the background.
// Val is stored as a string. No JSON.
// Please use dont_put to avoid multiple puts.
// ToDo: a version with an array/hash of changes
  // Do nothing if no change
  if( this.getData( page, name) == val )return this
  var data = page.data
  if( !data ){
    // ToDo: move this logic to Page constructor & incarn()
    data = page.data = {}
  }
  page.data[name] = val.toString()
  if( !dont_put ){
    // Update data inside content of body and save
    var text = page.body
    if( !text ){ text = "" }
    // This is asynchronous, I assume it runs FIFO style
    // I guess that this is a safe bet, but I could manage a queue
    this.putPage( page, text, null)
    // ToDo: I could bufferize this a little
    // But then I would have to detect/avoid multiple writes
  }
  return this
}

Session.getData = function( page, key ){
// Get some (string) data from a page.
// Returns null if named item is not part of page (or proto).
  return page.get( key)
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
      // If page was inherited, restore original
      if( page.wasInherited() ){
        that.wiki.resetInheritedPage( page)
        // ToDo: debug this
        return cb.call( that, err, page)
      }
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
    if( err ) return cb.call( this, err, page, null)
    that.lookup( copyname).read( function( err, copypage ){
      var copydata = copypage.getBody()
      if( err ){ copydata = "" }
      // Defense: don't copy if data was copied before
      // ToDo: this is not very good, I'd better compress
      if( copydata.includes( page.getBody()) ){
        return cb.call( this, 0, page, copypage)
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
    cb.call( this, err, page)
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
    return !cb ? (err ? null : page.getBody()) : cb.call( this, err, page)
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
  return this.canMentor || !(page.data && page.data.ReadOnly)
}
Session.declareIdempotentGetter( "mayEdit")

Session.canEdit = function( page ){
  return this.canRead( page) && this.mayEdit( page, true)
}
Session.declareIdempotentPredicate( "canEdit")

Session.mayRead = function( page ){
// Returns true if user can read the page or need to try
  // Only authenticated users can read something in User wikis
  if( this.wiki.isUserWiki()
  && !(this.isAuthentic || this.isDebug || !this.isGuest())
  )return page.isPublic() || page.isRead() || page.isHelp() || page.isDo()
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
  if( page.data && page.data.MentorLock && !this.canMentor ){
    this.acl_de&&bug( "Locked, mentors only, page:", page)
    return false
  }
  return !this.isGuest() || !(page.data && page.data.NoGuests)
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

Session.doPageCommands.Cloud = function( cmd, cb ){
  
  buf = ["HTML"]

  // From http://rive.rs/projects/tumblr-tag-clouds
  buf.push( this.htmlScript( function sw_tag_cloud( config, all_tags ){

    //console.log( "sw_tag_cloud")
    if( !config )return
  
    function sortNum(a, b) {return (a - b);}

    function sortByValue(keyArray, valueMap) {
      return keyArray.sort(function(a,b){return valueMap[a]-valueMap[b];});
    }

    function getProperties( obj ){
      var properties = []
      for( var property in obj ){ properties.push( property) }
      return properties
    }

    function getCloud(){

      var start      = 0
      var tag_counts = []
      var cloud      = {}
      var url_base = !config.url
      ? ('http://' + document.domain + '/')
      : (config.url + '/')

      $(all_tags).each(function(i, tag) {
        cloud[tag] = (cloud[tag] ? cloud[tag] + 1 : 1);
      });

      var raw_cloud = {}
      for( var tag in cloud ){ raw_cloud[tag] = cloud[tag] }

      if( config.math == 'log' ) {
        for(tag in cloud ){ cloud[tag] = Math.log( cloud[tag]);}
      }

      if( config.order == 'frequency' ){
        var cloudSorted = {}
        var cloudKeys = getProperties(cloud);
        var sortedTags = sortByValue(cloudKeys, cloud).reverse();
        for (k in sortedTags) {
          cloudSorted[sortedTags[k]] = cloud[sortedTags[k]];
        }
        cloud = cloudSorted;

      } else if(config.order == 'alphabetical') {
        var cloudSorted = {}
        var cloudKeys = getProperties(cloud);
        var sortedTags = cloudKeys.sort(function(x,y) {
          var a = String(x).toUpperCase();
          var b = String(y).toUpperCase();
          if (a > b) {return 1;}
          if (a < b) {return -1;}
          return 0;
        });
        for (k in sortedTags) {
          cloudSorted[sortedTags[k]] = cloud[sortedTags[k]];
        }
        cloud = cloudSorted;
      }
      size_range = config.maxsize - config.minsize;
      for (j in cloud) tag_counts.push(cloud[j]);
      tag_counts.sort(sortNum);

      var min_count = tag_counts[0];
      var max_count = tag_counts[tag_counts.length - 1];
      var slope = size_range / (max_count - min_count);
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
        var title = raw_cloud[tag]
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
        +(in3d ? ' </li>' : '</span>');
        obuf.push( output)
      }
      obuf.push( in3d ? "</ul></div>" : "")
      $("#sw_tag_list").append( obuf.join( ""))
      // 3D effect, way too slow
      if( in3d ){
	var element = $('#sw_tag_list a');
        $('#sw_tag_list ul').add( $('#sw_tag_list li'))
        .css({
          "list-style":"none",
          margin:0,
          padding:0
        })
	var offset = 0; 
	var stepping = 0.03;
	var list = $('#sw_tag_list');
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
  }
  config.url = Wiki.htmlizeAttr(
    this.permalinkTo( this.wiki.homePage).replace( "HomePage", "")
  )
  buf.push( '<div id="sw_tag_list"></div>')
  buf.push( this.script( "sw_tag_cloud", config, all_tags))
  cb( buf.join( "\n"))
}

// Same code, different name => different behavior
Session.doPageCommands.CloudTags
= Session.doPageCommands.Cloud
Session.doPageCommands.CloudFrequencies
= Session.doPageCommands.Cloud
Session.doPageCommands.CloudPages
= Session.doPageCommands.Cloud

Session.doPageMentorCommands = {}

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
    return cmdcmd.call( this, cmd, cb)
  }

  if( cmd == "History" ){
    return cb( this.wikiHistory.join( "\n"))
  }

  if( cmd == "Drafts" ){
    // Display list of draft pages.
    // Guest don't see draft codes & draft users, disturbing
    // non mentors see codes obscured, they can monitor if mentors manage them
    var buf = []
    var bufcodes = []
    var bufusers = []
    that.wiki.forEachDraft(
      function( page ){
        (page.isCode() ? bufcodes : (page.isUser() ? bufusers : buf))
        .push( 
          ((page.isCode() && !that.canMentor) ? "DraftCode" : page.name)
          + " - "
          + that.tooltip( page).replace( that.i18n( "a draft") +", ", "")
        )
      },
      that.canMentor  // true => with_codes
    )
    // Set a flag so that "drafts" stays on top menu for a while
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
    that.doPage( "ClearDraftCodes")
    that.wiki.forEachDraft( function( page ){ page.trash() })
    return cb( that.i18n( "Done\nDoDrafts"))
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
    return cb( that.i18n( "Done\nDoDrafts"))
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
    var app = cmd.substr( "Angular.length")
    app = that.lookup( cmd)
    var content = app.isDraft() ? app.getNondraftBody() : app.getBody()
    content = that.wiki.injectBasicYaml( content)
    // Get rid of \n, they don't play well in the container, they do like <br>
    return cb( "HTML" + content.replace( /\n/g, ""))
  }

  // HTML pages
  if( "Html".starts( cmd) ){
    var app = cmd.substr( "Angular.length")
    app = that.lookup( cmd)
    var content = app.isDraft() ? app.getNondraftBody() : app.getBody()
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
  if( mode == "Narrower" ){ cfg.cols = Math.ceil( cfg.cols * 2/3)
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
  if( mode == "Wider" ){    cfg.cols = Math.ceil( cfg.cols * 4/3)
  }
  if( mode == "Tall" ){     cfg.rows = 60
  }
  if( mode == "Short" ){    cfg.rows = 20
  }
  if( mode == "Taller" ){   cfg.rows = Math.ceil( cfg.rows * 4/3)
  }
  if( mode == "Shorter" ){  cfg.rows = Math.ceil( cfg.rows * 2/3)
  }
  if( mode == "Bigger"){    cfg.cols = Math.ceil( cfg.cols * 4/3)
                            cfg.rows = Math.ceil( cfg.rows * 4/3)
  }
  if( mode == "Smaller"){   cfg.cols = Math.ceil( cfg.cols * 2/3)
                            cfg.rows = Math.ceil( cfg.rows * 2/3)
  }
  if( mode == "Thiner"){    cfg.cols = Math.ceil( cfg.cols * 2/3)
                            cfg.rows = Math.ceil( cfg.rows * 4/3)
  }
  if( mode == "Stronger"){  cfg.cols = Math.ceil( cfg.cols * 4/3)
                            cfg.rows = Math.ceil( cfg.rows * 2/3)
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

  // Display the user's profile
  if( cmd == "Profile" ){
    if( !this.user ){ return cb( "No login") }
    buf = []
    buf.push( this.i18n( "Screen name: ") + this.userName())
    if( this.isGuest() ){
      buf.push( this.i18n("a guest"))
    }else{
      if( this.user ){
        function dump_user( user, loop ){
          for( var item in user.id ){
            buf.push( that.i18n( "Identity on ")
              + item
              + that.i18n( ": ") + user.id[item]
            )
          }
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
            entry = "\n"
            + time
	    + (name == that.userName() ? "" : " - " + name)
	    + "\n" + (!title ? wiki.replace( /\/$/, "") : title)
            + "\n  " + SW.name + "/"
	    + encodeURI( wiki + login)
	    + (!code  ? "" : "?code=" + encodeURIComponent( code))
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
              dump_user( user.conflict, true)
            }
          }
        }
        // ToDo: what if no SW.domain?
        if( SW.domain ){
          buf.push( this.i18n( "Your private wiki:")
            + " " + SW.domain + "/user/f" + this.user.getId() + "/HomePage"
          )
        }
        buf.push( "")
        dump_user( this.user)
      }
    }
    return cb( buf.join( "\n"))
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
  if( "Debug".starts( cmd) ){
    cmd = cmd.substr( "Debug".length)
    if( cmd == "Inspector" ){
      return cb( "HTML" + that.inspector( that))
    }
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
        + "  - DoDebugToggle"
      )
      var item
      for( item in DebugDomains ){
        (DebugDomains[item] ? list_on : list_off).push( 
          " " + item.replace( "deep_", "Zdeep_") + "   - DoDebugToggle" + item
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
      on = true
      cmd = cmd.substr( "On".length)
    }
    if( "Off".starts( cmd) ){
      on = false
      cmd = cmd.substr( "Off".length)
    }
    if( "Toggle".starts(cmd) ){
      on = "toggle"
      cmd = cmd.substr( "Toggle".length)
    }
    var domain = cmd
    this.deep_misc_de&&bug( "DEBUG, on:", on, "domain:", domain)
    if( domain ){
      if( on === true ){
        global.debugDomain( domain)
      }else if( on === false ){
        global.ndebugDomain( domain)
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
    return this.doPage( "DebugDomains", cb)
  }
  // Shell scripts
  var shellcmd = "./" + SW.dir + "/PrivateShell " + cmd;
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
  msg = this.toolForm( page)
  + this.htmlLayout(   page, msg)
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

Session.wikifyText = function sw_wikify( text, is_rfc ){
// Do the best with few information
// Both client side & server side
//
// ToDo: deep linking: http://open.blogs.nytimes.com/2011/01/11/emphasis-update-and-source/#h%5BWtEIyw,2%5D

  if( !text )return ""

  // ToDo: optimize, see http://jmrware.com/articles/2010/jqueryregex/jQueryRegexes.html
  var client_side = typeof Session === "undefined"

  // Delegate to markdown?
  if( text.search( /markdown/i) ){
    // ToDo: delegate
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
  .replace( /\n\\.*\n/g, function( line ){
    return "\r" + encodeURIComponent( line) + "\r"
  })
  // Yaml
  .replace( /(\n---\n(\w+:.*\n)+)/, '<div class="yaml">$1</div>')
  // !!! ToDo: <ins> & <del>
  .replace( /^!!!(.*?)$/gm, '<span class="diff">$1</span>')
  // "xxxxx"
  .replace(    /([^=]|^)"([^"><]{2,}?[^="\s><])"/g, "$1&quot;<cite>$2</cite>&quot;")
  // *xxxxx*
  .replace( /(\s|^)\*([^\*\s<][^\*<]*?[^\*\s])\*/g, "$1<dfn>*</dfn><b>$2</b><dfn>*</dfn>")
  // /xxxxx/
  .replace( /(\s|^)\/([^\/\s<][^\/<]*?[^\/\s])\//g, "$1<dfn>/</dfn><i>$2</i><dfn>/</dfn>")
  // _xxxxx_
  .replace(    /(\s|^)_([^_\s<][^_<]*?[^_\s])_/g,   "$1<u>_$2_</u>")
  // !xxxxx!
  .replace(  /(\s|^)!([^!\s<][^!\n<]*?[^!\s])!/g,   "$1<dfn>!</dfn><em>$2</em><dfn>!</dfn>")
  // (xxxxx)
  .replace(   /(\s|^)\(([^)\s<][^)<]*?[^)\s])\)/g,  "$1<dfn>($2)</dfn>")
  if( is_rfc )return text
  if( false && client_side ){
    text = text
    .replace( /^(\s+)<([^\/]*)>\s*?$/gm, '<div align="center"><var>&lt;</var>$1<var>&gt;</var></div>')
    .replace(   /^(\s+)([^<]*)>\s*?$/gm, '<div align="right"> $2<var>&gt;</var></div>')
  }else{
    text = text
    .replace( /^(.*)&lt; (.*) &gt;\s*$/gm, '<div align="center">$1<var>&lt;</var>$2<var>&gt;</var></div>')
    .replace( /^(\s+.*) &gt;\s*$/gm, '<div align="right">$1<var>&gt;</var></div>')
  }
  text = text
  .replace( /(\s)-([A-Za-z]+)-/g,   '$1-<strike>$2</strike>-')
  
  // Split in lines to handle nested lists
  var lines = text
  var linetbl = lines.split( "\n")
  for( var ii = 0 ; ii < linetbl.length ; ii++ ){
    text = linetbl[ii]
    // Two consecutive empty lines resets the lists
    if( !text && !linetbl[ii + 1] ){
      text = reset_lists()
    }
    text = text
    .replace( /^( +)(---+)\s*?$/gm,  function( _, spaces, dash ){
      return reset_lists()
      + '<div align="center"><h3><dfn> ' + dash + '</dfn></h3></div>'
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
  text = text
  .replace( /\n{1,2}<(div|h.)>/g, "<$1>")  // <div> introduces a break, copy/pasted, rmv it
  .replace( /<\/(div|h.)>\n{1,2}/g, "</$1>")  // Idem for <h1>, <h2>, etc
  // Unprotect
  .replace( /\r(.*)\r/g, function( _, match ){ return decodeURIComponent( match) })

  return text
  } // end of nest function wikify()
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
  if( page && page.isHtml() && this.isCustom ){ return text }
  
  var wiki_names = SW.wikiWords
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
        list.push( item + " " + this.tooltip( itempage))
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
  if( true ){
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

  // Interwiki links
  var that = this
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

  // Soft urls, very soft, xyz.abc style
  // The pattern is tricky, took me hours to debug it
  var surl =
  /([\s>]|^)([^\s:=@#"([)\]>][\w.-]+\.[a-z]{2,4}[^\sA-Za-z0-9_!.;,<"]*[^\s:,<>"']*[^.@#\s:,<>'"]*)/g
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
  text = text.replace( surl, function( m, p, u ){
    // u = u.replace( /&amp;/g, "&")
    // exclude some matches
    if( /[@#.]$/.test( u) )return m
    return p 
    + '<a href="' + Wiki.htmlizeAttr( "http://" + u) + '">'
    + u
    + '</a>'
  })

  // url are htmlized into links
  // The pattern is tricky, change with great care only
  var url = /([^>"\w]|^)([a-jk-z]\w{2,}:[^\s'",!<>)]{2,}[^.\s"',<>)]*)/g 
  // Very tolerant but no javascript
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
  text = text.replace( /(\W)(RFC)([ #]*)(\d+)/gm,
    '$1<a href="' + href + 'on_rfc$4">$2$3$4</a>'
  )

  // Wiki words becomes links (and closure later, read on)
  text = text
  .replace( wiki_names, '$1<a class="wiki" href="' + href + '$2">$2</a>')

  // Fix some rare issue with nested links, remove them
  text = text.replace( /(<a [^>\n]+?)<a [^\n]+?>([^<\n]+?)<\/a>/g, '$1$2')
  
  // <a href="http://jean.vincent@">jean.vincent@</a>

  // y becomes i, unless premium or "Read" page
  if( !this.wiki.isRoot()
  &&  !this.wiki.config.premium
  &&  (!page || !page.isRead())
  &&  !is_rfc
  ){
    // text = text.replace( /(\b[^"y]*)y /gm,     '$1<em title="y">i</em> ')
    text    = text.replace(  /^([^"y]*)y (.*)$/m, '$1<em title="y">i</em> $2')
  }

  // Date, iso format typically, are emphasized and later complemented
  text = text.replace( date, '<time>$1</time>')
  
  // Some simple markup
  if( format
  || !that.canScript
  // that.canScript === "maybe", optimistic
  ){
    text = Session.wikifyText( text, is_rfc)
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
  /*
  var text2 = text.replace(
    /<a href="\/([^"]+)".*?<\/a>/,
    function( _, pagename ){
      var otherpage = that.lookup( pagename)
      if( page ){ that.backlink( otherpage, page) }
      // Handle local, my and this pages
      if( page && otherpage.isLocal() ){
        pagename = that.localName + pagename.substr( "Local".length)
      }
      if( page && (otherpage.isYour()  || pagename == "YourPage") ){
        if( pagename == "YourPage" ){
          pagename = that.usernamize( that.userName())
        }else{
          var property = pagename.substr( "Your".length)
          if( that.loginPage.data && that.loginPage.data[property] ){
            pagename = that.loginPage.data[property]
          }else{
            pagename = that.userName() + pagename.substr( "Your".length)
          }
        }
      }
      if( page && otherpage.isThis() ){
        pagename = page + pagename.substr( "This".length)
      }
      // Show link only for pages that are maybe readable
      if( that.mayRead( otherpage) ){
        if( dotoc ){
          toc.push( pagename)
        }
        return "WIKI" + that.linkPage( pagename) + "WORD"
      }else{
        return pagename
      }
    }
  )
  */
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
        var property = pagename.substr( "Your".length)
        if( this.loginPage.get( property) ){
          pagename = this.loginPage.get( property)
          // ToDo: should sanitize
        }else{
          pagename = this.userName() + pagename.substr( "Your".length)
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
  
  var text3 = text2

  // Include images
  // querystring: (?:\\?[^#<>\\s]*)?(?:#[^<>\\s]*)?
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

  // Adjust timezone of dates, well, actually tells time since date
  // ToDo: client side when possible
  var text5 = text4.replace(
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
  var date = new Date(d[1], 0, 1)
  if (d[ 3]) { date.setMonth( d[3] - 1) }
  if (d[ 5]) { date.setDate( d[5]); }
  if (d[ 7]) { date.setHours( d[7]); }
  if (d[ 8]) { date.setMinutes( d[8]); }
  if (d[10]) { date.setSeconds( d[10]); }
  if (d[12]) { date.setMilliseconds( Number( "0." + d[12]) * 1000) }
  if (d[14]) {
    offset = (Number( d[16]) * 60) + Number( d[17]);
    offset *= ((d[15] == '-') ? 1 : -1);
  }
  offset -= date.getTimezoneOffset();
  var time = (Number( date) + (offset * 60 * 1000));
  tip = this.timeLabel( Number( time))
  // If recent change color, color fades aways as time passes
  var age = Sw.timeNow - time
  if( age < (36 * 3600 * 1000) ){		// 36 hours
    tip += '" style="color:#B99'
  }else if( age > (45 * 84600 * 1000) ){	// 45 days
    tip += '" style="color:#DDD'	
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

Session.userLabelTooltip = function( page ){
// Assuming page is the "name" of a user, a @twitter or facebook@ na
// this method returns that name plus some user label about it, if such
// information is available.
// Else, returns the page's name, maybe i18ned.
  var user_label = this.wiki.findUserLabel( page.name)
  if( !user_label )return this.i18n( page.name)
  return page.name + " [" + user_label + "]"
}

Session.tooltip = function( page ){
  NDe&&bug( "Building tooltip for link to page ", page)
  var title = []
  var with_user_label = this.userLabelTooltip( page)
  if( with_user_label != page.name ){
    title.push( with_user_label)
  }
  if( page.isStamps() && this.userName().starts( page.name) ){
    title.push( this.i18n( "your changes"))
  }
  if( page.isHome() ){
    var label = this.wiki.getTitle()
    label = this.wiki.fullname().replace( /\/$/, "")
    + (!label ? "" : " (" + label + ")")
    title.push( label)
    if( this.wiki.name == this.facebookName + "@" ){
      title.push( this.i18n( "your personal Facebook wiki"))
    }else if( this.wiki.name == "@" + this.twitterName ){
      title.push( this.i18n( "your personal Twitter wiki"))
    }
  }
  if( page.isUser() ){
    if( page.name == this.usernamize( this.userName()) ){
      if( page.name == "UserSome" ){
        title.push( this.i18n( "anonymous"))
      }else{
        title.push( this.i18n( "your personal page"))
        if( this.wiki.name == this.facebookName + "@" ){
  	  title.push( this.i18n( "in your personal Facebook wiki"))
        }else if( this.wiki.name == "@" + this.twitterName ){
	  title.push( this.i18n( "in your personal Twitter wiki"))
        }
      }
    }else if( /User\[|User@|@$/.test( page.name) ){
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
  if( page.isDraft() ){
    title.push( this.i18n( "a draft"))
  }
  var user
  if( page.isCode() && (user = page.getFirstUser()) ){
    user = user.replace( "Mentor", "")
    title.push( this.i18n( "'invitation code' of ") + user)
  }
  var writer = page.lastWriter()
  if( writer ){
    NDe&&bug( "Link to ", page, ", writer: ", writer)
    if( writer != this.userName() || this.isGuest() ){
      title.push( this.i18n( "by ")
      + this.userLabelTooltip( this.lookup( writer))
      + (!page.timeModified()
        ? ""
        : " " + this.timeLabel( page.timeModified()))
      )
    }
  }
  // The page is associated to a session...
  var session = page.session()
  if( session ){
    if( session == this && !this.isMentor ){
      if( !this.isGuest() ){
        title.push( this.i18n( "about you"))
      }
    }else{
      // Don't display this in the DoVisits page, it's confusing
      if( !this.getCurrentPage().isDo() ){
        title.push(
          (this.i18n( session.isGuest() ? "a guest" : "a member")),
          this.i18n( "active") + " " 
          + session.timeLabel( session.timeLastAccess)
        )
        if( session.isGone ){
          title.push( this.i18n( "gone"))
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
            + this.userLabelTooltip( this.lookup( visitor))
          )
        }else{
          title.push( this.i18n( "a page visited "))
        }
      }
      title.push( " " + this.timeLabel( page.timeVisited()))
    }else{
      // title.push( "a page last visited by you")
    }
  }
  title = title.join( ", ").trim()
  .replace( /, , /g, ", ")
  .replace( /  /g, " ")
  .replace( /^, /, "")
  .replace( / ,/g, ",")
  .replace( /,,/g, ",")
  .replace( /\.,/g, ",")
  if( NDe && title ){ this.de&&bug( "Title of ", page, ": ", title) }
  return title
}

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
  if( !title || title == "" ){
    title = this.tooltip( page)
  }
  // User friendly xxxx(guest) instead of ugly xxxxGuest
  if( "Guest".ends( label) ){
    label 
    = label.substr( 0, label.length - "Guest".length) + this.i18n( "(guest)")
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
      this.de&&bug( "track back link, referer:", referer, "target:", page)
      this.de&&mand( referer.linksTo( page), "bad linking")
    }
  }
  return this
}

Session.getCookieScript = function sw_cookie( name, cookie ){
// Client side
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
  return [
    this.htmlScript( this.getCookieScript),
    '\n<script>',
    'var sw_login = "'       + this.loginName + '"',
    'var sw_page = "'        + page.name + '"',
    'var sw_traces = "'      + traces + '"',
    'var sw_can_cache = '    + page.isDo(),
    'var sw_config_cols = '  + this.config.cols,
    'var sw_cols = '         + maxcols,
    'var sw_rows = '         + this.config.rows,
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
    'var sw_time_loaded = (new Date()).getTime() + sw_time_offset',
    'var sw_editing = false',
    'var sw_edit_had_focus = false',
    'var sw_touch_device = "createTouch" in document',
    'var sw_meebo_bar = "'   + this.wiki.config.meeboBar + '"', 
    'var sw_address = '
    + 'decodeURIComponent( "' + encodeURIComponent( path) + '")',
    // ToDo: http://www.spoiledmilk.dk/blog/?p=1922 to change address in browser
    // Reload page on "back" button
    // ToDo: https://developer.mozilla.org/en/DOM/Manipulating_the_browser_history
    'var sw_time_last_page = sw_cookie( "sw_time_last_page")',
    'if( !sw_can_cache && sw_time_last_page && !sw_touch_device',
    '&& parseInt( sw_time_last_page) > sw_time_built',
    '){',
    '  window.location = ""',
    '  window.location.reload( true)',
    '}else{',
    '  document.cookie = "sw_time_last_page=" + sw_time_built',
    '}',
    'var De = ' + !!De,
    'var NDe = false',
    'var sw_do = sw_api()',
    // I can as well hide the body to avoid some flicker until .ready()
    '$("body").css( "display", "none")',
    '</' + 'script>\n',
    this.wiki.config.meeboBar ? this.script( this.meeboScript) : ""
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

Session.htmlScript = function( javascript ){
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
    javascript = javascript.replace( /[^\\:]\/\/.*(?=[\n\r])/g, '')
    Sw.cacheFile( filename + ".js", "text/javascript", javascript)
  }

  // And that's it for this case, unless tracing is enabled
  if( filename && !this.inline_de ){
    filename = Wiki.htmlizeAttr( Wiki.permalink( filename + ".js"))
    return '<script src="' + filename + '"></script>'
  }

  // When not including a Function or in "inline" trace mode, embed the script
  return [
    '<script>',
    javascript,  // ToDo: some encoding here?
    '</' + 'script>'
  ].join( "\n")
}

Session.onload = function sw_onload(){
// Client side
// The code for this function is included by an HTML page. It is typically
// called when sw_onload.js is loaded.
// It does some init stuff for the page and register additional stuff to init
// once the page is "ready"

  var t0 // document.getElementById( "content")
  var t1 // document.getElementById( "previous_content")

  // I define my De&&bug darling, it sends a message to the server and may
  // execute code sent back from it (this last feature is not used today)
  window.bug = function(){
    var list = Array.prototype.slice.call( arguments)
    $.getScript( "/rest?cid=" + sw_rest_cid
      + "&do=debug&msg=" + encodeURIComponent( list.join( ""))
    )
  }

  // The "top menu" is hidden sometime, to remove "distraction"
  var shown          = true	// actual state
  var shown_desired  = false	// desired state
  var scheduled_show = 0	// a timeout registered function, or null

  function schedule_fade( desired, now ){
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

    // If "fluid" layout, don't change font size, just make visible
    if( !sw_rows ){
      t0.style.display = "inherit"
      document.body.style.visibility = "visible"
      document.body.style.display    = "inherit"
      return
    }

    // In "two panes" mode, there is a #previous_content to ajust too
    t1 = document.getElementById( "previous_content")

    // Avoid flicker while I compute stuff
    document.body.style.visibility = "hidden"
    document.body.style.display    = "inherit"

    // The number of rows to display defaults to what user configured
    rows = rows || sw_rows

    // If number of columns is negative, it means we go proportional
    var proportional = (sw_cols < 0)

    // Let's figure out what is the total height of the window, as we
    // will to make it so that cols x rows of characters fit in it
    var h =  window.innerHeight ? window.innerHeight : $(window).height()
    var w = $(window).width()

    // On iPhone I think that screen.width is more accurate
    if( sw_touch_device ){
      w = Math.min( screen.width, w)
    }

    // Remember that because I needed it somewhere else
    sw_width  = w
    sw_height = h

    // Compute exact number of desired rows & columns
    // On small screens I relax the user expectation regarding rows
    var r = rows + (sw_touch_device ? -rows + 2 : 2)
    var c = proportional ? -sw_cols : sw_cols

    // Adjust that if I want margins
    // ToDo: margin is set to 1, this should be configurable somehow
    if( !sw_touch_device && !sw_oembed && !sw_iframe ){
      c += t1 ? 4 : 2 // for margins
    }

    // Make a guess about the font size
    var px = Math.ceil( Math.min(
      w / (c * 0.6), // Apparently width is 60% of height for monospace fonts
      h / (r * (sw_touch_device ? 1 : 1.35)) // 1.35em in css
    )) + 1 // Increase "guess" to avoid beeing too small
    if( px < 1 ){ px = 1 }

    // I use an "hidden" div with the letter "M" in it, it measure its px size
    var sz = document.getElementById( "sizer")

    // Based on the guess, I look for the biggest font that fits, going downward
    while( px ){

      // Change the font size, either for whole page or just content (!header)
      ((sw_touch_device || px > 30 || recur)
      ? document.getElementById( "container")
      : document.body)
      .style.fontSize = px + "px"

      // If big font, set a limit for the header & footer
      if( !sw_touch_device && px > 30 && !recur ){
        document.body.style.fontSize = "30px"
      }

      // I changed the font's size, but what I ask for is not what happens exactly
      // Force "recompute" of lineHeight
      // ToDo: I force 1.35em, this should be configurable
      // ToDo: I should reduce that when fontSize gets big
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

      // Make it 60% of the size of the "near" pane, it then look distant
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
      deltar = Math.ceil( deltar + 0.51)
      //console.log( "doch: ", doch, " deltar:", deltar)
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

  // Tracks if document is ready, to avoid early initis
  var sw_document_ready = false

  // When the document is fully loaded, I can safely init stuff
  $(document).ready( function(){

    sw_document_ready = true

    // Set the url to match the displayed page, HTML5, thanks to Jean Vincent
    if( window.history.replaceState ){
      window.history.replaceState( null, sw_page, sw_address)
    }

    // On touch devices I slightly change the design because of small screen
    if( sw_touch_device ){
      // Setting maxWidth helps to avoid auto zooming artifacts
      var w = sw_width = Math.min( screen.width, $(window).width())
      document.body.style.maxWidth   = w + "px"
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
      html = sw_wikify( html, is_rfc)
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

    if( sw_traces ){
      $("#traces").append( sw_traces + "<br><br><br><br><br><br><br><br><br>")
    }

    // Unless it's a touch device, I "hide" the top menu & footer to some extend
    if( !sw_touch_device ){

      // I show them when mouse moves to where they are
      $(".fade").mouseenter( function() {
        schedule_fade( 1, true) // $(".fade").fadeTo( 0, 1)
      })

      if( false && sw_is_anonymous ){
        $("#header").removeClass( "fade") // Less confusing at first
        $("#footer").removeClass( "fade")
        if( window.onFooterDisplay ){ window.onFooterDisplay( true) }
        //$("#footer").css( "position", "static")
      }else{
        // Don't display header/footer at first, so that readers focus on text
        // true => now, don't delay
        schedule_fade( 0, true) // $(".fade").fadeTo( 0, 0)
      }

      // Hide them when mouse enters area with content
      $("#content").mouseenter( function(){
        schedule_fade( 0)
      })

      //.mouseleave( function(){
      //  $(".fade").fadeTo( 0, 1)
      //  if( window.onFooterDisplay ){ window.onFooterDisplay( true) }
      //})

      // Also display them when scrolling to top or bottom of page
      $(window).scroll( function(){
        var new_top = $(window).scrollTop()
        if( new_top == 0
	|| $('body').height() <= $(window).height() + new_top
	){
	  schedule_fade( 1, true) // $(".fade").fadeTo( 0, 1)
          // Let the menu "stick" if enough scrolling to reach top or bottom
          //$("#header").removeClass( "fade")
          //$("#footer").removeClass( "fade")
	}
      })

      // Hide them when mouse leaves window, quiet
      $('html').mouseleave( function(){
        $("#header").addClass( "fade")
        $("#footer").addClass( "fade")
        if( window.onFooterDisplay ){ window.onFooterDisplay( true) }
        schedule_fade( 0) // $(".fade").fadeTo( 0, 0) // I wish to use 500ms, flickers on FireFox
      })

      // This will add an underline to all occurences of the same link, this
      // may help the user a little bit in terms of navigation
      // Thanks to http://kilianvalkhof.com/2008/css-xhtml/context-hover-adding-context-feedback-to-your-links/
      $("a").each( function(){
	var that = $(this)
	// Async, can be slow
	var time_started = +(new Date())
	setTimeout( function(){
	  var age = (+(new Date()) - time_started)
	  // Don't do it if it took longer that 2 sec to capitalize links
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
          var a = $("a[href=" + href + "]");
          that.hover(
            function(){ a.addClass(    "hover"); },
            function(){ a.removeClass( "hover"); }
          )
	}, 10) // Runs after next trick on wiki words
      })

      // For wiki word links, improve readability with emphasis on upper cases
      $(".wiki").each( function(){
	var that = $(this)
	// Async, can be slow
	setTimeout( function(){
          var text = that.html()
          text = text.replace(
	    /[@#A-Z\.-]/g,
	    function( ch ){ return "<strong>" + ch + "</strong>" }
	  )
          that.html( text)
	}, 10)
      })

      // Nicer tooltip
      if( !window.opera ){ // Don't do that on opera, issue, div & clippling
        // ToDo: on Touch devices, I should use long tap or tap&move,
        // see https://github.com/dotmaster/Touchable-jQuery-Plugin
	$("body").append( '<div id="tooltip"></div>')
	function tooltip(){
	  var title = $(this).attr( "title")
	  if( !title )return
	  $(this).hover(
	    function( e ){
	      $(this).attr( "title", "")
	      $("#tooltip")
	      .html( title)
	      .css( "position", "absolute")
              // Set initial position, will follow mouse
	      .css( "top",  (e.pageY + 1 * sw_hpx) + "px")
	      .css( "left", (e.pageX - 4 * sw_wpx) + "px")						
	      .css( "display", "none")
	      .fadeIn( 0)
	    },
	    function(){
	      $("#tooltip").fadeOut( 0)
	      $(this).attr( "title", title)
	    }
	  )
	  $(this).mousemove( function( e ){
	    $("#tooltip")
	    .css( "top",  (e.pageY + 1 * sw_hpx) + "px")
	    .css( "left", (e.pageX - 4 * sw_wpx) + "px")
	  })
	}
        try{
          $("a").each(    tooltip)
	  $("time").each( tooltip)
        }catch( e ){
	  De&&bug( "No nicer tooltip")
	}
      }
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
                //console.log( "self " + loc + " == " + url)
                return
              }
              var embed  = /http:\/\/(embed.simpliwiki.com\/.+)/.test( url)
              var iframe = /http:\/\/(.*simpliwiki.com\/.+)/.test( url)
              if( !(embed || iframe) )return
              //console.log( "ajax " + (embed ? "embed " : "iframe"))
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
                  //console.log( "oembed error")
                }
              })
            })
          },
          1
	)}

	// Embedly
	// ToDo: some sw_no_embed directive, noEmbed: true
	setTimeout(
          function(){
	    $("#content_text a")
           .embedly( {
              maxWidth: sw_content_width,
	      wrapElement: 'div',
	      method : "after"
	    })
          },
          1000
	)
      }
      // ToDo: handle dates, to display something nicer than an ISO format
    }

    // Signal screen size & other stuff to server
    if( sw_can_script == "maybe" ){ signalModel() }

    if( sw_meebo_bar ){ Meebo( "domReady"); }

    // Size textarea & install "Click to edit"
    if( window.sw_grow ){ window.sw_grow() }

    // Monitor changes in screen size
    $(window).resize( function(){
      redraw()
      signalModel()
    })
  })
  // console.log( "onready() done")
}

Session.htmlLayout = function( page, content, other, editclosure ){

  // No other content if fluid layout
  var fluid = this.config.rows == 0
  if( fluid ){ other = null }
  
  var head = ["\n"]
  var body = []
  var tail = []
  var previous_first = false

  if( this.canScript ){
    head.push(
      this.configScript( page, other, editclosure),
      this.htmlScript( Session.onload)
    )
  }else{
    editclosure = null
  }
  
  // ToDo: get rid of table if no other content
  head.push(
    '<div id="container">'
  )

  // On load resize font and hide previous content if needed
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
  if( this.canScript && this.canScript != "maybe" ){
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
    this.htmlScript( function sw_edit( editclosure ){
    // Client side

      // Do nothing if unable to ask server to do something
      if( !editclosure )return

      // I track the location not to mess with browser default behaviour
      var loc = window.location.href

      // First time textarea has focus, some special stuff occur
      sw_edit_had_focus = false

      // Define function installed when jquery .ready() fires
      // It is installed on the #content div, for click & mousedown events
      window.sw_onclick = function( e ){

        var content = document.getElementById( "content_text")

        e = e || window.event
        var target = e.target || e.srcElement

	// If click on a link, go to associated url
	if( $(target).closest( "a").size() ){
	  return
        }

        // Filter out embed.ly content
	if( $(target).closest( "object").size() ){
	  return
	}

        // If cannot switch to edit inline, do nothing
        if( (window.location.href != loc
          && window.location.href.indexOf( sw_address) < 0)
        || sw_editing
        || sw_touch_device
        ){
          // If already editing, manage some "macros"
          if( sw_editing && window.sw_get_input_selection ){
            window.sw_edit_onclick( e)
            return
          }
	  // Either I can't, I already switched, or browser is loading a page
	  return
	}

	// Load edit page in some cases
	var edit = document.getElementById( "content_editable")
        if( !edit
        || sw_cols != sw_config_cols
        ){
          window.location.href= sw_address + "?cid=" + editclosure;
	  return
	}

        // Refetch content if page is somehow old
        // ToDo: Commet style notification from other writer would be better
        var time_now = (new Date()).getTime()
        var age = time_now - sw_time_loaded
        //console.log( "click to edit, age: " + age)
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
          //console.log( "update content")
          sw_do.getPage( sw_page, function( result ){
            if( result.status == 200 && result.body ){
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
                  var local_change = (result.visitors == 1)
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

	// Else show the text area, next to the original text if possible
	// De&&bug( "Show textarea")
        // Hide "content" div
        if( content ){ content.style.display = "none" }
	// Show "content_editable" div
	// This is where I could turn the textarea into something else that
	// is more clever, ie TinyMCE or CodeMirror or something like that.
	// See https://github.com/marijnh/CodeMirror
        edit.style.display = "inherit"

        // Display current version in "previous content" area
        if( sw_previous_content_displayed ){
          var pc = document.getElementById( "previous_content")
          if( pc && pc.style.display != "none" ){
            pc.innerHTML = '\n\n' + content.innerHTML
          }
          $("#previous_content").fadeTo( 0, 1).removeClass( "fade")
	}
	// Move footer at the end of the page
        document.getElementById( "footer").style.position = "relative"
	// Give focus to properly sized textarea
        if( window.sw_grow ){ window.sw_grow() }
        // Copy submit button to the top menu
        window.sw_header_buttons()
        sw_editing = true

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
    }),
    this.htmlScript( "sw_edit( " + editclosure + ")")
    ) // push()
  }
  
  return head.concat( body, tail).join( "")
}

// usage of "comment" text field when editing a page
// either ask for user's name, wiki's title, new page's name
// or just a comment about the change, depending on current page & state

Session.shouldAskForName = function( page, req ){
// Returns true when time is appropriate to ask for the user's name
  if( this.shouldAskNothing( page, req) )return false
  if( !this.isAnonymous()               )return false
  return true
}

Session.shouldAskForWikiTitle = function( page, req ){
  if( this.shouldAskNothing( page, req)  )return false
  if( page.name == "AboutWiki"           )return true
  if( !page || !page.isHome()            )return false
  if( this.shouldAskForName( page, req)  )return false
  if( !this.wiki.isAnonymous()           )return false
  return true
}

Session.shouldAskForNewMember = function( page, req ){
  if( page.name == "NewMember"
  ||  page.name == "NouveauMembre"
  )return true
  return false
}

Session.shouldAskForComment = function( page, req ){
  if( this.shouldAskNothing( page, req)      )return false
  if( this.shouldAskForName( page, req)      )return false
  if( this.shoudASkForNewMember( page, req)  )return false
  if( this.shouldAskForWikiTitle( page, req) )return false
  return true
}

Session.shouldAskNothing = function( page, req ){
  if( this.isMentor
  &&  page.name != "AboutWiki"
  ){
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
    // And, finally, send the answer
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
  
  // If processing a POST, respond() will try to redirect to referer
  if( req.method == "POST" && !req.isRest && page.wasIncarned() ){
    // However, there can be an issue if no referer header...
    // Note: user will log back using cookie
    // ToDo: should check some "can_cookie" property of the session
    this.login_de&&bug( "Redirect after post")
    // Provide a link, for cases where respond() refuses to redirect
    html.push( this.link( page, null, "click")) // page, label, title
    phase3()
    return
  }

  this.get_de&&bug( "viewForm:", page)

  // Check login/logout with twitter or facebook
  if( that.handleChangedLogin( page, req) )return

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
      if( page.name.includes( "@") ){
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
    if( !that.canMentor
    &&  !(that.previousWikiPage
      && that.previousWikiPage.isUser()
      && that.previousWikiPage != that.loginPage)
    ){
      if( !that.wiki.isVeryOpen()
      && page.getCode() != that.loginCode
      ){
        that.login_de&&bug( "Delayed login, with code:", page)
        that.loginWithCode = true
        return that.codeLoginForm( page, req)
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
        // I assume that if user visit her code, mentors would like it
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
      var url = page.data.url
      var code = page.data.code
      page.data.url = null
      page.data.code = null
      return that.redirect( req, url, code)
    }
  }
  
  // Adjust user's config based on content of some pages
  if( page.data
  && !page.isDraft()
  && !that.isMentor
  && !page.isDo()
  && !page.isCopy()
  && !page.isRestore()
  && !page.isDeletion()
  ){
    var newdata = that.wiki.extractBasicYaml( data)
    if( newdata != page.data ){
      that.de&&bug( "set new data, page:", page.name)
      page.data = newdata
    }
    that.wiki.setOptions(
      that.config,
      page.data,
      that == that.loginPage ? "user" : "page"
    )
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
      html.push( tools = that.toolForm( page))
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
          previous = that.pageLabel( other, true)
          + that.wikify( other.getBody(), other)
        }
      // If previous page is ok
      }else{
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
  })
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

  // Check login/logout with twitter or facebook
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
    var text = that.toolForm( page, "edit")
    + that.htmlLayout(
      page,
      ((page.isHome() && that.wiki.isRoot()
        ? ""
        : that.i18n( "Edit ") + that.link( page) + "\n\n")
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
  })
}

Session.pageLabel = function( page, long ){
// Returns label for page, 2 lines, including blanks
  if( page.name.includes( "Slide")
  && !this.twoColumns
  ){
    return ""
  }
  return ""
  + (page.wasInherited() ? (this.wiki.parentWiki.name) + " " : "")
  + "Page <i>"
  + this.link( page, page.name, this.tooltip( page))
  + "</i>\n\n"
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

Session.autogrowScript = function sw_grow( e ){
// Client side
// ToDo: see http://tpgblog.com/2011/01/02/bettergrow/

  if( typeof sw_wpx === 'undefined' )return // early

  var ta = document.getElementById( 'textarea_sw')

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
        text || (text = ta.value)
        guest || (guest = "")
        form.innerHTML = '<form'
        + ' action="' + query + '"'
        + ' method="POST"'
        + ' accept-charset="utf-8"'
        + '>'
        + '<textarea name="text"></textarea>'
        + '<input type="hidden" name="guest">'
        + '<input type="hidden" name="post" value="' + verb + '">'
        + '</form>'
        form.firstChild.children[0].value = text
        form.firstChild.children[1].value = guest
        form.firstChild.action = action || sw_form.action
        //console.log( "submit"); console.log( form)
        window.onbeforeunload = null
        form.firstChild.submit()
    }

    window.sw_edit_onclick = function( e ){
      e = e || window.event
      var target = e.target || e.srcElement
            if( target == ta ){
              var pos = window.sw_get_input_selection( ta)
              //console.log( "click in textarea, start:" + pos.start + ", end: " + pos.end)
              var val = ta.value.replace( /\r\n/g, "\n")
              if( pos.start != pos.end ){
                var action = val.slice( pos.start, pos.end)
                var limit = pos.end + val.substr( pos.end).indexOf( "\n") + 1
                // console.log( "action:'" + action + "'")
                if( action == "SendNow" ){
                  window.sw_submit( "Send", "", val)
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
                  //console.log( "insert ISO date")
                  ta.value = val.substr( 0, pos.start)
                  + (new Date()).toISOString() + "\n" + action
                  + val.substr( pos.end)
                 }else if( action == "DateNow" ){
                  //console.log( "insert local date")
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
        //console.log( "edit_form children count:" + form.childElementCount)
        while( ii < form.childElementCount ){
          child = children[ii++]
          //console.log( "child type:" + child.type)
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

    // In "edit" pages sw_edit.js is not included
    if( !window.sw_onclick ){
      window.sw_onclick = window.sw_edit_onclick()
      window.sw_header_buttons()
    }

    // Install click handler ("Click to edit" unless "edit" page already)
    $("#content")
    .click( window.sw_onclick)
    // Dragging something also triggers the edit mode
    // Works on Chrome
    // ToDo: does not work on FF & Opera... :(
    .bind( "dragenter",  function( event ){
      $(this).unbind( event)
      window.sw_onclick()
    })

   } // if grow() called for the first time

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
      ta.value = val + "\n"
    }
  }
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
  var $ta    = $(ta)
  if( !clone ){
    // Properties which may effect space taken up by characters
    var props  = ['height','width','lineHeight','textDecoration','letterSpacing']
    var propOb = {}
    // Create object of styles to apply:
    $.each( props, function( i, prop ){
      propOb[prop] = $ta.css(prop)
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
  //console.log( "sh:" + sh + ", ch:" + ch)
  //if( sh > ch ){
    //console.log( "grow")
    ta.style.height = (sh + 2 * sw_hpx) + 'px'
  //}else if( sh < (ch - (2 * sw_hpx)) ){
    //console.log( "shrink")
    //ta.style.height = (sh + 2 * sw_hpx) + 'px'
  //}
  clone.height( ta.style.height)
  // Give focus, but once only, because I don't control the
  // caret position (that should follow the mouse I wish) and
  // as a result the caret position determines the scroll top of
  // the text area...
  if( !sw_edit_had_focus ){
    sw_edit_had_focus = true
    !sw_iframe && ta.focus()
    // Also install a handler for Ctrl-S and Esc shortcuts
    // ToDo: see jquery.hotkeys.js
    var ctrl_pressed = false
    $("#textarea_sw")
    .keydown( function( event ){
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
    .mouseenter(   function(){ window.sw_grow() })
  }
}

Session.editFragment = function( page, req ){
// I build a form with a textarea, an input field and submit buttons

  // ToDo: cache / make global
  var that = this
  var postclosure = that.postClosure
  
  // Figure out some decent value for the text area if empty
  var data = page.getBody() || ""
  var empty = !data
  if( empty
  || (page.wasDeleted() && !this.isMentor)
  ){
    // "User" pages' content default to the current user's name
    if( page.isUser() ){
      // Unless mentor is apparently creating a user
      if( that.canMentor
      && ( "User@".starts( page.name)
        || "User[".starts( page.name)
        || "@".ends(       page.name))
      ){
        data = page.name.substr( "User".length) + "\n"
      }else{
        data = that.userName() + "\n"
      }
    }else if( page.isCode() ){
      data = that.userName() + "\n"
      // If maybe creating a new user
      if( this.previousPage && this.previousPage.isUser() ){
        var user = this.previousPage.getUser()
        if( !user.includes( "Guest") ){
          data = user + "\n" + Sw.dateNow.toISOString() + "\n" + data
        }
      }
      // ToDo: quid if previous page is a Map?
    }else if( page.isHome()
    && that.wiki.isAnonymous()
    && !page.wasDeleted()
    ){
      data = that.i18n( "Welcome to your new secret wiki")
    }else{
      data = ""
    }
  }
  data = Wiki.htmlize( data)
  
  var autogrowscript = this.htmlScript( Session.autogrowScript)
  var nrows = data.length - data.replace( /\n/g, "").length + 5
  if( nrows < 5 ){ nrows = 5 }
  
  var textarea = [
    "<textarea", // ToDo: I want 50, but asking 50 gets me more...
    ' name="text" cols="', that.config.cols, '" rows="', nrows, '"',
    ' id="textarea_sw"',
    ">",
    data, // ToDo: I need to encode this somehow
    '</textarea>'
  ].join( "")
  
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
  
  return [
    '<form method="POST" id="edit_form" accept-charset="utf-8" ',
    "action=\"" + this.hrefPath( page) + "?cid=", postclosure, "\">",
    textarea,
    buttons.join( ""),
    "</form>",
    "\n\n\n\n\n\n\n", // Room for footer
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
  
  // Visits
  if( tools
  && !with_code
  //&& that.wikiHistory.length
  && !that.wiki.isEmpty()
  ){
    foot.push( this.i18n( "Visit ")
      + ((!this.canScript || this.isTouch)
      ? ""
      : '<a HREF="javascript:history.go( -1)"'
      + ' title="' + this.i18n( "Go to previous page") + '">'
      + ' ' + this.i18n( "back") + '</a> ')
      + that.wikify( that.wikiHistory.slice( 0, 7).join( " "))
    )
  }

  // Backlinks
  if( tools && !with_code && !page.isHome() ){
    var buf = that.i18n( "Links:")
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
    foot.push(
      that.i18n( "Web address: ")
      + HtmlA(
	isuser ? "<em>SECRET!</em>" : that.i18n( "drag this"),
	Wiki.htmlizeAttr( plink) // Wiki.decodeUrl( plink))
      )  
    )
    if( (page.data && page.data["fbLike"])
    || (that.config.fbLike 
      && (page.isHome()
        || page.isGuest()
        || page.isPublic()
        || page.isRead())
        || that.facebookId // Can add comment on any page
      )
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
  }else{
    fb_like = false
  }

  // Invitation code form?
  if( tools 
  && ( that.isGuest()
    || page.name == "SignIn"
    || page.isHome()
    || page == that.loginPage
    || page.name == "DoProfile"
    || page.name == "DoSearch"
    || page.isMap()
    || page.isSecret()
    || that.wiki.isUserWiki()
    || that.facebookId // Provide "sign out" on all pages
    )
  ){
    with_code = true
    foot.push( that.codeForm())
  }

  // fb like or fb comments
  if( true ){
    if( fb_like ){
      // ToDo: should move this to html()
      page.fbLike = true
      // ToDo: http://simpliwiki.com/jeanhuguesrobert@ should open my wiki
      // versus SimpliWiki root wiki as of today.
      //plink = plink.replace( "/HomePage", "/")
      var fb
      // ToDo: compute a better width
      if( !that.facebookId ){
        if( !that.isIframe ){
          // ToDo: figure out a way to do that only when footer is displayed
	  fb = ' <iframe src='
          + '"http://www.facebook.com/plugins/like.php?'
	  // ToDo: should I force apps.facebook.com/simpliwiki?
	  + 'href=' + Wiki.htmlizeAttr( plink)
          + '&amp;layout=button_count&amp;show_faces=false&amp;width=200&amp;'
          + 'action=like&amp;font=verdana&amp;colorscheme=light&amp;height=21" '
          + 'scrolling="no" frameborder="0" style="border:none; overflow:hidden;'
          + 'height:21px;" allowTransparency="true"></iframe>\n'
        }
      }else{
	fb = ""
	// ToDo: fix this, there is an issue with @ where
	// apparently facebook get rid of whatever is after @
	// As a result: no comments on personal wikis...
	if( true || !page.fullname().includes( "@") ){
	  fb += "<br>"
          //+ that.i18n( "Share:") + "<br>"
	  //+ '<fb:like show_faces="true" font="verdana"></fb:like>'
	  //+ "<br><br>"
	  + that.i18n( "Comment:") + "<br>"
	  + '<fb:comments numposts="20" publish_feed="true"'
	  + ' xid="' + encodeURIComponent( plink) + '" '
          + ' width="' + that.screenContentWidth + '" '
	  + '>'
	  + '</fb:comments><br>'
	}
        page.needsFacebook = true
      }
      foot.push( fb)
    }else{
      page.fbLike = false
    }
    // ToDo: QR code? http://chart.apis.google.com/chart?cht=qr&chs=150x150&chl='
    // +encodeURIComponent(top.location.href)+'&chld=H|0','qr','width=155,height=155')
  }

  // Add facebook FBML stuff unless codeForm() did
  if( page.needsFacebook ){
    foot.push( 
      '<div id="fb-root"></div>'
      + that.htmlScript( that.xfbmlScript)
    )
  }

  // page info
  if( that.isMentor ){
    function info( page, msg ){
      var ctx = page.saveContext()
      if( msg ){ foot.push( msg) }
      foot.push( (ctx.draft ? "Draft: " : "Page: ") + ctx.name
      + " " + that.wiki.protoGuest.tooltip( page))
      foot.push( "Last visitor: " + ctx.visitor
      + " " + that.wiki.protoGuest.timeLabel( ctx.timeVisited))
      foot.push( "Last writer: " +  ctx.writer
      + " " + that.wiki.protoGuest.timeLabel( ctx.timeModified))
      foot.push( "First writer: " + ctx.creator
      + " " + that.wiki.protoGuest.timeLabel( ctx.timeCreated))
      page.isCold() && foot.push( that.i18n( "cold"))
      ctx.hot       && foot.push( that.i18n( "hot"))
      ctx.inherited && foot.push( that.i18n( "inherited"))
      if( ctx.visits ){
        foot.push( that.i18n( "Visits: ") + ctx.visits)
      }
      if( ctx.backlinks ){
        foot.push( that.i18n( "Links: ") + ctx.backlinks.sort().join( ", "))
      }
    }
    if( page.isDraft() ){
      info( page.nondraft)
    }
    info( page)
  }
  
  // Powered by...  computed in ... milliseconds
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
      +   " <strong>Simpl<em>i</em>Wiki</strong>"
      + "</a>"
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
    '<br>\n',
    // Arrow to scroll to the top & anchor referenced in toolForm()
    '<div id="gotop"><a name="footer"></a><a href="#top">&uarr;</a></div>',
    foot.join( "<br>\n"),
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
    var ndrafts = it.wiki.draftsCount( it.canMentor) // true => with codes
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
            draft.name + " " + it.tooltip( draft)
          ))
        }
      // Many drafts, invoke DoDrafts
      }else{
        tools.push( it.linkPage(
          "DoDrafts",
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
    || true // Always display, fixes issue with embedly pages
    || !it.canScript
    ||  it.canScript == "maybe"
    ||  it.isTouch
    ){
      tools.push( it.button( "edit", editclosure, 
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
    tools.push( it.button( "Do", doclosure))
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
  if( page.name == "DoDrafts" && it.canMentor ){
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
  if( (page == it.loginPage || it.wiki.isUserWiki())
  && it.hasUser()
  ){
    var conflict = it.hasTwoUsers() ? "!!!" : ""
    var label = it.getPlausibleName()
    tools.push( it.linkPage(
      "DoProfile",
      conflict + it.i18n( "wikis"),
      label + ", " + it.i18n( "your wikis")
    ))
  }

  // Secret, on member pages of sub wikis mainly
  if( (!it.wiki.isRoot() || !it.isGuest())
  && !it.wiki.isEmpty()
  && !it.wiki.isSandbox
  ){
    if( it.getData( page, "Code") ){
      if( !page.isUser() ){
        it.bug_de&&bug( "Code in non user page:", page)
      }
      tools.push( it.linkPage(
        "Code" + it.getData( page, "Code").capitalize(),
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

  // login name
  if( false && it.isGuest() ){
    tools.push( it.linkPage( "SignIn"))
  // If user entered the wiki via the HomePage...
  }else if( it.loginPage.isHome() ){
    // Don't display, useless when anonymous logged in via HomePage
    if( it.isAnonymous()
    && !it.wiki.isEmpty()	// Remove noise
    && !it.wiki.isSandbox
    && !it.wiki.isRoot()
    ){
      // Display "sign in" page instead
      tools.push( it.linkPage(
        "SignIn",
	it.i18n( "sign in"),
	it.i18n( "sign in") // ToDo: better msg
      ))
    }
  // If special user wiki, display twitter or facebook name
  }else if( it.wiki.isUserWiki() && !it.isDebug ){
    // Some /user/Fxxxx wiki, use twitter name, fb fallback
    var name = it.twitterName || it.facebookName || "???"
    if( name ){
      tools.push( "<em>" + name + "</em>" )
    }
  // If "normal" case, display either login name or "home" for entry page
  }else if( !it.isAnonymous() 
  || it.getCurrentPage() != it.loginPage
  ){
    // Display name and link to login page
    var label = it.isAnonymous()
    ? it.i18n( "home")
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
    tools.push( it.linkPage( 
      "Help" + SW.name,
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
    redo.call( this)
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
  var verb_is_stamp   = verb == that.i18n( "Stamp")
  var verb_is_copy    = verb == that.i18n( "Archive")
  var verb_is_cancel  = verb == that.i18n( "Cancel")
  var verb_is_delete  = verb == that.i18n( "Delete")
  var verb_is_draft   = verb == that.i18n( "Draft")
  var verb_is_restore
  = verb == that.i18n( "History") || /.*tablir/.test( verb)
  
  if( !verb || verb_is_cancel ){
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
    // Defaults to HomePage of session's wiki...
    if( !text || text == "a wiki" || text == "un wiki" || text == "secret" ){
      // ... unless it is a better idea to go to some other wiki
      if( that.wiki.isRoot() && verb_is_wiki ){
        if( text !=  "secret"
	&& ( "@".starts( that.userName())
	  || "@".ends( that.userName()))
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
    De&&bug( "Verb: ", verb, ", text: ", text)
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
          this.setData( page, "Mail", mail, true)  // true => don't flush
          this.setData( page, "Code", this.loginCode)
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
                var mail = that.getData( userpage, "Mail")
                if( !mail ){
                  that.setCurrentPage( that.lookup(
                    that.i18n( "HelpNoSuchUser")
                  ))
                  return that.viewForm( req)
                }
                var code = that.getData( userpage, "Code")
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
                  SW.protocol + "//" + SW.domain
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
      if( SW.wikiWord.test( camelcase) ){
        guest = camelcase
      // Else use a free link
      }else{
        guest = "[" + guest + "]"
        if( !SW.wikiWord.test( guest) ){
	  // guestnamize() will do its best, see below
        }
      }
      // Don't handle twitter & facebook names here, too complex, ToDo
      if( "@".starts( guest) || "@".ends( guest) ){
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
              .loginForm( guest, this.loginCode, this.canMentor, page, req)
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
            return this.loginForm( guest, this.loginCode, this.canMentor, page, req)
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
  
  page.read( function( err, page ) {
  
  if( !that.canEdit( page) ){
    De&&bug( "Cannot edit ", page)
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
  var should_log = true
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
    && !that.isAnonymous()
    && that.userName() != sane_title
    ){
      that.de&&bug( "Set title:", sane_title)
      that.setData( that.wiki.aboutwikiPage, "title", sane_title)
      that.wiki.setOptions( that.wiki.config, {title: sane_title}, "wiki")
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
  
  if( text == old_text && !verb_is_stamp ){
    return that.viewForm( req)
  }
  De&&bug( "Put change")
  // Make sure user did not inadvertly remove her name from user page
  if( page.isUser() && !that.isMentor ){
    var can_read = that.canRead( page, false, text)
    if( !can_read ){
      De&&bug( "Restore user name on front line")
      text = that.userName() + "\n" + text
    }
    // If mail address changed, send a mail
    // var olddata = that.wiki.extractBasicYaml( old_text)
    // var oldmail = olddata ? olddata.Mail : null
    if( !page.isDraft() ){
      var oldmail = page.get( "Mail")
      var newdata = that.wiki.extractBasicYaml( text)
      var newmail = newdata ? newdata.Mail : null
      var needsend = false
      if( oldmail && !newmail ){
        De&&bug( "Restore mail")
        newdata.Mail = oldmail
        text = that.wiki.injectBasicYaml( text, newdata)
        page.data = newdata
      }else if( newmail != oldmail ){
        De&&bug( "Change mail address, send a mail")
        newmail = that.registerMailAddress( newmail)
        page.set( "Mail", newmail)
        newdata.Mail = newmail
        text = that.wiki.injectBasicYaml( text, newdata)
        page.data = newdata
      }
    }
  // Non user pages (or mentor mode), update data, unless draft
  }else if( !page.isDraft() ){
    var newdata = that.wiki.extractBasicYaml( text)
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
        that.wiki.setOptions( that.wiki.config, {mentors: mentors}, "wiki")
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
  that.wiki.touch( true) // true => hard
  // Make sure Yaml section is always at the end
  if( !page.isDraft() ){
    text = that.wiki.injectBasicYaml(
      that.wiki.injectBasicYaml( text), // Erase
      page.data                         // Add
    )
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
      that.setCurrentPage( page)
    }
    if( should_log && !that.isGuest() && !page.isDraft() ){
      that.logStamp( page, should_log)
    }
    // Add to copy page if asked for
    // or if not done for a long time
    // or new writer
    if( verb_is_copy
    || !age
    || (age > 24 * 60 * 60 * 1000) // Daily
    || page.lastWriter() != that.userName()
    ){
      var copyname = "Copy" + page
      that.copyPage( page, copyname, function( err, page, copypage ){
        // ToDo: issue with redirect
        // req.isRest = true
        if( err == 0 ){
          if( that.isGuest() ){
            that.setCurrentPage( page)
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
      while( --limit
      && (comment = about_changes.frontLine())
      ){
        about_changes = about_changes.butFrontLine()
        if( /\s* \s* - .*/.test( comment) ){
          change = comment
          break
        }
      }
      if( !limit ){
        this.bug_de&&bug( "long loop in compress")
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
  var url = SW.protocol + "//iframe." + SW.domain + "/" + path
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
          + ' title="secret">'
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
    document.write(
      Session.i18n( "go to ")
      + buf.join( ", ")
      + Session.i18n( " or...")
      + "<br>"
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
// This is client code side that deals with Twitter & Facebook signin.
// It is included in index.html and in some wiki pages

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
    }else{
      try{ FB.logout() }catch( e ){}
      try{ update_fb_login() }catch( e ){}
    }
  })
  // Only index.html defines a Session object
  if( typeof Session === 'undefined' )return
  if( Session.config.lang == "fr" ){
    $("#1st").empty().append( "hello !")
    //$("#2nd").empty().append( "&agrave; pr&eacute;sent...")
  }else{
    $("#1st").empty().append( "hello!")
    // $("#2nd").empty().append( "now...")
  }
}

window.install_signin = function(){
  // Only index.html defines a Session object
  if( typeof Session === 'undefined' )return
  if( Session.config.lang == "fr" ){
    $("#1st").empty().append( "se connecter (optionnel)")
    $("#2nd").empty().append( "puis...")
  }else{
    $("#1st").empty().append( "maybe tell who your are (optional)")
    $("#2nd").empty().append( "then...")
  }
}

window.update_tw_login = function( T ){
  var screenName
  var label
  var profileImage
  var is_in
  if( is_in = T.isConnected()) {
    screenName = T.currentUser.data( 'screen_name')
    label = T.currentUser.data( 'name')
    sw_set_cookie( "twitter", "screenname", screenName)
    sw_set_cookie( "twitter", "label", label)
    sw_set_cookie( "twitter", "id",
      T.currentUser.data( 'id_str') || T.currentUser.data( 'id')
    )
    // ToDo: signature
    profileImage = T.currentUser.data('profile_image_url');
    install_signout( "tw", $('#tw-login').fadeOut( 0).html( ""
      + "<img src='" + profileImage + "'/>" 
      + ' @<a href="/' + screenName + '">' + screenName + "</a>"
      + " (" + label + ")"
    ))
    // ToDo: Should set the value of the "wiki!" form to @xxxx
  }else{
    sw_set_cookie( "twitter", "screenname", null)
    sw_set_cookie( "twitter", "label",      null)
    sw_set_cookie( "twitter", "id",         null)
    $("#tw-login").empty()
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


window.update_fb_login = function( S ){
// See http://fbrell.com/

  var screenName
  var label
  S || (S = FB.getSession())
  var is_in
  var async_reload = false

  if( is_in = S ){
    FB.api( "/me", function( response ){
      var link = response.link
      var ii = link.lastIndexOf( "/")
      screenName = link.substr( ii + 1)
      // For user without a profile
      if( (ii = screenName.indexOf( "id=")) >= 0 ){
        screenName = "id" + screenName.substr( ii + "id=".length)
      }
      label = response.name
      sw_set_cookie( "facebook", "screenname", screenName)
      sw_set_cookie( "facebook", "label", label)
      sw_set_cookie( "facebook", "id", response.id)
      //De&&bug( "window.sw_is_iframe " + window.sw_is_iframe)
      //De&&bug( "window.sw_is_index "  + window.sw_is_index)
      //De&&bug( "window.sw_comeback "  + window.sw_comeback)
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
        + '<fb:profile-pic uid="loggedinuser" linked="true">'
	+ '</fb:profile-pic> '
	+ '<a href="/' + screenName + '@">' + screenName + '@</a>'
	+ " (" + label + ")"
      ))
      FB.XFBML.parse() // document.getElementById( 'fb-login'))
    })

  }else{
    sw_set_cookie( "facebook", "screenname", null)
    sw_set_cookie( "facebook", "label",      null)
    sw_set_cookie( "facebook", "id",         null)
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
    appId  : '115811888485309',
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


var sw_footer_was_displayed = false

window.onFooterDisplay = function( force ){
// Called when footer part of page may become visible.
// Inits stuff about facebook & twitter that are better avoided at first

  // Do stuff once only
  if( sw_footer_was_displayed )return

  // Code to load the script from facebook, async, after a small delay
  setTimeout( function(){

  // If still visible, load
  if( !force && !$("#footer").is(":visible") )return
  sw_footer_was_displayed = true

  var e = document.createElement( "script")
  if( typeof sw_lang === "undefined" ){
    sw_lang = "en"
  }
  var lang = (sw_lang == "fr") ? "fr" : "en_US"
  e.src = document.location.protocol
  + '/' + '/connect.facebook.net/' + lang + '/all.js'
  e.async = true
  var elem = document.getElementById( 'fb-root')
  elem = elem || document.getElementsByTagName( 'head')[0]
  elem.appendChild( e)
  //De&&bug( "loading Facebook connect... " + lang)

  // Code for twitter anywhere
  if( typeof twttr !== "undefined" ){
    twttr.anywhere( function (T) { 
      T.bind( "authComplete", function( e, user ) {
        // triggered when auth completed successfully
        update_tw_login( T)
      })
      T.bind("signOut", function (e) {
        // triggered when user logs out
        update_tw_login( T)
      });
      update_tw_login( T)
    })
  }

  }, 1000) // setTimeout()
}

}

Session.xfbmlScript = function sw_xfbml(){

window.fbAsyncInit = function() {
  // $("#fb-login").html( '<fb:login-button></fb:login-button>')
  // update_fb_login( FB.getSession())
  FB.init({
    appId  : '115811888485309',
    status : true, // check login status
    cookie : true, // enable cookies to allow the server to access the session
    xfbml  : true, // parse XFBML
    // ToDo: double check Expires headers and caching by browser
    channelUrl  : 'http:/'+'/' + SW.domain + "/channel.html"  // custom channel
  })
}

var sw_footer_was_displayed = false

window.onFooterDisplay = function( force ){
// Called when footer part of page may become visible.
// Inits stuff about facebook & twitter that are better avoided at first

  // Do stuff once only
  if( sw_footer_was_displayed )return

  // Code to load the script from facebook, async, after a small delay
  setTimeout( function(){

  // If still visible, load
  if( !force && !$("#footer").is(":visible") )return
  sw_footer_was_displayed = true

  var e = document.createElement( "script")
  if( typeof sw_lang === "undefined" ){
    sw_lang = "en"
  }
  var lang = (sw_lang == "fr") ? "fr" : "en_US"
  e.src = document.location.protocol
  + '/' + '/connect.facebook.net/' + lang + '/all.js'
  e.async = true
  var elem = document.getElementById( 'fb-root')
  elem = elem || document.getElementsByTagName( 'head')[0]
  elem.appendChild( e)
  //De&&bug( "loading Facebook connect... " + lang)

  }, 1000) // setTimeout()
}

}


Session.codeForm = function(){
// Return html code to login using a secret code (or twitter/facebook)
// ToDo: also does a search, should be distinct
  var buf = '<div id="login">'
  var page = this.getCurrentPage()
  var postclosure = this.postClosure
  if( !this.wiki.isEmpty()
  &&  !this.wiki.isVeryOpen()
  &&  !this.wiki.isUserWiki()
  ){
    buf += '<form method="POST" accept-charset="utf-8" '
    + "action=" + this.hrefPath( page) + "?cid=" + postclosure + ">"
    + '\n'
    + this.i18n( "Go to page: ")
    + '<input id="text" name="text" title="'
      + this.i18n( "Invitation code") + '" value="" />'
    + '\n<input type="submit" name="post" value="'
      + this.i18n( "Enter") + '"/>'
    + '</form>\n'
  }
  if( this.canScript ){
    if( (page.isUser() || this.isAnonymous()) ){
      buf += ""
      + '<div id="fb-login">Facebook... <img src="/facebook.gif" /></div>'
      + '<div id="tw-login">Twitter... <img src="/twitter.gif" /></div>'
      + '<div id="fb-root"></div>'
      + this.htmlScript( this.signinScript)
      // Instruct .html() to include twitter script in <head>
      page.needsTwitter = true
      // Instruct footerForm() to not include facebook script
      page.needsFacebook = false
    }else{
    }
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
// ToDo: requests to read/write pages

  var that = this

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
      this.screenCols      = Math.ceil( this.screenWidth  / px)
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

Session.apiScript = function sw_api( cid, url, _$ ){
// Client side
// ToDo: I need son2.js (for IE support)
// See http://json.org/json2.js
// ToDo: make it cross domain, see http://saunter.org/janky.post/

  // ToDo: avoid global scope
  window.sw_page_cache = {}

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

  _$ || (_$ = $)

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
      url: url,
      cid: cid,
      do: "putPage",
      name:name,
      body:body,
      data: data ? JSON.stringify( data) : null
    }
  },

  appendPageRequest: function sw_putPageRequest( name, body ){
    return {
      url: url,
      cid: cid,
      do: "appendPage",
      name:name,
      body:body
    }
  },

  getPage: function sw_getPage( name, cb ){
    var cache = window.sw_page_cache[name]
    var that  = this
    if( cache ){
      setTimeout( function(){
        cb.call( that, cache)
      }, 1)
      return
    }
    var req = api.getPageRequest( name)
    var url = req.url
    delete req.url
    return _$.get( url, req, function( d, t, x ){
      window.sw_page_cache[name] = d
      if( d.data ){
        d.data = JSON.parse( d.data)
      }
      cb.call( that, JSON.parse( d), t, x)
    })
  },

  clearPageCache: function( name ){
    if( name ){
      delete window.sw_page_cache[name]
    }else{
      window.sw_page_cache = {}
    }
  },

  putPage: function sw_putPage( name, body, data, cb ){
    var that = this
    var req  = api.putPageRequest( name, body, data)
    var url  = req.url
    api.clearPageCache( name)
    delete req.url
    return _$.get( url, req, function( d, t, x ){
      if( d.data ){
        d.data = JSON.parse( d.data)
      }
      if( d.status == 200 ){
        window.sw_page_cache[name] = d
      }
      cb.call( that, JSON.parse( d), t, x)
    })
  },

  appendPage: function sw_putPage( name, body, cb ){
    var that = this
    var req  = api.appendPageRequest( name, body)
    var url  = req.url
    api.clearPageCache( name)
    delete req.url
    return _$.get( url, req, function( d, t, x ){
      if( d.data ){
        d.data = JSON.parse( d.data)
      }
      if( d.status == 200 ){
        window.sw_page_cache[name] = d
      }
      cb.call( that, JSON.parse( d), t, x)
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
  return api
}

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
  var ishtml = !page || page.isHtml()
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
  var head = !this.isOembed
  var buf = !head ? [] : [
    '<!DOCTYPE HTML>',
    ("DoAngular".starts( page.name)
      ? '<html xmlns:ng="http://angularjs.org">'
      : '<html>'
    ),
    '<head>',
    '<meta http-equiv="Content-Type" content="text/html; charset=utf-8">',
    '<meta http-equiv="Pragma" content="no-cache">',
    '<meta http-equiv="Expires" content="-1">',
    // http://www.chromium.org/developers/how-tos/chrome-frame-getting-started
    // JHR: breaks Facebook Connect & Twitter Anywhere...
    //'<meta http-equiv="X-UA-Compatible" content="IE=8,chrome=1">',// Chrome Frame
    '<meta name="viewport" content="width=device-width">', // iPhone
    "<title>", title, "</title>"
  ]
  // Angular's script
  if( "DoAngular".starts( page.name) ){
    buf.push( '<script type="text/javascript" '
      + 'src="http://angularjs.org/ng/js/angular-debug.js"'
      + 'ng:autobind>'
      + '</script>'
    )
  }
  // SimpliWiki's api
  buf.push( this.htmlScript( this.apiScript))
  // Facebook open graph meta data
  if( head && page && page.fbLike ){
    var ogtype  = "article"
    var ogurl =  this.wiki.permalink( page.name)
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
    var ogtitle = Wiki.htmlizeAttr( this.wiki.getTitle() || this.wiki.name)
    var ogsite_name = Wiki.htmlizeAttr( page.wiki.getLabel( this, true))
    if( !ogsite_name ){ ogsite_name = this.wiki.getRoot().name }
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
  if( !ishtml ){
    head && buf.push(
      "<link ",
      'rel="shortcut icon" href="/yanugred16.png" type="image/png"',
      "/>"
    )
    // Google fonts
    head && buf.push(
      '<link rel="stylesheet" type="text/css" href="http://fonts.googleapis.com/css?family=Droid+Sans|Droid+Sans:bold">',
      '<link rel="stylesheet" type="text/css" href="http://fonts.googleapis.com/css?family=Droid+Sans+Mono|Droid+Sans+Mono:bold">'
    )
    // CSS, default, inlined in "inline" debug mode
    if( this.inline_de ){
      buf.push( [
        '\n<style type="text/css">',
        Sw.style,
        '</style>\n'
      ].join( ""))
    }else{
      buf.push( 
        "<link "
        + 'rel="stylesheet" href="/simpliwiki.css" type="text/css"'
        + "/>"
      )
    }
    // If config specified additionnal style, at wiki or user level
    var style = this.wiki.config.cssStyle
    if( this.config.cssStyle
    &&  this.config.cssStyle != "no"
    ){
      style = this.config.cssStyle
    }
    if( style && style != "no" && !this.isMentor ){
      if( !SW.wikiWord( style) ){
        style = Wiki.htmlizeAttr( style)
        buf.push( 
          "<link "
          + 'rel="stylesheet" href="', style,'" type="text/css"'
          + "/>"
        )
      }else{
        style = this.lookup( style)
        if( !style.isSensitive() ){
          if( style.isDraft() ){
            style = style.nondraft
          }
          if( !style.getBody() ){
            if( !style.wasIncarned() ){
              style.read( SW.noop)
            }
            // Use default, will use config specified next time if possible
            style = null
          }else{
            // Use style, without the Yaml section however
            style = Wiki.injectBasicYaml( style.getBody(), {})
            buf.push( [
              '\n<style type="text/css">',
              style,
              '</style>\n'
            ].join( ""))
          }
        }else{
          // Protect security access of sensitive informations
          style = null
        }
      }
    }
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
  // ToDo: not usefull anymore, body display is set to none client side
  var visible = (this.canScript !== true || ishtml)
  ? ""
  : ' style="display:none;"'
  NDe&&bug( "Html head: ", buf.join( "\n"))
  // virteal.com specific stuff
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
  if( this.canScript && !ishtml ){
    // JQuery 1.4.4 hosted by Google, thanks. hotscroll.js is local
    buf.push( '<script type="text/javascript"'
      + 'src="http://ajax.googleapis.com/ajax/libs/jquery/1.4.4/jquery.min.js">'
      + '</' + 'script>'
    )
    if( true || !this.isTouch ){
      // My scroll cue hack
      buf.push(
        '<script type="text/javascript" src="/hotscroll.js"></' + 'script>'
      )
      // embed.ly
      buf.push(
	'<script type="text/javascript" src="http://scripts.embed.ly/jquery.embedly.min.js"></' + 'script>'
      )
    }
    // ToDo: For custom domains, I should get the id from the AboutWiki's data
    if( this.custom ){
    }
    if( page.needsTwitter ){
      page.needsTwitter = false
      buf.push( '<script src="http://platform.twitter.com/anywhere.js?'
        + 'id=PhVLqRKKECLyplTAQEP07w&v=1" type="text/javascript"></script>'
      )
    }
    // Do some wikify client side when possible
    if( this.canScript
    && !"on_rfc".starts( page.name)
    ){
      buf.push( this.htmlScript( this.wikifyText))
    }
  }
  if( head ){
    buf.push( '</head><body', visible, '>')
  }else{
    buf.push( '<div id="simpliwiki">')
  }
  buf.push(
    body,
    (this.isDebug ? '<div id="traces"></div>' : "")
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
    "DoProfile":  "Your wikis",
    "trash":      "restore",
    " stamps":    " changes",
    "stamps":     "changes",
    "Invitation code": "invitation code or page's name", // "email address",
    "err:locked":  "HelpLockedPage",
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
    "AboutWiki":    "options wiki",
    "DoVisits":     "Visites r&eacute;centes",
    "DoMembers":    "Membres",
    "DoDrafts":     "Ebauches",
    "DoProfile":    "Vos wikis",
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
    "'invitation code' of ":
      "'code d'entr&eacute;e' de ",
    "Your invitation code":
      "Votre code d'entr&eacute;e",
    "in your personal Facebook wiki":
      "dans votre wiki Facebook personnel",
    "in your personal Twitter wiki":
      "dans votre wiki Twitter personnel",
    "the personal page of ":
      "la page personnelle de ",
    "bookmark this page":
      "ajoutez cette page &agrave; vos favoris",
    "your personal Facebook wiki":
      "dans votre wiki Facebook personnel",
    "your personal Twitter wiki":
      "dans votre wiki Twitter personnel",
    "Your entry page": "Votre page d'entr&eacute;e",
    "your changes":  "vos modifications",
    "Your private wiki:": "Votre wiki priv&eacute; :",
    "Screen name:": "Pseudo",
    "Identity on": "Votre identifiant sur",
    "err:locked":  "HelpInaccessible",
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

Sw.padding = 'padding: 0px 1em 0px 1em;'
Sw.font
= 'font-family: "Droid Sans", Verdana, Arial, sans-serif;'
Sw.monofont
= 'font-family: "Droid Sans Mono", Monaco, Consolas, "Lucida Console", monospace;'

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
  'text-shadow: #DDD 0.03em 0.03em 0.05em;',
  //'position: relative;',
  //'cursor: default;',
'}',
'#tooltip {',
  'display:none;',
  'background:white;',
  'padding: 0px 0.5em 0px 0.5em;',
  'color:#444;',
  'border: 2px solid lightgray;',
  'z-index:+2;', // overlap content & header
'}',
// The header of page is the "top menu"
// ToDo: rename #topmenu
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
'#header {',
  'position: fixed;',
  'top: 0;',
  'width: 100%;',
  'border-bottom: 1px solid #BBB;',
  'background-color: #EEE;',
  'color: #CCC;',
  'line-height: 1.35em;',
  'text-wrap: normal;',
  'word-wrap: break-word;',
  '-moz-user-select:none;',
  '-webkit-user-select:none;',
  'cursor:default;',
  'z-index:+1;', // Overlap content
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
  'border-bottom: 1px dotted white;',
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
  '-moz-border-radius: 0.3em;',
  '-webkit-border-radius: 0.3em;',
  '-khtml-border-radius: 0.3em;',
  'border-radius: 0.3em;',
  'color: #942;',
  'background-color: #FFBABA;',
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
  'border: 2px solid lightgray;',
  'border-top-style: none;',
  'border-bottom-style: none;',
  'margin: auto;',
  'text-align:left;',
  'vertical-align: top;',
  Sw.padding,
  'min-height: 240px;',
  'text-wrap: normal;',
  'word-wrap: break-word;',
  'background-color: #fdfdfa;',
  'white-space: pre-wrap;',
'}',
'.content a {',
  '/* matrix color: lightgreen;*/',
  '/*text-decoration: underline;*/',
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
'#traces{',
  'font-size: 9px;',
  'background-color: #000;',
  'color: #eee;',
'}',
'#footer {',
  //'position: fixed;',
  'bottom: 0;',
  'width: 100%;',
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
'#footer_content a {',
  'color: #777;',
'}',
'#powered {',
  'text-align: right;',
  'font-size: 60%;',
  Sw.monofont,
'}',
'#footer_content a:hover {',
  '-moz-border-radius: 0.3em;',
  '-webkit-border-radius: 0.3em;',
  '-khtml-border-radius: 0.3em;',
  'border-radius: 0.3em;',
  'color: #942;',
  'background-color: #FFBABA;',
  'text-decoration: none;',
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
'a:link {',
  'color:#33A;',
  'text-decoration:none;',
'}',

'a:visited {',
  'color:#33A;',
  'text-decoration:none;',
'}',
'a:link.hot {',
  'color: #942;',
'}',
'a:link.hothot {',
  'color: red;',
'}',
'a:visited.hot {',
  'color: #942;',
'}',
'a:visited.hothot {',
  'color: #942;',
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
  'color: #222;',
'}',
'em {',
  'font-style: normal;',
  //'font-weight: bold;',
  'color: #942;',
'}',
'strong {',
  'font-weight: normal;',
  //'color: #000;',
  'text-shadow: #666 0px 0px 0.05em;',
'}',
'cite {',
  'color: #222;',
  'font-style: italic;',
  //'font-weight: bold;',
  Sw.monofont,
'}',
'dfn {',
  'color: #BBB;',
'}',
'dfn:hover {',
  'color: #555;',
'}',
'var {',
  'font-size: 0px;',
  'color: #FFF;',
'}',
'code {',
  'font-family: monospace;',
  'font-size: 60%;',	// 60% of 80 is 48, ie less than 50
  'color: darkgreen;',
'}',
'span.twitter {',
  'background-color: #9AE4E8;',
'}',
'span.diff {',
  'background-color: yellow;',
'}',
'div.yaml {',
  'color: #CCC;',
'}',
'div.yaml:hover {',
  'color: green;',
'}',
'time {',
  'color: #BBB;',
  'font-style: italic;',
  'text-transform: lowercase;',
'}',
'time > i {',
  'color: #FFF;',
'}',
'time:hover {',
  'color: #555;',
'}',
'h1 h2 h3 h4 h5 {',
  'font-family: Verdana, Arial, monospace;',
  'margin: 1.35em;',
'}',
'h1 h2 h3 {',
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
''
].join( "\n")

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

// I add some "pseudo" files
Sw.cacheFile( "with.google", "text/html",
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

Sw.cacheFile( "avec.google", "text/html",
  StaticFileCache["/with.google"].data
)

Sw.cacheFile( "simpliwiki.html", "text/html",
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

Sw.cacheFile( "simpliwiki.css", "text/css", Sw.style)

Sw.cacheFile( "sw_api.js", "text/javascript",
  Session.apiScript.toString().replace( /[^\\:]\/\/.*(?=[\n\r])/g, '')
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
    if( pathname == "/index.html" ){
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
    if( code == 200 ){
      // Patch index.html
      if( pathname == "/index.html" ){
        // Include Twitter && Facebook code
        data = data.replace(
	  '<div id="fb-root"></div>',
	  '<div id="fb-root"></div>'
          + Session.htmlScript( Session.signinScript)
          + Session.htmlScript( "window.onFooterDisplay( true)")
        )
        // Include code to log in back in previous wikis
        data = data.replace(
	  '<div id="sw_comeback"></div>',
	  '<div id="sw_comeback"></div>'
	  + Session.htmlScript( Session.comebackScript)
        )
      }
      // Some basic minification, harmless, remove comments
      if( ".js".ends( pathname) ){
        data = data.replace( /[^\\:]\/\/.*(?=[\n\r])/g, '')
      }
    }
    send( code, data)
  })
}

var Server = Http.createServer( Sw.handler)

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
Sw.sigint = false
process.on( "SIGINT", function (){
  if( Sw.sigint ){
    // Panic
    process.exit( 2)
  }
  Sw.sigint = true
  setTimeout( function(){
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
var start = function(){
  NDe&&bug( "SimpliWiki starting at http://127.0.0.1:", SW.port);
  Server.listen( SW.port);
  bug( "SimpliWiki running at http://127.0.0.1:", SW.port);
  // Write PID to file, usefull on restart to kill previous process
  if( !SW.test ){
    Fs.writeFileSync( previous_pid_file, process.pid.toString());
  }
  if( SW.test ){
    User.test()
  }
}
try{ previous_pid = Fs.readFileSync( previous_pid_file) }catch( err ){}
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
