// -------------------
// section: mockreq.js
// Class MockRequest
//
// I use mock HTTP requests (and responses) for tests.
// In some situations, I also use them in production.
//
// The MockRequest object actually implements both the ServerRequest and
// the ServerResponse inferfaces.
//
// It is an EventEmitter with some additional events:
// 'data' when emitData() is invoked.
// 'end'  when emitEnd() is invoked.
// 'headers' when writeHead() is invoked.
// 'write' when write() is invoked.
// 'send' is emitted when end() is invoked.

function MockRequest( response ){
  Events.EventEmitter.call( this)
  this.uniqueId = MockRequest.id++
  if( !response ){
    this.model = "ServerRequest"	  
    this.url = ""
    this.headers = {}
    this.method = "GET"
    this.connection = {}
  }else{
    this.model = "ServerResponse"
  }
}

// MockRequest.prototype = MockRequest
// See http://blog.nodejitsu.com/using-sys-inherits-in-node-js
Sys.inherits( MockRequest, Events.EventEmitter)
MakeDebuggable( MockRequest, "MockRequest")

MockRequest.id = 0

MockRequest.prototype.toString = function(){
  return "<M " + this.uniqueId + " " + this.model + ">"
}

MockRequest.prototype.emitData = function( data ){
  this.emittedData = data
  this.emit( 'data', data)
}

MockRequest.prototype.emitEnd = function(){
  this.emittedEnd = true
  this.emit( 'end')
}

MockRequest.prototype.end = MockRequest.prototype.emitEnd

MockRequest.prototype.writeHead = function( code, headers ){
  this.writeCode = code
  this.writeHeaders = headers
  this.emit( 'headers')
}

MockRequest.prototype.write = function( body, encoding ){
  this.writeData = body
  this.writeEncoding = encoding
  this.emit( 'write', body, encoding)
}

MockRequest.prototype.end = function(){
  this.emittedSend = true
  this.emit( 'send')
}

MockRequest.get = function( handler, url, cb, timeout_t ){
// Invoke HTTP handler.
// Calls cb( 'end', data, rsp, req) or cb( 'timeout', data, rsp, req)
  var req = new MockRequest()
  req.method = "GET"
  req.url = url
  req.process( handler, cb, timeout_t)
  return req
}

MockRequest.post = function( handler, url, data, cb, timeout_t ){
// Invoke HTTP handler.
// Calls cb( 'end', data, rsp, req) or cb( 'timeout', data, rsp, req)
  var req = new MockRequest()
  req.method = "POST"
  req.url = url
  req.process( handler, cb, timeout_t)
  req.emitData( data)
  req.emitEnd()
  return req
}

MockRequest.prototype.process = function( handler, cb, timeout_t ){
  var that = this
  var rsp = new MockRequest( true)
  timeout_t || (timeout_t = 10000)
  var done = false
  rsp.addListener( 'end', function(){
    if( done )return
    done = true
    cb.call( that, 'end', rsp.writeData, rsp, that)
  })
  setTimeout(
    function(){
      if( done )return
      cb.call( that, 'timeout', rsp.writeData, rsp, that)
    },
    timeout_t
  )
  handler.call( this, this, rsp)
  return this
}


require( "./globals.js" ).inject( MockRequest, exports );
// section: end mockreq.js
