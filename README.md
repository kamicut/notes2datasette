# notes2datasette 

Turn the notes osm dump into a useful, browsable dataset. 

## TODO 
- [x] Parse XML
- [ ] Turn data to sqlite db (spatialite?)
- [ ] Package with `datasette`
- [ ] Figure out how to distribute? 
- [ ] Geospatial support?

## Running
- `wget https://planet.openstreetmap.org/notes/planet-notes-latest.osn.bz2`
- `bzip2 -dc planet-notes-latest.osn.bz2 > notes.xml`
- `npm install && npm start`

## Acknowledgments
- [OSM-comments-parser](https://github.com/mapbox/osm-comments-parser/tree/master/notes)
- [@batpad](http://github.com/batpad)
