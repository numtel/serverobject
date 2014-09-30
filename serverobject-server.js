ServerObject.allow = function(objs){
  for(var i in objs){
    if(objs.hasOwnProperty(i)){
      if(ServerObject.allowed.hasOwnProperty(i)){
        throw new Meteor.Error(400, 'ServerObject identifier already exists: ' + i);
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

Meteor.methods({
  '_ServerObject_create': function(){
    var objectKey = Array.prototype.shift.call(arguments);

    if(!ServerObject.allowed.hasOwnProperty(objectKey)){
      throw new Meteor.Error(400, 'Invalid ServerObject identifier: ' + objectKey);
    };

    var objDef = ServerObject.allowed[objectKey],
        connectionId = (this.connection ? this.connection.id : 'server'),
        instanceKey = connectionId + ':' + Random.id();

    // Check allowConstructor
    var args = arguments;
    var argsArray = Object.keys(args).map(function(k) { return args[k] });
    if(objDef.allowConstructor && !objDef.allowConstructor.call(this, argsArray)){
      throw new Meteor.Error(400, 'Permission denied!');
    };

    // Perform instantiation
    var f = function(args){
      return objDef.ref.apply(this, args);
    };
    f.prototype = objDef.ref.prototype;
    var instance = new f(args);
    instance.prototype = objDef.ref.prototype;

    // Check filterInstances
    if(objDef.filterInstances){
      var filtered = objDef.filterInstances.call(instance);
      if(filtered === undefined){
        throw new Meteor.Error(400, 'Permission denied!');
      };
      instance = filtered;
    };

    if(!instances.hasOwnProperty(connectionId)){
      instances[connectionId] = {};
    };
    instances[connectionId][instanceKey] = {
      instance: instance,
      objDef: objDef
    };

    return {
      id: instanceKey,
      type: objectKey,
      values: ServerObject.instanceValues(instance),
      methods: instanceMethods(objDef.ref)
    };
  },
  '_ServerObject_method': function(options){
    if(String(options.method).substr(0,1) === '_'){
      throw new Meteor.Error(403, 'Permission denied!');
    };
    var connectionId = (this.connection ? this.connection.id : 'server');
    if(!instances[connectionId]){
      throw new Meteor.Error(400, 'No available instances for this connection.');
    };
    var instanceMeta = instances[connectionId][options.id];
    var instance = instanceMeta.instance;
    if(!instance){
      throw new Meteor.Error(400, 'Invalid instance id: ' + options.id);
    };

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
              values: ServerObject.instanceValues(instance),
              methods: instanceMethods(instance)}
          });
        });
      };
    });

    if(instanceMeta.objDef.forwardFromClient){
      // Set values
      for(var i in options.values){
        if(options.values.hasOwnProperty(i)){
          if(i !== '_id' && String(i).substr(0,1) === '_'){
            throw new Meteor.Error(403, 'Cannot set private property : ' + i);
          };
          instance[i] = options.values[i];
        };
      };
    };

    var retVal, errVal;
    try{
      retVal = instance.prototype[options.method].apply(instance, options.args);
    }catch(error){
      errVal = error;
    };

    return {
      id: options.id,
      retVal: retVal,
      errVal: errVal,
      callbacks: callbacks,
      values: ServerObject.instanceValues(instance),
      methods: instanceMethods(instance)
    };
  },
  '_ServerObject_callbackReceived': function(id){
    var connectionId = (this.connection ? this.connection.id : 'server');
    var callback = ServerObjectCallbacks.findOne(id);
    if(callback.connection === connectionId){
      ServerObjectCallbacks.remove(id);
    };
  }
});

Meteor.startup(function(){
  ServerObjectCallbacks.remove({});
});

Meteor.publish('_ServerObject_callbacks', function(){
  var connectionId = this.connection ? this.connection.id : 'server';
  this._session.socket.on("close", Meteor.bindEnvironment(function(){
    ServerObjectCallbacks.remove({connection: connectionId});
    delete instances[connectionId];
  }));
  return ServerObjectCallbacks.find({connection: connectionId});
});

