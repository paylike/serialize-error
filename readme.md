# serialize-error [![Build Status](https://travis-ci.org/sindresorhus/serialize-error.svg?branch=master)](https://travis-ci.org/sindresorhus/serialize-error)

> Serialize/deserialize an error into a plain object

Useful if you for example need to `JSON.stringify()` or `process.send()` the error.

## Install

```
$ npm install serialize-error
```

## Usage

```js
const {serializeError, deserializeError} = require('serialize-error');

const error = new Error('🦄');

console.log(error);
//=> [Error: 🦄]

const serialized = serializeError(error)

console.log(serialized);
//=> {name: 'Error', message: '🦄', stack: 'Error: 🦄\n    at Object.<anonymous> …'}

const deserialized = deserializeError(serialized);

console.log(deserialized);
//=> [Error: 🦄]
```

## API

### serializeError(value, options?)

Type: `Error | unknown`

Serialize an `Error` object into a plain object.

Non-error values are passed through.
Custom properties are preserved.
Non-enumerable properties are kept non-enumerable (name, message, stack).
Enumerable properties are kept enumerable (all properties besides the non-enumerable ones).
Circular references are handled.

#### options

##### allowToJSON

Type: `Boolean`, default: `false`

If `true` and if the input object contains `.toJSON()` then its result will be returned instead of object properties.

It's up on `.toJSON()` implementation to handle circular references and enumerability of the properties.

Example:

```js
const date = {date: new Date(0)};
serializeError(date);
// => {}
serializeError(date, {allowToJSON: true});
// => {date: '1970-01-01T00:00:00.000Z'}

const obj = {
    foo: 'bar',
    toJSON() {
        return serializeError(this);
    }
};
serializeError(obj);
// => {foo: 'bar'}
serializeError(obj, {allowToJSON: true});
// => {foo: 'bar'}
```

### deserializeError(value)

Type: `{[key: string]: unknown} | unknown`

Deserialize a plain object or any value into an `Error` object.

`Error` objects are passed through.
Non-error values are wrapped in a `NonError` error.
Custom properties are preserved.
Circular references are handled.
