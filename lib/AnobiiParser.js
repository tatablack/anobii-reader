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
        EMPTY_DATE = '(set a date)',
        STATUS_NOT_STARTED = 2,
        STATUS_READING = 3,
        STATUS_UNFINISHED = 4,
        STATUS_ABANDONED = 6,
        CATEGORY_OR_TAG_SEPARATOR = ' ';


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

    var getDateAdded = function(year, month, day) {
        var parsedYear = year === '- -' ? '' : year,
            parsedMonth = month === '- -' ? '01' : month,
            parsedDay = day === '- -' ? '01' : day;

        return (parsedYear === '' ? '' : moment(parsedYear + '-' + parsedMonth + '-' + parsedDay).format('YYYY-MM-DD'));
    };

    var getReadings = function(statusElements, dateElements) {
        var readings = [];

        _.each(statusElements, function(statusElement, loopIndex) {
            readings.push([
                getReadingDate(statusElement, dateElements[loopIndex * 2], 0),
                getReadingDate(statusElement, dateElements[(loopIndex * 2) + 1], 1)
            ])
        });

        return readings;
    };

    var getReadingDate = function(statusElement, dateElement, dateIndex) {
        var status = statusElement.attribs.value,
            date = strip(dateElement.children[0].data);

        if (date === EMPTY_DATE) return '';

        if (status === STATUS_NOT_STARTED) return EMPTY_STRING;
        if (_.contains([STATUS_ABANDONED, STATUS_READING, STATUS_UNFINISHED], status) && dateIndex === 1) return EMPTY_STRING;

        return (date === EMPTY_DATE ? '' : moment(date).format('YYYY-MM-DD'));
    };
    
    var getReadingDateOrig = function(statusElement, dateElement, dateIndex) {
        var status = statusElement[0].attribs.value,
            date = strip(dateElement.eq(dateIndex).text());

        if (date === EMPTY_DATE) return '';

        if (status === STATUS_NOT_STARTED) return EMPTY_STRING;
        if (_.contains([STATUS_ABANDONED, STATUS_READING, STATUS_UNFINISHED], status) && dateIndex === 1) return EMPTY_STRING;

        return (date === EMPTY_DATE ? '' : moment(date).format('YYYY-MM-DD'));
    };
    

    var getISBNFromQuery = function(query) {
        return query.substring(query.lastIndexOf('=') + 1);
    };

    var parseCategoryOrTagName = function(categoryOrTag) {
        return categoryOrTag.replace(' & ', '-and-').replace(', ', '-plus-').replace(' ', '-').toLowerCase();
    };

    var getCategories = function(categories) {
        var reducedCategories = _.reduce(categories, function(memo, category) {
            return memo + parseCategoryOrTagName(category.attribs.name) + CATEGORY_OR_TAG_SEPARATOR;
        }, '');

        return reducedCategories.substring(0, reducedCategories.length - CATEGORY_OR_TAG_SEPARATOR.length);
    };

    var getTags = function(tags) {
        var reducedTags = _.reduce(tags, function(memo, tag) {
            return memo + parseCategoryOrTagName(tag.children[0].data) + CATEGORY_OR_TAG_SEPARATOR;
        }, '');

        return reducedTags.substring(0, reducedTags.length - CATEGORY_OR_TAG_SEPARATOR.length);
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
                publisher: '',
                binding: '',
                year: '',
                originalYear: '',
                categories: getCategories($$$(Selectors.CATEGORIES)),
                tags: getTags($$$(Selectors.TAGS)),
                status: $$$(Selectors.STATUS).text(),
                dateAdded: getDateAdded($$$(Selectors.ADDED_YEAR).text(), $$$(Selectors.ADDED_MONTH).text(), $$$(Selectors.ADDED_DAY).text()),
                readings: getReadings($$$(Selectors.STATUS), $$$(Selectors.READING_DATES)),
                readingStart: getReadingDateOrig($$$(Selectors.STATUS), $$$(Selectors.READING_DATES), 0),
                readingEnd: getReadingDateOrig($$$(Selectors.STATUS), $$$(Selectors.READING_DATES), 1),
                privateNote: $$$(Selectors.PRIVATE_NOTE).val(),
                review: $$$(Selectors.REVIEW).val()
            }
        }
    }
}

module.exports = newAnobiiParser;
