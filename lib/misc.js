// section: misc.js, export
//  Misc

var Sw = require( "./globals" ).Sw;

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

require( "./globals.js" ).inject( extname, exports );
// section: end misc.js
