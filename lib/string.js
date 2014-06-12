// ------------------
// section: string.js, export
// Patch String class. Some people consider it harmful.
// Worse: in some cases it can be 10+ times slower... because of the temporary
// string object needing to be created... So: it's nice, but slow. Not cool.
// Javascript is the new C.

String.prototype.starts = function( other ){
// True if this string is at the beginning of the other one
  return !!other && other.substr( 0, this.length) == this
}

function str_starts( that, other ){
// Like that.starts( other) but sometimes faster
  return !!other && other.substr( 0, that.length) == that
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

function str_ends( that, other ){
// Like that.ends( other) but sometimes faster
  // True if this string is at the end of the other one
  if( !other )return false
  var endlen   = this.length
  var otherlen = other.length
  if( !endlen || endlen > otherlen ){ return false }
  // ToDo: should avoid concatenation
  return other.substr( 0, otherlen - endlen) + that == other
}

String.prototype.includes = function( other ){
// True if this string is somewhere inside the other one
  return !!other && this.indexOf( other) != -1
}

function str_includes( that, other ){
// Like that.includes( other) but sometimes faster
  return !!other && that.indexOf( other) != -1
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

require( "./globals" ).inject([
  str_starts, str_ends, str_includes
], exports );
// section: end string.js
