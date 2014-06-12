// section: fluid.js

var Contexted = require( "./contexted" ).Contexted;

// Using Fluid.push(), pop(), level() && reset() one can also manage
// a stack of dynamically scoped variables
// See http://en.wikipedia.org/wiki/Scope_(programming)
// See also "Fluid" in Common Lisp

var Fluid = function Fluid( scope, locals, f ){
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
    if( typeof scope[key] != "undefined" ){
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
  Contexted.scope = scope;
  return scope;
};


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
  Contexted.scope = scope;
  return scope;
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
  Contexted.scope = scope;
  return scope;
}

require( "./globals" ).inject( Fluid, exports );
// section: end fluid.js
