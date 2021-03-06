var AnobiiSelectors = {
    SHELF: '#tab_B a',
    PERSON: '#search_subscriber_id',
    LAST_PAGE: '.pagination_wrap a[class!="next"]',
    BOOKS_URLS: '.editreview',
    BOOKS_ISBNS: '.simple_list_view_container td.title a',
    TITLE: '#bookTitle',
    STARS: '.rate_book_1.selected',
    CATEGORIES: '.categoryMy',
    TAGS: '#tagsApplied strong',
    STATUS: 'select.progress option:selected',
    ADDED_YEAR: '.gotthison_year option:selected',
    ADDED_MONTH: '.gotthison_month option:selected',
    ADDED_DAY: '.gotthison_day option:selected',
    READING_DATES: '.startDate dd a.datePickerText',
    REVIEW: '#reviewBox',
    PRIVATE_NOTE: '#privateNote'
};

module.exports = AnobiiSelectors;
