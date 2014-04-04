REPORTER = spec
VERSION = 2.0.1
NEO4JFOLDER = neo4jserver
NEO4JFOLDER_ALT = $(NEO4JFOLDER)_alt

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
	rm -rf $(NEO4JFOLDER) $(NEO4JFOLDER_ALT)
	mkdir $(NEO4JFOLDER) $(NEO4JFOLDER_ALT)
	wget http://dist.neo4j.org/neo4j-community-$(VERSION)-unix.tar.gz
	tar -zxvf neo4j-community-$(VERSION)-unix.tar.gz
	cp -r neo4j-community-$(VERSION)/* $(NEO4JFOLDER)/
	cp -r neo4j-community-$(VERSION)/* $(NEO4JFOLDER_ALT)/
	cd $(NEO4JFOLDER) && ./bin/neo4j start
	cd $(NEO4JFOLDER_ALT) && sed -i 's/org.neo4j.server.webserver.port=7474/org.neo4j.server.webserver.port=7676/g' conf/neo4j-server.properties && sed -i 's/org.neo4j.server.webserver.https.port=7473/org.neo4j.server.webserver.https.port=7673/g' conf/neo4j-server.properties && ./bin/neo4j start
	sleep 3
