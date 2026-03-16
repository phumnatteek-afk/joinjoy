require('dotenv').config(); // โหลดค่าจาก .env มาใช้
const mysql = require('mysql2');

const pool = mysql.createPool({
    host: 'mysql-1066d366-silpakorn-joinjoy.j.aivencloud.com', 
    user: 'avnadmin',
    password: process.env.DB_PASSWORD, // ดึงค่าจากไฟล์ .env
    database: 'defaultdb',
    port: 16356, 
    ssl: { rejectUnauthorized: false }
});

pool.on('connection', (connection) => {
    connection.query("SET time_zone = '+07:00'")
})

module.exports = pool.promise();