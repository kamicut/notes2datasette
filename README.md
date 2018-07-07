# notes2datasette 

Turn the notes osm dump into a useful, browsable dataset. 

## Running
- `wget https://planet.openstreetmap.org/notes/planet-notes-latest.osn.bz2`
- `bzip2 -dc planet-notes-latest.osn.bz2 > notes.xml`
- `npm install && npm start`
- `pip3 install datasette`
- `pip3 install datasette-cluster-map`
- `datasette package notes.sqlite --extra-options="--config sql_time_limit_ms:10000" --install=datasette-cluster-map `

This creates a dockerfile (the internal port is 8001)

## Acknowledgments
- [OSM-comments-parser](https://github.com/mapbox/osm-comments-parser/tree/master/notes)