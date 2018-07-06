var SaxAsync = require('sax-async');
var fs = require('fs');
const knex = require('knex')({
    client: 'sqlite3',
    connection: {
        filename: "./notes.sqlite"
    },
    useNullAsDefault: true
});

knex.schema.createTable('comments', table => {
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
}).then(function () {
    console.log('parsing');
    parseNotes('./notes.xml', function () {
        console.log('done');
    })
})

function saveNote(note) {
    var attribs = note.attributes;
    var note_id = attribs.ID;
    var lat = parseFloat(attribs.LAT);
    var lon = parseFloat(attribs.LON);
    var closed_at = attribs.CLOSED_AT;
    var created_at = attribs.CREATED_AT;

    let promises = note.comments.map((comment) => {
        let cattribs = comment.attributes;
        let action = cattribs.ACTION;
        let timestamp = cattribs.TIMESTAMP;
        let uid = cattribs.UID;
        let text = comment.text || '';
        return knex('comments').insert({
            note_id,
            latitude: lat,
            longitude: lon,
            closed_at: closed_at? new Date(closed_at) : null,
            created_at: created_at? new Date(created_at) : null,
            action,
            timestamp: timestamp? new Date(timestamp) : null,
            uid,
            text
        })
    });

    return Promise.all(promises)
}

/** 
 * Code mostly from
 * https://github.com/mapbox/osm-comments-parser/tree/master/notes
 */
function parseNotes(xmlFilename, done) {
    var count = 0;
    var comments = 0;
    var saxStream = new SaxAsync();
    var currentNote, currentComment;
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
    saxStream.hookAsync('closetag', async function (next, tagName) {
        tagName = tagName.toLowerCase();
        if (tagName === 'note') {
            await saveNote(currentNote);
            count +=1 ;
            comments += currentNote.comments.length;
            process.stdout.write(`saved ${count} notes, ${comments} comments\r`)
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
        done();
    })

    fs.createReadStream(xmlFilename)
        .pipe(saxStream);
}