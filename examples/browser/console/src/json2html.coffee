do ->
  # TODO: fix circular handling
  Json2Html = (o, options = {}) ->
    @references ?= []
    # apply options on object
    for attr of options
      @[attr] = options[attr]
    if typeof o is 'object' and o isnt null
      return @html += "<span class=\"circularReference\">@circularReference</span>" if @references.indexOf(o) isnt -1
      @references.push(o)
      if o.constructor is Array
        parts = for part in o
          "<li class=\"#{typeof part}\"><span class=\"value\">#{new Json2Html(part).toString()}</span></li>"
        @html += "<ol class=\"array\">#{parts.join('')}</ol>"
      else
        parts = for attr of o
          if o.hasOwnProperty(attr)
            "<li class=\"#{typeof o[attr]}\"><span class=\"attribute\">#{attr}</span><span class=\"value\">#{new Json2Html(o[attr], references: @references).toString()}</span></li>"
        @html += "<ul class=\"object\">#{parts.join('')}</ul>"
    else if typeof o is 'string'
      if @detectUrls and /^[a-z]+\:\/\//g.test(o)
        @html += "<a href=\"#{o}\">#{o}</a>"
      else
        @html += @stringDelimiter + o.replace(new RegExp("[\\\\#{@stringDelimiter}]", 'g', '\\$&')) + @stringDelimiter
    else
      @html += String(o)

  Json2Html::stringDelimiter = '"'
  Json2Html::html = ''
  Json2Html::references = null
  Json2Html::detectUrls = true
  Json2Html::toString = -> @html

  json2html = (o) ->
    if o is null or typeof o isnt 'object'
      return ''
    else
      new Json2Html(o).toString()

  if window
    window.json2html = json2html
    window.Json2Html = Json2Html
  else
    exports = {json2html, Json2Html}

  json2htmlTests = ->
    # Basic Tests
    testCases = [
      { "": null }
      { "": true }
      { "": 1 }
      { "": "test" }
      { '<ol class="array"><li class="string">"a"</li><li class="string">"b"</li><li class="number">1</li></ol>': [ 'a', 'b', 1 ] }
      { '<ul class="object"><li class="string"><span class="attribute">a</span><span class="value">"String"</span></li><li class="string"><span class="attribute">b_true</span><span class="value">true</span></li><li class="string"><span class="attribute">cFalse</span><span class="value">false</span></li><li class="string"><span class="attribute">d</span><span class="value">null</span></li><li class="string"><span class="attribute">e</span><span class="value">2.718281828459045</span></li><li class="string"><span class="attribute">o</span><span class="value"><ul class="object"><li class="string"><span class="attribute">a</span><span class="value">"String"</span></li></ul></span></li></ul>': { a: "String", b_true: true, "cFalse": false, d: null, e: Math.exp(1), o: { a: "String" } } }
    ]

    testsCount = 0
    for testCase in testCases
      testsCount++
      expected = Object.keys(testCase)[0]
      object = testCase[expected]
      html = json2html(object)
      throw Error("Expected: `#{expected}`\nbut got:\n`#{html}`") if html isnt expected

    console.log "#{testsCount} Tests passed ✓"
