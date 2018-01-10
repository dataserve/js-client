'use strict';

const debug = require('debug')('dataserve-client');
const microtime = require('microtime');
const Redis = require('redis');

const state = {
    client: null,
    fullDebug: null,
    Promise: null,
};

function init(redisOpt, promise, fullDebug) {
    if (state.client) {
        return;
    }

    state.Promise = promise || Promise;

    state.fullDebug = fullDebug;
    
    state.client = Redis.createClient(redisOpt);
}

const ALLOWED_COMMANDS = {
    'add': 'DS_ADD',
    'get': 'DS_GET',
    'flushCache': 'DS_FLUSH_CACHE',
    'getCount': 'DS_GET_COUNT',
    'getMulti': 'DS_GET_MULTI',
    'log': 'DS_LOG',
    'lookup': 'DS_LOOKUP',
    'outputCache': 'DS_OUTPUT_CACHE',
    'outputDbSchema': 'DS_OUTPUT_DB_SCHEMA',
    'outputTableSchema': 'DS_OUTPUT_TABLE_SCHEMA',
    'remove': 'DS_REMOVE',
    'set': 'DS_SET',
};

function ds(command, dbTable, payload) {
    return new state.Promise((resolve, reject) => {
        if (!state.client) {
            return reject('Client has not been connected');
        }
        
        if (!ALLOWED_COMMANDS[command]) {
            return reject('An invalid command was requested');
        }

        if (payload) {
            payload = [dbTable, JSON.stringify(payload)];
        } else if (dbTable) {
            payload = [dbTable];
        } else {
            payload = [];
        }

        let timeStart = microtime.now();
        
        state.client.send_command(ALLOWED_COMMANDS[command], payload, (err, result) => {
            if (err) {
                reject('An internal error occurred: protocol: ' + err);
                
                return;
            }
            
            try {
                result = JSON.parse(result);
            } catch (err) {
                reject('An internal error occurred: json');
                
                return;
            }

            try {
                result = new Result().setResult(result);
            } catch (err) {
                reject(err);

                return;
            }

            Object.freeze(result);

            if (state.fullDebug) {
                debug(command, result.isSuccess() ? 'SUCCESS' : 'FAIL', payload, result.toObject(), (microtime.now() - timeStart) / 1000000);
            } else {
                debug(command, result.isSuccess() ? 'SUCCESS' : 'FAIL', (microtime.now() - timeStart) / 1000000);
            }
            
            resolve(result);
        });
    });
}

class Result {

    constructor(status=null, res=null, meta={}) {
        this.status = status;

        if (status !== null) {
            if (status) {
                this.result = res;
            } else {
                this.error = res;
            }
        }

        this.meta = meta;

        return this;
    }

    isSuccess() {
        return this.status;
    }

    isError() {
        return !this.status;
    }

    setResult(result) {
        if (!result
            || (typeof result.status === 'undefined' || result.status === null)
            || (typeof result.result === 'undefined' && typeof result.error === 'undefined')
            || typeof result.meta !== 'object') {
            throw new Error('invalid result object');
            
            return;
        }

        this.status = result.status;

        if (this.status) {
            this.result = result.result;
        } else {
            this.error = result.error;
        }

        this.meta = result.meta;

        return this;
    }

    toObject() {
        if (this.status) {
            return {
                status: true,
                result: this.result,
                meta: this.meta,
            };
        };

        return {
            status: false,
            error: this.error,
            meta: this.meta,
        };
    }
    
}

module.exports = {
    init,
    ds,
    Result,
};
