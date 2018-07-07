const SaxAsync = require('sax-async');
const fs = require('fs');
const sqlite3 = require('sqlite3');
const through2 = require('through2');
const duplexify = require('duplexify');

const BATCH_SIZE = 5000;

const path = './notes.sqlite';
const db = new sqlite3.Database(path);
db.serialize(
    function () {
        db.run('PRAGMA synchronous = OFF');
        db.run('PRAGMA journal_mode = MEMORY');
        db.run(`CREATE TABLE IF NOT EXISTS comments (
            id INT PRIMARY KEY NOT NULL,
            note_id INT,
            latitude REAL,
            longitude REAL,
            created_at INTEGER,
            closed_at INTEGER,
            action TEXT,
            timestamp INTEGER,
            uid TEXT,
            user TEXT,
            text TEXT
        )
        `);
        db.run('DELETE FROM comments');
        main(db);
    }
)


function main(db) {
    let num_comments = 0;
    let buffer = []
    const batch = through2.obj(function (record, enc, callback) {
        buffer.push(record)
        if (buffer.length >= BATCH_SIZE) {
            this.push(buffer)
            buffer = []
        }
        callback()
    }, function (callback) {
        if (buffer.length) {
            this.push(buffer)
        }
        callback()
    })

    const stmt = db.prepare('INSERT INTO comments VALUES(?,?,?,?,?,?,?,?,?,?,?)');
    const batchSave = (db) => through2.obj(function (records, enc, callback) {
        db.serialize(function () {
            db.run('BEGIN TRANSACTION');
            records.forEach(function (record) {
                stmt.run([
                    num_comments, record.note_id, record.latitude, record.longitude, record.created_at,
                    record.closed_at, record.action, record.timestamp, record.uid, record.user,
                    record.text
                ])
                num_comments += 1;
                process.stdout.write(`saved ${num_comments} comments\r`);
            })
            db.run('COMMIT');
        })
        callback();
    })

    console.log('parsing');
    fs.createReadStream('./notes.xml')
        .pipe(parseNotes())
        .pipe(batch)
        .pipe(batchSave(db))
        .on('end', function () {
            db.close();
        })
        .on('error', function (err) {
            console.error(err);
            process.exit(1);
        });
}



/** 
 * Code adapted from
 * https://github.com/mapbox/osm-comments-parser/tree/master/notes
 */
function parseNotes() {
    var saxStream = new SaxAsync();
    var currentNote, currentComment;

    const ts = through2.obj(function (note, enc, callback) {
        var attribs = note.attributes;
        var note_id = attribs.ID;
        var lat = parseFloat(attribs.LAT);
        var lon = parseFloat(attribs.LON);
        var closed_at = attribs.CLOSED_AT;
        var created_at = attribs.CREATED_AT;

        let comments = note.comments.map((comment) => {
            let cattribs = comment.attributes;
            let action = cattribs.ACTION;
            let timestamp = cattribs.TIMESTAMP;
            let uid = cattribs.UID;
            let text = comment.text || '';
            return {
                note_id,
                latitude: lat,
                longitude: lon,
                closed_at: closed_at ? new Date(closed_at) : null,
                created_at: created_at ? new Date(created_at) : null,
                action,
                timestamp: timestamp ? new Date(timestamp) : null,
                uid,
                text
            }
        });
        comments.forEach(comment => this.push(comment))
        callback();
    });

    const dup = duplexify(saxStream, ts, {objectMode: true});

    saxStream.hookSync('opentag', function (node) {
        var tagName = node.name.toLowerCase();
        if (tagName === 'note') {
            currentNote = node;
            currentNote.comments = [];
        } else if (tagName === 'comment') {
            currentNote.comments.push(node);
            currentComment = node;
        }
    });
    saxStream.hookAsync('closetag', function (next, tagName) {
        tagName = tagName.toLowerCase();
        if (tagName === 'note') {
            ts.write(currentNote);
            currentNote = null;
        } else if (tagName === 'comment') {
            currentComment = null;
        }
        next()
    });
    saxStream.hookSync('text', function (text) {
        if (currentComment && text) {
            currentComment.text = text;
        }
    });

    saxStream.hookSync('end', function () {
        // Close the stream
        ts.end();
    })

    return dup;
}