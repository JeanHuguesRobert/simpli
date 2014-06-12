// ----------------
// section: mail.js

var Session = require( "./session.js" ).Session;
var SessionProto = Session.prototype;

Session.sendMail = function( to, subject, body ){
// Minimal tool to send mails, using local SMTP daemon.
// Very naive implementation using fixed delays for synchronization.
// ToDo: cb( err/ok) I guess
// ToDo: Could use a service like http://mailgun.net/
// ToDo: Or https://github.com/voodootikigod/postmark.js
  this.de&&bug(
    "Mail to: ",   to,
    ", subject: ", subject,
    ", body: ",    Sys.inspect( body)
  )
  var conn25 = Net.createConnection( 25)
  var broken = false
  conn25.setEncoding( "utf8")
  var cmds = []
  var send = function(){
    var cmd = cmds.shift()
    if( broken || !cmd ){ return conn25.end() }
    conn25.write( cmd)
    setTimeout( send, 2000)
  }
  conn25.addListener( "connect", function(){
    // ToDo: Should wait for 220 here...
    setTimeout( function(){
      cmds.push( "helo localhost\r\n")
      cmds.push( "mail from: " + "info@simpliwiki.com" + "\r\n")
      cmds.push( "rcpt to: " + to + "\r\n")
      cmds.push( "data\r\n")
      cmds.push( "From: " + "info@simpliwiki.com" + "\r\n")
      cmds.push( "To: " + to + "\r\n")
      cmds.push( "Subject: " + subject + "\r\n")
      cmds.push( "Content-Type: text/plain\r\n")
      cmds.push( body  + "\r\n")
      cmds.push( ".\r\n")
      cmds.push( "quit\r\n")
      send()
    }, 10000)
  })
  var that = this
  conn25.addListener( "data", function( msg ) {
    that.de&&bug( "Mailer response: ", msg)
    if( msg.includes( "554 SMTP") ){
      broken = true
    }
  })
}

Session.registerMailAddress = function( text ){
  // ToDo: should sent mail, both to previous and new address
  var match = text.match( /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,4}/gi)
  if( !match )return ""
  text = match[0]
  this.sendMail( text, "Code", this.loginCode)
  var usermailpage = this.lookup( this.usernamize( text))
  // Flag guest's userpage as a draft, until mentor stamps it
  if( this.isGuest() ){
    this.draft( usermailpage, true)
  }
  var that = this
  this.putPage(
    usermailpage,
    this.userName(),
    function( err, usermailpage ){
      this.de&&bug( "Mail page ", usermailpage.name,
      " of ", that.userName() )
    }
  )
  return text
}

exports.Session = Session;
// section: end mail.js

