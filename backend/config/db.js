const mysql = require('mysql2');

const pool = mysql.createPool({
    host: 'mysql-1066d366-silpakorn-joinjoy.j.aivencloud.com', 
    user: 'avnadmin',
    password: 'AVNS_udpq4sPQJKS-nsh0bpM', 
    database: 'defaultdb',
    port: 16356, 
    ssl: { rejectUnauthorized: false } 
});

module.exports = pool.promise();