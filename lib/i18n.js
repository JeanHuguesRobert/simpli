// section: i18n.js

var Sw = global.Sw;
var Session = require( "./session.js" ).Session;
var SessionProto = Session.prototype;

Sw.i18n = {
  en: {
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
    "DoDraftsAndCodes":
                  "Drafts & draft codes",
    "DoProfile":  "Your wikis",
    "PrivateCodes":
                  "Invitation codes",
    "DoBye":      "Sign off (from this wiki only)",
    "DoByeBye":   "Sign off (from all wikis)",
    "DoListLogin": "Session's history",
    "UserSomeGuest": "Welcome visitor",
    "trash":      "restore",
    " stamps":    " changes",
    "stamps":     "changes",
    "Invitation code": "invitation code or page's name", // "email address",
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
    "DoDraftsAndCodes":
                    "Ebauches & codes temporaires",
    "DoProfile":    "Vos wikis",
    "PrivateCodes": "Codes d'entr&eacute;e",
    "DoListLogin":  "Diagnostic de connexion",
    "DoBye":        "D&eacute;connexion (de ce wiki seulement)",
    "DoByeBye":     "D&eacute;connexion (de tous les wikis)",
    "InvitationCode": "Code d'entr&eacute;e",
    "RecentStamps": "Changements r&eacute;cents",
    "il y a ":      "il y a ",
    ":":            " : ",      // French rule
    "Original wiki":"Wiki d'origine",
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
    "Invitation code": "Code d'entr&eacute;e ou nom d'une page", // "adresse email",
    "sign out":     "partir",
    "Enter":        "Entrer",
    "switch to 'maintenance' mode": "passer en mode 'Maintenance'",
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
    "Send":        "Envoie",
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
    "Follow":      "Suivre",
    "Pair":        "A deux",
    "Some page":   "Une page",
    "Some peer, last seen ": "Un autre visiteur, actif ",
    "a draf":      "une &eacute;bauch",
    "blank page":  "page blanche",
    "Unpair":      "Quitter",
    "Unfollow":    "Quitter",
    "accept draft change": "accepter la modification",
    "remove draft changes, restore stamped original page":
      "enlever les modifications, revenir vers l'original",
    "restore page content using this copy":
      "r&eacute;tablir le contenu de la page en utilisant cette copie",
    "your personal page": "votre page personnelle",
    "Your personal page in this wiki":
      "Votre page dans ce wiki",
    "'invitation code' for ":
      "'code d'entr&eacute;e' pour ",
    "Your invitation code":
      "Votre code d'entr&eacute;e",
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
    "(open)":      "(ouvert)"
  }
}

Session.i18n = function( msg ){
// Returns the i18n version of the msg.
// "msg" is usually the "en" version of the message, with the translated
// version in "per language" tables.
// Sometimes "msg" is a "fake" msg that is not needed in english but is
// needed in some other languages. "il y a" is an example of such messages.
  var lang = this.config.lang
  NDe&&bug( "lang: ", lang)
  if( !Sw.i18n[lang] ){
    this.de&&bug( "newLanguage:", lang)
    Sw.i18n[lang] = {}
  }
  // Lang specific msg, or default "en" msg, or msg itself if no translation
  return Sw.i18n[lang][msg]
  || Sw.i18n["en"][msg]
  || msg
}

exports.Session = Session;
// section: end i18n.js