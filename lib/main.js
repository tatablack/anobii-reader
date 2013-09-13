// Dependencies
var nconf = require('nconf'),
    request = require('request').defaults({jar: true}),
    _ = require('lodash'),
    Step = require('step'),
    fs = require('fs'),
    newAnobiiParser = require('./AnobiiParser'),
    newStorage = require('./storage.js');


// Initializing configuration
nconf.argv().file({ file: 'config.json' });


// Global instances
var anobiiParser = newAnobiiParser(),
    storage = newStorage(
        nconf.get('output:dbPath'),
        nconf.get('output:csvPath'),
        nconf.get('defaults:csvHeaders'),
        false
    ),

    requestData = {
        url: nconf.get('urls:login'),
        form: {
            useFBName: true,
            FBConnect: false,
            personEmail: nconf.get('credentials:username') || '',
            personPassword: nconf.get('credentials:password') || ''
        }
    };

// Let's roll
Step(
    // Login to Anobii
    function login() {
        request.post(requestData, this);
    },


    // If the login was successful, our request object will now
    // have all the cookies we need. Otherwise, the error
    // thrown should point us to the problem.
    function checkLoginData(err, response, body) {
        if (err) throw err;

        var location = response.headers.location;

        if (location !== '/home') {
            // EmptyEmail, EmptyPassword, InvalidEmail, FailLogin
            throw ("Login failed. Reported cause: " + location.substring(location.lastIndexOf('=') + 1));
        } else {
            return true;
        }
    },


    // Load the shelf
    function loadShelf(err) {
        if (err) throw err;

        _.extend(requestData, nconf.get('requestConfig'));
        requestData.url = nconf.get('urls:base') + nconf.get('urls:shelf').replace('%PAGE%', '2');
        request.get(requestData, this);
    },


    // Loop over all books in the shelf
    function browseShelf(err, response, body) {
        if (err) throw err;

        var booksUrls = anobiiParser.getBooksUrls(body),
            bookISBNs = anobiiParser.getBooksISBNs(body);

        console.log('[Main] About to retrieve information about ' + booksUrls.length + ' books. This may take a while.');

        _.each(booksUrls, function loadBook(bookUrl, loopIndex) {
            requestData.url = nconf.get('urls:base') + nconf.get('urls:edit') + bookUrl.attribs.rel + '&isbn=' + bookISBNs[loopIndex];
            console.log('[Main] Retrieving book ' + (loopIndex + 1) + ' from ' + requestData.url);
            request.get(requestData, this.parallel());

            if (loopIndex === 4) return false;
        }, this);
    },

    // For each book loaded, extract
    // all kinds of information about it
    function saveBookDetails() {
        var err = [].shift.apply(arguments);

        if (err) throw err;

        console.log('[Main] About to parse and save information about each of the ' + arguments.length + ' books. This, too, may take a while.');

        _.each(arguments, function(response, loopIndex) {
            try {
                var book = anobiiParser.getBook(response.body, response.request.uri.query);
                storage.saveAsJSON(book.id, book, this.parallel());
            } catch (err) {
                throw err;
            }
        }, this);
    },

    function exportForGoodReads(err) {
        if (err) throw err;

        storage.exportForGoodReads();

        return true;
    },

    function done(err) {
        if (err) throw err;
        console.log('[Main] All done. Saved information can be found in ' + nconf.get('output:csvPath'));
    }
);
