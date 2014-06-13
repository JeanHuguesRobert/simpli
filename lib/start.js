// -----------------
// section: start.js

var SW = global.SW;
var TheRootWiki = require( "./server.js" ).TheRootWiki;
var Server      = require( "./server.js" ).Server;
var User        = require( "./user.js"   ).User;

var Fs = global.Fs, ChildProcess = global.ChildProcess;

// Now I can run. But I first kill the previous process
var previous_pid;
var previous_pid_file = (SW.static_dir || ".") + "/simpliwiki.pid";
if( SW.test ){
  previous_pid_file   = (SW.static_dir || ".") + "/simpliwiki.test.pid";
}

var start = function start(){
  // Override Sw.port when running in Cloud9
  var c9_port = process.env.PORT;
  if( c9_port ){
    trace( "Cloud9" );
    SW.port = c9_port;
  }
  // Honor "start" hook
  if( SW.hookStart ){
    SW.hookStart( TheRootWiki)
  }
  NDe&&bug( "SimpliWiki starting at http://127.0.0.1:", SW.port);
  Server.listen( SW.port);
  bug( "SimpliWiki running at http://127.0.0.1:", SW.port);
  // Write PID to file, useful on restart to kill previous process
  if( !SW.test ){
    Fs.writeFileSync( previous_pid_file, process.pid.toString() );
  }
  if( SW.test ){
    User.test()
  }
}

try{
  previous_pid = Fs.readFileSync( previous_pid_file)
}catch( err ){}

if( previous_pid ){
  // I kill AND wait, or else Server.listen() may not be able bind the port
  var cmd = "kill " + previous_pid + "; wait " + previous_pid
  De&&bug( "Kill previous SimpliWiki process")
  // Exec command and then start server
  ChildProcess.exec( cmd, start)
}else{
  start()
}

// section: end start.js
