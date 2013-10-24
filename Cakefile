fs = require('fs')
{spawn, exec} = require 'child_process'

runCommand = (name, args) ->
  proc =           spawn name, args
  proc.stderr.on   'data', (buffer) -> console.log buffer.toString()
  proc.stdout.on   'data', (buffer) -> console.log buffer.toString()
  proc.on          'exit', (status) -> process.exit(1) if status != 0

task 'assets:watch', 'Watch source files and build JS & CSS', (options) ->
  runCommand 'sass', ['--watch', 'css/']
  runCommand 'coffee',  ['-cbw', 'js/']

task 'html:generate', 'Generate index.html', ->
  fs = require 'fs'
  marked = require 'marked'
  # we only generate md -> html for robots
  # html will be generated from markdown on runtime in browser!
  readme = 'README.md'
  template = 'index.html.template'
  dest = 'index.html'
  content = fs.readFileSync(readme, { encoding: 'utf8' })
  template = fs.readFileSync(template, { encoding: 'utf8' })
  marked.setOptions gfm: true
  html = marked content
  template = template
    .replace('<div id="README"></div>', '<div id="README">'+content+'</div>')
    .replace('<div id="main"></div>', '<div id="main">'+html+'</div>')
  fs.writeFileSync(dest, template)
  console.log "Filled content in '#{dest}' with '#{readme}'"