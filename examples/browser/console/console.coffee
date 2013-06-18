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

$(document).ready ->

  $input  = $('#input')
  $output = $('#output')

  window.log = ->
    for arg in arguments
      console.log arg
      output = if typeof arg is 'object' then js_beautify(JSON.stringify(arg), { indent_size: 2 }) else String(arg)
      # if /^error/i.test(arg)
      #   $output.addClass('error')
      #   setTimeput ->
      #     $output.removeClass('error')
      #   , 1000
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
      CoffeeScript.eval code
