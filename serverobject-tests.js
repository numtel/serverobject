if(Meteor.isServer){
  // Create mockup class for use on the server only
  MyClass = function(id){
    this.id = id || Random.id();
  };
  MyClass.prototype.reverseString = function(something){
    if(typeof something !== 'string'){
      throw new Error('Argument must be string!');
    };
    this.lastReversed = something;
    return something.split('').reverse().join('');
  };
  MyClass.prototype.destabilize = function(something, callback, anotherCallback){
    var that = this;
    if(something === 'createError'){
      throw new Error('Aaaaaack!');
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

  // Register the mockup class with ServerObject
  ServerObject.allow({
    'MyClass': {
      ref: MyClass,
      where: function(){
        return this.id === 'test1';
      }
    }
  });

};

testAsyncMulti('ServerObject - constructor + value update', [
  function (test, expect) {
    var id = 'test1';
    ServerObject('MyClass', id, expect(function(error, result){
      if(error){
        throw error;
      };
      test.equal(result.id, id);
    }));
  }
]);

testAsyncMulti('ServerObject - synchronous function + value update both directions', [
  function (test, expect) {
    var instance;
    var testValue = 'from the client';
    var toReverse = 'testers';
    var expected = toReverse.split('').reverse().join('');
    var objCallback = function(error, result){
      if(error){
        throw error;
      };
      instance = result;
      instance.testValue = testValue;
      instance.reverseString(toReverse, reverseCallback);
    };
    var reverseCallback = expect(function(error, result){
      if(error){
        throw error;
      };
      // Instance should have values set on client
      test.equal(instance.testValue, testValue);
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
      if(error){
        throw error;
      };
      instance = result;
      instance.reverseString(toReverse, reverseCallback);
    };
    var reverseCallback = expect(function(error, result){
      // This should have failed!
      test.equal(error instanceof Error, true);
      test.equal(error.message, 'Argument must be string!');
      test.equal(result, undefined);
    });
    ServerObject('MyClass', 'test1', objCallback);
  }
]);

testAsyncMulti('ServerObject - async function (2 callbacks) + value update', [
  function (test, expect) {
    var instance;
    var argument = 'believe it';
    var objCallback = function(error, result){
      if(error){
        throw error;
      };
      instance = result;
      // Third parameter is the synchronous callback, not used in this test
      instance.destabilize(argument, destabilizeCallback, anotherCallback, undefined);
    };
    var firstCallbackDone = false;
    var destabilizeCallback = function(error, result){
      if(error){
        throw error;
      };
      firstCallbackDone = true;
      // Instance should be updated with new values
      test.equal(instance.buffer, argument);
      test.equal(instance.buffer2, undefined);
      // Check return value
      test.equal(result, argument);
    };
    var anotherCallback = expect(function(error, result){
      if(error){
        throw error;
      };
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
      if(error){
        throw error;
      };
      instance = result;
      instance.destabilize(argument, dontCallback, dontCallback, mainCallback);
    };
    var mainCallback = expect(function(error, result){
      // This should have failed!
      test.equal(error instanceof Error, true);
      test.equal(error.message, 'Aaaaaack!');
      test.equal(result, undefined);
    });
    var dontCallback = function(error, result){
      throw new Error('Should not be called.');
    };
    ServerObject('MyClass', 'test1', objCallback);
  }
]);
