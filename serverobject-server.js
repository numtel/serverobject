ServerObject.allow = function(objs){
  for(var i in objs){
    if(objs.hasOwnProperty(i)){
      if(ServerObject.allowed.hasOwnProperty(i)){
        throw new Error('ServerObject identifier already exists: ' + i);
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
    if(typeof instance.prototype[i] === 'function'){
      output.push(i);
    };
  };
  return output;
};

Meteor.methods({
  '_ServerObject_create': function(){
    var objectKey = Array.prototype.shift.call(arguments);

    if(!ServerObject.allowed.hasOwnProperty(objectKey)){
      throw new Error('Invalid ServerObject identifier: ' + objectKey);
    };

    var objDef = ServerObject.allowed[objectKey],
        connectionId = (this.connection ? this.connection.id : 'server'),
        instanceKey = connectionId + ':' + Random.id(),
        instance = new Object();

    objDef.ref.apply(instance, arguments);
    instance.prototype = objDef.ref.prototype;

    if(objDef.where && !objDef.where.call(instance)){
      throw new Error('Permission denied!');
    };


    if(!instances.hasOwnProperty(connectionId)){
      instances[connectionId] = {};
    };
    instances[connectionId][instanceKey] = instance;

    return {
      id: instanceKey,
      values: ServerObject.instanceValues(instance),
      methods: instanceMethods(instance)
    };
  },
  '_ServerObject_method': function(options){
    var connectionId = (this.connection ? this.connection.id : 'server');
    if(!instances[connectionId]){
      throw new Error('No available instances for this connection.');
    };
    var instance = instances[connectionId][options.id];
    if(!instance){
      throw new Error('Invalid instance id: ' + options.id);
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

    // Set values
    for(var i in options.values){
      if(options.values.hasOwnProperty(i)){
        instance[i] = options.values[i];
      };
    };

    var retVal, errVal;
    try{
      retVal = instance.prototype[options.method].apply(instance, options.args);
    }catch(error){
      if(typeof error === 'string'){
        errVal = error;
      }else if(error instanceof Error){
        errVal = error.message;
      }else{
        errVal = error.toString();
      };
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

