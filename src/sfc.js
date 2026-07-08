// SFCP - Simple Fractal Confederation Protocol
// Version 0.1
// Enables sovereign nodes to form voluntary, treaty-based relationships

var SFCP = (function(){

  var PREFIX = "/_sfc/v0";
  var VERSION = "0.1";

  // Helper: Send JSON response
  function sendJson( res, code, data ){
    var json = JSON.stringify( data, null, 2 );
    var headers = [
      ["Server", "SimpliWiki"],
      ["Content-Type", "application/json"],
      ["Content-Length", Buffer.byteLength( json )],
      ["Cache-Control", "no-store"],
      ["Access-Control-Allow-Origin", "*"]
    ];
    res.writeHead( code, headers );
    res.end( json );
  }

  // Helper: Send error response
  function sendError( res, code, error_code, message ){
    sendJson( res, code, {
      error: error_code,
      message: message,
      timestamp: new Date().toISOString()
    });
  }

  // Helper: Parse pathname for SFCP endpoint
  function parsePath( pathname ){
    if( !pathname || pathname.indexOf( PREFIX ) !== 0 ){
      return null;
    }
    var parts = pathname.substr( PREFIX.length ).split( "/" ).filter( function( p ){
      return p && p.length > 0;
    });
    return {
      endpoint: parts[0] || null,
      remaining: parts.slice( 1 )
    };
  }

  // GET /_sfc/v0/node - Node identity
  function handleNodeInfo( wiki, req, res ){
    var pageStore = wiki.pageStore;
    var authoritativePages = {};

    // Get list of authoritative pages with timestamps
    // For now, return a simplified version
    pageStore.withDir( false, function( err, files ){
      if( !err && files ){
        files.forEach( function( file ){
          var stat = Fs.statSync( pageStore.dir + "/" + file );
          if( stat.isFile() && !file.startsWith( "." ) && !file.includes( ".dir" ) ){
            authoritativePages[file] = stat.mtime.toISOString();
          }
        });
      }

      sendJson( res, 200, {
        version: VERSION,
        nodeId: SW.domain || "localhost",
        nodeType: "wiki",
        isSovereign: wiki.isRoot(),
        authoritativePages: authoritativePages,
        capabilities: {
          canServePages: true,
          canAcceptTreaties: false,  // Phase 2
          canInitiateTreaties: false // Phase 2
        }
      });
    });
  }

  // GET /_sfc/v0/health - Node health
  function handleHealth( wiki, req, res ){
    sendJson( res, 200, {
      status: "healthy",
      timestamp: new Date().toISOString(),
      cacheTTL: 300  // 5 minutes
    });
  }

  // GET /_sfc/v0/treaties - List treaties (Phase 2)
  function handleListTreaties( wiki, req, res ){
    sendJson( res, 501, {
      error: "not_implemented",
      message: "Treaty operations coming in Phase 2"
    });
  }

  // POST /_sfc/v0/treaties/propose - Propose treaty (Phase 2)
  function handleProposeTreaty( wiki, req, res ){
    sendJson( res, 501, {
      error: "not_implemented",
      message: "Treaty operations coming in Phase 2"
    });
  }

  // Main SFCP request handler
  function handleRequest( wiki, req, res ){
    var parsed = Url.parse( req.url );
    var pathname = parsed.pathname;
    var path = parsePath( pathname );

    if( !path ){
      return false; // Not an SFCP request
    }

    wiki.init_de&&bug( "SFCP request:", pathname, "endpoint:", path.endpoint );

    // Route to appropriate handler
    switch( path.endpoint ){
      case "node":
        if( req.method === "GET" ){
          return handleNodeInfo( wiki, req, res );
        }
        return sendError( res, 405, "method_not_allowed", "GET required" );

      case "health":
        if( req.method === "GET" ){
          return handleHealth( wiki, req, res );
        }
        return sendError( res, 405, "method_not_allowed", "GET required" );

      case "treaties":
        if( req.method === "GET" && path.remaining[0] !== "propose" ){
          return handleListTreaties( wiki, req, res );
        }
        if( req.method === "POST" && path.remaining[0] === "propose" ){
          return handleProposeTreaty( wiki, req, res );
        }
        return sendError( res, 405, "method_not_allowed", "Invalid method" );

      default:
        return sendError( res, 404, "unknown_endpoint", "Unknown SFCP endpoint" );
    }
  }

  return {
    handleRequest: handleRequest,
    PREFIX: PREFIX,
    VERSION: VERSION
  };

})();

// Export for use in main.js
if( typeof module !== "undefined" && module.exports ){
  module.exports = SFCP;
}
// When using $include(), ensure SFCP is in global scope
$include.result = SFCP;
