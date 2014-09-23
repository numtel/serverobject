# ServerObject Meteor Package

[![Build Status](https://travis-ci.org/numtel/serverobject.svg?branch=master)](https://travis-ci.org/numtel/serverobject)

### Installation

Run the following command

    meteor add numtel:serverobject

### Implements

* `ServerObject(type, [argument, argument...], callback)`

Creates a new instance of an object on the server. 
Can be called from both client and server.

The first argument is a string corresponding with the object defined using ServerObject.allow().
The last argument is a callback function with parameters `error` and `instance` respectively.
Extra arguments between the first and last will be passed along to the class constructor.

The instance's properties and methods will be accessible on the client. 
All methods are now asynchronous, append a callback(`error, result`) argument to each method call.

For methods with their own callbacks, pass callback functions normally but do not forget about the last parameter always being a callback for the method's return value. See `serverobject-tests.js` for an example with multiple callbacks.

Instance properties are copied from the server on construction, method calls, and any callbacks.

* `ServerObject.allow({key: {ref: reference, [where: function]}})`

Only available on the server, this method defines an object type for instantiation.

`key` refers to a string that will identify this type of object. These keys are what is passed into ServerObject() as the `type` argument.

`ref` refers to the symbolic reference to the variable containing the constructor function (like you would `new reference()`)

`where` refers to an optional function. If supplied, the `where` function will be called on the server after instantiating the object but before responding to the client. Return a boolean to determine whether to proceed with transmitting the instance. The context of the function will be set to the instance itself.

### Usage

The following is based on `serverobject-tests.js`.

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
        where: function(){
          return this.id === 'test1';
        }
      }
    });


On the client, create an instance using ServerObject:

    ServerObject('MyClass', 'test1', function(error, instance){
      instance.reverseString('hello', function(error, result){
        console.log(result); // Print 'olleh'
      });
    });
