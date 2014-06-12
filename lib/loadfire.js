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
//   .load( "jQuery")
//   $(document).ready( function(){ de&&bug( "$ & all ready!" })
//
//   // jQuery + Google friendly (gets latest stable jQuery, 1.5)
//   loadfire( "jQuery", "google")
//   $().ready( function(){ de&&bug( "Got $ from Google" })
//
//   // Microsoft too
//   loadfire( "jQuery", "microsoft")
//   $( function(){ de&&bug( "Got $ from Microsoft" })
//
//   // Postpone jQuery
//   loadfire( "jQuery")
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
//   script (or adjust their behaviour). This is supposedly enough to
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
  var me = loadfire;
  var bug;

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
      scope.de     = true
      scope.de_def = true
    }
    var bugC = ( scope.console && console.log
      && function bug( m ){ console.log( "de&&bug: " + m ) } )
    || ( scope.de = false );
    if( !client_side ){
      bugC = trace;
    }
    if( scope.de && !scope.bug ){
      scope.bug = bugC;
    }else if( de_def ){
      scope.de = false
    }

    // de&&scribe() local traces
    var scribe = function( msg ){
      bugC( "loadfire: " + msg + " @" + me.age );
    }

    // I will fire every 500ms, so that timeouts can be handled by callbacks
    // Note: callbacks may also display some progress bar
    var start_timeout = function(){
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
    var stop_timeout = function(){
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
            me.fire([script[ii]], does)
          }
          return
        }
        // Update age
        me.age = (new Date()).getTime() - me.timeStarted
        me.scripts[script] = !does ? (me.age || 1) : false
        if( de && script.indexOf( " seconds") < 0 && me.age > 1 ){
          de&&scribe( '"' + script + '"' + (does ? " starting" : " firing"))
        }
        if( window.jQuery && !me.did( "jQuery") ){
          me.fire( "jQuery")
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
      for( var key in me.scripts ){
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
        // de&&scribe( "ready!")
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
        // de&&scribe( "born again")
        me.rejuvenate()
      }
      return me
    }

    // Define loadfire.reset() that clear an achievement / goal
    me.reset = function loadfire_reset( goal ){
      delete me.scripts[goal]
      delete me.scriptFailures[goal]
    }

    // Define loadfire.signal() that declares pending achievements / goals
    me.signal = function loadfire_signal( script ){
      return me.fire( script, true)
    }

    var check_done = function( script ){
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
        de&&bugC( "Assert failure, " + msg )
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
    = me.fire.load       = me.signal.load = me.reset.load
    = me.event.load      = me.ready.load
    = me.any.load        = me.all.load
    = me.failed.load     = me.fail.load
    = me.rejuvenate.load = me.dump.load
    = me
    // To please Steve Jobs AND Bill Gates
    me.load.load = me.bing = me.me = me
    // To please Richard Stallman & Richard Hawking
    me.free = me.all.me = me.bing.bang = me
    // Nought, let's get back to some "real" work

    // An alias
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

  // jQuery friendly, batteries included
  if( src == "jQuery" ){
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


require( "./globals.js" ).inject( loadfire, exports );
// section: end loadfire.js
