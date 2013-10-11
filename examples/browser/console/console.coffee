config =
  streamlineSupport: true
  useToObject: true
  outputShorthand: '\\> '
  autoCbPlacement: true
  onError:
    console: true
    alert: true


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
  console.error(err.message or err.toString()) if config.onError.console
  alert(err.message or err.toString()) if config.onError.alert

$(document).ready ->

  $input  = $('#input')
  $output = $('#output')

  $('#input, #output').width($(window).width()/2 - 40)
  $('#input, #output').height($(window).height() - 40)

  window.query = (o) ->
    window.puts o?.toCypherQuery()

  window.puts = ->
    for arg, i in arguments
      # first argument is taken for drawing as well
      # window.drawNodes(arg) if i is 0
      if config.useToObject
        if typeof arg.toObject is 'function'
          arg = arg.toObject()
        else if arg.constructor is Array
          for o, i in arg
            arg[i] = o.toObject() if typeof o.toObject is 'function'
      
      output = if typeof arg is 'object' then js_beautify(JSON.stringify(arg), { indent_size: 2 }) else String(arg)
      output = $output.text() + '\n' + output 
      output = output.replace(/^\n+/g,'')
      $output.text(output)
    stash.set('output', $output.text())


  $input.val stash.get('input') or """
    # Neo4jMapper Console for quick + easy testing
    # • to get the result of a cb we can use the streamline syntax `_`
    # • to display the result use `>` analogue to console.log
    # • to execute the code hit `ctr + shift + enter`
    # … you can nearly do anything you can do with CoffeeScript/JS …

    {Node,Graph,client,graph} = Neo4jMapper.init('http://zeitpulse.com:7480/')
    Node::cypher._useParameters = false # better to inspect queries

    aboutGraph = new Graph().about(_)

    > "Database will be reset every 30 mins"
    > "Neo4j v" + aboutGraph.neo4j_version

    class Person extends Node
      fields:
        defaults:
          created_on: -> (String) new Date()

    Person = Node.register_model(Person)

    person = new Person({ name: 'Philipp' }).save(_)

    > Person.findById(person.id, _)
  """
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
      if config.outputShorthand
        pattern = new RegExp "\\n(\\s*)"+config.outputShorthand.trim()+"\\s", 'g'
        #console.log pattern
        #/\n(\s*)\>\s/g
        code = code.replace(pattern, '\n$1puts ')
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

