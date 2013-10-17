# [Neo4jMapper](http://pstaender.github.io/neo4jmapper)
## Object Modeler for Neo4j Graphdatabases

Written in JavaScript for browser- and serverside usage

[![Build Status](https://api.travis-ci.org/pstaender/neo4jmapper.png)](https://travis-ci.org/pstaender/neo4jmapper)
[![NPM version](https://badge.fury.io/js/neo4jmapper.png)](https://npmjs.org/package/neo4jmapper)

## [Documentation and Examples](http://pstaender.github.io/neo4jmapper)

See [http://pstaender.github.io/neo4jmapper](http://pstaender.github.io/neo4jmapper) for Documentation and Examples

Give Neo4jMapper a try in the [coffeesript-testing-console](http://pstaender.github.io/neo4jmapper/examples/browser/console/console.html)

## Installation

```sh
  $ npm install neo4jmapper
```

## Tests

```sh
  $ npm test
```

Beware that a lot of nodes will be written and kept in your database.

## Usage and Testing in Browser

All features of the library are available in modern Browsers (except streaming support). To give it a try execute `npm run compress`, that will generate all needed js files. If you want to run the tests in the browser as well, use `npm run prepare` to let all test file be generated.

You'll find a ready-to-use-console in `examples/browser/console/console.html`. To use it with your local database ensure  that you access the page from the same domain as your database to avoid `access-control-allow-origin` situation.

## TODO

There are some steps to take, especially some methods for daily use are missing, yet. But the basic set of operations are already implemented and tested.

  * implement: relationship (index)
  * implement: stream feature for browser-side-usage
  * statement handling, with rollback support
  * documentation (description for methods)
  * cleanup tests (remove "duplicates")

### So far tested against:

* Neo4j v2 Milestone 6
* Node 0.8 - 0.11 [see Travis](https://travis-ci.org/pstaender/neo4jmapper)
* Chrome (v22+) and Safari (v7+)

## LICENSE

© 2013 by Philipp Staender under the GNU General Public License
See in `LICENSE` file for further details.