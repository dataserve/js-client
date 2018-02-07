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

    static lookup(payload={}, ...opts) {
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

        return result.data.map(data => {
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
                payload.fill = payload.fill || {};
                
                this.addFill(payload.fill, opt);
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
                payload.fill = payload.fill || {};
                
                this.addFill(payload.fill, opt);
            }
        });

        if (payload.fill && Object.keys(payload.fill).length) {
            payload.outputStyle = 'RETURN_CHANGES';
        }

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
                payload.fill = payload.fill || {};
                
                this.addFill(payload.fill, opt);
            }
        });

        if (payload.fill && Object.keys(payload.fill).length) {
            payload.outputStyle = 'RETURN_CHANGES';
        }

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
                payload.fill = payload.fill || {};
                
                this.addFill(payload.fill, opt);
            }
        });

        return payload;
    }

    static addFill(fill, opt, fillPass=true) {
        if (typeof opt === 'string') {
            if (this.fills[opt]) {
                let tableName;

                tableName = this.fills[opt].table;

                if (tableName !== opt) {
                    tableName += ':' + opt;
                }
                
                fill[tableName] = fillPass;

                return tableName;
            } else {
                fill[opt] = fillPass;

                return opt;
            }
        } else if (Array.isArray(opt)) {
            opt.forEach((val) => {
                this.addFill(fill, val);
            });
        } else if (typeof opt === 'object') {
            Object.keys(opt).forEach((key) => {
                let added = this.addFill(fill, key, {});

                for (let subKey in opt[key]) {
                    this.fills[key].addFill(fill[added], subKey, opt[key][subKey]);
                }
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

    toResult() {
        return new Result(true, this.data, this.meta);
    }
    
    toObject() {
        this.toResult().toObject();
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

                if (Array.isArray(this.data[fillAlias])) {
                    this.data[fillAlias] = this.data[fillAlias].map((data) => {
                        return (new this.constructor.fills[fillAlias])
                            .setResult(new Result(true, data))
                    });
                } else {
                    this.data[fillAlias] = (new this.constructor.fills[fillAlias])
                        .setResult(new Result(true, this.data[fillAlias]));
                }
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

    set(fields, ...opts) {
        return this.change('set', fields, ...opts);
    }

    inc(payload, ...opts) {
        return this.change('inc', payload, ...opts);
    }
    
    remove() {
        if (!this.data[this.primaryKey]) {
            return state.Promise.reject('model not populated');
        }

        return ds('remove', this.table, this.data[this.primaryKey]).then((result) => {
            this.setResult(new Result(true, null, {}));
        });
    }
    
    change(command, input, ...opts) {
        if (!this.data[this.primaryKey]) {
            return state.Promise.reject('model not populated');
        }

        let payload;

        if (this.fill) {
            opts.push(this.fill);
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
