async function load_ddm30_basins(mapLayers, select_basin) {
  const response = await fetch("data/ddm30_basins.topojson");
  const basins_topojson = await response.json();
  mapLayers.data.basins_topojson = basins_topojson;

  const basins = await topojson.feature(
    basins_topojson,
    basins_topojson.objects.basins
  );
  mapLayers.data.basins = await basins;

  const subbasinsStyle = {
    color: "grey",
    weight: 3,
    opacity: 0.65,
    fillOpacity: 0.05 // needed to allow clicking
  };

  // TODO: this is just to get bounding boxes on basins
  mapLayers.Basins_orig = await L.geoJson(basins, {
    style: subbasinsStyle,
    onEachFeature: function(feature, layer) {
      layer.on("click", function(e) {
        select_basin(e.target.feature.properties.basin_id);
      });
    }
  });

  await mapLayers.addToControl(
    L.vectorGrid
      .slicer(basins_topojson, {
        rendererFactory: L.canvas.tile,
        vectorTileLayerStyles: {
          basins: subbasinsStyle
        },
        interactive: true,
        getFeatureId: f => f.properties.basin_id
      })
      .on("click", e => select_basin(e.layer.properties.basin_id)),
    "Basins"
  );

  // TODO: add a control that toggles style of Basins layer instead?
  const basins_missing_wiki = await L.vectorGrid.slicer(basins_topojson, {
    rendererFactory: L.canvas.tile,
    vectorTileLayerStyles: {
      basins: properties => {
        // TODO: use proper filtering instead
        // https://github.com/Leaflet/Leaflet.VectorGrid/issues/153
        const wiki = basin_wiki.filter(x => x[0] == properties.basin_id);
        return wiki == null || wiki.length == 0
          ? {
              fill: true,
              fillColor: "red",
              weight: 0,
              fillOpacity: 0.5
            }
          : {
              fillOpacity: 0,
              stroke: false,
              fill: false,
              opacity: 0,
              weight: 0
            };
      }
    },
    interactive: false,
    getFeatureId: f => f.properties.basin_id
  });

  mapLayers.basins_missing_wiki = basins_missing_wiki;

  mapLayers.addToControl(basins_missing_wiki, "Missing wiki");
}

async function fetch_ddm30_lines(mapLayers) {
  const response = await fetch("data/ddm_lines_cells.json");
  const ddm30_lines = await response.json();

  mapLayers.data.ddm_lines_cells = await ddm30_lines;
}

load_basin_ddm = function(mapLayers, basin_id) {
  mapLayers.remove("basin_ddm");

  const ddmLinesStyle = {
    color: "black",
    weight: 2,
    opacity: 0.65,
    clickable: false
  };

  layer_ddmLines_cells_line = L.geoJson(mapLayers.data.ddm_lines_cells, {
    style: ddmLinesStyle,
    filter: (feature, layer) =>
      feature.properties.basin == basin_id &&
      feature.properties.strahler >= mapLayers.basin_min_strahler
  });
  layer_ddmLines_cells_arrowhead = L.polylineDecorator(
    layer_ddmLines_cells_line.getLayers(),
    {
      patterns: [
        {
          offset: "100%",
          repeat: 0,
          symbol: L.Symbol.arrowHead({
            pixelSize: 10,
            pathOptions: { fillOpacity: 1, weight: 0, color: "black" }
          })
        }
      ]
    }
  );
  layer_ddmLines_cells = L.layerGroup([
    layer_ddmLines_cells_line,
    layer_ddmLines_cells_arrowhead
  ]);
  mapLayers.add(layer_ddmLines_cells, "basin_ddm");
};

async function get_basin_wiki(object = window) {
  const response = await fetch("basin_wiki.csv");
  const text = await response.text();
  return await text
    .split("\n")
    .map(line => line.split(",").map(cell => cell.replace(/"/g, "")));
}

function highlightSelectedBasin(mapLayers, basin_id) {
  var selectedBasinsStyle = {
    color: "orange",
    weight: 3,
    opacity: 0.65,
    fill: false
  };

  const layer_selected_basin = L.geoJson(mapLayers.data.basins, {
    style: selectedBasinsStyle,
    filter: feature => feature.properties.basin_id == basin_id
  });
  mapLayers.add(layer_selected_basin, "Selected basin");
  mapLayers.map.fitBounds(layer_selected_basin.getBounds());
}

function setupSelectionLabel(map) {
  L.Control.SelectionLabel = L.Control.extend({
    onAdd: function(map) {
      var div = L.DomUtil.create("div");
      div.setAttribute(
        "style",
        `
        font-size: 16px;
        background-color: white;
        height: 80px;
        padding: 5px;
      `
      );
      div.innerHTML = `River basin: <input id=basin style="font-size:16px" onChange="select_basin(document.getElementById('basin').value)" size=15></input>
      <div id=wiki></div>
      Min stream order: <input id="strahler_min" type="number" value=1 style="width: 3em" title="Minimum Strahler number"
        onChange="mapLayers.basin_min_strahler=document.getElementById('strahler_min').value;load_basin_ddm(mapLayers,mapLayers.selected_basin_id);" size=3></input>`;
      return div;
    },
    onRemove: function(map) {
      // Nothing to do here
    }
  });
  var selection_label = new L.Control.SelectionLabel({
    position: "topright"
  }).addTo(map);

  var input = document.getElementById("basin");
  new Awesomplete(input, {
    list: basin_wiki
      .map(x => [x[1], x[0]])
      .concat(basin_wiki.map(x => [x[0], x[0]]))
  });
  input.addEventListener("awesomplete-select", event =>
    select_basin(event.text.value)
  );
}

function updateSelectionLabel(basin_id, wiki) {
  document.getElementById("basin").value = basin_id;

  var wikilabel = " (unknown wikipedia page)";
  getWikiLink = article => {
    const lang = article.indexOf(":") > -1 ? article.split(":")[0] : "en";
    article =
      article.indexOf(":") > -1 ? article.split(":")[1].trim() : article.trim();

    var link = `<a href='http://${lang}.wikipedia.org/wiki/${article}' target=_blank>${article}</a>`;
    link = link + (lang == "en" ? "" : ` (${lang})`);
    return link;
  };
  if (Array.isArray(wiki) && wiki.length > 0)
    wikilabel = "(" + wiki.map(getWikiLink).join(", ") + ")";
  if (wiki.length > 0 && /^\s*$/.test(wiki[0]))
    wikilabel = "No visible watercourse";
  if (typeof wiki === "string")
    wikilabel = ` (<a href='http://en.wikipedia.org/wiki/${wiki}' target=_blank>${wiki}</a>)`;
  document.getElementById("wiki").innerHTML = wikilabel;
}
