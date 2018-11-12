// Create Leaflet layers with Wikipedia, Wikidata and OpenStreetMap data
// <link rel="stylesheet" href="https://unpkg.com/leaflet@1.3.4/dist/leaflet.css" integrity="sha512-puBpdR0798OZvTTbP4A8Ix/l+A4dHDD0DGqYW6RQ+9jxkRFclaxxQb/SJAWZfWAkuyeQUytO7+7N4QKrDh+drA=="crossorigin="" />
// <script src="https://unpkg.com/leaflet@1.3.4/dist/leaflet.js" integrity="sha512-nMMmRyTVoLYqjP9hrbed9S+FzjZHW5gY1TWCHA5ckwXZBadntCNs8kEqAWdrb9O7rxbCaA4lKTIWjDXZxflOcA=="crossorigin=""></script>
// <script src="wikiosm_data.js"></script>

// Work-around because Leaflet doesn't name layers directly
// https://github.com/Leaflet/Leaflet/issues/1805
class Layers {
  constructor(map) {
    this.map = map;
    this.data = {};
  }
  add(layer, name) {
    this[name] = layer;
    layer.addTo(this.map);
  }
  remove(name) {
    if (this.hasOwnProperty(name)) {
      this.map.removeLayer(this[name]);
      delete this[name];
    }
  }
}

async function load_wiwosm_wiki(lang, article, tooltipOptions = {}) {
  return fetch_wiwosm_wiki(lang, article).then(data =>
    L.geoJson(data, {
      coordsToLatLng: function(coords) {
        // unproject EPSG:3857
        var pt = L.point(coords[0], coords[1]);
        var latlng = L.Projection.SphericalMercator.unproject(pt);
        return latlng;
      },
      onEachFeature: function(feature, layer) {
        layer.bindTooltip(decodeURI(article), tooltipOptions);
        layer.on("click", function(e) {
          url =
            lang == "wikidata"
              ? `http://www.wikidata.org/entity/${article}`
              : `http://${lang}.wikipedia.org/wiki/${article}`;
          window.open(url, "_blank");
        });
      }
    })
  );
}
// load_wiwosm_wiki("en", "Nile").then((layer) => layer.addTo(map));

load_wiwosm_wikidata = (QID, tooltipOptions = {}) =>
  load_wiwosm_wiki("wikidata", QID, tooltipOptions);
// load_wiwosm_wikidata("Q3392").then((layer) => layer.addTo(map));

async function load_overpass_wikidata(QID, tooltipOptions = {}) {
  return fetch_overpass_wikidata(QID).then(data =>
    L.geoJson(data, {
      onEachFeature: function(feature, layer) {
        // does this feature have a property named name?
        if (
          feature.properties &&
          feature.properties.tags &&
          feature.properties.tags.name
        ) {
          layer.bindTooltip(feature.properties.tags.name, tooltipOptions);
        }
        layer.on("click", function(e) {
          window.open(
            "https://www.openstreetmap.org/" + e.target.feature.id,
            "_blank"
          );
        });
      }
    })
  );
}
// load_overpass_wikidata("Q589911").then((layer) => layer.addTo(map));
// load_overpass_wikidata(["Q589911","Q1369002"]).then((layer) => layer.addTo(map));

// TODO: caching - avoid redownloading
// TODO: check query length, split
// TODO: simplifying large data, simplifying large queries
async function load_tributaries_overpass(QID) {
  const QIDs = await fetch_wikidata_tributaries(QID);
  return await load_overpass_wikidata(QIDs.concat([QID]));
}
// load_tributaries_overpass("Q589911").then((layer) => layer.addTo(map));

// https://stackoverflow.com/questions/6132796/how-to-make-a-jsonp-request-from-javascript-without-jquery
function jsonp(uri) {
  return new Promise(function(resolve, reject) {
    var id = "_" + Math.round(10000 * Math.random());
    var callbackName = "jsonp_callback_" + id;
    window[callbackName] = function(data) {
      delete window[callbackName];
      var ele = document.getElementById(id);
      ele.parentNode.removeChild(ele);
      resolve(data);
    };

    var src = uri + "&callback=" + callbackName;
    var script = document.createElement("script");
    script.src = src;
    script.id = id;
    script.addEventListener("error", reject);
    (
      document.getElementsByTagName("head")[0] ||
      document.body ||
      document.documentElement
    ).appendChild(script);
  });
}

// TODO: other than english?
async function load_tributaries_wiki(article) {
  if (typeof article === "undefined") return 0;
  if (article === null) return 0;
  const url = `http://www.wikidata.org/w/api.php?action=wbgetentities&titles=${encodeURI(
    article
  )}&sites=enwiki&props=sitelinks&sitefilter=enwiki&format=json&normalize=true`;
  const data = await jsonp(url);
  return await load_tributaries_overpass(Object.keys(data.entities)[0]);
}
// load_tributaries_wiki("Essequibo River").then((layer) => layer.addTo(map));
