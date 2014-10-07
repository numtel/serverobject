# ServerObject Meteor Package

Create proxy objects on the client for even easier server integration.

[![Build Status](https://travis-ci.org/numtel/serverobject.svg?branch=master)](https://travis-ci.org/numtel/serverobject)

## Installation

Run the following command

    meteor add numtel:serverobject

## Implements

#### ServerObject()

    var instance = ServerObject(
                     type, // Key as defined in ServerObject.allow() on server
                     [argument, argument...,] // Constructor arguments
                     function(error, result){...} // Received callback
                   );

Creates a new instance of an object on the server. 
Can be called from both client and server.

Object can be defined to local scope synchronously but all properties will be 
unavailable until the callback.

The first argument is a string corresponding with the object defined using ServerObject.allow().
The last argument is a callback function with parameters `error` and `instance` respectively.
Extra arguments between the first and last will be passed along to the class constructor.

The instance's properties and methods will be accessible on the client. 
All methods are now asynchronous, append a callback(`error, result`) argument to each method call.

For methods with their own callbacks, pass callback functions normally but do not forget about the last parameter always being a callback for the method's return value. See `serverobject-tests.js` for an example with multiple callbacks.

Instance properties are copied from the server on construction, method calls, and any callbacks.
With the `forwardFromClient` option set, instance properties from the client are copied to the server on method calls.

Except for the `_id` property, prototype functions and object properties prefixed with an underscore will be considered private and unavailable through the instance proxy object.

#### instance._close()

Close and clean up an instance on the server.

#### ServerObject.allow()

    ServerObject.allow({
      key: {
        ref: reference, 
        [allowConstructor: function(args),]
        [filterInstances: function(),]
        [forwardFromClient: boolean]
       }
    })

Only available on the server, this method defines an object type for instantiation.

`key` refers to a string that will identify this type of object. These keys are what is passed into `ServerObject()` as the `type` argument.

`ref` refers to the variable containing the constructor function. (as in `new reference()`)

`allowConstructor` accepts an optional function with one argument: an array of the arguments sent to the constructor. Return a boolean to determine whether to create the instance.

`filterInstances` accepts and optional function with no arguments. The instance is passed as the context (access with `this`). To filter out the instance, `return undefined` to block transmission of the instance to the client. On success, `return this`. You may modify the values of the instance in this function.

`forwardFromClient` accepts a boolean to determine whether to update values set on the client instance to the server on method calls. Defaults to false for heightened security.

## Usage

The following is based on `serverobject-tests.js`.

On the server, create an object definition and register it with ServerObject.allow():

    MyClass = function(id){
      this.id = id || Random.id();
    };
    MyClass.prototype.reverseString = function(something){
      if(typeof something !== 'string'){
        throw new Meteor.Error(400,'Argument must be string!');
      };
      this.lastReversed = something;
      return something.split('').reverse().join('');
    };

    MyClass.prototype.asyncWork = function(value, callback){
      setTimeout(function(){
        callback(value);
      }, 1000);
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


On the client (or server), create an instance using ServerObject:

    ServerObject('MyClass', 'test1', function(error, instance){
      instance.reverseString('hello', function(error, result){
        console.log(result); // Print 'olleh'
        console.log(instance.lastReversed); // Print 'hello'
      });

      // Last argument undefined to discard the normal function return callback
      instance.asyncWork('hello', function(value){
        console.log(value); // Print 'hello'
      }, undefined);
    });

## Notes

* All thrown errors should use `Meteor.Error()`
