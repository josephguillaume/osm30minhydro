async function load_ddm30_basins(mapLayers, select_basin) {
  const response = await fetch("data/ddm30_basins.topojson");
  const basins_topojson = await response.json();
  const basins = await topojson.feature(
    basins_topojson,
    basins_topojson.objects.basins
  );

  const subbasinsStyle = {
    color: "grey",
    weight: 3,
    opacity: 0.65,
    fillOpacity: 0.05 // needed to allow clicking
  };

  mapLayers.data.basins = await basins;

  await mapLayers.add(
    L.geoJson(basins, {
      style: subbasinsStyle,
      onEachFeature: function(feature, layer) {
        layer.on("click", function(e) {
          select_basin(e.target.feature.properties.basin_id);
        });
      }
    }),
    "Basins"
  );

  const basins_missing_wiki = await L.geoJson(basins, {
    style: {
      color: "red",
      weight: 0,
      fillOpacity: 0.5,
      interactive: false
    },
    filter: function(feature, layer) {
      var wiki = basin_wiki.filter(x => x[0] == feature.properties.basin_id);
      return wiki == null || wiki.length == 0;
    }
  });
  mapLayers.basins_missing_wiki = basins_missing_wiki;

  L.control
    .layers({}, { "Missing wiki": basins_missing_wiki })
    .addTo(mapLayers.map);
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
    filter: (feature, layer) => feature.properties.basin == basin_id
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
  object["basin_wiki"] = await text
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
        width: 200px;
        padding: 5px;
      `
      );
      div.innerHTML = `Basin ID: <input id=basin style="font-size:16px" onChange="select_basin(document.getElementById('basin').value)" size=6></input><div id=wiki></div>`;
      return div;
    },
    onRemove: function(map) {
      // Nothing to do here
    }
  });
  var selection_label = new L.Control.SelectionLabel({
    position: "topright"
  }).addTo(map);
}

function updateSelectionLabel(basin_id, wiki) {
  document.getElementById("basin").value = basin_id;

  const wikilabel =
    wiki != null && wiki != ""
      ? ` (<a href='http://en.wikipedia.org/wiki/${wiki}' target=_blank>${wiki}</a>)`
      : " (unknown wikipedia page)";
  document.getElementById("wiki").innerHTML = wikilabel;
}
