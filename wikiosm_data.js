// Functions to fetch data from Wikipedia, Wikidata and OpenStreetMap
// <script src="osmtogeojson.js"></script>

async function fetch_wiwosm_wiki(lang, article) {
  url = `https://tools.wmflabs.org/wiwosm/osmjson/getGeoJSON.php?lang=${lang}&article=${article}`;
  try {
    const response = await fetch(url);
    return await response.json();
  } catch (err) {
    console.error("fetch_wiwosm_wiki failed", err);
  }
}
//  fetch_wiwosm_wiki("en","Nile",console.log)

async function fetch_overpass(url) {
  try {
    const response = await fetch(url);
    const osmdata = await response.json();
    const osmgeojson = osmtogeojson(osmdata);
    return osmgeojson;
  } catch (err) {
    console.error("fetch_overpass failed", err);
  }
}

async function fetch_overpass_wikidata(QID) {
  if (typeof QID == "string") {
    url = `https://overpass-api.de/api/interpreter?data=%5Bout%3Ajson%5D%5Btimeout%3A25%5D%3B%0A(%0A%20%20node%5B%22wikidata%22%3D%22${QID}%22%5D%3B%0A%20%20way%5B%22wikidata%22%3D%22${QID}%22%5D%3B%0A%20%20relation%5B%22wikidata%22%3D%22${QID}%22%5D%3B%0A)%3B%0Aout%20body%3B%0A%3E%3B%0Aout%20skel%20qt%3B&target=compact`;
    return fetch_overpass(url);
  } else {
    // https://stackoverflow.com/questions/8495687/split-array-into-chunks
    const perChunk = 60;
    const QIDqueries = QID.reduce((all, one, i) => {
      const ch = Math.floor(i / perChunk);
      const query = `relation[wikidata=${one}];way[wikidata=${one}];`;
      all[ch] = (all[ch] || "") + query;
      return all;
    }, []);
    const urls = QIDqueries.map(
      QIDquery =>
        `https://overpass-api.de/api/interpreter?data=%5Bout%3Ajson%5D%5Btimeout%3A25%5D%3B%0A(${QIDquery})%3B%0Aout%20body%3B%0A%3E%3B%0Aout%20skel%20qt%3B&target=compact`
    );
    // https://stackoverflow.com/questions/47003789/es6-promises-with-timeout-interval
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    var geojson_array = [];
    for (let i = 0; i < urls.length; i++) {
      const geojson = await wait(i == 0 ? 0 : 1000).then(() =>
        fetch_overpass(urls[i])
      );
      await geojson_array.push(geojson);
    }

    return {
      type: "FeatureCollection",
      features: geojson_array
        .map(x => x.features)
        .reduce((all, one) => all.concat(one))
    };
  }
}

async function fetch_wikidata_tributaries(QID) {
  /*PREFIX schema: <http://schema.org/>
	PREFIX wd: <http://www.wikidata.org/entity/> 
	PREFIX wdt: <http://www.wikidata.org/prop/direct/>
	SELECT ?trib WHERE {
		?trib (wdt:P403|wdt:P201)+ wd:${QID}.
	}
  */
  sparql_url = `https://query.wikidata.org/sparql?query=PREFIX%20schema%3A%20%3Chttp%3A%2F%2Fschema.org%2F%3E%0APREFIX%20wd%3A%20%3Chttp%3A%2F%2Fwww.wikidata.org%2Fentity%2F%3E%20%0APREFIX%20wdt%3A%20%3Chttp%3A%2F%2Fwww.wikidata.org%2Fprop%2Fdirect%2F%3E%0ASELECT%20%3Ftrib%20%3Fsitelink%20WHERE%20%7B%0A%09%3Ftrib%20(wdt%3AP403%7Cwdt%3AP201)%2B%20wd%3A${QID}.%0A%20%20%3Fsitelink%20schema%3Aabout%20%3Ftrib%20.%09%0A%20%20%20%20%20%20%20%20%20%20%20%20%3Fsitelink%20schema%3AinLanguage%20%22en%22%0A%7D`;
  const tributaries = await fetch(sparql_url, {
    headers: new Headers({
      Accept: "application/sparql-results+json"
    })
  }).then(response => response.json());
  const QIDs = tributaries.results.bindings.map(x =>
    x.trib.value.replace("http://www.wikidata.org/entity/", "")
  );
  return QIDs;
}


// bbox is leaflet bounds: https://leafletjs.com/reference-1.3.4.html#bounds
async function fetch_wikidata_river_coords(bbox) {
  const endpointUrl = "https://query.wikidata.org/sparql",
    sparqlQuery = `SELECT distinct ?river ?riverLabel ?coordinates WHERE {
  SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en". }
  ?river wdt:P31/wdt:P279* wd:Q4022.
  ?sitelink schema:about ?river.
  FILTER(!REGEX(STR(?sitelink), "ceb.wikipedia.org/wiki/")) .
    SERVICE wikibase:box {
    ?river wdt:P625 ?coordinates.
    bd:serviceParam wikibase:cornerNorthEast "Point(${bbox.getNorthEast().lng} ${bbox.getNorthEast().lat})"^^geo:wktLiteral.
    bd:serviceParam wikibase:cornerSouthWest "Point(${bbox.getSouthWest().lng} ${bbox.getSouthWest().lat})"^^geo:wktLiteral.
  }
}`,
    fullUrl = endpointUrl + "?query=" + encodeURIComponent(sparqlQuery),
    headers = { Accept: "application/sparql-results+json" };

  return await fetch(fullUrl, { headers }).then(body => body.json());
}
