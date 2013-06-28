test:test-build
	mocha
	npm run clean

test-build:
	coffee -mcb test/

test-coverage:test-build
	mocha --require blanket -R html-cov > test/coverage.html
	npm run clean

test-coveralls:test-build
	echo TRAVIS_JOB_ID $(TRAVIS_JOB_ID)
	rm -rf src-cov
	jscoverage --exclude=browser/browser_header.js --exclude=browser/browser_footer.js src src-cov
	cp -r src/browser src-cov/browser
	coffee -mcb test/
	@JSCOV=1 mocha -R mocha-lcov-reporter | ./node_modules/coveralls/bin/coveralls.js --verbose src-cov/
	rm -rf src-cov
	npm run clear