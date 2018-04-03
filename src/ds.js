'use strict';

const debug = require('debug');
const microtime = require('microtime');
const Redis = require('redis');
const util = require('util');
const uuid = require('uuid/v1');

const Result = require('./result');

const log = debug('dataserve-client:info');

log.log = console.log.bind(console);

const error = debug('dataserve-client:error');

const state = {
    client: null,
    fullDebug: null,
    Promise: null,
    commandLookup: {},
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
    'raw': 'DS_RAW',
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

        //const commandUuid = new Buffer(uuid().replace(/-/g, ''), 'hex').toString('base64');
        //node_redis does toLowerCase on commands, so can't rely on case sensitivity of base64
        const commandUuid = uuid().replace(/-/g, '');

        const commandRaw = `${ALLOWED_COMMANDS[command]}:${commandUuid}`;

        let timeStart = microtime.now();

        state.commandLookup[commandUuid] = [ command, payload, resolve, reject, timeStart ];
        
        state.client.send_command(commandRaw, payload, (err, result) => {
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

            if (result.meta.commandUuid && state.commandLookup[result.meta.commandUuid]) {
                [ command, payload, resolve, reject, timeStart ] = state.commandLookup[result.meta.commandUuid];

                delete state.commandLookup[result.meta.commandUuid];
            } else {
                reject(createResult(false, 'An internal error occurred: command UUID'));

                return;
            }

            Object.freeze(result);

            if (result.isSuccess()) {
                if (state.fullDebug) {
                    log(command, 'SUCCESS', payload, util.inspect(result.toObject(), false, null), (microtime.now() - timeStart) / 1000000);
                } else {
                    log(command, 'SUCCESS', payload, (microtime.now() - timeStart) / 1000000);
                }
            } else {
                error(command, 'FAIL', payload, util.inspect(result.toObject(), false, null), (microtime.now() - timeStart) / 1000000);
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
