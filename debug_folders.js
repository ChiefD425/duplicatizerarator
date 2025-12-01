const { app } = require('electron');
const Database = require('better-sqlite3');
const path = require('path');

app.whenReady().then(() => {
    try {
        const dbPath = path.join(process.env.APPDATA, 'Duplicatizerarator', 'duplicatizerarator.db');
        console.log('Opening DB at:', dbPath);

        const db = new Database(dbPath);

        const folder1 = 'D:\\users\\fredd\\Downloads\\forge-gui-desktop-1.6.7.tar\\res\\music\\match';
        const folder2 = 'C:\\Users\\fredd\\Dropbox\\MTG\\forge\\res\\music\\match';

        // Normalize for SQL LIKE
        const p1 = folder1.replace(/\\/g, '%');
        const p2 = folder2.replace(/\\/g, '%');

        console.log('Querying for files in:', folder1);
        const files1 = db.prepare(`SELECT path, size, partial_hash, full_hash FROM files WHERE path LIKE ?`).all(p1 + '%');
        console.log(JSON.stringify(files1, null, 2));

        console.log('Querying for files in:', folder2);
        const files2 = db.prepare(`SELECT path, size, partial_hash, full_hash FROM files WHERE path LIKE ?`).all(p2 + '%');
        console.log(JSON.stringify(files2, null, 2));
        
        app.quit();
    } catch (e) {
        console.error(e);
        app.quit();
    }
});
