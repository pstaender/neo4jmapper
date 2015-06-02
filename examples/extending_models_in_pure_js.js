require('coffee-script').register();
var expect = require('expect.js');
var GraphObject = require('../lib/graphobject');

function Person() {
  
}

Person = GraphObject.extendModel(Person);

Person.prototype.say = function() {
  return "blah";
}

var p = new Person();

expect(p.getDefaultLabel()).to.be('Person');
expect(p.say()).to.be('blah');

Director = function Director() {

}

Director = Person.extendModel(Director);

var d = new Director();
expect(d.getDefaultLabel()).to.be('Director');
expect(d.say()).to.be('blah');