// ServerObject Meteor Package v0.0.16
// https://github.com/numtel/serverobject
// ben@latenightsketches.com, MIT License

ServerObject = function(/* arguments */){
  var args = arguments;

  // First argument is string 'type'
  if(args.length === 0){
    throw new Meteor.Error(400, 'requires-type');
  };

  // Determine optional callback
  var callback;
  if(args.length > 1 && typeof args[args.length - 1] === 'function'){
    callback = Array.prototype.pop.call(args);
  };

  // Construct object
  var ServerInstance = function(){};
  ServerInstance.prototype = {};
  var instance = new ServerInstance();

  // Query server
  Meteor.setTimeout(function(){
    Meteor.apply('_ServerObject_create', args, function(error, result){
      if(error){
        callback && callback(error);
      }else{
        buildPrototype.call(
          ServerInstance.prototype,
          result.methods, 
          result.type, 
          result.id);
        ServerObject.updateObject.call(instance, result);
        instances[result.id] = instance;
        callback && callback(undefined, instance);
      };
    });
  }, 0);

  return instance;
};

var instances = {}; // Cache

// Return a document containing the properties of an instance
ServerObject._instanceValues = function(instance){
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

// Call with context set to the prototype object (usually empty)
// Adds server pass-thru functions for array of methods
// As well as properties for type and instanceKey
var buildPrototype = function(methods, type, key){
  var prototype = this;
  prototype._instanceKey = key;
  prototype._type = type;
  prototype._close = function(){
    Meteor.call('_ServerObject_close', key);
  };
  methods.forEach(function(methodName){
    prototype[methodName] = function(){
      var that = this;
      var callback = Array.prototype.pop.call(arguments);
      // Check for main callback
      if(callback !== undefined  && typeof callback !== 'function'){
        throw new Meteor.Error(400, 'callback-required');
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
        id: that._instanceKey,
        method: methodName,
        values: ServerObject._instanceValues(that),
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
//       var instance = instances[newValues._instanceKey];
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

