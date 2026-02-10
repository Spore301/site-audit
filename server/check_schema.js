const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'data/database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    db.all("PRAGMA table_info(Projects)", (err, rows) => {
        if (err) {
            console.error("Error:", err);
            return;
        }
        const hasPersonas = rows.some(r => r.name === 'personas');
        console.log("Columns:", rows.map(r => r.name));
        console.log("Has 'personas' column:", hasPersonas);
    });
});

db.close();
