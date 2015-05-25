# [Neo4jMapper](http://pstaender.github.io/neo4jmapper)
## Object Modeler for Neo4j Graphdatabases

Written in JavaScript for browser- and serverside usage

[![Build Status](https://api.travis-ci.org/pstaender/neo4jmapper.png)](https://travis-ci.org/pstaender/neo4jmapper)
[![NPM version](https://badge.fury.io/js/neo4jmapper.png)](https://npmjs.org/package/neo4jmapper)

## [Documentation and Examples](http://pstaender.github.io/neo4jmapper)

See [http://pstaender.github.io/neo4jmapper](http://pstaender.github.io/neo4jmapper) for Documentation and Examples

## Installation

```sh
  $ npm install neo4jmapper
```

## Tests

```sh
  $ npm install
  $ npm test
```

Beware that a lot of nodes will be written and kept in your database, so avoid running any of these tests + examples on productive instances.

## Using Neo4jMapper in a browser

Since the maintenance for browser- and server-side is too much, the browser support is stopped for now. However Neo4jMapper should still be working in the browser.

## Scripts

  * `$ npm run doc`: Creates a source code documentation (with docco) in `docs/`
  * `$ make test-coverage`: Creates a code coverage report in `coverage/`
  * `$ npm run apidocs`: Creates a rudimentary api doc `apidocs/`

## TODO

  * implement: index relationship
  * implement: stream feature for browser-side-usage
  * move from restful api to cypher queries if possible (to reduce api dependencies)
  * complete documentation
  * cleanup redundant tests
  * dox (markdown and jsdoc flavoured) sourcecode documentation
  * use parameter-values by default for all statement segments that are generated

### Tested against:

* Neo4j v2 - v2.1
* Node 0.10 - 0.12 [see Travis CI](https://travis-ci.org/pstaender/neo4jmapper)

## LICENSE

© 2015 by Philipp Staender under the GNU General Public License
See in `LICENSE` file for further details.
