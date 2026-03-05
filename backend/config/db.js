const mysql = require('mysql2');

const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',      // ใส่ Username ของ MySQL Oom
    password: '',      // ใส่ Password ถ้ามี
    database: 'joinjoy' // ชื่อ Database ที่ Oom สร้างไว้
});

// ใช้ promise() เพื่อให้ใช้ async/await ใน board.js ได้
module.exports = pool.promise();