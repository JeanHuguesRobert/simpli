// include.js
//  C style #include
//
// Jun 11 2014 vy @jhr, extracted from simpliwiki's big file


function $include( file, prepand, postpand ){
// Like C's #include to some extend. See also $include_json().
// The big difference with require() is that whatever is declared using
// "var" is visible, whereas with require() local variables are defined in
// some different scope.
// The big difference with #include is that #include can be used anywhere
// whereas $include() can be used only as a statement.
// Please use $include_json() to include an expression.
// file is searched like require() does (if require.resolve() exists).
// File's content is not cached, I trust the OS for doing some caching better
// than myself. As a result, it works great with self modifying code...
// Another big difference is the fact that $include() will fail silently if
// the file cannot be read.

  var data;
  var fs      = require( "fs" );
  var ffile   = "";
  var rethrow = false;
  
  // Try using require.resolve() when available
  try{
    ffile = require.resolve ? require.resolve( file) : file;
  }catch( err ){}
  
  // Silent ignore if file not found
  if( !ffile ){
    console.log( "$include: no " + file );
    return;
  }
  
  try{
    data = fs.readFileSync( ffile ).toString();
    prepand  && ( data = prepand + data );
    postpand && ( data = data    + postpand );
    $include.result = undefined;
    // trace( "$include() eval of:" + data)
    try{
      eval( data ); // I wish I could get better error reporting
    }catch( err ){
      rethrow = true;
      throw err;
    }
    return $include.result;
  }catch( err ){
    console.log( "ERROR: $include: " + file + ". err: " + err );
    if( rethrow )throw err;
  }
}

function $include_json( file ){
// Like C's #include when #include is used on the right side of an assignment
  return $include( file, ";($include.result = (", "));" );
}

exports.$include = $include;
exports.$include_json = $include_json;
