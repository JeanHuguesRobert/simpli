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

"use strict";

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
    directive = directive.replace( "C:", "" ).replace( /\\/g, "/");
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
    // trace( "Info: new section " + this.signature)
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
var SectionProto = Section.prototype = {};

SectionProto.toString = function(){
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

//Section.sys = require( 'sys')
Section.fs  = require( 'fs')

Section.puts = function( msg ){
  if( Section.silentFlag )return;
  trace( "sectionize.js, " + msg)
}

Section.debug = function( msg ){
  if( !Section.debugFlag )return
  Section.puts( "Debug: " + msg )
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
console.trace( err )
  Section.puts( "Fatal: " + msg )
  if( !err )throw "sectionize error: " + msg
  Section.puts( "Exception: " + err )
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
  Section.info( "markers: " + Sys.inspect( markers))
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

SectionProto.parse = function( markers, text ){
  if( this.wasParsed )return this
  if( this.isLeaf ){
    Section.fatal( "Must not parse leaf in " + this.container.filename)
  }
  text || (text = this.filebody)
  markers = Section.buildMarkers( markers)
  var mem1 = process.memoryUsage()
  Section.debug( "mem1: " + Sys.inspect( mem1))
  this.parseRest( markers, text)
  try{ Section.debug( "dump\n" + this.collectContent( markers, {}, "dump"))
  }catch( err ){ Section.fatal( "collect", err) }
  var mem2 = process.memoryUsage()
  Section.debug( "mem1: " + Sys.inspect( mem1))
  Section.debug( "mem2: " + Sys.inspect( mem2))
  Section.debug( "rebuild")
  var rebuilt_content = this.collectContent( markers, {})
  if( rebuilt_content != text ){
    Section.fatal( "buggy software"
      + ", length " + rebuilt_content.length
      + " versus expected "   + (text && text.length)
    )
  }else{
    Section.info( "successful parsing of " + this.filename )
  }
  var mem3 = process.memoryUsage()
  Section.debug( "mem1: " + Sys.inspect( mem1))
  Section.debug( "mem2: " + Sys.inspect( mem2))
  Section.debug( "mem3: " + Sys.inspect( mem3))
  return this
}

SectionProto.visit = function( visitor, seen ){
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

SectionProto.collect = function( collector, visitor ){
  var stack = []
  var buf = []
  return this.visit( function( klass, section ){
    switch( klass ){
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

SectionProto.build = function( lean ){
  return this.collect(
    function( leaf ){ return leaf.content },
    function( container, content ){ container.content = lean ? "" : content }
  )
}

SectionProto.update = function( collector, updator ){
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

SectionProto.export = function(){
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

SectionProto.lean = function(){
  this.build( true)
  return this.collect(
    function( section ){ return section.content },
    function( section, content ){
      section.write( "lean." + section.filename)
    }
  )
}

SectionProto.write = function( target, content ){
  target  || (target = this.filename)
  content || (content = this.content)
  // Never empty a file
  if( !content )return Section.warning( "avoid emptying " + target)
  Section.writes.push( target)
  Fs.writeFileSync( target, content, "utf8")
  // Update stats
  this.stats.mtime = (new Date()).toISOString()
}

SectionProto.dump = function(){
  buf = []
  function push( msg ){ buf.push( msg) }
  this.visit( function( klass, section ){
    switch( klass ){
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

SectionProto.collectContent = function( markers, seen, dump ){
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

SectionProto.parseRest = function( markers, text ){
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

SectionProto.parseBegin = function( markers, text ){
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

SectionProto.parseEnd = function( markers, text ){
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
  var directives = Section.parseDirective(
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

SectionProto.dependencies = function( list ){
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

SectionProto.isLean = function( seen ){
}

SectionProto.mtime = function(){
// time of the last modification among sections and subsections this section
// depends on.
  var recent = this.dependencies().recent
  return recent ? recent.ownTime() : ""
}

SectionProto.ownTime = function(){
  if( this.isLeaf   )return this.container.ownTime()
  if( this.previous )return this.previous.ownTime()
  return this.stats.mtime
}

SectionProto.source = function(){
  if( this.isLeaf )return this.container.source()
  return this.filename
}

require( "./globals" ).inject( Section, exports );
