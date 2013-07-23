// exec: node --harmony examples/generators.js

// Node.prototype.iterate = function*() {
//   var self = this;
//   this.exec(function* (err, res){
//     yield err;
//   }); 
//   // return yield suspend(function* (resume) {
//   //   return yield self.exec(resume);
//   //   // return yield this.each(function());
//   // })();
// }

// nodeVersion = Number(process.version.replace(/^v(\d+\.\d+).+$/, '$1'));

// if (nodeVersion >= 0.11) {
//   describe('Neo4jMapper yield', function() {
//     it.only('expect to use generators', suspend(function* (resume){
//       var nodes = yield Node.find().limit(10).each(resume);
//       console.log('OK');
//       console.log(nodes.next());

//     }));
//   })
// } else {
//   describe('Neo4jMapper yield', function(){
//     it.skip('testing js generators, node v >= 0.11 is required');
//   });
// }


