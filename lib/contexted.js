// section: contexted.js, export
// My Contexted Darling
// It changes "this" (like jQuery's bind() for example) and
// also the global Contexted.scope

var Contexted = function( scope, f ){
  return function(){
    Contexted.scope = scope;
    return f.apply( scope, arguments );
  };
};

require( "./globals" ).inject( { Contexted: Contexted }, exports );