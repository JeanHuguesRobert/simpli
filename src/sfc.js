// SFCP - Simple Fractal Confederation Protocol
// Version 0.1 - Phase 2: Treaty Formation
// Enables sovereign nodes to form voluntary, treaty-based relationships

(function(){

  var PREFIX = "/_sfc/v0";
  var VERSION = "0.1";
  var DB_PATH = ".sfc.db";
  var db = null;

  // Initialize SQLite database
  function initDb(){
    if( db ) return db;

    try {
      var Database = require( 'better-sqlite3' );
      db = new Database( DB_PATH );
      db.pragma( 'journal_mode = WAL' );

      // Create tables
      db.exec(`
        CREATE TABLE IF NOT EXISTS sfc_treaties (
          treaty_id TEXT PRIMARY KEY,
          with_node TEXT NOT NULL,
          treaty_type TEXT NOT NULL,
          status TEXT NOT NULL,
          created_at TEXT NOT NULL,
          terms_json TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS sfc_proposals (
          proposal_id TEXT PRIMARY KEY,
          page_name TEXT NOT NULL,
          proposed_by TEXT NOT NULL,
          proposed_at TEXT NOT NULL,
          change_json TEXT NOT NULL,
          status TEXT NOT NULL
        );
      `);

      return db;
    } catch( err ) {
      console.error( "SFCP: Failed to initialize SQLite:", err.message );
      return null;
    }
  }

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

  // Generate random treaty ID
  function generateTreatyId(){
    return "treaty-" + Math.random().toString( 36 ).substr( 2, 9 );
  }

  // Generate random proposal ID
  function generateProposalId(){
    return "prop-" + Math.random().toString( 36 ).substr( 2, 9 );
  }

  // GET /_sfc/v0/node - Node identity
  function handleNodeInfo( wiki, req, res ){
    var pageStore = wiki.pageStore;
    var authoritativePages = {};

    // Get list of authoritative pages with timestamps
    pageStore.withDir( false, function( err, files ){
      if( !err && files ){
        files.forEach( function( file ){
          try {
            var stat = Fs.statSync( pageStore.dir + "/" + file );
            if( stat.isFile() && !file.startsWith( "." ) && !file.includes( ".dir" ) ){
              authoritativePages[file] = stat.mtime.toISOString();
            }
          } catch( e ) {}
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
          canAcceptTreaties: true,
          canInitiateTreaties: true
        }
      });
    });
  }

  // GET /_sfc/v0/health - Node health
  function handleHealth( wiki, req, res ){
    sendJson( res, 200, {
      status: "healthy",
      timestamp: new Date().toISOString(),
      cacheTTL: 300
    });
  }

  // GET /_sfc/v0/treaties - List treaties
  function handleListTreaties( wiki, req, res ){
    var database = initDb();
    if( !database ){
      return sendError( res, 500, "database_error", "Failed to initialize database" );
    }

    try {
      var rows = database.prepare(
        "SELECT treaty_id, with_node, treaty_type, status, created_at, terms_json FROM sfc_treaties"
      ).all();

      var treaties = rows.map( function( row ){
        return {
          treatyId: row.treaty_id,
          with: row.with_node,
          type: row.treaty_type,
          status: row.status,
          createdAt: row.created_at,
          terms: JSON.parse( row.terms_json )
        };
      });

      sendJson( res, 200, { treaties: treaties });
    } catch( err ) {
      sendError( res, 500, "database_error", err.message );
    }
  }

  // POST /_sfc/v0/treaties/propose - Propose treaty
  function handleProposeTreaty( wiki, req, res ){
    var database = initDb();
    if( !database ){
      return sendError( res, 500, "database_error", "Failed to initialize database" );
    }

    // Read request body
    var body = "";
    req.on( "data", function( chunk ){ body += chunk; });
    req.on( "end", function(){
      try {
        var proposal = JSON.parse( body );

        // Validate required fields
        if( !proposal.from || !proposal.type ){
          return sendError( res, 400, "invalid_request", "Missing required fields: from, type" );
        }

        // Validate treaty type
        var validTypes = ["peer", "delegation", "read-only", "publish"];
        if( validTypes.indexOf( proposal.type ) < 0 ){
          return sendError( res, 400, "invalid_treaty_type", "Valid types: peer, delegation, read-only, publish" );
        }

        var treatyId = generateTreatyId();
        var now = new Date().toISOString();
        var terms = proposal.terms || { syncDirection: "pull", pages: [] };

        // Store treaty proposal
        database.prepare(
          "INSERT INTO sfc_treaties (treaty_id, with_node, treaty_type, status, created_at, terms_json) VALUES (?, ?, ?, ?, ?, ?)"
        ).run( treatyId, proposal.from, proposal.type, "proposed", now, JSON.stringify( terms ) );

        sendJson( res, 202, {
          status: "proposed",
          treatyId: treatyId,
          message: "Treaty proposed. Awaiting acceptance."
        });

      } catch( err ) {
        sendError( res, 400, "invalid_json", err.message );
      }
    });
  }

  // POST /_sfc/v0/treaties/{id}/accept - Accept treaty
  function handleAcceptTreaty( wiki, req, res, treatyId ){
    var database = initDb();
    if( !database ){
      return sendError( res, 500, "database_error", "Failed to initialize database" );
    }

    try {
      var row = database.prepare(
        "SELECT status FROM sfc_treaties WHERE treaty_id = ?"
      ).get( treatyId );

      if( !row ){
        return sendError( res, 404, "treaty_not_found", "Treaty not found" );
      }

      if( row.status !== "proposed" ){
        return sendError( res, 400, "invalid_treaty_status", "Treaty is not in 'proposed' status" );
      }

      database.prepare(
        "UPDATE sfc_treaties SET status = ? WHERE treaty_id = ?"
      ).run( "active", treatyId );

      sendJson( res, 200, {
        status: "accepted",
        treatyId: treatyId,
        acceptedAt: new Date().toISOString()
      });

    } catch( err ) {
      sendError( res, 500, "database_error", err.message );
    }
  }

  // POST /_sfc/v0/treaties/{id}/revoke - Revoke treaty
  function handleRevokeTreaty( wiki, req, res, treatyId ){
    var database = initDb();
    if( !database ){
      return sendError( res, 500, "database_error", "Failed to initialize database" );
    }

    // Read request body
    var body = "";
    req.on( "data", function( chunk ){ body += chunk; });
    req.on( "end", function(){
      try {
        var data = JSON.parse( body );
        var reason = data.reason || "";

        var row = database.prepare(
          "SELECT status FROM sfc_treaties WHERE treaty_id = ?"
        ).get( treatyId );

        if( !row ){
          return sendError( res, 404, "treaty_not_found", "Treaty not found" );
        }

        if( row.status === "revoked" ){
          return sendError( res, 400, "already_revoked", "Treaty is already revoked" );
        }

        database.prepare(
          "UPDATE sfc_treaties SET status = ? WHERE treaty_id = ?"
        ).run( "revoked", treatyId );

        sendJson( res, 200, {
          status: "revoked",
          treatyId: treatyId,
          revokedAt: new Date().toISOString(),
          reason: reason
        });

      } catch( err ) {
        sendError( res, 400, "invalid_json", err.message );
      }
    });
  }

  // GET /_sfc/v0/pages/{pageName}/proposals - List change proposals
  function handleListProposals( wiki, req, res, pageName ){
    var database = initDb();
    if( !database ){
      return sendError( res, 500, "database_error", "Failed to initialize database" );
    }

    try {
      var rows = database.prepare(
        "SELECT proposal_id, page_name, proposed_by, proposed_at, change_json, status FROM sfc_proposals WHERE page_name = ?"
      ).all( pageName );

      var proposals = rows.map( function( row ){
        return {
          proposalId: row.proposal_id,
          pageName: row.page_name,
          proposedBy: row.proposed_by,
          proposedAt: row.proposed_at,
          change: JSON.parse( row.change_json ),
          status: row.status
        };
      });

      sendJson( res, 200, { proposals: proposals });
    } catch( err ) {
      sendError( res, 500, "database_error", err.message );
    }
  }

  // POST /_sfc/v0/pages/{nodeName}/{pageName}/propose - Propose page change (Phase 3)
  function handleProposeChange( wiki, req, res, nodeName, pageName ){
    sendJson( res, 501, {
      error: "not_implemented",
      message: "Page change proposals coming in Phase 3"
    });
  }

  // GET /_sfc/v0/pages/{nodeName}/{pageName} - Fetch remote page (Phase 3)
  function handleFetchPage( wiki, req, res, nodeName, pageName ){
    sendJson( res, 501, {
      error: "not_implemented",
      message: "Page fetch coming in Phase 3"
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
        if( req.method === "GET" && path.remaining.length === 0 ){
          return handleListTreaties( wiki, req, res );
        }
        if( req.method === "POST" && path.remaining[0] === "propose" ){
          return handleProposeTreaty( wiki, req, res );
        }
        if( req.method === "POST" && path.remaining.length === 2 && path.remaining[1] === "accept" ){
          return handleAcceptTreaty( wiki, req, res, path.remaining[0] );
        }
        if( req.method === "POST" && path.remaining.length === 2 && path.remaining[1] === "revoke" ){
          return handleRevokeTreaty( wiki, req, res, path.remaining[0] );
        }
        return sendError( res, 405, "method_not_allowed", "Invalid method" );

      case "pages":
        if( req.method === "GET" && path.remaining.length === 2 && path.remaining[1] === "proposals" ){
          return handleListProposals( wiki, req, res, path.remaining[0] );
        }
        if( req.method === "POST" && path.remaining.length === 3 && path.remaining[2] === "propose" ){
          return handleProposeChange( wiki, req, res, path.remaining[0], path.remaining[1] );
        }
        if( req.method === "GET" && path.remaining.length === 2 ){
          return handleFetchPage( wiki, req, res, path.remaining[0], path.remaining[1] );
        }
        return sendError( res, 405, "method_not_allowed", "Invalid method" );

      default:
        return sendError( res, 404, "unknown_endpoint", "Unknown SFCP endpoint" );
    }
  }

  // Set global SFCP object
  SFCP = {
    handleRequest: handleRequest,
    PREFIX: PREFIX,
    VERSION: VERSION,
    initDb: initDb
  };

  // Return for $include.result
  $include.result = SFCP;

})();
