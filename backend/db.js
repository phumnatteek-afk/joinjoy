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

module.exports = pool.promise();