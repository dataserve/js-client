Client to connect to dataserve using the redis protocol

## Installation
```
npm install dataserve-client
```

## Usage

```js
const { init: dsInit, ds } = require('dataserve-client');

/**
 * @param {Object} redisOpt    options for require('redis').createClient(redisOpt): tcp/unix socket, port, etc
 * @param {Object} Promise     (optional) Promise library to use
 * @param {Object} fullDebug   (optional) output payload when DEBUG=dataserve-client is enabled
 */
dsInit({ path: '/var/run/dataserve.sock' }, require('bluebird'), true);

ds('add', 'user', { name: 'Joe', 'email': 'joe@joe.com', password: 'hunter2' });

// Dataserve command
DS_ADD user {"name":"Joe", "email":"joe@joe.com","password":"hunter2"}

// Debug outputs
2018-01-08T23:53:53.436Z dataserve-client add SUCCESS [ 'user', '{"name":"Joe","email":"joe@joe.com","password":"hunter2"}' ] {"status":true,"result":null,"meta":{}} 0.012563
```
