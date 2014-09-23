(function () {

/////////////////////////////////////////////////////////////////////////////////////////
//                                                                                     //
// packages/local-test:serverobject/serverobject-tests.js                              //
//                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////
                                                                                       //
if(Meteor.isServer){                                                                   // 1
  // Create mockup class for use on the server only                                    // 2
  MyClass = function(id){                                                              // 3
    this.id = id || Random.id();                                                       // 4
  };                                                                                   // 5
  MyClass.prototype.reverseString = function(something){                               // 6
    if(typeof something !== 'string'){                                                 // 7
      throw new Error('Argument must be string!');                                     // 8
    };                                                                                 // 9
    this.lastReversed = something;                                                     // 10
    return something.split('').reverse().join('');                                     // 11
  };                                                                                   // 12
  MyClass.prototype.destabilize = function(something, callback, anotherCallback){      // 13
    var that = this;                                                                   // 14
    if(something === 'createError'){                                                   // 15
      throw new Error('Aaaaaack!');                                                    // 16
    };                                                                                 // 17
    setTimeout(function(){                                                             // 18
      that.buffer = something;                                                         // 19
      if(callback){                                                                    // 20
        callback.call(that, undefined, something);                                     // 21
      };                                                                               // 22
    }, 100);                                                                           // 23
    setTimeout(function(){                                                             // 24
      that.buffer2 = something;                                                        // 25
      if(anotherCallback){                                                             // 26
        anotherCallback.call(that, undefined, something);                              // 27
      };                                                                               // 28
    }, 200);                                                                           // 29
  };                                                                                   // 30
                                                                                       // 31
  // Register the mockup class with ServerObject                                       // 32
  ServerObject.allow({                                                                 // 33
    'MyClass': {                                                                       // 34
      ref: MyClass,                                                                    // 35
      where: function(){                                                               // 36
        return this.id === 'test1';                                                    // 37
      }                                                                                // 38
    }                                                                                  // 39
  });                                                                                  // 40
                                                                                       // 41
};                                                                                     // 42
                                                                                       // 43
testAsyncMulti('ServerObject - constructor + value update', [                          // 44
  function (test, expect) {                                                            // 45
    var id = 'test1';                                                                  // 46
    ServerObject('MyClass', id, expect(function(error, result){                        // 47
      if(error){                                                                       // 48
        throw error;                                                                   // 49
      };                                                                               // 50
      test.equal(result.id, id);                                                       // 51
    }));                                                                               // 52
  }                                                                                    // 53
]);                                                                                    // 54
                                                                                       // 55
testAsyncMulti('ServerObject - synchronous function + value update', [                 // 56
  function (test, expect) {                                                            // 57
    var instance;                                                                      // 58
    var toReverse = 'testers';                                                         // 59
    var expected = toReverse.split('').reverse().join('');                             // 60
    var objCallback = function(error, result){                                         // 61
      if(error){                                                                       // 62
        throw error;                                                                   // 63
      };                                                                               // 64
      instance = result;                                                               // 65
      instance.reverseString(toReverse, reverseCallback);                              // 66
    };                                                                                 // 67
    var reverseCallback = expect(function(error, result){                              // 68
      if(error){                                                                       // 69
        throw error;                                                                   // 70
      };                                                                               // 71
      // Instance should be updated with new values                                    // 72
      test.equal(instance.lastReversed, toReverse);                                    // 73
      // Check return value                                                            // 74
      test.equal(result, expected);                                                    // 75
    });                                                                                // 76
    ServerObject('MyClass', 'test1', objCallback);                                     // 77
  }                                                                                    // 78
]);                                                                                    // 79
                                                                                       // 80
testAsyncMulti('ServerObject - synchronous function error', [                          // 81
  function (test, expect) {                                                            // 82
    var instance;                                                                      // 83
    var toReverse = 1;                                                                 // 84
    var objCallback = function(error, result){                                         // 85
      if(error){                                                                       // 86
        throw error;                                                                   // 87
      };                                                                               // 88
      instance = result;                                                               // 89
      instance.reverseString(toReverse, reverseCallback);                              // 90
    };                                                                                 // 91
    var reverseCallback = expect(function(error, result){                              // 92
      // This should have failed!                                                      // 93
      test.equal(error instanceof Error, true);                                        // 94
      test.equal(error.message, 'Argument must be string!');                           // 95
      test.equal(result, undefined);                                                   // 96
    });                                                                                // 97
    ServerObject('MyClass', 'test1', objCallback);                                     // 98
  }                                                                                    // 99
]);                                                                                    // 100
                                                                                       // 101
testAsyncMulti('ServerObject - async function (2 callbacks) + value update', [         // 102
  function (test, expect) {                                                            // 103
    var instance;                                                                      // 104
    var argument = 'believe it';                                                       // 105
    var objCallback = function(error, result){                                         // 106
      if(error){                                                                       // 107
        throw error;                                                                   // 108
      };                                                                               // 109
      instance = result;                                                               // 110
      // Third parameter is the synchronous callback, not used in this test            // 111
      instance.destabilize(argument, destabilizeCallback, anotherCallback, undefined); // 112
    };                                                                                 // 113
    var firstCallbackDone = false;                                                     // 114
    var destabilizeCallback = function(error, result){                                 // 115
      if(error){                                                                       // 116
        throw error;                                                                   // 117
      };                                                                               // 118
      firstCallbackDone = true;                                                        // 119
      // Instance should be updated with new values                                    // 120
      test.equal(instance.buffer, argument);                                           // 121
      test.equal(instance.buffer2, undefined);                                         // 122
      // Check return value                                                            // 123
      test.equal(result, argument);                                                    // 124
    };                                                                                 // 125
    var anotherCallback = expect(function(error, result){                              // 126
      if(error){                                                                       // 127
        throw error;                                                                   // 128
      };                                                                               // 129
      test.equal(firstCallbackDone, true);                                             // 130
      // Instance should be updated with new values                                    // 131
      test.equal(instance.buffer, argument);                                           // 132
      test.equal(instance.buffer2, argument);                                          // 133
      // Check return value                                                            // 134
      test.equal(result, argument);                                                    // 135
    });                                                                                // 136
    ServerObject('MyClass', 'test1', objCallback);                                     // 137
  }                                                                                    // 138
]);                                                                                    // 139
                                                                                       // 140
testAsyncMulti('ServerObject - async function error', [                                // 141
  function (test, expect) {                                                            // 142
    var instance;                                                                      // 143
    var argument = 'createError';                                                      // 144
    var objCallback = function(error, result){                                         // 145
      if(error){                                                                       // 146
        throw error;                                                                   // 147
      };                                                                               // 148
      instance = result;                                                               // 149
      instance.destabilize(argument, dontCallback, dontCallback, mainCallback);        // 150
    };                                                                                 // 151
    var mainCallback = expect(function(error, result){                                 // 152
      // This should have failed!                                                      // 153
      test.equal(error instanceof Error, true);                                        // 154
      test.equal(error.message, 'Aaaaaack!');                                          // 155
      test.equal(result, undefined);                                                   // 156
    });                                                                                // 157
    var dontCallback = function(error, result){                                        // 158
      throw new Error('Should not be called.');                                        // 159
    };                                                                                 // 160
    ServerObject('MyClass', 'test1', objCallback);                                     // 161
  }                                                                                    // 162
]);                                                                                    // 163
                                                                                       // 164
/////////////////////////////////////////////////////////////////////////////////////////

}).call(this);
