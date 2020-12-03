import test from 'ava';
import {serializeError, deserializeError} from '.';

function deserializeNonError(t, value) {
	const deserialized = deserializeError(value);
	t.true(deserialized instanceof Error);
	t.is(deserialized.constructor.name, 'NonError');
	t.is(deserialized.message, JSON.stringify(value));
}

test('main', t => {
	const serialized = serializeError(new Error('foo'));
	const properties = Object.keys(serialized);

	t.true(properties.includes('name'));
	t.true(properties.includes('stack'));
	t.true(properties.includes('message'));
});

test('should destroy circular references', t => {
	const object = {};
	object.child = {parent: object};

	const serialized = serializeError(object);
	t.is(typeof serialized, 'object');
	t.is(serialized.child.parent, '[Circular]');
});

test('should not affect the original object', t => {
	const object = {};
	object.child = {parent: object};

	const serialized = serializeError(object);
	t.not(serialized, object);
	t.is(object.child.parent, object);
});

test('should only destroy parent references', t => {
	const object = {};
	const common = {thing: object};
	object.one = {firstThing: common};
	object.two = {secondThing: common};

	const serialized = serializeError(object);
	t.is(typeof serialized.one.firstThing, 'object');
	t.is(typeof serialized.two.secondThing, 'object');
	t.is(serialized.one.firstThing.thing, '[Circular]');
	t.is(serialized.two.secondThing.thing, '[Circular]');
});

test('should work on arrays', t => {
	const object = {};
	const common = [object];
	const x = [common];
	const y = [['test'], common];
	y[0][1] = y;
	object.a = {x};
	object.b = {y};

	const serialized = serializeError(object);
	t.true(Array.isArray(serialized.a.x));
	t.is(serialized.a.x[0][0], '[Circular]');
	t.is(serialized.b.y[0][0], 'test');
	t.is(serialized.b.y[1][0], '[Circular]');
	t.is(serialized.b.y[0][1], '[Circular]');
});

test('should discard nested functions', t => {
	function a() {}
	function b() {}
	a.b = b;
	const object = {a};

	const serialized = serializeError(object);
	t.deepEqual(serialized, {});
});

test('should replace top-level functions with a helpful string', t => {
	function a() {}
	function b() {}
	a.b = b;

	const serialized = serializeError(a);
	t.is(serialized, '[Function: a]');
});

test('should drop functions', t => {
	function a() {}
	a.foo = 'bar;';
	a.b = a;
	const object = {a};

	const serialized = serializeError(object);
	t.deepEqual(serialized, {});
	t.false(Object.prototype.hasOwnProperty.call(serialized, 'a'));
});

test('should not access deep non-enumerable properties', t => {
	const error = new Error('some error');
	const object = {};
	Object.defineProperty(object, 'someProp', {
		enumerable: false,
		get() {
			throw new Error('some other error');
		}
	});
	error.object = object;
	t.notThrows(() => serializeError(error));
});

test('should serialize nested errors', t => {
	const error = new Error('outer error');
	error.innerError = new Error('inner error');

	const serialized = serializeError(error);
	t.is(serialized.message, 'outer error');
	t.is(serialized.innerError.message, 'inner error');
});

test('should handle top-level null values', t => {
	const serialized = serializeError(null);
	t.is(serialized, null);
});

test('should deserialize null', t => {
	deserializeNonError(t, null);
});

test('should deserialize number', t => {
	deserializeNonError(t, 1);
});

test('should deserialize boolean', t => {
	deserializeNonError(t, true);
});

test('should deserialize string', t => {
	deserializeNonError(t, '123');
});

test('should deserialize array', t => {
	deserializeNonError(t, [1]);
});

test('should deserialize error', t => {
	const deserialized = deserializeError(new Error('test'));
	t.true(deserialized instanceof Error);
	t.is(deserialized.message, 'test');
});

test('should deserialize and preserve existing properties', t => {
	const deserialized = deserializeError({
		message: 'foo',
		customProperty: true
	});
	t.true(deserialized instanceof Error);
	t.is(deserialized.message, 'foo');
	t.true(deserialized.customProperty);
});

test('should deserialize plain object', t => {
	const object = {
		message: 'error message',
		stack: 'at <anonymous>:1:13',
		name: 'name',
		code: 'code'
	};

	const deserialized = deserializeError(object);
	t.is(deserialized instanceof Error, true);
	t.is(deserialized.message, 'error message');
	t.is(deserialized.stack, 'at <anonymous>:1:13');
	t.is(deserialized.name, 'name');
	t.is(deserialized.code, 'code');
});

test('deserialized name, stack and message should not be enumerable, other props should be', t => {
	const object = {
		message: 'error message',
		stack: 'at <anonymous>:1:13',
		name: 'name'
	};
	const nonEnumerableProps = Object.keys(object);

	const enumerables = {
		code: 'code',
		path: './path',
		errno: 1,
		syscall: 'syscall',
		randomProperty: 'random'
	};
	const enumerableProps = Object.keys(enumerables);

	const deserialized = deserializeError({...object, ...enumerables});
	const deserializedEnumerableProps = Object.keys(deserialized);

	for (const prop of nonEnumerableProps) {
		t.false(deserializedEnumerableProps.includes(prop));
	}

	for (const prop of enumerableProps) {
		t.true(deserializedEnumerableProps.includes(prop));
	}
});

test('should serialize Date as empty object', t => {
	const date = {date: new Date(0)};
	const serialized = serializeError(date);
	t.deepEqual(serialized, {date: {}});
});

test('should serialize Date as ISO string', t => {
	const date = {date: new Date(0)};
	const serialized = serializeError(date, {allowToJSON: true});
	t.deepEqual(serialized, {date: '1970-01-01T00:00:00.000Z'});
});

test('should serialize custom error with `.toJSON`', t => {
	class CustomError extends Error {
		constructor() {
			super('foo');
			this.name = this.constructor.name;
			this.value = 10;
		}

		toJSON() {
			return {
				message: this.message,
				amount: `$${this.value}`
			};
		}
	}
	const err = new CustomError();
	const serialized = serializeError(err, {allowToJSON: true});
	t.deepEqual(serialized, {
		message: 'foo',
		amount: '$10'
	});
	t.true(serialized.stack === undefined);

	const serializedDefault = serializeError(err);
	const {stack, ...rest} = serializedDefault;
	t.deepEqual(rest, {
		message: 'foo',
		name: 'CustomError',
		value: 10
	});
});

test('should serialize custom error with a property having `.toJSON`', t => {
	class CustomError extends Error {
		constructor(value) {
			super('foo');
			this.name = this.constructor.name;
			this.value = value;
		}
	}
	const value = {
		amount: 20,
		toJSON() {
			return {
				amount: `$${this.amount}`
			};
		}
	};
	const err = new CustomError(value);
	const serialized = serializeError(err, {allowToJSON: true});
	const {stack, ...rest} = serialized;
	t.deepEqual(rest, {
		message: 'foo',
		name: 'CustomError',
		value: {
			amount: '$20'
		}
	});
	t.true(stack !== undefined);
});

test('should serialize custom error with `.toJSON` defined with `serializeError`', t => {
	class CustomError extends Error {
		constructor() {
			super('foo');
			this.name = this.constructor.name;
			this.value = 30;
		}

		toJSON() {
			return serializeError(this);
		}
	}
	const err = new CustomError();
	const serialized = serializeError(err, {allowToJSON: true});
	const {stack, ...rest} = serialized;
	t.deepEqual(rest, {
		message: 'foo',
		name: 'CustomError',
		value: 30
	});
	t.true(stack !== undefined);
	const serializedDefault = serializeError(err);
	t.deepEqual(serialized, serializedDefault);
});
