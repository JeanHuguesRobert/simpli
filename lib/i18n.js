// section: i18n.js

var Sw = global.Sw;
var Session = require( "./session.js" ).Session;
var SessionProto = Session.prototype;

var i18n_table = Sw.i18n = { 
  // Default "international" version, when no better local version
  _: {
  },
  en: {
    "Send":         "Publish",
    "Original wiki": "The origine of this cloned wiki",
    "SomeGuest":  "a visitor",
    "Some(guest)": "a visitor",
    "SomeOne":    "a member",
    "UserSome":   "someone",
    "SignIn":     "sign in",
    "AboutWiki": "wiki settings",
    "il y a ":    " ",
    "il y a environ ": "about ",
    "HomePage":   "Welcome",
    "DoVisits":   "Recent visits",
    "DoMembers":  "Members",
    "DoDrafts":   "Drafts",
    "DoProfile":  "Your wikis",
    "DoBye":      "Sign off (from this wiki only)",
    "DoByeBye":   "Sign off (from all wikis)",
    "DoListLogin": "Session's history",
    "UserSomeGuest": "Welcome visitor",
    "trash":      "restore",
    " stamps":    " changes",
    "stamps":     "changes",
    //"err:locked":  "HelpLockedPage",
    "err:locked":  "SignIn",
    "err:read":    "HelpReadError",
    "err:write":   "HelpWriteError",
  },
  fr: {
    "HomePage":     "Acceuil",
    "home":         "acceuil",
    "SomeGuest":    "un quidam",
    "Some(guest)":  "un quidam",
    "SomeOne":      "un membre",
    "UserSome":     "un visiteur",
    "UserSomeGuest": "Acceuil visiteur",
    "AboutWiki":    "options wiki",
    "DoVisits":     "Visites r&eacute;centes",
    "DoMembers":    "Membres",
    "DoDrafts":     "Ebauches",
    "DoProfile":    "Vos wikis",
    "DoListLogin":  "Diagnostic de connexion",
    "DoBye":        "D&eacute;connexion (de ce wiki seulement)",
    "DoByeBye":     "D&eacute;connexion (de tous les wikis)",
    "RecentStamps": "Changements r&eacute;cents",
    "il y a ":      "il y a ",
    ":":            " : ",      // French rule
    "Original wiki":"Wiki d'origine",
    "Your wikis":   "Vos wikis",
    "Your Twitter account": "Votre compte Twitter",
    "zoom in":      "afficher plus grand",
    "zoom out":     "afficher plus petit",
    "Yours":        "A vous",
    "member of":    "membre de",
    "Visits:":       "Visites :",
    "Help":         "Aide",
    "SignIn":       "connexion",
    "sign in":      "connexion",
    "Some help, maybe": "Un peu d'aide, sans garantie",
    "LookedPage":   "Page ferm&eacute;",
    "Cancel":       "Revenir",
    "edit":         "&eacute;crire",
    "Editing ":     "Changez ",
    "Draft":        "Ebauche",
    "a draft":      "une &eacute;bauche",
    "trash":        "r&eacute;tablir",
    "Come back":    "Revenir",
    "Delete":       "Vider",
    "History":      "Historique",
    "Restore":      "R&eacute;tablir",
    "restore":      "r&eacute;tablir",
    "<em>Restore</em>":      "<em>R&eacute;tablir</em>",
    "sign out":     "partir",
    "Enter":        "Entrer",
    "curator":      "curateur",
    "Curator":      "Curateur",
    "DoNoCurator":  "Mode 'non curateur'",
    "DoCuratoring": "Mode 'curateur'",
    "DoCurator":    "Mode 'curateur'",
    "In 'curator' mode, DoNoCurator": "En mode 'curateur', DoNoCurator",
    "switch to 'curator' mode": "passer en mode 'curateur'",
    "You are now in 'curator' mode": "Actuellement en mode 'curateur'",
    "Some tools for power users":
      "Quelques outils 'avanc&eacute;s'",
    "just now":     "juste maintenant",
    "This wiki's title maybe: ": "Le titre de ce wiki peut-&ecirc;tre : ",
    "Your name maybe: ": "Votre nom peut-&ecirc;tre : ",
    "by ":          "par ",
    "you":          "vous",
    "an empty page":"une page vide",
    "about you":    "vous concernant",
    "a guest":      "un visiteur",
    " members":     " membres",
    "1 member":     "un membre",
    "Some active cloned wikis":
    "Quelques autres wikis actifs",
    "Some recent visitors": "Quelques visiteurs r&eacute;cents",
    "Some recent visiting members":
    "Quelques membres visiteurs",
    "a member":     "un membre",
    "gone":         "parti",
    "active":       "actif",
    "visits":       "visites",
    "Visits:":      "Visites :",
    " seconds ago": " secondes",
    "1 minute ago": "il y a une minute",
    " minutes ago": " minutes",
    "about an hour ago":   "il y a une heure et quelque",
    " hours ago":   " heures",
    "yesterday":    "hier",
    " days ago":    " jours",
    " weeks ago":   " semaines",
    " months ago":  " mois",
    "a page last visited by ": "une page visit&eacute;e par ",
    "a page visited ": "une page visit&eacute;e ",
    "Send":        "Publier",
    "Guest":       "Visiteur",
    "guest":       "visiteur",
    "(guest)":     "(visiteur)",
    "Copy":        "Copie",
    "Archive":     "Archiver",
    "Visit ":      "Visite : ",
    "Go to previous page": "Retour vers la page d'avant",
    "back":        "retour",
    "Links:":      "Liens : ",
    "Web address: ": "Adresse web : ",
    "drag this":   "faire glisser",
    "share":        "partager",
    "Share:":       "Partager :",
    "Comment: ":    "Commmentaire : ",
    "Comment":      "Commmenter",
    "write your text on the page": "&eacute;crire sur la page",
    ", maybe":     ", qui sait ?",
    "Another wiki, maybe": "Un autre wiki ?",
    "Another wiki, your personal one, maybe":
    "Un autre wiki, le votre ?",
    "Home":        "Acceuil",
    "This wiki's home page": "La page d'acceuil de ce wiki",
    "stamp":       "signer",
    "stamps":      "modifs",
    " stamps":     " modifs",
    "Some recently stamped pages":
    "Quelques pages sign&eacute;es r&eacute;cemment",
    " drafts":     " &eacute;bauches",
    "1 draft":     "1 &eacute;bauche",
    "Some recent draft changes":
    "Quelques pages chang&eacute;es r&eacute;cemnent",
    "zoom in":    "afficher en plus gros",
    "zoom out":   "afficher en plus petit",
    "Some pages you changed recently in this wiki":
    "des pages que vous avez modifi&eacute;es r&eacute;cemment"
    + " dans ce wiki",
    "Some page":   "Une page",
    "a draf":      "une &eacute;bauch",
    "blank page":  "page blanche",
    "accept draft change": "accepter la modification",
    "remove draft changes, restore stamped original page":
      "enlever les modifications, revenir vers l'original",
    "restore page content using this copy":
      "r&eacute;tablir le contenu de la page en utilisant cette copie",
    "Your page: ": "Votre page : ",
    "your personal page": "votre page personnelle",
    "Your personal page in this wiki":
      "Votre page dans ce wiki",
    "in your personal wiki":
      "dans votre wiki personnel",
    "the personal page of ":
      "la page personnelle de ",
    "bookmark this page":
      "ajoutez cette page &agrave; vos favoris",
    "your personal wiki":
      "dans votre wiki personnel",
    "Your entry page": "Votre page d'entr&eacute;e",
    "your changes":  "vos modifications",
    "Your private wiki:": "Votre wiki priv&eacute; :",
    "Go to page: ": "Page: ",
    "Screen name:": "Pseudo",
    "Identity on": "Votre identifiant sur",
    //"err:locked":  "HelpInaccessible",
    "err:locked":  "SignIn",
    "err:read":    "HelpErreurEnLecture",
    "err:write":   "HelpErreurEnEcriture",
    "Previous ":   "",
    "compress":    "comprimer",
    "Keep last changes only": "Garder les derniers changements seulement",
    "Anonymous":   "Anonyme",
    "(open)":      "(ouvert)",
    "Welcome":     "Bienvenue"
  }
}


var i18n_cache = { _: {}, en: {} };
var i18n_cached = {};


Session.i18n = function( msg, no_cache ){
// Returns the i18n version of the msg.
// "msg" is usually the "en" version of the message, with the translated
// version in "per language" tables.
// Sometimes "msg" is a "fake" msg that is not needed in english but is
// needed in some other languages. "il y a" is an example of such messages.

  // Don't translate weird dynamic stuff
  if( msg[0] === "<" )return msg;

  var lang = this.config.lang;
  
  // if( msg === "Search" )debugger;

  // if already the result of a previous translation, return as is
  if( i18n_cached[ msg ] === lang )return msg;

  if( !i18n_cache[ lang ] ){
    i18n_cache[ lang ] = {};
    if( !i18n_table[ lang ] ){
      this.de&&bug( "i18n, new language:", lang );
      i18n_table[ lang ] = {};
    }
  }
  
  function cached( r ){
    if( r === "_" ){
      r = msg;
    }
    if( !no_cache ){
      i18n_cache[ lang ][ msg ] = r;
      i18n_cached[ r ] = lang;
      // console.log( "i18n cached", lang, msg );
    }
    return r;
  }
  
  // Cache lookup
  var r = i18n_cache[ lang ][ msg ];
  if( r )return cached( r );

  // Lang specific msg, use it if it exists
  r = i18n_table[ lang ][ msg ];
  if( r ){
    // Handle redirection to another lang
    if( r === "_" )return cached( msg ); // Source code is the solution
    if( i18n_table[ r ] ){
      r = i18n_table[ r ][ msg ];
      if( r )return cached( r );
    }else{
      return cached( r );
    }
  }

  // Try "international" version. Example: "login"
  r = i18n_table[ "_" ][ msg ];
  if( r ){
    // If that version is one of another language, use that lang
    if( r === "_" )return cached( msg ); // Source code is the solution
    if( i18n_table[ r ] ){
      r = i18n_table[ r ][ msg ];
    }
    if( r )return cached( r );
  }
  
  // Signal missing translations, when a translation exists in french
  var fr_msg = i18n_table[ "fr" ][ msg ];
  if( lang !== "en" ){
    if( fr_msg )return cached( msg + "(" + lang + ")" ); 
  }
  
  // Use the english version if everything else failed
  r = i18n_table[ "en" ][ msg ];
  if( r ){
    return cached( r );
  }
  
  // Use the message itself in the worst case
  if( fr_msg )return cached( msg );
  
  // Neither translatable nor cacheable, inefficient, bug?
  if( !no_cache ){
    if( msg.length < 30 )return cached( msg );
    this.de&&bug( "i18n non cacheable", lang, msg );
    // debugger;
  }
  return msg;
  
};


exports.Session = Session;
// section: end i18n.js
