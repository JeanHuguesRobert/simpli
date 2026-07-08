// SFCP - Simple Fractal Confederation Protocol
// Version 0.1 - Phase 3: Content Federation
// Enables sovereign nodes to form voluntary, treaty-based relationships

(function(){

  var PREFIX = "/_sfc/v0";
  var VERSION = "0.1";
  var DB_PATH = ".sfc.db";
  var db = null;
  var Https = require( 'https' );
  var Http = require( 'http' );

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

        CREATE TABLE IF NOT EXISTS sfc_page_cache (
          cache_id TEXT PRIMARY KEY,
          from_node TEXT NOT NULL,
          page_name TEXT NOT NULL,
          content TEXT NOT NULL,
          format TEXT NOT NULL,
          fetched_at TEXT NOT NULL,
          last_modified TEXT NOT NULL,
          authority TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS sfc_node_health (
          node_id TEXT PRIMARY KEY,
          status TEXT NOT NULL,
          last_check TEXT NOT NULL,
          cache_ttl INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_page_cache_node_page ON sfc_page_cache(from_node, page_name);
        CREATE INDEX IF NOT EXISTS idx_proposals_page ON sfc_proposals(page_name);
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
    // Check if headers already sent
    if( res.headersSent ){
      console.error( "SFCP: Headers already sent, cannot send response" );
      return;
    }
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

  // Generate random IDs
  function generateTreatyId(){
    return "treaty-" + Math.random().toString( 36 ).substr( 2, 9 );
  }

  function generateProposalId(){
    return "prop-" + Math.random().toString( 36 ).substr( 2, 9 );
  }

  function generateCacheId(){
    return "cache-" + Math.random().toString( 36 ).substr( 2, 9 );
  }

  // Check if node is reachable (with caching)
  function checkNodeHealth( nodeId, callback ){
    var database = initDb();
    if( !database ) return callback( null );

    try {
      var cached = database.prepare(
        "SELECT status, last_check, cache_ttl FROM sfc_node_health WHERE node_id = ?"
      ).get( nodeId );

      var now = Date.now();
      if( cached && cached.last_check && cached.cache_ttl ){
        var lastCheck = new Date( cached.last_check ).getTime();
        var ttl = cached.cache_ttl * 1000;
        if( now - lastCheck < ttl ){
          // Use cached health status
          return callback( cached.status === "healthy" );
        }
      }
    } catch( err ) {}

    // Need to check actual node health
    // Use http for localhost, 127.0.0.1, or addresses with ports
    var isLocal = nodeId.includes( "localhost" ) || nodeId.includes( "127.0.0.1" ) || nodeId.includes( ":" );
    var url = (isLocal ? "http://" : "https://") + nodeId + "/_sfc/v0/health";
    var proto = isLocal ? Http : Https;

    var req = proto.get( url, function( res ){
      var data = "";
      res.on( "data", function( chunk ){ data += chunk; });
      res.on( "end", function(){
        try {
          var health = JSON.parse( data );
          var isHealthy = res.statusCode === 200 && health.status === "healthy";

          // Cache the result
          if( database ){
            database.prepare(
              "INSERT OR REPLACE INTO sfc_node_health (node_id, status, last_check, cache_ttl) VALUES (?, ?, ?, ?)"
            ).run( nodeId, isHealthy ? "healthy" : "unhealthy", new Date().toISOString(), health.cacheTTL || 300 );
          }

          callback( isHealthy );
        } catch( err ) {
          callback( false );
        }
      });
    });

    req.on( "error", function(){
      if( database ){
        database.prepare(
          "INSERT OR REPLACE INTO sfc_node_health (node_id, status, last_check, cache_ttl) VALUES (?, ?, ?, ?)"
        ).run( nodeId, "unhealthy", new Date().toISOString(), 300 );
      }
      callback( false );
    });

    req.setTimeout( 10000, function(){
      req.destroy();
      callback( false );
    });
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
          canInitiateTreaties: true,
          canCachePages: true
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
      sendError( res, 500, "database_error", "Failed to initialize database" );
      return true;
    }

    var body = "";
    req.on( "data", function( chunk ){ body += chunk; });
    req.on( "end", function(){
      try {
        var proposal = JSON.parse( body );

        if( !proposal.from || !proposal.type ){
          sendError( res, 400, "invalid_request", "Missing required fields: from, type" );
          return;
        }

        var validTypes = ["peer", "delegation", "read-only", "publish"];
        if( validTypes.indexOf( proposal.type ) < 0 ){
          sendError( res, 400, "invalid_treaty_type", "Valid types: peer, delegation, read-only, publish" );
          return;
        }

        var treatyId = generateTreatyId();
        var now = new Date().toISOString();
        var terms = proposal.terms || { syncDirection: "pull", pages: [] };

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

    return true; // Signal that we're handling the request (async)
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
      sendError( res, 500, "database_error", "Failed to initialize database" );
      return true;
    }

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
          sendError( res, 404, "treaty_not_found", "Treaty not found" );
          return;
        }

        if( row.status === "revoked" ){
          sendError( res, 400, "already_revoked", "Treaty is already revoked" );
          return;
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

    return true; // Signal that we're handling the request (async)
  }

  // GET /_sfc/v0/pages/{nodeName}/{pageName} - Fetch remote page
  function handleFetchPage( wiki, req, res, nodeName, pageName ){
    var database = initDb();
    if( !database ){
      sendError( res, 500, "database_error", "Failed to initialize database" );
      return true; // Signal that we're handling the request
    }

    // Check query params for cache preference
    var query = Url.parse( req.url, true ).query;
    var cacheMode = query.cached || "allow"; // allow, only, never

    // First, check if we have a cached version
    var cached = null;
    try {
      cached = database.prepare(
        "SELECT * FROM sfc_page_cache WHERE from_node = ? AND page_name = ? ORDER BY fetched_at DESC LIMIT 1"
      ).get( nodeName, pageName );
    } catch( err ) {}

    // If cacheMode is "only", return cached or error
    if( cacheMode === "only" ){
      if( cached ){
        sendJson( res, 200, {
          pageName: pageName,
          fromNode: nodeName,
          fetchedAt: cached.fetched_at,
          cachedAt: cached.fetched_at,
          lastModified: cached.last_modified,
          content: cached.content,
          format: cached.format,
          isCached: true,
          cacheAge: Math.floor( (Date.now() - new Date( cached.fetched_at ).getTime()) / 1000 ),
          authority: cached.authority,
          warning: "Serving from cache only"
        });
        return true;
      }
      sendError( res, 404, "page_not_found", "Page not found in cache" );
      return true;
    }

    // Check if remote node is healthy (async callback)
    checkNodeHealth( nodeName, function( isHealthy ){
      if( !isHealthy ){
        if( cached && cacheMode !== "never" ){
          sendJson( res, 200, {
            pageName: pageName,
            fromNode: nodeName,
            fetchedAt: cached.fetched_at,
            cachedAt: cached.fetched_at,
            lastModified: cached.last_modified,
            content: cached.content,
            format: cached.format,
            isCached: true,
            cacheAge: Math.floor( (Date.now() - new Date( cached.fetched_at ).getTime()) / 1000 ),
            authority: cached.authority,
            warning: "Remote node unavailable, serving cached version"
          });
          return;
        }
        sendError( res, 503, "node_unavailable", "Remote node is unavailable" );
        return;
      }

      // Fetch from remote node
      // Use http for localhost, 127.0.0.1, or addresses with ports
      var isLocal = nodeName.includes( "localhost" ) || nodeName.includes( "127.0.0.1" ) || nodeName.includes( ":" );
      var url = (isLocal ? "http://" : "https://") + nodeName + "/_sfc/v0/pages/local/" + pageName;
      var proto = isLocal ? Http : Https;

      var remoteReq = proto.get( url, function( remoteRes ){
        var data = "";
        remoteRes.on( "data", function( chunk ){ data += chunk; });
        remoteRes.on( "end", function(){
          if( remoteRes.statusCode !== 200 ){
            if( cached && cacheMode !== "never" ){
              sendJson( res, 200, {
                pageName: pageName,
                fromNode: nodeName,
                fetchedAt: cached.fetched_at,
                cachedAt: cached.fetched_at,
                lastModified: cached.last_modified,
                content: cached.content,
                format: cached.format,
                isCached: true,
                cacheAge: Math.floor( (Date.now() - new Date( cached.fetched_at ).getTime()) / 1000 ),
                authority: cached.authority,
                warning: "Remote fetch failed, serving cached version"
              });
              return;
            }
            sendError( res, remoteRes.statusCode, "remote_error", "Failed to fetch from remote node" );
            return;
          }

          try {
            var pageData = JSON.parse( data );

            // Cache the result
            var cacheId = generateCacheId();
            database.prepare(
              "INSERT INTO sfc_page_cache (cache_id, from_node, page_name, content, format, fetched_at, last_modified, authority) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
            ).run( cacheId, nodeName, pageName, pageData.content, pageData.format || "markdown", new Date().toISOString(), pageData.lastModified || new Date().toISOString(), pageData.authority || nodeName );

            // Return with cached=false since we just fetched it
            sendJson( res, 200, {
              pageName: pageName,
              fromNode: nodeName,
              fetchedAt: new Date().toISOString(),
              lastModified: pageData.lastModified,
              content: pageData.content,
              format: pageData.format || "markdown",
              isCached: false,
              authority: pageData.authority || nodeName,
              version: pageData.version
            });
          } catch( err ) {
            sendError( res, 500, "parse_error", "Failed to parse remote response" );
          }
        });
      });

      remoteReq.on( "error", function(){
        if( cached && cacheMode !== "never" ){
          sendJson( res, 200, {
            pageName: pageName,
            fromNode: nodeName,
            fetchedAt: cached.fetched_at,
            cachedAt: cached.fetched_at,
            lastModified: cached.last_modified,
            content: cached.content,
            format: cached.format,
            isCached: true,
            cacheAge: Math.floor( (Date.now() - new Date( cached.fetched_at ).getTime()) / 1000 ),
            authority: cached.authority,
            warning: "Remote error, serving cached version"
          });
          return;
        }
        sendError( res, 503, "node_unavailable", "Failed to connect to remote node" );
      });

      remoteReq.setTimeout( 10000, function(){
        remoteReq.destroy();
        if( cached && cacheMode !== "never" ){
          sendJson( res, 200, {
            pageName: pageName,
            fromNode: nodeName,
            fetchedAt: cached.fetched_at,
            cachedAt: cached.fetched_at,
            lastModified: cached.last_modified,
            content: cached.content,
            format: cached.format,
            isCached: true,
            cacheAge: Math.floor( (Date.now() - new Date( cached.fetched_at ).getTime()) / 1000 ),
            authority: cached.authority,
            warning: "Request timeout, serving cached version"
          });
          return;
        }
        sendError( res, 504, "timeout", "Request to remote node timed out" );
      });
    });

    return true; // Signal that we're handling the request (async)
  }

  // GET /_sfc/v0/pages/local/{pageName} - Serve local page for federation
  function handleServeLocalPage( wiki, req, res, pageName ){
    wiki.lookupPage( pageName ).read( function( err, page ){
      if( err || !page || !page.body ){
        return sendError( res, 404, "page_not_found", "Page not found" );
      }

      try {
        // Get page content as string
        var content = page.body.asString ? page.body.asString() : page.body.toString();

        sendJson( res, 200, {
          pageName: pageName,
          authority: SW.domain || "localhost",
          lastModified: page.timeString || new Date().toISOString(),
          content: content,
          format: "markdown",
          version: "1.0"
        });
      } catch( jsonErr ) {
        sendError( res, 500, "json_error", "Failed to serialize response: " + jsonErr.message );
      }
    });
  }

  // POST /_sfc/v0/pages/{nodeName}/{pageName}/propose - Propose page change
  function handleProposeChange( wiki, req, res, nodeName, pageName ){
    var database = initDb();
    if( !database ){
      sendError( res, 500, "database_error", "Failed to initialize database" );
      return true;
    }

    var body = "";
    req.on( "data", function( chunk ){ body += chunk; });
    req.on( "end", function(){
      try {
        var data = JSON.parse( body );

        if( !data.change || !data.change.content ){
          sendError( res, 400, "invalid_request", "Missing change.content" );
          return;
        }

        var proposalId = generateProposalId();
        var now = new Date().toISOString();

        database.prepare(
          "INSERT INTO sfc_proposals (proposal_id, page_name, proposed_by, proposed_at, change_json, status) VALUES (?, ?, ?, ?, ?, ?)"
        ).run( proposalId, pageName, SW.domain || "localhost", now, JSON.stringify( data.change ), "pending" );

        sendJson( res, 202, {
          status: "proposed",
          proposalId: proposalId,
          message: "Change proposed. Awaiting review by authority."
        });

      } catch( err ) {
        sendError( res, 400, "invalid_json", err.message );
      }
    });

    return true; // Signal that we're handling the request (async)
  }

  // GET /_sfc/v0/pages/{pageName}/proposals - List change proposals
  function handleListProposals( wiki, req, res, pageName ){
    var database = initDb();
    if( !database ){
      return sendError( res, 500, "database_error", "Failed to initialize database" );
    }

    try {
      var rows = database.prepare(
        "SELECT proposal_id, page_name, proposed_by, proposed_at, change_json, status FROM sfc_proposals WHERE page_name = ? AND status = 'pending'"
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
        // GET /_sfc/v0/pages/local/{pageName} - Serve local page
        if( req.method === "GET" && path.remaining[0] === "local" && path.remaining.length === 2 ){
          return handleServeLocalPage( wiki, req, res, path.remaining[1] );
        }
        // GET /_sfc/v0/pages/{nodeName}/{pageName} - Fetch remote page
        if( req.method === "GET" && path.remaining.length === 2 ){
          return handleFetchPage( wiki, req, res, path.remaining[0], path.remaining[1] );
        }
        // POST /_sfc/v0/pages/{nodeName}/{pageName}/propose - Propose change
        if( req.method === "POST" && path.remaining.length === 3 && path.remaining[2] === "propose" ){
          return handleProposeChange( wiki, req, res, path.remaining[0], path.remaining[1] );
        }
        // GET /_sfc/v0/pages/{pageName}/proposals - List proposals
        if( req.method === "GET" && path.remaining.length === 2 && path.remaining[1] === "proposals" ){
          return handleListProposals( wiki, req, res, path.remaining[0] );
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
