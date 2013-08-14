var jsonRpcServer = require('../json-rpc-server');

exports.testInit = function (test) {
    test.expect(2);

    var rpc = new jsonRpcServer();

    test.deepEqual(rpc._methods, {});
    test.deepEqual(rpc._errors, {
        '-32700': 'Parse error.',
        '-32600': 'Invalid Request.',
        '-32601': 'Method not found.',
        '-32602': 'Invalid params.',
        '-32603': 'Internal error.'
    });

    test.done();
};

exports.testRequest = function (test) {
    test.expect(1);

    var rpc = new jsonRpcServer();

    rpc.registerMethod('sum', function (params, callback) {
        callback(null, (params.first + params.second));
    });

    rpc.request({
        data: {
            jsonrpc: '2.0',
            method: 'sum',
            params: {
                first: 5,
                second: 8
            },
            id: 777
        },
        callback: function (result) {
            test.deepEqual(result, {
                jsonrpc: '2.0',
                result: 13,
                id: 777
            });
        }
    });

    // Need to do this as nodeunit don't want to wait while async.waterfall is working
    setTimeout(function () {
        test.done();
    }, 10);
};

exports.testBatchRequest = function (test) {
    test.expect(1);

    var rpc = new jsonRpcServer();

    rpc.registerMethod('sum', function (params, callback) {
            callback(null, (params.first + params.second));
    });

    rpc.request({
        data: [
            {
                jsonrpc: '2.0',
                method: 'sum',
                params: {
                    first: 5,
                    second: 8
                },
                id: 777
            },
            {
                jsonrpc: '2.0',
                method: 'pow',
                params: {
                    first: 5,
                    second: 8
                },
                id: 778
            },
            {
                jsonrpc: '2.0',
                method: 'pow',
                params: {
                    first: 2,
                    second: 12
                },
                id: 779
            },
            {
                jsonrpc: '2.0',
                method: 'sum',
                params: {
                    first: 63,
                    second: 31
                },
                id: 780
            }
        ],
        callback: function (result) {
            test.deepEqual(result, [
                {
                    jsonrpc: '2.0',
                    result: 13,
                    id: 777
                },
                {
                    jsonrpc: '2.0',
                    error:
                    {
                        code: -32601,
                        message: 'Method not found.'
                    },
                    id: 778
                },
                {
                    jsonrpc: '2.0',
                    error: {
                        code: -32601,
                        message: 'Method not found.'
                    },
                    id: 779
                },
                {
                    jsonrpc: '2.0',
                    result: 94,
                    id: 780
                }
            ]);
        }
    });

    // Need to do this as nodeunit don't want to wait while async.waterfall is working
    setTimeout(function () {
        test.done();
    }, 10);
};

exports.testRequestMiddleWare = function (test) {
    test.expect(1);

    var rpc = new jsonRpcServer();

    rpc.registerMethod('sum', function (params, callback) {
        params.first = -params.first;
        params.second = -params.second;

        callback(null, params);
    }, function (params, callback) {
        callback(null, (params.first + params.second));
    });

    rpc.request({
        data: {
            jsonrpc: '2.0',
            method: 'sum',
            params: {
                first: 5,
                second: 8
            },
            id: 777
        },
        callback: function (result) {
            test.deepEqual(result, {
                jsonrpc: '2.0',
                result: -13,
                id: 777
            });
        }
    });

    // Need to do this as nodeunit don't want to wait while async.waterfall is working
    setTimeout(function () {
        test.done();
    }, 10);
};

exports.testNotification = function (test) {
    test.expect(1);

    var
        rpc = new jsonRpcServer(),
        called = false;

    rpc.registerMethod('sum', function (params, callback) {
        callback(null, (params.first + params.second));
    });

    rpc.request({
        data: {
            jsonrpc: '2.0',
            method: 'sum',
            params: {
                first: 5,
                second: 8
            }
        },
        callback: function () {
            called = true;
        }
    });

    // Need to do this as nodeunit don't want to wait while async.waterfall is working
    setTimeout(function () {
        // Notification should not callback in the end and not return anything
        test.strictEqual(called, false);
        test.done();
    }, 100);
};


exports.testRequestWrongDataError = function (test) {
    test.expect(5);

    var rpc = new jsonRpcServer();

    rpc.events.once('request_raw', function (request) {
        test.strictEqual(request, null);
    });

    rpc.events.once('request', function (request) {
        test.strictEqual(request, null);
    });

    rpc.events.once('response_raw', function (request) {
        test.deepEqual(request, [
            {
                jsonrpc: '2.0',
                error: {
                    code: -32700,
                    message: 'Parse error.'
                },
                id: null
            }
        ]);
    });

    rpc.events.once('response', function (request) {
        test.deepEqual(request, {
            jsonrpc: '2.0',
            error: {
                code: -32700,
                message: 'Parse error.'
            },
            id: null
        });
    });

    rpc.request({
        data: false,
        callback: function (result) {
            test.deepEqual(result, {
                jsonrpc: '2.0',
                error:
                {
                    code: -32700,
                    message: 'Parse error.'
                },
                id: null
            });
        }
    });

    test.done();
};

exports.testRequestWrongCallbackException = function (test) {
    test.expect(1);

    var rpc = new jsonRpcServer();

    test.throws(function () {
        rpc.request({
            callback: false
        });
    }, /callback should be a function/);

    test.done();
};

exports.testRegisterMethod = function (test) {
    test.expect(6);

    var
        rpc = new jsonRpcServer(),
        callbackFn = function () { };

    rpc.registerMethod('ping', callbackFn);

    test.deepEqual(rpc._methods, { ping: [ callbackFn ] });

    test.throws(function () {
        rpc.registerMethod(null, callbackFn);
    }, /no method name/);

    test.throws(function () {
        rpc.registerMethod('rpc_test', callbackFn);
    }, /method name is reserved/);

    test.throws(function () {
        rpc.registerMethod('ping', callbackFn);
    }, /method "ping" is already registered/);

    test.throws(function () {
        rpc.registerMethod('test', null);
    }, /handler callback should be a function/);

    test.throws(function () {
        rpc.registerMethod('test');
    }, /there should be at least one handler callback/);

    test.done();
};

exports.testAddCustomError = function (test) {
    test.expect(4);

    var rpc = new jsonRpcServer();

    rpc.addCustomError(222, 'real test');
    test.deepEqual(rpc._errors, {
        '222': 'real test',
        '-32700': 'Parse error.',
        '-32600': 'Invalid Request.',
        '-32601': 'Method not found.',
        '-32602': 'Invalid params.',
        '-32603': 'Internal error.'
    });

    test.throws(function () {
        rpc.addCustomError(-111, 'test');
    }, /error code should be greater then zero/);

    test.throws(function () {
        rpc.addCustomError(222, 'test');
    }, /error code is already defined/);

    test.throws(function () {
        rpc.addCustomError(333, null);
    }, /no error message/);

    test.done();
};