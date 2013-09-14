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
        console.log('[Main] Let\'s try to log ' + nconf.get('credentials:username') + ' in.');
        request.post(requestData, this);
    },


    // If the login was successful, our request object will now
    // have all the cookies we need, so we can proceed to the home page.
    // Otherwise, the error thrown should point us to the problem.
    function checkLoginDataAndLoadHomepage(err, response) {
        if (err) throw err;

        var location = response.headers.location;

        if (location !== '/home') {
            // EmptyEmail, EmptyPassword, InvalidEmail, FailLogin
            throw ("[Main] Login failed. Reported cause: " + location.substring(location.lastIndexOf('=') + 1));
        } else {
            console.log('[Main] Login successful. Now, let\'s load the home page.');
            
            _.extend(requestData, nconf.get('requestConfig'));
            requestData.url = nconf.get('urls:base') + location;
            request.get(requestData, this);
        }
    },

    // Load the shelf by parsing the home page for the shelf's URL
    function loadShelf(err, response) {
        if (err) throw err;

        requestData.url = nconf.get('urls:base') + anobiiParser.getShelfURL(response.body);

        console.log('[Main] Home page loaded. Let\'s head for the shelf.');
        request.get(requestData, this);
    },

    // Load the shelf page by page,
    // after getting the current user's ID
    function loadPaginatedShelf(err, response) {
        if (err) throw err;

        var personId = anobiiParser.getPersonId(response.body),
            lastPage = anobiiParser.getLastPage(response.body);

        console.log('[Main] Shelf loaded. Now, we browse it page by page.');
 
        _.each(_.range(1, +lastPage + 1), function(currentPage) {
            try {
                console.log('[Main] ...page ' + currentPage);
                requestData.url = nconf.get('urls:base') + nconf.get('urls:shelf').replace('%PERSON_ID%', personId).replace('%PAGE%', currentPage);
                request.get(requestData, this.parallel());                
            } catch(err) {
                throw err;
            }
        }, this);
    },


    // Loop over all books in the shelf
    function browseShelf() {
        var err = [].shift.apply(arguments);
        if (err) throw err;

        _.each(arguments, function(response, loopIndex) {
            var booksUrls = anobiiParser.getBooksUrls(response.body),
                bookISBNs = anobiiParser.getBooksISBNs(response.body);
    
            if (booksUrls.length === 0) {
                console.log('\n[Main] No books found on page ' + (loopIndex + 1) + '.');
            } else {
                console.log('\n[Main] About to retrieve information about ' + booksUrls.length + ' books (page ' + (loopIndex + 1) + '). This may take a while.');
            }
    
            _.each(booksUrls, function loadBook(bookUrl, loopIndex) {
                requestData.url = nconf.get('urls:base') + nconf.get('urls:edit') + bookUrl.attribs.rel + '&isbn=' + bookISBNs[loopIndex];
                console.log('[Main] Retrieving book ' + (loopIndex + 1) + ' from ' + requestData.url);
                request.get(requestData, this.parallel());
            }, this);            
        }, this);
        
        console.log('\n[Main] All book information retrieved. Wait a bit while I crunch it...');
        console.time('[Main] Crunching took');
    },


    // For each book loaded, extract
    // all kinds of information about it
    function saveBookDetails() {
        var err = [].shift.apply(arguments);
        if (err) throw err;

        console.timeEnd('[Main] Crunching took');
        console.log('\n[Main] About to save information about each of the ' + arguments.length + ' books.');

        _.each(arguments, function(response) {
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

        console.log('[Main] Data saved. About to export it to GoodReads\'s CSV format.');

        storage.exportForGoodReads();

        return true;
    },


    function done(err) {
        if (err) throw err;
        console.log('\n[Main] All done. Data can be found in:\n' +
            '[Main] ' + nconf.get('output:csvPath') + ' (GoodReads CSV), or\n' + 
            '[Main] ' + nconf.get('output:dbPath') + ' (JSON format)');
    }
);
