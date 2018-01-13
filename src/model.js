'use strict';

const { ds, state } = require('./ds');
const Result = require('./result');

class Model {

    static returnModel(result) {
        if (!result.data) {
            return {};
        }
        
        if (!Array.isArray(result.data)) {
            return {
                model: (new this).setResult(result),
            };
        }

        return {
            models: result.data.map(data => {
                return (new this).setResult(new Result(true, data, result.meta));
            }),
        }
    }

    static change(command, payload, returnModel) {
        if (returnModel) {
            if (Array.isArray(payload)) {
                payload = {
                    fields: payload,
                    outputStyle: 'RETURN_CHANGES',
                };
            } else {
                payload = Object.assign({}, payload, { outputStyle: 'RETURN_CHANGES' });
            }
        }
        
        return ds(command, this.table, payload).then((result) => {
            if (result.isError()) {
                return { error: result };
            }

            if (returnModel) {
                return this.returnModel(result);
            }

            return {};
        });
    }
    
    static add(payload, returnModel) {
        return this.change('add', payload, returnModel);
    }

    static set(payload, returnModel) {
        return this.change('set', payload, returnModel);
    }

    static inc(payload, returnModel) {
        return this.change('inc', payload, returnModel);
    }
    
    static get(primaryKeyVal) {
        return ds('get', this.table, primaryKeyVal).then((result) => {
            if (result.isError()) {
                return { error: result };
            }

            return this.returnModel(result);
        });
    }
    
    remove(primaryKeyVal) {
        return ds('remove', this.table, primaryKeyVal).then((result) => {
            if (result.isError()) {
                return { error: result };
            }
            
            return {};
        });
    }

    /*
    getMulti(payload) {
        return ds('get', this.table, payload);
    }
    */
    
    constructor() {
        this.data = null;

        this.meta = null;

        return this;
    }

    getTable() {
        return this.table;
    }

    setResult(result) {
        if (result.isError()) {
            throw new Error('Cannot set errored result to model');
        }
        
        this.data = result && result.data || null;

        this.meta = result && result.meta || {};

        return this;
    }

    get() {
        if (!this.data[this.primaryKey]) {
            return state.Promise.reject('model not populated');
        }
        
        return ds('get', this.table, this.data[this.primaryKey]).then((result) => {
            if (result.isError()) {
                return { error: result };
            }

            return this.setResult(result);
        });
    }

    change(command, payload, refreshModel) {
        if (!this.data[this.primaryKey]) {
            return state.Promise.reject('model not populated');
        }

        payload[this.primaryKey] = this.data[this.primaryKey];

        if (refreshModel) {
            payload = {
                fields: payload,
                outputStyle: 'RETURN_CHANGES',
            };
        }

        return ds('set', this.table, payload).then((result) => {
            if (result.isError()) {
                return result;
            }

            if (refreshModel) {
                this.setResult(result);
            }

            return null;
        });
    }
    
    add(payload, refreshModel) {
        return this.change('add', payload, refreshModel);
    }

    set(payload, refreshModel) {
        return this.change('set', payload, refreshModel);
    }

    inc(payload, refreshModel) {
        return this.change('inc', payload, refreshModel);
    }
    
    remove(payload) {
        if (!this.data[this.primaryKey]) {
            return state.Promise.reject('model not populated');
        }

        payload[this.primaryKey] = this.data[this.primaryKey];

        return ds('remove', this.table, payload).then((result) => {
            if (result.isError()) {
                return result;
            }

            this.setResult(new Result(true, null, {}));

            return null;
        });
    }

    /*
    getMulti(payload) {
        return ds('get', this.table, payload);
    }    
    */

}

module.exports = Model;
