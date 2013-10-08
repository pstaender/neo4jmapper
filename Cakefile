fs = require('fs')
{spawn, exec} = require 'child_process'

runCommand = (name, args) ->
  proc =           spawn name, args
  proc.stderr.on   'data', (buffer) -> console.log buffer.toString()
  proc.stdout.on   'data', (buffer) -> console.log buffer.toString()
  proc.on          'exit', (status) -> process.exit(1) if status != 0

task 'assets:watch', 'Watch source files and build JS & CSS', (options) -> 
  runCommand 'sass', ['--watch', '--sourcemap', 'css/']
  runCommand 'coffee',  ['-cbwm', 'js/']
