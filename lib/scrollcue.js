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

var Wiki = require( "./wiki.js" ).Wiki;

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
      + ' border="0" vspace="0" hspace="0"/>'
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


exports.Wiki = Wiki;
// section: end scrollcue.js
