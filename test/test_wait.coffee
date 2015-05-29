expect = require('expect.js')

Wait   = require('../lib/wait')

describe 'Wait for async tasks to complete', ->

  it 'expect to run done without having tasks', (done) ->
    wait = new Wait()
    wait.done (err, data) ->
      expect(err).to.be null
      expect(data).to.have.length 0
      done()

  it 'expect waiting for simultaniously running tasks', (done) ->
    
    wait = new Wait()
    iterations = [1..20]
    
    iterations.forEach (i) ->
      task = (cb, err = null, data = i) ->
        timeout = Math.round(Math.random()*10) # between 0 - 10
        setTimeout ->
          cb(err, data)
        , timeout
      wait.add(task)

    wait.done (err, data) ->
      expect(err).to.be null
      expect(data).to.have.length iterations.length
      expect(data.join(',')).not.to.be '1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20'
      done()

  it 'expect waiting for sequentially running tasks', (done) ->
    
    wait = new Wait()
    iterations = [1..20]
    
    iterations.forEach (i) ->
      task = (cb, err = null, data = i) ->
        timeout = Math.round(Math.random()*10) # between 0 - 10
        setTimeout ->
          cb(err, data)
        , timeout
      wait.then(task)

    wait.done (err, data) ->
      expect(err).to.be null
      expect(data).to.have.length iterations.length
      expect(data.join(',')).to.be '1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20'
      done()

  it 'expect to use chaining / promise like interface simultaniously', (done) ->
    task = (cb) ->
      setTimeout ->
        cb(null, Math.round(Math.random()*10))
    new Wait()
      .add( (cb) ->
        setTimeout ->
          cb(null, "a")
        , 40
      ).add( (cb) ->
        setTimeout ->
          cb(null, "b")
        , 10
      ).done (err, data) ->
        expect(err).to.be null
        expect(data.join(',')).to.be 'b,a'
        done()

  it 'expect to use chaining / promise like interface sequentially', (done) ->
    task = (cb) ->
      setTimeout ->
        cb(null, Math.round(Math.random()*10))
    new Wait()
      .then( (cb) ->
        setTimeout ->
          cb(null, "a")
        , 40
      ).then( (cb) ->
        setTimeout ->
          cb(null, "b")
        , 10
      ).done (err, data) ->
        expect(err).to.be null
        expect(data.join(',')).to.be 'a,b'
        done()
        