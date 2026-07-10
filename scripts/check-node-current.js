"use strict";

var required = "26.5.0";
var actual = process.versions.node;

function parse( version ){
  return version.split( "." ).map( function( part ){
    return parseInt( part, 10 );
  });
}

function isAtLeast( actualVersion, requiredVersion ){
  var actualParts = parse( actualVersion );
  var requiredParts = parse( requiredVersion );
  for( var ii = 0 ; ii < requiredParts.length ; ii++ ){
    if( actualParts[ii] > requiredParts[ii] )return true;
    if( actualParts[ii] < requiredParts[ii] )return false;
  }
  return true;
}

if( !isAtLeast( actual, required ) ){
  console.error( "SimpliWiki requires Node >= " + required + ", found " + actual );
  process.exit( 1 );
}

