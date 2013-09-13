/*
 * Requiring dependencies
 */
var cheerio = require('cheerio'),
    _ = require('lodash'),
    moment = require('moment'),
    Selectors = require('./AnobiiSelectors');

function newAnobiiParser() {
    var PATTERN_WHITESPACE = /(^\s*)|(\s*$)/g,
        EMPTY_STRING = '',
        CATEGORY_SEPARATOR = '|'


    var $ = function(body) {
        return cheerio.load(body, {
            ignoreWhitespace: true
        });
    };

    var $$ = function(body, selector) {
        return $(body)(selector);
    };

    var strip = function(text) {
        return text.replace(PATTERN_WHITESPACE, EMPTY_STRING);
    };

    var getReadingDate = function(statusElement, dateElement, dateIndex) {
        var status = statusElement[0].attribs.value;

        if (status === '2') return EMPTY_STRING;
        if (_.contains(['3', '4', '5'], status) && dateIndex === 2) return EMPTY_STRING;
        if (_.contains(['3', '4', '5'], status)) return strip(dateElement.eq(dateIndex).text());

        return moment(strip(dateElement.eq(dateIndex).text())).format('YYYY-MM-DD');
    };

    var getISBNFromQuery = function(query) {
        return query.substring(query.lastIndexOf('=') + 1);
    };

    var getCategories = function(categories) {
        var reducedCategories = _.reduce(categories, function(memo, category) {
            return memo + category.attribs.name + CATEGORY_SEPARATOR;
        }, '');

        return reducedCategories.substring(0, reducedCategories.length - CATEGORY_SEPARATOR.length);
    };

    return {
        getBooksUrls: function(shelfBody) {
            return $$(shelfBody, Selectors.BOOKS_URLS);
        },

        getBooksISBNs: function(shelfBody) {
            return _.map($$(shelfBody, Selectors.BOOKS_ISBNS), function getBookISBN(bookTitleUrl) {
                var segments = bookTitleUrl.attribs.href.split('/');
                return segments.length == 6 ? segments[3] : '';
            });
        },

        getBook: function(bookBody, query) {
            var $$$ = $(bookBody);

            return {
                id: $$$('#itemIdEdit')[0].attribs.value,
                title: strip($$$(Selectors.TITLE).text()),
                author: '',
                isbn: getISBNFromQuery(query),
                rating: $$$(Selectors.STARS).length,
                averageRating: '',
                publisher: '',
                binding: '',
                year: '',
                originalYear: '',
                categories: getCategories($$$(Selectors.CATEGORIES)),
                status: $$$(Selectors.STATUS).text(),
                readingStart: getReadingDate($$$(Selectors.STATUS), $$$(Selectors.READING_DATES), 0),
                readingEnd: getReadingDate($$$(Selectors.STATUS), $$$(Selectors.READING_DATES), 1)
            }
        }
    }
}

module.exports = newAnobiiParser;