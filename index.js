// Include required modules
var OAuth = require('oauth').OAuth; // To use OAuth (authentication on Twitter)
var Express = require('express'); // To handle http request, routing, etc.

// Set twitter access params
var consumer_key = "azodpjapzodjazpodj"; // Replace by the consumer key given by Twitter in http://developer.twitter.com
var consumer_secret = "azpdojpaojzdpajzdpojaopzdjpajzdpaopzjd"; // Replace by the consumer secret given by Twitter in http://developer.twitter.com

// Configure application params
var application_host = "http://127.0.0.1:3000"; // Url to access to your application
var application_twitter_callback_path = "/auth/twitter/callback"; // Path to the callback page : where the user is redirected after he logged in on Twitter

// Configure the OAuth access to twitter
var oa = new OAuth(
	"https://api.twitter.com/oauth/request_token", // Url to get request_token on twitter
	"https://api.twitter.com/oauth/access_token", // Url to get access_token on twitter
	consumer_key,
	consumer_secret,
	"1.0", // the OAuth protocol version used. Currently (february 2012), Twitter only support version 1.0
	application_host + application_twitter_callback_path, // Callback url
	"HMAC-SHA1"
);

// Create a new server with Express
var app = Express.createServer();

// Use cookieParser middleware needed for sessions. This middleware give Express the capacity to read/write cookies
app.use(Express.cookieParser());
// Use session middleware to handle user sessions
app.use(Express.session({secret:'Tuto-OAuth-Node secret phrase'})); // Set a ramdom key for security matters

// Define each rules of every url we have to handle :
// 1 - / (application root) when the user comes first
// 2 - /auth/twitter when the user ask to login on our application via twitter
// 3 - /auth/twitter/callback when the user is redirect from Twitter to our application

// Create the rule for the application root
app.get('/', function(request, response){
	// Body contains the html source (only the body part) to display on the user page
	// Later we'll use a template engine, but for this exercise it is not necessary
	var body = "";

	// Check is the user is already logged in or not 
	// If not invite him to go on page /auth/twitter to start the login process
	if (typeof request.session.oauth == "undefined" || null == request.session.oauth){
		body = "Welcome guest. <br/>Please click <a href='/auth/twitter'>here</a> to login on Twitter.";
	}
	// If the user has already logged in, display his name
	else {
		body = "Welcome " + request.session.user_infos.screen_name;
	}
	// Send the response to display your message on the user browser
	response.send(body);
});

// Create the rule to start the login process on Twitter
app.get('/auth/twitter', function(request, response){
	// First, request a Token user the OAuth object created with oauth module
	oa.getOAuthRequestToken(function(error, oauth_token, oauth_token_secret, results){
		// If error is not false, log an error
		if (error) {
			console.log("An error happened on getOAuthRequestToken : ");
			console.log(error);
			response.send("There was an error trying to request a token on Twitter");
		}
		else {			
			// A token has been returned. Let's store it in the session
			request.session.oauth = {};
			request.session.oauth.token = oauth_token;
			request.session.oauth.token_secret = oauth_token_secret;

			// Now let's redirect the user on Twitter to ask him to log in and give autorization to our application
			response.redirect('https://twitter.com/oauth/authenticate?oauth_token='+oauth_token);
		}
	});
});

// The user did login on Twitter and accept our application. Then Twitter redirect our user on our application on that path
app.get(application_twitter_callback_path, function(request, response, next){
	// Check that a session has been already initialized (on /auth/twitter page)
	// This is to avoid a user coming directly on this url without being redirected by Twitter
	if (request.session.oauth) {
		var oauth = request.session.oauth;
		// The oauth_verifier is sent by Twitter as a parameter on our callback url ?oauth_verifier=XXX
		// Extract this oauth_verifier from the url, it will be needed to request an access token
		oauth.verifier = request.query.oauth_verifier;
		
		// The user is verified. Now we can ask for an access token
		oa.getOAuthAccessToken(oauth.token,oauth.token_secret,oauth.verifier, 
		function(error, oauth_access_token, oauth_access_token_secret, results){
			if (error){
				// Error while getting the Access Token. Let's destroy the session and restart from beginning
				console.log("Error while getting the Access Token");
				// Destroy the session (delete the cookie on user browser)
				request.session.destroy();
				// Redirect the user on /auth/twitter to restart the login process from the beginning
				response.redirect('/auth/twitter');
			} else {
				// There is not any error, let's save our access token in the session to reuse it in our next request
				// Store the access token in the session
				request.session.oauth.access_token = oauth_access_token;
				request.session.oauth.access_token_secret = oauth_access_token_secret;

				// With the access token, Twitter sent a few informations about the user, let's store it, it may be usefull
				request.session.user_infos = {};
				request.session.user_infos.user_id = results.user_id;
				request.session.user_infos.screen_name = results.screen_name;

				// Congratulation, the login process is done !
				// 1 - The user gave autorizations to our application to make request on Twitter
				// 2 - The user is not identified via is Twitter user_id.

				// Redirect him to the home page and next time start to build a cool app with Twitter informations !!
				response.redirect('/');
			}
		}
		);
	} 
	else{
		// A session has not been initialized yet. The user shouldn't be here.
		// 1 - Destroy the session
		// 2 - Redirect him on the authentication page
		request.session.destroy();
		response.redirect('/');
	}
		
});

// Start the server and listen port 3000
app.listen(3000);
console.log("Server started, go on http://127.0.0.1:3000 in your browser");