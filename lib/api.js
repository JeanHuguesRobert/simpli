// ---------------
// section: api.js

var Session = require( "./session.js" ).Session;
var SessionProto = Session.prototype;

Session.apiScript = function sw_api( cid, url, _$ ){
// Client side OR server side (NodeJS)
// ToDo: make it cross domain, see http://saunter.org/janky.post/

  // ToDo: avoid global scope
  var scope = (typeof window !== "undefined" && window) || global

  // No JSON? I get by, it's only about a hash of strings
  var json = window.JSON
  if( !json || !json.parse ){
    json = {
      parse: function( x ){ return eval( "(" + x + ")") }
      ,stringify: function( hash ){
        var buf = []
        for( var key in hash ){
           buf.push(
             strings[key]
             + ':"'
             + hash[key]
               .replace( /\//g, '\\')
               .replace( /"/g,  '\"')
               .replace( /\n/g, "\\n")
             + '"'
           )
        }
        // Et voila
        return "{" + buf.join( ",") + "}"
      }
    }
  }

  // Cache to avoid useless reads
  scope.sw_page_cache = {}

  url || (url = "/rest")
  if( cid == "anonymous" ){
    cid = 0
  }else if( !cid ){
    if( typeof sw_ctx !== "undefined" ){
      cid = sw_ctx.restCid
    }else{
      cid = 0
    }
  }

  function my$(){
    _$ || (_$ = (typeof $ !== "undefined" && $))
    if( _$ && _$.get )return _$
    // If no asynchronous getter... provide one, basic, server side only
    // ToDo: handle success/error
    //De&&bug( "Defining _$, with a .get()")
    _$ = { get: function( url, req, cb ){
      De&&bug( "_$.get() called, url:", url)
      // Split url into protocol/domain/port/uri
      var protocol = ""
      var ii  = url.indexOf( "://")
      var uri = url
      if( ii > 0 ){
        protocol = url.substr( 0, ii)
        uri  = url.substr( ii + "://".length)
      }
      var domain = uri
      var jj = uri.indexOf( "/")
      if( jj > 0 ){
        domain = uri.substr( 0, jj)
        uri    = uri.substr( jj)
      }else{
        uri    = "/"
      }
      var port   = "80"
      ii = domain.indexOf( ":")
      if( ii > 0 ){
        port   = domain.substr( ii + 1)
        domain = domain.substr( 0, ii)
      }
      // ToDo: this works on nodejs only...
      uri += "?" + require( "querystring").stringify( req)
      De&&bug( "sw_api, domain:", domain, "port:", port, "uri:", uri)
      // ToDo: use new Http Client library, v 0.4
      var http = require( "http").createClient( port, domain)
      var request = http.request(
        "GET",
        uri,
        {
          "Host": domain,
          "User-Agent": "SimpliWiki HTTP Client"
        }
      )
      var body = ""
      request.addListener( 'response', function( response ){
        response.addListener( 'data', function( chunk ){
          NDe&&bug( "Fetched some remote chunk, length: ", chunk.length)
          body += chunk
        })
        response.addListener( 'end', function(){
          body = body.replace( /\r/g, "")
          De&&bug( "sw_api, response:", body)
          cb( body, 200)
        })
      })
      .addListener( 'error', function(){
        // ToDo: better error handling
        return cb( '{"status":500}', 500)
      })

      request.end()
    } }
    return _$
  }

  function parse_result( d, name ){
    try{
      d = json.parse( d)
      if( name ){
        scope.sw_page_cache[name] = d
      }
      if( d.data ){
        d.data = json.parse( d.data)
      }
    }catch( err ){
      d = {status: 500}
    }
    return d
  }

  var api = {

  getPageRequest: function sw_getPageRequest( name ){
    return {
      url:    url,
      cid:    cid,
      action: "getPage",
      name:   name
    }
  },

  putPageRequest: function sw_putPageRequest( name, body, data ){
    return {
      url:    url,
      cid:    cid,
      action: "putPage",
      name:   name,
      body:   body,
      data:   data ? json.stringify( data) : null
    }
  },

  appendPageRequest: function sw_putPageRequest( name, body, data ){
    return {
      url:    url,
      cid:    cid,
      action: "appendPage",
      name:   name,
      body:   body,
      data:   data ? json.stringify( data) : null
    }
  },

  getPage: function sw_getPage( name, cb ){
    var cache = scope.sw_page_cache[name]
    var that  = this
    if( cache ){
      this.de&&bug( "_$.get(), cached:", name)
      setTimeout( function(){
        cb.call( that, cache)
      }, 1)
      return
    }
    var req = api.getPageRequest( name)
    var url = req.url
    delete req.url
    this.de&&bug( "_$.get()...")
    return my$().get( url, req, function( d, t, x ){ 
      cb.call( that, parse_result( d, name), t, x)
    })
  },

  clearPageCache: function( name ){
    if( name ){
      delete scope.sw_page_cache[name]
    }else{
      scope.sw_page_cache = {}
    }
  },

  putPage: function sw_putPage( name, body, data, cb ){
    var that = this
    var req  = api.putPageRequest( name, body, data)
    var url  = req.url
    api.clearPageCache( name)
    delete req.url
    return my$().get( url, req, function( d, t, x ){
      cb.call( that, parse_result( d, name), t, x)
    })
  },

  appendPage: function sw_putPage( name, body, cb ){
    var that = this
    var req  = api.appendPageRequest( name, body)
    var url  = req.url
    api.clearPageCache( name)
    delete req.url
    return my$().get( url, req, function( d, t, x ){
      cb.call( that, parse_result( d, name), t, x)
    })
  },

  getSession: function sw_getSession(){
    if( typeof sw_ctx === "undefined" ){
      return sw_session = {
        login: "ApiCLientGuest",
        cid: 0,
        anonymous: true
      }
    }
    return sw_session = {
      login:     sw_ctx.login,
      page:      sw_ctx.page,
      lang:      sw_ctx.lang,
      cols:      sw_ctx.cols,
      rows:      sw_ctx.rows,
      cid:       sw_ctx.restCid,
      anonymous: sw_ctx.isAnonymous,
      visitors:  sw_ctx.visitors,
      oembed:    sw_ctx.isOembed,
      iframe:    sw_ctx.isIframe,
      address:   sw_ctx.address,
      debug:     De
    }
  }
  }
  return scope.sw_do = api
}

exports.Session = Session;
// section: end api.js