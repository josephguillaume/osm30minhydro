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
    // TODO: may want to not have controls sometimes?
    this.layerControl = L.control
      .layers({}, {}, { position: "bottomright" })
      .addTo(this.map);
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
  addToControl(layer, name) {
    this[name] = layer;
    this.layerControl.addOverlay(layer, name);
  }
  removeFromControl(name) {
    if (this.hasOwnProperty(name)) {
      this.layerControl.removeLayer(this[name]);
      this.remove(name);
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
              ? `https://www.wikidata.org/entity/${article}`
              : `https://${lang}.wikipedia.org/wiki/${article}`;
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

async function load_tributaries_wiki(article) {
  if (typeof article === "undefined" || article === null) return 0;

  if (Array.isArray(article)) {
    // https://stackoverflow.com/questions/47003789/es6-promises-with-timeout-interval
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    var layer_array = [];
    for (let i = 0; i < article.length; i++) {
      const layer = await wait(i == 0 ? 0 : 1000).then(() =>
        load_tributaries_wiki(article[i])
      );
      await layer_array.push(layer);
    }
    return await L.layerGroup(layer_array);
  }

  const lang = article.indexOf(":") > -1 ? article.split(":")[0] : "en";
  article = article.indexOf(":") > -1 ? article.split(":")[1] : article;

  const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&titles=${encodeURI(
    article
  )}&sites=${lang}wiki&props=sitelinks&sitefilter=enwiki&format=json&normalize=true`;
  const data = await jsonp(url);
  const entity = Object.keys(data.entities)[0];
  if(entity=="-1") return null;
  return await load_tributaries_overpass(entity);
}
// load_tributaries_wiki("Essequibo River").then((layer) => layer.addTo(map));

// https://stackoverflow.com/questions/22536467/how-to-retrieve-latitude-and-longitude-from-geosparqls-wktliteral?rq=1
wktToLatLng = wkt => [
  wkt.replace(/^.* ([-]?[0-9\\.]+)[^0-9\\.]*$/, "$1"),
  wkt.replace(/^[^0-9\\.-]*([-]?[0-9\\.]+) .*$/, "$1")
];

async function load_wikidata_river_coords(bbox) {
  const data = await fetch_wikidata_river_coords(bbox);

  const wikidata_riversMarkerOptions = {
    radius: 4,
    fillColor: "purple",
    color: "purple",
    weight: 1,
    opacity: 1,
    fillOpacity: 0.8
  };

  var points = data.results.bindings.map(x =>
    L.circleMarker(
      wktToLatLng(x.coordinates.value),
      wikidata_riversMarkerOptions
    )
      .bindTooltip(x.riverLabel.value)
      .on("click", () => {
        // TODO: avoid using variable in global environment
        load_tributaries_overpass(
          x.river.value.replace("http://www.wikidata.org/entity/", "")
        ).then(x => mapLayers.add(x, "wikidata rivers"));
        window.open(x.river.value, "_blank");
      })
  );

  return L.layerGroup(points);
}
