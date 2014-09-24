// ServerObject Meteor Package v0.0.6
// https://github.com/numtel/serverobject
// ben@latenightsketches.com, MIT License

ServerObject = function(){
  if(arguments.length < 2){
    throw new Error('Must pass object identifier key string and callback.');
  };
  var callback = Array.prototype.pop.call(arguments);
  if(typeof callback !== 'function'){
    throw new Error('Must pass callback.');
  };
  Meteor.apply('_ServerObject_create', arguments, function(error, result){
    if(error){
      callback(error);
      return;
    };
    var instance = new Object();
    ServerObject.updateObject.call(instance, result);

    callback(undefined, instance);
  });
};

ServerObject.instanceValues = function(instance){
  var output = {};
  for(var i in instance){
    if(instance.hasOwnProperty(i) && 
       i !== 'prototype' && 
       typeof instance[i] !== 'function'){
      output[i] = instance[i];
    };
  };
  return output;
};

ServerObject.updateObject = function(result){
  var that = this;

  // Remove old values/methods
  for(var i in this){
    if(this.hasOwnProperty(i)){
      this[i] = undefined;
    };
  };

  // Copy new values
  for(var i in result.values){
    if(result.values.hasOwnProperty(i)){
      this[i] = result.values[i];
    };
  };

  this.prototype = {};
  this.prototype.instanceKey = result.id;

  // Define pass-thru methods
  result.methods.forEach(function(methodName){
    that[methodName] = function(){
      var callback = Array.prototype.pop.call(arguments);
      // Check for main callback
      if(callback !== undefined  && typeof callback !== 'function'){
        throw new Error('Must pass callback.');
      };

      // Transcribe any callback arguments
      var otherCallbacks = [], 
          args = arguments;
      Array.prototype.forEach.call(args, function(arg, index){
        if(typeof arg === 'function'){
          otherCallbacks.push(arg);
          args[index] = '##CALLBACK:' + (otherCallbacks.length - 1);
        };
      });

      Meteor.call('_ServerObject_method', {
        id: that.prototype.instanceKey,
        method: methodName,
        values: ServerObject.instanceValues(that),
        args: args
      }, function(error, result){
        if(result && result.errVal){
          error = new Error(result.errVal);
        };
        if(error){
          callback(error);
          return;
        };

        result.callbacks.forEach(function(callbackId, index){
          // Define callback pass-thru
          readyCallbacks[callbackId] = {
            instance: that,
            func: otherCallbacks[index]
          };
        });

        ServerObject.updateObject.call(that, result);

        if(callback){
          callback(undefined, result.retVal);
        };
      });
    };
  });
};

// Callback infrastructure
ServerObjectCallbacks = new Meteor.Collection('_ServerObject_callbacks');

if(Meteor.isClient){
  Meteor.subscribe('_ServerObject_callbacks');
};

var observeClause = {};
if(Meteor.isServer){
  observeClause = {connection: 'server'};
};

var global = this;
var readyCallbacks = {};
ServerObjectCallbacks.find(observeClause).observe({
  // Callback documents are inserted on method call and filled in later
  changed: function(newCallback, oldCallback){
    if(readyCallbacks.hasOwnProperty(newCallback._id)){
      var thisCallback = readyCallbacks[newCallback._id];
      ServerObject.updateObject.call(thisCallback.instance, newCallback);
      var argsArray = Object.keys(newCallback.args)
                        .map(function(k) { return newCallback.args[k] });
      thisCallback.func.apply(global, argsArray);
    };
    // Remove from queue
    Meteor.call('_ServerObject_callbackReceived', newCallback._id);
  }
});

