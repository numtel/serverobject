ServerObject.allow = function(objs){
  for(var i in objs){
    if(objs.hasOwnProperty(i)){
      if(ServerObject.allowed.hasOwnProperty(i)){
        throw new Meteor.Error(400, 'duplicate-type');
      };
      ServerObject.allowed[i] = objs[i];
    };
  };
};

ServerObject.allowed = {};

var instances = {};

var instanceMethods = function(instance){
  var output = [];
  for(var i in instance.prototype){
    if(typeof instance.prototype[i] === 'function' &&
        String(i).substr(0,1) !== '_'){
      output.push(i);
    };
  };
  return output;
};

// Method called syncronously from _method
var updateInstance = function(options, instanceMeta){
  if(!instanceMeta){
    var connectionId = (this.connection ? this.connection.id : 'server');
    var instanceMeta = instances[connectionId][options.id];
  };
  if(!instanceMeta || instanceMeta.removed || !instanceMeta.instance){
    throw new Meteor.Error(400, 'invalid-instanceKey');
  };
  var instance = instanceMeta.instance;

  if(instanceMeta.objDef.forwardFromClient){
    // Set values
    for(var i in options.values){
      if(options.values.hasOwnProperty(i)){
        if(String(i).substr(0,1) !== '_' || i === '_id'){
          instance[i] = options.values[i];
        };
      };
    };
  };
};

Meteor.methods({
  '_ServerObject_create': function(/* argmuents */){
    var args = arguments;
    var objectKey = Array.prototype.shift.call(args);

    if(!ServerObject.allowed.hasOwnProperty(objectKey)){
      throw new Meteor.Error(400, 'invalid-type');
    };

    var objDef = ServerObject.allowed[objectKey],
        connectionId = (this.connection ? this.connection.id : 'server'),
        instanceKey = connectionId + ':' + Random.id();

    // Check allowConstructor
    var argsArray = Object.keys(args).map(function(k) { return args[k] });
    if(objDef.allowConstructor && !objDef.allowConstructor.call(this, argsArray)){
      throw new Meteor.Error(403, 'prohibited-constructor');
    };

    // Perform instantiation
    var Instance = function(args){
      return objDef.ref.apply(this, args);
    };
    Instance.prototype = objDef.ref.prototype;
    var instance = new Instance(args);

    // Check filterInstances
    if(objDef.filterInstances){
      var filtered = objDef.filterInstances.call(instance);
      if(filtered === undefined){
        throw new Meteor.Error(403, 'prohibited-instance');
      };
      instance = filtered;
    };

    // Store in cache
    var instanceMeta = {
      instance: instance,
      objDef: objDef
    };
    if(!instances.hasOwnProperty(connectionId)){
      instances[connectionId] = {};
    };
    instances[connectionId][instanceKey] = instanceMeta;
    
    // TODO: nyi this feature!
    if(objDef.testAutoPush){
      // Add property watcher
      var lastValues = ServerObject._instanceValues(instance);
      var pollValues = function(){
        var newValues = ServerObject._instanceValues(instance);
        if(!_.isEqual(lastValues, newValues)){
          ServerObjectCallbacks.insert({
            _id: Random.id(),
            instanceKey: instanceKey,
            valueUpdate: true,
            connection: connectionId,
            timestamp: Date.now(),
            methods: instanceMethods(objDef.ref),
            values: newValues
          });
          lastValues = newValues;
        };
        if(!instanceMeta.removed){
          Meteor.setTimeout(pollValues, 100);
        };
      };
      Meteor.setTimeout(pollValues, 100);
    };

    return {
      id: instanceKey,
      type: objectKey,
      values: ServerObject._instanceValues(instance),
      methods: instanceMethods(objDef.ref),
      timestamp: Date.now()
    };
  },
  '_ServerObject_update': updateInstance,
  '_ServerObject_method': function(options){
    if(String(options.method).substr(0,1) === '_'){
      throw new Meteor.Error(403, 'permission-denied');
    };
    var connectionId = (this.connection ? this.connection.id : 'server');
    if(!instances[connectionId]){
      throw new Meteor.Error(400, 'invalid-instance');
    };
    var instanceMeta = instances[connectionId][options.id];
    if(!instanceMeta || instanceMeta.removed){
      throw new Meteor.Error(400, 'invalid-instance');
    };
    var instance = instanceMeta.instance;

    var callbacks = [];

    // Handle any callback functions
    Array.prototype.forEach.call(options.args, function(arg, index){
      if(typeof arg === 'string' && arg.substr(0,11) === '##CALLBACK:'){
        var callbackId = Random.id();
        ServerObjectCallbacks.insert({
          _id: callbackId, connection: connectionId});
        callbacks.push(callbackId);
        // Transitory callback
        options.args[index] = Meteor.bindEnvironment(function(){
          ServerObjectCallbacks.update(callbackId, {
            $set: {
              args: arguments,
              values: ServerObject._instanceValues(instance),
              methods: instanceMethods(instance),
              timestamp: Date.now()}
          });
        });
      };
    });

    updateInstance(options, instanceMeta);

    var retVal, errVal;
    try{
      retVal = instance[options.method].apply(instance, options.args);
    }catch(error){
      errVal = error;
    };

    return {
      id: options.id,
      retVal: retVal,
      errVal: errVal,
      callbacks: callbacks,
      values: ServerObject._instanceValues(instance),
      timestamp: Date.now()
    };
  },
  '_ServerObject_callbackReceived': function(id){
    var connectionId = (this.connection ? this.connection.id : 'server');
    var callback = ServerObjectCallbacks.findOne(id);
    if(callback.connection === connectionId){
      ServerObjectCallbacks.remove(id);
    };
  },
  '_ServerObject_close': function(id){
    var connectionId = (this.connection ? this.connection.id : 'server');
    if(!instances[connectionId]){
      throw new Meteor.Error(400, 'no-instances');
    };
    var instanceMeta = instances[connectionId][id];
    var instance = instanceMeta.instance;
    if(!instance || instanceMeta.removed){
      throw new Meteor.Error(400, 'invalid-instance');
    };
    instanceMeta.removed = true;
    delete instances[connectionId][id];
  }
});

Meteor.startup(function(){
  // Clean up
  ServerObjectCallbacks.remove({});
});

Meteor.publish('_ServerObject_callbacks', function(){
  var connectionId = this.connection ? this.connection.id : 'server';
  this._session.socket.on("close", Meteor.bindEnvironment(function(){
    ServerObjectCallbacks.remove({connection: connectionId});
    if(instances[connectionId]){
      for(var i in instances[connectionId]){
        instances[connectionId][i].removed = true;
      };
      delete instances[connectionId];
    };
  }));
  return ServerObjectCallbacks.find({connection: connectionId});
});

