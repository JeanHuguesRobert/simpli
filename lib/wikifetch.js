// section: wikifetch.js

var Wiki = require( "./wiki.js" ).Wiki;
var WikiProto = Wiki.prototype;

WikiProto.fetchRfc = function( id, cb ){
  var that = this
  var name = "#rfc" + id
  var url = '/rfc/rfc' + id + '.txt'
  De&&bug( "Fetching RFC ", url)
  var rfceditor = Http.createClient( 80, 'www.rfc-editor.org')
  var request = rfceditor.request(
    'GET',
    url,
    {
      "Host": 'www.rfc-editor.org',
      "User-Agent": "NodeJS HTTP Client"
    }
  )
  var body = ""
  request.addListener( 'response', function( response ){
    De&&bug( "fetchRfc status", response.statusCode)
    // JSON.stringify( response.headers)
    // response.setEncoding( 'utf8')
    response.addListener( 'data', function( chunk ){
      NDe&&bug( "Fetched some chunk, length: ", chunk.length)
      body += chunk
    })
    response.addListener( 'end', function(){
      De&&bug( "Fetched, length: ", body.length)
      var page = that.lookupPage( name).incarnFetch( body, null, false, 0)
      return !cb ? name : cb.call( that, 0, page) 
    })
  })
  //request.writeHead( [["Host",'www.rfc-editor.org']])
  try{ // Nodejs 1.9 vs 1.8
    request.end()
  }catch( e ){
    De&&bug( "No .end(), revert to .close()")
    request.close()
  }
  NDe&&bug( "Resquest sent: ", Sys.inspect( request))
  return this
}


WikiProto.fetchRemotePage = function( url, pagename, cb ){
// Returns false if bad url, or else returns true and later calls the callback
  var that = this

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

  // If there is no dot nor : in the domain, let's assume localhost is desired
  if( ii < 0 && domain.indexOf( ".") < 0 ){
    uri    = domain + uri
    domain = "localhost"
    port   = SW.port
  }

  this.de&bug(
    "fetchRemote:", url,
    "protocol:",    protocol,
    "domain:",      domain,
    "port:",        port,
    "uri:",         uri
  )

  // If "simpliwiki://" then use the SimpliWiki "rest" API
  if( protocol == "simpliwiki" ){
   var api = Session.apiScript
   // ToDo: this is not efficient at all. I should allocate a singleton api object
   // and use some setUrl() method to change the url
   ii = uri.lastIndexOf( "/")
   var rest = "/rest"
   if( ii >= 0 ){
     pagename = uri.substr( ii + 1)
     rest = uri.substr( 0, ii) + rest
   }else{
     pagename = uri     
   }
   api = api( "anonymous", "http://" + domain + ":" + port + rest, null)
   api.clearPageCache( pagename)
   this.de&&bug( "api.getPage, page:", pagename)
   api.getPage( pagename, function( result, t, x){
     this.de&&bug( "api result:", Sys.inspect( result))
     var body = result.body
     // ToDo: handle result.status && result.data
     body = "result-" + url + "\n\n" + (body || result.status)
     var page = that.lookupPage( "Proxy" + pagename).incarnFetch( body, null, false, 0)
     return !cb ? "Proxy" + pagename : cb.call( that, 0, page)
   })
   this.de&&bug( "apo.getPage() done")
   return true

  // If "http://" then the HTTP protocol
  }else if( protocol == "http" ){
    // ToDo: ENOTFOUND when domain is not found
    var http = Http.createClient( port, domain)
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
        De&&bug( "Fetched, remote, length: ", body.length)
        // Scrap content, getting rid of all \r
        var headers = ""
        for( var key in response.headers ){
          headers += key + ": " + response.headers[key] + "\n"
        }
        // ToDo: maybe I should keep the page intact and put the result in the 
        // page whose name is without Proxy (with "Remote" instead for example)
        // But then it means that the callback would get a different page...
        // This may confuse quite a lot of exiting code, to be checked
        body = "response-" + url
        + "\nstatus: " + response.statusCode
        + "\nheaders:\n" + headers
        + "\nbody:\n"
        + body.replace( /\r/g, "")
        var page = that.lookupPage( pagename).incarnFetch( body, null, false, 0)
        return !cb ? pagename : cb.call( that, 0, page)
      })
    })
    .addListener( 'error', function(){
      // ToDo: better error handling
      this.de&&bug( "ERROR on HTTP Client, domain:", domain, "port:", port, "uri:", uri)
      return cb.call( that, 1)
    })
    request.end()
    //this.de&&bug( "Request sent: ", Sys.inspect( request))
    return true
  }

  // If unknown protocol..
  return false
}


WikiProto.fetchC2 = function( pagename, cb ){
// Fetch a page from Ward's C2 wiki
  var that = this
  var url = '/cgi/wiki?edit=' + pagename
  De&&bug( "Fetching C2 ", url)
  var c2 = Http.createClient( 80, 'c2.com')
  var request = c2.request(
    'GET',
    url,
    {
      "Host": 'c2.com',
      "User-Agent": "NodeJS HTTP Client"
    }
  )
  var body = ""
  request.addListener( 'response', function( response ){
    De&&bug( "fetchC2 status", response.statusCode)
    // JSON.stringify( response.headers)
    // response.setEncoding( 'utf8')
    response.addListener( 'data', function( chunk ){
      NDe&&bug( "Fetched some C2 chunk, length: ", chunk.length)
      body += chunk
    })
    response.addListener( 'end', function(){
      De&&bug( "Fetched, C2, length: ", body.length)
      // Scrap content
      body = body
      .replace( /[\s\S]*TEXTAREA.*>([\s\S]*)<\/TEXTAREA[\s\S]*/g, "$1")
      .replace( /&quot;/g, '"')
      .replace( /&lt;/g, '<')
      .replace( /&gt;/g, '>')
      .replace( /&amp;/g, '&')
      .replace( /'''''(.*)'''''/g, '"$1"')
      .replace( /''''(.*)''''/g, '_$1_')
      .replace( /''''''/g, '/')
      .replace( /'''(.*)'''/g, '*$1*')
      .replace( /''(.*)''/g, '"$1"')
      .replace( /''/g, '"')
      .replace( /""/g, '"')
      .replace( /"'/g, '/')
      .replace( /'"/g, '/')
      //.replace( /^ ( *)(.*)$/gm, ' $1/ $2 /')
      .replace( /----/g, " ----------")
      + "\n\n"
      + "The original C2's page is c2.com/cgi/wiki?" + pagename
      + "\n\n\n\n"
      var page = that.lookupPage( pagename).incarnFetch( body, null, false, 0)
      return !cb ? pagename : cb.call( that, 0, page)
    })
  })
  request.end()
  NDe&&bug( "Resquest sent: ", Sys.inspect( request))
  return this
}

exports.Wiki = Wiki;
// section: end wikifetch.js
