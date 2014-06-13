#!node
// main.js
//   hacked wiki engine using nodejs
//   https://github.com/JeanHuguesRobert/simpli
//
// March 22 2010, JeanHuguesRobert, based on earlier work
//
// 27/03/2010, JHR, Initial v001
// 09/05/2010, JHR, Back to work, refactor into classes
// 24/08/2010, JHR, Ditto, on AWS, after 2 months stall
// 03/11/2010, JHR, Ditto, after 10 days holiday stall
// 12/11/2010, JHR, refactoring, cleaning, etc.
// 14/11/2010, JHR, fb@, v 0.04
// 17/11/2010, JHR, sectionize
// 22/11/2010, JHR, class User
// 21/12/2010, JHR, v 0.05
// 05/01/2011, JHR, v 0.06
// 12/01/2011, JHR, v 0.07, embedded
// 19/01/2011, JHR, v 0.08, API
// 21/01/2011, JHR, v 0.09, simplijs & hooks.js
// 29/01/2011, JHR, v 0.10, dropbox & ToDo pages
// 05/02/2011, JHR, v 0.11, cosmetic, shareaholic
// 11/02/2011, JHR, v 0.12, loadfire + linkedid
// 18/02/2011, JHR, v 0.13, merge of ids
// 25/02/2011, JHR, v 0.14, "Connect with SimpliWiki"
// 16/03/2011, JHR, v 0.15, Disposable codes
// 28/04/2011, JHR, v 0.16, sha1 secret keys for "Connect with SimpliWiki"
// 11/12/2011, JHR, Baidus spider bot detection
// 09/02/2014, JHR, v 0.19, small updates, remove broken twitter/fb/linkedIn
// 03/06/2014, JHR, v 0.20, upgrade to latest nodejs & ubuntu, major login change
// 11/06/2014, JHR, v 0.30, split big file into modules, simplified

"use strict";

require( "./globals"    );
require( "./debug.js"   );
require( "./section.js" );
require( "./depends.js" );

// ----------------------------------------------------
// Some meta programming, messing with the source file.
//
// Patches some global constants using command line.
// Patches source file using Section.ize()
// Adds source file's path to require.paths
//
// version   -- display SW.name & SW.version and exit( 0)
// ndebug    -- set SW.debug to false
// debug     -- set SW.debug to true, overrides ndebug
// test      -- set SW.test  to true & increment SW.port
// localhost -- set SW.domain to "localhost"
// merge, export & lean -- invoke Section.ize()

;(function(){
  var trace = global.trace;
  var SW = global.SW;
  var Section = global.Section;
  var debug = global.debug;
  var argv = process.argv;
  var file = argv[1]; // ToDo: should use __filename?
  var ii = file.lastIndexOf( '/' );
  if( ii ){
    // ToDo: JHR migration 2014 require.paths.unshift( file.substr( 0, ii - 1))
    console.log( "JHR 2014 ******************** should have unshift() of " + file.substr( 0, ii -1 ) );
  }
  var hargv = {};
  argv.forEach( function( v ){ hargv[v] = v } );
  argv = hargv;
  if( argv.ndebug ){ SW.debug = false }
  if( argv.debug  ){ SW.debug = true }
  if( SW.debug ){ trace( "DEBUG MODE") }
  if( argv.localhost ){ SW.domain = 'localhost' }
  if( argv.test ){
    trace( "TEST MODE" );
    SW.port++;
    SW.test  = true;
    SW.debug = true;
  }
  De = debug( SW.debug );
  try{
    if( !argv.merge && Section.ize( file).isLean() ){
       Section.fatal( "lean " + file + " needs a merge" );
    }
    if( argv.export ){ Section.ize( file, "export", {debug: false} ) }
    if( argv.lean   ){ Section.ize( file, "lean",   {debug: false} ) }
    if( argv.merge  ){ Section.ize( file, "merge",  {debug: false} ) } 
  }catch( err ){ Section.fatal( file, err) }
  // Exit 0 if displaying version instead of running
  // This is also usefull to check syntax before trying to run
  if( argv.version ){
    trace( "Version: " + SW.name + " " + SW.version );
    process.exit( 0 );
  }
})();


require( "./string.js"       );
require( "./contexted.js"    );
require( "./fluid.js"        );
require( "./debuggable.js"   );
require( "./misc.js"         );
require( "./pagestore.js"    );
require( "./wiki.js"         );
require( "./wikilogin.js"    );
require( "./wikifetch.js"    );
require( "./wikictx.js"      );
require( "./scrollcue.js"    );
require( "./page.js"         );
require( "./pagectx.js"      );
require( "./user.js"         );
require( "./session.js"      );
require( "./sessionlogin.js" );
require( "./sessionpage.js"  );
require( "./sessioncmd.js"   );
require( "./dropbox.js"      );
require( "./wikify.js"       );
require( "./date.js"         );
require( "./html.js"         );
require( "./loadfire.js"     );
// Let's do some tests of client side code... on the server side
global.window   = global;
global.document = {};
loadfire().test();
global.window   = undefined;
global.document = undefined;
Session.loadScript = loadfire;
require( "./api.js"          );
require( "./i18n.js"         );
require( "./mail.js"         );
require( "./mockreq.js"      );
require( "./css.js"          );
require( "./start.js"        );
require( "./yanug.png.js"    );
require( "./interwiki.js"    );
