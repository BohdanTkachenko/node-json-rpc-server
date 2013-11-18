var
  _ = require('underscore'),
  async = require('async');

module.exports = function () {
  var me = this;

  this._methods = {};
  this._errors = {};
  this.events = new (require('events').EventEmitter)();

  this.request = function (params) {
    var isCapsule = true;

    if (!_.isFunction(params.callback)) {
      throw new Error('callback should be a function');
    }

    if (!_.isArray(params.data) && !_.isObject(params.data)) {
      params.callback(me._makeErrorResponse(-32700));

      me.events.emit('request_raw', null);
      me.events.emit('request', null);
      me.events.emit('response_raw', [ me._makeErrorResponse(-32700)] );
      me.events.emit('response', me._makeErrorResponse(-32700));

      return;
    }

    if (!_.isArray(params.data)) {
      params.data = [ params.data ];
      isCapsule = false;
    }

    async.map(params.data, me._handleCall, function (err, results) {
      me.events.emit('response_raw', results);

      if (!isCapsule) {
        params.callback(results[0]);
        me.events.emit('response', results[0]);
      } else {
        params.callback(results);
        results.map(function (result) {
          me.events.emit('response', result);
        });
      }
    });
  };

  this.registerMethod = function (name) {
    if (!name) {
      throw new Error('no method name');
    }

    if (/^rpc_/.test(name)) {
      throw new Error('method name is reserved');
    }

    if (typeof me._methods[name] !== 'undefined') {
      throw new Error('method "' + name + '" is already registered');
    }

    var handlers = _.toArray(arguments).slice(1);
    if (!_.all(handlers, _.isFunction)) {
      throw new Error('handler callback should be a function');
    }

    if (handlers.length === 0) {
      throw new Error('there should be at least one handler callback');
    }

    me._methods[name] = handlers;
  };

  this.addCustomError = function (code, message, force) {
    code = parseInt(code, 10);

    if (code <= 0) {
      throw new Error('error code should be greater then zero');
    }

    me._addError(code, message, force);
  };

  this._handleCall = function (item, callback) {
    me.events.emit('request_raw', item);

    if (!_.isFunction(callback)) {
      throw new Error('wrong callback given');
    }

    if (!_.isObject(item)) {
      callback(null, me._makeErrorResponse(-32600));
      return;
    }

    if (item.jsonrpc !== '2.0' || _.isUndefined(item.method) || _.isUndefined(item.params)) {
      callback(null, me._makeErrorResponse(-32600));
      return;
    }

    if (!me._methods[item.method]) {
      callback(null, me._makeErrorResponse(-32601, item.id));
      return;
    }

    me.events.emit('request', item);

    var handlers = [ function (cb) {
      cb(null, item.params);
    } ].concat(me._methods[item.method]);

    async.waterfall(handlers, function (err, result) {
      if (err) {
        callback(null, me._makeErrorResponse(err, item.id));
        return;
      }

      if (item.id) {
        callback(null, me._makeResponse(result, item.id));
      }
    });
  };

  this._addError = function (code, message, force) {
    code = parseInt(code, 10);

    if (!message) {
      throw new Error('no error message');
    }

    if (!force && me._errors[code]) {
      throw new Error('error code is already defined');
    }

    me._errors[code] = message;
  };

  this._makeResponse = function (result, id) {
    if (_.isUndefined(result)) {
      throw new Error('no result');
    }

    if (!id) {
      throw new Error('no call id');
    }

    return {
      jsonrpc: '2.0',
      result: result,
      id: id
    };
  };

  this._makeErrorResponse = function (code, id) {
    if (!me._errors[code]) {
      throw new Error('error "' + code + '" does not exists');
    }

    id = id || null;

    return {
      jsonrpc: '2.0',
      error: {
        code: code,
        message: me._errors[code]
      },
      id: id
    };
  };

  this._addError(-32700, 'Parse error.');
  this._addError(-32600, 'Invalid Request.');
  this._addError(-32601, 'Method not found.');
  this._addError(-32602, 'Invalid params.');
  this._addError(-32603, 'Internal error.');
};