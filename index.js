const SaxAsync = require('sax-async');
const fs = require('fs');
const through2 = require('through2');
const duplexify = require('duplexify');

const BATCH_SIZE = 1;


const knex = require('knex')({
    client: 'sqlite3',
    connection: {
        filename: "./notes.sqlite"
    },
    pool: {
        afterCreate: (conn, cb) =>
            conn.run(`PRAGMA synchronous = OFF`, function () {
                conn.run('PRAGMA journal_mode = MEMORY', cb)
            })
    },
    useNullAsDefault: true
});

function main(tr) {
    console.log('parsing');
    fs.createReadStream('./notes.xml')
        .pipe(parseNotes())
 //       .pipe(batch)
        .pipe(batchSave(tr))
        .on('error', function (err) {
            console.error(err);
            process.exit(1);
        });
}



/* 
Check if table exists
If it does, truncate the data
else create the table
*/
knex.schema.hasTable('comments')
.then(function (exists) {
    if (!exists) {
        console.log('creating table')
        return knex.schema.createTable('comments', table => {
            table.increments('id');
            table.integer('note_id');
            table.float('latitude');
            table.float('longitude');
            table.dateTime('created_at');
            table.dateTime('closed_at');
            table.string('action');
            table.datetime('timestamp');
            table.string('uid');
            table.string('user');
            table.text('text');
        })
    }
    else {
        console.log('table exists, truncating')
        return knex('comments').truncate()
    }
})
.then(
    () => {
            main(knex)
    })
.catch(function (err) {
    console.error(err)
    process.exit(1);
})

let num_comments = 0;
const batchSave = (knex) => through2.obj(function (records, enc, callback) {
    return knex('comments').insert(records)
        .then(function () {
            num_comments += BATCH_SIZE;
            process.stdout.write(`saved ${num_comments} comments\r`)
            return callback();
        });
});

let buffer = []
const batch = through2.obj(function (record, enc, callback) {
    buffer.push(record)
    if (buffer.length >= BATCH_SIZE) {
        this.push(buffer)
        delete(buffer)
        buffer = []
    }
    callback()
}, function () {
    if (buffer.length) {
        this.push(buffer)
    }
    callback()
})

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

    return dup;
}