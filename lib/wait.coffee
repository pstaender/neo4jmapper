class Wait
  countDone: 0
  errors: []
  data: []
  stack: []
  sequentially: false
  
  constructor: ->
    @errors = []
    @data = []
    @stack = []

  process: (cb, err, data) ->
    @errors.push(err) if err
    @data.push(data) if data
    @countDone++
    if @sequentially and @stack.length is 0 or !@sequentially and @countDone >= @stack.length
      @errors = if @errors.length is 0 then null else @errors
      cb(@errors, @data)
  
  done: (cb) ->
    @start(cb)
    @
  
  start: (cbOnDone) ->
    return @process(cbOnDone, null, null) if @stack.length is 0
    self = @
    if @sequentially
      do ->
        i = -1
        __next = ->
          i++
          cb = self.stack.shift()
          cb (err, data) ->
            self.process(cbOnDone, err, data)
            __next()

        __next()
    else
      for cb in @stack
        cb (err, data) ->
          self.process(cbOnDone, err, data)
    @

  add: (cb) ->
    @stack.push(cb)
    @

  then: (cb) ->
    @sequentially = true
    @stack.push(cb)
    @

module.exports = Wait