(function () {

///////////////////////////////////////////////////////////////////////////////
//                                                                           //
// packages/serverobject/serverobject.js                                     //
//                                                                           //
///////////////////////////////////////////////////////////////////////////////
                                                                             //
var global = this || window;                                                 // 1
ServerObjectCallbacks = new Meteor.Collection('_ServerObject_callbacks');    // 2
global.ServerObjectCallbacks = ServerObjectCallbacks;                        // 3
if(Meteor.isClient){                                                         // 4
  Meteor.subscribe('ServerObject_callbacks');                                // 5
};                                                                           // 6
ServerObjectCallbacks.find().observe({                                       // 7
  changed: function(newCallback, oldCallback){                               // 8
    if(readyCallbacks.hasOwnProperty(newCallback._id)){                      // 9
      var thisCallback = readyCallbacks[newCallback._id];                    // 10
      updateObj.call(thisCallback.instance, newCallback);                    // 11
      var argsArray = Object.keys(newCallback.args)                          // 12
                        .map(function(k) { return newCallback.args[k] });    // 13
      thisCallback.func.apply(global, argsArray);                            // 14
    };                                                                       // 15
    // Remove from queue                                                     // 16
    Meteor.call('_ServerObject_callbackReceived', newCallback._id);          // 17
  }                                                                          // 18
});                                                                          // 19
                                                                             // 20
var readyCallbacks = {};                                                     // 21
                                                                             // 22
var updateObj = function(result){                                            // 23
  var that = this;                                                           // 24
                                                                             // 25
  // Remove old values/methods                                               // 26
  for(var i in this){                                                        // 27
    if(this.hasOwnProperty(i)){                                              // 28
      delete this[i];                                                        // 29
    };                                                                       // 30
  };                                                                         // 31
                                                                             // 32
  // Copy new values                                                         // 33
  for(var i in result.values){                                               // 34
    if(result.values.hasOwnProperty(i)){                                     // 35
      this[i] = result.values[i];                                            // 36
    };                                                                       // 37
  };                                                                         // 38
                                                                             // 39
  this.prototype = {};                                                       // 40
  this.prototype.instanceKey = result.id;                                    // 41
                                                                             // 42
  result.methods.forEach(function(methodName){                               // 43
    that[methodName] = function(){                                           // 44
      var callback = Array.prototype.pop.call(arguments);                    // 45
      // Check for main callback                                             // 46
      if(callback !== undefined  && typeof callback !== 'function'){         // 47
        throw new Error('Must pass callback.');                              // 48
      };                                                                     // 49
                                                                             // 50
      // Transcribe any callback arguments                                   // 51
      var otherCallbacks = [],                                               // 52
          args = arguments;                                                  // 53
      Array.prototype.forEach.call(args, function(arg, index){               // 54
        if(typeof arg === 'function'){                                       // 55
          otherCallbacks.push(arg);                                          // 56
          args[index] = '##CALLBACK:' + (otherCallbacks.length - 1);         // 57
        };                                                                   // 58
      });                                                                    // 59
                                                                             // 60
      Meteor.call('_ServerObject_method', {                                  // 61
        id: that.prototype.instanceKey,                                      // 62
        method: methodName,                                                  // 63
        args: args                                                           // 64
      }, function(error, result){                                            // 65
        if(result && result.errVal){                                         // 66
          error = new Error(result.errVal);                                  // 67
        };                                                                   // 68
        if(error){                                                           // 69
          callback(error);                                                   // 70
          return;                                                            // 71
        };                                                                   // 72
                                                                             // 73
        result.callbacks.forEach(function(callbackId, index){                // 74
          readyCallbacks[callbackId] = {                                     // 75
            instance: that,                                                  // 76
            func: otherCallbacks[index]                                      // 77
          };                                                                 // 78
        });                                                                  // 79
                                                                             // 80
        updateObj.call(that, result);                                        // 81
                                                                             // 82
        if(callback){                                                        // 83
          callback(undefined, result.retVal);                                // 84
        };                                                                   // 85
      });                                                                    // 86
    };                                                                       // 87
  });                                                                        // 88
};                                                                           // 89
                                                                             // 90
global.ServerObject = function(){                                            // 91
  if(arguments.length < 2){                                                  // 92
    throw new Error('Must pass object identifier key string and callback.'); // 93
  };                                                                         // 94
  var callback = Array.prototype.pop.call(arguments);                        // 95
  if(typeof callback !== 'function'){                                        // 96
    throw new Error('Must pass callback.');                                  // 97
  };                                                                         // 98
  Meteor.apply('_ServerObject_create', arguments, function(error, result){   // 99
    if(error){                                                               // 100
      callback(error);                                                       // 101
      return;                                                                // 102
    };                                                                       // 103
    var instance = new Object();                                             // 104
    updateObj.call(instance, result);                                        // 105
                                                                             // 106
    callback(undefined, instance);                                           // 107
  });                                                                        // 108
};                                                                           // 109
                                                                             // 110
                                                                             // 111
///////////////////////////////////////////////////////////////////////////////

}).call(this);
