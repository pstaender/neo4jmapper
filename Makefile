REPORTER = spec
VERSION = 2.0.0-M05
NEO4JFOLDER = neo4jserver

test:test-build
	@NODE_ENV=test mocha --reporter $(REPORTER)

test-complete:test-run
	npm run clean

test-build:
	coffee -mc test/

browser-build:test-build
	npm run clean
	cake clientsidejs:build

browser-build-watch:
	nodemon -e coffee --exec 'make browser-build'

test-coverage:test-build
	@NODE_ENV=test mocha --require blanket -R html-cov > test/coverage.html
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
	@JSCOV=1 @NODE_ENV=test mocha -R mocha-lcov-reporter | ./node_modules/coveralls/bin/coveralls.js --verbose src-cov/
	make test-clear
	npm run clear

installneo4j:
	rm -rf $(NEO4JFOLDER)
	mkdir $(NEO4JFOLDER)
	cd $(NEO4JFOLDER) && wget http://dist.neo4j.org/neo4j-community-$(VERSION)-unix.tar.gz
	cd $(NEO4JFOLDER) && tar -zxvf neo4j-community-$(VERSION)-unix.tar.gz
	sed -i 's/HEADLESS=false/HEADLESS=true/g' ./$(NEO4JFOLDER)/neo4j-community-$(VERSION)/bin/neo4j
	./$(NEO4JFOLDER)/neo4j-community-$(VERSION)/bin/neo4j -u neo4j install
	service neo4j-service start
	sleep 3
