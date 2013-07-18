test:test-run
	npm run clean

test-run:test-build
	mocha

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

installneo4j:
	rm -rf neo4jserver
	mkdir neo4jserver
	cd neo4jserver && wget http://dist.neo4j.org/neo4j-community-2.0.0-M03-unix.tar.gz
	cd neo4jserver && tar -zxvf neo4j-community-2.0.0-M03-unix.tar.gz
	sed -i 's/HEADLESS=false/HEADLESS=true/g' ./neo4jserver/neo4j-community-2.0.0-M03/bin/neo4j
	./neo4jserver/neo4j-community-2.0.0-M03/bin/neo4j -u neo4j install
	service neo4j-service status
	service neo4j-service start
	sleep 3
