log = ->
 
  currentTime = -> new Date().toString().replace(/^([a-z]+[\,\s]*?)([a-z].+)(GMT.*?)$/i,'$2').trim()
 
  _toS = (o) ->
    if typeof o is 'function'
      String(o.constructor)
    else if typeof o is 'object' then JSON.stringify(o) else String(o) 
 
  args = Array::slice.call(arguments)
 
  colors =
    '\u001b[0m': /.*/
    '\u001b[31m': /err/
    '\u001b[36m': /info/
    '\u001b[1;36m': /notice/
    '\u001b[1;31m': /debug/
    '\u001b[33m': /important/
  useColors = true
  defaultLevel = 'notice'
  isError = false
  time = currentTime()
 
  s = for arg, i in args
    if i is 0
      arg = (String) arg
      isError = /err/i.test(arg)
      color  = ''
      if /^\s*[\_\+\*\=\-]*(err|info|debug|notice|important)/i.test(arg)
        for ansi of colors
          color = ansi if colors[ansi].test(arg) and useColors
        time+' '+arg.replace(/^([\_\+\*\=\-]*([a-z]+)[\_\+\*\=\-]*)*\s*/i,"#{color}[$2]\t")+' '
      else
        for ansi of colors
          color = ansi if colors[ansi].test(defaultLevel) and useColors
        "#{time} #{color}[#{defaultLevel}]\t#{arg} "
    else
      _toS(arg)
  console[if isError then 'error' else 'log'] s.join(' ').trim()+Object.keys(colors)[0]

module.exports = exports = log