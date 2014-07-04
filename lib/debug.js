// section: debug.js
//   Because debugging is the most important activity, alas
// 
// Misc, debug stuff, primitive, that's my De&&bug darling, ultra fast because
// the trace message is not evaluated when not used.
//
// There are (at least) 3 types of logging activities.
// Traces -- for the ones who code
// Alarms -- for the ones who monitor
// Logs   -- for the ones who shoot problems
//
// These different activities, performed by people with different skills, require
// different tools.

"use strict";

// I use a weirdly named "De" global variable.
// Then I can do De&&bug( ...) or De&&mand( ...)

if( typeof global.De === "undefined" ){
  global.De = false;
}
var De = global.De;

// NDe is always false. It makes it easy to turn off a trace, just add N before De.
// This is for trace message that you add while debugging a piece of code and then
// don't leave there once the code works reasonably well.
// Note: it is often a good idea to leave trace messages, complex code is fragile,
// what was hard to debug may be hard to debug again if something changes.
var NDe = false;  // Constant, MUST be false
global.NDe = NDe;

// Hack to get sync traces in all cases, including weird IDEs on Windows
if( false && De ){
  var fs = require( 'fs' );
  var fake_write = process.stdout.write;
  process.stdout.write = function() {
    for( var ii = 0 ; ii < arguments.length ; ii++ ){
      fs.appendFileSync( "trace.out", arguments[ ii ] );
    }
    return fake_write.apply( this, arguments );
  };
  process.stderr.write = function () {
    for( var ii = 0 ; ii < arguments.length ; ii++ ){
      fs.appendFileSync( "trace.out", arguments[ ii ] );
    }
    return fake_write.apply( this, arguments );
  };
}


function bugScript(){
// Client side version
  if( !window.console )return;
  if( !console.log    )return;
  var list = [];
  for( var item in arguments ){
    item = arguments[ item ];
    item = item ? item.toString() : "null";
    list.push( item );
  }
  if( list.length > 1 ){
    console.log( list.join( " " ) );
  }else{
    console.log( arguments[0] );
  }
}

// Tracks last referenced object is xxx_de&&bug style expressions
// See section debuggable.js
global.TraceDomainTarget = null;

function bug(){
// Usage: De&&bug(...) and NDe&&bug(...)
// Server side version
  var list = [];
  var with_sid = false;
  for( var item in arguments ){
    if( item === 0 && arguments[ item ] === ( global.Sw && global.Sw.currentSession ) ){
      with_sid = true;
    }
    item = arguments[ item ];
    item = item ? item.toString() : "null";
    list.push( item );
  }
  // Get name of caller function
  var caller;
  try{
    $_buggy_; // Raises an exception, intentional
  }catch( err ){
    caller = err.stack.split( "\n" )[2]
    .replace( / \(.*/, "" )
    .replace( "   at ", "" )
    .replace( "Function.", "" )
    .replace( /\/.*/, "" )
    .replace( "<anonymous>", "?" )
    .replace( / /g, "" );
    // I don't think this is useful but that was an attempt to get a
    // meaningful name in some cases where first attempt fails for reasons
    // I need to investigate. ToDo: investigate...
    if( caller == "?" ){
      // ToDo: DRY
      caller = err.stack.split( "\n" )[3]
      .replace( / \(.*/, "" )
      .replace( "   at ", "" )
      .replace( "Function.", "" )
      .replace( /\/.*/, "" )
      .replace( "<anonymous>", "?" )
      .replace( / /g, "" );
    }
  }
  // Handle this.xxx_de&&bug() type of traces.
  // xxx_de getters do set global "TraceDomainTarget" as a side effect. That's
  // how I can know what object the trace is about.
  // This is not perfect, but it works ok because there are no threads in NodeJs.
  if( global.TraceDomainTarget ){
    // If TraceDomainTarget was set by some xxx_de getter, show "O:xxx"
    if( global.TraceDomainTarget !== global
    &&  global.TraceDomainTarget !== global.Sw.currentSession
    ){
      // I add it "upfront"
      try{
        list.unshift( "O:" + global.TraceDomainTarget );
      }catch( err ){
        // Deals with case where .toString() bombs on target object         
        list.unshift( "O:???");
      }
    }
    // Add "F:xxx" if caller function's name was found
    if( caller ){
      list.unshift( "F:" + caller );
    }
    // Add "D:" to describe what "domain" the trace is about
    var domain = global.TraceDomainTarget.pullDomain();
    if( domain ){
      list.unshift( "D:", domain );
    }
    // "Consume" the target
    global.TraceDomainTarget = null;

  // Handle De&&bug() type of traces, where no target object is described
  }else{
    if( caller ){
      list.unshift( "F:" + caller );
    }
  }

  // Pretty print somehow
  var msg = list.join( ", " );
  if( global.Sw && global.Sw.currentSession && !with_sid ){
    var s = global.Sw.currentSession;
    // Display Sb:id for bots, Sg:id for guests, S!:id for curators 
    if( s.loginName ){
      msg = "S" + (s.isBot ? "b" : s.isGuest() ? "g" : s.canCurator ? "!" : "")
      + ":" + s.id + ", " + msg;
    }else{
      msg = "S:" + s.id + ", " + msg;
    }
  }
  msg = msg
  .replace( /: , /g, ":")
  .replace( /, , /g, ", ")
  .replace( / , /g,  ", ")
  .replace( /: /g,   ":")
  .replace( /:, /g,  ":");

  // ToDo: log to a file
  console.log( msg );

  // Log into buffer displayed in HTML
  if( global.Sw && global.Sw.currentSession ){
    // ToDo: traces include confidential informations, that's bad
    if( global.Sw.currentSession.isDebug ){
      global.Sw.currentSession.logTrace( msg );
    }
  }
}


function trace(){ 
  console.log.apply( console, arguments ); 
};


function ndebug(){
// Very global method to disable all traces. This can be useful when testing
// the code's "speed".
  De&&bug( "Turn off debugging traces" );
  global.De = De = false;
  return De;
}


function debug( flag ){
// Very global method to restore disabled traces.
// Note: This does not work if program was stared with traces initially
// disabled. It works only if traces were initially enabled and momentary
// disabled using ndebug()
  if( arguments.length ){
    return flag ? debug() : ndebug();
  }
  if( !global.De ){
    global.De = De = true;
    bug( "Turn on debugging traces" );
  }
  return true;
}


function is_debug(){
  return De;
}


// Some additional tools, Bertrand Meyer's style

function mand( bool, msg ){
// Usage: De&&mand( something true )
// This is like the classical assert() macro
// Usage: de&&mand( some_assert_clause )
  if( !bool ){
    bug( "BUG: Assert failure " );
    if( msg ){
      bug( "Assert msg:", msg );
    }
    // Turn maximal debugging until process dies, nothing to lose
    if( global.assert_de ){
      global.De = De = true;
      var item;
      for( item in global.TraceDomains ){
        global.traceDomain( item );
      }
      throw new Error( "Assert failure" );
    }else{
      try{ 
         $_buggy_assert_; // Intentionally raised exception 
      }catch( err ){
        err.stack.split( "\n" ).map( function( line ){
          bug( "Stack:", line );
        });
        throw err;
      }
    }
  }
}


function mand_eq( a, b, msg ){
  if( a == b )return;
  msg = ( msg ? "(" + msg + ")" : "" ) + " != '" + a + "' and '" + b + "'";
  mand( false, msg );
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
  if( !De )return cb;
  var entered;
  return function once_cb(){ 
    if( entered ){
      De&&bug( "Reentering callback:", cb.name );
      // cb.apply( this, arguments)
      throw new Error( "reentered callback: " + cb.name ); 
    }
    entered = true;
    return cb.apply( this, arguments ); 
  };
}

require( "./globals" ).inject( [
  debug,
  { global_debug: debug },
  ndebug,
  is_debug,
  bug,
  trace,
  mand,
  { assert: mand },
  mand_eq,
  { assert_eq: mand_eq },
  once
], exports );
