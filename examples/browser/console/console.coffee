config =
  streamlineSupport: true
  useToObject: true


_beautify = (str) ->
  try
    str = Narcissus.decompiler.pp(Narcissus.parser.parse(str))
    str = str.replace(/}\s*;/g, "}")
    return str
  catch ex
    console.error ex.message
    return false

insertAtCursor = (myField, myValue) ->
  #IE support
  if document.selection
    temp = undefined
    myField.focus()
    sel = document.selection.createRange()
    temp = sel.text.length
    sel.text = myValue
    if myValue.length is 0
      sel.moveStart "character", myValue.length
      sel.moveEnd "character", myValue.length
    else
      sel.moveStart "character", -myValue.length + temp
    sel.select()
  
  #MOZILLA/NETSCAPE support
  else if myField.selectionStart or myField.selectionStart is "0"
    startPos = myField.selectionStart
    endPos = myField.selectionEnd
    myField.value = myField.value.substring(0, startPos) + myValue + myField.value.substring(endPos, myField.value.length)
    myField.selectionStart = startPos + myValue.length
    myField.selectionEnd = startPos + myValue.length
  else
    myField.value += myValue

Streamline.globals.context = errorHandler: (err) ->
  console.error err.message or err.toString()

$(document).ready ->

  $input  = $('#input')
  $output = $('#output')

  window.query = (o) ->
    window.log o?.toCypherQuery()

  window.log = ->
    for arg in arguments
      console.log arg
      if config.useToObject
        if typeof arg.toObject is 'function'
          arg = arg.toObject()
        else if arg.constructor is Array
          for o, i in arg
            arg[i] = o.toObject() if typeof o.toObject is 'function'
      
      output = if typeof arg is 'object' then js_beautify(JSON.stringify(arg), { indent_size: 2 }) else String(arg)
      $output.text(output + '\n\n' + $output.text())
    stash.set('output', $output.text())

  $input.val stash.get('input') or ''
  $output.text stash.get('output') or ''

  $history = $('#history')

  $input.on 'keydown', (e) ->
    # tab
    if event.keyCode is 9
      e.preventDefault()
      insertAtCursor this, '  '
    # enter
    if e.keyCode is 13
      stash.set('input',$(this).val())
    if e.keyCode is 13 and e.ctrlKey is true
      $output.text('') if e.shiftKey is true
      e.preventDefault()
      code = $(this).val()
      if config.streamlineSupport
        js = CoffeeScript.compile(code, { bare: true })
        try
          js = Streamline.transform js, {
            lines: "preserve"
            noHelpers: false
          }
        catch e
          line = Number(e?.message.match(/line\s([0-9]+)+/)?[1])
          console.error e.message, js.split('\n')?[line+1], js
        eval(js)
      else
        CoffeeScript.eval code
