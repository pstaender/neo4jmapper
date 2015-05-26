.PHONY: test
REPORTER = spec

test:
	mocha

test-coverage:
	@NODE_ENV=test node_modules/istanbul/lib/cli.js cover _mocha -- -R $(REPORTER)
