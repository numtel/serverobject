# ServerObject Meteor Package

Create proxy objects on the client for even easier server integration.

[![Build Status](https://travis-ci.org/numtel/serverobject.svg?branch=master)](https://travis-ci.org/numtel/serverobject)

### Installation

Run the following command

    meteor add numtel:serverobject

### Implements

    ServerObject(type, [argument, argument...,] callback)

Creates a new instance of an object on the server. 
Can be called from both client and server.

The first argument is a string corresponding with the object defined using ServerObject.allow().
The last argument is a callback function with parameters `error` and `instance` respectively.
Extra arguments between the first and last will be passed along to the class constructor.

The instance's properties and methods will be accessible on the client. 
All methods are now asynchronous, append a callback(`error, result`) argument to each method call.

For methods with their own callbacks, pass callback functions normally but do not forget about the last parameter always being a callback for the method's return value. See `serverobject-tests.js` for an example with multiple callbacks.

Instance properties are copied from the server on construction, method calls, and any callbacks.
On method calls, instance properties from the client are copied to the server.

    ServerObject.allow({
      key: {
        ref: reference, 
        [allowConstructor: function(args),]
        [filterInstances: function()]
       }
    })

Only available on the server, this method defines an object type for instantiation.

`key` refers to a string that will identify this type of object. These keys are what is passed into ServerObject() as the `type` argument.

`ref` refers to the symbolic reference to the variable containing the constructor function (like you would `new reference()`)

`allowConstructor` accepts an optional function with one argument: an array of the arguments sent to the constructor. Return a boolean to determine whether to create the instance.

`filterInstances` accepts and optional function with no arguments. The instance is passed as the context (access with `this`). To filter out the instance, `return undefined` to block transmission of the instance to the client. On success, `return this`. You may modify the values of the instance in this function.

### Usage

The following is based on `serverobject-tests.js`.

**All Errors Should use `Meteor.Error()`**

On the server, create an object definition and register it with ServerObject.allow():

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

    // Register the mockup class with ServerObject
    ServerObject.allow({
      'MyClass': {
        ref: MyClass,
        allowConstructor: function(args){
          return typeof args[0] === 'string';
        },
        filterInstances: function(){
          if(this.id !== 'test1'){
            return undefined;
          };
          return this;
        }
      }
    });


On the client, create an instance using ServerObject:

    ServerObject('MyClass', 'test1', function(error, instance){
      instance.reverseString('hello', function(error, result){
        console.log(result); // Print 'olleh'
      });
    });
