'use strict';

class Result {

    constructor(status=null, data=null, meta={}) {
        this.status = null;

        this.data = null;

        this.error = null;
        
        this.meta = meta;

        if (status !== null) {
            if (status) {
                this.setSuccess(data, meta);
            } else {
                this.setError(data, meta);
            }
        }

        return this;
    }

    isSuccess() {
        return this.status;
    }

    isError() {
        return !this.status;
    }

    setSuccess(data, meta={}) {
        return this.setResult({
            status: true,
            data: data,
            meta: meta,
        });
    }

    setError(error, meta={}) {
        if (error instanceof Error) {
            //error = error.message;
            error = error.stack;
        }
        
        return this.setResult({
            status: false,
            error: error,
            meta: meta,
        });
    }
    
    setResult(result) {
        result = this.sanitizeResult(result);

        this.status = result.status;

        if (this.status) {
            this.data = result.data;
        } else {
            this.error = result.error;
        }

        this.meta = result.meta;

        return this;
    }

    sanitizeResult(result) {
        if (!result) {
            result = {
                status: false,
                error: 'Unknown',
                meta: {},
            };
        } else if (typeof result !== 'object') {
            if (typeof result === 'string' || typeof result === 'boolean' || typeof result === 'number') {
                result = {
                    status: false,
                    error: result,
                    meta: {},
                };
            } else {
                result = {
                    status: false,
                    error: 'Unknown',
                    meta: {},
                };
            }
        }
        
        if (typeof result.status !== 'boolean') {
            result.status = false;
        }

        if (typeof result.data === 'undefined' && typeof result.error === 'undefined') {
            if (result.status) {
                result.data = null;
            } else {
                result.error = 'Unknown';
            }
        }

        if (typeof result.meta !== 'object') {
            result.meta = {};
        }

        return result;
    }

    toObject() {
        if (this.status) {
            return {
                status: true,
                data: this.data,
                meta: this.meta,
            };
        };

        return {
            status: false,
            error: this.error,
            meta: this.meta,
        };
    }

    toJson() {
        return JSON.stringify(this.toObject());
    }

}

module.exports = Result;
