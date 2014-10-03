// ServerObject Meteor Package v0.0.15
// https://github.com/numtel/serverobject
// ben@latenightsketches.com, MIT License

ServerObject = function(){
  if(arguments.length < 2){
    throw new Meteor.Error(400, 'Must pass object identifier key string and callback.');
  };
  var callback = Array.prototype.pop.call(arguments);
  if(typeof callback !== 'function'){
    throw new Meteor.Error(400, 'Must pass callback.');
  };
  Meteor.apply('_ServerObject_create', arguments, function(error, result){
    if(error){
      callback(error);
      return;
    };
    var ServerInstance = function(){};
    ServerInstance.prototype = buildPrototype(
      result.methods, result.type, result.id);
    var instance = new ServerInstance();
    ServerObject.updateObject.call(instance, result);
    instances[result.id] = instance;
    callback(undefined, instance);
  });
};
var instances = {};

ServerObject.instanceValues = function(instance){
  var output = {};
  for(var i in instance){
    if(instance.hasOwnProperty(i) && 
       typeof instance[i] !== 'function' &&
       (i === '_id' || String(i).substr(0,1) !== '_')){
      output[i] = instance[i];
    };
  };
  return output;
};

var buildPrototype = function(methods, type, key){
  var prototype = {
    instanceKey: key,
    type: type
  };
  methods.forEach(function(methodName){
    prototype[methodName] = function(){
      var that = this;
      var callback = Array.prototype.pop.call(arguments);
      // Check for main callback
      if(callback !== undefined  && typeof callback !== 'function'){
        throw new Meteor.Error(400, 'Must pass callback.');
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
        id: that.instanceKey,
        method: methodName,
        values: ServerObject.instanceValues(that),
        args: args
      }, function(error, result){
        if(result && result.errVal){
          error = result.errVal;
        };
        if(error){
          if(callback){
            callback(error);
          };
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
  return prototype;
};

ServerObject.updateObject = function(result){
  var that = this;

  // Remove old values/methods
  for(var i in this){
    if(this.hasOwnProperty(i) && String(i).substr(0,1) !== '_'){
      this[i] = undefined;
    };
  };

  // Copy new values
  for(var i in result.values){
    if(result.values.hasOwnProperty(i)){
      this[i] = result.values[i];
    };
  };
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
  added: function(newValues){
    if(newValues.valueUpdate){
      // TODO
      // Auto update instance properties
//       var instance = instances[newValues.instanceKey];
//       if(newValues.timestamp > instance.prototype.timestamp){
//         ServerObject.updateObject.call(instance, newValues);
//       };
      // Remove from queue
      Meteor.call('_ServerObject_callbackReceived', newValues._id);
    };
  },
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

