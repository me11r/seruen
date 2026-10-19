# OSM pedestrian network · EXPO

`network.json`: derivative database, © OpenStreetMap contributors, ODbL 1.0.
License: https://opendatacommons.org/licenses/odbl/1-0/
Attribution: https://www.openstreetmap.org/copyright

Source endpoint, collection timestamp, query, bounding box, original OSM way IDs and links are embedded in the JSON. Collected OSM XML from 19 October 2026 was automatically reduced to a connected pedestrian network by `scripts/collect-paths.py`. No edges are inferred from proximity. All segment endpoints are original nodes belonging to the same original way.

This is a map-data verification, not an on-site survey or a guarantee of access. Coverage is EXPO only; no NU interior. The graph is intentionally incomplete outside the declared bounding box. Weather data is not part of this OSM-licensed database.

Update: `python3 scripts/collect-paths.py`. A single bounded Overpass request; no credentials or mass scrape. On network failure the previous snapshot is retained. Algorithm, exclusions and limitations: `docs/WIND.md`.
