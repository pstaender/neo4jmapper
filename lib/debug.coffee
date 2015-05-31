colors = require('colors/safe')

class Debug

  out: null
  defaultOutput: console.error
  prefix: '[debug]\t'

  constructor: (msg, color) ->
    @out = @defaultOutput
    @log(msg, color) if msg or color

  activate: (out = @defaultOutput) ->
    @out = out
    @

  deactivate: ->
    @out = null

  log: (msg, style = 'normal') ->
    colors.setTheme
      input: 'grey'
      verbose: 'cyan'
      info: 'green'
      data: 'grey'
      help: 'cyan'
      warn: 'yellow'
      url: 'yellow'
      debug: 'blue'
      error: 'red'
      normal: 'reset'
    msg = @prefix + msg
    s = if typeof colors[style] is 'function' then colors[style](msg) else msg
    @out(s) if typeof @out is 'function'
    @

module.exports = Debug