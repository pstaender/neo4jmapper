# [Neo4jMapper](http://pstaender.github.io/neo4jmapper)
## Object Modeler for Neo4j Graphdatabases

Written in JavaScript for browser- and serverside usage

[![Build Status](https://api.travis-ci.org/pstaender/neo4jmapper.png)](https://travis-ci.org/pstaender/neo4jmapper)
[![NPM version](https://badge.fury.io/js/neo4jmapper.png)](https://npmjs.org/package/neo4jmapper)

## [Documentation and Examples](http://pstaender.github.io/neo4jmapper)

See [http://pstaender.github.io/neo4jmapper](http://pstaender.github.io/neo4jmapper) for Documentation and Examples

Try Neo4jMapper against a neo4j-demo-instance via a [coffeesript-console](http://pstaender.github.io/neo4jmapper/examples/browser/console/console.html#http://zeitpulse.com:7480)

## Installation

```sh
  $ npm install neo4jmapper
```

## Tests

```sh
  $ npm test
```

Beware that a lot of nodes will be written and kept in your database, so avoid running any of these tests + examples on productive instances.

## Usage and Testing in Browser

Neo4jMapper is available in modern Browsers (except the streaming feature), but still experimental.
`npm run compress` will generate a browser-compatible js file. Checkout the tests in the browser by running `npm run prepare` and finally open the testfile `examples/browser/tests.html`. To avoid `access-control-allow-origin` situation ensure that there is no domain mismatch between html file and requested database.

## TODO

  * implement: index relationship
  * implement: stream feature for browser-side-usage
  * move from restful api to cypher queries if possible (to reduce api dependencies)
  * complete documentation
  * cleanup redundant tests
  * dox (markdown and jsdoc flavoured) sourcecode documentation
  * use parameter-values by default for all statement segments that are generated

### Tested against:

* Neo4j v2
* Node 0.8 - 0.11 [see Travis CI](https://travis-ci.org/pstaender/neo4jmapper)
* Chrome (v22+) and Safari (v7+)

## LICENSE

© 2013 by Philipp Staender under the GNU General Public License
See in `LICENSE` file for further details.
