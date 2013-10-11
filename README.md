# [Neo4jMapper](http://pstaender.github.io/neo4jmapper)
## Object Modeler for Neo4j Graphdatabases

Written in JavaScript for browser- and serverside usage

[![Build Status](https://api.travis-ci.org/pstaender/neo4jmapper.png)](https://travis-ci.org/pstaender/neo4jmapper)
[![NPM version](https://badge.fury.io/js/neo4jmapper.png)](https://npmjs.org/package/neo4jmapper)

## [Documentation and Examples](http://pstaender.github.io/neo4jmapper)

See [http://pstaender.github.io/neo4jmapper](http://pstaender.github.io/neo4jmapper)

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

You'll find a ready-to-use-console in `examples/browser/console/console.html`. To use it with your local database you gave to ensure that you access the page from the same domain as your database to avoid `access-control-allow-origin` situation.

## API Changes

### v1.0beta to v1.0

Regulary no API changes in a beta; but neo4jmapper is still in an early development stage, so some cleanup is needed before the final v1.0 will be released:

  * **Renamed**: `node.removeWithRelationships` is now correctly called `node.removeIncludingRelationships`
  * **Renamed**: *all* static methods have now underscore names (only Node.find… have both)
    * Node.ensureIndex -> Node.ensure_index
    * Node.dropIndex  -> Node.drop_index
    * Node.dropEntireIndex -> Node.drop_entire_index
    * Node.getIndex -> Node.get_index
  * **Removed**: `Node.findByUniqueKeyValue`, use `Node.findByKeyValue` or `Node.findOneByKeyValue` instead
  * **Removed**: `Node.find().andWhere()`, use `Node.find().where()` instead and combine your conditions with an `$and` operator if needed
  * **Removed**: `Graph.start().addValue` removed, use `Graph.start().addParameters()` or `Graph.start().addParameter()` instead
  * **Renamed**: methods containing `…Relationships` naming will now be shorter called `…Relations`, e.g.: withRelations, incomingRelations, outgoingRelations ()

## TODO

There are some steps to take, especially some methods for daily use are missing, yet. But the basic set of operations are already implemented and tested.

  * implement: relationship (index)
  * implement: stream feature for browser-side-usage
  * statement handling, with rollback support
  * documentation (description for methods)
  * cleanup tests (remove "duplicates")
  * Node. methods should use Graph. methods inside (currently there are implemented native calls mostly in Node)

### So far tested against:

* Neo4j v2 Milestone 5
* Node 0.8 - 0.11
* Chrome (v22+) ( but Safari and Firefox should work as well)

## LICENSE

© 2013 by Philipp Staender under the GNU General Public License
See in `LICENSE` file for further details.