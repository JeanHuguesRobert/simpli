// ----------------
// section: html.js

var Session = require( "./session.js" ).Session;
var SessionProto = Session.prototype;

Session.linkPage = function( name, label, title ){
// Like link() but with a page name instead of a Page object
  return this.link( this.lookup( name), label, title)
}


Session.hrefPathname = function( name ){
// Returns the pathname to a page. ie /somewiki/HomePage if no subdomain
  // ToDo: I should allow / in page's name, ie in free links
  var path = "/" + this.wiki.fullname()
  if( this.subdomain ){
    path = path.substr( this.subdomain.length)
  }
  // Hack to avoid wiki when page is required
  // Why: @jhr could be either the name of a page or the name of a wiki
  if( this.wiki.isRoot()
  && SW.wikiwordId.test( name)
  ){
    path = "/page/"
  }
  return path + Wiki.encode( name)
}

Session.hrefPath = function( page ){
// Returns the pathname to a page. ie /somewiki/HomePage if no subdomain
  return this.hrefPathname( page.name)
}

Session.href = function( page ){
// Return the pathname to a page together with a query parameter to the
// closure that display that page
  return this.hrefPath( page)
  + "?cid=" + this.getViewClosure( page)
  + "&time=" + Sw.timeNow // ToDo: better "no cache" handling
}

Session.link = function( page, label, title ){
// Returns <a xxx></a> code that link to a page using it's view closure
// neither page nor title need to be encoded.
  label = label || page.name
  label = this.i18n( label)

  if( !title || title == "" ){
    title = this.tooltip( page)
  }
  // User friendly xxxx(guest) instead of ugly xxxxGuest
  // Or just "a guest" maybe?
  if( "Guest".ends( label) ){
    label 
    //= label.substr( 0, label.length - "Guest".length) + this.i18n( "(guest)")
    = "a guest"
  }
  return this.htmlA(
    this.i18n( label),
    Wiki.htmlizeAttr( this.href( page))
    + (page.isDraft()
      ? '" class="wiki hothot'
      : (page.isHot() ? '" class="wiki hot' : '" class="wiki')
    ),
    Wiki.htmlizeAttr( this.i18n( title)),
    true // => dont_htmlize, because I did it here
  )
}

Session.button = function( label, closure_id, title ){
  return this.htmlA( 
    this.i18n( label),
    this.hrefPath( this.getCurrentPage())
    + "?cid=" + closure_id
    + "&time=" + Sw.timeNow, // ToDo: better "no cache" handling,
    this.i18n( title)
  )
}

Session.htmlA = function( label, href, title, dont_htmlize ){
  return HtmlA( label, href, !this.isWii && title, dont_htmlize)
}

// -----------
function HtmlA( label, href, title, dont_htmlize ){
// Makes a A element
// ToDo: make into SW.htmlA()
  href = href || label
  // ToDo: if type of ref is closure...
  return '<a href="'
  +  (dont_htmlize ? href : Wiki.htmlizeAttr( href))
  + (title
    ? '" title="' + (dont_htmlize ? title : Wiki.htmlizeAttr( title))
    : '')
  + '">'
  + label
  + '</a>'
}

require( "./globals.js" ).inject( [ Session, HtmlA ], exports );
// section: end html.js