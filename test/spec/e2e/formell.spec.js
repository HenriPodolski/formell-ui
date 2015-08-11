var assert = require('assert');
var testDoc = 'file:///'+ __dirname +'/../helpers/html/test.html';

describe('grunt-webdriverjs test', function () {

	it('checks if title contains the search query', function(done) {

		browser
			.url(testDoc)
			.getTitle(function(err,title) {
				assert.strictEqual(title,'Document');
			})
			.call(done);
	});

});