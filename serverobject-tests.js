if(Meteor.isServer){
  var instanceCount = 0;
  // Create mockup class for use on the server only
  MyClass = function(id){
    instanceCount++;
    this.check = this.reverseString('check');
    this.id = id || Random.id();
    this._id = 'notprivate';
    this._something = "secret";
  };
  MyClass.prototype.reverseString = function(something){
    if(typeof something !== 'string'){
      throw new Meteor.Error(400, 'expected-string');
    };
    this.lastReversed = something;
    return something.split('').reverse().join('');
  };
  MyClass.prototype.destabilize = function(something, callback, anotherCallback){
    var that = this;
    if(something === 'createError'){
      throw new Meteor.Error(400, 'Aaaaaack!');
    };
    setTimeout(function(){
      that.buffer = something;
      if(callback){
        callback.call(that, undefined, something);
      };
    }, 100);
    setTimeout(function(){
      that.buffer2 = something;
      if(anotherCallback){
        anotherCallback.call(that, undefined, something);
      };
    }, 200);
  };

  MyClass.prototype.asyncWork = function(value, callback){
    var that = this;
    setTimeout(function(){
      callback.call(that, value);
    }, 1000);
  };

  MyClass.prototype.asyncValue = function(value){
    var that = this;
    setTimeout(function(){
      that.byAsync = value;
    }, 100);
  };

  MyClass.prototype._secret = function(){
    throw new Meteor.Error(500, 'Should not be here');
  };

  MyClass.prototype.getSecret = function(){
    return this._something;
  };
  MyClass.prototype.getAnotherPrivate = function(){
    return this._anotherPrivate;
  };

  MyClass.prototype.clearAll = function(){
    for(var i in this){
      this[i] = undefined;
    };
  };

  // Register the mockup class with ServerObject
  ServerObject.allow({
    'MyClass': {
      ref: MyClass,
      allowConstructor: function(args){
        return typeof args[0] === 'string';
      },
      filterInstances: function(){
        if(this.id !== 'test1'){
          return undefined;
        };
        this.addMe = 'fromfilter';
        return this;
      }
    }
  });

  // Create another mockup for testing forwardFromClient
  AnotherClass = function(){
    this.name = 'de facto';
  };
  AnotherClass.prototype.hello = function(){
    return 'Hello, ' + this.name;
  };
  ServerObject.allow({
    'Another': {
      ref: AnotherClass,
      forwardFromClient: true
    }
  });

};

testAsyncMulti('ServerObject - constructor + value update', [
  function (test, expect) {
    var id = 'test1';
    if(Meteor.isServer){
      var beforeCount = instanceCount;
    };
    var instance = ServerObject('MyClass', id, expect(function(error, result){
      if(Meteor.isServer){
        test.equal(beforeCount, instanceCount - 1);
      };
      if(error) throw error;
      test.equal(instance.id, id);
      test.equal(instance._id, 'notprivate');
      test.equal(instance.check, 'kcehc');
      test.equal(instance.addMe, 'fromfilter');
    }));
  }
]);

testAsyncMulti('ServerObject - _close', [
  function (test, expect) {
    var instance = ServerObject('MyClass', 'test1', function(error, result){
      if(error) throw error;
      instance._close();
      instance.reverseString('hello', reverseCallback);
    });
    var reverseCallback = expect(function(error, result){
      test.isUndefined(result);
      test.equal(error.error, 400);
      test.equal(error.reason, 'invalid-instance');
    });
  }
]);

testAsyncMulti('ServerObject - prohibited-constructor error', [
  function (test, expect) {
    var id = 1;
    if(Meteor.isServer){
      var beforeCount = instanceCount;
    };
    ServerObject('MyClass', id, expect(function(error, result){
      if(Meteor.isServer){
        // Instance should never be created
        test.equal(beforeCount, instanceCount);
      };
      test.isUndefined(result);
      test.isTrue(error);
      test.equal(error.error, 403);
      test.equal(error.reason, 'prohibited-constructor');
    }));
  }
]);

testAsyncMulti('ServerObject - invalid-type error', [
  function (test, expect) {
    if(Meteor.isServer){
      var beforeCount = instanceCount;
    };
    ServerObject('not-going-to-work', expect(function(error, result){
      if(Meteor.isServer){
        // Instance should never be created
        test.equal(beforeCount, instanceCount);
      };
      test.isUndefined(result);
      test.isTrue(error);
      test.equal(error.error, 400);
      test.equal(error.reason, 'invalid-type');
    }));
  }
]);

testAsyncMulti('ServerObject - constructor filtered', [
  function (test, expect) {
    var id = 'test-fake';
    if(Meteor.isServer){
      var beforeCount = instanceCount;
    };
    ServerObject('MyClass', id, expect(function(error, result){
      if(Meteor.isServer){
        // Instance is created, then discarded
        test.equal(beforeCount, instanceCount - 1);
      };
      test.isUndefined(result);
      test.isTrue(error);
      test.equal(error.error, 403);
      test.equal(error.reason, 'prohibited-instance');
    }));
  }
]);

testAsyncMulti('ServerObject - forwardFromClient', [
  function (test, expect) {
    var instance;
    var testValue = 'from the client';
    var expected = 'Hello, ' + testValue;
    var objCallback = function(error, result){
      if(error) throw error;
      instance = result;
      instance.name = testValue;
      instance.hello(helloCallback);
    };
    var helloCallback = expect(function(error, result){
      if(error) throw error;
      test.equal(result, expected);
    });
    ServerObject('Another', objCallback);
  }
]);

// testAsyncMulti('ServerObject - async properties update', [
//   function (test, expect) {
//     var instance;
//     var testValue = 'from the client';
//     var objCallback = function(error, result){
//       test.isFalse(error);
//       instance = result;
//       test.isUndefined(instance.byAsync);
//       instance.asyncValue(testValue, undefined);
//       Meteor.setTimeout(valueCallback, 800);
//     };
//     var valueCallback = expect(function(){
//       test.equal(instance.byAsync, testValue);
//     });
//     ServerObject('MyClass', 'test1', objCallback);
//   }
// ]);

testAsyncMulti('ServerObject - synchronous function + value update', [
  function (test, expect) {
    var instance;
    var testValue = 'from the client';
    var toReverse = 'testers';
    var expected = toReverse.split('').reverse().join('');
    var objCallback = function(error, result){
      if(error) throw error;
      instance = result;
      instance.testValue = testValue;
      instance.reverseString(toReverse, reverseCallback);
    };
    var reverseCallback = expect(function(error, result){
      if(error) throw error;
      // Instance should NOT have values set on client
      // forwardFromClient is not set on this class
      test.isUndefined(instance.testValue);
      // Instance should be updated with new values
      test.equal(instance.lastReversed, toReverse);
      // Check return value
      test.equal(result, expected);
    });
    ServerObject('MyClass', 'test1', objCallback);
  }
]);

testAsyncMulti('ServerObject - synchronous function error', [
  function (test, expect) {
    var instance;
    var toReverse = 1;
    var objCallback = function(error, result){
      if(error) throw error;
      instance = result;
      instance.reverseString(toReverse, reverseCallback);
    };
    var reverseCallback = expect(function(error, result){
      test.isUndefined(result);
      test.isTrue(error);
      test.equal(error.error, 400);
      test.equal(error.reason, 'expected-string');
    });
    ServerObject('MyClass', 'test1', objCallback);
  }
]);

testAsyncMulti('ServerObject - private function not available', [
  function (test, expect) {
    var objCallback = expect(function(error, instance){
      if(error) throw error;
      test.isUndefined(instance._secret);
    });
    ServerObject('MyClass', 'test1', objCallback);
  }
]);

testAsyncMulti('ServerObject - private function forced call failure', [
  function (test, expect) {
    var objCallback = function(error, instance){
      if(error) throw error;
      test.isUndefined(instance._secret);
      Meteor.call('_ServerObject_method', {
        id: instance._instanceKey,
        method: '_secret',
        values: ServerObject._instanceValues(instance),
        args: []
      }, privateCallback);
    };
    var privateCallback = expect(function(error, result){
      test.isUndefined(result);
      test.isTrue(error);
      test.equal(error.error, 403);
      test.equal(error.reason, 'permission-denied');
    });
    ServerObject('MyClass', 'test1', objCallback);
  }
]);

testAsyncMulti('ServerObject - private property not directly available', [
  function (test, expect) {
    var objCallback = function(error, instance){
      if(error) throw error;
      test.isUndefined(instance._something);
      instance.getSecret(secretCallback);
    };
    var secretCallback = expect(function(error, result){
      if(error) throw error;
      test.equal(result, 'secret');
    });
    ServerObject('MyClass', 'test1', objCallback);
  }
]);

testAsyncMulti('ServerObject - private property not able to be set', [
  function (test, expect) {
    var instance;
    var objCallback = function(error, result){
      if(error) throw error;
      instance = result;
      test.isUndefined(instance._something);
      instance._anotherPrivate = 'erroneous';
      instance.getAnotherPrivate(secretCallback);
    };
    var secretCallback = expect(function(error, result){
      if(error) throw error;
      test.isUndefined(result);
    });
    ServerObject('MyClass', 'test1', objCallback);
  }
]);


testAsyncMulti('ServerObject - async function (2 callbacks) + value update', [
  function (test, expect) {
    var instance;
    var argument = 'believe it';
    var objCallback = function(error, result){
      if(error) throw error;
      instance = result;
      // Third parameter is the synchronous callback, not used in this test
      instance.destabilize(argument, destabilizeCallback, anotherCallback, undefined);
    };
    var firstCallbackDone = false;
    var destabilizeCallback = function(error, result){
      if(error) throw error;
      firstCallbackDone = true;
      // Instance should be updated with new values
      test.equal(instance.buffer, argument);
      test.equal(instance.buffer2, undefined);
      // Check return value
      test.equal(result, argument);
    };
    var anotherCallback = expect(function(error, result){
      if(error) throw error;
      test.equal(firstCallbackDone, true);
      // Instance should be updated with new values
      test.equal(instance.buffer, argument);
      test.equal(instance.buffer2, argument);
      // Check return value
      test.equal(result, argument);
    });
    ServerObject('MyClass', 'test1', objCallback);
  }
]);

testAsyncMulti('ServerObject - async function error', [
  function (test, expect) {
    var instance;
    var argument = 'createError';
    var objCallback = function(error, result){
      if(error) throw error;
      instance = result;
      instance.destabilize(argument, dontCallback, dontCallback, mainCallback);
    };
    var mainCallback = expect(function(error, result){
      // This should have failed!
      test.isUndefined(result);
      test.isTrue(error);
      test.equal(error.error, 400);
    });
    var dontCallback = function(error, result){
      throw new Meteor.Error(400, 'Should not be called.');
    };
    ServerObject('MyClass', 'test1', objCallback);
  }
]);

testAsyncMulti('ServerObject - undefined properties', [
  function(test, expect) {
    var instance;
    var objCallback = function(error, result){
      if(error) throw error;
      instance = result;
      instance.clearAll(clearCallback);
    };
    var clearCallback = expect(function(error, result){
      if(error) throw error;
      test.isUndefined(instance.id);
    });
    ServerObject('MyClass', 'test1', objCallback);
  }
]);
