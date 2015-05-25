REPORTER = spec

test:
	@NODE_ENV=test node_modules/mocha/bin/mocha --reporter $(REPORTER)

test-coverage:
	@NODE_ENV=test node_modules/mocha/bin/mocha --require blanket -R html-cov > test/coverage.html
	npm run clean

test-clear:
	rm -rf src-cov
	rm -rf _tmp_ignore_files_for_jscoverage

test-coveralls:
	echo TRAVIS_JOB_ID $(TRAVIS_JOB_ID)
	rm -rf src-cov
	jscoverage src src-cov
	cp -r ./_tmp_ignore_files_for_jscoverage src/browser
	cp -r src/browser src-cov/browser
	coffee -mcb test/
	@JSCOV=1 @NODE_ENV=test node_modules/mocha/bin/mocha -R mocha-lcov-reporter | node_modules/coveralls/bin/coveralls.js --verbose src-cov/
	make test-clear
	npm run clear

install-neo4j:
	ruby test/neo4j_instances.rb install

start-neo4j:
	ruby test/neo4j_instances.rb start

stop-neo4j:
	ruby test/neo4j_instances.rb stop