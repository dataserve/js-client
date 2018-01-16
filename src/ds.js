'use strict';

const debug = require('debug')('dataserve-client');
const microtime = require('microtime');
const Redis = require('redis');

const Result = require('./result');

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
    'getMany': 'DS_GET_MANY',
    'log': 'DS_LOG',
    'lookup': 'DS_LOOKUP',
    'outputCache': 'DS_OUTPUT_CACHE',
    'outputDbSchema': 'DS_OUTPUT_DB_SCHEMA',
    'outputTableSchema': 'DS_OUTPUT_TABLE_SCHEMA',
    'remove': 'DS_REMOVE',
    'set': 'DS_SET',
};

function createResult(status=null, data=null, meta={}) {
    meta.generatedBy = 'dataserve-client';

    return new Result(status, data, meta);
}

function ds(command, dbTable, payload) {
    if (!state.client) {
        return Promise.reject(createResult(false, 'Client has not been connected'));
    }
    
    return new state.Promise((resolve, reject) => {
        if (!ALLOWED_COMMANDS[command]) {
            return reject(createResult(false, 'An invalid command was requested'));
        }

        if (payload) {
            payload = [ dbTable, JSON.stringify(payload) ];
        } else if (dbTable) {
            payload = [ dbTable ];
        } else {
            payload = [];
        }

        let timeStart = microtime.now();
        
        state.client.send_command(ALLOWED_COMMANDS[command], payload, (err, result) => {
            if (err) {
                reject(createResult(false, 'An internal error occurred: protocol: ' + err));
                
                return;
            }
            
            try {
                result = JSON.parse(result);
            } catch (err) {
                reject(createResult(false, 'An internal error occurred: json'));
                
                return;
            }

            try {
                result = new Result().setResult(result);
            } catch (err) {
                reject(createResult(false, 'An internal error occurred: result'));

                return;
            }

            Object.freeze(result);

            if (state.fullDebug) {
                debug(command, result.isSuccess() ? 'SUCCESS' : 'FAIL', payload, result.toObject(), (microtime.now() - timeStart) / 1000000);
            } else {
                debug(command, result.isSuccess() ? 'SUCCESS' : 'FAIL', (microtime.now() - timeStart) / 1000000);
            }

            if (result.isError()) {
                reject(result);
            } else {
                resolve(result);
            }
        });
    });
}

module.exports = {
    state,
    init,
    ds,
};
