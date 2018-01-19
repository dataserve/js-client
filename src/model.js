'use strict';

const { ds, state } = require('./ds');
const Result = require('./result');

class Model {

    static add(fields, ...opts) {
        return this.change('add', fields, ...opts);
    }

    static get(input, ...opts) {
        let payload = this.buildGetPayload(input, ...opts);
        
        return ds('get', this.table, payload).then((result) => {
            return this.returnModel(result, payload.fill);
        });
    }

    static getMany(input, ...opts) {
        let payload = this.buildGetPayload(input, ...opts);

        return ds('getMany', this.table, payload).then((result) => {
            return this.returnModel(result, payload.fill);
        });
    }

    static inc(primaryKeyVal, ...opts) {
        return this.change('inc', primaryKeyVal, ...opts);
    }

    static lookup(payload, ...opts) {
        payload = this.buildLookupPayload(payload, ...opts);
        
        return ds('lookup', this.table, payload).then((result) => {
            return this.returnModel(result, payload.fill);            
        });
    }
        
    static remove(primaryKeyVal) {
        return ds('remove', this.table, primaryKeyVal).then((result) => {
            return;
        });
    }

    static set(fields, ...opts) {
        return this.change('set', fields, ...opts);
    }
    
    static change(command, input, ...opts) {
        let payload = command === 'inc' ?
            this.buildIncPayload(input, ...opts) : this.buildChangePayload(input, ...opts);
        
        return ds(command, this.table, payload).then((result) => {
            if (payload.outputStyle) {
                return this.returnModel(result, payload.fill);
            }
        });
    }

    static returnModel(result, fill) {
        if (!result.data) {
            return null;
        }
        
        if (!Array.isArray(result.data)) {
            return (new this).setResult(result, fill);
        }

        return Object.keys(result.data).map(data => {
            return (new this).setResult(new Result(true, data, result.meta), fill);
        });
    }

    static buildGetPayload(input, ...opts) {
        if (!opts.length) {
            return input;
        }

        let payload = input;
        
        if (typeof input !== 'object' || Array.isArray(input)) {
            payload = {
                [this.primaryKey]: input,
            };
        }

        opts.forEach((opt) => {
            if (typeof opt === 'boolean' || opt === 'BY_ID') {
                if (opt) {
                    payload.outputStyle = 'BY_ID';
                }
            } else {
                this.addPayloadFill(payload, opt);
            }
        });

        return payload;
    }

    static buildIncPayload(field, ...opts) {
        if (!opts.length) {
            return field;
        }
        
        let payload = {
            [this.primaryKey]: field,
        };

        opts.forEach((opt) => {
            if (typeof opt === 'boolean' || opt === 'RETURN_CHANGES') {
                if (opt) {
                    payload.outputStyle = 'RETURN_CHANGES';
                }
            } else {
                this.addPayloadFill(payload, opt);
            }
        });

        return payload;
    }
    
    static buildChangePayload(fields, ...opts) {
        let payload = {
            fields: fields,
        };

        if (fields.fields
            && typeof fields.fields === 'object'
            && !Array.isArray(fields.fields)) {
            payload = fields;
        }

        if (!opts.length) {
            return payload;
        }
        
        opts.forEach((opt) => {
            if (typeof opt === 'boolean' || opt === 'RETURN_CHANGES') {
                if (opt) {
                    payload.outputStyle = 'RETURN_CHANGES';
                }
            } else {
                this.addPayloadFill(payload, opt);
            }
        });

        return payload;
    }

    static buildLookupPayload(payload, ...opts) {
        if (!opts.length) {
            return payload;
        }

        opts.forEach((opt) => {
            if (typeof opt === 'boolean' || opt === 'BY_ID') {
                if (opt) {
                    payload.outputStyle = 'BY_ID';
                }
            } else {
                this.addPayloadFill(payload, opt);
            }
        });

        return payload;
    }

    static addPayloadFill(payload, opt, fillPass=true) {
        if (!payload.fill) {
            payload.fill = {};
        }
        
        if (typeof opt === 'string') {
            if (this.fills[opt]) {
                let tableName = this.fills[opt].tableName;

                if (tableName !== opt) {
                    tableName += ':' + opt;
                }
                
                payload.fill[tableName] = fillPass;
            } else {
                payload.fill[opt] = fillPass;
            }
        } else if (Array.isArray(opt)) {
            opt.forEach((val) => {
                this.addPayloadFill(payload);
            });
        } else if (typeof opt === 'object') {
            Object.keys(opt).forEach((val) => {
                this.addPayloadFill(payload, val, opt[val]);
            });
        }
    }
    
    constructor() {
        this.data = null;

        this.meta = null;

        this.fill = null;

        this.primaryKey = this.constructor.primaryKey;

        this.table = this.constructor.table;

        return this;
    }

    d(field) {
        if (this.data === null) {
            return undefined;
        }
        
        return this.data[field];
    }

    getMeta(field) {
        if (this.meta === null) {
            return undefined;
        }
        
        return this.meta[field];
    }
    
    getTable() {
        return this.table;
    }

    toObject() {
        return new Result(true, this.data, this.meta).toObject();
    }

    setResult(result, fill) {
        if (result.isError()) {
            throw new Error('Cannot set errored result to model');
        }
        
        this.data = result && result.data || null;

        this.meta = result && result.meta || {};

        if (this.data && typeof this.constructor.fills === 'object') {
            for (let fillAlias in this.constructor.fills) {
                if (!this.data[fillAlias]) {
                    continue;
                }
                
                this.data[fillAlias] = (new this.constructor.fills[fillAlias].model)
                    .setResult(new Result(true, this.data[fillAlias]));
            }
        }

        if (fill) {
            this.fill = fill;
        }

        return this;
    }

    get(...opts) {
        if (!this.data[this.primaryKey]) {
            return state.Promise.reject('model not populated');
        }

        if (this.fill) {
            opts.push(this.fill);
        }

        let payload = this.constructor.buildGetPayload(this.data[this.primaryKey], ...opts);
        
        return ds('get', this.table, payload).then((result) => {
            this.setResult(result, payload.fill);
        });
    }

    set(fields, refreshModel=false) {
        return this.change('set', fields, refreshModel);
    }

    inc(payload, refreshModel=false) {
        return this.change('inc', payload, refreshModel);
    }
    
    remove() {
        if (!this.data[this.primaryKey]) {
            return state.Promise.reject('model not populated');
        }

        return ds('remove', this.table, this.data[this.primaryKey]).then((result) => {
            this.setResult(new Result(true, null, {}));
        });
    }
    
    change(command, input, refreshModel) {
        if (!this.data[this.primaryKey]) {
            return state.Promise.reject('model not populated');
        }

        let payload;

        let opts = [];

        if (refreshModel) {
            opts = [ true ];

            if (this.fill) {
                opts.push(this.fill);
            }
        }
        
        if (command === 'inc') {
            payload = this.constructor.buildIncPayload(input, ...opts);
        } else {
            input[this.primaryKey] = this.data[this.primaryKey];
            
            payload = this.constructor.buildChangePayload(input, ...opts);
        }

        return ds(command, this.table, payload).then((result) => {
            if (payload.outputStyle) {
                this.setResult(result);
            }
        });
    }
    
}

module.exports = Model;
