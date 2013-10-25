fs = require('fs')
{spawn, exec} = require 'child_process'

runCommand = (name, args) ->
  proc =           spawn name, args
  proc.stderr.on   'data', (buffer) -> console.log buffer.toString()
  proc.stdout.on   'data', (buffer) -> console.log buffer.toString()
  proc.on          'exit', (status) -> process.exit(1) if status != 0

task 'clientsidejs:build', ->
  outputPath = __dirname+"/examples/browser/neo4jmapper_complete.js"
  files = """
    src/browser/browser_header.js
    src/index.js
    src/lib/sequence.js
    src/lib/md5.js
    src/helpers.js
    src/conditionalparameters.js
    src/cypherquery.js
    src/neo4jrestful.js
    src/node.js
    src/path.js
    src/relationship.js
    src/transaction.js
    src/graph.js
    src/browser/browser_footer.js
  """
  data = ""
  for file in files.split('\n')
    path = __dirname+"/"+file
    code = ''
    code += """
    \n/*
     * include file: '#{file}'
     */\n
     """
    code += fs.readFileSync(path)
    lines = for line in code.split('\n')
      '  ' + line
    data += lines.join('\n')


  # wrap with a closure
  data = """
  ;(function(){
  #{data}
  })();
  """

  fs.writeFileSync(outputPath, data)
  console.log("Written to file '#{outputPath}'")

  exec 'coffee -cb -o examples/browser/ test/test_*', (err, stdout) ->
    console.log err or '', stdout or ''
    console.log "Written testfiles"