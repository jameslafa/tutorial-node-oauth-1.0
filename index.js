// Include required modules
require('js-yaml');
var OAuth = require('oauth').OAuth
  , express = require('express')

  , app = express()
  , PORT
  , config;

try {
  config = require('./config.yaml');
} catch (e) {
  console.log('Invalid config file. Did you copy config.yaml.sample to config.yaml?');
  process.exit(1);
}

PORT = process.env.PORT || config.PORT || 3000;

app.use(express.cookieParser());
app.use(express.session({secret: config.SECRET}));

var callback_path = "/auth/twitter/callback";

// Configure the OAuth access to twitter
var oa = new OAuth(
  "https://api.twitter.com/oauth/request_token", // Url to get request_token on twitter
  "https://api.twitter.com/oauth/access_token", // Url to get access_token on twitter
  config.OAUTH_KEY,
  config.OAUTH_SECRET,
  "1.0", // the OAuth protocol version used
  config.HOST + ':' + PORT + callback_path, // Callback url
  "HMAC-SHA1"
);

// Define each rules of every url we have to handle :
// 1 - / (application root) when the user comes first
// 2 - /auth/twitter when the user ask to login on our application via twitter
// 3 - /auth/twitter/callback when the user is redirect from Twitter to our application

// Create the rule for the application root
app.get('/', function(req, res){
  // Check is the user is already logged in or not 
  // If not invite him to go on page /auth/twitter to start the login process
  if (typeof req.session.oauth == "undefined" || null == req.session.oauth){
    return res.send("Welcome guest. <br/>Please click <a href='/auth/twitter'>here</a> to login on Twitter.");
  }
  // If the user has already logged in, display his name
  res.send("Welcome " + req.session.user_infos.screen_name);
});

// Create the rule to start the login process on Twitter
app.get('/auth/twitter', function(req, res){
  console.log('Getting step1');
  // First, request a Token user the OAuth object created with oauth module
  oa.getOAuthRequestToken(function(error, oauth_token, oauth_token_secret, results){
    // If error is not false, log an error
    if (error) {
      console.log("An error happened on getOAuthRequestToken : ");
      console.log(error);
      res.send("There was an error trying to request a token on Twitter");
    }
    else {
      console.log('got step1');
      // Store the token in the session
      req.session.oauth = {};
      req.session.oauth.token = oauth_token;
      req.session.oauth.token_secret = oauth_token_secret;

      // Redirect to twitter so they can login
      res.redirect('https://twitter.com/oauth/authenticate?oauth_token='+oauth_token);
    }
  });
});

// Redirected to from twitter after they logged in
function twitter_callback(req, res, next){
  if (!req.session.oauth) {
    console.log('not yet initialized');
    // A session has not been initialized yet. The user shouldn't be here.
    // 1 - Destroy the session
    // 2 - Redirect him on the authentication page
    req.session.destroy();
    return res.redirect('/');
  }
  console.log('Finished oauth');
  var oauth = req.session.oauth;
  oauth.verifier = req.query.oauth_verifier;

  // The user is verified. Now we can ask for an access token
  oa.getOAuthAccessToken(oauth.token, oauth.token_secret, oauth.verifier, 
    function(error, access_token, access_token_secret, results){
      if (error){
	// Error while getting the Access Token. Let's destroy the session and restart from beginning
	console.log("Error while getting the Access Token");
	// Destroy the session (delete the cookie on user browser)
	req.session.destroy();
	// Redirect the user on /auth/twitter to restart the login process from the beginning
	return res.redirect('/auth/twitter');
      }
      // Store the access token in the session
      req.session.oauth.access_token = access_token;
      req.session.oauth.access_token_secret = access_token_secret;

      req.session.user_infos = {
        user_id: results.user_id,
        screen_name: results.screen_name
      };

      // We're done!
      res.redirect('/');
    }
  );
} 

app.get(callback_path, twitter_callback);

app.listen(PORT);
console.log("Server started, go on " + config.HOST + ":" + PORT + " in your browser");
