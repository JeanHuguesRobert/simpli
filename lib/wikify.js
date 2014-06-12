// section: wikify.js

var Session = require( "./session.js" ).Session;
var SessionProto = Session.prototype;

// Can I haz Markdown?
// npm markdown-js now. ToDo: and/or Showdown, with some fixes by attacklab
// See https://github.com/mckoss/pfwiki/blob/master/scripts/showdown.js
var Markdown = null
try{
  Markdown = require( "markdown")
}catch( err ){
  // I have a few issues with this one:
  // 1/ no html, 2/ no ***xxx*** or ___xxxx___, issue with some image markup
  // The first issue is a feature when visitor does not want HTML ("safe" mode
  // in the jungle).
  trace( "No markdown, see https://github.com/evilstreak/markdown-js")
  trace( "try npm install markdown")
  trace( Sys.inspect( err))
}

Session.wikifyText = function sw_wikify( text, is_rfc ){
// Do the best with few information
// Both client side & server side
//
// ToDo: deep linking: http://open.blogs.nytimes.com/2011/01/11/emphasis-update-and-source/#h%5BWtEIyw,2%5D
// ToDo: nice icons, unintrusive http://camendesign.com/code/uth2_css3-hyperlinks

  // ToDo: optimize, see http://jmrware.com/articles/2010/jqueryregex/jQueryRegexes.html
  var client_side = typeof Session === "undefined"

  // client_side && de&&bugC( "Wikify!")
  if( !text ){
    client_side && de&&bugC( "empty")
    return ""
  }

  // Delegate to markdown?
  if( text.indexOf( "mrkdwn") >= 0 ){
    client_side && de&&bugC( "mrkdwn")
    text = text.replace( /mrkdwn([^"].)/, "$1")
    // ToDo: delegate
    // https://github.com/evilstreak/markdown-js
    // See also fun http://covertprestige.info/css/remarkdown/remarkdown.css
    text = text.replace( /&lt;/g, "<").replace( /&gt;/g, ">").replace( /&amp;/g, "&")
    if( !client_side && Markdown ){
      return '\n<div class="sw_markdown">\n'
      + Markdown.markdown.toHTML( text)
      + "</div>"
    }
    if( client_side ){
      try{
        de&&bugC( "Markdown!")
        return '\n<div class="sw_markdown">\n'
        + window.markdown.toHTML( text)
        + "</div>"
      }catch( err ){
        text = "!No markdown!\n\n" + text
        .replace( /</g, "&lt;").replace( /&/g, "&amp;").replace( />/g, "&gt;")
      }
    }
  }

  if( text.search( /mdwk/i) ){
    // ToDo: delegate to mediawiki parser (server side only)
    // See http://kiwi.drasticcode.com/
    // A good candidate for C to Javascript compilation!
  }

  // Handle unformatted <code>...</code> sections
  var delimit  = "\n&lt;code&gt;\n"
  var delimit2 = "\n&lt;/code&gt;\n"
  if( false && client_side ){
    delimit  = "\n<code>\n"
    delimit2 = "\n</code>\n"
  }
  var frags = text.split( delimit)
  if( frags.length > 1 ){
    var frag
    var buf = []
    var idx
    for( var frag_id in frags ){
      frag = frags[frag_id]
      if( frag_id > "0" ){
        buf.push( "<code>" + delimit)
        if( (idx = frag.lastIndexOf( delimit2)) >= 0 ){
          idx += delimit2.length
          buf.push( frag.substr( 0, idx) + "</code>")
          buf.push( wikify( frag.substr( idx)))
        }else{
          buf.push( frag + "</code>")
        }
      }else{
        buf.push( wikify( frag))
      }
    }
    return buf.join( "")
  }else{
    return wikify( text)
  }

  // ToDo: handle some safe HTML constructs

  // Big nested function. ToDo: should indent
  function wikify( text ){

  // List management:
  var depths  = [0]
  var closing = ["Pop error"]
  
  function reset_lists(){
  // Close remaining open lists, at end of text
    var buf = "" //+ "-reset-@" + depths[0] + "-"
    while( depths.length > 1 ){ // Ignore 0th item
      depths.shift()
      buf += closing.pop()
    }
    return buf //+ "-ok-@" + depths[0] + "-"
  }
  
  function dolist( line, spaces, stars, rest ){
  // Handle a line that is a list element
    // Avoid interference with time stamped empty log messages
    if( line.match( /\<time/) ){
      return reset_lists() + line
    }
    // empty item resets everything, ie " ."
    if( !rest ){ 
      return reset_lists() + "<dfn>" + spaces + stars + "</dfn>"
    }
    var buf = ""
    var d = spaces.length + stars.length
    //buf += " @" + depths[0] + " " + d + " "
    var is_ordered = (stars.indexOf( "#") >= 0)
    if( is_ordered ){
      stars = stars.replace( /[0-9#]*/, "")
    }
    if( d == depths[0] ){
      return buf + "</li><li><dfn>" + spaces + stars + "</dfn>" + rest
    }
    while( d < depths[0] ){
      buf += closing.pop()
      depths.shift()
    }
    if( d > depths[0] ){
      depths.unshift( d)
      if( d != depths[0] ){ buf += "broken" }
      if( is_ordered ){
        closing.push( "</li></ol>")
        return buf + "<ol><li><dfn>"
        + spaces + stars + "</dfn>" + rest
      }else{
        closing.push( "</li></ul>")
        return buf + "<ul><li><dfn>"
        + spaces + stars + "</dfn>" + rest
      }
    }
    return buf + "</li><li><dfn>" + spaces + stars + "</dfn>" + rest
  }
 
  // ToDo: optimize, see http://jmrware.com/articles/2010/jqueryregex/jQueryRegexes.html
  var client_side = typeof Session === "undefined"
  
  text = text
  // \ Protect
  .replace( /\n\\.*?\n/g, function( line ){
    return "\r" + escape( "\n" + line.substr( "\n\\".length) + "\n") + "\r"
  })
  // Yaml
  .replace( /(\n---\n {0,2}(\w+:.*\n)+)/, '<div class="yaml">$1</div>')
  // !!! ToDo: <ins> & <del>
  .replace( /^!!!(.*?)$/gm,
    '<span class="diff">$1</span>')
  // (???xxxxxx???)
  // ToDo: no image if no javascript
  .replace( /\(\?\?\?([\s\S]*?)\?\?\?\)/g,
    '<div class="sw_what"><img src="/what.png"/><div class="sw_what_content">$1</div></div>')
  // "xxxxx"
  .replace(    /([^=]|^)"([^"><]{2,}?[^="\s><])"/g,
    "$1&quot;<cite>$2</cite>&quot;")
  // **xxxxx**
  .replace(  /(\s|^)\*\*([^*\s<][^*<]*?[^*<])\*\*/g,
    "$1<dfn>*</dfn><dfn>*</dfn><em>$2</em><dfn>*</dfn><dfn>*</dfn>")
  // *xxxxx*
  .replace( /(\s|^)\*([^*\s<][^*<]*?[^*\s<])\*/g,
    "$1<dfn>*</dfn><b>$2</b><dfn>*</dfn>")
  // /xxxxx/
  .replace( /(\s|^)\/([^\/\s<][^\/<]*?[^\/\s])\//g,
    "$1<dfn>/</dfn><i>$2</i><dfn>/</dfn>")
  // __xxxxx__
  .replace(    /(\s|^)__([^_\s<][^_<]*?[^_<])__/g,
    "$1<dfn>**</dfn><em>$2</em><dfn>**</dfn>")
  // _xxxxx_
  .replace(    /(\s|^)_([^_\s<][^_<]*?[^_\s<])_/g,
    "$1<u>_$2_</u>")
  // [an example link](http://example.com/) -- markdown's style
  // This comes after some wikification done server side, hence <a etc
  // ToDo: server side, when no javascript
  // ToDo: XSS, see http://ha.ckers.org/xss.html
  .replace(  /<a href="\/.*\[([^\]]*)].*?<\/a>\(<a href="([^"]*)".*?<\/a>\)/g,
    '<a href="$2">$1</a>')
  // ![alt text](/path/to/img.jpg")
  .replace(  /!<a href="\/.*\[([^\]]*)].*?<\/a>\(<a href="([^"]*)".*?<\/a>\)/g,
    '<img src="$2" alt="$1" />')
  // [an example link](http://example.com/ titled)
  .replace(  /<a href="\/.*\[([^\]]*)].*?<\/a>\(<a href="([^"]*)".*?<\/a> (.*)\)/g,
    '<a href="$2" title="$3">$1</a>')
  // ![alt text](/path/to/img.jpg "Title")
  .replace(  /!<a href="\/.*\[([^\]]*)].*?<\/a>\(<a href="([^"]*)".*?<\/a> (.*)\)/g,
    '<img src="$2" title="$3" alt="$1" />')
  // !xxxxx!
  .replace(  /(\s|^)!([^!\s&<][^!\n&<]*?[^!\s&<])!/g,   "$1<dfn>!</dfn><em>$2</em><dfn>!</dfn>")
  // (xxxxx)
  .replace(   /(\s|^)\(([^)\s&<][^)<]*?[^)\s&<])\)/g,  "$1<dfn>($2)</dfn>")
  if( is_rfc )return text
  if( false && client_side ){
    text = text
    .replace( /^(\s+)<([^\/]*)>\s*?$/gm,
      '<div align="center"><var>&lt;</var>$1<var>&gt;</var></div>')
    .replace(   /^(\s+)([^<]*)>\s*?$/gm,
      '<div align="right"> $2<var>&gt;</var></div>')
  }else{
    text = text
    .replace( /^(.*)&lt; (.*) &gt;\s*$/gm,
      '<div align="center">$1<var>&lt;</var>$2<var>&gt;</var></div>')
    .replace( /^(\s+.*) &gt;\s*$/gm,
      '<div align="right">$1<var>&gt;</var></div>')
  }
  text = text
  .replace( /(\s)-([A-Za-z]+)-/g,
    '$1-<strike>$2</strike>-')

  // Add some <br> for older Internet Explorer that does not understand CSS
  // ToDo: this is server side only, until canScript is ok for IE
  if( this.isIe6 || this.isIe7 ){
    text = text
    .replace( /\n/g, "<br>\n")
    .replace( /<img src="\/what.png"\/>/g, "")
  }
  if( !this.canScript ){
    text = text
    .replace( /class="sw_what"/g, 'class="sw_what" style="display:inline"')
  }
  
  // Split in lines to handle nested lists
  var lines = text
  var linetbl = lines.split( "\n")
  for( var ii = 0 ; ii < linetbl.length ; ii++ ){
    text = linetbl[ii]
    // Two consecutive empty lines resets the lists
    if( !text && !linetbl[ii + 1] ){
      text = reset_lists()
    }
    // ----- for hr
    text = text
    .replace( /^( +)(---+)\s*?$/gm,  function( _, spaces, dash ){
      return reset_lists()
      + '<div class="sw_hr"><dfn> </dfn>' + dash + '</div>'
    })
    // ToDo: turn these 5 rules into one, with reset_lists() in it
    .replace( /^\+\+\+\+\+(.*?$)/gm, '<h5><var>+++++</var>$1</h5>')
    .replace( /^\+\+\+\+(.*?)$/gm,   '<h4><var>++++</var>$1</h4>')
    .replace( /^\+\+\+(.*?)$/gm,     '<h3><var>+++</var>$1</h3>')
    .replace( /^\+\+(.*?)$/gm,       '<h2><var>++</var>$1</h2>')
    .replace( /^\+(.*?)$/gm,         '<h1><var>+</var>$1</h1>')
    // Handle nested lists, space and * . or - prefixed, space defined depth
    // ToDo: # for numbered list
    .replace( /^( +)([0-9]*[*.#-]+)(.*)$/gm, dolist)
    linetbl[ii] = text
  }
  text = linetbl.join( "\n")
  
  // Close unclosed lists
  text += reset_lists()

  // ToDo: don't mess with user input, fix css styles instead
  // ... but how, how, how?
  text = text
  //.replace( /\n{1,2}<div>/g,    "<div>")  // <div> introduces a break, copy/pasted, rmv it
  //.replace( /\n{1,2}<(div|h.)>/g,    "<$1>")  // <div> introduces a break, copy/pasted, rmv it
  //.replace( /<\/(div|h.)>\n{1,2}/g, "</$1>")  // Idem for <h1>, <h2>, etc
  // Unprotect
  .replace( /\r(.*)\r/g, function( _, match ){ return unescape( match) })

  return text
  } // end of nest function wikify()
}


Session.angularizeScript = function sw_angularize( $ ){
  if( !$ ){
    sw_text_changed = false
    return
  }
  // If page is not a ToDo page, just compile
  if( !window.sw_page_needs_angularize ){
    angular.compile( window.document).$init() // $text.get()).$init()
    return
  }
  // If page is not angular, angularize before compiling
  var $text  = $('#content_text')
  var html   = $text.html()
  if( !html )return
  var $ta    = $('#textarea_sw')
  var ta_txt = $ta.val()
  // ToDo: should extract the yaml section first
  var regexp = /\n( {0,2})(\w+)(:\s*)[^\n]+/g
  var all_names  = []
  var all_values = {}
  html = html.replace( regexp, function( line, spaces, attr, sep ){
    // Skip some stuff that must not be angularized
    if( attr == "angular" )return line
    // Skip "Note:" for example
    if( attr.charAt( 0).toLowerCase() != attr.charAt( 0) )return line
    // Extract value from textarea, there is no html markup there
    var value
    var patt = "\n" + spaces + attr + sep
    // console.log( "Looking for " + patt)
    var ii = ta_txt.indexOf( patt)
    if( ii < 0 ){
      // Weird
      return line
    }
    value = ta_txt.substr( ii + patt.length)
    var ii = value.indexOf( "\n")
    if( ii < 0 ){
      // Weird
      return line
    }
    value = value.substr( 0, ii)
    // console.log( "angularize " + attr + " is " + value)
    all_names.push( attr)
    all_values[attr] = value
    // Infer type from name and value
    var type = "text"
    function includes( part ){
      return attr.toLowerCase().indexOf( part) >= 0
    }
    if( includes( "mail") ){
      type = "email"
    }
    if( includes( "url") ){
      type = "url"
    }
    if( includes( "color") ){
      type = "color"
    }
    if( includes( "date") ){
      type = "date"
    }
    if( includes( "time") ){
      type = "time"
    }
    if( includes( "datetime") ){
      type = "datetime-local"
    }
    if( includes( "code") || includes( "secret") || includes( "pass") ){
      type = "password"
    }
    function starts_with( part ){
       return attr.substr( 0, part.length) == part
    }
    if( starts_with( "is") || starts_with( "can") || starts_with( "may")
    || starts_with( "no")
    ){
      type = "bool"
    }
    if( value == "false" || value == "no" || value == "f" || value == "[]"
    || value == "true" || value == "yes"
    ){
      type = "bool"
    }
    // Some "predefined" wellknown attributes
    if( attr == "cols" || attr == "rows" ){
      type = "number"
    }
    var buf = '\n'
    + spaces
    + attr
    + sep
    + '<input'
    + ' class="angular_input'
    + '" id="sw_in_' + attr
    + '" name="'     + attr
    + '" value="'    + value
    + '" type="'     + type
    + '"/><span class="angular_output'
    + '" id="sw_out_' + attr
    + '">'
    + ' {{' + attr + '}}'
    + '</span>'
    if( type == "bool" ){
      buf = buf.replace( 'type="bool"', 'ng:format="boolean"')
    }
    if( type == "number" ){
      buf = buf.replace( 'type="number"',
      'ng:format="number" ng:validate="integer"')
    }
    if( type == "email" ){
      buf = buf.replace( 'type=', 'ng:validate="email" type=')
    }
    if( type == "url" ){
      buf = buf.replace( 'type=', 'ng:validate="url" type=')
      buf = buf.replace( '}}', ' | linky}}')
    }
    if( type == "password" ){
      // ToDo: I could display colors,
      // See http://www.binpress.com/app/chroma-hash/53
      buf = buf.replace( / {{.*}}/, "")
    }
    return buf
  })
  var script = html
  $text.html( script)
  // Some CSS style disable the yaml section, restore it
  // ToDo: I should restore it only if some attr come from it
  if( all_names.length ){
    $('.yaml').css( 'display', 'visible')
    // Let's have the magic
    // console.log( "compile")
    // console.log( $text.get())
    angular.compile( window.document).$init() // $text.get()).$init()
  }
  // Define a function that collects current values
  sw_angular_inputs = function sw_angular_inputs(){
    var new_values = {}
    var new_value
    sw_text_changed = false
    for( var attr in all_values ){
      new_value = $('#sw_in_' + attr).val()
      new_values[attr] = new_value
      if( new_value != all_values[attr] ){
        sw_text_changed = attr
        // console.log( "Changed " + attr + " => " + new_value)
      }
    }
    return new_values
  }
}


Session.wikify = function( text, page, format, visited, cb ){
// Process basic markup rendering

  var that = this

  // ToDo: Haml?
  // ToDo: cache?
  NDe&&bug( "Wikify ", page)
  // null defense
  text || (text = "")
  
  // Only custom domain can have raw html content
  // This is to prevent XSS (Cross domain Scripting attacks)
  // ToDo: what about Angular then... !
  // There must be a better way to do this
  if( page && page.isHtml() && this.isCustom ){ return text }

  var is_markdown = page && page.isMarkdown()
  
  var wiki_names = SW.wikiwords

  // Get a restrictive definition of wikiwords when operating on source code
  // why: in source code, to much stuff look like a wikiword that should not
  var is_code = page && (page.isAngular() || page.isCss())
  if( is_code || is_markdown ){
    // Pattern to isolate wiki words out of stuff
    wiki_names = new RegExp(
      "([^=@#A-Za-z0-9_~\?&\)\/\\\">.-]|^)"
      + "([A-Z_][a-z0-9_]+[A-Z_][A-Za-z0-9_]+)" // "Pure" wikiwords
      , "gm"
    )
  }

  var date = new RegExp( "(" + SW.datePattern + ")", "gi")
  var is_rfc = page && "#rfc".starts( page.name)
  
  function tocable( item ){
  }
  // Special "TocAll" page, for members only
  if( !this.isGuest()
  && page
  && page.name == "TocAll"
  && this.wiki.name != "c2"
  ){
    var dofilter
    // ToDo:
    // if( page && page.isFilter() ){
    //   dofilter = page.getFirstLine()
    //   dofilter = this.filterParse( dofilter)
    var list = []
    var item
    var itempage
    for( item in this.wiki.allPages ){
      itempage = this.wiki.allPages[item]
      if( !"Do".starts(   item)
      &&  !"#rfc".starts( item)
      &&  (!"UserRestore".starts( item) || this.isMentor)
      &&  this.mayRead( itempage)
      &&  (this.canMentor || !itempage.isCode() )
      &&  (!(itempage.wasIncarned() && itempage.isVoid()) || this.isMentor)
      &&  (!dofilter || this.passFilter( dofilter, itempage))
      ){
        list.push( item + " " + this.tooltip( itempage, true))
      }
    }
    this.de&&bug( "TocAll: ", list.sort().join( " ; "))
    list = list.sort()
    // ToDo: would be cool to visualize relationshipts as a graph,
    // see http://arborjs.org/reference
    text = text + "\n\n"
    + list.length + " " + this.i18n( "Pages:") + "\n" + list.join( "\n")
  }
  
  // For small pages, it is useful to check the length of longest line
  // This helps to use a big font on small pages
  if( false && !is_code ){
    var maxlen = 0
    if( page ){
      delete page.maxCols
    }
    if( !this.twoColumns
    && page
    && !page.isToc()
    && !page.isDo()
    && text.length < 1024
    ){
      NDe&&bug( "Small page, find longest line")
      var lines = text.split( "\n")
      if( lines.length < 32 ){
        for( var ii in lines ){
          if( lines[ii].length > maxlen ){
            maxlen = lines[ii].length
          }
        }
      }
    }
    // In some display configurations I increase the font size
    if( maxlen && maxlen < this.config.cols ){
      NDe&&bug( "Small page, maxCols: ", maxlen)
      page.maxCols = maxlen > 10 ? maxlen : 10
      // Adjust based on width of page's name
      // ToDo: do this in viewForm() I guess
      var label_width = "Page ".length + page.name.length
      if( page.maxCols < label_width ){
        this.de&&bug( "Adjust small page width to match label:", label_width)
        page.maxCols = label_width
      }
    }
  }
  
  // HTML, let's get <,>, & right
  if( !format ){
    // Split parts if twitter style message
    if( (page && page.isTweet())
    && !page.isSensitive()
    && text.length > 140
    ){
      // Add a 140 mark, removed later
      var text140 = text.frontLine().substr( 0, 140)
      var text141 = text.substr( text140.length)
      text = '<span class="twitter">' + Wiki.htmlize( text140) 
      + '</span>'                     + Wiki.htmlize( text141)
    }else{
      text = Wiki.htmlize( text)
    }
  }
  // Don't do much for logs
  if( page && page.name.includes( "DebugTail") ){
    return !cb ? text : cb( text)
  }
  var href = "/"
  if( format ){
    if( format == "permalinks"){
      href = this.wiki.permalink( "")
    }else{
      href = '#'
    }
  }
  // Let's get a Wiki look
  
  // If fluid layout, handle \n to make p or br
  // ToDo: maybe I should use markdown
  if( !this.config.rows ){
    text = text
    .replace( /\n/g, "\n<br/>\n")
    .replace( /\n<br\/>\n\n<br\/>\n/g, "\n<p/>\n")
  }

  // Interwiki links, unless source code page
  if( !is_code && !is_markdown ){
    var text = text.replace(
      // This pattern tends to interfere with urls, hence: some restrictions
      /(\s|^)([A-Z][A-Za-z0-9\-]+?):([\w\//@#.-]{3,})/g,
      function( h, front, m, rest ){
        // De&&bug( "Interwiki match: ", m)
        return front + '<a href="'
        + Wiki.htmlizeAttr(
          that.wiki.interwiki( m) + rest)
        + '">'
        + m + ":" + rest
        + "</a>" 
      }
    )
  }

  // Soft urls, very soft, xyz.abc style
  // The pattern is tricky, took me hours to debug it
  // http://gskinner.com/RegExr/ may help
  var surl =
  /([\s>]|^)([^\s:=@#"([)\]>][a-z0-9.-]+\.[a-z]{2,4}[^\sA-Za-z0-9_!.;,<"]*[^\s:,<>"']*[^.@#\s:,<>'"]*)/g
  /*
   *  (([\s>]|^)             -- space or end of previous link or nothing
   *  [^\s:=@#"([)\]>]       -- anything but one of these
   *  [\w.-]+                -- words, maybe . or - separated/terminated
   *  \.[a-z]{2,4}           -- .com or .org or .xxx
   *  [^\sA-Za-z0-9_!.;,<"]* -- ? maybe
   *  [^\s:,<>"']*           -- not some separator, optional
   *  [^.@#\s:,<>'"]*        -- not . or @ or # terminated -- ToDo: broken
   *
   *  ToDo: must not match jh.robert@
   *  but should match simpliwiki.com/jh.robert@
   */
  if( !is_code && !is_markdown ){
    text = text.replace( surl, function( m, p, u ){
      // u = u.replace( /&amp;/g, "&")
      // exclude some bad matches
      if( /[#.]$/.test( u) )return m
      if( u.indexOf( "..") >= 0 )return m
      return p 
      + '<a href="' + Wiki.htmlizeAttr( "http://" + u) + '">'
      + u
      + '</a>'
    })
  }

  // url are htmlized into links
  // The pattern is tricky, change with great care only
  var url = /([^>"\w]|^)([a-ik-z]\w{2,}:[^\s'",!<>)]{2,}[^.\s"',<>)]*)/g 
  // Very tolerant but no javascript, unless... restrictive in source code
  if( is_code ){
    url = /([^>"\w]|^)(http:[^\s'",!<>)]{2,}[^.\s"',<>)]*)/g
  }
  if( !is_markdown ){
    text = text
    .replace( url, function( m, p, u ){
      // exclude some matches
      //if( /[.]$/.test( u) )return m
      // Fix issue with terminating dot
      var dot = ""
      if( ".".ends( u) ){
        u = u.substr( 0, u.length - 1)
        dot = "."
      }
      u = u.replace( /&amp;/g, "&")
      return p + '<a href="' +  Wiki.htmlizeAttr( u) + '">' + u  + '</a>' + dot
    })
  }

  // xxxx@ become links to @xxxx
  //text = text.replace( /([^:\w])(\w{3,}?)\@/g,
  //  '$1<a ma href="' + href + '@$2">$2@</a>'
  //)
  
  // Some RFC specific rules
  if( is_rfc ){
    // ToDo: Handle , separated list
    text = text.replace(
      /Obsoletes:(\s*)(\d+)    /,
      "Obsoletes:$1RFC $2"
    )
    text = text.replace(
      /Updates:(\s*)(\d+)    /,
      "Updates:$1RFC $2"
    )
  }

  // IETF RFCs become links
  if( is_code || is_rfc ){
    text = text.replace( /(\W)(RFC)([ #]*)(\d+)/gm,
      '$1<a href="' + href + 'on_rfc$4">$2$3$4</a>'
    )
  }

  // Wiki words becomes links (and references to closures later, read on)
  if( !is_markdown ){
    text = text
    .replace( wiki_names, '$1<a class="wiki" href="' + href + '$2">$2</a>')
  }

  // Fix some rare issue with nested links, remove them
  text = text.replace( /(<a [^>\n]+?)<a [^\n]+?>([^<\n]+?)<\/a>/g, '$1$2')
  
  // <a href="http://jean.vincent@">jean.vincent@</a>

  // y becomes i, unless premium or "Read" page
  if( !this.wiki.isRoot()
  &&  !this.wiki.config.premium
  &&  (!page || !page.isRead())
  &&  !(is_rfc || is_code || is_markdown)
  ){
    // text = text.replace( /(\b[^"y]*)y /gm,     '$1<em title="y">i</em> ')
    text    = text.replace(  /^([^"y]*)y (.*)$/m, '$1<em title="y">i</em> $2')
  }

  // Date, iso format typically, are emphasized and later complemented
  if( !is_markdown ){
    text = text.replace( date, '<time>$1</time>')
  }
  
  // Some simple markup
  if( format
  || !that.canScript
  // that.canScript === "maybe", optimistic
  ){
    // Wikify, but not source code
    if( !page || !page.isSourceCode ){
      text = Session.wikifyText( text, is_rfc)
    }
  }else{
    // wikifyText() is done client side
  }

  if( format ){
    if( format == "permalinks" ){
      text = text.replace( "/@", "/at").replace( "/#", "/on")
      text = "<pre><tt>" + text + "</tt></pre>"
    }
    return text
  }
  
  // Toc pages transclude their content
  var dotoc
  if( page && page.isToc() ){
    dotoc = true
    ;(visited || (visited = {}))[page] = true
  }
  var toc = []
  
  // Now I inject closures instead of "normal" links
  // Also process "Your" & "This" pages
  var text2 = ""
  var ii
  var jj
  var pagename
  var otherpage
  var label
  var closure
  var pat = '<a class="wiki" href=\"/'
  if( page ){ page.resetLinks() }
  while( (ii = text.indexOf( pat)) >= 0 ){
    text2 = text2 + text.substr( 0, ii)
    text = text.substr( ii + pat.length)
    jj = text.indexOf( "\"")
    pagename = text.substr( 0, jj)
    // ToDo: de htmlizeAttr
    pagename = Wiki.dehtmlizeAttr( pagename)
    otherpage = this.lookup( pagename)
    text  = text.substr( jj)
    jj    = text.indexOf( ">")
    text  = text.substr( jj + 1)
    jj    = text.indexOf( "</a>")
    label = text.substr( 0, jj)
    text  = text.substr( jj + 4)
    // Backlinks management, manages both directions actually
    if( page ){
      this.trackBacklink( otherpage, page)
    }
    // Handle local, my and this pages
    if( page && otherpage.isLocal() ){
      pagename = this.localName + pagename.substr( "Local".length)
    }
    if( page && (otherpage.isYour()  || pagename == "YourPage") ){
      if( pagename == "YourPage" ){
        pagename = this.usernamize( this.userName())
      }else{
        var is_own = "YourOwn".starts( pagename)
        var property = pagename.substr( "Your".length)
        if( is_own ){
          property = property.substr( "Own".lenght)
       }
        if( this.loginPage.get( property) ){
          pagename = this.loginPage.get( property)
          // ToDo: should sanitize
        }else{
          pagename = this.userName() + pagename.substr( "Your".length)
          if( is_own ){
            pagename = this.usernamize( pagename)
          }
        }
      }
    }
    if( page && otherpage.isThis() ){
      if( "Wiki".starts( otherpage.name.substr( "This".length)) ){
        pagename = this.wiki.name + pagename.substr( "ThisWiki")
      }else if( "Parent".starts( otherpage.name.substr( "This".length)) ){
        pagename = "Parent" + page
      }else{
        pagename = page + pagename.substr( "This".length)
      }
    }
    if( page && otherpage.isDo() ){
      if( otherpage.name == "DoIt" ){
        pagename = page.getToDo()
        this.doOnPage = page
      }
    }
    this.de&&mand( pagename )
    // Update otherpage accordingly
    if( otherpage.name != pagename ){
      otherpage = this.lookup( pagename)
      this.trackBacklink( otherpage, page)
    }
    // Show link only for pages that are maybe readable
    if( this.mayRead( otherpage) ){
      // CodeSecret => dynamic secret
      if( otherpage.isCode() && otherpage.name == "CodeSecret" ){
        text2 += this.htmlA(
          "CodeSecret",
          this.hrefPathname( "CodeF" + this.wiki.random3Code( ""))
        )
      // SecretSecret => dynamic secret
      }else if( otherpage.isSecret()
      && otherpage.name == "SecretSecret"
      ){
        text2 += this.htmlA(
          "SecretSecret",
          this.hrefPathname( "SecretF" + this.wiki.random3Code( ""))
        )
      }else if( pagename == "WikifyIt" ){
        var wikify_page  = page.getBody().frontLine()
        var wikify_label = "" 
        if( this.wikinamize( wikify_page) == wikify_page ){
          if( wikify_page == "WikifyIt" ){
            wikify_label = page.isHome() ? this.wiki.getLabel() : page.name
            wikify_page  = page
          }else{
            wikify_label = wikify_page
            wikify_page = this.lookup( wikify_page)
          }
        }else{
          wikify_label = this.wiki.getLabel()
          wikify_page  = this.loginPage
        }
        text2 += '\n\\<a href="javascript:('
        + Wiki.htmlizeAttr(
          this.wikifyItScript.toString()
          .replace(
             SW.domain,
             SW.domain + this.hrefPath( wikify_page)
          )
          .replace( / +/g, " ")
          .replace( /\n/g, ""))
        + ')() || void( 0)" title="' + this.i18n( "drag this") + '">'
        + this.i18n( "Wikify " + wikify_label)
        + "</a>\n"
      }else{
        text2 += this.linkPage( pagename, label)
        // Remember pages to transclude, but don't transclude RFCs
        if( dotoc
        && !"#rfc".starts( pagename)
        ){
          toc.push( pagename)
        }
      }
    }else{
      // Hide secrets a little, still visible in edit mode
      if( otherpage.isSecret() ){
        // SecretSecret => dynamic secret
        if( otherpage.name == "SecretSecret" ){
          text2 += this.htmlA(
            "SecretSecret",
            this.hrefPathname( "SecretF" + this.wiki.random3Code( ""))
          )
        }else{
          text2 += (new Array( pagename.length)).join( "X")
        }
      }else{
        text2 += pagename
      }
    }
  }
  if( text ) text2 += text;

  
  // ToDo: if paired, cobrowsing on http links
  
  var text3 = text2 // ToDo: get rid of those

  // Include images
  // querystring: (?:\\?[^#<>\\s]*)?(?:#[^<>\\s]*)?
  if( !is_code && !is_markdown ){
    var text4 = text3.replace(
    /(<a href=")([^"]*?)(\.gif|\.png|\.jpg|\.jpeg|\.svg)((?:\?[^"]*)?">)(.*?)(<\/a>)/gi,
      // ToDo: get rid of <a>..</a>
      function( _, a1, u, e, a2, a3, a4 ){
        return a1 + u + e + a2
        + '<img src="' + u + e + a2
        + '<var>' + a3 + '</var>'
        + a4
      }
    )
  }else{
   text4 = text3
  }

  // Adjust timezone of dates, well, actually tells time since date
  // ToDo: client side when possible
  var text5
  if( is_markdown ){
    text5 = text4
  }else{
    text5 = text4.replace(
      /<time>(.*?)<\/time>/g,
      function( e, time ){
        return '<time title="' + that.dateTooltip( time) + '">'
        + (time
          // "hide" noise but keep it to make copy/paste work as expected
          .replace( "T", '<i>T</i>')
          .replace( ".", '<em>.')
          .replace( "Z", 'Z</em>')
        )
        + '</time>'
      }
    )
  }
  
  // Done, unless Toc page
  // ToDo: It would be nice to be able to transclude in anypage, syntax?
  if( !dotoc ){
    return !cb ? text5 : cb( text5)
  }
  
  // Inject content of toc
  var subpage
  var subpagecontent
  var dofound = false
  var subcontent = []
  this.doOnPage = page
  if( !cb ){
    while( subpage = toc.shift() ){
      subpage = this.lookup( subpage)
      if( !dofound ){ dofound = subpage.isDo() }
      if( !visited[subpage.name] && !subpage.isSensitive() ){
        // ToDo: asynchrous
        subpagecontent = subpage.getBody()
        if( false && !subpagecontent && !subpage.isDo() && !dofound ){
          subpagecontent = subpage.name
        }
        if( subpagecontent ){
          // ToDo: look for some code that would break the page in two parts,
          // with only the first part displayed and a "read more" link added
          if( !dofound ){
            subcontent.push( "\n--------------------")
            subcontent.push( "Page " + this.link( subpage))
            subcontent.push( "")
          }
          subcontent.push( this.wikify(
            subpagecontent,
            subpage,
            null,
            visited
          ))
        }
      }
      visited[subpage.name] = true
    }
    text5 += subcontent.join( "\n")
    return text5
  }
  // Idem but asychronous
  var that = this
  this.de&&bug( "Toc: ", toc.join( " "))
  var loop = function( list, fn ){
    var item = list.shift()
    fn( item, function(){
      if( item ){ loop( list, fn) }
    })
  }
  loop( toc, function( subpage, next ){
    if( !subpage){ return cb( text5 + subcontent.join( "\n")) }
    subpage = that.lookup( subpage)
    dofound || (dofound = subpage.isDo())
    if( !visited[subpage.name] && !subpage.isSensitive() ){
      visited[subpage.name] = true
      return that.getPage( subpage, function( err, subpage ){
        subpagecontent = subpage.getBody()
        if( !subpagecontent && !subpage.isDo() ){
          subpagecontent = subpage.name
        }
        if( !subpagecontent ){ return next() }
        if( !dofound ){
          subcontent.push( "\n--------------------")
          subcontent.push( "Page " + that.link( subpage))
          subcontent.push( "")
        }
        return that.wikify(
          subpagecontent,
          subpage,
          null, // format
          visited,
          function ( wikitext ){
            subcontent.push( wikitext)
            return next()
          }
        )
      })
    }
    visited[subpage.name] = true
    return next()
  })
  return this
}

exports.Session = Session;
// section: end wikify.js
