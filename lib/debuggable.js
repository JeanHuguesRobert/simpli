// ----------------------
// section: debuggable.js
//  Fine grained debugging trace, per domain & per object/class

var TraceDomains = {}

var Debuggable = {}

Debuggable.setDeId = function( id ){
  this.deId = id
}

Debuggable.debug_mode = function( de ){
// Enable/disable tracing
  if( this === global ){
    global.De = De = global_debug_mode.call( this, de );
  }
  if( de ){
    this.__defineGetter__( "de", function(){
      if( !global.De )return false;
      global.TraceDomainTarget = this;
      return true;
    });
  }else{
    this.__defineGetter__( "de", Sw.noop );
  }
  return de;
}


Debuggable.toggleDebug = function(){
  this.de ? this.debug_mode( false ) : this.debug_mode( true );
};

Debuggable.traceDomainIsOn = function( name ){
  var named = name + "_de"
  return this[named] ? true : false
}

Debuggable.traceDomain = function( name ){
  var named = name + "_de"
  // Sys.puts( "traceDomain for " + name)
  De = debug_mode( true );
  //this[named]&&bug( "TurningOn, domain: ", name)
  if( this === global ){
    TraceDomains[name] = name
    global.__defineGetter__( named, function(){
      return De && (this.domain = TraceDomains[name])
    })
  }else{
    this.__defineGetter__( named, function(){
      // Sys.puts( "GETTER " + named + " ON " + this)
      global.TraceDomainTarget = this
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
      global.TraceDomainTarget = this
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
  for( var item in Debuggable ){
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
  target.debug_mode( true );
  // Set up a class label that is better looking than basic "typeof"
  if( class_label ){
    target.classLabel = class_label
  }
  De&&mand( target.de)
}

De&&mand( this !== global ) // Watch out!

MakeDebuggable( global)

var DeclareTraceDomain = function( name, is_on ){
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
DeclareTraceDomain( "cookie",  true );
DeclareTraceDomain( "store",   false );
DeclareTraceDomain( "http",    true)
DeclareTraceDomain( "static",  false );	// Static files
DeclareTraceDomain( "yaml",    false)
DeclareTraceDomain( "context", false)
DeclareTraceDomain( "config",  true)
DeclareTraceDomain( "f3Code",  false)
DeclareTraceDomain( "bot",     false)
DeclareTraceDomain( "misc",    false)
DeclareTraceDomain( "option",  "deep")
DeclareTraceDomain( "sane",    "deep")  // Sanitizations
DeclareTraceDomain( "bug",     "deep")
DeclareTraceDomain( "rest",    true)
DeclareTraceDomain( "monit",   "deep")
DeclareTraceDomain( "lang",    "deep")
DeclareTraceDomain( "get",     false)
DeclareTraceDomain( "post",    false)
DeclareTraceDomain( "send",    false)
DeclareTraceDomain( "mail",    "deep")
DeclareTraceDomain( "queue",   "deep")
DeclareTraceDomain( "acl",     false)
DeclareTraceDomain( "wiki",    true );
DeclareTraceDomain( "init",    true );
DeclareTraceDomain( "session", true );
DeclareTraceDomain( "login",   false)
DeclareTraceDomain( "user",    true );
DeclareTraceDomain( "inline",  false)
DeclareTraceDomain( "dropbox", "deep")
DeclareTraceDomain( "css",     false)
DeclareTraceDomain( "draft",   false)
// section: end tracedomains.js

MakeDebuggable( global) // With domains this time

// Tests
Debuggable.test = function(){
  var De = global.De, bug = global.bug, mand = global.mand;
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

require( "./globals" ).inject( {
  TraceDomains:   TraceDomains,
  Debuggable:     Debuggable,
  MakeDebuggable: MakeDebuggable
}, exports );
// section: end debuggable.js