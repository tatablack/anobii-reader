var fs = require('fs'),
    _ = require('lodash');

var storage = function(destinationJSON, destinationCsv, csvHeaders, verbose) {
    // Delete the DB if it's already there
    if (fs.existsSync(destinationJSON)) {
        fs.unlinkSync(destinationJSON);
    }

    // Create a new DB
    var db = require('dirty')(destinationJSON);

    db.on('load', function(err) {
        if (err) throw err;
        if (verbose) console.log("[Storage] DB opened");
    });

    db.on('drain', function (err) {
        if (err) throw err;
        if (verbose) console.log("[Storage] DB saved");
    });

    var getBookshelves = function(anobiiRecord) {
        var tags = (anobiiRecord.tags.length > 0 ? (anobiiRecord.categories.length > 0 ? ' ' : '') + anobiiRecord.tags : ''),
            status = (anobiiRecord.status === 'Finished' ? 'read' :
                     (anobiiRecord.status === 'Reading'  ? 'currently-reading' :
                                                           'to-read')),
            bookshelves = anobiiRecord.categories + tags;
        
        return (bookshelves.length === 0 ? status : bookshelves + ' ' + status).trim();
    };
    
    var toGoodReadsRecord = function(anobiiRecord) {
        // Title, Author, ISBN, My Rating, Average Rating, Publisher, Binding, Year Published, Original Publication Year, Date Read, Date Added, Bookshelves, My Review
        return {
            title: '"' + anobiiRecord.title + '"',
            author: '',
            isbn: anobiiRecord.isbn,
            rating: anobiiRecord.rating === 0 ? '' : anobiiRecord.rating,
            averageRating: '',
            publisher: '',
            binding: '',
            publicationYear: '',
            originalPublicationYear: '',
            dateRead: anobiiRecord.readingEnd,
            dateAdded: anobiiRecord.dateAdded,
            bookshelves: getBookshelves(anobiiRecord),
            review: anobiiRecord.review
        }
    }

    return {
        saveAsJSON: function(key, value, callback) {
            if (verbose) console.log("[Storage] Record with key " + key + " saved");
            db.set(key, value, callback);
        },


        exportForGoodReads: function() {
            // Get a reference to the CSV output file
            var missingISBNs = 0,
                csv = fs.createWriteStream(destinationCsv, { encoding: 'utf8'});

            csv.write(csvHeaders + '\n');

            db.forEach(function(key, value) {
                var row = '',
                    anobiiRecord = value;

                if (anobiiRecord.isbn !== '') {
                    var goodReadsRecord = toGoodReadsRecord(anobiiRecord);

                    _.each(goodReadsRecord, function(value) {
                        row += value + ','
                    });

                    csv.write(row.slice(0, --row.length) + '\n');
                } else {
                    missingISBNs++;
                }
            });

            if (missingISBNs === 0) {
                console.log('[Storage] All books had an ISBN and were exported correctly.');
            } else {
                console.log('[Storage] ' + missingISBNs + ' books did not have an ISBN and were not exported.');                
            }
            
            csv.end();
        }
    }
}

module.exports = storage;
