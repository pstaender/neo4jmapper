module.exports = exports = {
  doLog: false#require('./log')
  wipeDatabase: false # be careful, it does what it says ;)
  neo4jURL: 'http://localhost:7474/'
  # is needed for jscoverage to distinct between src and src-cov
  srcFolder: if process.env.JSCOV then 'src-cov' else 'src'
}
