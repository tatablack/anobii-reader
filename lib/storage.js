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

    var toGoodReadsRecord = function(anobiiRecord) {
        // Title, Author, ISBN, My Rating, Average Rating, Publisher, Binding, Year Published, Original Publication Year, Date Read, Date Added, Bookshelves, My Review
        return {
            title: '',
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
            bookshelves: anobiiRecord.categories + (anobiiRecord.tags.length > 0 ? (anobiiRecord.categories.length > 0 ? ' ' : '') + anobiiRecord.tags : ''),
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
            var csv = fs.createWriteStream(destinationCsv, { encoding: 'utf8'});

            csv.write(csvHeaders + '\n');

            db.forEach(function(key, value) {
                var row = '',
                    anobiiRecord = value;

                if (anobiiRecord.isbn != '') {
                    var goodReadsRecord = toGoodReadsRecord(anobiiRecord);

                    _.each(goodReadsRecord, function(value, key) {
                        row += value + ','
                    });

                    csv.write(row.slice(0, --row.length) + '\n');
                }
            });

            csv.end();
        }
    }
}

module.exports = storage;
