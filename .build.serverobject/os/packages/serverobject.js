(function () {

///////////////////////////////////////////////////////////////////////////////////
//                                                                               //
// packages/serverobject/serverobject.js                                         //
//                                                                               //
///////////////////////////////////////////////////////////////////////////////////
                                                                                 //
var global = this || window;                                                     // 1
ServerObjectCallbacks = new Meteor.Collection('_ServerObject_callbacks');        // 2
global.ServerObjectCallbacks = ServerObjectCallbacks;                            // 3
if(Meteor.isClient){                                                             // 4
  Meteor.subscribe('ServerObject_callbacks');                                    // 5
};                                                                               // 6
ServerObjectCallbacks.find().observe({                                           // 7
  changed: function(newCallback, oldCallback){                                   // 8
    if(readyCallbacks.hasOwnProperty(newCallback._id)){                          // 9
      var thisCallback = readyCallbacks[newCallback._id];                        // 10
      updateObj.call(thisCallback.instance, newCallback);                        // 11
      var argsArray = Object.keys(newCallback.args)                              // 12
                        .map(function(k) { return newCallback.args[k] });        // 13
      thisCallback.func.apply(global, argsArray);                                // 14
    };                                                                           // 15
    // Remove from queue                                                         // 16
    Meteor.call('_ServerObject_callbackReceived', newCallback._id);              // 17
  }                                                                              // 18
});                                                                              // 19
                                                                                 // 20
var readyCallbacks = {};                                                         // 21
                                                                                 // 22
var updateObj = function(result){                                                // 23
  var that = this;                                                               // 24
                                                                                 // 25
  // Remove old values/methods                                                   // 26
  for(var i in this){                                                            // 27
    if(this.hasOwnProperty(i)){                                                  // 28
      delete this[i];                                                            // 29
    };                                                                           // 30
  };                                                                             // 31
                                                                                 // 32
  // Copy new values                                                             // 33
  for(var i in result.values){                                                   // 34
    if(result.values.hasOwnProperty(i)){                                         // 35
      this[i] = result.values[i];                                                // 36
    };                                                                           // 37
  };                                                                             // 38
                                                                                 // 39
  this.prototype = {};                                                           // 40
  this.prototype.instanceKey = result.id;                                        // 41
                                                                                 // 42
  result.methods.forEach(function(methodName){                                   // 43
    that[methodName] = function(){                                               // 44
      var callback = Array.prototype.pop.call(arguments);                        // 45
      // Check for main callback                                                 // 46
      if(callback !== undefined  && typeof callback !== 'function'){             // 47
        throw new Error('Must pass callback.');                                  // 48
      };                                                                         // 49
                                                                                 // 50
      // Transcribe any callback arguments                                       // 51
      var otherCallbacks = [],                                                   // 52
          args = arguments;                                                      // 53
      Array.prototype.forEach.call(args, function(arg, index){                   // 54
        if(typeof arg === 'function'){                                           // 55
          otherCallbacks.push(arg);                                              // 56
          args[index] = '##CALLBACK:' + (otherCallbacks.length - 1);             // 57
        };                                                                       // 58
      });                                                                        // 59
                                                                                 // 60
      Meteor.call('_ServerObject_method', {                                      // 61
        id: that.prototype.instanceKey,                                          // 62
        method: methodName,                                                      // 63
        args: args                                                               // 64
      }, function(error, result){                                                // 65
        if(result && result.errVal){                                             // 66
          error = new Error(result.errVal);                                      // 67
        };                                                                       // 68
        if(error){                                                               // 69
          callback(error);                                                       // 70
          return;                                                                // 71
        };                                                                       // 72
                                                                                 // 73
        result.callbacks.forEach(function(callbackId, index){                    // 74
          readyCallbacks[callbackId] = {                                         // 75
            instance: that,                                                      // 76
            func: otherCallbacks[index]                                          // 77
          };                                                                     // 78
        });                                                                      // 79
                                                                                 // 80
        updateObj.call(that, result);                                            // 81
                                                                                 // 82
        if(callback){                                                            // 83
          callback(undefined, result.retVal);                                    // 84
        };                                                                       // 85
      });                                                                        // 86
    };                                                                           // 87
  });                                                                            // 88
};                                                                               // 89
                                                                                 // 90
global.ServerObject = function(){                                                // 91
  if(arguments.length < 2){                                                      // 92
    throw new Error('Must pass object identifier key string and callback.');     // 93
  };                                                                             // 94
  var callback = Array.prototype.pop.call(arguments);                            // 95
  if(typeof callback !== 'function'){                                            // 96
    throw new Error('Must pass callback.');                                      // 97
  };                                                                             // 98
  Meteor.apply('_ServerObject_create', arguments, function(error, result){       // 99
    if(error){                                                                   // 100
      callback(error);                                                           // 101
      return;                                                                    // 102
    };                                                                           // 103
    var instance = new Object();                                                 // 104
    updateObj.call(instance, result);                                            // 105
                                                                                 // 106
    callback(undefined, instance);                                               // 107
  });                                                                            // 108
};                                                                               // 109
                                                                                 // 110
                                                                                 // 111
///////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

///////////////////////////////////////////////////////////////////////////////////
//                                                                               //
// packages/serverobject/serverobject-server.js                                  //
//                                                                               //
///////////////////////////////////////////////////////////////////////////////////
                                                                                 //
ServerObject.allow = function(objs){                                             // 1
  for(var i in objs){                                                            // 2
    if(objs.hasOwnProperty(i)){                                                  // 3
      if(ServerObject.allowed.hasOwnProperty(i)){                                // 4
        throw new Error('ServerObject identifier already exists: ' + i);         // 5
      };                                                                         // 6
      ServerObject.allowed[i] = objs[i];                                         // 7
    };                                                                           // 8
  };                                                                             // 9
};                                                                               // 10
                                                                                 // 11
ServerObject.allowed = {};                                                       // 12
                                                                                 // 13
var instances = {};                                                              // 14
                                                                                 // 15
var instanceValues = function(instance){                                         // 16
  var output = {};                                                               // 17
  for(var i in instance){                                                        // 18
    if(instance.hasOwnProperty(i) &&                                             // 19
       i !== 'prototype' &&                                                      // 20
       typeof instance[i] !== 'function'){                                       // 21
      output[i] = instance[i];                                                   // 22
    };                                                                           // 23
  };                                                                             // 24
  return output;                                                                 // 25
};                                                                               // 26
var instanceMethods = function(instance){                                        // 27
  var output = [];                                                               // 28
  for(var i in instance.prototype){                                              // 29
    if(typeof instance.prototype[i] === 'function'){                             // 30
      output.push(i);                                                            // 31
    };                                                                           // 32
  };                                                                             // 33
  return output;                                                                 // 34
};                                                                               // 35
                                                                                 // 36
Meteor.methods({                                                                 // 37
  '_ServerObject_create': function(){                                            // 38
    var objectKey = Array.prototype.shift.call(arguments);                       // 39
                                                                                 // 40
    if(!ServerObject.allowed.hasOwnProperty(objectKey)){                         // 41
      throw new Error('Invalid ServerObject identifier: ' + objectKey);          // 42
    };                                                                           // 43
                                                                                 // 44
    var objDef = ServerObject.allowed[objectKey],                                // 45
        connectionId = (this.connection ? this.connection.id : 'server'),        // 46
        instanceKey = connectionId + ':' + Random.id(),                          // 47
        instance = new Object();                                                 // 48
                                                                                 // 49
    objDef.ref.apply(instance, arguments);                                       // 50
    instance.prototype = objDef.ref.prototype;                                   // 51
                                                                                 // 52
    if(objDef.where && !objDef.where.call(instance)){                            // 53
      throw new Error('Permission denied!');                                     // 54
    };                                                                           // 55
                                                                                 // 56
                                                                                 // 57
    if(!instances.hasOwnProperty(connectionId)){                                 // 58
      instances[connectionId] = {};                                              // 59
    };                                                                           // 60
    instances[connectionId][instanceKey] = instance;                             // 61
                                                                                 // 62
    return {                                                                     // 63
      id: instanceKey,                                                           // 64
      values: instanceValues(instance),                                          // 65
      methods: instanceMethods(instance)                                         // 66
    };                                                                           // 67
  },                                                                             // 68
  '_ServerObject_method': function(options){                                     // 69
    var connectionId = (this.connection ? this.connection.id : 'server');        // 70
    if(!instances[connectionId]){                                                // 71
      throw new Error('No available instances for this connection.');            // 72
    };                                                                           // 73
    var instance = instances[connectionId][options.id];                          // 74
    if(!instance){                                                               // 75
      throw new Error('Invalid instance id: ' + options.id);                     // 76
    };                                                                           // 77
                                                                                 // 78
    var callbacks = [];                                                          // 79
                                                                                 // 80
    // Handle any callback functions                                             // 81
    Array.prototype.forEach.call(options.args, function(arg, index){             // 82
      if(typeof arg === 'string' && arg.substr(0,11) === '##CALLBACK:'){         // 83
        var callbackId = Random.id();                                            // 84
        ServerObjectCallbacks.insert({                                           // 85
          _id: callbackId, connection: connectionId});                           // 86
        callbacks.push(callbackId);                                              // 87
        // Transitory callback                                                   // 88
        options.args[index] = Meteor.bindEnvironment(function(){                 // 89
          ServerObjectCallbacks.update(callbackId, {                             // 90
            $set: {                                                              // 91
              args: arguments,                                                   // 92
              values: instanceValues(instance),                                  // 93
              methods: instanceMethods(instance)}                                // 94
          });                                                                    // 95
        });                                                                      // 96
      };                                                                         // 97
    });                                                                          // 98
                                                                                 // 99
    var retVal, errVal;                                                          // 100
    try{                                                                         // 101
      retVal = instance.prototype[options.method].apply(instance, options.args); // 102
    }catch(error){                                                               // 103
      if(typeof error === 'string'){                                             // 104
        errVal = error;                                                          // 105
      }else if(error instanceof Error){                                          // 106
        errVal = error.message;                                                  // 107
      }else{                                                                     // 108
        errVal = error.toString();                                               // 109
      };                                                                         // 110
    };                                                                           // 111
                                                                                 // 112
    return {                                                                     // 113
      id: options.id,                                                            // 114
      retVal: retVal,                                                            // 115
      errVal: errVal,                                                            // 116
      callbacks: callbacks,                                                      // 117
      values: instanceValues(instance),                                          // 118
      methods: instanceMethods(instance)                                         // 119
    };                                                                           // 120
  },                                                                             // 121
  '_ServerObject_callbackReceived': function(id){                                // 122
    var connectionId = (this.connection ? this.connection.id : 'server');        // 123
    var callback = ServerObjectCallbacks.findOne(id);                            // 124
    if(callback.connection === connectionId){                                    // 125
      ServerObjectCallbacks.remove(id);                                          // 126
    };                                                                           // 127
  }                                                                              // 128
});                                                                              // 129
                                                                                 // 130
Meteor.startup(function(){                                                       // 131
  ServerObjectCallbacks.remove({});                                              // 132
});                                                                              // 133
                                                                                 // 134
Meteor.publish('ServerObject_callbacks', function(){                             // 135
  var connectionId = this.connection ? this.connection.id : 'server';            // 136
  this._session.socket.on("close", Meteor.bindEnvironment(function(){            // 137
    ServerObjectCallbacks.remove({connection: connectionId});                    // 138
    delete instances[connectionId];                                              // 139
  }));                                                                           // 140
  return ServerObjectCallbacks.find({connection: connectionId});                 // 141
});                                                                              // 142
                                                                                 // 143
                                                                                 // 144
///////////////////////////////////////////////////////////////////////////////////

}).call(this);
