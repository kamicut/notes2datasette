var SaxAsync = require('sax-async');
var fs = require('fs');

function saveNote(currentNote, callback) {
    console.log(currentNote);
    callback();
}

/** 
 * Code mostly from
 * https://github.com/mapbox/osm-comments-parser/tree/master/notes
 */
function parseNotes(done) {
    xmlFilename = xmlFilename;
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
    saxStream.hookAsync('closetag', function (next, tagName) {
        tagName = tagName.toLowerCase();
        if (tagName === 'note') {
            saveNote(currentNote, function () {
                currentNote = null;
                next()
            });
        } else if (tagName === 'comment') {
            currentComment = null;
            next();
        } else {
            next();
        }
    });
    saxStream.hookSync('text', function (text) {
        if (currentComment && text) {
            currentComment.text = text;
        }
    });
    saxStream.hookSync('end', function () {
        done();
    });

    return saxStream;
}

fs.createReadStream('./notes.xml')
    .pipe(parseNotes(function () { console.log('done') }))
