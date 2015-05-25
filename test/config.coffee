module.exports = {
  doLog: false # require('./log')
  wipeDatabase: false # be careful, it does what it says ;)
  neo4jURL: 'http://localhost:7000/'
  neo4jURL2: 'http://localhost:7002/'
  # is needed for jscoverage to distinct between src and src-cov
  srcFolder: if process.env.JSCOV then 'src-cov' else 'src'
}
