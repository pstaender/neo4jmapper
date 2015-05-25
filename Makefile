.PHONY: test
REPORTER = spec

test:
	@NODE_ENV=test node_modules/mocha/bin/mocha --reporter $(REPORTER)

test-coverage:
	@NODE_ENV=test node_modules/istanbul/lib/cli.js cover _mocha -- -R $(REPORTER)

install-neo4j:
	ruby test/neo4j_instances.rb install

start-neo4j:
	ruby test/neo4j_instances.rb start

stop-neo4j:
	ruby test/neo4j_instances.rb stop