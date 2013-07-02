test:test-build
	mocha
	npm run clean

test-build:
	coffee -mcb test/

browser-build:test-build
	npm run clean
	cake clientsidejs:build

browser-build-watch:
	nodemon -e coffee --exec 'make browser-build'


test-coverage:test-build
	mocha --require blanket -R html-cov > test/coverage.html
	npm run clean

test-clear:
	rm -rf src-cov
	rm -rf _tmp_ignore_files_for_jscoverage

test-coveralls:test-build
	echo TRAVIS_JOB_ID $(TRAVIS_JOB_ID)
	rm -rf src-cov
	mv src/browser ./_tmp_ignore_files_for_jscoverage
	jscoverage src src-cov
	cp -r ./_tmp_ignore_files_for_jscoverage src/browser
	cp -r src/browser src-cov/browser
	coffee -mcb test/
	@JSCOV=1 mocha -R mocha-lcov-reporter | ./node_modules/coveralls/bin/coveralls.js --verbose src-cov/
	make test-clear
	npm run clear

travis:
	npm run preinstall
	make test