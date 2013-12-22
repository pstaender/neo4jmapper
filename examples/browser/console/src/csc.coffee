class CoffeeScriptConsole

  # options
  outputContainer: '<pre class="outputResult"><i class="icon-cancel"></i><span class="data"></span></pre>'
  echoEvalOutput: true
  storeInput: true
  storeOutput: true
  adjustInputHeightUnit: 'em'
  storePrefix: 'CoffeeScriptConsole_'

  constructor: (options = {}) ->
    throw Error('jQuery is required to use CoffeeScriptConsole') unless $?
    # apply default values
    options.$input ?= $('#consoleInput')
    options.$output ?= $('#consoleOutput')
    @history = store.get('CoffeeScriptConsole_history') or [] if store and @storeInput
    @suggestions = []
    # apply options on object
    for attr of options
      @[attr] = options[attr]
    @store = window.store or null
    if @store and @storeOutput
      @outputHistory = @store.get(@storePrefix+'output') or []
      for o, i in @outputHistory
        if typeof o is 'object' and o
          $e = @echo o.output, { classification: o.classification, doStore: false, data: { position: i, code: o.code, outputString: o.outputString } }
    @init()

  lastCommand: ->
    history[history.length] or null

  history: null #[]
  suggestions: null #[]

  _currentHistoryPosition: null

  lastPrompt: ->
    @history[@history.length-1]

  addToHistory: (command) ->
    command = command?.trim()
    if command
      return if @history[@history.length-1] and @history[@history.length-1] is command
      @history.push(command)
    @store.set(@storePrefix+'history', @history) if @store and @storeInput

  historySuggestionsFor: (term) ->
    term = String(term).trim()
    suggestions = []
    # shallow copy of array, reverse and add suggestions
    history = [].concat(@history).reverse().concat(@suggestions)
    unless term is ''
      for command in history
        s = String(command).trim()
        # only add if differs from command and begin is identical
        # and if it's not already added
        if s isnt '' and s isnt term and s.substring(0, term.length) is term and suggestions.indexOf(s) is -1
          suggestions.push(s)
    suggestions

  clearHistory: ->
    @clearOutputHistory()
    @clearInputHistory()

  clearInputHistory: ->
    @history = []
    if @storeInput
      @store?.set(@storePrefix+'history', @history)
      true
    else
      false

  storeOutputHistory: () ->
    @store?.set(@storePrefix+'output', @outputHistory) if @storeOutput

  removeFromOutputHistory: (pos) ->

    if @store and @storeOutput and @outputHistory[pos]
      delete(@outputHistory[pos])
      @storeOutputHistory()

  clearOutputHistory: ->
    @outputHistory = []
    @storeOutputHistory()
    if @store and @storeOutput
      true
    else
      false

  _lastPrompt: ''
  _objectIsError: (o) ->
    # EvalError, RangeError, ReferenceErrorl SyntaxError, TypeError, URIError
    if o and typeof o.message isnt 'undefined' then true else false

  outputString: (output) ->
    if typeof output is 'object' and output isnt null
      JSON.stringify(output, null, '  ')
    else
      String(output)

  outputStringFormatted: (output) ->
    if typeof output is 'object' and output isnt null
      if output.constructor is Array
        json2html(output)
      else if @_objectIsError(output)
        output.message
      else
        json2html(output)
    else if output is undefined
      'undefined'
    else if typeof output is 'function'
      return output.toString()
    else if String(output).trim() is ''
      ''
    else
      output

  _setCursorToEnd: (e, $e) ->
    e.preventDefault()
    $e.get(0).setSelectionRange $e.val().length, $e.val().length

  _setCursorToStart: (e, $e) ->
    e.preventDefault()
    $e.get(0).setSelectionRange $e.val().split('\n')?[0].length, $e.val().split('\n')?[0].length

  _insertAtCursor: ($e, myValue) ->
    myField = $e.get(0)
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
    else if myField.selectionStart or myField.selectionStart is 0
      startPos = myField.selectionStart
      endPos = myField.selectionEnd
      myField.value = myField.value.substring(0, startPos) + myValue + myField.value.substring(endPos, myField.value.length)
      myField.selectionStart = startPos + myValue.length
      myField.selectionEnd = startPos + myValue.length
    else
      myField.value += myValue

  _adjustTextareaHeight: ($e, lines = null) ->
    if lines is null
      lines = $e.val().split('\n').length
    if @adjustInputHeightUnit
      $e.css 'height', (lines*1.5)+@adjustInputHeightUnit
    else
      $e.attr 'rows', lines

  _keyIsTriggeredManuallay: false

  echo: (output, options = {}) ->
    options.doStore = @storeOutput if typeof options.doStore isnt 'boolean'
    $e = $(@outputContainer)
    # attach data to $e
    if options.data
      for attr of options.data
        $e.data(attr, options.data[attr])
    $output = @$output
    cssClass = ''
    if typeof options.classification is 'string' and options.classification isnt 'evalOutput'
      cssClass = options.classification
      # skip if we don't display output of eval
      $e.addClass(cssClass)
    else
      return $e if options.classification is 'evalOutput' and not @echoEvalOutput
      if typeof output is 'function'
        cssClass = 'function'
      else if typeof output is 'number'
        cssClass = 'number'
      else if typeof output is 'boolean'
        cssClass = 'boolean'
      else if typeof output is 'string'
        cssClass = 'string'
      else if output is undefined
        cssClass = 'undefined'
      else if typeof output is 'object'
        if @_objectIsError(output)
          cssClass = 'error'
        else if output is null
          cssClass = 'null'
        else if output?.constructor is Array
          cssClass = 'array'
        else
          cssClass = 'object'
    if cssClass
      $e.addClass(cssClass)
    $e.data('outputString', @outputString(output)) unless $e.data('outputString')
    if @store and options.doStore
      history = @outputHistory
      historyData = output: @outputStringFormatted(output), classification: cssClass, code: options.data?.code, outputString: $e.data('outputString')
      history.push(historyData)
      store.set(@storePrefix+'output', history)
    outputAsString = @outputStringFormatted(output)
    if /^\<.+\>/.test(outputAsString)
      $e.find('span.data').html outputAsString
    else
      $e.find('span.data').text outputAsString
    $output.prepend $e
    setTimeout ->
      $e.addClass 'visible'
    , 100
    return $e

  init: ->
    $output = @$output
    $input = @$input
    self = @
    # TODO: split function in many functions
    $input.on 'keyup', (e) ->
      code = $(@).val()
      cursorPosition = $input.get(0).selectionStart
      # enter+shift or backspace
      # if ( e.keyCode is 13 and e.shiftKey ) or e.keyCode is 8
      # always check lines
      linesCount = code.split('\n').length#if code.match(/\n/g)?.length > 0 then code.match(/\n/g).length else 1
      self._adjustTextareaHeight($input)
      # tab pressed
      if e.keyCode is 9 and cursorPosition isnt code.length
        self._insertAtCursor $input, '  '

    suggestionFor = null
    suggestionNr = 0

    $input.on 'focus', (e) ->
      self._adjustTextareaHeight($(this))

    $input.on 'keydown', (e) ->
      code = originalCode = $(@).val()
      cursorPosition = $input.get(0).selectionStart
      linesCount = code.split('\n').length

      if code.trim() isnt self._lastPrompt
        $(@).removeClass 'error'
      # tab pressed
      if e.keyCode is 9
        e.preventDefault()
        if cursorPosition is code.length
          if suggestionFor is null
            suggestionFor = code
          suggestions = self.historySuggestionsFor(suggestionFor)
          if suggestions[suggestionNr]
            $(@).val(suggestions[suggestionNr])
            if suggestionNr+1 <= suggestions.length
              suggestionNr++
            else
              suggestionNr = 0
              $(@).val('')

        else
          suggestionFor = null
          suggestionNr = 0
      else
        suggestionFor = null
        suggestionNr = 0
      # up
      if e.keyCode is 38
        # only browse if cursor is on first line
        return unless cursorPosition <= originalCode.split("\n")?[0]?.length
        return if self._currentHistoryPosition is 0
        if self._currentHistoryPosition is null
          self._currentHistoryPosition = self.history.length
        self._currentHistoryPosition--
        code = self.history[self._currentHistoryPosition]
        $(@).val(code)
        self._setCursorToStart(e, $(@))
      # down
      else if e.keyCode is 40 and self._currentHistoryPosition >= 0
        # only browse if cursor is on last line
        return unless cursorPosition >= originalCode.split("\n").splice(0,linesCount).join(' ').length
        if self._currentHistoryPosition is null
          self._currentHistoryPosition = self.history.length-1
        else if self.history.length is (self._currentHistoryPosition+1)
          self._currentHistoryPosition = null
          $(@).val('')
          return
        self._currentHistoryPosition++
        code = self.history[self._currentHistoryPosition] or ''
        $(@).val(code)
        self._setCursorToEnd(e, $(@))
        unless code
          self._currentHistoryPosition = null
          return
      # enter pressed
      else if e.keyCode is 13 and not e.shiftKey#ctrlKey
        e.preventDefault()
        self.executeCode()
      if typeof code is 'string'
        self._lastPrompt = code.trim()
      self._adjustTextareaHeight($(@))

  compile: (code) ->
    CoffeeScript.compile code, bare: true

  eval: (code, context = window) ->
    eval.call window, code

  onBeforeExecutingCode: (s) ->
    if typeof s is 'string'
      s = s.replace(/^\n*(.*)\n*$/,'$1').split('\n').join('\n')
      # s.th. like `*name = `
      lines = for line in s.split('\n')
        if line and /^\s*\*[a-zA-Z_$]*[0-9a-zA-Z_$]*\s*\=\s*/.test(line)
          codeEscaped = line.replace(/'/g, "\\'")
          match = line.match(/^(\s*)\*([a-zA-Z_$]*[0-9a-zA-Z_$]*)\s*\=\s*(.+)\s*$/)
          functionParts = match[3].match /^(.*)\(([^\)]*)\)\s*$/
          deferString = "defer err, #{match[2]}"
          if functionParts
            functionCall = if functionParts[2] then functionParts[1]+" "+functionParts[2]+", "+deferString else functionParts[1]+" "+deferString
          else
            functionCall = match[3] + ", " + deferString
          """
            await #{functionCall}
            if typeof echo is 'function'
              echo(err, { classification: "\#{if err and not #{match[2]} then "error " else ""}evalOutput", data: { error: err?.message, code: '#{codeEscaped}' } }) if err
              echo(#{match[2]}, { classification: "evalOutput", data: { code: '#{codeEscaped}' } })
          """.split('\n').join("\n#{match[1]}")
        else
          line
      s = lines.join('\n')
    s

  executeCode: (code = @$input?.val(), $input = @$input) ->
    # execute code
    code = @onBeforeExecutingCode(originalCode = code)
    try
      js = @compile(code)
      output = @eval(js)
      $input.val('')
      @_currentHistoryPosition = null
      @addToHistory(originalCode)
      $e = @echo(output, { classification: 'evalOutput', data: { code: originalCode, position: @outputHistory.length } })
      return if @outputStringFormatted(output) is ''
      @onAfterEvaluate output, $e
    catch e
      $input.addClass 'error'
      # we always display error message(s)
      $e = @echo(e?.message or e, { classification: 'error evalOutput', data: { code: originalCode, error: e.message } })
      @onCodeError e, $e

  onAfterEvaluate: (output, $e) ->

  onCodeError: (error, $e) ->

module.exports = exports = CoffeeScriptConsole if require? and exports?
